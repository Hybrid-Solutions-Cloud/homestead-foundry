# Features: Azure Local (track 3)

::: info Scope
This is the features page for **Foundry Local on Azure Local**,
track 3 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Concurrent multi-user serving is the design point, unlike the single-host target.
- Agentic Retrieval is available, and it requires a GPU and the `gpt-oss-20b` class.
- Disconnected operation is supported via the Azure Local disconnected operations appliance, version `2604.3.0` or later.
- Entra ID authentication is unavailable on the Helm onboarding channel, which is why that channel is disqualified.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-31**, the cross-track feature parity spike
