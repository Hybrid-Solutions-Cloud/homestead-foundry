# Models: Azure Local Foundry

::: tip Compare this target against the other two
[The model availability matrix](../../reference/model-matrix) puts every model on all three targets side by side, including the vLLM entries that are exclusive to this one.

[Hardware requirements and sizing](../hardware-sizing#azure-local-foundry-hardware)
maps the CPU and vLLM model classes on this page to worker, GPU, storage, and
replica profiles.
:::


::: info Scope
This is the models page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- The Foundry Local catalog, deployed as `ModelDeployment` custom resources. None of this repository's cloud roster runs here.
- Two inference engines: ONNX-GenAI and vLLM.
- The first increment is a CPU-only text reviewer in the `Phi-4-mini-instruct-generic-cpu` class.
- Resources must be set explicitly on every model. The CRD defaults of 256Mi request and 1Gi limit cannot run a 4.8 GB model.

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [SPIKE-22](../../research/SPIKE-22-foundry-local-model-catalog), the Foundry Local model catalog spike
- [ADR-0019](../../adr/ADR-0019-on-premises-model-rosters), the per-target model roster ADR **(Status: Proposed, awaiting approval)**
