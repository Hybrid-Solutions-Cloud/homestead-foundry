# ADR-0016: Use native Foundry metrics for model usage observability

- Status: Accepted
- Date: 2026-07-27
- Decider: Homestead Foundry owner

## Context

Operators need to answer which model deployment was used, when it was used, how many
requests it handled, how many tokens it consumed, and whether it was available,
throttled, or returning server errors. The shared subscription has a constrained cost
envelope and must not collect prompt, response, or trace data merely to answer these
questions.

The target `Microsoft.CognitiveServices/accounts` resource exposes Azure Monitor metrics
for model requests, input tokens, output tokens, total tokens, availability, latency,
and request status dimensions. These platform metrics are automatically available and
do not require a diagnostic setting or Log Analytics ingestion.

## Decision

The Foundry core profile uses native Azure Monitor metrics as the default model-use data
plane. The source-controlled native Grafana dashboard reads those metrics by model
deployment. It shows request, input-token, output-token, total-token, availability,
throttle, and server-error trends.

The private overlay replaces only dashboard placeholders for subscription, resource
group, Foundry account, and region. It also enables bounded metric alerts for sustained
availability degradation, throttling, and server errors. Exact thresholds, scopes, and
recipient addresses remain private parameters.

The deployment enables the `Audit` diagnostic category only for control-plane evidence.
It does not route platform metrics to Log Analytics. It keeps `RequestResponse`, `Trace`,
and `AzureOpenAIRequestUsage` disabled until a separate data-governance and cost decision
approves them.

## Options considered

### Option A: Native Azure Monitor metrics

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | No diagnostic ingestion for the model-use views |
| Scalability | Covers every emitted deployment dimension |
| Privacy | No prompt, response, or trace content |

**Pros:** Immediate model and token evidence; native alert support; no collection
configuration; works across the currently deployed supported model metrics.

**Cons:** It is not a prompt-level trace and it is not billing-authoritative currency
data.

### Option B: Export request usage, request response, and trace logs

| Dimension | Assessment |
|---|---|
| Complexity | Medium to high |
| Cost | Log export, ingestion, retention, and query costs |
| Scalability | Data volume scales with inference traffic |
| Privacy | May include sensitive request, response, tool, or trace content |

**Pros:** Rich request-level investigation where the category supports it.

**Cons:** Higher recurring cost and governance obligations. Request usage is not a
uniform substitute for platform metrics across all deployed model types.

### Option C: Application Insights tracing only

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Telemetry ingestion and retention apply |
| Scalability | Requires application instrumentation |
| Privacy | Application code can capture customer content unless designed otherwise |

**Pros:** End-to-end application, agent, tool, and dependency correlation.

**Cons:** Does not observe every direct model consumer and has no safe default without
an approved application telemetry design.

## Consequences

- Operators can identify model deployment use, request volume, token consumption, and
  reliability trends in a no-ingestion dashboard.
- Cost Management remains the billing authority. It should be used for actual and
  forecast currency cost, while token counts are a timely model-use indicator.
- The design does not provide prompt-level troubleshooting. That remains a gated,
  workload-specific diagnostics or tracing decision.
- Model metrics are available only when the selected account and model type emit them.
  The deployment validation must verify each alert metric on the target account.

## Follow-ups

1. Deploy the versioned model-usage dashboard through the private overlay.
2. Validate metric panels against real account data and confirm action-group delivery.
3. Review alert noise after an operating baseline exists.
4. Create a separate ADR before enabling request, response, trace, or application
   telemetry collection.
