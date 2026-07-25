# Building agents

How to build custom agents on the models you deployed, using Microsoft Foundry Agent Service or your own framework.

Read [Using your deployment](./using-your-deployment.md) first. Agents are model calls in a loop, so if a plain call does not work an agent will not either.

## Two words that both mean "agent" in this repository

Worth clearing up immediately, because the repository uses the word for something else.

- **This methodology's own agent roster** (`foundry-researcher`, `foundry-architect`, and the rest in `AGENTS.md`) are the agents that *produce this repository*. They write the spikes, the ADRs, and the Bicep. They are a documentation and authoring process, not something you deploy. See [the methodology](./methodology.md).
- **The agents on this page** are agents *you* build on top of *your* deployed models. That is what follows.

## Pick your level

Microsoft Foundry Agent Service offers two shapes, and you can also ignore it entirely.

| Approach | You write | Foundry runs | Best when |
|---|---|---|---|
| **Prompt agents** | Instructions, model choice, tool list | Everything | Getting started, internal tools, no custom orchestration |
| **Hosted agents** | Your agent code | Your container, with a managed endpoint, scaling, identity, observability | You need real orchestration logic but want the platform to operate it |
| **Bring your own runtime** | Everything | Nothing | You already run an agent stack and just want the models |

The third option is the one most people actually start with, and it needs nothing from this page beyond [Connect your tools](./connect-your-tools.md): point any framework at your OpenAI-compatible base URL and you are done.

## Prerequisites for Foundry Agent Service

Agent Service needs a **project**, not just an account. This methodology deploys one (`proj-<workload>-<purpose>-01`) when project management is enabled on the account, so you likely already have it.

The project endpoint has its own shape, different from the inference endpoint:

```
https://<account>.services.ai.azure.com/api/projects/<project-name>
```

Find it in the Foundry portal under your project's overview, or construct it from your account and project names.

```bash
export PROJECT_ENDPOINT="https://<account>.services.ai.azure.com/api/projects/<project-name>"
export MODEL_DEPLOYMENT_NAME="<your-deployment-name>"
az login
```

`MODEL_DEPLOYMENT_NAME` is your deployment name, the same value you pass as `model` everywhere else.

## Prompt agents

Defined by configuration: instructions, a model, and tools. No runtime code and no compute to pay for beyond the model calls themselves.

### In the portal

The fastest way to see whether an agent idea works at all:

1. Open the [Foundry portal](https://ai.azure.com) and select your project.
2. Create an agent, give it a name, and select one of your deployments as its model.
3. Write its instructions.
4. Attach tools if it needs them.
5. Test it in the playground.

Agent names are immutable after creation, and in code you refer to an agent as `<agent_name>:<version>`. Pick the name deliberately.

### In code

Portal-first is fine for exploration, but an agent that matters should be defined in code so it can be reviewed, versioned, and deployed like anything else. That is the same argument this methodology makes for model deployments in [the model registry](./model-registry.md): the definition is data under source control, not a thing someone clicked.

Python:

```bash
pip install azure-ai-projects azure-identity
```

```python
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

client = AIProjectClient(
    endpoint=os.environ["PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

agent = client.agents.create_agent(
    model=os.environ["MODEL_DEPLOYMENT_NAME"],
    name="doc-reviewer",
    instructions=(
        "You review technical documentation. "
        "Report factual errors and unsupported claims. "
        "If you are not certain a claim is wrong, say so rather than asserting it."
    ),
)
print(f"Created agent: {agent.id}")
```

C#:

```bash
dotnet add package Azure.AI.Agents.Persistent
dotnet add package Azure.Identity
```

```csharp
using Azure.AI.Agents.Persistent;
using Azure.Identity;

var client = new PersistentAgentsClient(
    Environment.GetEnvironmentVariable("ProjectEndpoint"),
    new DefaultAzureCredential());

var agent = await client.Administration.CreateAgentAsync(
    model: Environment.GetEnvironmentVariable("ModelDeploymentName"),
    name: "doc-reviewer",
    instructions: "You review technical documentation. Report factual errors and unsupported claims.");
```

## Hosted agents

Your code, run by Foundry with a managed endpoint, automatic scaling, a dedicated Entra identity, session state, and observability.

Supported frameworks include Microsoft Agent Framework, LangGraph, the OpenAI Agents SDK, the Anthropic Agent SDK, the GitHub Copilot SDK, or your own code. Ship a container image, or a zip of your source that Foundry builds for you.

Under the hood your code calls the **Responses API** on your project endpoint, which is what gives it access to your deployed models plus the platform tools.

This is the right level when your agent needs orchestration a prompt agent cannot express, but you do not want to operate the runtime yourself.

## Bring your own runtime

If you already run LangGraph, CrewAI, Semantic Kernel, or a homegrown loop, you do not need Agent Service at all. Point the framework's OpenAI client at your v1 base URL:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<account>.services.ai.azure.com/openai/v1/",
    api_key=os.environ["AZURE_AI_KEY"],
)
# hand `client` to whatever framework you already use
```

You keep full control, and you give up the managed endpoint, the managed identity, and the built-in observability. For a reviewer loop or a batch job, that is usually the right trade.

## Governance, and what is deliberately not here

Two constraints from this methodology's own decision record apply directly.

**Agent tool governance is decided but not provisioned.** [ADR-0012](../adr/ADR-0012-agent-mcp-gateway-governance.md) selects an Azure API Management AI gateway as the control for governing agent Model Context Protocol tools, and gates it to a future agent phase. Nothing is provisioned today. If you are adding MCP tools to agents in a governed environment, read that ADR before wiring them, because the control it selects has prerequisites (an APIM instance, and a paid tier for sustained use) that are not part of the current deployment.

**Identity should be managed identity wherever it can be.** [ADR-0005](../adr/ADR-0005-identity-and-secrets.md) is the governing identity record and prefers managed identity over keys and service principals. Hosted agents get a dedicated Entra identity, which is the right default. If you bring your own runtime on Azure compute, use a managed identity rather than embedding a key.

## Cost, and why it matters more for agents than anything else

The budget deployed by this methodology is **alert-only**. It notifies, it does not stop. See [cost and governance](../design/cost-and-governance.md).

Agents are the highest-risk consumer of these endpoints, by a wide margin:

- One user request becomes many model calls.
- Failed tool calls get retried, sometimes with growing context.
- A reasoning model in a loop can burn tokens with nothing visible happening.
- An agent left running does not stop because you closed the tab.

Practical protections, in order of usefulness:

1. **Leave deployment capacity at 1 while developing.** The resulting throttling is an accidental circuit breaker and it has saved people real money. Raise it only when you know your call volume.
2. **Cap iterations in the agent itself.** A hard maximum on loop turns is the only reliable stop, because nothing in the Azure deployment provides one.
3. **Develop against your cheapest deployment**, then move to the expensive one once the loop terminates reliably.
4. **Watch Cost Management daily for the first week** rather than trusting alert thresholds to arrive in time.

## Next

- [Using your deployment](./using-your-deployment.md) for endpoints, auth, and troubleshooting.
- [Connect your tools](./connect-your-tools.md) for editor and client configuration.
- [ADR-0012](../adr/ADR-0012-agent-mcp-gateway-governance.md) for agent MCP tool governance.
