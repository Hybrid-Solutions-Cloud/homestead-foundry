# Operations: Azure AI Foundry

> Current cloud update (2026-09-25): [model roster](../../reference/cloud-model-roster-2026-09-25), [router and MCP roles](../../guide/model-router), [gateway](../../guide/model-gateway), and [cost/quality research](../../research/model-selection-2026-09-25). Earlier dated examples are historical.

::: info Scope
This is the operations page for the **Azure AI Foundry** target,
the hosted-cloud target of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
It is a map into the canonical documents, which are the source of truth. Compare
all three targets on the [Deployment targets hub](../).
:::

A deployed observability package: Azure Monitor workspace, Log Analytics, Application Insights, managed Grafana, metric and activity-log and scheduled-query alerts, availability tests, and native Foundry model-usage metrics.

| Read this | For |
|---|---|
| [Reliability and operations](../../design/reliability-and-operations) | The Well-Architected reliability and operational-excellence controls. |
| [Observability architecture](../../design/observability-architecture) | The design of the observability package. |
| [Observability implementation](../../implementation/foundry-observability) | Package layout and deploy sequence. |
| [Observability operations](../../implementation/foundry-observability-operations) | The daily and weekly review cadence. |
| [ADR-0016](../../adr/ADR-0016-foundry-model-usage-observability) | Native Foundry metrics for model usage. |
