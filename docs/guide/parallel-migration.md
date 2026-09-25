# Parallel Foundry migration and Model Router

This guide describes the generation-based migration implementation in this
repository. Its presence does not certify a completed production cutover.
Deployment names, quota results, release state and verification evidence belong
in the consuming private overlay.

## Resource layout

`infra/migration/main.bicep` creates two regional resource groups, one Foundry
account and project per region, and an optional gateway in the primary region.
Regions, names, secret references and tags are parameters. Projects are children
of Foundry accounts; one project does not contain several Foundry accounts.
The template creates a new generation alongside the existing environment.

The gateway receives authenticated OpenAI-compatible requests and maps deployment
names to explicit backend accounts. Requests addressed to `model-router` reach
the account hosting Azure Model Router. Direct deployments remain selectable.
The MCP role `auto` is a client-side alias for that router deployment, not a
replacement for the gateway or an implicit default for all calls.

## Files and configuration

| Source | Responsibility |
|---|---|
| `infra/migration/main.bicep` | New regional foundation, projects and optional gateway |
| `scripts/Deploy-MigrationModels.ps1` | Manifest-driven model deployment with quota checks and result records |
| `gateway/foundry-proxy.mjs` | Gateway authentication, explicit routing and response forwarding |
| `gateway/telemetry.mjs` | Request metadata and provider-reported usage observation |
| `scripts/Build-OperationsDashboard.mjs` | Grafana definition generated from private resource configuration |
| `infra/observability/operations.bicep` | Additive dashboard, diagnostics, alerts and cost collectors |
| `infra/observability/product-budget.bicep` | Separate filtered product budget template |

Package `foundry-proxy.mjs`, `telemetry.mjs` and the private `routing.json` at the
deployment package root. Routing defines `backends`, `models`, `prefixes` and a
`defaultBackend`. Each backend defines an endpoint, credential environment-variable
name, region and generation. Secret values are supplied by the host, never by
the routing file or the source repository.

The gateway matches explicit path prefixes before JSON model names. Multipart
uploads and polling requests may have no JSON model field, so callers must use
the backend-specific path for the complete operation. An asynchronous job must
be polled on the backend that created it. The current gateway does not maintain
a response/job-to-backend lookup store; unprefixed follow-up requests use the
default backend. Check this behavior before moving asynchronous consumers.

## Deployment and cutover

1. Inventory existing deployment versions, SKUs, capacities, policies, clients,
   monitoring and quota. Preserve the inventory as the rollback baseline.
2. Generate private parameters and review the foundation what-if. Create the
   new accounts/projects without deleting or reducing existing allocations.
3. Run the model deployment script using the reviewed manifest and policy.
   Its results distinguish successful deployments from quota-blocked entries.
   During an approved overlap, explicit legacy routes can serve blocked models;
   reachable does not mean migrated. Remove those routes after full cutover.
4. Provision gateway secrets, publish the package and validate authentication,
   streaming, direct-model requests, router requests and backend-specific paths.
5. Deploy monitoring and validate actual records, queries and alert delivery.
   Infrastructure deployment success alone does not verify telemetry coverage.
6. Synchronize local and remote MCP policy, release the remote server, and update
   editor endpoints only after the new route passes end-to-end checks.
7. Exercise rollback and record cutover. Retain the old generation for the agreed
   observation interval unless the owner explicitly supersedes that plan with
   immediate retirement. Account deletion/purge removes that rollback option;
   record the decision and remove stale routes, secrets and monitoring scopes.

## Monitoring semantics

The dashboard includes native Foundry and gateway metrics for configured accounts,
latency, token usage, stop reasons, error codes, router
selection, service tiers, MCP traffic, non-chat API operations, actual cost and
monitoring freshness. Native panels include all configured accounts; the
generation/model filters apply to the detailed gateway panels. After retirement,
configure only active accounts. The completed-migration inventory table is not
part of the operational dashboard. Use two-column charts, compact cost summaries
and wide detail tables. See the [router](./model-router) and
[gateway](./model-gateway) guides for ongoing operation.

First-token timing measures the first streamed content, reasoning or tool-output
delta. Total duration measures the gateway request. Generation speed is an
estimate requiring streamed output and provider usage; reasoning-inclusive
counts can affect it. Non-streaming MCP requests do not supply first-token
timing. Cached/reasoning tokens are subsets, not additional tokens to add to
input/output totals. Coverage columns identify absent provider fields.

The gateway records metadata without retaining prompts or responses in logs.
Only provider error codes support guardrail classification; HTTP 400 alone does
not. Media creation/polling request duration is not media job completion time.
MCP console-log panels need the correct workspace and a released instrumented
server. Instrumented gateway panels need traffic through the new gateway.

Cost collectors take periodic resource-group snapshots. Shared platform groups
must be identified as shared costs; their total is not exclusively attributable
to Foundry. Verify pagination, table ingestion and month-boundary behavior before
treating cost panels as complete billing reports. The separate product budget
template must also be deployed and checked; dashboard deployment does not apply it.

## Validation and release state

Run the public safety scan before publication and the gateway telemetry tests
with `node --test gateway/telemetry.test.mjs`. Compile the Bicep and review the
private what-if. Record live smoke tests, dashboard queries, alerts, rollback,
and cutover separately. The private overlay pins a reviewed public revision;
developing files in adjacent checkouts is not a published dependency update.
