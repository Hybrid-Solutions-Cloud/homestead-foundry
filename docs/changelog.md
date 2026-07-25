# Changelog

Release history for this project. The authoritative file is `CHANGELOG.md` in the repository root, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format; this page mirrors it. Versioning follows [Semantic Versioning](https://semver.org/).

## 0.2.0 - 2026-07-25

The infrastructure layer stopped being theoretical. The environment described in the design docs was deployed for real from this repository's Bicep, and the repository itself became usable by someone who did not write it.

### Added

- A tested, end-to-end [deployment guide](./guide/deployment): six steps from an empty subscription to a verified environment, with the commands, the permissions actually required, and the failure modes that only surface on a rebuild (key rotation, soft-delete tombstones, role-assignment deduplication).
- `scripts/build-model-catalog.mjs`, which queries the live Azure catalog for the current name and version of every model in a registry and writes the catalog the Bicep consumes. This is how the "never hardcode a preview version" rule is enforced mechanically rather than by memory.
- `models/registry.starter.json`, a real twenty-six entry roster covering image, voice, reasoning and video across five vendors, including `rejected` entries that record why a model was not adopted. Replaces placeholders as the thing a new deployer starts from.
- `infra/params/starter.bicepparam`, wired to the starter registry, with every deployer-supplied value marked for replacement.
- [SPIKE-17](./research/SPIKE-17-agent-mcp-gateway-governance) and [ADR-0012](./adr/ADR-0012-agent-mcp-gateway-governance) on governing agent tool access through an API gateway, gated to a future agent phase.

### Changed

- The environment recorded in [as-built](./implementation/as-built) was rebuilt net-new from `infra/main.bicep`: twenty model deployments, a project, data-plane RBAC, and a resource-group budget, all `Succeeded`. Infrastructure as code is now the source of truth for it, rather than a description of a manual build.
- The data plane is verified rather than assumed. Image generation, a reasoning completion, and text-to-speech were all exercised with real calls against the rebuilt environment.
- The Bicep preserves the default content-safety policy, the automatic version-upgrade setting, and account project management on redeploy. A `what-if` preview caught the template stripping all three from live deployments before anything was applied.
- Added `manageRoleAssignments`, so reconciling an environment whose groups already hold their roles does not fail on `RoleAssignmentExists`.
- Image and voice model selection was restructured from per-model ADRs into a selection methodology plus the model registry, so adding a model is a registry edit rather than a new decision record.
- The roadmap, README, getting-started guide, model catalog, and as-built record were corrected; several still described the project as private, undeployed, or in progress.

### Fixed

- `build-model-catalog.mjs` could not run on Windows at all: the Azure CLI is a batch shim there, and Node refuses to execute one without a shell. It also failed to match registry entries whose deployment name is a shortened form of the vendor's catalog name, and shadowed an import in a way that stopped the script parsing.

### Removed

- The repository no longer publishes the maintainer's private MCP endpoint, personal diagram links, or personal published board. `.mcp.json` ships as an example and is gitignored.

## 0.1.0 - 2026-07-23

First tagged snapshot of the platform rebuild: the phase-gated methodology, a validated infrastructure layer, and a public-facing docs scaffold.

### Added

- The original nine-phase Azure AI Foundry deployment that proved the phase-gated pipeline in production.
- Repository hardening: issue and pull-request templates, the `scripts/scan-public-safety.mjs` pre-commit safety gate, and issue sync.
- A brand-neutral rewrite of every design document, Architecture Decision Record, and research spike.
- The model registry schema and its example.
- Parameterized Bicep for the deployment, validated with `az bicep build` and `what-if`.
- Research on speech models and the word-synchronization gap, on Foundry Local and Azure Local model support, and an extended spike backlog covering newer models, a region survey, and avatar research.
- This documentation site.
