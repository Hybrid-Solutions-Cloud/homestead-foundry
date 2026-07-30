# Consumption: Foundry Local

::: info Scope
This is the consumption page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- The service exposes an OpenAI-compatible endpoint on the local host, so any client with a configurable base URL can call it.
- There is no authentication on that endpoint. The security boundary is the machine.

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [SPIKE-31](../../research/SPIKE-31-cross-track-feature-parity), the cross-track feature parity spike

### Still genuinely open

- **SPIKE-24**, the Foundry Local install test
