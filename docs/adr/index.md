# ADR index

Every Architecture Decision Record this project has locked, in decision order. Each links to the full record.

| ADR | Decision |
|---|---|
| [ADR-0001](./ADR-0001-target-tenant) | Target tenant, subscription, and region |
| [ADR-0002](./ADR-0002-image-model-and-access) | Image-model selection methodology and access (the model list lives in the [model catalog](../reference/model-catalog)) |
| [ADR-0003](./ADR-0003-voice-model-and-voice-set) | MAI-Voice-2 voice model and listen voice set |
| [ADR-0004](./ADR-0004-foundry-topology-and-region) | Foundry resource topology and region |
| [ADR-0005](./ADR-0005-identity-and-secrets) | Identity, roles, and secret handling |
| [ADR-0006](./ADR-0006-cost-governance) | Cost governance and the monthly budget cap |
| [ADR-0007](./ADR-0007-content-safety-and-responsible-ai) | Content safety and responsible AI for generated images and narration |
| [ADR-0008](./ADR-0008-publish-pipeline-integration) | Publish-pipeline integration for Foundry voice and image generation |
| [ADR-0009](./ADR-0009-azure-local-reviewer-track) | Azure Local on-prem reviewer / RAG track (open-weight substitute) |
| [ADR-0010](./ADR-0010-flux-image-model-adoption) | FLUX image models adopted alongside the MAI-Image baseline (superseded by ADR-0002 and the [model catalog](../reference/model-catalog)) |
| [ADR-0011](./ADR-0011-multi-target-deployment-automation) | Multi-target deployment automation (Azure cloud, Windows Server Foundry Local, Azure Local) |
| [ADR-0012](./ADR-0012-agent-mcp-gateway-governance) | Agent MCP tool governance via an APIM AI gateway (gated to the agent phase) |
| [ADR-0013](./ADR-0013-foundry-local-windows-server-install) | Foundry Local install mechanism, identity exception, and governance scope (supersedes part of ADR-0011) |
| [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers) | Azure Local Foundry deployment layers, GPU scope, and authentication (supersedes part of ADR-0011, amends ADR-0009) |
| [ADR-0015](./ADR-0015-cost-first-observability-boundaries) | Cost-first observability package boundaries and activation gates |
| [ADR-0016](./ADR-0016-foundry-model-usage-observability) | Native Foundry metrics for model usage observability |
| [ADR-0017](./ADR-0017-deployment-target-documentation-structure) | Deployment-target documentation and repository structure (the `docs/targets/` tree, two model catalogs, the `infra/` subtree layout) |
| [ADR-0018](./ADR-0018-model-registry-schema-v2) | Model registry schema v2, with an optional target discriminator (implements ADR-0017 decision 7) |
| [ADR-0019](./ADR-0019-on-premises-model-rosters) | The on-premises model rosters and the first increment for each target |
| [ADR-0020](./ADR-0020-on-premises-hardware-sizing-and-gpu-scope) | On-premises hardware sizing provenance and GPU scope (corrects SPIKE-18's binding-constraint claim) |
| [ADR-0021](./ADR-0021-on-premises-cost-governance) | On-premises cost governance, where ADR-0006 layer 1 has no referent (amends ADR-0006) |
| [ADR-0022](./ADR-0022-on-premises-observability-boundaries) | On-premises observability boundaries, and that ADR-0016 cannot be met on either target |
| [ADR-0023](./ADR-0023-azure-local-foundry-networking-and-tls) | Azure Local Foundry networking, ingress, and TLS (reverses SPIKE-19's certificate position) |
| [ADR-0024](./ADR-0024-on-premises-lifecycle-and-upgrade) | On-premises lifecycle, upgrade, drift, and teardown |
