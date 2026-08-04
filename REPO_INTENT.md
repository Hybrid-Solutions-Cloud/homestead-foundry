# Repository intent: the initiative (open-source candidate)

## What this repository is

This is a copy of a private, internal build of an Azure AI Foundry media-generation
backbone. The purpose of THIS copy is to become an open-source, reusable
**methodology**: a phase-gated, multi-agent pipeline for taking a cloud AI initiative
from research through to a verified deployment.

The value we want to share is the process and the scaffolding, not any one
organization's environment:

- the phase-gated pipeline: research spikes, then Architecture Decision Records, then
  design docs, then diagrams, then an implementation guide, then review, then a gated
  deploy, then verification
- the roster of purpose-built agents that drive each phase
- the Well-Architected and Cloud Adoption Framework naming and design discipline
- a template implementation guide with confirmation-gated infrastructure steps

## Provenance

- This copy was created from a private origin that lives in a different GitHub org. The
  private original remains the source of truth for the real deployment.
- The git history here was started FRESH (a new `git init`). The upstream commit
  history was intentionally NOT carried over, because it contains environment-specific
  detail. This copy must never import that history.

## Status: PUBLIC. The flip happened, and this file said otherwise for weeks.

**This repository is public.** Verified against GitHub on 2026-08-03: MIT licensed,
visibility PUBLIC.

Until 2026-08-03 this section said the repository *must stay private* until the
checklist below completed, while the repository was already public. **A document
asserting a current state that the world disproves is worse than no document**,
because a later reader gates a real decision on it. That has happened here more
than once.

The checklist below is therefore **a historical record of the pre-flip scrub, not
a gate**. It is kept because the reasoning in it is still the reasoning that keeps
this repository safe to publish, and because two of its items describe standing
policy rather than one-time work.

### What the scanner says today

`node scripts/scan-public-safety.mjs --full` is the authoritative check, and it is
**clean**: zero blocking findings across 34,663 lines of the full tracked tree,
2026-08-03.

That took a fix to the scanner, not to the repository. The scan had been reporting
three blocking findings, and **all three were false positives**:

- `log-analytics-workspace` and `log-alert-rule` were reported as malformed CAF
  resource names. `log` is a CAF prefix *and* the first word of the Azure service
  "Log Analytics", so every mention of the service tripped the lint.
- `operations@example.invalid` was reported as a real identity. `.invalid` is
  reserved by RFC 2606 precisely to guarantee a name never resolves. The rule
  recognised only `example.com`, `.org` and `.net`.

**A gate whose entire output is false positives is a gate nobody reads**, which is
how it stayed red long enough to stop meaning anything. Both rules were narrowed
with the reason recorded inline.

One non-blocking warning remains and has been reviewed:
`rg-foundryedge-prod-eus-01` in ADR-0011, which the ADR itself labels "example
only, not a provisioning instruction". The real estate uses a different workload
name entirely. **Safe to publish.**

The repo's actual approach diverged from this file's original premise in two owner-
approved ways (see the decision log D-14): (1) this is no longer a copy with reset
history - it is the single, real, continuously-committed working repo, kept private
until flip; (2) brand content is not fully deleted, it is confined to marked
`<!-- safety-scan-worked-example:start/end -->` regions that `scripts/scan-public-safety.mjs`
treats as non-blocking, per D-03 (the two publishing brands become an example-consumer
appendix only). `node scripts/scan-public-safety.mjs --full` is the authoritative check
behind every box below; re-run it before trusting this checklist on a later read.

## The pre-flip checklist, as a historical record

- [x] **Tenant identity.** Removed outside the private planning workspace (full pre-public scrub, 2026-07-23).
      the private planning workspace intentionally excluded, see status note above.
- [x] **Subscription identity.** No subscription/tenant GUIDs found outside the private planning workspace as of
      the 2026-07-23 scan (only public Azure built-in role IDs in `infra/modules/rbac.bicep`
      and bare Lucid/Artifact document IDs with no invitation tokens - both confirmed safe).
