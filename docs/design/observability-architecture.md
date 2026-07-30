# Foundry observability architecture

::: info Scope: Azure cloud (track 1)
This page describes the **Azure cloud** target, track 1 of
[ADR-0011](../adr/ADR-0011-multi-target-deployment-automation). Foundry Local on
Windows Server and Foundry Local on Azure Local differ from it in models,
features, identity, cost, and operations. Compare all three on
[Deployment targets](../targets/).
:::


## Decision

Homestead Foundry publishes a Foundry-specific observability package under
`infra/observability/`. It duplicates the relevant public Platform patterns but keeps
the scope to Azure AI Foundry operations. It remains a consumer of the Platform
tenant-wide package, not a competing tenant operations product.

## Operational questions

| Question | Azure-native evidence | Default cost posture |
|---|---|---|
| Is the shared subscription approaching the Foundry cost envelope? | Cost Management budget and actual or forecast notifications | Budget only |
| What Foundry accounts and projects exist, and who owns them? | Resource Graph queries and required tags | Metadata only |
| What changed or failed? | Activity Log alerts for deployment failure and high-risk operations | Activity Log signal, no broad export |
| Is Azure affecting the Foundry workload? | Service Health and Resource Health alerts | Narrow scopes and action group |
| Are models behaving normally? | Standard Foundry account and project metrics, targeted metric alerts | Metrics before logs |
| Which model was used, when, and how much? | `ModelDeploymentName` dimensions on request, token, availability, and status metrics | Native metrics, no diagnostic ingestion |
| Why did a request, application, or agent fail? | Selected diagnostics and Application Insights | Disabled until data and cost approval |
| Can operators respond consistently? | Action group, alert-processing rules, severity policy, and runbooks | Required for every enabled alert |

## Resource boundary

```text
Foundry core deployment
  owns: account, project, model deployments, networking, application resources

Foundry observability deployment
  owns: workspaces, action group, budget, dashboard, selected alerts, optional
        diagnostics and application telemetry controls

Private overlay
  owns: recipients, scopes, resource IDs, budget values, thresholds, retention,
        approved diagnostic categories, and dashboard definitions
```

The package never creates or changes a monitored Foundry resource. A Foundry diagnostic
setting is an explicit exception: it is an optional extension resource applied only to
the named existing account in the private overlay.

## Capability profiles

| Profile | Included | Activation gate |
|---|---|---|
| Foundation | Isolated observability resource group, Log Analytics workspace, Azure Monitor Workspace, action group, budget, dashboard shell, query library | Private parameter file and approved what-if |
| Foundry core | Foundation plus Activity Log alerts, Foundry metric alerts, alert processing, and dashboard definition | Reviewed Foundry scopes, metrics, thresholds, owner, severity, and runbook |
| Foundry diagnostics | Selected Foundry diagnostic categories, Application Insights, availability tests, scheduled query alerts | Classification, least-privilege RBAC, retention, sampling, data estimate, cost owner, and safe endpoint review |

## Foundry signal policy

| Signal | Use | Design rule |
|---|---|---|
| Foundry account metrics | Requests, availability, latency, errors, throttling, tokens, generated images, and safety signals | Select only metrics exposed by the deployed account and model type |
| Model-use dimensions | Model deployment, model name, model version, status code, and service tier where emitted | Use model deployment for dashboard series and retain Cost Management as the currency authority |
| Foundry project metrics | Agent runs, responses, tools, threads, tokens, and hosted-agent capacity | Treat preview metrics as advisory until production support is established |
| Activity Log | Deployment failure, control-plane changes, Service Health, Resource Health | Use narrow alert conditions and scopes before exporting activity data |
| Foundry resource logs | Audit, request usage, managed network, request or response categories | Enable one named category only after its operational question and data posture are approved |
| Application Insights tracing | Application or agent execution, dependencies, exceptions, latency | Prompts and outputs require explicit data governance; tracing is not enabled merely because a workspace exists |
| Availability tests | External health of a supported user-facing endpoint | Test only a safe, non-destructive endpoint with an explicit cost owner |

## Cost and privacy controls

1. Standard metrics and Resource Graph are the first observability data sources.
2. The Log Analytics workspace has parameterized retention and a daily quota, but a
   quota is a safety control rather than a billing guarantee.
3. Budget values and recipients are private parameter-file values, never Bicep literals.
4. Do not use all-log categories or capture request and response content by default.
5. Every diagnostics definition records its question, category, classification,
   retention, sampling, daily-volume estimate, monthly cost owner, and removal date.

The model-use dashboard and alerts use native Azure Monitor metrics. They do not need a
diagnostic setting. `Audit` diagnostics may be enabled for control-plane evidence, but
request, response, trace, and request-usage categories remain off unless their data and
cost gate is approved.

## Platform relationship and hybrid future

Platform owns generic policy, Cost Management reports and exports, tenant inventory,
Activity Log export, Azure Local collection, managed Prometheus, data collection rules,
and health-model pilots. Homestead can contribute Foundry requirements upstream, then
consume the resulting generic capability.

Foundry Local on Windows and Azure Local remain future consumers. Their Azure-connected
telemetry must be metadata-only and opt-in by default, with no prompt, response, secret,
or model-input capture. If an Arc-enabled Kubernetes workload is introduced, Platform's
hybrid extension supplies the reviewed Prometheus and data-collection pattern.
