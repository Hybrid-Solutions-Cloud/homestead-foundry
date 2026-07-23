# Design: cost and governance

- Status: Proposed (phase 4 design)
- Date: 2026-07-11
- Author: foundry-architect (Fable)
- WAF pillar: **Cost Optimization** (set spending guardrails, measure unit cost, optimize rates)
- Grounded in: **ADR-0006** (cost governance and the spending cap), **ADR-0002** (image model, tokens-per-image UNKNOWN, Flash lever), plus ADR-0001 (MVP credit mechanics) and ADR-0003 (voice rate); research base SPIKE-05 and SPIKE-01
- Designs only what the ADRs decided; anything an ADR left open is listed under "ADR gaps" at the end

## Scope

The general money-governance pattern for a shared Azure AI Foundry account: how a monthly spending cap is actually enforced (three independent layers, and which one is the real cap), the Azure budget specification, the CAF tag scheme, credit burn-down reporting, the lower-cost-tier-for-bulk cost lever, and the measurement plan for the one number nobody has going in: tokens per generated image. This is written as a pattern any reader can apply to their own Azure AI Foundry build. A closing "Worked example" section restates the pattern as deployed in this repo's own production instance, serving two publishing brands, as proof it works.

## Naming pattern (CAF-shaped placeholders)

| Item | Placeholder name pattern |
| --- | --- |
| Resource group | `rg-<workload>-<env>-<region>-<instance>` |
| Azure AI Foundry (AIServices) account | `ais-<workload>-<env>-<region>-<instance>` |
| Foundry project | `proj-<workload>-<purpose>-<instance>` |
| Image model deployment | `<model-deployment-name>` (named after the model itself, for example `mai-image-25` for MAI-Image-2.5, so a deployment rename never has to follow a version bump) |
| Monthly budget | `budget-<workload>-<env>-<region>-<instance>` |
| Key Vault (existing platform vault, REUSED, never recreated) | `kv-<platform>-vault-<instance>` |
| Region | Whichever Azure region actually hosts the account and its model deployments (verify current model/region availability at deploy time) |
| Tags | `initiative=<workload>`, `env=<env>`, `owner=<alias>`, `costCenter=<value>` |

See the worked example at the end of this document for the real names behind this repo's own deployment.

## 1. Cost model: everything is token metered

There is no charge for the Foundry account, the Foundry project, or the image model deployment itself. Billing is entirely usage meters on the account.

### 1.1 Image meters (working figures, verification gated)

Per 1M tokens:

| Meter | MAI-Image-2.5 | MAI-Image-2.5-Flash |
| --- | --- | --- |
| Text input | 5.00 USD | 1.75 USD |
| Image input (edits arm) | 8.00 USD | 1.75 USD |
| Image output (the generated PNG, the dominant meter) | 47.00 USD | 33.00 USD |

Confidence caveat carried from SPIKE-05 and SPIKE-01: the first-party pricing page is a client-rendered widget that did not render during research; the figures are corroborated by indexed search and third-party catalogs, with one conflicting secondary figure noted for Flash output. **Gate: read the live rates in the Foundry portal before the first paid batch.** Never authorize a batch against an unconfirmed rate combined with an unmeasured tokens-per-image.

### 1.2 The declared UNKNOWN: tokens per generated image

Microsoft publishes no tokens-per-image figure for any MAI image model, and the documented response shows no usage field. Every image dollar figure in this design scales linearly off this number. **It is UNKNOWN by decision (ADR-0002 decision 5) and is measured in the smoke test, not assumed.** Until measured, the pipeline guard uses a deliberately conservative high assumption, 4,200 output tokens per image (about 0.20 USD per image on 2.5), so the guard trips early rather than late (ADR-0006 decision 1). Measurement plan in section 7.

### 1.3 Voice meter (first-party confirmed, deterministic)

