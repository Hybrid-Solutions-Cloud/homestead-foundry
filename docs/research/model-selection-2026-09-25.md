# Model quality and cost review: 2026-09-25

Use small models for routine work, mid-priced capable models for difficult
coding and infrastructure, and expensive models for escalations. These are
research-based evaluation candidates. No runtime roles changed in this review.

## Azure prices

Public USD retail per million tokens, East US global/Global Standard meters,
retrieved 2026-09-25 using the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices).
These are list prices, not deployment spend or negotiated invoice rates. The
comparison uses uncached input, short context and non-batch inference. Long
context, data zones and caching change rates. Selected raw meter records and
reproducible filters are retained in the private overlay.

| Model | Input USD/M | Output USD/M | Suggested place |
|---|---:|---:|---|
| GPT-6 Luna | 0.10 | 0.50 | Routine drafting, extraction and classification candidate |
| DeepSeek V4 Flash | 0.19 | 0.51 | Cheap reasoning and coding challenger |
| Grok 4.1 Fast | 0.20 | 0.50 | Existing fast route; retain for comparison |
| GPT-5.6 Luna | 0.20 | 1.20 | Current router's small tier |
| Codestral 2501 | 0.30 | 0.90 | Narrow code-completion evaluation |
| Mistral Large 3 | 0.50 | 1.50 | Low-cost general-purpose alternative |
| Kimi K2.7 Code | 0.95 | 4.00 | Keep coding default pending matched evaluation |
| Grok 4.3 | 1.25 | 2.50 | Another-vendor alternative |
| Mistral Medium 3.5 | 1.50 | 7.50 | Coding challenger, not default promotion |
| DeepSeek V4 Pro | 1.74 | 3.48 | Independent reasoning review |
| Grok 4.6 | 2.00 | 6.00 | Primary challenger for deep reasoning, coding and IaC |
| GPT-6 Sol | 2.00 | 10.00 | Difficult coding and IaC candidate |
| GPT-5.6 Terra | 2.00 | 12.00 | Current router's middle tier |
| GPT-5.6 Sol | 4.00 | 20.00 | Current deep role/router high tier |
| GPT-6 Astra | 10.00 | 50.00 | Difficult, consequential escalations |

