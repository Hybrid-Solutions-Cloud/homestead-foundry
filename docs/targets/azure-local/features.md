# Features: Azure Local Foundry

::: info Scope
This is the features page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Concurrent multi-user serving is the design point, unlike the single-host target.
- Agentic Retrieval is available, and it requires a GPU and the `gpt-oss-20b` class.
- Disconnected operation is supported via the Azure Local disconnected operations appliance, version `2604.3.0` or later.
- Entra ID authentication is unavailable on the Helm onboarding channel, which is why that channel is disqualified.
- **No content filter or responsible-AI guardrail is documented at all.** This is
  the governance-relevant gap: a workload moved here from Azure AI Foundry
  silently loses every control
  [ADR-0007](../../adr/ADR-0007-content-safety-and-responsible-ai) relies on.
- **Vision input is available here and nowhere else on premises:**
  `pixtral-12b-2409` and three `nemotron-nano-12b-v2-vl` variants, vLLM and GPU
  only ([SPIKE-22](../../research/SPIKE-22-foundry-local-model-catalog)).
- **No Foundry Agent Service, no MCP surface, no fine-tuning service, and no
  batch job API.** A custom model can be brought from an OCI registry via
  `spec.model.custom`. The one asynchronous primitive is the predictive server's
  queue, which returns `queue_depth` and `retry_after` when full.
- **No embeddings and no text to speech.** Structured outputs (`json_schema`) are
  not documented ([SPIKE-31](../../research/SPIKE-31-cross-track-feature-parity)).

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) carries the sourced answers for this target, including the
findings that corrected earlier claims on this page.

- **SPIKE-31**, the cross-track feature parity spike
