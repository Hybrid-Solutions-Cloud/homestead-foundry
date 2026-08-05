# Changelog

All notable changes to this project are documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A [model availability matrix](docs/reference/model-matrix.md): 233 models
  against 42 regions, where the two on-premises targets are treated as regions.
  Interactive, filterable, sortable, with per-region deployment types, capacity
  ceilings, versions and retirement dates on every row. Each cell is coloured by
  configuration profile, so a model identical everywhere reads as a uniform band
  and one that differs by region reads as a mosaic.
- [SPIKE-32](docs/research/SPIKE-32-model-region-availability-matrix.md), the
  research behind it. Availability was measured with
  `az cognitiveservices model list` across all 63 physical regions rather than
  read from documentation. The finding: **region changes what you can buy, not
  what the model is.** No model's context window or maximum output differed
  between regions; what differs is the deployment types on offer, for 56 of 134
  cloud models. Sixty-four model-and-region pairs offer no pay-as-you-go
  capacity at all. North Europe carries 28 models against Sweden Central's 132.
  Four models run on all three deployment targets, and 82 of 134 cloud models
  retire within twelve months.
- `scripts/model-matrix/`, which generates that dataset. The cloud half is a
  live read needing only Reader; the on-premises half is still a transcription
  of the SPIKE-22 snapshot. This is the first part of issue #15 to land and does
  not close it, because nothing schedules the refresh yet.
- A VitePress custom theme, extending the stock theme rather than replacing it,
  so the matrix component can be registered without changing any existing page.
- Dashboard panels 7-11: directional cost estimation by deployment, aggregate
  token consumption, model inventory (all 22 deployed models), content safety /
  RAI blocks (HTTP 400), and caller/consumer breakdown.
- `AzureOpenAIRequestUsage` diagnostic category support for caller-identity
  tracking via Usage diagnostics logs.
- Updated dashboard README and implementation guide with panel descriptions
  and Usage diagnostic configuration instructions.

### Changed

- Dashboard description updated to reflect cost estimation and inventory panels.
- Dashboard tags expanded to include `cost-estimation`, `content-safety`, and
  `model-inventory`.

## [0.2.0] - 2026-07-25

The infrastructure layer stopped being theoretical. The environment described
in the design docs was deployed for real from this repository's Bicep, and
the repository itself became usable by someone who did not write it.

### Added

- A tested, end-to-end [deployment guide](docs/guide/deployment.md): six steps
  from an empty subscription to a verified environment, with the commands, the
  permissions actually required, and the failure modes that only surface on a
  rebuild (key rotation, soft-delete tombstones, role-assignment deduplication).
- `scripts/build-model-catalog.mjs`, which queries the live Azure catalog for
  the current name and version of every model in a registry and writes the
  catalog the Bicep consumes. This is how ADR-0002's "never hardcode a preview
  version" rule is enforced mechanically rather than by memory.
- `models/registry.starter.json`, a real twenty-six entry roster covering image,
  voice, reasoning and video across five vendors, including `rejected` entries
  that record why a model was not adopted. Replaces placeholders as the thing a
  new deployer starts from.
- `infra/params/starter.bicepparam`, wired to the starter registry, with every
  deployer-supplied value marked for replacement.
- SPIKE-17 and ADR-0012 on governing agent tool access through an API gateway,
  gated to a future agent phase.

### Changed

- The environment recorded in [as-built](docs/implementation/as-built.md) was
  rebuilt net-new from `infra/main.bicep`: twenty model deployments, a project,
  data-plane RBAC, and a resource-group budget, all `Succeeded`. Infrastructure
  as code is now the source of truth for it, rather than a description of a
  manual build.
- The Bicep preserves the default content-safety policy, the automatic
  version-upgrade setting, and account project management on redeploy. A
  `what-if` preview caught the template stripping all three from live
  deployments before anything was applied.
- Added `manageRoleAssignments`, so reconciling an environment whose groups
  already hold their roles does not fail on `RoleAssignmentExists`.
- Image and voice model selection was restructured from per-model ADRs into a
  selection methodology plus the model registry, so adding a model is a
  registry edit rather than a new decision record.
