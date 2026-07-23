# Design: architecture overview

- Status: draft for review
- Date: 2026-07-11
- Author: foundry-architect (Fable)
- Grounded in: ADR-0002 (image model), ADR-0003 (voice model), ADR-0004 (topology and region), ADR-0008 (publish-pipeline integration); supporting references to ADR-0001, ADR-0005, ADR-0006, ADR-0007 where a flow crosses their territory
- Companion docs: `resource-topology-and-caf-naming.md` (names and tags), `reliability-and-operations.md` (Reliability and Operational Excellence), `performance-efficiency.md` (Performance Efficiency)

This document describes the general methodology end to end in text: how to stand up one shared Azure AI Foundry account to serve image and voice generation for one or more downstream products, and how to wire that account into a publish-time pipeline safely. The Lucid phase draws it; nothing here depends on a diagram existing first. It designs only what the ADRs decided. Where an ADR is silent, the gap is called out in the final section rather than filled in. A concrete, deployed instance of this exact methodology is restated in full at the end, in the closing "Worked example" appendix.

---

## 1. Solution in one paragraph

One shared Azure AI Foundry account of kind `AIServices` (`<prefix>-<initiative>-<env>-<region>-01`, SKU S0, single region, resource group `rg-<initiative>-<env>-<region>-01`) serves two Microsoft first-party preview models for one or more downstream consumers (in this methodology, "brands," "products," or "sites" - any distinct published output that needs generated art and narration). MAI-Image-2.5 is hosted as a Global Standard model deployment named `mai-image-25`; MAI-Voice-2 needs no deployment and is served through the same account's Azure Speech surface by SSML voice name. Nothing is synthesized at runtime: a publish-time Node pipeline running on a developer workstation pre-renders per-voice audio variants and scene art, then uploads them to per-consumer object storage (this methodology's reference implementation uses Cloudflare R2 buckets for audio and covers, and a static site origin for scene art) under immutable content-hashed keys. The downstream apps and sites consume those static assets; no Azure key ever reaches a worker or a browser. Cost is capped by a synchronous pipeline budget guard, backstopped by the Azure budget `budget-<initiative>-<env>-<region>-01` and the subscription spending limit, with secrets held by name in a reused platform Key Vault.

## 2. Component inventory

### 2.1 Azure estate (new, this initiative)

| Component | Canonical name | What it is | ADR |
| --- | --- | --- | --- |
| Resource group | `rg-<initiative>-<env>-<region>-01` | Single scope for the initiative's Azure resources, budget, and tags, one region | ADR-0004, ADR-0006 |
| Foundry account | `<prefix>-<initiative>-<env>-<region>-01` | `Microsoft.CognitiveServices/accounts`, kind `AIServices`, SKU S0, custom subdomain enabled; hosts the image deployment and serves the Speech surface | ADR-0004 |
| Model deployment | `mai-image-25` | MAI-Image-2.5 (Preview), model format Microsoft, SKU GlobalStandard, capacity 1; version re-queried at deploy time | ADR-0002, ADR-0004 |
| Foundry project | `proj-<initiative>-media-01` | Optional Foundry account project, created for the playground voice audition and the auto-applied `project` cost tag; no runtime call depends on it | ADR-0004 follow-up, ADR-0003 follow-up, ADR-0006 |
| Budget | `budget-<initiative>-<env>-<region>-01` | Cost Management monthly budget, capped USD, scoped to the resource group, notify-only backstop | ADR-0006 |

### 2.2 Azure estate (existing, reused or untouched)

| Component | Name | Role in this design | ADR |
| --- | --- | --- | --- |
| Key Vault (REUSE, do not create) | a platform Key Vault, by name only | Holds the one stored secret by name; endpoint and region entries for one-stop retrieval | ADR-0005 |
| Existing Speech account (UNTOUCHED, if one already exists), by name only | kind SpeechServices, F0, its own resource group | Keeps serving any pre-existing narration and read-along track for downstream consumers; deliberately not reused, upgraded, or migrated | ADR-0004 |
| Subscription | by name only | Home of everything above; monthly credit or budget with a spending limit ON | ADR-0001, ADR-0006 |

### 2.3 Non-Azure estate (existing, integrated)

