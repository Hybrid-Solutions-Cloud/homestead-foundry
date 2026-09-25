# Model Router, gateway and MCP roles

The deployed pattern has two Foundry accounts, each containing its own project,
and one gateway. Projects are children of accounts, not containers for multiple
accounts. Regional placement follows model availability and quota. Exact names
and production verification belong in the private overlay.

## Two kinds of routing

MCP roles map jobs to deployments. The calling assistant chooses a role; its
description guides the caller and is not an Azure task classifier. The `auto`
role maps to Azure Model Router. The gateway forwards that request to the hosting
account, where Azure chooses an eligible underlying model. Other roles and
direct model selection bypass automatic selection.

| Request | Model selection |
|---|---|
| MCP `code`, `docs`, `iac` or another role | Private MCP routing policy |
| MCP direct deployment | Caller, subject to MCP allow/block policy |
| MCP `auto` or direct router deployment | Azure selects within its allowed pool |
| Editor model picker | User; Azure selects further only for the router entry |

The current deployment uses router version `2025-11-18`, GlobalStandard,
Balanced mode, and an explicit GPT-5.6 Luna, Terra and Sol subset. `fast` remains
the MCP default. Capacity is a SKU-specific quota allocation, not a context
window or a universal token-per-minute value.

## Pool configuration

Microsoft supports Balanced, Cost and Quality modes and custom subsets. Use
only models supported by the router version and region. Deploying GPT-6, Kimi
or DeepSeek V4 separately does not make them eligible for the current pool.
Read back effective routing settings after updates, rather than relying only on
provisioning success. [Microsoft configuration reference](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/model-router).

Use explicit roles when a task must use a particular model. Evaluate Cost mode
against Balanced on fixed representative prompts before adopting it. Cost mode
is not a spending cap; monitor selected models and billable tokens, with budgets
and output limits as separate controls. [Microsoft evaluation guidance](https://devblogs.microsoft.com/foundry/how-to-run-evals-for-model-router/).

## Using MCP

The local adapter offers `list_models`, `ask_model` and `compare_models`; the
hosted platform exposes corresponding Foundry tools. List models first. Supply
`model: "auto"` to the ask tool for Azure routing. Omitting the model uses the
configured default role. Include required context in the prompt: delegated
models do not inherit files, tools or the caller's conversation.

The private overlay owns its registry and MCP `routing.json`.
`Sync-McpRouting.ps1` generates hosted platform configuration and supports
`-Check` for drift detection. A hosted policy change requires a platform commit,
merge, build/release and live verification. Local JSON edits alone do not update
the remote server. Block rules also apply to direct selection.

## Monitoring and recommendations

Inspect requested versus returned model, backend, errors, latency, token
coverage and cost freshness. First-token timing requires streaming; normal
non-streaming MCP requests cannot populate it. A successful router response
proves connectivity, not task quality or cost optimality.

The [dated research](../research/model-selection-2026-09-25) led to the
owner-approved September 25 role update: GPT-6 Luna for fast/docs/cheap-bulk,
Kimi K2.7 Code for code, Grok 4.6 for deep/adversary, GPT-6 Sol for iac,
DeepSeek V4 Pro for second-opinion, and the existing Balanced router for auto.
Escalation requires an explicit caller decision; there is no automatic fallback
chain. The private overlay records the hosted release and live verification. See the
[cloud roster](../reference/cloud-model-roster-2026-09-25),
[gateway guide](./model-gateway) and
[monitoring operations](../implementation/foundry-observability-operations).
