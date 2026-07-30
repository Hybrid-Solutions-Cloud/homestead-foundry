# Consumption: Azure Local (track 3)

::: info Scope
This is the consumption page for **Foundry Local on Azure Local**,
track 3 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Entra ID token authentication. There is no API key at all, which removes the secret entirely.
- Ingress is via the Gateway API. A real certificate-authority certificate is required; self-signed is not accepted.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-28**, the track 3 networking, storage, and certificates spike
- **SPIKE-31**, the cross-track feature parity spike