| Component | Where | Role |
| --- | --- | --- |
| Publish pipeline | `tools/publish.mjs`, `tools/tts.mjs`, `tools/stitch.mjs`, `tools/r2-upload.mjs` in each downstream consumer's repo | Publish-time pre-render of chapter/content JSON, narrator audio, and (new) MAI listen-voice variants; runs on a developer workstation, outside Azure |
| Image tool (NEW) | consumer site repo, `tools/mai-image.mjs` | Calls the generations and edits endpoints, writes PNGs and the provenance index |
| Prompt library | a read-only prompt/resource repo | Prompt source, keyed by scene; trademarked terms genericized per ADR-0007 |
| Content storage | object storage (reference implementation: Cloudflare R2), per-consumer buckets | Immutable content-hashed audio, chapter/content JSON, covers; `manifest.json` uploaded last |
| Downstream apps | offline-first PWAs (reference implementation: Vite + Preact, Cloudflare Worker with D1 + R2) | Offline-first consumption; never synthesize, never hold a key |
| Marketing/static sites | each consumer's public site | Hosts scene art that content JSON hotlinks; covers are the only art copied into object storage |

## 3. The two model surfaces on one account

Both modalities ride the single `AIServices` account. This is the load-bearing topology decision of ADR-0004 (WAF Cost Optimization and Operational Excellence: one resource means one budget scope, one identity surface, one secret set).

### 3.1 Image: MAI-Image-2.5 via the `mai-image-25` deployment

- Endpoints on the account's custom subdomain: `https://<prefix>-<initiative>-<env>-<region>-01.services.ai.azure.com/mai/v1/images/generations` (JSON) and `.../mai/v1/images/edits` (multipart). The request `model` parameter is the deployment name `mai-image-25`, which stays stable even when the underlying Preview model version is redeployed (ADR-0002 version pinning).
- The documented parameter surface is only `model`, `prompt`, `image` (edits only), `width`, `height`. No seed, mask, negative prompt, or candidate count exists, so style matching uses exactly two arms: prompt engineering on generations, and edits as a pseudo style reference (ADR-0002). Candidate selection is a human review step.
- Canvas standardized at 1248x832 (a clean 3:2 at 1,038,336 pixels, under the 1,048,576-pixel cap). Larger legacy canvases that exceed the cap are not reproducible (ADR-0002).
- Auth is Microsoft Entra ID, keyless: `DefaultAzureCredential` with scope `https://cognitiveservices.azure.com/.default`, resolving to the `az login` user on a workstation (ADR-0005). WAF Security: zero stored secret on the image path.

### 3.2 Voice: MAI-Voice-2 via the Speech surface, no deployment

- There is no deployment step and no Foundry-project dependency. A voice is selected per call by the SSML `<voice name>` attribute against the Speech synthesis endpoint; the key path uses the regional endpoint `https://<region>.tts.speech.microsoft.com/cognitiveservices/v1` (ADR-0003, ADR-0004).
- Owner-locked voice set, identical across downstream consumers, listen-only in v1: a small fixed set of named voices, one rendered with an `excited` style via an `mstts:express-as` wrapper (the one real `tts.mjs` change). Read-along stays on each consumer's existing narrator because WordBoundary support for MAI-Voice-2 is unconfirmed (ADR-0003). WAF Reliability: the word-sync highlight never leaves the proven track.
- Narrators stay where they are, each served by any existing pre-existing Speech account. The new account serves only MAI listen variants and image calls, so the pipeline carries a deliberate two-resource key split: one credential pair for the narrator (old resource) and one for the variants (new resource) (ADR-0004, ADR-0008).
- Speech auth on the new account is key-based for now, with the key sourced from the platform Key Vault and injected via gitignored `.dev.vars`; the custom subdomain is kept enabled so a later Entra-for-Speech move stays cheap (ADR-0005).

## 4. End-to-end flows

### Flow A: voice variant publish (per consumer, per content unit)