- [ ] **Resource names.** Placeholders everywhere the scanner enforces it. A prior
      deliberate exception let `ai/REVIEW.md` and `ai/TASKS.md` keep real CAF-shaped
      names (for example `aif-<workload>-<env>-<region>-01`,
      `rg-<workload>-<env>-<region>-01`) as a historical record (light-touch
      treatment, not restructured into an appendix); both files have since been
      anonymized to the same generic pattern used everywhere else. Re-run
      `scripts/scan-public-safety.mjs --full` to confirm before flip.
- [x] **People.** Real owner email and full name removed from `ai/TASKS.md` and
      `docs/implementation/as-built.md` (full pre-public scrub, 2026-07-23).
- [~] **Brand content.** Not removed - confined instead to marked worked-example
      regions (D-03), which the scanner downgrades to non-blocking warnings. This is a
      deliberate, owner-ratified deviation from this item's original wording, not an
      oversight.
- [x] **External links with tokens.** Zero `lucid-invitation-token` findings in the
      2026-07-23 full scan (blocking rule, applies everywhere including the private planning workspace).
- [x] **Environment data.** `ai/verification/environment-readiness.md` and
      `ai/verification/deployment-verification.md` genericized (full pre-public scrub,
      2026-07-23).
- [x] **License.** MIT chosen by the owner and added at repo root (D-17,
      2026-07-21).
- [x] **README.** Rewritten as a public-facing, end-state landing pitch (accepted
      2026-07-21).
- [ ] **History rebuild.** NOT done. This repository's git history is real from
      `bb867e5` forward - every commit actually happened. Rebuilding from a fresh
      `git init` is destructive and irreversible for that history; it must not be run
      without explicit, in-the-moment owner authorization, same gate as the visibility
      flip itself.
- [ ] **Owner review.** Not started. Needs a final read-through covering: the
      `caf-shaped-non-placeholder` warnings above and the private planning workspace's own public-fate
      decision, before flipping visibility.

### How the four open items resolved

The flip happened with four items unclosed. Each is settled here so nobody has to
guess again.

| Item | Resolution |
|---|---|
| **Resource names** | **Closed.** The full scan is clean. The one CAF-shaped name left is `rg-foundryedge-prod-eus-01` in ADR-0011, which the ADR labels "example only", and which does not match the real estate's workload name. |
| **Brand content** | **Standing policy, not a task.** Worked-example regions are a deliberate, owner-ratified design (D-03). The scanner downgrades brand tokens inside a marked region and blocks them everywhere else. Nothing to close. |
| **History rebuild** | **Not done and not doing it.** The history from `bb867e5` forward is real, and rebuilding it is destructive and irreversible. It was a pre-flip option; the repository is public with that history intact, so the option has expired. Do not run it. |
| **Owner review** | **Superseded by the flip itself.** Making the repository public was the decision this item was waiting for. |

**Everything else in this repository (Phases A/B/C/D/E/G/H/I) is done and verified**;
see `CHANGELOG.md` and the project roadmap.

## What must never come back here

`REPO-BOUNDARY.md` states this properly. The short version: **this repository
describes how to build a Foundry and never describes what to do with one.** The
content discovery tooling lived here until 2026-08-03 and was moved to
`project42dev/orchard` under ADR-0017. It is not coming back.

## What to preserve (the point of the repo)

Keep the reusable methodology intact while genericizing:

- the phase structure and its gates
- the shape of the agent roster and how phases hand off
- the Well-Architected and Cloud Adoption Framework discipline
- the hard rules that keep it safe (secrets by name only, no secrets in commits, a
  confirmation gate on every infrastructure write)

## Where the methodology lives

- `ai/MASTER-PLAN.md` - the master plan for the initiative
- `ai/TASKS.md` - the phase board
- `docs/adr/` - the decision records
- `docs/design/` - the architecture and design docs
- `docs/implementation/` - the implementation guide and as-built template
- `ai/verification/` - readiness and verification
- `AGENTS.md` and `.claude/agents/` - the agent roster and hard rules
