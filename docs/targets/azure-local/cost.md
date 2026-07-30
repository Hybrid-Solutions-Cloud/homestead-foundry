# Cost: Azure Local Foundry

::: info Scope
This is the cost page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Fixed cost, billed per physical core of the Azure Local host per month, whether or not you infer.
- A Windows Server guest add-on applies per core and is reducible by Azure Hybrid Benefit.
- There is no per-token inference charge.
- The exact per-core figures are not yet confirmed from a rendered first-party page.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-26**, the local-track cost spike
- **ADR-0021**, the local-track cost governance ADR