1. An operator runs `node tools/publish.mjs --brand <consumer> --voices <all|slug[,slug]>` in the consumer's repo (default `none`, so today's behavior is unchanged).
2. The pipeline parses source content into speakable blocks, then, for each requested listen voice, checks the voice-aware `variantHash` (content plus voice id plus style) against `tools/.state/<consumer>.json`. Unchanged variants are skipped; only missing or stale variants render (WAF Cost Optimization and Performance Efficiency).
3. Before any metered call, a ledger guard runs: `state.maiLedger[month] = { chars, estUsd }` with `estUsd = chars x rate / 1,000,000`; the run aborts if a configured monthly budget cap would be exceeded. This is the synchronous, pre-spend cap (ADR-0006). WAF Cost Optimization.
4. `tts.mjs` synthesizes block by block against the new account, wrapping the expressive voice's blocks in `mstts:express-as style="excited"`. Blocks respect the 10-minute-per-request audio cap and the 64 KB SSML limit; `stitch.mjs` joins block MP3s with ffmpeg on the publish machine (ADR-0008).
5. `r2-upload.mjs` uploads each variant to an immutable content-hashed key with a one-year immutable cache profile, retrying with backoff.
6. The manifest gains an additive, optional `audioVariants` array per content unit (schemaVersion stays stable; old clients ignore it) and is uploaded last with a short cache profile, so downstream apps never see a manifest that points at missing objects (ADR-0008). WAF Reliability.
7. Variants carry empty word arrays; the narrator's `audio` and `timings` fields are untouched, so read-along keeps working everywhere.

### Flow B: image generation (one consumer pilots first, per ADR-0002 pilot scope)

1. An operator runs `node tools/mai-image.mjs` in the piloting consumer's site repo with a scene id, an arm (`--gen` or `--edit <sourcePng>`), and the default 1248x832 canvas.
2. The tool reads the scene's prompt from the prompt library, keeps whatever house illustration framing that consumer uses, and genericizes trademarked terms (ADR-0007, ADR-0008).
3. It acquires an Entra bearer token via `DefaultAzureCredential` and calls generations or edits with `model: "mai-image-25"`, pacing to the tier rate limit (10 requests per minute, Tier 5) and retrying 429s with backoff.
4. The first calls double as the cost probe: the tool reads any token usage off the live response (tokens-per-image is unpublished) before any batch is authorized (ADR-0002).
5. The returned PNG is written to the consumer's image directory (or covers directory), and a record is appended to a committed provenance index (generator, modelVersion, endpoint, promptHash, promptRef, width, height, sourceImage, createdAt, tool; seed recorded as none because the API has no seed) (ADR-0007, ADR-0008).
6. Publication is asymmetric by design: scene art is hotlinked from the marketing origin inside content JSON, so a site deploy makes regenerated scenes live in the downstream app with no republish; covers are content-hashed into object storage, so a changed cover re-uploads on the next `publish` run (ADR-0008).

### Flow C: downstream consumption (runtime, no Azure dependency)

1. A downstream app fetches `manifest.json` (short cache) from its consumer's object storage bucket, then content JSON and audio by immutable hashed URL.
2. In listen mode the app plays the selected variant track; whenever read-along is active it always loads the narrator's `audio` plus `timings`, keeping the highlight on the proven WordBoundary track (ADR-0003).
3. Scene art loads from the marketing origin; covers load from object storage. Offline-first downloads fetch the selected variant. No call in this flow touches Azure, so a preview-model outage never reaches a downstream user (ADR-0003, ADR-0008). WAF Reliability.
4. Downstream apps show a user-facing disclosure that illustrations and some narration are AI-generated, where the content is aimed at a sensitive audience (ADR-0007).

### Flow D: cost and governance (continuous)

1. The pipeline ledger is the authoritative per-consumer and per-model record and the only synchronous cap (Flow A step 3).
2. `budget-<initiative>-<env>-<region>-01` (resource-group scope, capped USD monthly, actual thresholds at 50, 75, 90, 100 percent plus a forecasted alert at 100 percent) notifies the owner through one action group; it detects after the spend, roughly daily (ADR-0006).
3. The subscription spending limit stays ON as the invoice-side hard stop for a credit subscription, where one applies; tags (`initiative=<initiative>`, `env=<env>`, `owner`, `costCenter`) are applied before any backfill so Cost Analysis can isolate the initiative; the per-consumer split lives only in the ledger (ADR-0006). WAF Cost Optimization and Operational Excellence.

## 5. Trust boundaries and secret posture

