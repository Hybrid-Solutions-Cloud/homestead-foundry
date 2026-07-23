# homestead-foundry - Claude Code

@AGENTS.md

## Claude Code notes

- Subagents and config for this repo live in `.claude/`. The repo-level MCP config is `.mcp.json` (HCS Governance).
- This is a **private** infra + design repo. Azure architecture, cost, and provisioning detail live here so they stay out of the public site repos.
- The full initiative is under `ai/`. Start at `ai/MASTER-PLAN.md` and `ai/TASKS.md`.

## Model policy for this repo (owner directive)

- **Opus or Fable**: research spikes, ADR creation, Bicep authoring, and automation/deployment scripts. This covers `docs/research/SPIKE-*`, `docs/adr/ADR-*`, everything under `infra/` (Bicep modules and params), and any deployment/automation tooling.
- **Sonnet**: everything else - architecture and design docs, diagram authoring and layout QA, implementation guides, doc review and fact-check, environment checks, deployment verification, commit and push, planning/backlog docs (the private planning workspace), docs-site work.

Owner directive (2026-07-21): "For the research spikes and the ADR creation and the Bicep and automation, please use Opus or Fable. For all other tasks, use Sonnet." This supersedes the prior per-agent model column below where it conflicts - the roster's assigned models should be reconciled to this rule.

## Hard rules (never violate)

- **No API agents.** Every agent runs under the Claude Code harness. Never call a model API directly.
- **No em-dashes** in any committed prose. Grep before committing.
- **No secrets** in any committed file. Reference tenants, subscriptions, keys, and vaults by name only. Real secrets go to the tenant Key Vault.
- **WAF + CAF** naming and structure for all Azure design.
- **Azure writes are gated.** Confirm before any resource-creating `az` call. Bulk image and audio generation is held for the owner.

## Claude Code actions in this repo

**Run autonomously:** read/search/grep; write/edit files; `git add|commit|push|rm|mv`; `gh` CLI; `npm`/`npx`/`node`; read-only `az` (account, cognitiveservices list/show, group show).

**Always confirm before:** any `az` write (resource create/update/delete); storing or reading secrets; running bulk generation; installing software.
