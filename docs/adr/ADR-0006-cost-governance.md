# ADR-0006: Cost governance and the monthly budget cap

- Status: Proposed
- Date: 2026-07-11
- Decider: repo owner

## Context

The initiative runs a shared Azure AI Foundry (AIServices) resource that meters generation and synthesis calls per token or per character. Whoever deploys this build sets a fixed monthly budget cap for that shared resource (the concrete figure for the first proven build is in the Worked example). SPIKE-05 (`docs/research/SPIKE-05-cost-governance.md`) turns a build's pricing into a decision-grade rollup and specifies how that cap is really enforced; SPIKE-03 (`docs/research/SPIKE-03-tenant-readiness.md`) supplies the MVP credit mechanics. The forces:

- **The cap should be sized to absorb a one-shot build-out.** Steady state after backfill is a few dollars a month. The biggest realistic single month is the initial content backfill (voice narration plus the first image-catalog generation), so the cap should be set high enough to absorb that one-time build-out yet low enough to stop a runaway loop.
- **An Azure budget alert is a notification, not a hard cap.** This is the central governance fact and it is first-party: Foundry and Azure OpenAI provide no hard spending limit. Budgets are evaluated against the threshold roughly once per day, and the notification fires after the spend, so a budget is a rear-view detector, not a valve.
- **The only synchronous, pre-spend stop is the pipeline.** The publish pipeline's own guard runs client-side and ahead of each metered call: a per-month ledger records the estimated characters or tokens and the estimated USD, plus a budget-guard flag that refuses to proceed once the month's estimated spend would exceed the flag. For voice or synthesis this is deterministic (characters are known before the call); for images it is approximate until tokens-per-image is measured.
- **The MVP credit is the real invoice-side backstop.** The primary is a credit subscription that ships with an Azure spending limit which auto-disables the subscription at the credit ceiling rather than billing a card. Leaving the spending limit ON is the only mechanism that prevents spend from becoming a real invoice.
- **Automated credit alerts are Enterprise-Agreement-only.** Cost Management's automatic credit alerts (at 90 and 100 percent of a prepayment) exist only on Enterprise Agreement offers; the MVP credit is unlikely to be EA, so the portable substitute is a budget plus scheduled Cost Analysis emails.
- **One shared resource means Azure tags cannot split the consuming workloads.** There is no per-request tag on an individual generation or synthesis call, so the meter aggregates every consuming workload; the pipeline ledger is the per-workload and per-model source of truth.

## Decision

**Enforce the monthly budget cap in three independent layers, and treat the pipeline guard, not the Azure budget, as the real cap:**

1. **Real cap (synchronous, pre-spend): the pipeline budget-guard flag and per-month ledger in the publish pipeline.** This is the authoritative stop because it refuses a call before the money is spent. Set the default to match the cap. Honor the deployer's decision to keep the guard effectively lifted during the credit-burn window (to front-load spend before the credit resets), then set it to the cap once the credit resets. Voice is enforced exactly; for images use a deliberately conservative (high) tokens-per-image assumption so the guard trips early rather than late, then switch to the measured value after the smoke test.
2. **Backstop (reactive, notify-only): a resource-group-scoped Azure budget.** Create a monthly budget at the cap on the shared Foundry resource's resource group (RG scope aggregates every consuming workload and every model and isolates the initiative from unrelated subscription cost). Configure actual-cost alert thresholds at 50, 75, 90, and 100 percent, plus a forecasted alert at 100 percent, wired to one action group that emails the owner. This detects and notifies about once a day after the spend; it does not prevent it.
3. **Credit backstop: keep the Azure spending limit ON.** For a credit subscription the spending limit's auto-disable at the credit ceiling is the only hard stop that keeps spend from becoming a real invoice. Do not remove it unless whoever deploys this deliberately elects pay-as-you-go for a spend that must exceed the monthly credit.

**Tag scheme (CAF-aligned), applied to the resource group and the Foundry resource before the backfill runs (tags are not retroactive), with tag inheritance enabled:**

| Tag key | Example value | Purpose |
|---|---|---|
| `initiative` | `<initiative-name>` | Isolate this workload's spend from the rest of the subscription |
| `env` | `demo` | Separate demo from any future prod resource |
| `owner` | owner alias (name only) | Accountability |
| `costCenter` | value | Optional, for chargeback rollups |

Lean on the auto-applied Foundry `project` tag for per-project image cost, and accept that Azure tags cannot separate the consuming workloads on one shared resource: the pipeline ledger is the authoritative per-workload and per-model ledger, reconciled against the RG meters.

**Watch credit burn-down with a budget plus Cost Analysis, not credit alerts.** Because automated credit alerts are EA-only and the MVP credit is likely not EA, track the credit with the RG budget above, a subscription-scoped budget set to the credit amount, and a scheduled daily or weekly Cost Analysis email off a saved RG view (Group by Meter) during the burn push. Both the image (Models sold by Azure) and voice (first-party Speech) charges draw down the credit.

## Consequences

**Positive:**
- The real cap is synchronous and pre-spend, so it is the only layer that stops money before it is spent, and for voice it is exact with zero overshoot.
- The RG budget at the cap is sized to absorb a full one-shot build-out while still flagging a runaway, and RG scope gives one aggregated view of every consuming workload and every model.
- Keeping the spending limit ON means the worst case is the subscription disabling itself, not an unexpected invoice.
- Tags plus the ledger give both the initiative-level Azure rollup and the per-workload and per-model split.

