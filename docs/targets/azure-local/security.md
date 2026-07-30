# Security and identity: Azure Local Foundry

::: info Scope
This is the security and identity page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Entra ID token authentication on the endpoint, with full Azure RBAC, policy, and cost visibility through Arc.
- This target requires no exception to ADR-0005.
- A real certificate-authority TLS certificate is required for the ingress path.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-28**, the Azure Local Foundry networking, storage, and certificates spike
- **ADR-0023**, the Azure Local Foundry networking ADR
