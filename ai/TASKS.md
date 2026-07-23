# Task Board: Azure AI Foundry Studio

**This file is now historical.** It records the original Phase 0-9 deployment
(MAI-Image-2.5 + MAI-Voice-2) and is kept as-is for that record. Live status
going forward - including everything deployed or planned after Phase 9 (FLUX
models, reviewer LLMs, Sora, and the platform-pivot work) - lives in
the project roadmap and the model roster.
The claude.ai Artifact board mirrors this file's original scope only.

**Status key:** ⬜ not started · 🔄 in progress · ✅ done · 💬 needs a decision · 🔴 blocked

**Model rule:** Opus for spikes/ADRs/diagram authoring · Fable for design/implementation · Sonnet for QA/review/env/verify/ops.

---

## Phase 0 - Scaffold  ✅

- ✅ Create `studio-foundry` private repo in the thisismydemo org
- ✅ Clone to `d:\git\thisismydemo\studio-foundry`
- ✅ Add the folder to the VS Code workspace
- ✅ Move the two source plans out of the public repo into `ai/plans/source/`
- ✅ Scaffold `.claude/` (8 foundry agents, settings.json, .mcp.json) and repo meta (README, CLAUDE, AGENTS, .gitignore)
- ✅ Scaffold the `ai/` tree (README, MASTER-PLAN, TASKS, subfolder indexes)
- ✅ Build the claude.ai Artifact task board (see `ai/board/README.md`)
- ✅ Commit and push Phase 0

## Phase 1 - Environment check  ✅  (foundry-env-verifier, Sonnet)

- ✅ Enumerate subscriptions in the candidate tenants (credit sub, azlmgmt)
- ✅ Verify Azure AI Foundry + MAI-Image-2.5 + MAI-Voice-2 availability, region, quota
- ✅ Recommend primary and fallback, with a go or no-go
- ✅ Write `ai/verification/environment-readiness.md`

**Decision (GO):** primary = This Is My Demo - MVP Subscription, region East US (MAI-Image-2.5 confirmed live in the catalog, Tier 5 quota, AIServices S0 offerable). Fallback = azlz-cmp-lz-core-001 (azurelocal.cloud, 2 RPM). A new AIServices/S0 resource is needed; the existing legacy narrator Speech account is SpeechServices F0 and cannot host the deployments.

## Phase 2 - Research spikes  ✅  (foundry-researcher, Opus) - all committed + pushed (c0af45c)

- ✅ SPIKE-01 image model (MAI-Image-2.5 v2026-06-02 current; API is prompt + edits only; canvas 1248x832; tokens-per-image still UNKNOWN)
- ✅ SPIKE-02 voice model (Harper/Lisa/Ethan confirmed with excited style; WordBoundary UNCONFIRMED so listen-only in v1; use S0)
- ✅ SPIKE-03 tenant and subscription readiness (GO on MVP; credit is fixed monthly, keep the Azure spending limit ON as the hard backstop)
- ✅ SPIKE-04 identity, secrets, security, responsible AI (keyless Entra for image, KV key for Speech; least-privilege roles)
- ✅ SPIKE-05 cost model and governance (a few USD/month steady; a budget alert is NOT a hard cap; the pipeline ledger enforces)
- ✅ SPIKE-06 publish-pipeline integration (reconcile the drifted publish.mjs copies FIRST; new mai-image.mjs; additive audioVariants)

## Phase 3 - ADRs  ✅  (foundry-researcher, Opus)

- ✅ ADR-0001 target tenant and subscription (MVP sub, East US; fallback gated on 3 checks)
- ✅ ADR-0002 image model and access pattern (MAI-Image-2.5 GlobalStandard; prompt + edits; 1248x832)
- ✅ ADR-0003 voice model and voice set (MAI-Voice-2 S0; Harper/Lisa/Ethan listen-only v1)
- ✅ ADR-0004 Foundry topology and region (one shared AIServices S0, East US)
- ✅ ADR-0005 identity and secrets (keyless Entra for image, KV key for Speech; least-privilege)
- ✅ ADR-0006 cost governance (RG budget alert-only; pipeline ledger is the hard stop)
- ✅ ADR-0007 content safety and responsible AI (default guardrails; genericize trademarks; disclose)
- ✅ ADR-0008 publish-pipeline integration (reconcile publish.mjs first; additive variants; new mai-image.mjs)

## Phase 4 - Architecture and design docs  ✅  (foundry-architect, Fable)

- ✅ architecture-overview
- ✅ resource-topology-and-caf-naming
- ✅ identity-and-security (WAF Security)
- ✅ cost-and-governance (WAF Cost)
- ✅ reliability-and-operations (WAF Reliability + OpEx)
- ✅ performance-efficiency (WAF Performance)
- ✅ pipeline-integration-design

