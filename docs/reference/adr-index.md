# ADR index

Every Architecture Decision Record this project has locked, in decision order. Each links to its source file in the repository (`ai/adr/`); those links resolve once the repository is public (see the [roadmap](../roadmap) for the public-flip status - this repository is still private as of this page's last publish).

| ADR | Decision |
|---|---|
| [ADR-0001](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0001-target-tenant.md) | Target tenant and subscription selection methodology, with a read-only fallback check if the primary candidate is not viable. |
| [ADR-0002](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0002-image-model-and-access.md) | Image model selection and access pattern for Azure AI Foundry builds. |
| [ADR-0003](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0003-voice-model-and-voice-set.md) | Voice model and voice-set selection, including the listen-only versus read-along tradeoff. |
| [ADR-0004](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0004-foundry-topology-and-region.md) | Foundry account topology (one shared account for every modality) and region selection. |
| [ADR-0005](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0005-identity-and-secrets.md) | Identity and secrets: keyless Entra ID where possible, vault-sourced keys by name only where not. |
| [ADR-0006](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0006-cost-governance.md) | Cost governance: the three-layer enforcement model (pipeline ledger, Azure budget, subscription spending limit). |
| [ADR-0007](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0007-content-safety-and-responsible-ai.md) | Content safety and responsible AI posture for generated images and narration. |
| [ADR-0008](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0008-publish-pipeline-integration.md) | Integration pattern between a Foundry build and an external publish-time asset pipeline. |
| [ADR-0009](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/ai/adr/ADR-0009-azure-local-reviewer-track.md) | A narrowly scoped, gated on-premises (Azure Local) open-weight reviewer track, parallel to (not replacing) the cloud reviewer pair. Proposed, not yet deployed. |

## Research spikes behind these decisions

Every ADR above traces back to one or more research spikes in `ai/research/` (`SPIKE-01` through `SPIKE-16` as of this page's last publish), each grounding its findings in a first-party Microsoft Learn source or a named vendor's own documentation. See the [methodology](../guide/methodology) page for how spikes and ADRs relate, and the `ai/research/` spikes themselves for each one's findings and status.
