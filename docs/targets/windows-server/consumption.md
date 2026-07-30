# Consumption: Windows Server (track 2)

::: info Scope
This is the consumption page for **Foundry Local on Windows Server**,
track 2 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- The service exposes an OpenAI-compatible endpoint on the local host, so any client with a configurable base URL can call it.
- There is no authentication on that endpoint. The security boundary is the machine.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-24**, the track 2 install test
- **SPIKE-31**, the cross-track feature parity spike