For equal token counts, GPT-6 Sol costs one fifth of Astra and half of GPT-5.6
Sol. Actual savings depend on reasoning/output length, retries, caching and
accepted answers. Microsoft also publishes the [GPT-6 Azure price table](https://azure.microsoft.com/en-us/blog/gpt-6-astra-sol-and-luna-for-production-agents-in-microsoft-foundry/).

## Evidence

| Primary source | Result and implication | Limitation |
|---|---|---|
| [OpenAI guidance](https://developers.openai.com/api/docs/guides/latest-model) | Luna for repeatable work, Sol for demanding reasoning/coding, Astra for highest-capability work. Supports a tiered trial. | Vendor positioning, not a workload test on these repositories |
| [Kimi report](https://www.kimi.ai/resources/kimi-k2-7-code) | Kimi Code Bench v2 improves from K2.6's 50.9 to 62.0; MCPAtlas 76.0. Credible coding default to retain. | Vendor tests with differing harnesses/settings, not proof it beats GPT-6 |
| [DeepSeek model card](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash) | Flash Max: SWE Verified 79.0, Terminal Bench 2.0 56.9; Pro Max: 80.6 and 67.9. Flash merits a cheap coding trial; Pro merits review work. | Max reasoning uses more tokens; results do not transfer to V4.1 or July refreshes |
| [Grok 4.6 report](https://x.ai/news/grok-4-6) | CursorBench 3.2: 69.9 versus GPT-5.6 Sol's 67.2; DeepSWE 1.1: 65.9 versus 73.0. Results vary by task. | Vendor comparisons/settings; no direct proof of best documentation quality |
| [Mistral report](https://mistral.ai/news/vibe-remote-agents-mistral-medium-3-5/) | Medium 3.5 SWE-bench Verified 77.6 supports a coding trial. | Different harness/token budgets; not directly rankable against DeepSeek's table |

These are capability indicators, not a combined leaderboard. We did not find a
matched primary-source evaluation of all exact Azure snapshots on PowerShell,
Bicep and these documentation tasks. GPT-6's recent release limits operational
evidence. A universally best model is not established.

## Task recommendations

| Task | First choice to evaluate | Escalation or alternative |
|---|---|---|
| Simple summaries, formatting, routine documentation | GPT-6 Luna | DeepSeek V4 Flash or existing Grok 4.1 Fast |
| Self-contained code | Keep Kimi K2.7 Code | Trial DeepSeek V4 Flash for cheap tasks; GPT-6 Sol for harder work |
| PowerShell, Bicep, Terraform, architecture | Compare GPT-6 Sol and Grok 4.6 | Astra for unresolved hard tasks or added review |
| Complex documentation from multiple sources | GPT-6 Sol or retained Grok 4.6 | Compare factual correctness and reviewer editing time |
| Independent design review | Keep DeepSeek V4 Pro | Grok 4.6 for another vendor perspective |
| Adversarial review | Retain existing Grok reasoning route provisionally | Compare with Grok 4.6 before switching |
| Automatic selection | Keep explicit Balanced GPT-5.6 subset | Evaluate Cost mode separately; GPT-6 is not documented in this pool |

Grok 4.6 is a serious deep reasoning/coding candidate, not only a documentation
model. Its output rate is 40 percent below GPT-6 Sol at equal token counts. The
published comparisons above are against GPT-5.6 Sol, not GPT-6 Sol; they do not
establish which wins on our infrastructure work.

### Latest release versus deployed availability

Grok 4.20 reasoning and Grok 4.6 are separate generations. Grok 4.6 also reasons;
the missing suffix does not mean non-reasoning. Microsoft's
[Foundry guide](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-grok)
documents low/medium/high/xhigh effort for Chat Completions. The private
`adversary` and `docs` assignments are policy choices, not model limitations or
evidence that 4.20 is a better adversarial reviewer. Compare 4.6 for that role.

[Grok 4.7 launched September 21](https://x.ai/news/grok-4-7) and is newer than
4.6. The deployment snapshot here contains 4.6. A fresh account-scoped East US
Foundry catalog query on September 25 returned 4.6 but no 4.7. This is scoped
availability evidence, not a claim that 4.7 is unavailable everywhere. Recheck
the intended Azure account, SKU, quota and Azure rate before proposing a 4.7
deployment; direct-provider availability/pricing is not Azure availability/pricing.

Keep Phi-4 Reasoning, Llama 4 Maverick and the known-broken DeepSeek V4.1 alias
blocked in MCP pending compatibility checks. The other V4.1 deployment is not
automatically equivalent. This review did not verify a V4.1 Azure meter mapping;
do not apply V4 prices to it. Likewise, a Grok 4.2 meter label does not prove the
rate of every 4.20 deployment variant. Media, audio and embeddings require
modality-specific evaluation and are outside this chat-role ranking.

## Promotion criteria

### Proposed starting role map

For a concrete cost-aware starting configuration: `fast`, `cheap-bulk` and
routine `docs` use GPT-6 Luna; `code` stays Kimi K2.7 Code; `deep` and `adversary`
use Grok 4.6; `iac` uses GPT-6 Sol; `second-opinion` stays DeepSeek V4 Pro; `auto`
keeps the Balanced GPT-5.6 subset. Keep `fast` as the omitted-role default.
This is a proposal pending workload validation, not the running configuration.
Use explicit stronger-role calls for complex documentation. Astra is an
escalation option rather than a default. The current MCP does not implement
automatic quality-based escalation chains; callers make those decisions.

### Validate before promotion

Use fixed representative tasks, exact versions and equal acceptance criteria.
Measure accepted answers, syntax/tests, unsupported claims, reviewer editing
time, p50/p95 latency, billed input/output including reasoning, retries and cost
per accepted result. Start with a small capped evaluation. Record results before
changing roles.

Check API compatibility: OpenAI guidance requires Responses for Astra tool
calling, and for Sol/Luna reasoning with tools. The current MCP adapter delegates
text via Chat Completions without giving the model its caller's tools. Direct
agent integration needs separate compatibility checks; the gateway does not
translate APIs. Follow [model evaluation](../guide/model-evaluation) and
[router policy synchronization](../guide/model-router).