- The roadmap, README, getting-started guide, and as-built record were corrected;
  several still described the project as private, undeployed, or in progress.

### Fixed

- `build-model-catalog.mjs` could not run on Windows at all: the Azure CLI is a
  batch shim there, and Node refuses to execute one without a shell. It also
  failed to match registry entries whose deployment name is a shortened form of
  the vendor's catalog name, and shadowed an import in a way that stopped the
  script parsing.

### Removed

- The repository no longer publishes the maintainer's private MCP endpoint,
  personal diagram links, or personal published board. `.mcp.json` ships as an
  example and is gitignored.

## [0.1.0] - 2026-07-23

First tagged snapshot of the platform-pivot rebuild: the phase-gated
methodology, a validated (not yet live-deployed) infrastructure layer, and
a public-facing docs scaffold.

### Added

- Phases 0-9: the original two-brand Azure AI Foundry deployment
  (MAI-Image-2.5 + MAI-Voice-2) that proved the phase-gated pipeline in
  production, with the Phase 8/9 checkbox bookkeeping corrected.
- Phase A: repository hardening scaffolding - issue and PR templates, the
  `scripts/scan-public-safety.mjs` pre-commit safety gate, GitHub-to-ADO
  issue sync. Branch protection remains blocked on the GitHub org's Free
  plan.
- Phase B: brand-neutral rewrite of every design doc, ADR (0001-0008), and
  research spike (01-07), using a marked worked-example region so the real
  worked example stays visible without tripping the public-safety gate.
- Phase C: `models/registry.schema.json` and `models/registry.example.json`
  - the registry-driven model catalog Phase D's Bicep reads from.
- Phase D: parameterized Bicep (`infra/`) for the resource group,
  AIServices/Foundry account, registry-driven model deployments, the
  two-security-group RBAC pattern, Key Vault secret-name references, and a
  budget. Validated with `az bicep build` and a read-only `what-if` only -
  no live deployment has been created from this repository.
- Phase E: the SPIKE-07 speech-model survey (8 cloud + 5 self-host
  candidates scored; no vendor change - the native Azure baseline already
  covers word-timestamp and viseme output).
- Phase G: a VitePress public docs site scaffold under `docs/`. GitHub
  Pages publish is deferred - unavailable for a private repo on this org's
  Free plan - so only the build-and-validate CI job runs today.
- Phase H: Foundry Local (SPIKE-08, no roster fit) and Azure Local
  (SPIKE-09) research, plus ADR-0009 scoping a gated on-prem reviewer/RAG
  track alongside the planned cloud reviewer pair.
- Phase I: SPIKE-10 through SPIKE-16, covering the latest in-tenant GPT and
  Grok options, broader image/video alternatives, a tenant-wide TTS
  survey, a tenant/region survey, niche reviewer-model options, and
  virtual-trainer-avatar research.
- A full pre-public content scrub of every tracked file outside the private planning workspace
  (real names/emails removed or confined to marked worked-example
  regions).
- LICENSE (MIT, D-17) and `.github/CODEOWNERS` at repo root.
- ADR-0010: retroactively documents the FLUX image-model adoption that was
  already live in production with no ADR ever written for it.

### Known open items

- the private planning workspace is intentionally left real/unscrubbed by design (see the decision log
  D-14) - it stays private until its own public-fate decision is made.
- A handful of real, CAF-shaped resource names remain in `ai/REVIEW.md` and
  `ai/TASKS.md` as a deliberate historical record; each needs an explicit
  owner confirm-safe-to-publish pass before any public flip (see
  `REPO_INTENT.md`).
- Git history has not been rebuilt from a fresh `git init`; every commit
  in this repository's history is real. Per `REPO_INTENT.md`, that rebuild
  must happen before any public flip and requires explicit owner
  authorization given it discards history.
- Repository visibility flip to public requires explicit, in-the-moment
  owner confirmation regardless of checklist status.
- ADO project rename and GitHub-to-ADO sync re-verification blocked on
  owner input (current ADO org/project name).
