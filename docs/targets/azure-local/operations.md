# Operations: Azure Local Foundry

::: info Scope
This is the operations page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Drift detection is split three ways, because `what-if` sees only the middle of the three layers.
- More than sixty standard Azure Local infrastructure metrics are available at no extra cost.
- Managed Prometheus is deliberately deferred until a Prometheus-capable workload exists.
- Upgrade ordering carries the same load-bearing constraint as the install.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-27**, the local-track observability spike
- **SPIKE-29**, the local-track lifecycle and upgrade spike
- **ADR-0022**, the local-track observability boundaries ADR
- **ADR-0024**, the local-track lifecycle ADR
