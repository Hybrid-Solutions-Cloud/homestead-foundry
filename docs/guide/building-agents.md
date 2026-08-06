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

If you already run a framework, or a homegrown loop, you do not need Agent Service at all. Point the framework's OpenAI client at your v1 base URL:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<account>.services.ai.azure.com/openai/v1/",
    api_key=os.environ["AZURE_AI_KEY"],
)
# hand `client` to whatever framework you already use
```

You keep full control, and you give up the managed endpoint, the managed identity, and the built-in observability. For a reviewer loop or a batch job, that is usually the right trade.

## Orchestrating multiple agents

Everything above is one agent. This section is for when you want **several** agents, each with its own context and often its own model, coordinated by something that decides who runs when. See [SPIKE-34](../research/SPIKE-34-orchestration-options) for the full survey behind this section.

### Agentic is not the same thing as orchestrating

Worth being precise, because the vendor marketing in this space blurs it constantly.

| | What it is | Example |
|---|---|---|
| **Agentic** | One agent, one context, many tool calls in a loop until the task is done | Aider in normal mode, Cline, Kilo Code, Qwen Code |
| **Orchestrating** | Several agents or roles, each with its own context (often its own model), coordinated by something that decides who runs when | goose subrecipes, opencode subagents, OpenHands delegation, Agent Framework workflows |

A tool making forty tool calls to finish one task is not orchestrating. It is one agent working hard. The test: does a second, separately-instructed agent with its own context exist, and can something decide when to run it.

### OpenClaw

The strongest fit found for this account, and it answers the question directly if you came here wondering whether it is an OpenAI-only product now: **it is not.** OpenClaw's own repository states the project is "developed in the open by the OpenClaw Foundation, a non-profit," licensed MIT, and describes itself as model-agnostic ([github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)). No first-party source confirms an OpenAI acquisition; that specific claim is unverified and should not be repeated as fact.

It ships a first-party plugin for this exact platform, `@openclaw/microsoft-foundry`, described as adding "Microsoft Foundry model provider support to OpenClaw" ([Microsoft Foundry plugin](https://docs.openclaw.ai/plugins/reference/microsoft-foundry)). What it documents:

- Model reference `microsoft-foundry/<deployment-name>`, this repository's own naming discipline rather than a vendor model id.
- "Uses Foundry's `/openai/v1` endpoint for OpenAI-compatible APIs", the same route [Using your deployment](./using-your-deployment.md) documents.
- Auth by `AZURE_OPENAI_API_KEY`, or Entra ID through the Azure CLI: `az login`, tokens auto-refreshed via `az account get-access-token`.
- Image generation against `/mai/v1/images/generations` and `/mai/v1/images/edits`, naming **MAI-Image-2.5-Flash, MAI-Image-2.5, MAI-Image-2e, and MAI-Image-2** explicitly, one PNG per request, both dimensions at least 768px, width times height at most 1,048,576.

::: tip The Responses-API trap from Connect your tools, resolved
The plugin defaults "GPT, `o*`, `computer-use-preview`, and DeepSeek-V4 model families" to the **Responses API** wire shape, unless configured otherwise. That covers `gpt-5-6-sol`, `gpt-5-6-terra`, `gpt-5-6-luna`, `deepseek-v4-pro`, and `deepseek-v4-flash` on this account: five deployments. **Measured 2026-08-06: all five answer `/openai/v1/responses` with HTTP 200.** See [Connect your tools](./connect-your-tools.md#the-one-thing-that-makes-this-work) for the same result against Codex CLI. This was the single most likely first failure of an OpenClaw install here; it is no longer an open question for these five deployments.
:::

Orchestration is a documented mechanism, not a metaphor. `sessions_spawn` is non-blocking and returns a run id immediately; results arrive by push-based completion events, not polling. Sub-agents cannot spawn further sub-agents by default (`maxSpawnDepth: 1`). Each sub-agent can run on a **different model**, inherited from the caller unless overridden per-agent or per-spawn ([Sub-agents reference](https://github.com/openclaw/openclaw/blob/main/docs/tools/subagents.md)). That per-spawn override is the practical value here: a cheap deployment on collectors, a reasoning deployment on the lead, `MAI-Image-2.5` on scene art, from one config file, against one account.

The concurrency default is also the cost risk: `maxConcurrent: 8`, against a subscription where [SPIKE-32](../research/SPIKE-32-model-region-availability-matrix) already found six deployed models sitting at 100 percent of their real quota ceiling.

### Microsoft's own stack

**Use Agent Framework, not Semantic Kernel or AutoGen.** Microsoft states plainly that Agent Framework is "the direct successor, created by the same teams" and "the next generation of both Semantic Kernel and AutoGen" ([Agent Framework overview](https://learn.microsoft.com/agent-framework/overview/)). Both older frameworks still work against this account and both have published migration guides, but neither should start a new build.

Its generic client supports `base_url` directly: `OpenAIChatCompletionClient` and `OpenAIChatClient` "both support a `base_url` parameter, enabling you to connect to any OpenAI-compatible endpoint," with Microsoft Foundry named in its own compatible-server table ([OpenAI-compatible endpoints](https://learn.microsoft.com/agent-framework/integrations/openai-endpoints?pivots=programming-language-python)). Five orchestration patterns are named: sequential, concurrent, handoff, group chat, and magentic (a manager agent that dynamically coordinates specialists) ([Workflow orchestrations](https://learn.microsoft.com/agent-framework/workflows/orchestrations/)).

::: warning Group chat has a direct cost consequence
Agents do not share a session; the orchestrator synchronizes each agent's full conversation history before every turn and broadcasts each response to every other participant. **Every agent pays input tokens for every other agent's output, every turn.** Microsoft's own architecture guidance lists exactly this as an antipattern ([AI agent orchestration patterns](https://learn.microsoft.com/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).
:::

Foundry Agent Service's own multi-agent feature, connected agents, is deprecated and retires **31 March 2027**, replaced by declarative workflows ([Connected agents (classic)](https://learn.microsoft.com/azure/foundry-classic/agents/how-to/connected-agents)).

### LangGraph, CrewAI, and the OpenAI Agents SDK

**LangGraph and LangChain** give the cleanest documented match to this account's shape: `AzureChatOpenAI` now recommends using `ChatOpenAI` directly with `base_url` set to the `/openai/v1/` route and the deployment name as `model`, "the same underlying base implementation as `ChatOpenAI`" ([AzureChatOpenAI integration](https://docs.langchain.com/oss/python/integrations/chat/azure_chat_openai)). Five multi-agent architectures are documented, including a router and a supervisor pattern.

**CrewAI**'s vocabulary maps closely onto a researcher/writer/editor/verifier pipeline. Two processes are documented: sequential, and hierarchical, where a `manager_llm` powers a manager agent that plans, delegates, and validates ([Processes](https://docs.crewai.com/en/concepts/processes)). It configures against this account natively with `azure/<deployment>`, or generically via `custom_openai=True` plus `base_url` ([LLMs](https://docs.crewai.com/en/concepts/llms)).

**The OpenAI Agents SDK**, despite the name, is not locked to OpenAI's own models. `set_default_openai_client` accepts any OpenAI-compatible endpoint, and critically, `set_default_openai_api("chat_completions")` switches its default wire shape away from the Responses API ([Models](https://openai.github.io/openai-agents-python/models/)), which is the setting Codex CLI is documented as lacking. Orchestration is either LLM-driven (agents-as-tools, or handoffs to a specialist) or code-driven, which its own docs recommend for predictable cost.

**AG2**, the community continuation of AutoGen, still works with the classic Azure shape (`api_type: "azure"`, `base_url`, `api_version`) if you specifically need AutoGen's GroupChat lineage.

### Workflow platforms: n8n and Dify

**Dify** has a clean endpoint story: an `OpenAI-API-compatible` provider plugin taking a base URL and model name, alongside native Azure OpenAI support ([Dify Marketplace](https://marketplace.dify.ai/plugin/langgenius/openai_api_compatible)).

::: warning n8n: no documented base URL field
n8n's Azure OpenAI credential takes a **resource name**, an API key, and an API version. No endpoint or base URL field is documented on that page, or on its plain OpenAI credential, or on its Chat Model node ([Azure OpenAI credentials](https://docs.n8n.io/integrations/builtin/credentials/azureopenai)). Whether it reaches this account is unresolved. There is a plausible reason it might work anyway: Microsoft documents both `openai.azure.com` and `services.ai.azure.com` hostname forms, so if n8n composes the legacy form from the resource name it should still land, but that is an inference, not documented behaviour. Enter the account name and run one node before relying on this.
:::

### Already in your toolset

Four tools already documented in [Connect your tools](./connect-your-tools.md) are orchestrators, not just single agents, though that page currently labels them all "agentic" without distinction:

| Tool | Orchestrates | Per-role model | Parallel |
|---|---|---|---|
| **goose** | subrecipes, isolated sessions | unverified whether pinnable | yes, up to 10 concurrent workers |
| **opencode** | primary agents plus subagents | yes, documented per-agent `model` | not documented |
| **OpenHands** | `DelegateTool` spawn and delegate | no, sub-agents inherit the parent model | yes, parallel threads |
| **Aider** | architect model plus editor model | yes, two fixed roles | no, a two-stage pipeline |

**opencode has the cleanest per-role model story of any tool already in this repository's guide.** One config can route a planning role to one deployment on this account and a worker role to another, which makes it the cheapest path here to a real multi-model ensemble without adopting a new framework.

### The cost warning, extended

Every platform above has a concurrency dial, and every default seen in this survey is above 1: goose runs up to 10 concurrent workers, OpenClaw defaults to 8, OpenHands runs delegated tasks in parallel threads. The [cost warning](./connect-your-tools.md#cost-warning-read-before-connecting-an-agentic-tool) already in this guide was written for one agent issuing many calls. **Orchestration multiplies that by the fan-out width**, against a subscription where six deployed models already sit at 100 percent of their real quota ceiling. Set concurrency deliberately; do not run a default you have not read.

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

1. **Cap iterations in the agent itself.** A hard maximum on loop turns is the only reliable stop, because nothing in the Azure deployment provides one. Cap tokens per task as well if your framework allows it.
2. **Develop against your cheapest deployment**, then move to the expensive one once the loop terminates reliably.
3. **Watch Cost Management daily for the first week** rather than trusting alert thresholds to arrive in time.
4. **Do not use deployment capacity as the brake.** Throttling is not a cost control. A deployment left at capacity 1 serves roughly one request per minute, and an agent that meets it does not stop, it retries: same tokens, more wall clock, plus a class of `429` failure that is easy to misread as a bug in your agent. Set `capacity` deliberately per model in your registry and put the spend limit where it belongs, in the loop cap above and in the budget alert.

## Next

- [Using your deployment](./using-your-deployment.md) for endpoints, auth, and troubleshooting.
- [Connect your tools](./connect-your-tools.md) for editor and client configuration.
- [SPIKE-34](../research/SPIKE-34-orchestration-options) for the full orchestration platform survey behind this page.
- [ADR-0012](../adr/ADR-0012-agent-mcp-gateway-governance.md) for agent MCP tool governance.