MAI-Voice-2 bills at **22 USD per 1M characters** on S0. Characters are known before each call, so voice cost is exact pre-spend, which is why the pipeline guard can enforce the cap with zero overshoot for voice. A one-time backfill across an initiative's existing content (adding a new voice to the whole back catalog) is typically the single largest voice cost event; ongoing steady-state narration cost is small by comparison, on the order of low single-digit USD per month. See the worked example for this initiative's actual backfill and steady-state figures. Confirm the meter on the Azure Speech pricing page at provisioning.

### 1.4 Spend forecast against the cap

Before authorizing any batch, forecast spend across at least three scenario types and check each against the chosen monthly cap:

| Month type | What drives cost |
| --- | --- |
| Steady state | Ordinary day-to-day narration, occasional small image regen |
| Backfill month | A one-time catch-up pass over existing content (for example, adding a new voice across the entire back catalog) |
| Full push | A backfill plus a full image-catalog build-out landing in the same month |

A cap is well sized when it comfortably covers the realistic full-push scenario while still being tight enough to stop a runaway loop (ADR-0006 context). See the worked example for the actual figures behind this initiative's cap.

## 2. The three enforcement layers (ADR-0006 decision, verbatim intent)

**The pipeline guard is the real cap. The Azure budget is a rear-view notifier. The spending limit is the invoice stop.** An Azure budget alert is a notification, not a hard cap: these services offer no platform hard-limit feature, budgets are evaluated against the threshold about once per day, and the alert fires after the money is spent.

| Layer | Mechanism | Timing | Stops spend |
| --- | --- | --- | --- |
| 1. Real cap | A budget-usd flag plus an in-pipeline ledger, evaluated client-side before each metered call | Synchronous, before each metered call | **Yes**: refuses the call before the money is spent |
| 2. Backstop | `budget-<workload>-<env>-<region>-<instance>`, resource-group scope, alert-only | Evaluated about once per day, after the spend; emails may lag up to 24 hours | No: detects and notifies |
| 3. Invoice stop | Azure spending limit, kept **ON** | At the credit ceiling | Yes: auto-disables the subscription instead of invoicing |

### 2.1 Layer 1: the pipeline hard stop

- A per-month in-pipeline ledger (`chars`, `estUsd` with `estUsd = chars * 22 / 1,000,000` for voice) is printed at the end of every run; a `--*-budget-usd <n>` flag refuses to proceed once the month's estimated spend would exceed the flag. This mirrors any existing per-tier usage guard already proven in the publish pipeline.
- Voice enforcement is exact (characters known pre-call). Image enforcement uses the conservative 4,200-tokens-per-image assumption until the smoke test replaces it with the measured value.
- **Default set to match the cap, with one owner-decided exception:** the guard can be lifted deliberately during a credit-burn window so spend can be front-loaded before the credit resets, then the default reverts to the cap amount once the credit resets (ADR-0006 decision 1). During that window, layer 3 is the only stop; acceptable only when the worst realistic month still fits inside a single monthly credit.
- The ledger is also the attribution record: it knows consumer (brand, product, tenant), voice, and model per call (section 5).
- Wiring detail (which files, which flags) is specified in `pipeline-integration-design.md`.

### 2.2 Layer 2: the Azure budget (alert-only by platform design)

| Property | Value |
| --- | --- |
| Name | `budget-<workload>-<env>-<region>-<instance>` |
| Scope | The workload's resource group (aggregates every consumer and every model sharing the account; isolates the initiative from unrelated subscription cost) |
| Amount | The chosen monthly cap |
| Reset period | Monthly |
| Actual-cost alert thresholds | 50, 75, 90, and 100 percent |
| Forecasted alert threshold | 100 percent |
| Notification | One action group, email to the owner (up to 5 thresholds and 5 recipients are supported; this design uses 5 thresholds, 1 recipient) |
| Enforcement | **None. Alert-only.** Never treated as the cap |

Optionally, later and explicitly as custom development, the action group could flip a "publish disabled" flag; ADR-0006 permits that as a backstop and forbids treating it as the cap.

