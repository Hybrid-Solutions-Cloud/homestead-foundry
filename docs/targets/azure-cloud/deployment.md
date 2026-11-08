# Deployment: Azure AI Foundry

> Current cloud update (2026-11-07): [model roster](../../reference/cloud-model-roster-2026-11-07), [reliability and roster review](../../research/model-reliability-and-roster-review-2026-11-07), [router and MCP roles](../../guide/model-router), [gateway](../../guide/model-gateway), and [cost/quality research](../../research/model-selection-2026-09-25). Earlier dated examples are historical.

::: info Scope
This is the deployment page for the **Azure AI Foundry** target,
the hosted-cloud target of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
It is a map into the canonical documents, which are the source of truth. Compare
all three targets on the [Deployment targets hub](../).
:::

Parameterized Bicep at subscription scope, deployed and proven. The runbook below is the one a real running environment was built from, and it was executed rather than described.

| Read this | For |
|---|---|
| [Deployment guide](../../guide/deployment) | Empty subscription to verified environment. |
| [Implementation guide](../../implementation/implementation-guide) | The long-form manual reference. |
| [As-built record](../../implementation/as-built) | What was actually deployed, anonymized. |
| [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation) | Why declarative Bicep is the right automation form for this target. |
