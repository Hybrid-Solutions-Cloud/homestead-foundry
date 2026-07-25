# Roadmap

This page is the public roadmap snapshot: where the project stands at a glance. Detailed phase-by-phase planning, Definitions of Done, and agent assignments are maintained in the project's private planning workspace and are not published here. The original nine-phase deployment history is recorded publicly in `ai/TASKS.md`.

## Status at a glance

| Phase | What it covers | Status |
|---|---|---|
| A | Repo hardening (safety scan, LICENSE, CODEOWNERS, PR/issue templates) | Done |
| B | Brand-neutral rewrite of every `ai/` doc | Done |
| C | General model registry (schema + example) | Done |
| D | Parameterized Bicep deployment | Done, deployed |
| E | Speech-model research (word-sync and lip-sync gap) | Done |
| F | Versioning, changelog, hardening, public release | Done |
| G | This docs site | Done, live |
| H | Foundry Local and Azure Local model-support research | Done |
| I | Extended research-spike backlog (newer models, region survey, avatar research) | Done |

All nine phases are complete. The repository is public, the documentation site is live, and the Azure environment described in `docs/implementation/as-built.md` was deployed from the Bicep in `infra/`.

## What is live

- **Infrastructure as code.** `infra/main.bicep` deploys the full environment at subscription scope: resource group, Foundry account, registry-driven model deployments, an optional project, RBAC via Entra security groups, a resource-group budget with alert thresholds, and Key Vault secret references. A single `location` parameter threads through every module, and CAF naming is enforced by per-segment parameter constraints.
- **A registry-driven model roster.** Every model deployment is generated from the model registry rather than hand-written, so adding or removing a model is a registry edit and a redeploy. See [the model registry guide](guide/model-registry.md).
- **The research and decision record.** Seventeen research spikes in `docs/research/` and twelve ADRs in `docs/adr/` covering model selection, topology, identity, cost governance, content safety, pipeline integration, multi-target deployment automation, and agent tool governance.
- **The agent roster.** Eight specialist agents in `AGENTS.md` that carry out the research, design, diagramming, review, deployment, and verification work under the same process.

## What is next

Ongoing rather than phased. Current threads:

- **Track 2, Foundry Local on a single Windows Server.** [ADR-0011](adr/ADR-0011-multi-target-deployment-automation.md) decided the automation form (Azure Arc run command over an Arc-enabled server, with Arc SSH as the fallback) but authorized no build. It is gated on the two unknowns [SPIKE-08](research/SPIKE-08-foundry-local-on-device.md) left open: whether Foundry Local is supported on Windows Server, and whether CPU-only throughput on a GPU-less host is tolerable. A research spike resolves those and an ADR records the outcome before any automation is written.
- **Track 3, Foundry Local at cluster scale on Azure Local.** [ADR-0011](adr/ADR-0011-multi-target-deployment-automation.md) decided the form (declarative Bicep for the Azure-projected resource group, AKS Arc cluster, and `Microsoft.Foundry` extension, with the in-cluster model deployments applied through Kubernetes-native tooling) but authorized no build. It inherits the three preconditions in [ADR-0009](adr/ADR-0009-azure-local-reviewer-track.md) unchanged, and where the ARM to Kubernetes seam sits is still an open decision.
- Carrying the expansion research (reviewer models, video, avatar, extended text-to-speech) forward from spikes into adoption decisions where it earns its place.
- Agent tool governance, gated to a future agent phase per [ADR-0012](adr/ADR-0012-agent-mcp-gateway-governance.md).

This table is a snapshot, refreshed as milestones land. It may lag the project's live internal planning between refreshes.
