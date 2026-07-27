# ADR-0015: Cost-first observability boundaries

- Status: Proposed
- Date: 2026-07-27

## Context

The shared Foundry subscription has a limited monthly credit or budget and supports multiple personal projects. Existing resource-group budget alerts are useful but insufficient for tenant-level ownership, inventory, lifecycle, and shared-credit visibility. A new observability package must also be reusable by the public project and extend later to Foundry Local and Azure Local.

## Decision

1. Observability is a standalone subscription-scope Bicep package under `infra/observability/`, outside the core Foundry deployment.
2. The package creates a dedicated observability resource group, Log Analytics workspace, Azure Monitor Workspace, action group, subscription budget, and native Azure Monitor Grafana dashboard resource.
3. Azure Monitor dashboards with Grafana are selected. Azure Managed Grafana is excluded from the first release.
4. Platform metrics, Resource Graph, and Cost Management are the default signals. Diagnostic settings, Foundry tracing, Application Insights, Prometheus collection, and health models are disabled until their separate activation gates are met.
5. All package resources receive Owner, Project, Environment, CostCenter, ManagedBy, Lifecycle, and conditional ExpiresOn tags.
6. The existing core resource-group budget remains unchanged. The package adds a subscription-level notification budget only. Budget alerts do not act as a hard spend cap.
7. Azure Monitor health models are a non-production preview pilot only.

## Consequences

The initial footprint has minimal data-ingestion cost and is independently removable from the core workload. The Log Analytics and Azure Monitor Workspaces are present for future use but remain empty. The owner must approve any data-producing feature and the budget amount in the private deployment parameters. Deployment requires Bicep build, subscription what-if, and a current immediate confirmation before the Azure create operation.
