# Architecture: Azure Local Foundry

::: info Scope
This is the architecture page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Three layers. Kubernetes and Helm prerequisites underneath, an ARM platform layer of exactly two cluster extensions in the middle, and Kubernetes intent on top.
- Bicep owns the middle layer only. An ordering wrapper owns the sequence, and ADR-0014 calls that wrapper a first-class deliverable rather than glue.
- Istio is adopted as a Gateway API provider only, not as a service mesh.
- Bicep for the AKS Arc cluster itself is provisional pending a `what-if` test, because every current first-party example uses `az aksarc`.

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [ADR-0014](../../adr/ADR-0014-foundry-local-azure-local-deployment-layers), the governing decision **(Status: Proposed, awaiting approval)**

### Still genuinely open

- **SPIKE-30**, the AKS Arc Bicep feasibility spike
