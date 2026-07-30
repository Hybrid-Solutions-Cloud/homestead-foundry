# Architecture: Azure Local (track 3)

::: info Scope
This is the architecture page for **Foundry Local on Azure Local**,
track 3 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Three layers. Kubernetes and Helm prerequisites underneath, an ARM platform layer of exactly two cluster extensions in the middle, and Kubernetes intent on top.
- Bicep owns the middle layer only. An ordering wrapper owns the sequence, and ADR-0014 calls that wrapper a first-class deliverable rather than glue.
- Istio is adopted as a Gateway API provider only, not as a service mesh.
- Bicep for the AKS Arc cluster itself is provisional pending a `what-if` test, because every current first-party example uses `az aksarc`.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- [ADR-0014](../../adr/ADR-0014-foundry-local-azure-local-deployment-layers), ADR-0014
- **SPIKE-30**, the AKS Arc Bicep feasibility spike