### 2.3 Layer 3: the spending limit stays ON

The subscription is an MVP credit subscription: the credit resets monthly and the spending limit auto-disables the subscription at the credit ceiling rather than billing a card. Keeping it ON is the only mechanism that prevents spend from becoming a real invoice. It is removed only if the owner deliberately elects pay-as-you-go for a spend that must exceed the monthly credit (ADR-0006 decision 3).

## 3. CAF tag scheme (ADR-0006 decision, values locked this phase)

Applied to **both** the resource group and the Foundry account **before the backfill runs** (tags are not retroactive in cost data), with tag inheritance enabled in Cost Management so resource-group tags flow into cost records.

| Tag key | Value | Purpose |
| --- | --- | --- |
| `initiative` | `<workload>` | Isolates this workload's spend from everything else in the subscription |
| `env` | `<env>` | Separates this environment from any future non-production resource. Choose the value deliberately and record the choice; see the worked example for this initiative's chosen value |
| `owner` | `<alias>` (name only, set at deploy) | Accountability |
| `costCenter` | `<value>` (set at deploy, optional) | Chargeback rollups |

Two helpers and one hard limitation:

- Foundry auto-tags Models-sold-by-Azure usage with a `project` tag, so a named Foundry project gives per-project image cost in Cost Analysis with zero manual tagging. Whether MAI-Voice-2 usage (billed through Speech) carries the same tag is UNKNOWN; the ledger covers attribution regardless.
- **Azure tags cannot split spend by consumer when one account serves several.** A shared account serving multiple brands, products, or tenants has no per-request tag, so Azure meters aggregate all of them together. The pipeline ledger is the authoritative per-consumer and per-model ledger; Azure gives the initiative-level rollup and the reconciliation baseline.
- Expect some records to show as untagged for services that omit tags from usage data. Do not bother with formal cost-allocation rules (they need EA or MCA-E billing roles and add nothing here).

## 4. Reporting and credit burn-down (ADR-0006)

- **Automated credit alerts are Enterprise-Agreement-only**, and an MVP credit subscription is unlikely to be EA, so they are not part of this design. The portable substitute:
  1. `budget-<workload>-<env>-<region>-<instance>` (section 2.2) as the always-on threshold notifier.
  2. A **saved Cost Analysis view** scoped to the workload's resource group, accumulated costs, monthly granularity, **Group by Meter** (separates image-output, image-input, and voice-character spend; meters appear per model).
  3. A **scheduled Cost Analysis email** off that saved view: daily during any credit-burn push, weekly at steady state, so consumption is visible without opening the portal.
  4. Optionally, a subscription-scoped budget set to the monthly credit amount, watching total credit burn rather than this workload alone (the credit amount is owner-supplied, not fixed by any design decision).
- Both meters draw down the credit: an image model bills as Models sold by Azure and MAI-Voice-2 as first-party Speech, and Azure credit covers both, which is exactly the intent of burning the credit before it resets.
- Reconciliation habit: after each backfill run, compare the run's ledger print against the Group-by-Meter view once ingestion catches up, so ledger drift is caught early while the amounts are small.

## 5. Attribution model

| Question | Answered by |
| --- | --- |
| What did the initiative spend this month | The resource-group budget and the RG-scoped Cost Analysis view (tags: `initiative=<workload>`) |
| Image versus voice split | Cost Analysis, Group by Meter |
| Per-project image spend | The auto-applied Foundry `project` tag |
| Per-brand (or per-consumer) split, per voice, per model | **The pipeline ledger only** (Azure cannot see individual consumers on a shared account) |
| Cost per image | The smoke-test measurement (section 7), then the ledger's running actuals |

## 6. The lower-cost-tier-for-bulk cost lever (ADR-0002 decision 4, ADR-0006 inputs)