**For Phase 7 review:** decide CAF abbreviation `ais` vs `aif` for the AIServices resource · reconcile catalog size (SPIKE-01 ~680 vs cost-band 340 image calls) · fold the extra `r2-upload.mjs` drift into the publish.mjs reconciliation · owner-input at HOLD: owner + costCenter tag values, MVP credit amount, Speech-key rotation cadence, Lisa en-AU voice id + exact excited token.

## Phase 5 - Lucid diagrams  ✅  (foundry-diagrammer Opus + foundry-diagram-qa Sonnet)

- ✅ Confirmed the Lucid "Microsoft AI Foundry" folder (id 445735630)
- ✅ Authored 11 diagrams (context, topology, identity, image sequence, voice sequence, pipeline, cost, content-safety, tenant-fallback flowchart, deployment flowchart, data/state ERD)
- ✅ Independent Sonnet layout QA: 11/11 PASS (added missing titles, labeled 25 connectors, re-anchored overlaps)
- ✅ Share-link index in `docs/design/diagrams.md` + `ai/diagrams/QA-REPORT.md`

**Manual (owner) in Lucid UI:** diagrams 4 and 5 (sequence) have a cosmetic title typo (double space; #4 a double slash) that the MCP cannot edit - retype in the Lucid editor. Also 4 superseded drafts renamed "ZZ SUPERSEDED" moved to My Documents root; trash them if desired.

## Phase 6 - Implementation guide  ✅  (foundry-implementer, Fable)

- ✅ Wrote `docs/implementation/implementation-guide.md` (12 sections, 11 gated writes, rollback, fallback)

## Phase 7 - Review and fact-check  ✅  (foundry-reviewer, Sonnet)

- ✅ Reviewed the whole `ai/` set: APPROVED for deploy, no blockers, facts verified vs Microsoft Learn, zero em-dashes, zero secrets (`ai/REVIEW.md`)

## Phase 8 - Deploy (gated)  ✅  (orchestrator, gated) - DEPLOYED 2026-07-11 (see docs/implementation/as-built.md)

**OWNER AUTHORIZATION (2026-07-11, live session):** The repo owner explicitly approved Phase 8 and made these decisions. This gate is now OPEN.

1. **Resource name follows CAF** = `aif-studioai-prod-eus-01` (the current Learn abbreviation for the AIServices/Foundry kind), not `ais-`. Owner directive: "if not [deployed] then follow caf like I told you to."
2. **Tags:** add `project=studio-foundry`; full set = initiative=studio-foundry, env=prod, owner="<owner alias>", project=studio-foundry.
3. **RBAC via Entra security groups (AMENDS ADR-0005):** create `sg-studioai-image-users-prod-eus-01` (role Cognitive Services User) and `sg-studioai-speech-users-prod-eus-01` (role Cognitive Services Speech User) on the account scope, owner as a member. Same least-privilege data-plane roles ADR-0005 decided, assigned to groups instead of directly for maintainability. Owner directive: "create security groups. naming needs to match caf/waf and describe what it is for."
4. **Budget stays 100 USD/month** (the MVP credit is about 1000/month, but this project is capped at 100 for round one).
5. **Network:** public access + Entra + RBAC.

- ✅ Create resource group (`rg-studioai-prod-eus-01`)
- ✅ Create the AI Services / Foundry resource (`aif-studioai-prod-eus-01`)
- ✅ Create the model deployment(s) (`mai-image-25`)
- ✅ Assign identity and least-privilege role (two security groups)
- ✅ Store secrets in the tenant Key Vault (names only in repo) (`studio-foundry-speech-key`)
- ✅ Set the budget alert and cap (100 US dollars per month)
- ✅ Write `docs/implementation/as-built.md`

**Correction (2026-07-21):** these sub-items were left unchecked despite the
work being fully done and documented in `docs/implementation/as-built.md` since
2026-07-11. Flipped to ✅ to match reality; see the project roadmap for how this
was found and why the checkboxes drifted from the actual state.

## Phase 9 - Deployment verification  ✅  (foundry-env-verifier, Sonnet)

- ✅ Confirm resource and deployment health and auth
- ✅ Smoke test: one tiny image generation and one short TTS synthesis (well under 1 USD)
- ✅ Write `ai/verification/deployment-verification.md`
- ✅ HOLD for owner double-check (no bulk generation)

**Correction (2026-07-21):** same as Phase 8 above - `ai/verification/deployment-verification.md`
already recorded all checks PASS (including two real smoke calls) since
2026-07-11; the header and sub-items were never flipped from ⬜. Corrected to
match reality.

---

**This board stops at Phase 9.** Everything after this point - the live FLUX
image models, planned reviewer LLMs, Sora, and the platform-pivot work - is
tracked in the project roadmap and
the model roster, not appended here.
