# Repository intent: studio-foundry (open-source candidate)

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

## Status: PRIVATE, checklist mostly closed outside the private planning workspace - re-verified 2026-07-23

**This repository must stay private until the checklist below is complete and the owner
has verified it is clean. Only then may it be made public.**

The repo's actual approach diverged from this file's original premise in two owner-
approved ways (see the decision log D-14): (1) this is no longer a copy with reset
history - it is the single, real, continuously-committed working repo, kept private
until flip; (2) brand content is not fully deleted, it is confined to marked
`<!-- safety-scan-worked-example:start/end -->` regions that `scripts/scan-public-safety.mjs`
treats as non-blocking, per D-03 (the two publishing brands become an example-consumer
appendix only). `node scripts/scan-public-safety.mjs --full` is the authoritative check
behind every box below; re-run it before trusting this checklist on a later read.

## What must happen before it can go open source

- [x] **Tenant identity.** Removed outside the private planning workspace (full pre-public scrub, 2026-07-23).
      the private planning workspace intentionally excluded, see status note above.
- [x] **Subscription identity.** No subscription/tenant GUIDs found outside the private planning workspace as of
      the 2026-07-23 scan (only public Azure built-in role IDs in `infra/modules/rbac.bicep`
      and bare Lucid/Artifact document IDs with no invitation tokens - both confirmed safe).
- [ ] **Resource names.** Placeholders everywhere the scanner enforces it, with one
      known, deliberate exception: `ai/REVIEW.md` and `ai/TASKS.md` keep real CAF-shaped
      names (for example `aif-studioai-prod-eus-01`, `rg-studioai-prod-eus-01`) as a
      historical record (light-touch treatment, not restructured into an appendix). The
      scanner flags these as non-blocking `caf-shaped-non-placeholder` warnings - each
      needs an explicit owner confirm-safe-to-publish decision before flip, not a
      silent pass.
- [x] **People.** Real owner email and full name removed from `ai/TASKS.md` and
      `ai/implementation/as-built.md` (full pre-public scrub, 2026-07-23).
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

**Everything else in this repository (Phases A/B/C/D/E/G/H/I) is done and verified as of
2026-07-23** - see `CHANGELOG.md` and the project roadmap for the full breakdown. What
remains before a public flip is the four unchecked/partial items above (resource
names, brand content, history rebuild, owner review), all of which require an
explicit owner decision - none are silently blocked on more agent work.

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
- `ai/adr/` - the decision records
- `ai/design/` - the architecture and design docs
- `ai/implementation/` - the implementation guide and as-built template
- `ai/verification/` - readiness and verification
- `AGENTS.md` and `.claude/agents/` - the agent roster and hard rules
