# Consumption: Azure cloud (track 1)

::: info Scope
This is the consumption page for the **Azure cloud** target,
track 1 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
It is a map into the canonical documents, which are the source of truth. Compare
all three targets on the [Deployment targets hub](../).
:::

Deploying the models is half the job. Azure exposes an OpenAI-compatible v1 API, so the deployment name goes in the `model` body field and any client with a configurable base URL works.

| Read this | For |
|---|---|
| [Using your deployment](../../guide/using-your-deployment) | First calls in curl, Python, PowerShell, JavaScript, and C#, plus a troubleshooting table. |
| [Connect your tools](../../guide/connect-your-tools) | Editor and client configuration. |
| [Building agents](../../guide/building-agents) | Agent frameworks on top of your own deployments. |
