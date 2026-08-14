# SPIKE-33: Code and documentation model comparison

Role: foundry-researcher. Status: specification and cost comparison complete;
empirical quality comparison pending. No model API was called, no model was
deployed, and no Marketplace offer was purchased.

Date: 2026-08-13

Scope: compare the strongest code and documentation candidates already deployed
in the worked instance against `gpt-5.6-terra`, and retain Claude Sonnet 5 as an
informational comparison only. This spike extends [SPIKE-15](./SPIKE-15-niche-reviewer-models)
with current limits, API differences, live billed rates, and a controlled
evaluation design.

## Decision boundary

Claude is **not approved for deployment** in this instance. It is included only
so its token limits, API shape, and pricing do not have to be researched again.
Do not add Claude to the deployment registry, accept an Anthropic Marketplace
offer, create an Anthropic resource, or deploy a Claude model on the strength of
this document.

The deployed-model registry remains the authority for deployment state. This
spike records research evidence and candidate priority, not deployment intent.

## Bottom line

No published specification proves that any candidate writes documentation or
code as well as the GPT baseline for this repository. Model cards establish
capability, not quality on the repository's actual Bicep, PowerShell, TypeScript,
and Markdown work.

The evidence supports this test order:

1. `Kimi-K2.7-Code`, because it is explicitly coding-focused and already
   deployed.
2. `DeepSeek-V4-Pro`, because Microsoft describes the family as strong in coding
   and reasoning, it has a 1 million token input limit, and prompt-cache hits are
   inexpensive.
3. `Mistral-Large-3`, because it is a low-cost general-purpose multimodal model
   with tool calling and a 256K combined context window.
4. `grok-4.3`, because Microsoft names coding and summarization among the xAI
   family's enterprise uses, but this model is preview and has only 8,192 output
   tokens.
5. `Llama-4-Maverick-17B`, because it is extremely inexpensive and has long
   context, but the Azure model card documents no tool calling and makes no
   code-specialization claim.

`gpt-5.6-terra` remains the baseline until a controlled comparison shows a
candidate meeting the same correctness bar at lower cost. Claude Sonnet 5 is not
in the test order because it is not approved for this deployment.

## Deployed candidates and published limits

The lifecycle and East US deployment types below were re-read from the live
Azure catalog on 2026-08-13. Token limits come from the current Microsoft model
pages unless a row says otherwise.

| Candidate | Instance state | Lifecycle | Input and output limits | Vision | Tools and structured output | API consequence |
|---|---|---|---|---|---|---|
| `gpt-5.6-terra` | Deployed | GA, version `2026-07-09` | 1,050,000 total: 922,000 input plus 128,000 output | Yes | Tools, parallel tools, structured output, computer use | Chat Completions and Responses APIs. The live deployment rejects `max_tokens`; callers use `max_completion_tokens`. |
| `Kimi-K2.7-Code` | Deployed | Preview, version `2026-06-12` | 262,144 input; 262,144 output | Yes | Tool calling; text response | Chat Completions with reasoning content. Preview lifecycle is a production risk. |
| `DeepSeek-V4-Pro` | Deployed | GA in the current East US catalog, version `2026-04-23` | 1,000,000 input; 384,000 output | No | No tool calling; text or JSON response | Chat Completions with reasoning content. Its lack of tool calling limits agentic use, but not a single-pass review. |
| `Mistral-Large-3` | Deployed | GA in the current East US catalog, version `1` | Azure does not publish separate limits; Mistral publishes a 256K combined context window | Yes | Tool calling; text or JSON response | Chat Completions. The live deployment accepts `max_tokens` and rejects `max_completion_tokens`. |
| `grok-4.3` | Deployed | Preview, version `1` | 200,000 input; 8,192 output | No | Tool calling; text response | Chat Completions. The short output ceiling is the main repository-wide editing constraint. |
| `Llama-4-Maverick-17B-128E-Instruct-FP8` | Deployed | GA, version `1` | 1,000,000 input; Microsoft also lists 1,000,000 output | Yes | Azure's sold-by-Azure page says no tool calling; text response | Chat Completions. Treat the unusually large published output value as a model-card limit, not a recommendation to request it. |
| `claude-sonnet-5` | **Not deployed; not approved** | GA in the live Foundry catalog | 1,000,000 input; 128,000 output | Yes | Advanced tool use, computer use, adaptive thinking | Anthropic Messages API at `/anthropic/v1/messages`, not the OpenAI Chat Completions contract. REST calls require the `anthropic-version` header. |

