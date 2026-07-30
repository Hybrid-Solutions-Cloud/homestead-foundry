# Features: Foundry Local

::: info Scope
This is the features page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- An OpenAI-compatible local API, plus the `foundry` CLI and the Foundry Local SDKs.
- Whisper speech to text is available. Image generation and text to speech are not.
- Runs fully disconnected once the model cache is populated.
- No quotas and no rate limits. Capacity is bounded by the host.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-31**, the cross-track feature parity spike