- **The full-quality tier for the pilot and for all final published or hero art.** The pilot exists to prove style match at maximum quality; proving it on a lower-cost tier would prove nothing about the full-quality tier.
- **The lower-cost tier ("Flash" or equivalent) for bulk only after a pilot arm proves style parity.** Such a tier typically exposes the same endpoints, the same parameters, and the same requests-per-minute ceiling as the full-quality tier, so it buys lower per-token cost, not throughput. Expected saving on a realistic catalog backfill is typically modest, so quality wins unless parity is demonstrated. See the worked example for this initiative's actual measured saving.
- When the lower-cost tier is justified: (a) a pilot arm has shown acceptable quality on the target style, or (b) large throwaway candidate sweeps, or (c) the catalog grows enough that a roughly 30 percent output saving becomes material.
- **Never substitute an older or retiring model version to save money:** check each model's retirement date and endpoint support (for example, an older generation lacking an edits endpoint) before ever treating it as a cost lever (ADR-0002).

## 7. Measurement plan: converting the UNKNOWN into a number

The first metered image calls are a **cost probe**, run before any batch is authorized (ADR-0002 decision 5, ADR-0006 follow-up):

1. Make one or two generation calls at the target canvas size.
2. Inspect the live JSON response for a usage or token-count field. If present, record tokens per image directly.
3. If absent, run a fixed micro-batch (for example 20 images at the target canvas size), wait for cost ingestion, read the image-output meter delta in the Group-by-Meter view, and divide by the batch size.
4. Optionally repeat at a second canvas size to learn whether output tokens scale with pixels.
5. Write the measured tokens-per-image into the image ledger, replacing the conservative 4,200 assumption, and recompute the pilot and backfill forecasts as point numbers.
6. Re-read the live rate card at the same time (section 1.1 gate).

Also owner-facing at the same milestone: confirm the credit offer type and reset date in Cost Management plus Billing (so "resets monthly" is verified rather than assumed), and reset the budget-usd flag to the cap amount when the credit resets.

## 8. Cost build checklist (deploy-phase gate)

- [ ] Tags applied to the resource group and the Foundry account before the first metered call; tag inheritance enabled
- [ ] Budget created exactly per the section 2.2 table (RG scope, cap amount, 50/75/90/100 actual plus 100 forecast, action group emailing the owner)
- [ ] Azure spending limit confirmed ON
- [ ] Image rate card read live in the Foundry portal; voice meter confirmed on the Speech pricing page
- [ ] Cost probe run; measured tokens-per-image written into the ledger; forecasts recomputed
- [ ] Budget-usd flag posture set: lifted during any credit-burn window by owner decision, default reverts to the cap after the credit resets
- [ ] Saved Cost Analysis view (RG scope, Group by Meter) created; scheduled email active (daily during burn, weekly after)
- [ ] Credit offer type and reset date confirmed with the owner

## ADR gaps found (not invented here, flagged for the owner or reviewer)

1. **`owner` and `costCenter` tag values are not set by any ADR.** ADR-0006 fixes the keys and purposes; the values are owner input at deploy time.
2. **`env` tag value.** ADR-0006's illustrative table used a non-production example value; the choice of the actual `env` value is a deliberate, deployment-specific lock. ADR-0004 delegated final naming tokens to the design phase, so this is recorded for the reviewer rather than fixed here. See the worked example for this initiative's chosen value.
3. **The monthly credit amount is not recorded in any ADR**, so the optional subscription-scoped credit budget (section 4) cannot be sized without the owner. It is optional per ADR-0006 and omitted until the owner supplies the amount.
4. **Voice `project`-tag coverage is UNKNOWN** (carried from SPIKE-05): whether Speech-billed MAI-Voice-2 usage carries the auto `project` tag is undocumented. No design impact; the ledger covers attribution.
5. **The image tool's ledger persistence location** is not specified by ADR-0006 or ADR-0008; `pipeline-integration-design.md` places it as a state sidecar mirroring the publish pipeline's pattern and flags it there as a design elaboration.

