# Observability package

This is a standalone, subscription-scope Bicep package for the cost-first
observability foundation around an existing Foundry deployment. It does not
modify `infra/main.bicep`, the Foundry account, model deployments, or the
resource-group budget owned by the core template.

## What it provisions

- A dedicated CAF-named observability resource group.
- A Log Analytics workspace with 30-day retention and a configurable low daily
  cap. It receives no data until a separate, approved collection change.
- An Azure Monitor Workspace for future managed Prometheus use with Azure Arc
  and Azure Local. It has no data collection rule in this package.
- One action group and one subscription-level Cost Management budget.
- An optional native Azure Monitor dashboard with Grafana resource shell.

The dashboard resource is `Microsoft.Dashboard/dashboards`, not Azure Managed
Grafana. It adds no Grafana service charge. Dashboard definition content is
managed through the Azure Monitor Grafana experience after the resource exists.

## What it deliberately does not provision

- Azure Managed Grafana.
- Any diagnostic setting or `allLogs` collection.
- Application Insights or Foundry tracing.
- Managed Prometheus scraping, a data collection rule, or an Azure Arc
  extension.
- Azure Monitor health models, which remain preview and are a later pilot.

## Validate before deployment

```powershell
az bicep build --file infra/observability/main.bicep
az deployment sub what-if --location <deployment-region> --template-file infra/observability/main.bicep --parameters <private-params>.bicepparam
```

`what-if` is read-only. A real `az deployment sub create` requires the owner's
immediate confirmation after the what-if is reviewed.
