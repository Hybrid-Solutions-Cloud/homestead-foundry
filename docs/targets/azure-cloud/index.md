# Azure cloud (track 1)

::: info Scope
**Azure AI Foundry (AIServices)**, running in a Microsoft Azure region. Track 1
of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation). Compare all
three targets on the [Deployment targets hub](../).
:::

This is the target this repository has actually deployed. The environment
described in the [as-built record](../../implementation/as-built) was built from
the Bicep in `infra/`, and the control plane plus all three data-plane paths were
verified with real calls rather than described.

It is also the only one of the three that generates images or synthesizes speech,
and the only one with access to proprietary frontier reasoning models.

## The pages on this site are the source of truth

The nine pages in this section are maps, not copies. Track 1 is documented in
full under Guide, Architecture, Models, and Implementation, and those documents
stay canonical. These pages exist so the three-way comparison has somewhere
symmetric to point.

| Topic | This target | Canonical documents |
|---|---|---|
| [Architecture](./architecture) | One shared Foundry account, subscription-scope Bicep, CAF naming | [Design section](../../design/architecture-overview) |
| [Models](./models) | Registry-driven, 22 entries marked deployed, 20 live | [Model catalog](../../reference/model-catalog) |
| [Features](./features) | Image, voice, reasoning, agents, content safety, quotas | [Guide section](../../guide/using-your-deployment) |
| [Deployment](./deployment) | Parameterized Bicep, tested runbook | [Deployment guide](../../guide/deployment) |
| [Consumption](./consumption) | OpenAI-compatible v1 API | [Using your deployment](../../guide/using-your-deployment) |
| [Cost](./cost) | Variable, with an enforceable budget cap | [Cost and governance](../../design/cost-and-governance) |
| [Security](./security) | Managed identity, Entra groups, Key Vault by name | [Identity and security](../../design/identity-and-security) |
| [Operations](./operations) | Deployed observability package with alerts and dashboards | [Observability architecture](../../design/observability-architecture) |

## When this is the right target

Images, speech, frontier reasoning quality, a production SLA, the shortest path
to a first working call, or a low and bursty volume where variable cost beats a
fixed fee. The full reasoning is in [Choosing a target](../choosing).

## When it is not

Your data cannot leave your building. That is the one condition that rules this
target out outright, and it is what the other two exist for.