- Boundary 1, developer workstation to Azure: Entra user token for image (no stored secret); vault-sourced key for Speech (named secret in the platform Key Vault, injected via gitignored `.dev.vars`). Names only in git, values only in the vault or the CI secret store (ADR-0005). WAF Security.
- Boundary 2, pipeline to object storage: provider credentials for uploads, already established by the existing pipeline; out of Azure scope.
- Boundary 3, runtime: none. Workers and browsers hold no Azure credentials and make no Azure calls (ADR-0008). WAF Security and Reliability.
- Least-privilege roles on the account scope: pipeline identity holds Cognitive Services User (image data plane) plus Cognitive Services Speech User (TTS data plane); Cognitive Services Contributor is held by a human for the one-time deployment only (ADR-0005).
- Network posture: public network access stays enabled because the pipeline runs outside Azure; an optional service-level IP allowlist is the only proportionate hardening (ADR-0005 follow-up record).

## 6. WAF pillar map (why each major choice is shaped this way)

| Choice | Pillar | Rationale |
| --- | --- | --- |
| One shared `AIServices` account for both modalities and every downstream consumer | Cost Optimization, Operational Excellence | One budget scope, one role surface, one secret set (ADR-0004) |
| Publish-time pre-render, never runtime synthesis | Reliability, Cost Optimization, Performance Efficiency | Preview outages never reach users; spend is bounded per publish run; downstream apps get CDN-cached static assets (ADR-0008) |
| Narrator stays on the existing Speech account; MAI variants on the new account | Reliability | Blast-radius isolation: the proven read-along track has no dependency on the preview stack (ADR-0004) |
| Listen-only MAI voices in v1 | Reliability | WordBoundary is unconfirmed for MAI-Voice-2; the highlight never gambles on it (ADR-0003) |
| Version re-query at deploy, periodic re-check, deployment name without version | Operational Excellence | Preview version churn is absorbed without caller changes (ADR-0002) |
| Entra keyless for image, vault-sourced key for Speech | Security | Zero stored secret where cheap; the one stored secret is vault-held, gitignored, rotatable (ADR-0005) |
| Ledger guard as the real cap, budget as backstop, spending limit ON | Cost Optimization | The only pre-spend stop is client-side; Azure budgets are notify-only and daily (ADR-0006) |
| Immutable content-hashed keys, manifest last | Reliability, Performance Efficiency | Idempotent re-runs, resumable backfill, no dangling references, one-year edge cache (ADR-0008) |
| Default guardrails, genericized trademarks, house illustration framing, provenance index, user disclosure | Security (responsible AI), Operational Excellence | Low-friction posture fit for sensitive-audience content; auditability closes the unknown-generator gap (ADR-0007) |

## 7. Explicit non-goals (decided against in the ADRs)

- No on-demand or worker-proxied synthesis (long-form content exceeds the 10-minute cap; Workers cannot run ffmpeg; keys would become runtime secrets) (ADR-0008).
- No reuse or upgrade of an existing pre-Foundry Speech account, and no second region or split resource (ADR-0004).
- No MAI-Image-2 or MAI-Image-2e deployments (both retire on a fixed date; neither has the edits endpoint) (ADR-0002).
- No private endpoints or disabled public network access (the pipeline runs outside Azure) (ADR-0005 record).
- No batch or Long Audio TTS path (it stores script and audio; the real-time path stores nothing) (ADR-0007).
- No bulk generation inside this plan: infrastructure is deployed and verified ready to generate, then holds for the owner (MASTER-PLAN scope).

## 8. Build order dependencies

1. Any drifted `publish.mjs` copies across downstream consumer repos are reconciled first, in a standalone commit per repo. This blocks all MAI pipeline work (ADR-0008).
2. Azure resources are created in dependency order (group, tags, account, deployment, roles, budget) with the budget in place before any spend; every resource-creating call is owner-gated (ADR-0006, MASTER-PLAN guardrail). The exact sequence belongs to the implementation guide.
3. A short voice spike runs against the new account before variant code lands: WordBoundary behavior, output format acceptance, the exact voice identifiers, and the expressive style token (ADR-0003, ADR-0004 follow-ups).

## 9. ADR gaps surfaced by this design

- Environment token: ADR-0004's illustrative naming shape and ADR-0006's tag table used a placeholder environment token as an example. The canonical set fixed in this design phase standardizes on a concrete environment token (for example `prod`) once a real deployment is scoped, because the account produces production-serving assets. ADR-0004 explicitly deferred final strings to the design phase, so this is a finalization, not a new decision.
- Foundry project: ADR-0004 left creating the optional project open. This design creates `proj-<initiative>-media-01` for the playground audition (the ADR-0003 voice-token confirmations) and the auto-applied `project` cost tag (ADR-0006). No API flow depends on it.
- Runtime telemetry: no ADR decides diagnostic settings, a Log Analytics workspace, or Azure Monitor metric alerts (for example 429 rates) on the account. The decided monitoring is cost-only plus pipeline logs. Recorded as a gap in `reliability-and-operations.md`, not filled in here.
- CI identity: ADR-0005 defers the exact OIDC workload-identity federation setup and role-assignment scripts to the design phase's identity-and-security doc, which is outside this four-document batch. The roles themselves are decided and summarized in section 5.

