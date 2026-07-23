# ai/ - the Azure AI Foundry initiative

This folder holds everything for standing up an Azure AI Foundry build in this repo. The first proven build is a media backbone (MAI-Image-2.5 for scene art, MAI-Voice-2 for narration) serving two publishing brands, kept as a worked example throughout this folder's docs, not the primary framing.

## Read in this order

1. [`MASTER-PLAN.md`](MASTER-PLAN.md) - the plan for the whole initiative.
2. [`TASKS.md`](TASKS.md) - the live task board (source of truth).
3. [`plans/source/`](plans/source/) - the two original plan docs, moved out of the public site repo.

## Folders

| Folder | What it holds | Produced by |
|---|---|---|
| `plans/source/` | The original MAI-Image and MAI-Voice plans | (moved in) |
| `research/` | Research spikes that resolve the open unknowns | foundry-researcher (Opus) |
| `adr/` | Architecture Decision Records | foundry-researcher (Opus) |
| `design/` | Architecture and design docs (WAF + CAF) | foundry-architect (Sonnet) |
| `diagrams/` | Lucid diagram PNG exports and share-link index | foundry-diagrammer (Sonnet) + foundry-diagram-qa (Sonnet) |
| `implementation/` | Implementation guide and as-built | foundry-implementer (Fable) |
| `verification/` | Environment readiness and deployment verification | foundry-env-verifier (Sonnet) |

## The chain

Research spikes ground the ADRs. ADRs decide what the design docs build. Design docs drive the diagrams and the implementation guide. The environment check picks the tenant. Deployment follows the guide, gated on every Azure write. Verification proves it is ready. Then the owner takes over for generation.
