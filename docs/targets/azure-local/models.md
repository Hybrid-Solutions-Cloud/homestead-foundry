# Models: Azure Local Foundry

::: info Scope
This is the models page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- The Foundry Local catalog, deployed as `ModelDeployment` custom resources. None of this repository's cloud roster runs here.
- Two inference engines: ONNX-GenAI and vLLM.
- The first increment is a CPU-only text reviewer in the `Phi-4-mini-instruct-generic-cpu` class.
- Resources must be set explicitly on every model. The CRD defaults of 256Mi request and 1Gi limit cannot run a 4.8 GB model.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-22**, the Foundry Local model catalog spike
- **ADR-0019**, the per-target model roster ADR