## Sources

- `docs/adr/ADR-0006-cost-governance.md` (three-layer enforcement, budget spec, tag keys, credit mechanics, EA-only credit alerts)
- `docs/adr/ADR-0002-image-model-and-access.md` (tokens-per-image UNKNOWN, smoke-test probe, Flash lever, retiring alternatives)
- `docs/adr/ADR-0001-target-tenant.md` (MVP credit subscription, spending limit behavior)
- `docs/adr/ADR-0003-voice-model-and-voice-set.md` (22 USD per 1M characters, S0, every MAI character billable)
- `docs/research/SPIKE-05-cost-governance.md` (rate card and its confidence caveats, rollups, budget latency facts, tag mechanics, reporting substitutes)
- `docs/research/SPIKE-01-image-model.md` (token mechanics and the measurement method, via SPIKE-05)
- `docs/research/SPIKE-06-pipeline-integration.md` (the existing F0-tier character guard the pipeline ledger mirrors, verified in `publish.mjs` in both consumer repos)

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Gunner the Lab / Holdfast Press

This is the pattern above as deployed in this repo's own production instance, proof it works, not a template to copy verbatim.

**Real names (fixed for every design doc in this repo):**

| Item | Canonical name |
| --- | --- |
| Resource group | `rg-studioai-prod-eus-01` |
| Azure AI Foundry (AIServices) account | `aif-studioai-prod-eus-01` |
| Foundry project | `proj-studioai-media-01` |
| MAI-Image-2.5 deployment | `mai-image-25` |
| Monthly budget | `budget-studioai-prod-eus-01` |
| Key Vault (existing platform vault, REUSED, never recreated) | `kv-hcs-vault-01` |
| Region | East US (`eastus`) |
| Tags | `initiative=studio-foundry`, `env=prod`, `owner=<alias>`, `costCenter=<value>` |

**The real cap: 100 USD per month**, enforced by the same three layers described above (`--mai-budget-usd`, `budget-studioai-prod-eus-01`, and the subscription spending limit kept ON).

**Real voice backfill split (SPIKE-05):** a three-voice backfill across both brands costs about 32 USD one time (Gunner the Lab about 29.70 USD, Holdfast Press about 2.09 USD, reflecting each brand's back-catalog size); ongoing steady state is about 1 to 2 USD per month.

**Real spend forecast against the 100 USD cap:**

| Month type | Voice | Image | Total | Versus 100 USD |
| --- | --- | --- | --- | --- |
| Steady state | ~1.78 USD | occasional small regen | ~2 to 5 USD | 2 to 5 percent |
| Voice-backfill month | ~32 USD | pilot ~1 to 4 USD | ~33 to 36 USD | ~35 percent |
| Full push, images on 2.5 | ~32 USD | catalog ~17 to 68 USD | ~49 to 100 USD | at the cap |
| Full push, images on Flash | ~32 USD | catalog ~10 to 48 USD | ~42 to 80 USD | under the cap |

The cap is well sized: it absorbs the entire one-shot build-out for both brands yet still stops a runaway loop (ADR-0006 context).

**Real Flash-for-bulk saving:** expected saving on Gunner the Lab's 340-image catalog backfill is roughly 5 to 20 USD, modest, so MAI-Image-2.5 (not Flash) is used for the pilot and all final published or hero art; Flash is reserved for after a Flash arm proves style parity, or for large throwaway candidate sweeps.

**Real `env` tag value:** `prod`, consistent with these resource names, chosen over ADR-0006's illustrative `demo` example because this account produces production-serving assets for both live brands (ADR gap 2 above).

**Real attribution split:** Azure cannot separate Gunner the Lab from Holdfast Press on the shared account (one account, no per-request tag); the pipeline `maiLedger` is the only place that knows the brand, voice, and model behind each call, and is reconciled against the Group-by-Meter Cost Analysis view after each backfill run.

&lt;!-- safety-scan-worked-example:end -->