Two documentation differences are intentional:

- Microsoft Learn currently labels `Mistral-Large-3` Preview, while the live
  East US Azure catalog reports `GenerallyAvailable`. The live catalog controls
  what can be deployed in the subscription; the disagreement remains a lifecycle
  documentation risk.
- Mistral's 256K figure is a combined context window. It is not interchangeable
  with pages that publish separate maximum input and output values.

## Price comparison

### Already-deployed models

These are effective Global Standard rates observed in the instance's Azure Cost
Management ActualCost meters for 2026-08-01 through 2026-08-13. They are
normalized to USD per 1 million tokens. This is stronger evidence for this
subscription than a pricing widget, but it is still a dated rate card. A future
offer, discount, region, or deployment type can change it.

| Candidate | Input per 1M | Cached input per 1M | Output per 1M | Price evidence |
|---|---:|---:|---:|---|
| `gpt-5.6-terra` | $2.00 | Not observed | $12.00 | Live billed input and output meters |
| `Kimi-K2.7-Code` | $0.95 | $0.19 | $4.00 | Live billed input, cached-input, and output meters |
| `DeepSeek-V4-Pro` | $1.74 | $0.145 | $3.48 | Live billed input, cached-input, and output meters |
| `Mistral-Large-3` | $0.50 | No separate meter observed | $1.50 | Live billed input and output meters |
| `grok-4.3` | $1.25 | No separate meter observed | $2.50 | Live billed input and output meters |
| `Llama-4-Maverick-17B` | $0.25 | No separate meter observed | $1.00 | Live billed input and output meters |

"Not observed" does not mean free or unsupported. It means the current Cost
Management snapshot contained no meter row from which this spike could prove a
rate.

### Claude Sonnet 5, informational only

Anthropic publishes the following standard Sonnet 5 rates, which Microsoft says
are used to convert Foundry token usage into Claude Consumption Units:

| Billing item | Published rate |
|---|---:|
| Base input | $2.00 per 1M tokens |
| Five-minute cache write | $2.50 per 1M tokens |
| One-hour cache write | $4.00 per 1M tokens |
| Cache hit or refresh | $0.20 per 1M tokens |
| Output | $10.00 per 1M tokens |

Foundry reports Claude charges through Azure Marketplace as CCU, at $0.01 per
CCU. One hundred CCU therefore represents $1.00 after any private-offer discount.
Azure Cost Management shows an aggregated CCU line, while per-model token detail
stays in Foundry. A US Data Zone deployment carries Anthropic's documented 1.1x
data-residency multiplier.

For this instance, those charges would go to the payment method rather than the
sponsorship credit balance. That billing boundary is one reason Claude remains
comparison-only.

## Published fit is not measured quality

| Candidate | What the publishers establish | What is still unproven here |
|---|---|---|
| `gpt-5.6-terra` | Long context, reasoning, vision, tools, structured output, and computer use | Baseline score on the fixed repository test set |
| `Kimi-K2.7-Code` | Coding-focused, multimodal, agentic model | Correctness on Bicep and PowerShell; documentation style; preview stability |
| `DeepSeek-V4-Pro` | Reasoning family aimed at language, scientific reasoning, and coding | Repository editing without tool calling; review precision; instruction adherence |
| `Mistral-Large-3` | General-purpose multimodal model with tool calling and JSON output | Whether general-purpose quality matches code-specialized models |
| `grok-4.3` | xAI family targets coding, extraction, summarization, and agentic applications | Whether the 8,192 output cap is enough for multi-file work; preview stability |
| `Llama-4-Maverick-17B` | Long-context general multimodal instruction model | Code specialization, tool-driven editing, and documentation quality |
| `claude-sonnet-5` | Anthropic and Microsoft position it for coding, long-running agents, and reasoning over entire codebases | Everything in this deployment. It will not be tested while it remains unapproved. |

