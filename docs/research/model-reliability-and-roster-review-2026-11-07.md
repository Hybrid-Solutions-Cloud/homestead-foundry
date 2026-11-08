# Reliability and roster review: 2026-11-07

Why some deployed models seem not to respond, what is retiring, which models are worth adding, and whether there is a better way to run a multi-model Foundry estate. The measurements come from a live read-only audit of a 44-deployment, two-account estate. The claims about Azure behaviour come from Microsoft Learn and are linked. Anything that is inference rather than documented fact is labelled, and anything not yet verified is listed under [Open tests](#open-tests).

Prices are Azure Retail Prices API list prices in USD per million tokens, not spend.

## Summary

1. **The models are not broken. Long reasoning is meeting short timeouts.** Over a 30 day window, a reasoning model run at its default effort took a median of about 160 seconds per answer through a non-streaming client with a 210 second timeout. Close to half of its calls were abandoned at exactly 210 seconds. A non-reasoning-heavy model on the same path (DeepSeek V4 Pro) answered in a median of about 10 seconds with a 100 percent success rate.
2. **Foundry reasoning models send nothing until they finish thinking, even when streaming.** Microsoft documents this and recommends client timeouts of up to 29 minutes for reasoning models ([quotas and limits](https://learn.microsoft.com/azure/foundry/foundry-models/quotas-limits#setting-client-side-timeout)). App Service closes any request that is silent for about four minutes, and that limit cannot be raised ([App Service timeout](https://learn.microsoft.com/troubleshoot/azure/app-service/web-request-times-out-app-service#summary)).
3. **The fix is configuration and plumbing, not a new model.** Cap reasoning effort for interactive and non-streaming callers, stream upstream, send keep-alive bytes, retry on 429, and align the content filter.
4. **A month of drift and several retirements are due now.** See [Retirements](#retirements).
5. **Keep a thin custom gateway; do not replace it with API Management.** API Management sits behind the same four minute ceiling and costs far more than the gap it would close. See [A better way to manage it](#a-better-way-to-manage-it).

## What the telemetry shows

The gateway logs metadata only (no prompts or responses): requested model, status, duration, token counts, reasoning tokens, and whether the client cancelled. In 30 days of the hosted MCP path (non-streaming, 210 second client timeout):

| Model family | Calls that succeeded | Median duration | Pattern |
|---|---:|---:|---|
| Grok 4.7 | about 53 percent | about 162 s | Median reasoning tokens about 6,700 on a roughly 2,700 token prompt. Nearly all failures are client cancellations at 210 s. A handful are 429 `pd_decode_pushback`. |
| Grok 4.6 | about 42 percent | about 130 s | Same pattern. |
| GPT-6 Astra | about 83 percent | about 49 s | Cancellations only on the longest calls. |
| GPT-6 Sol | 100 percent | about 24 s | No failures. GPT-6.1 Sol also had no failures in a smaller sample. |
| DeepSeek V4 Pro | 100 percent | about 10 s | No reasoning tokens reported. |
| Kimi K2.7 Code | 100 percent | not reported | No failures. |

Two readings follow, and only the first is established:

- **Established:** the failures are the caller giving up, not Azure returning errors. Grok 4.7 defaults to `reasoning_effort: high` ([Grok on Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-grok#request-parameters)), and a high-effort answer can exceed any timeout shorter than a few minutes.
- **Verified:** DeepSeek V4 reports no reasoning tokens through this path because thinking is off unless `reasoning_effort` is sent. See [Why DeepSeek V4 can seem not capable](#why-deepseek-v4-can-seem-not-capable).

The telemetry covers only the hosted MCP consumer. Editor traffic did not appear in it, so the editor path is unmeasured here.

## Why a reasoning model looks dead

| Hop | Limit | Source |
|---|---|---|
| App Service front end | about 240 s with no response bytes, fixed | [Learn](https://learn.microsoft.com/troubleshoot/azure/app-service/web-request-times-out-app-service#summary) |
| API Management `forward-request` | default 300 s, values over 240 s "may not be honored" | [Learn](https://learn.microsoft.com/azure/api-management/forward-request-policy#attributes) |
| Container Apps default ingress | 240 s | [Learn](https://learn.microsoft.com/azure/container-apps/ingress-overview#protocol-types) |
| Foundry guidance for reasoning models | client timeout up to 29 minutes | [Learn](https://learn.microsoft.com/azure/foundry/foundry-models/quotas-limits#setting-client-side-timeout) |

Moving the proxy to another Azure host does not help, because every option sits behind roughly the same idle ceiling.

A second Grok failure was found by direct probing: Grok 4.7 rejects `stop` and `presence_penalty` with HTTP 400 `decode_bad_request`, and the error carries no `param` field, so a gateway that strips only when `param` is set passes the failure through. Any editor or tool that sends those fields to Grok fails every call. Grok 4.7 does accept `temperature`, `top_p`, `max_tokens`, `max_completion_tokens` and `reasoning_effort` (low, medium, high), and calls tools correctly. Streaming a reasoning model returned the first byte exactly when the answer started, so nothing is sent during reasoning.

On a moderate prompt Grok 4.7 answered in 11 to 17 seconds at every effort setting, so the long calls come from large agentic prompts, where reasoning scales with context. Lowering effort is a ceiling on worst-case time, not a guarantee of speed.

Three further documented behaviours compound it:

- **429 handling.** Rate limiting counts the prompt plus `max_tokens` at admission, checks requests per minute over 1 or 10 second windows, counts rejected requests, and can lower a Standard deployment's effective limit under load. Use `retry-after-ms` with backoff and jitter ([429 explainer](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/concepts/azure-openai-429-token-rate-limit#why-you-get-a-429-below-your-quota)). A gateway that does not retry turns every 429 into a failed turn.
- **Guardrail mismatch.** The default guardrail (`Microsoft.DefaultV2`) runs prompt-injection detection on prompts and protected-material detection on completions ([default policies](https://learn.microsoft.com/azure/foundry/guardrails/default-safety-policies#defaultv2-settings)). Agentic coding prompts full of tool output are a plausible false-positive source. A blocked prompt is HTTP 400, and a proxy that treats every 400 as an unsupported parameter will strip fields and retry into a second 400. Use one tuned guardrail on every chat deployment and never retry a `content_filter` 400.
- **Quota per capacity unit.** For Grok 4.7 one capacity unit is 1,000 tokens per minute and 1 request per minute ([Grok 4.7 quotas](https://learn.microsoft.com/azure/foundry/foundry-models/quotas-limits#grok-47-quotas)). A 250 or 375 capacity DeepSeek Flash deployment has a 250K or 375K token-per-minute budget against a 1M token context, so one large agentic turn can exhaust a minute.

## Why DeepSeek V4 can seem not capable

**Verified by direct calls on 2026-11-07:** DeepSeek V4 Pro and V4.1 Flash run with thinking **off** by default. The same moderately hard prompt produced about 410 output tokens and no `reasoning_content` by default. With `reasoning_effort: "high"` or `"max"` it produced 1,550 to 2,630 tokens and returned `message.reasoning_content`, in 11 to 18 seconds. A `thinking` body field is rejected with HTTP 400 (`unrecognized_request_argument`), so `reasoning_effort` is the switch on Foundry. A client that never sends it gets a fast, shallow model.

What works, also verified:

- **Tool calling**, including two parallel tool calls in one turn, on both models.
- **Two-turn tool flows** succeed with and without echoing `reasoning_content` back, so no gateway workaround is needed on Foundry (DeepSeek's own API differs).
- **No inline `<think>` tags**: reasoning arrives in `reasoning_content`.
- `temperature`, `stop` and `max_tokens` are accepted.

Remaining weak spots: the Flash deployments are small (250 and 375 capacity) against a 1M token window, so one large agentic turn can exhaust a minute of quota, and system prompts are followed less strictly by reasoning models. Set `reasoning_effort` high in the client or a gateway profile, and size the editor's input and output limits to the quota.

## Retirements

Dates are the `deprecation` value from the Azure model catalog API on 2026-11-07, cross-checked against the [retirement schedule](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule). Sorted by urgency.

| Deployed model | Date | Successor already deployed | Action |
|---|---|---|---|
| Sora 2 | 2026-11-02, past | None | Deployment is `Disabled`. Delete it. No replacement is named. |
| MAI-Image-2.5, 2.5-Flash, 2.5-Pro | 2026-11-22 | MAI-Image-2.6 and 2.6-Flash | Move references to 2.6. There is no 2.6-Pro. 2.6 allows about 1536 by 1536 pixels (2.5: 1024 by 1024) and has three times the request rate per tier. |
| Mistral Medium 2505 | 2026-12-09 | Mistral Medium 3.5 | Delete 2505. |
| DeepSeek V4.1 Flash (2026-09-10) | 2026-12-15, Preview | DeepSeek V4.1 Flash 1017 exists in the catalog (Preview, retires 2027-03-06) | Decide between the Preview successor and the GA V4 Flash and V4 Pro (retire 2028-02-20). |
| Llama 4 Maverick | docs: 2026-11-19; catalog: none | None | The documented date and the catalog disagree. Plan removal. |
| Whisper | docs: 2026-12-15; catalog: 2027-02-26 | `gpt-transcribe` | Move transcription to `gpt-transcribe`. |
| Mistral Document AI 2512 | Legacy 2026-11-06 | Mistral OCR 4.0 | Move traffic, then delete. |
| Codestral 2501 | 2027-02-15 (docs) | None named | Plan a move to a general coding model. |
| Phi-4 reasoning | 2027-01-17 (docs) | Managed Compute only | Delete rather than migrate. |
| FLUX 1.1 pro and Kontext pro | 2027-01-05 (docs) | None named | Plan. |
| FLUX.2 pro and flex | 2027-01-20 (docs) | None named | Plan. |
| Kimi K2.7 Code | 2027-04-16 | Kimi K3.1 Pro (new) | Evaluate. |
| Grok 4.20 | 2027-04-06 | Grok 4.7 | No action. |

### Catalog and docs disagree

Microsoft's retirement page and the catalog API disagree for Llama 4 Maverick, Whisper and the MAI-Image-2.5 family. The catalog API is what Azure enforces for a deployed version, so use it for planning, and use the earlier of the two dates for anything you cannot afford to lose. Re-query before acting.

## Drift since the last audit

A month after the previous snapshot, three deployments differ from the record: Grok 4.7 now uses the tuned guardrail and a doubled capacity, the router's capacity is ten times higher, and Sora 2 is disabled. Grok 4.7 and two other deployments still allow automatic upgrade to a newer default version, while the other deployments are pinned. Decide per model whether you want pinning, and record it.

## What is new in the catalog

Newer than the previous audit, or newly deployable:

| Model | Version | Status | Notes |
|---|---|---|---|
| `gpt-6.1-terra` | 2026-10-26 | GA | 1.05M context, reasoning, Responses API, computer use. About half the price of GPT-5.6 Terra at $1.00 input and $5.00 output. Catalog lists it in East US only. Not in the router pool. |
| Kimi K3.1 Pro | 2026-11-04 | GA | 1M context, image input, tool calling, reasoning. Supersedes Kimi K2.7 Code. Price not yet published. Available in both estate regions in the catalog. |
| DeepSeek V4.1 Flash 1017 | 2026-10-17 | Preview | Newer than the deployed V4.1 Flash. |
| Claude Opus 5.5, Sonnet 5.5, Haiku 5.5 | 1 and 2 | GA | Version 1 is Anthropic-hosted, version 2 is Azure-hosted. Native Messages API only. Claude cannot be bought on credit-only or sponsored subscriptions ([Claude on Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/claude-models)). |
| MAI-Voice-2.1 and 2.1-Flash | n/a | Preview | The MAI-Voice page now lists only these. Voices chosen on MAI-Voice-2 may not carry over, so test each voice before a batch run. |

Worth adding, in order of value: `gpt-6.1-terra` (replaces GPT-5.6 Terra at roughly half the cost), Claude Haiku 5.5 as a second-vendor bulk model ($0.10 input and $0.50 output up to 100K tokens), Claude Sonnet 5.5 for agentic coding ($2 and $10), and Kimi K3.1 Pro once it has a price. Skip MAI-Thinking-1 (Preview, 256K context, costs more than GPT-6.1 Sol on output-heavy work).

## Model Router

- No new router version exists. `2025-11-18` is updated in place and retires 2027-05-20.
- The routing pool now includes Grok 4.6, Grok 4.1 Fast, GPT-6 Astra, DeepSeek V3.2, several Claude models and three Fireworks models. It does **not** include Grok 4.7, GPT-6 Luna or Sol, GPT-6.1, DeepSeek V4 or V4.1, or the 5.5 Claude tier. So the router cannot reach most of a newer roster ([router concepts](https://learn.microsoft.com/azure/foundry/openai/concepts/model-router)).
- Documented features: automatic failover (a custom subset of at least two models doubles as the fallback set), session affinity (preview), and `reasoning_effort` pass-through.
- Treat the router as one optional `auto` entry, not the backbone.

## A better way to manage it

| Option | Fixes the four minute wall | Retry and failover | Per-model parameters | Monthly cost change | Verdict |
|---|---|---|---|---|---|
| Hardened thin gateway, editors connect straight to Foundry | Yes for editors (no proxy in the path); in the gateway via streaming and keep-alive | Built in code | Yes | about $0 to $5 | **Recommended** |
| API Management AI gateway | No | Backend pools, circuit breaker, retry | Policy XML | about +$150 or more | Defer. Worth it for several users or teams. |
| AI Gateway in Foundry (preview) | No | As API Management | Limited | Pricing not published | Revisit at GA. |
| Foundry model router | Not applicable | Built-in failover | Not applicable | Router fee plus model | One optional entry. |
| LiteLLM on Container Apps | No (same ingress) | Yes | `drop_params` | Compute | Alternative if you prefer off the shelf. |

Target shape:

```text
Editor (interactive, streaming, tools)
   -> straight to each Foundry account's /openai/v1 endpoint, one provider group per account
Hosted MCP server and scripts (programmatic)
   -> thin gateway: model-to-account routing, per-model parameter profiles
        upstream always streaming; SSE keep-alive comments every 15 s while waiting
        non-streaming callers: cap reasoning effort and total time below the caller timeout
        429 and 5xx: honour retry-after-ms, backoff with jitter, then a fallback chain
        400 content_filter: never retry
        DeepSeek: normalise <think> content, echo reasoning_content on tool turns if required
        Entra managed identity to Foundry instead of the account key
Governance: Azure Monitor alerts on 429 and 400 rate, one tuned guardrail on every chat deployment,
            pinned versions, and a small evaluation set before any model is added.
```

Why keep a gateway at all: a single Foundry resource is limited to 32 deployments, so a larger roster needs two accounts, and something must route a model name to the right account and shape its parameters. Neither API Management nor the router does that without equivalent custom work.

Also available at no gateway cost: Foundry's Azure Monitor metrics (`ModelRequests` by status code and deployment, `TimeToResponse`, `NormalizedTimeToFirstToken`, router fallback counts) and the model leaderboards for choosing between candidates. The Foundry MCP server (preview) exposes deployments, quota and deprecation checks to an editor, but has no SLA and a changing tool set, so use it as a console, not a dependency.

Deployment-level levers: a Data Zone Standard deployment of the same model draws on a separate quota pool, and Global Standard deployments of the same model share one pool across regions, so spreading across two regions alone adds no quota. Provisioned throughput is not justified at personal scale.

## Open tests

Verified on 2026-11-07 and removed from this list: Grok 4.7 parameter acceptance (`stop` and `presence_penalty` rejected), DeepSeek tool calling, `reasoning_content` handling, inline `<think>` (absent), the DeepSeek thinking switch (`reasoning_effort`), and time to first byte when streaming (no bytes during reasoning).

Still unverified. Each needs one direct call to the Foundry endpoint, not through the gateway.

1. Grok 4.7 time to answer at each effort on a large (80K to 150K token) agentic prompt, which is where the long calls occur.
2. Requests and tokens per capacity unit for DeepSeek V4 and the other Grok deployments (read `properties.rateLimits`).
3. Whether the asynchronous content filter takes effect on xAI and DeepSeek deployments.
4. Whether Responses `background: true` works for Grok 4.7, which would be the clean fix for non-streaming callers.
5. Where the editor's `temperature: 0.1` comes from.

## Sources

Microsoft Learn pages were retrieved on 2026-11-07. Live catalog, deployment and telemetry figures are from read-only Azure Resource Manager and Application Insights queries on the same day.

- [Grok on Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-grok)
- [Foundry quotas and limits](https://learn.microsoft.com/azure/foundry/foundry-models/quotas-limits)
- [Models sold directly by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure)
- [Model retirement schedule](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule)
- [Reasoning models on Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-chat-reasoning)
- [Default safety policies](https://learn.microsoft.com/azure/foundry/guardrails/default-safety-policies)
- [App Service request timeout](https://learn.microsoft.com/troubleshoot/azure/app-service/web-request-times-out-app-service)
- [API Management AI gateway capabilities](https://learn.microsoft.com/azure/api-management/genai-gateway-capabilities)
- [Model router concepts](https://learn.microsoft.com/azure/foundry/openai/concepts/model-router)
- [Monitor Foundry models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/monitor-models)
- [Claude on Foundry](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/claude-models)
- [VS Code custom endpoint models](https://code.visualstudio.com/docs/agent-customization/language-models)
- [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode)
