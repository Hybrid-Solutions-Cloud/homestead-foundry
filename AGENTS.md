# homestead-foundry - Agent instructions

## What this repo is

A private, personally-run studio for designing, deploying, and documenting **Azure AI Foundry** infrastructure - research, decisions, design, diagrams, and as-built records for standing up Foundry model backbones (image, voice, and future modalities). The methodology is built to become an open-source knowledge and automation center: detailed documentation on Azure AI Foundry itself, plus the agent roster and Bicep automation that does the deploying. Its first proven build is a media backbone (MAI-Image-2.5 for scene art, MAI-Voice-2 for narration) serving two publishing brands - kept as a worked example in `docs/design/*.md`, not the primary framing.

The whole initiative is under `ai/`. Start at `ai/MASTER-PLAN.md`, then `ai/TASKS.md`. Planning and backlog live under the private planning workspace.

## Governance

This repo is governed by the **HCS Governance MCP** (`.mcp.json`). At session start call:

```
bootstrap(repo="homestead-foundry", client="claude-code")
```

Prefer a live MCP answer over anything written here.

## The custom agent roster (in `.claude/agents/`)

| Agent | Model | Role |
|---|---|---|
| `foundry-researcher` | opus | Research spikes and ADRs |
| `foundry-architect` | sonnet | Architecture and design docs (WAF + CAF) |
| `foundry-diagrammer` | sonnet | Authors Lucid diagrams via the Lucid MCP |
| `foundry-diagram-qa` | sonnet | Verifies Lucid layout (no overlaps, legible) |
| `foundry-reviewer` | sonnet | Reviews and fact-checks completed docs |
| `foundry-env-verifier` | sonnet | Read-only Azure readiness and deploy verification |
| `foundry-implementer` | fable | Implementation guide and gated deployment (Bicep/automation) |
| `foundry-ops` | sonnet | Commit, push, board updates, file moves |

Model column reflects the 2026-07-21 owner directive: Opus or Fable only for
research spikes, ADR creation, Bicep, and automation/deployment scripts;
Sonnet for everything else. See `CLAUDE.md`'s "Model policy for this repo."

## Hard rules (never violate)

- **No API agents.** Harness only. Never call a model API directly, no `ANTHROPIC_API_KEY` in any agent or script.
- **No em-dashes** in committed prose. Grep before committing.
- **No secrets** committed. Tenants, subscriptions, keys, vaults by name only. Secrets live in the tenant Key Vault.
- **WAF 5-pillar + CAF naming** for all Azure design (clear `rg-...`, resource, deployment, vault, budget names).
- **Azure writes gate.** Confirm before any resource-creating `az` call. Bulk generation is held for the owner.
- Commit format: `type(scope): short description` (types feat, fix, docs, chore, refactor, test).

## Key facts

| Fact | Value |
|---|---|
| GitHub org | Hybrid-Solutions-Cloud (private repo) |
| Local path | `D:/git/hybrid-solutions-cloud/homestead-foundry` |
| Primary tenant | Decided by the environment check (credit sub preferred; a secondary tenant is the fallback) |
| Key Vault | The chosen tenant's platform vault (named in `docs/design/*` worked-example appendices) |
| Worked example | Two publishing brands (proves the methodology in production; see `docs/design/*` appendices) |
