# Architecture: Azure cloud (track 1)

::: info Scope
This is the architecture page for the **Azure cloud** target,
track 1 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
It is a map into the canonical documents, which are the source of truth. Compare
all three targets on the [Deployment targets hub](../).
:::

One shared Foundry account at subscription scope, in a single resource group, with CAF naming enforced by per-segment parameter constraints and a single `location` parameter threading through every module.

| Read this | For |
|---|---|
| [Architecture overview](../../design/architecture-overview) | The end-to-end design. |
| [Resource topology and CAF naming](../../design/resource-topology-and-caf-naming) | Exact names, topology, and the tag scheme. |
| [Performance efficiency](../../design/performance-efficiency) | Throughput and tier reasoning. |
| [ADR-0004](../../adr/ADR-0004-foundry-topology-and-region) | Why one shared account, and why this region. |