The defensible conclusion today is therefore not "model X is as good as GPT."
It is "Kimi and DeepSeek are the first two deployed candidates worth measuring."

## Controlled comparison design

The reusable execution procedure, hard gates, cost envelope, and fillable result
record are in
[Evaluating code and documentation models](../guide/model-evaluation).

No comparison calls were made while writing this spike. If the owner authorizes
the paid comparison later, use the following fixed suite against already-deployed
models only:

| Fixture | Required result | Primary scoring signal |
|---|---|---|
| Documentation edit | Rewrite one real Markdown section under the repo's style and source rules | Factual accuracy, instruction adherence, clarity, and valid links |
| Code fix | Diagnose and patch one bounded defect | Tests pass, minimal diff, no regression |
| Test creation | Add tests for a bounded existing behavior | Defect coverage, determinism, and usefulness of assertions |
| Review | Review one fixed diff with seeded defects | True findings, missed defects, false positives, and severity accuracy |

Controls:

- Use identical prompts, input files, tool permissions, and output ceilings.
- Disable autonomous retries and stop after one correction turn.
- Record input, cached input, reasoning, and output tokens separately when the
  response and meters expose them.
- Record wall-clock latency, tests, score, and ActualCost for every run.
- Use `gpt-5.6-terra` as the baseline. Do not use `gpt-5.6-sol` for this test.
- Put a caller-side hard ceiling of $5 on the entire evaluation. Azure budgets
  and deployment capacity are not synchronous spend stops.
- Do not include Claude unless the owner reverses the explicit deployment
  decision and separately approves the Marketplace billing relationship.

Suggested weighted score:

| Dimension | Weight |
|---|---:|
| Correctness and completeness | 35% |
| Tests and executable verification | 25% |
| Instruction and repository-style adherence | 15% |
| Review precision and recall | 15% |
| Actual cost | 5% |
| Latency | 5% |

A candidate earns a role only if it clears the task-specific correctness gate.
Low price cannot compensate for incorrect code or invented documentation.

## Recommendation

1. Keep `gpt-5.6-terra` as the baseline, not as an assumed permanent winner.
2. Evaluate `Kimi-K2.7-Code` and `DeepSeek-V4-Pro` first when a paid bakeoff is
   approved.
3. Add `Mistral-Large-3` only if a general-purpose, tool-capable candidate is
   needed after the first pair.
4. Use `grok-4.3` and Llama as lower-priority cost or diversity arms, not as
   presumed replacements.
5. Keep Claude Sonnet 5 documented but outside the registry, deployment plan,
   and evaluation suite.
6. After measurements, select models by role: documentation writer, code
   implementer, reviewer, and inexpensive routine worker. Do not force one model
   to win every category.

## Sources

Reviewed 2026-08-13:

- [Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure), Microsoft model limits, capabilities, and lifecycle labels.
- [Region availability for Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability), deployment-type availability.
- [Claude models in Microsoft Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/claude-models), Claude limits, API shape, and hosting state.
- [Claude CCU billing in Microsoft Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/claude-models-billing), CCU conversion and cost visibility.
- [Compare Claude hosting options](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/claude-models-hosting-comparison), hosting and subscription restrictions.
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing), Sonnet 5 token, cache, CCU, and data-residency rates.
- [Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5), vendor capability positioning.
- [Mistral Large 3](https://docs.mistral.ai/models/mistral-large-3-25-12), 256K combined context and general-purpose positioning.
- [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs), token metering and Cost Management behavior.
- [SPIKE-10](./SPIKE-10-latest-gpt-model), GPT baseline research.
- [SPIKE-11](./SPIKE-11-newer-grok-model), Grok research.
- [SPIKE-15](./SPIKE-15-niche-reviewer-models), candidate discovery and role separation.
- [SPIKE-32](./SPIKE-32-model-region-availability-matrix), generated live catalog and regional availability method.
