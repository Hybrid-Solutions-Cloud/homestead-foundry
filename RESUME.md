# Resume prompt: Homestead Foundry

Paste this as your opening message in a fresh session started from this
folder (`D:\git\hybrid-solutions-cloud\homestead-foundry`) to pick up
exactly where the last session left off (2026-07-21).

---

## What this repo is

This repo used to be called `studio-foundry`. It has been renamed to
**Homestead Foundry** - a general-purpose, eventually open-source platform
for deploying and managing Azure AI Foundry resources and model catalogs
(image, voice, video, reasoning/review models), built out of what started
as a two-brand MAI-Image-2.5 + MAI-Voice-2 deployment (see the "Worked
example" appendices in `ai/design/*` for the real brands). Full plan lives
in the private planning workspace - start with the planning docs, then
the project charter, the decision log (D-01 through D-14 - D-14 is the most
recent and important, read it first if short on time), the project roadmap,
and the model roster.

## Where things stand right now

- **The rename is done on GitHub and locally, but not fully cleaned up.**
  `Hybrid-Solutions-Cloud/studio-foundry` was renamed to
  `Hybrid-Solutions-Cloud/homestead-foundry` on GitHub (old name
  auto-redirects). This folder is a fresh copy of the old
  `D:\git\hybrid-solutions-cloud\studio-foundry` working tree, made because
  that old folder was locked (VS Code / lingering process handles) and
  couldn't be renamed in place. This folder's git remote already correctly
  points at `homestead-foundry`.
- **Nothing has been committed or pushed yet.** `git status` here should
  show the same uncommitted state as when this was copied: a new the private planning workspace
  folder (untracked), and modified `.claude/agents/foundry-architect.md`,
  `.claude/agents/foundry-diagrammer.md`, `AGENTS.md`, `CLAUDE.md`,
  `ai/TASKS.md`. Check `git status` first thing - if the owner hasn't asked
  for a commit yet, ask before committing (standing rule: only commit when
  explicitly asked).
- **Local cleanup still needed (do NOT do silently):**
  - The old `D:\git\hybrid-solutions-cloud\studio-foundry` folder still
    exists (duplicate of this one) - delete it once you've confirmed this
    folder is the one being used, whenever the owner is ready (it's harmless
    sitting there, just don't edit both).
  - A second stale duplicate exists at
    `D:\git\hybridsolutionscloud\studio-foundry` (no hyphens in the parent
    folder) - clones the OLD GitHub name, never resolved this session.
  - `D:\git\thisismydemo\studio-foundry` is a dead, disconnected clone
    (its GitHub repo was deleted 2026-07-13) - read-only historical
    reference only, never push/pull it.
- **`ai/TASKS.md`'s Phase 8/9 checkboxes were corrected** (they said done
  in the header but had stale unchecked sub-items) - already fixed, just
  context if it looks odd.

## Model policy (owner directive, already applied to `CLAUDE.md`/`AGENTS.md`)

**Opus or Fable**: research spikes, ADR creation, Bicep authoring, and
automation/deployment scripts. **Sonnet**: everything else (design docs,
diagrams, planning docs, docs site, review, ops).

## What to actually do next, in order

1. **Write the Master Plan and Design doc** (in the private planning workspace - exact filename not
   yet decided, likely the private planning workspaceMASTER-PLAN-AND-DESIGN.md` or folded into
   existing docs; use your judgment, ask the owner if genuinely unsure).
   This translates a large owner brain-dump (see the model roster and the
   memory file `project-platform-expansion-requests` for the full raw
   content) into a readable plan, and must explicitly enumerate how many
   research spikes and ADRs are needed and how the docs folder is
   organized. This was Priority 1 several messages before this file was
   written and still isn't done.
2. **Docs site**: build the docs folder structure, stand up VitePress, wire
   GitHub Pages publishing. Owner wants this live now, NOT gated behind the
   brand-neutral `ai/` rewrite like the original roadmap sequencing assumed
   - flag this conflict and get an explicit call before just picking one.
3. **ADO project rename + GitHub<->ADO sync verification.** Rename the
   Azure DevOps project to match Homestead Foundry, then verify the
   `ado-sync.yml` workflow / issue templates (found on a remote fetch during
   the GitHub rename - one commit, `AB#25`, not yet pulled into this local
   copy) still work correctly afterward. Do this AFTER items 1-2 land, not
   before - the owner was explicit about this sequencing.
4. **Research spikes** (Opus/Fable), roughly in this order but confirm
   priority with the owner: latest available GPT model in-tenant (not
   necessarily `gpt-5.6-terra`), a newer Grok than `grok-4-1-fast-reasoning`
   if deployable, image/animation/video generation alternatives (broader
   than the existing FLUX work), an alternative voice/TTS solution anywhere
   in the tenant (not subscription-locked), a tenant-wide model + region
   survey (find one region that can host everything), niche/emerging
   reviewer models for code and document review (verify what "K3" refers to
   - possibly Kimi K2 - and the current Llama release), and research into a
   photorealistic virtual-trainer avatar (identify the correct technical
   term and real vendor/Azure options - owner did not know the term for
   this going in).

## Full detail

Everything above is a summary. The complete raw context (including the
owner's original brain-dump message nearly verbatim, every decision's exact
reasoning, and things NOT to silently assume) lives in this session's
auto-memory, which should already be loaded automatically in a fresh
session started from this folder - see especially the memory entries named
`project-platform-pivot` and `project-platform-expansion-requests`. Read
those before making any assumptions about scope that isn't captured above.
