# Master Plan: Azure AI Foundry Build Methodology

**Status:** active. **Owner:** the repository owner. **Repo:** this repository (private until the genericization checklist in `REPO_INTENT.md` is complete).

## Goal

Stand up one shared **Azure AI Foundry (AIServices)** resource that hosts one or more Microsoft first-party or partner models, and wire them into a consuming `<initiative>`'s publish pipeline for one or more `<brand>` products.

Each model the initiative adopts (for example, image generation or voice/narration) is tracked as its own workstream, sourced from a research spike that is already researched and cited before any deployment decision is made.

The end state for this plan is **infrastructure deployed and verified ready to generate**. Bulk generation (image, audio, video, or any other media type) is a separate, owner-driven step that follows.

## The workstreams

Every workstream originates from a research spike under `ai/research/`, already grounded and cited.

| Workstream | Model type | Access pattern | Status coming in |
|---|---|---|---|
| Image generation | An image-generation model from the model registry (preview or GA) | Azure AI Foundry deployment; generations and edits endpoints | Set by the research spike and the ADR that follows it |
| Voice/narration | A voice/narration model from the model registry (preview or GA) | Azure Speech in Foundry Tools; SSML voice name, regional endpoint | Set by the research spike and the ADR that follows it |

All workstreams converge on **one Foundry resource in a single Azure region**, secrets in the tenant platform Key Vault, and **publish-time pre-render** to the initiative's storage layer (never runtime synthesis).

## Decisions locked

1. **Home:** this repository, kept private until the `REPO_INTENT.md` genericization checklist is complete and the owner has reviewed the scrub.
2. **Primary tenant and subscription:** decided by an environment check for each build. A preferred subscription is tried first, with a documented fallback; if neither is viable, the build hard-stops rather than guessing.
3. **Scope of this plan:** go through deployment and verification, then hold. Bulk generation is not part of this plan.
4. **Model-specific decisions** (voice or style defaults, budget caps, and similar owner choices) are recorded per build in that build's own ADRs, not in this master plan. See the worked example below for the real, locked decisions behind the first build this methodology produced.

## Guardrails (non-negotiable)

- **No API agents.** Every agent runs under the Claude Code harness. No direct model API, no `ANTHROPIC_API_KEY`.
- **No em-dashes** in any committed prose. Reviewer greps before every commit.
- **Cost over speed.** Parallelize only independent work (spikes, diagrams). Pipeline the dependent phases. Escalate model tiers only if limits are near.
- **No secrets in files.** Tenants, subscriptions, keys, vaults by name only. Real secrets go to the tenant Key Vault.
- **WAF 5 pillars + CAF naming** for all Azure design.
- **Azure writes gate.** Every resource-creating `az` call is confirmed. Bulk generation held for the owner.

## Target architecture (high level)

One resource group holds one Azure AI Foundry (AIServices) resource in a single Azure region. It carries the model deployment(s) for the workstreams a given build adopts. Managed identity and least-privilege roles are preferred over keys; any key lives in the tenant Key Vault. The consuming initiative's publish pipeline calls the deployed endpoints at publish time, pre-renders per-variant media (audio, images, or other formats), and uploads the results to the initiative's storage layer. A monthly budget with an alert enforces a cost cap. The precise names, regions, and roles are set by the design docs and recorded in that build's as-built record.

## Delivery pipeline

Each phase ends with a commit and a board update. The reviewer signs off on each phase before it is called done.

| Phase | What | Lead agent | Model |
|---|---|---|---|
| 0 | Scaffold: repo, agents, `ai/` tree, boards, move source plans | (orchestrator) + foundry-ops | Sonnet |
| 1 | Environment check: pick the viable tenant and subscription | foundry-env-verifier | Sonnet |
| 2 | Research spikes: resolve the open unknowns for each workstream | foundry-researcher | Opus |
| 3 | ADRs: decisions grounded in the spikes | foundry-researcher | Opus |
| 4 | Architecture and design docs: WAF + CAF | foundry-architect | Sonnet |
| 5 | Lucid diagrams: author and layout-QA | foundry-diagrammer + foundry-diagram-qa | Opus + Sonnet |
| 6 | Implementation guide | foundry-implementer | Fable |
| 7 | Review and fact-check the whole set | foundry-reviewer | Sonnet |
| 8 | Deploy (gated per Azure write) and document as-built | foundry-implementer | Fable |
| 9 | Deployment verification and a tiny smoke test | foundry-env-verifier | Sonnet |

**Dependency chain:** spikes ground the ADRs; ADRs decide the design; design drives diagrams and the implementation guide; the environment check picks the tenant; deployment follows the guide; verification proves readiness.

## Agent roster and model matrix

- **Opus:** research spikes, ADRs, Lucid diagram authoring.
- **Fable:** implementation guide, deployment execution.
- **Sonnet:** architecture and design docs, diagram layout QA, review and fact-check, environment check, deployment verification, commit and push.

Full roster in [`../AGENTS.md`](../AGENTS.md).

## Task board

[`TASKS.md`](TASKS.md) is the source of truth. A companion visual board mirrors it at-a-glance.

## Definition of done for this plan

- Every doc passes the reviewer (consistency, WAF/CAF, em-dash grep, no secrets).
- Every diagram passes layout QA (no overlaps, legible, labeled).
- The environment check produces a clear go with a chosen subscription and region.
- The smoke test returns real generated output (for example, an image and a synthesized audio clip) from the deployed endpoints, with auth confirmed.
- The as-built and the board reflect final state.

## Handoff

When the board shows infrastructure deployed and verified, the plan holds. The owner reviews everything, then begins generation as separate, budgeted work.

<!-- safety-scan-worked-example:start -->
## Worked example: Gunner the Lab / Holdfast Press

This methodology is deployed and verified in production today. The first real build served two consumer brands, **Gunner the Lab** and **Holdfast Press**, sharing one Azure AI Foundry resource and a common StoryReader publish pipeline.

- **Model workstreams:**
  - **G11 image** - MAI-Image-2.5 (preview), Azure AI Foundry deployment, Global Standard; generations and edits endpoints. Gunner the Lab first, both brands later.
  - **A2 voice** - MAI-Voice-2 (preview), Azure Speech in Foundry Tools; SSML voice name, regional endpoint. Both brands from the start.
- **Architecture:** one Foundry resource in East US, one resource group, secrets in the tenant platform Key Vault, publish-time pre-render (`tools/tts.mjs`, `tools/stitch.mjs`, `tools/publish.mjs`) to each brand's Cloudflare R2 bucket, never runtime synthesis.
- **Locked owner decisions:** spend approved; each brand keeps its current narrator as the default; added listen-only voices are Harper (en-US), Lisa (en-AU), and Ethan (en-US, excited style); Holdfast Press keeps its British narrator as default; preview risk accepted; budget cap of 100 US dollars per month.
- **Status:** infrastructure deployed and verified ready to generate. Bulk image and audio generation is held for the owner as a separate, budgeted step that follows this plan.

See `pmo/DECISIONS.md` for the full decision history behind this build, and `pmo/plans/source/` for the two original source plans this build's workstreams were drawn from.
<!-- safety-scan-worked-example:end -->
