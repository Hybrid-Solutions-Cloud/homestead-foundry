# Features: Foundry Local

::: info Scope
This is the features page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- An OpenAI-compatible local API, plus the `foundry` CLI and the Foundry Local SDKs.
- Whisper speech to text is available. Image generation and text to speech are not.
- Runs fully disconnected once the model cache is populated.
- No quotas and no rate limits. Capacity is bounded by the host.
- **No content filter or responsible-AI guardrail is documented at all.** This is
  the governance-relevant gap: a workload moved here from Azure AI Foundry
  silently loses every control
  [ADR-0007](../../adr/ADR-0007-content-safety-and-responsible-ai) relies on.
- **No Foundry Agent Service and no MCP surface.** Tool calling works at the API
  level, so a bring-your-own-runtime agent loop can orchestrate its own tools.
- **No fine-tuning service and no batch API.** Microsoft states plainly that
  continuous batching is a capability Foundry Local does not provide. Olive can
  convert and optimize a model, and a model fine-tuned elsewhere can be brought
  here ([SPIKE-31](../../research/SPIKE-31-cross-track-feature-parity)).
- **No vision input and no embeddings.** Structured outputs (`json_schema`) are
  not documented on chat completions.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) carries the sourced answers for this target, including the
findings that corrected earlier claims on this page.

- **SPIKE-31**, the cross-track feature parity spike
