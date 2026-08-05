# Models: Azure AI Foundry

::: tip Compare this target against the other two
[The model availability matrix](../../reference/model-matrix) puts every model on all three targets side by side, across every region, and marks what is not available where.
:::


::: info Scope
This is the models page for the **Azure AI Foundry** target,
the hosted-cloud target of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
It is a map into the canonical documents, which are the source of truth. Compare
all three targets on the [Deployment targets hub](../).
:::

A registry-driven roster. Every model deployment is generated from the model registry rather than hand-written, so adding or removing a model is a registry edit and a redeploy.

| Read this | For |
|---|---|
| [Model catalog](../../reference/model-catalog) | The living prose record of every model deployed, evaluated, or rejected. |
| [Model registry guide](../../guide/model-registry) | The machine-readable contract a consuming project resolves at runtime. |
| [ADR-0002](../../adr/ADR-0002-image-model-and-access) | Image-model selection methodology and access. |
| [ADR-0003](../../adr/ADR-0003-voice-model-and-voice-set) | Voice-model selection methodology and the voice set. |