## Sources

- `docs/adr/ADR-0001-target-tenant.md` through `docs/adr/ADR-0008-publish-pipeline-integration.md` (all decisions restated here)
- `docs/research/SPIKE-06-pipeline-integration.md` (as-is pipeline mechanics, object storage key layout, hotlink behavior)
- `docs/research/SPIKE-02-voice-model.md` (voice access pattern, SSML and endpoint shapes)
- `ai/verification/environment-readiness.md` (subscription, region, quota facts)
- `ai/MASTER-PLAN.md` (scope boundary: deploy and verify, then hold)

---

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Gunner the Lab / Holdfast Press

This methodology is deployed and running in production today for two publishing brands, Gunner the Lab and Holdfast Press, proving the pattern above holds up outside the abstract.

**Azure estate (new):**

- Resource group: `rg-studioai-prod-eus-01` (East US)
- Foundry account: `aif-studioai-prod-eus-01`, kind `AIServices`, SKU S0
- Model deployment: `mai-image-25` (MAI-Image-2.5, Preview, GlobalStandard, capacity 1; re-queried 2026-06-02)
- Foundry project: `proj-studioai-media-01`
- Budget: `budget-studioai-prod-eus-01`, 100 USD monthly, resource-group scope

**Azure estate (existing, reused or untouched):**

- Key Vault: `kv-hcs-vault-01` (reused, holds `studio-foundry-speech-key`)
- Existing Speech account: `storyreader-tts` (kind SpeechServices, F0, resource group `rg-storyreader`), untouched, keeps serving both brands' narrator and read-along track
- Subscription: This Is My Demo - MVP Subscription (This Is My Demo tenant), spending limit ON

**Endpoints:**

- Image: `https://aif-studioai-prod-eus-01.services.ai.azure.com/mai/v1/images/generations` and `.../mai/v1/images/edits`
- Voice: `https://eastus.tts.speech.microsoft.com/cognitiveservices/v1`

**Voice set (owner-locked, listen-only in v1, identical for both brands):** Harper (en-US), Lisa (en-AU, exact identifier confirmed at spike time), Ethan (en-US, rendered with the `excited` style via `mstts:express-as`).

**Narrators (unchanged, on `storyreader-tts`):** Gunner uses `en-US-AndrewMultilingualNeural`; Holdfast uses `en-GB-Ryan:DragonHDLatestNeural`. The pipeline carries a deliberate two-resource key split: `AZURE_SPEECH_*` (narrator, old resource) and `MAI_SPEECH_*` (variants, new resource).

**Non-Azure estate:**

- Publish pipeline: `tools/publish.mjs`, `tools/tts.mjs`, `tools/stitch.mjs`, `tools/r2-upload.mjs` in `storyreader-holdfast` and `storyreader-gunner`
- Image tool: `gunnerthelab.github.io/tools/mai-image.mjs`
- Prompt library: `gunner-studio/resources` (`Illustration_Prompts_All_Stories.md`, `Branding_Illustration_Prompts.md`, `Character_Bible.md`)
- Content storage: Cloudflare R2, per-brand buckets `storyreader-<brand>-content`
- Reader apps: StoryReader PWAs at app.gunnerthelab.com and app.holdfastpress.com
- Marketing sites: gunnerthelab.com (hosts scene art hotlinked by chapter JSON) and the Holdfast Press site

**Pilot scope:** Image generation (Flow B) pilots on Gunner the Lab first, per ADR-0002.

**Secrets:** the one stored secret, `studio-foundry-speech-key`, lives in `kv-hcs-vault-01` and is injected as `MAI_SPEECH_KEY` via gitignored `.dev.vars`. No value appears in this repo.

**Tags applied:** `initiative=studio-foundry`, `env=prod`, plus `owner` and `costCenter`.

&lt;!-- safety-scan-worked-example:end -->