**Negative:**
- The Azure budget is a rear-view notifier (evaluated about once a day, emails may lag up to 24 hours), so it cannot be relied on as the cap; only the pipeline guard and the spending limit actually stop spend.
- During the credit-burn window the pipeline guard is intentionally lifted, so the spending limit is the sole backstop then; this is acceptable because the worst realistic month lands at the cap, inside a single Enterprise-class monthly credit.
- The image guard is approximate until tokens-per-image is measured, so it is set conservatively high on purpose.
- Azure tags cannot split one consuming workload from another on the shared resource; the split lives only in the pipeline ledger.
- A preview model family means the rate card is a preview-window snapshot.

**Follow-ups:**
- Read tokens-per-image off the first metered runs and replace the conservative image assumption in the ledger with the real number before any bulk image run.
- Confirm the credit offer type and reset date in Cost Management plus Billing, so "resets soon" is treated as monthly-recurring (non-destructive to future work) rather than a one-time expiry.
- Reset the pipeline budget-guard default to the cap when the credit resets.
- Verify the image rate card live in the Foundry portal and the voice meter on the Azure Speech pricing page before authorizing any paid batch (the pricing widgets did not render during research).
- Optionally, later and as custom development, extend the action group to flip a "publish disabled" flag; never treat that automation as the cap.

## Alternatives considered

- **Rely on the Azure budget as the cap.** Rejected: budgets are notify-only, evaluated about once a day, and the money is already spent by the time an alert fires; Foundry has no hard-limit feature.
- **Remove the spending limit (convert to pay-as-you-go).** Rejected for now: the credit's auto-disable is the only hard, invoice-side backstop; pay-as-you-go is elected only if a spend must deliberately exceed the monthly credit.
- **A subscription-scoped budget as the primary control.** Rejected as primary: RG scope isolates the initiative and aggregates every consuming workload and model; a subscription-scoped budget at the credit amount is added only for credit burn-down, not as the workload cap.
- **Automated Azure credit alerts.** Rejected: they are EA-only and the MVP credit is likely not EA, so a budget plus scheduled Cost Analysis emails is the portable substitute.
- **Per-workload Azure tags to split spend.** Rejected: one shared resource has no per-request tag, so the meter aggregates every consuming workload; the pipeline ledger is the per-workload source of truth.
- **Action-group automation as the hard stop.** Rejected as the cap: it is reactive (fires after the daily evaluation) and needs custom development; acceptable only as an optional later backstop.

&lt;!-- safety-scan-worked-example:start -->
## Worked example

This methodology was first proven on this repo's initial build: a shared Azure AI Foundry (AIServices) resource hosting two Microsoft first-party models, MAI-Image-2.5 (scene art) and MAI-Voice-2 (neural narration), serving two publishing brands, Brand A and Brand B, through their reader apps. The concrete figures that instantiated the decision above:

- **Cap value: 100 US dollars per month.** SPIKE-05's rollup showed the biggest realistic single month (the full three-voice backfill across both brands at about 32 USD, plus a full image-catalog backfill on the premium model at about 17 to 68 USD) lands right at 100 USD, so the cap absorbed a one-shot build-out yet still stopped a runaway loop.
- **Pipeline guard implementation:** in `publish.mjs`, `state.maiLedger[month] = { chars, estUsd }` with `estUsd = chars * 22 / 1,000,000`, plus a `--mai-budget-usd` flag defaulting to 100. Voice was deterministic (characters known before the call); the 22 USD per 1M characters rate came from the MAI-Voice-2 model page.
- **Tag values used:** `initiative = <workload>` (the initiative's brand-neutral token), `env = demo`.
- **Per-brand split:** Azure tags could not separate Brand A from Brand B on the one shared resource, so the `maiLedger` was the authoritative per-brand and per-model ledger, reconciled against the RG meters.
- **Preview caveat:** the whole MAI family was preview, so the rate card was a preview-window snapshot.
&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/research/SPIKE-05-cost-governance.md` (cost rollup; budget-is-notify-only fact; pipeline hard stop; tag scheme; EA-only credit alerts)
- `docs/research/SPIKE-03-tenant-readiness.md` (MVP monthly credit mechanics; spending limit auto-disable; three-guard strategy)
- `ai/verification/environment-readiness.md` (budget or cost alert on the resource group before any spend)
- Plan and manage costs for Microsoft Foundry (token billing; no hard limit; action-group automation needs custom dev; Group by Meter; `project` tag; credit covers Models sold by Azure): <https://learn.microsoft.com/azure/foundry/concepts/manage-costs>
- Tutorial: create and manage budgets (RG-scope budgets; up to 5 thresholds and 5 recipients; actual versus forecast; within-the-hour notification): <https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets>
- Manage costs with automation (costs evaluated against the threshold about once per day): <https://learn.microsoft.com/azure/cost-management-billing/costs/manage-automation>
- Use cost alerts to monitor usage and spending (credit alerts are Enterprise-Agreement-only): <https://learn.microsoft.com/azure/cost-management-billing/costs/cost-mgt-alerts-monitor-usage-spending>
- Azure spending limit (auto-disable at the credit ceiling; remove to convert to pay-as-you-go): <https://learn.microsoft.com/azure/cost-management-billing/manage/spending-limit>
- What is Microsoft Cost Management (budgets notify; tags add business context; scheduled cost emails): <https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management>
- MAI-Voice-2 model page (22 USD per 1M characters): <https://microsoft.ai/models/mai-voice-2/>
