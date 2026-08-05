# The model gateway: when your tool and your model disagree

::: warning Most deployments do not need this
This is **off by default** and should stay off unless you have hit the problem it
solves. It costs roughly **$12 a month** and buys nothing if the tools you use
already work against the models you deployed. Read the next section, and if none
of it describes you, skip this page.
:::

## The problem it exists for

A model you deploy is reached by tools you did not write. Those tools send
request parameters of their own choosing, and some of them offer no way to change
what they send.

GitHub Copilot Chat is the case that forced this page. It sends
`temperature: 0.1` on every request, and its custom-endpoint configuration has
**no field for temperature**. Reasoning models reject any temperature but their
default:

```
400 Unsupported value: 'temperature' does not support 0.1 with this model.
    Only the default (1) value is supported.
```

So the model works perfectly over `curl` and is **unusable through that editor**.

**There is no fix on the Azure side, and this is the part worth being precise
about.** A deployment has no setting that permits or forbids a temperature.
Redeploying the model, or recreating the deployment "without locking parameters
to defaults", changes nothing. Measured against a live deployment, the same model
returns the identical 400 on both API surfaces:

| Request | `/chat/completions` | `/responses` |
|---|---|---|
| no temperature | 200 | 200 |
| `temperature: 1` | 200 | 200 |
| **`temperature: 0.1`** | **400** | **400** |

The parameter is chosen by the client and rejected by the model. **The only place
to intervene is between them.**

## Who needs it, and who does not

**You do not need it if** every model you deploy accepts what your tools send.
On one account measured in August 2026, **ten of eleven chat deployments accepted
`temperature: 0.1` without complaint** - every Grok variant, DeepSeek, Kimi,
Llama and Mistral. Only the three reasoning deployments refused. If your roster
looks like that and you are not using the reasoning models from an editor, deploy
nothing and move on.

**You need it if** any of these is true:

- A tool you cannot configure sends a parameter one of your models refuses.
- You want the account key out of editor configuration files, which settings-sync
  copies between machines.
- You want more than one machine or person reaching the models through one
  durable address.

**Vendor family does not predict which models refuse.** Grok's *reasoning*
variants accepted a custom temperature; the OpenAI reasoning models did not. Test
the deployment, do not infer it from the name.

## What it does

It forwards every request untouched. **Only when the endpoint answers 400 with
`unsupported_value` and names a parameter** does it drop that parameter and retry
once.

That inversion is the whole design. A gateway carrying a list of which models
reject which parameters is wrong the day a new model ships. Letting the endpoint
decide keeps working for parameters and models that do not exist yet, and it
leaves alone the models that accept temperature rather than flattening them all
to a default.

Two details that are not optional:

- **A 400 arrives before any response body streams**, so the retry costs one
  round trip and never truncates a stream.
- **The body is piped straight through.** Agentic chat clients use server-sent
  events, and a gateway that buffers turns a live token stream into a long pause
  followed by a wall of text.

## Deploying it

Set three parameters. It is a module of the main stack, in the same resource
group, so a teardown removes it with everything else.

```bicep
param deployGateway bool = true
param gatewayTokenSecretName string = '<initiative>-gateway-token'
param gatewaySku string = 'B1'
```

Create the gateway token in the vault first. It is a **separate secret from the
account key**, on purpose: it can be rotated without touching Azure, and if it
leaks it cannot be replayed against the Foundry account.

```bash
az keyvault secret set --vault-name <vault> --name <initiative>-gateway-token \
  --value "$(openssl rand -base64 32)"
```

`B1` is the cheapest tier that stays warm. The free tier exists and carries a
daily CPU quota that stalls an editor mid-task, which is worse than not deploying
at all.

## Pointing tools at it

Replace the **endpoint** everywhere. The deployment name you send does not
change.

| Tool | Where |
|---|---|
| GitHub Copilot Chat | model picker, Manage Models, custom endpoint |
| Cursor | Settings, Models, Override OpenAI Base URL |
| Cline / Roo | provider "OpenAI Compatible" |
| Continue | `apiBase` in `config.yaml` |

```
https://<gateway-name>.azurewebsites.net/v1
```

The API key each tool asks for is now the **gateway token**, not the account key.
The account key never leaves the gateway.

## What it costs you beyond the money

**The gateway becomes a dependency.** If it is down, the models are unreachable,
where previously they were reachable and some requests were rejected. That is a
better failure mode - one cause, one fix, and it is obvious - but it is not a
free win, and it is the honest reason to leave this off unless you need it.

## Why not API Management

Azure API Management carries a richer AI Gateway policy set: per-consumer token
quotas, semantic caching, and load balancing across several deployments of the
same model. It is the right answer **when governing multiple consumers is the
requirement**, which is what [ADR-0012](../adr/ADR-0012-agent-mcp-gateway-governance)
gates to a future agent phase.

It is also roughly **$48 a month for a tier with no SLA**, and roughly **$150 a
month** for the cheapest tier that has one, against roughly **$12** here. For
putting a parameter shim somewhere durable, that is an order of magnitude of cost
for capability that goes unused. Adopt it when the governance is the point, not
to fix a temperature.

## See also

- [Model behaviour and limits](./model-behaviour-and-limits), the failures this repairs and why they happen.
- [Connect your tools](./connect-your-tools), configuring each client.
- [Content safety](./content-safety), the other thing that blocks an editor integration.
