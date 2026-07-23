# Changelog

All notable changes to this project are documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

Nothing pending.

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
- A full pre-public content scrub of every tracked file outside `pmo/`
  (real names/emails removed or confined to marked worked-example
  regions).
- LICENSE (MIT, D-17) and `.github/CODEOWNERS` at repo root.
- ADR-0010: retroactively documents the FLUX image-model adoption that was
  already live in production with no ADR ever written for it.

### Known open items

- `pmo/` is intentionally left real/unscrubbed by design (see `pmo/DECISIONS.md`
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
