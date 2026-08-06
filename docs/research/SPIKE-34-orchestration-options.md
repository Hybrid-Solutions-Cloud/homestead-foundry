# SPIKE-34: Orchestration options, and which of them can be pointed at this account

Role: foundry-researcher (Opus). Status: research spike complete. Read-only: no Azure resources created, updated, or deleted, and **no inference call was made against the account**. No software was installed, no framework was run, and no spend was incurred. This is a documentation survey, not a bench test, and the difference matters: see the method section.
Date: 2026-08-06
Scope: a first-party-sourced survey of multi-agent orchestration platforms, measured against the account this repository deploys, plus an audit of the orchestration capability already sitting inside tools that [Connect your tools](../guide/connect-your-tools) has already documented.

Depends on: [`SPIKE-33`](./SPIKE-33-client-tool-survey) for the client-tool baseline and the three wire shapes, [`SPIKE-32`](./SPIKE-32-model-region-availability-matrix) for what is deployed and what quota it holds, and [Connect your tools](../guide/connect-your-tools) for the per-tool configurations already in the guide. This spike sits one layer above both: SPIKE-33 asked *which tool can call one model*, this one asks *what coordinates several models or several agents at once*.

**Headline: the OpenClaw question resolves in this account's favour, and more strongly than expected.** OpenClaw is not locked to OpenAI's hosted models. Its repository states it is "developed in the open by the OpenClaw Foundation, a non-profit" under an MIT licence ([github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)), and it ships a **first-party Microsoft Foundry plugin**, `@openclaw/microsoft-foundry`, that targets Foundry's `/openai/v1` endpoint, takes the deployment name as the model reference, supports Entra ID through the Azure CLI, and separately supports **MAI-Image-2.5 image generation** ([Microsoft Foundry plugin, OpenClaw](https://docs.openclaw.ai/plugins/reference/microsoft-foundry)). That is this repository's first proven build, named in a third party's plugin reference.

**The second headline is a correction the guide and the backlog both need.** The task named "Microsoft AutoGen/AG2" and "Microsoft Semantic Kernel" as two separate platforms to evaluate. Microsoft's own documentation says both are superseded: Agent Framework is "the direct successor, created by the same teams" and "the next generation of both Semantic Kernel and AutoGen" ([Agent Framework overview](https://learn.microsoft.com/agent-framework/overview/)). Evaluating Semantic Kernel and AutoGen as live options in 2026 is evaluating two products their vendor has already merged and replaced. The same page-level deprecation applies inside Azure: Foundry's **connected agents are deprecated and retire on 31 March 2027**, replaced by workflows ([Connected agents (classic)](https://learn.microsoft.com/azure/foundry-classic/agents/how-to/connected-agents)).

**The third finding is the one that costs money.** Every platform here has a concurrency dial, and every one of them ships with a default above 1: goose runs up to 10 concurrent workers, OpenClaw defaults `maxConcurrent` to 8, OpenHands runs delegated tasks in parallel threads. SPIKE-33's cost warning was written for a single agent issuing many calls. Orchestration multiplies that by the fan-out width, against a subscription where SPIKE-32 already found six models at 100 percent of their real quota ceiling.

---

## Question

1. Which prominent multi-agent orchestration platforms can be pointed at a **custom OpenAI-compatible endpoint** of the shape this account exposes (`https://<account>.services.ai.azure.com/openai/v1/`, deployment name as the model id), and which are locked to a specific vendor's hosted models?
2. Specifically: **is OpenClaw usable here at all**, or did the OpenAI acquisition close it to non-OpenAI models?
3. For each platform, what is the config shape (legacy Azure path versus plain v1 versus a native Azure provider), and is it a hosted service or self-run?
4. What does "orchestration" actually mean for each one: fan-out, pipeline, supervisor-worker, handoff, or something else?
5. Which tools **already documented in this repository's guide** can coordinate multiple agents, as opposed to being a single agent that makes many tool calls?

---

## Method, and the distinction the whole spike turns on

Every platform below was accepted only on evidence from the vendor's own documentation, repository, changelog, or marketplace listing. The URL is cited inline. Where the vendor was silent, the entry is marked **UNVERIFIED** and says what would settle it.

::: danger This is a survey of claims, not a record of results
**Nothing here was executed against `aif-studioai-prod-eus-01`.** No framework was installed, no agent was run, no orchestration was benchmarked. Every row is what a vendor says its software does.

The standing rule from SPIKE-33 applies unchanged: *documentation is a claim, the API is a fact.* Three claims in this spike are the most likely to fail on contact: whether OpenClaw's Foundry plugin resolves this account's deployment names, whether n8n can express this account's hostname at all, and whether any Responses-defaulting client reaches the deployments it assumes it can. All three are cheap to test and none of them were tested.
:::

### The distinction: agentic is not orchestrating

This is the actual point of the spike, and conflating the two is the most common error in the vendor marketing around it.

| | What it is | Example |
|---|---|---|
| **Agentic** | **One** agent, one context, many tool calls in a loop until the task is done | Aider in normal mode, Cline, Kilo Code, Zed's agent panel, Qwen Code |
| **Orchestrating** | **Several** agents or roles, each with its own context (and often its own model), coordinated by something that decides who runs when | goose subrecipes, opencode subagents, OpenHands delegation, Agent Framework workflows |

A tool that makes forty tool calls to finish one task is not orchestrating. It is one agent working hard. The test applied throughout: **does a second, separately-instructed agent with its own context window exist, and can something decide when to run it?** If not, it does not appear in Angle 2 below.

A second, softer test separates a real orchestrator from a workflow engine with an LLM node in it: **does the coordinator itself reason about who runs next, or is the sequence fixed at authoring time?** Both are legitimate, they cost very differently, and the table below labels which is which.

### Documentation churn encountered during this survey

Two documentation hosts moved mid-survey and both broke first-party URLs that search engines still return. goose's `block.github.io/goose/docs/guides/recipes/subrecipes/` returned 404 while `goose-docs.ai/docs/guides/recipes/subrecipes` served the same page. `docs.openhands.dev/sdk/guides/agent-delegation` returned 404 to a direct fetch despite being indexed, so OpenHands' delegation behaviour below is cited to the runnable example in its own repository instead. `docs.continue.dev` agent pages returned 404 throughout, which is why Continue is the one unresolved entry in Angle 2. Every other URL in the sources list resolved on 2026-08-06.

---

## Findings

### F1. The master table

"Custom endpoint" means: can this platform be pointed at `https://<account>.services.ai.azure.com/openai/v1/` with a deployment name as the model id, on first-party evidence.

| Platform | Type | Custom endpoint | Config shape | What "orchestration" means for it |
|---|---|---|---|---|
| **OpenClaw** | self-hosted, messaging-first | **yes, first-party Foundry plugin** | native `microsoft-foundry` provider, or generic `openai-completions` with `baseUrl` | Supervisor plus non-blocking sub-agent spawn, one gateway hosting many agents |
| **Microsoft Agent Framework** | SDK (self-run) | **yes** | `base_url` on the generic client, or `azure_endpoint` plus credential | Five named patterns: sequential, concurrent, handoff, group chat, magentic |
| **Semantic Kernel** | SDK (self-run) | yes, but **superseded** | `AzureOpenAIChatCompletion` | Same five patterns, still supported, migration guide published |
| **AutoGen** | SDK (self-run) | yes, but **superseded** | Azure client | GroupChat, event-driven runtime |
| **AG2** (community fork) | SDK (self-run) | **yes** | `api_type: "azure"`, `base_url`, `api_version` | GroupChat lineage from AutoGen |
| **Foundry Agent Service** | **managed Azure service** | n/a, it **is** this account's platform | portal, SDK, or YAML workflows | Connected agents (**deprecated**), now declarative workflows |
| **LangGraph / LangChain** | SDK (self-run) | **yes, documented verbatim** | `ChatOpenAI` with `base_url` ending `/openai/v1/` | Graph of nodes; subagents, handoffs, router, supervisor, swarm |
| **CrewAI** | SDK (self-run) | **yes** | `azure/<deployment>`, or `custom_openai=True` plus `base_url` | Sequential process, or hierarchical with a `manager_llm` |
| **OpenAI Agents SDK** | SDK (self-run) | **yes** | `set_default_openai_client` plus `set_default_openai_api("chat_completions")` | Handoffs, agents-as-tools, or plain code orchestration |
| **n8n** | workflow automation (hosted or self-run) | **UNVERIFIED, likely constrained** | Azure credential takes a **resource name**, no base URL field documented | Workflow graph; AI Agent node; sub-workflows |
| **Dify** | self-hosted / cloud app platform | **yes**, via its OpenAI-API-compatible plugin | Base URL plus model name | Visual agentic workflow graph |

### F2. OpenClaw: resolved, and it is the strongest fit in the survey

This was the question the owner asked by name, so it gets the most space and the most direct sourcing.

**Governance first, because it determines everything else.** OpenClaw's own repository states the project is "developed in the open by the OpenClaw Foundation, a non-profit," licensed MIT, originally built by Peter Steinberger and the community ([github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)). There is **no first-party statement that OpenAI owns, controls, or has acquired the project**, and the README describes the system as model-agnostic, working "with hosted and local model providers."

::: warning One sub-question is not first-party resolved
Widely-reported third-party accounts say the creator joined OpenAI in February 2026 and the project moved to an independent foundation at that point. The **foundation half of that is first-party confirmed** by the repository. The **acquisition or hiring half is UNVERIFIED**: no OpenAI or OpenClaw first-party announcement was located. It does not change the answer that matters, because the licence, the governance, and the provider architecture are all first-party documented and all point the same way, but it should not be restated as fact in the guide.
:::

**The generic custom-provider route.** OpenClaw's model provider concept page documents a `models.providers.<id>` block taking `baseUrl`, `apiKey`, `api`, `timeoutSeconds`, and a hand-declared `models` array with `id`, `contextWindow`, `maxTokens`, and per-model `cost` ([Model providers, OpenClaw](https://docs.openclaw.ai/concepts/model-providers)). The `api` value for this account's shape is `openai-completions`. Two details from that page matter here:

> "For `api: 'openai-completions'` on non-native endpoints (any non-empty `baseUrl` whose host is not `api.openai.com`), OpenClaw forces `compat.supportsDeveloperRole: false`"

That is a compatibility guard that fires automatically for any Azure hostname, which is the right behaviour and needs no configuration. Separately, vendor-specific request fields can be merged in through `agents.defaults.models['provider/model'].params.extra_body`, which is the escape hatch for the parameter mismatches SPIKE-33 catalogued (`temperature` on reasoning models, `max_tokens` on the `gpt-5-6-*` family).

**The native route, which is better.** OpenClaw ships `@openclaw/microsoft-foundry`, included in the installation, described as adding "Microsoft Foundry model provider support to OpenClaw" ([Microsoft Foundry plugin](https://docs.openclaw.ai/plugins/reference/microsoft-foundry)). What that page documents, verbatim:

- Model reference format `microsoft-foundry/<deployment-name>`, which is exactly this repository's naming discipline (deployment name, not vendor model id) rather than the opposite requirement opencode's Azure mode imposes.
- It "uses Foundry's `/openai/v1` endpoint for OpenAI-compatible APIs". That is the same route [Using your deployment](../guide/using-your-deployment) documents.
- Auth by `AZURE_OPENAI_API_KEY`, **or Entra ID through the Azure CLI**: `az login` before onboarding, with tokens auto-refreshed via `az account get-access-token`. That makes it one of the very few tools in either spike that documents keyless Azure auth end to end.
- Image generation against `/mai/v1/images/generations` and `/mai/v1/images/edits`, supporting **MAI-Image-2.5-Flash, MAI-Image-2.5, MAI-Image-2e, and MAI-Image-2**, configured through `agents.defaults.imageGenerationModel.primary`. Documented constraints: one PNG per request, both dimensions at least 768 px, and width times height at most 1,048,576.

::: danger The wire-shape trap from SPIKE-33 reappears here, and it is account-specific
The plugin page states that "GPT, `o*`, `computer-use-preview`, and DeepSeek-V4 model families" default to **`openai-responses`**, while "MAI-DS-R1 and other chat-completion deployments use `openai-completions`" unless configured otherwise.

This account runs `gpt-5-6-sol`, `gpt-5-6-terra`, `gpt-5-6-luna`, `deepseek-v4-pro`, and `deepseek-v4-flash`. **All five fall in the group this plugin defaults to the Responses API**, and SPIKE-33's largest open question is that **which deployments on this account actually answer `/openai/v1/responses` has never been measured**, with Microsoft documenting `400 Model not supported` as the failure. So the single most likely first failure of an OpenClaw install here is not authentication and not the hostname: it is five deployments being addressed over a wire shape nobody has confirmed they serve.

The page documents the override (`unless explicitly configured otherwise`), so this is a configuration question, not a blocker. It is still the first thing to test.
:::

One further limit worth carrying forward: the plugin notes that "Anthropic Claude deployments in Microsoft Foundry use the Anthropic Messages API shape, not the OpenAI-compatible `/openai/v1` shape." This account deploys no Claude models, so it does not bite today, but it is the same protocol boundary the guide already documents for Claude Code.

**What OpenClaw's orchestration actually is.** Not a metaphor: it is documented mechanism.

The tool catalogue lists a `subagents` tool described as "Delegate work, orchestrate collectors, steer another run", alongside `agents_list`, `agents_wait`, and `sessions_*` inspection tools ([Tools overview, OpenClaw](https://docs.openclaw.ai/tools)). The spawn primitive is `sessions_spawn`, and its reference is unusually precise ([docs/tools/subagents.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/subagents.md)):

- "`sessions_spawn` is non-blocking; it returns a run id immediately." The successful result is `{ status: "accepted", runId, childSessionKey }`, and for native sub-agents also carries `resolvedModel` and `resolvedProvider`.
- Results come back by push-based completion events announced to the parent session, not by polling.
- **Sub-agents cannot spawn sub-agents by default.** `maxSpawnDepth` defaults to 1, and deeper nesting for orchestrator patterns has to be turned on explicitly.
- **Each sub-agent can run on a different model.** Sub-agents inherit the caller's model unless overridden at `agents.defaults.subagents.model`, per-agent at `agents.entries.*.subagents.model`, or per-spawn as an explicit `sessions_spawn.model` parameter, which wins.

And one gateway can host many fully separate agents: each key in `agents.entries` is a stable agent id with its own `model`, `utilityModel`, and `imageModel` ([Configuration, agents](https://docs.openclaw.ai/gateway/config-agents)). The concurrency block is where the money is:

```json5
subagents: {
  allowAgents: ["*"],
  requireAgentId: false,
  maxConcurrent: 8,
  maxChildrenPerAgent: 5,
  maxSpawnDepth: 1,
  archiveAfterMinutes: 60
}
```

`maxConcurrent: 8` against deployments SPIKE-32 found sitting at their quota ceiling is the single most consequential default in this spike.

**Why this matters beyond OpenClaw itself.** The per-spawn model override plus per-agent model assignment means a single OpenClaw install could put a cheap deployment on collectors, a reasoning deployment on the lead, and `MAI-Image-2.5` on scene art, from one config file, against one account, with Entra auth. That is the closest thing in this survey to the Project 42 ensemble shape running on this repository's own infrastructure.

### F3. Microsoft's own stack, and the two products that are already superseded

**Agent Framework is the live one.** Microsoft states it "combines AutoGen's simple agent abstractions with Semantic Kernel's enterprise features" and is "the direct successor, created by the same teams" to both, describing itself as "the next generation of both Semantic Kernel and AutoGen" ([Agent Framework overview](https://learn.microsoft.com/agent-framework/overview/)). Migration guides exist [from Semantic Kernel](https://learn.microsoft.com/agent-framework/migration-guide/from-semantic-kernel/) and [from AutoGen](https://learn.microsoft.com/agent-framework/migration-guide/from-autogen/).

Its orchestration patterns are named and documented ([Workflow orchestrations](https://learn.microsoft.com/agent-framework/workflows/orchestrations/)):

| Pattern | Microsoft's description |
|---|---|
| Sequential | "Agents execute one after another in a defined order" |
| Concurrent | "Agents execute in parallel" |
| Handoff | "Agents transfer control to each other based on context" |
| Group Chat | "Agents collaborate in a shared conversation" |
| Magentic | "A manager agent dynamically coordinates specialized agents" |

Group chat carries a detail with a direct cost consequence: agents do not share a session instance, and "the orchestrator ensures that each agent's session is synchronized with the complete conversation history before each turn," broadcasting each response to all other participants ([Group Chat orchestration](https://learn.microsoft.com/agent-framework/workflows/orchestrations/group-chat)). **Every agent pays input tokens for every other agent's output, every turn.** Microsoft's own architecture guidance lists this among its antipatterns: "Consuming excessive model resources because context windows grow as agents accumulate more information" ([AI agent orchestration patterns](https://learn.microsoft.com/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

**Endpoint configuration, and this is the important part for this account.** Agent Framework has a dedicated page for it. In Python, `OpenAIChatCompletionClient` and `OpenAIChatClient` "both support a `base_url` parameter, enabling you to connect to any OpenAI-compatible endpoint" ([OpenAI-compatible endpoints](https://learn.microsoft.com/agent-framework/integrations/openai-endpoints?pivots=programming-language-python)). Its own table of compatible servers lists Microsoft Foundry with "Your deployment endpoint" and the note "Uses Azure credentials". `OPENAI_BASE_URL` works as an environment variable in place of the parameter.

The same page documents the explicit Azure route, which does not use `base_url`:

```python
agent = OpenAIChatClient(
    model=os.environ["AZURE_OPENAI_CHAT_MODEL"],
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    credential=AzureCliCredential(),
).as_agent(name="Assistant", instructions="You are a helpful assistant.")
```

There is also `AzureOpenAIChatClient(endpoint=..., deployment_name=..., api_key=...)` in `agent_framework.azure` ([API reference](https://learn.microsoft.com/python/api/agent-framework-core/agent_framework.azure.azureopenaichatclient?view=agent-framework-python-latest)).

::: warning The class names are churning
Microsoft publishes a page titled [Python 2026 significant changes](https://learn.microsoft.com/agent-framework/support/upgrade/python-2026-significant-changes) covering renames in this exact area, and the samples surfaced during this survey use `OpenAIChatClient`, `OpenAIChatCompletionClient`, `AzureOpenAIChatClient`, and `FoundryChatClient` in overlapping roles across pages of different vintages. Pin a version before writing anything into a guide, and expect the sample you copy to be older than the package you install.
:::

**Foundry Agent Service is the managed option, and its multi-agent feature just turned over.** Connected agents let "a primary agent intelligently delegate to purpose-built subagents" with "no custom orchestration required," but the page now carries two deprecation notices: agents (classic) "are now deprecated and will be retired on March 31, 2027," and the tool "is only available in `2025-05-15-preview` API," with Microsoft recommending migration to `2025-11-15-preview` **workflows** ([Connected agents (classic)](https://learn.microsoft.com/azure/foundry-classic/agents/how-to/connected-agents)). Workflows "orchestrate multiple Foundry agents declaratively using sequential, group chat, or human-in-the-loop patterns" ([A2A agent endpoint](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/agent-to-agent)).

Microsoft's own architecture guidance is candid about the tradeoff: Agent Service workflows "are primarily nondeterministic, which limits the range of patterns that you can fully implement. Use Agent Service when you need a managed environment and your orchestration requirements are straightforward" ([AI agent orchestration patterns](https://learn.microsoft.com/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

**Semantic Kernel and AutoGen, for the record.** Semantic Kernel implements the same five patterns and "continues to provide agent orchestration support," with Microsoft directing existing workloads to the migration guide ([SK agent orchestration](https://learn.microsoft.com/semantic-kernel/frameworks/agent/agent-orchestration/)). Its own docs mark agent orchestration as "in the experimental stage." AutoGen pioneered GroupChat and the event-driven agent runtime and is the other parent of Agent Framework. **AG2** is the community continuation, and its Azure configuration is the classic shape: `api_type: "azure"`, `base_url`, `api_version`, and the deployment name as `model` ([AG2 LLM configuration deep-dive](https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/llm-configuration-deep-dive/)). All three work against this account. None of them is what a new build should start on.

### F4. The code-first frameworks

**LangGraph and LangChain give the single cleanest first-party match to this account's shape.** The `AzureChatOpenAI` integration page now steers away from itself: Azure OpenAI's v1 API "allows you to use `ChatOpenAI` directly with Azure endpoints. This removes the need for dated `api_version` parameters," with `base_url` set to `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/`, `model` set to the deployment name, and `api_key` accepting either a key string or a token provider callable ([AzureChatOpenAI integration](https://docs.langchain.com/oss/python/integrations/chat/azure_chat_openai)). The page adds that `AzureChatOpenAI` "now shares the same underlying base implementation as `ChatOpenAI`."

That is a vendor documenting this repository's exact endpoint route, with a token-provider hook for Entra, and telling readers to prefer it over the legacy Azure class.

Orchestration in LangChain is documented as five architectures ([Multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent)):

- **Subagents**: "A main agent coordinates subagents as tools. All routing passes through the main agent, which decides when and how to invoke each subagent."
- **Handoffs**: "Behavior changes dynamically based on state."
- **Skills**: "Specialized prompts and knowledge loaded on-demand. A single agent stays in control."
- **Router**: "A routing step classifies input and directs it to one or more specialized agents. Results are synthesized into a combined response."
- **Custom workflow**: bespoke LangGraph flows mixing deterministic logic and agentic behaviour.

The page's own caveat deserves quoting, because it is the most honest sentence found in this survey: "not every complex task requires this approach". Note also that `skills` is explicitly **not** orchestration by this spike's test: one agent stays in control. The supervisor and swarm packages exist as separate first-party repositories ([langgraph-supervisor-py](https://github.com/langchain-ai/langgraph-supervisor-py), [langgraph-swarm-py](https://github.com/langchain-ai/langgraph-swarm-py)).

**CrewAI** is the role-based one, and its vocabulary maps almost exactly onto the Project 42 ensemble. Two processes are documented: sequential, and hierarchical, where a `manager_llm` powers an automatically created manager agent that "oversees task execution, including planning, delegation, and validation," and in which "tasks are not pre-assigned; the manager allocates tasks to agents based on their capabilities, reviews outputs, and assesses task completion" ([Processes](https://docs.crewai.com/en/concepts/processes)).

Endpoint configuration comes in two forms ([LLMs](https://docs.crewai.com/en/concepts/llms)). Azure natively:

```python
llm = LLM(model="azure/gpt-4", api_key="...", endpoint="...", api_version="2024-06-01")
```

with `AZURE_API_KEY`, `AZURE_ENDPOINT`, and `AZURE_API_VERSION` (defaulting to `2024-06-01`) as environment variables. Or generically, for "non-OpenAI endpoints that follow OpenAI's API format," via `custom_openai=True` plus `base_url`. CrewAI documents "native SDK integrations for OpenAI, Anthropic, Google (Gemini API), Azure, AWS Bedrock, and Snowflake Cortex," with LiteLLM as the fallback for everything else, so this account has a first-class path rather than a proxy path.

**OpenAI Agents SDK**, the successor to Swarm, is not locked to OpenAI despite the name. Its models page documents `set_default_openai_client` for "providers with OpenAI-compatible endpoints" ([Models](https://openai.github.io/openai-agents-python/models/)):

```python
client = AsyncOpenAI(api_key="Api_Key", base_url="Base URL of Provider")
model = OpenAIChatCompletionsModel(model="Model_Name", openai_client=client)
agent = Agent(name="Helping Agent", instructions="...", model=model)
```

The critical line for this account is the next one: because many providers do not support the Responses API, the SDK documents `set_default_openai_api("chat_completions")` to switch the default wire shape. **That is the setting SPIKE-33 wished Codex CLI had.** Per-agent models are supported, which the page notes lets "you mix and match different providers for different agents."

Orchestration is documented two ways ([Orchestrating multiple agents](https://openai.github.io/openai-agents-python/multi_agent/)): LLM-driven, via agents-as-tools ("A manager agent keeps control of the conversation and calls specialist agents through `Agent.as_tool()`") and handoffs ("A triage agent routes the conversation to a specialist, and that specialist becomes the active agent for the rest of the turn"); or via code, where "orchestrating via code makes tasks more deterministic and predictable, in terms of speed, cost and performance." For a budget-constrained personal account, that last sentence is the recommendation.

### F5. The workflow platforms, where the endpoint question gets harder

**n8n is the one platform in this survey with a plausible hard blocker, and it is not about orchestration at all.** n8n's Azure OpenAI credential documents exactly three fields for key auth: "A **Resource Name**: the **Name** you give the resource", "An **API key**", and "The **API Version** the credentials should use", plus Entra ID (OAuth2) as a second auth method ([Azure OpenAI credentials](https://docs.n8n.io/integrations/builtin/credentials/azureopenai)). It instructs users to "use the **Deployment name** as the model name for the Azure OpenAI nodes," which is the right convention. **But there is no endpoint or base URL field documented anywhere on that page**: the credential takes a resource *name* and composes a hostname from it.

Checking the other direction did not help. n8n's plain OpenAI credential documents only an API Key and an Organization ID, with no base URL ([OpenAI credentials](https://docs.n8n.io/integrations/builtin/credentials/openai)), and the OpenAI Chat Model node's documented parameters and options are `Model`, `Use Responses API`, and a list of sampling and retry options, with **no Base URL option listed** ([OpenAI Chat Model](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/)).

::: warning UNVERIFIED, with a likely workaround
**Whether n8n can reach `aif-studioai-prod-eus-01` is unresolved.** The blocking question is which hostname template n8n composes from the resource name, and no first-party page states it.

There is a good reason to think it works anyway. Microsoft documents that `base_url` "accepts both `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/` and `https://YOUR-RESOURCE-NAME.services.ai.azure.com/openai/v1/` formats" ([v1 API](https://learn.microsoft.com/azure/foundry/openai/api-version-lifecycle#code-changes)), so if n8n builds the `openai.azure.com` form from the account name, it should still land. **That is an inference, not a documented behaviour.** What resolves it: enter the account name in an n8n Azure OpenAI credential and run one node, or read the request in n8n's execution log.
:::

n8n's orchestration is workflow-graph orchestration: an authored sequence of nodes, with the AI Agent node as a cluster node taking a chat model sub-node. The coordinator is the graph, not a model, which makes it the most deterministic and the most predictable-cost option in this survey, and the least adaptive.

**Dify** is the other platform of this kind and has a cleaner endpoint story: an `OpenAI-API-compatible` model provider plugin taking a base URL and model name ([OpenAI-API-compatible, Dify Marketplace](https://marketplace.dify.ai/plugin/langgenius/openai_api_compatible)), alongside native Azure OpenAI support, in a self-hostable product for building "Agentic workflows, RAG pipelines" ([github.com/langgenius/dify](https://github.com/langgenius/dify)). Its orchestration is a visual workflow graph, the same category as n8n.

### F6. Angle 2: what the tools already in the guide can already orchestrate

This is the half that changes what the guide says, because four tools already documented in [Connect your tools](../guide/connect-your-tools) are orchestrators, not just agents, and the guide currently describes all of them as "agentic" without distinction.

| Tool | Orchestrates? | Mechanism | Per-role model? | Parallel? |
|---|---|---|---|---|
| **goose** | **yes** | subrecipes | **UNVERIFIED** | **yes, up to 10 workers** |
| **opencode** | **yes** | primary agents plus subagents | **yes, documented** | not documented |
| **OpenHands** | **yes** | `DelegateTool` / `TaskToolSet` | inherits parent | **yes, threads** |
| **Aider** | **yes, minimally** | architect plus editor model | **yes, two roles** | no, two-stage pipeline |
| **Crush** | **UNVERIFIED** | open feature request | n/a | n/a |
| **Continue** | **UNVERIFIED** | docs unreachable | n/a | n/a |

**goose is the strongest orchestrator among the terminal tools already in the guide, and the guide does not mention the capability at all.** Subrecipes are "recipes that are used by another recipe to perform specific tasks. They enable multi-step workflows and reusable components," and the isolation guarantee is explicit: "Sub-recipe sessions run in isolation - they don't share conversation history, memory, or state with the main recipe or other subrecipes" ([Subrecipes](https://goose-docs.ai/docs/guides/recipes/subrecipes)). Recipes carry per-recipe settings such as `max_turns`, which is a real per-role spend cap.

Parallelism is the part that needs a warning in the guide. goose "distributes tasks across up to 10 concurrent workers," multiple instances of the **same** subrecipe run in parallel **by default**, different subrecipes run sequentially unless the prompt says "in parallel," and `sequential_when_repeated: true` is the flag that forces serial behaviour and "overrides user requests and default parallel settings" ([Running Subrecipes In Parallel](https://goose-docs.ai/docs/tutorials/subrecipes-in-parallel)). **Ten concurrent workers against a deployment at its quota ceiling is a `429` generator.** Whether a subrecipe can pin its own model or provider is **not documented on either page** and is marked UNVERIFIED.

**opencode has the cleanest per-role model story of any tool in either spike.** It documents two agent categories: primary agents, cycled with the Tab key or a `switch_agent` keybind, and subagents, "specialized assistants that primary agents can invoke," invoked automatically by description matching, manually by `@mention`, or programmatically through the Task tool ([Agents, opencode](https://opencode.ai/docs/agents/)). Each agent takes a `model` override:

```json
{ "agent": { "plan": { "model": "anthropic/claude-haiku-4-20250514" } } }
```

with the documented default that "primary agents use the model globally configured while subagents will use the model of the primary agent that invoked the subagent." Combined with the `@ai-sdk/openai-compatible` provider block the guide already prints, that means **one opencode config can route a planning role to one deployment on this account and a worker role to another**, which is the cheapest available route to a real multi-model ensemble here.

**OpenHands** documents delegation in its SDK: a `DelegateTool` exposing `spawn` (initialise sub-agent conversations) and `delegate` (send tasks, blocking until all complete, executing in parallel via Python threads), plus a `TaskToolSet` for autonomous task execution. Sub-agents run as independent conversations with their own context, inheriting the parent's model configuration. Because the documentation page would not serve, this is cited to the runnable example in OpenHands' own repository, which registers named specialist agents via `register_agent()`, sets `tool_concurrency_limit=2`, and configures the LLM with a `base_url` read from `LLM_BASE_URL` ([25_agent_delegation.py](https://github.com/OpenHands/software-agent-sdk/blob/main/examples/01_standalone_sdk/25_agent_delegation.py)). Note the consequence of model inheritance: **OpenHands fans out onto the same deployment**, so its parallelism lands entirely on one quota bucket.

**Aider is the minimal case, and it is worth naming precisely because it is so easy to miss.** Architect mode "sends your requests to two models": a main model acting as architect to propose a solution, then "another request to an 'editor model', asking it to turn the architect's proposal into specific file editing instructions," configured with `--architect` and `--editor-model` ([Chat modes](https://aider.chat/docs/usage/modes.html)). Two roles, two models, a fixed pipeline. That is orchestration by this spike's test, and it is the pattern most directly reusable here: a reasoning deployment as architect, a cheaper deployment as editor, both on this account.

**Crush is unresolved and should not be claimed either way.** Its repository carries an open issue titled "Agent orchestration - primary / subagents" (issue #1320) asking whether the maintainers "plan to implement agent orchestration with primary/subagents for assignment of specific roles," with **no maintainer reply and no resolution** ([charmbracelet/crush#1320](https://github.com/charmbracelet/crush/issues/1320)). Third-party code-analysis sites describe an internal `agent` tool that spawns task sub-agents, but that is an implementation detail of the binary, not a documented user-facing feature, and this spike does not certify it. **UNVERIFIED.** What resolves it: a first-party page under Crush's documentation, or `crush --help` in a current build.

**Continue is unresolved for a duller reason.** Its agents documentation pages returned 404 to every fetch attempted during this survey, and the repository README describes Continue only as "a coding agent available as a CLI, VS Code extension, and JetBrains plugin" ([github.com/continuedev/continue](https://github.com/continuedev/continue)). Search results reference Continue "Cloud Agents" and agent files under `.continue/agents/`, but **no first-party page was retrievable to confirm what they are or whether multiple coordinate**. UNVERIFIED, and the guide should say nothing about it until a page loads.

### F7. The internal baseline, for comparison

Given as ground truth, not researched here, and included because it is the only orchestration on this list with a track record under this owner.

- **This repository's own Claude Code session** has an `Agent` tool (dispatch one subagent with its own context) and a `Workflow` tool (script several agents in parallel, pipeline, or verification patterns). **SPIKE-33 was produced by a single `Agent` dispatch**, which is the fan-out-of-one case, and this spike by another.
- **Project 42** runs an ensemble content pipeline with researcher, writer, editor, verifier, and finalizer roles, six roles in total, of which **two remain unbuilt**.

Two observations follow. First, the pattern this owner actually uses in production is **role-specialised pipeline with a verification stage**, which maps onto CrewAI's sequential process, Agent Framework's sequential orchestration, and goose subrecipes far more closely than onto group chat or magentic. Second, the Project 42 ensemble is the concrete thing an orchestration platform on this account would be competing with or feeding, so "can it express researcher, writer, editor, verifier, finalizer with a different model per role" is the acceptance test that matters, not pattern count. On that test the shortlist is short: **OpenClaw, opencode, CrewAI, Agent Framework, and LangGraph** all document per-role model selection. goose does not document it, and OpenHands documents the opposite.

### F8. Cross-cutting traps

| Trap | Where it appeared |
|---|---|
| **Default concurrency above 1** | goose 10 workers, OpenClaw `maxConcurrent: 8`, OpenHands parallel threads, Agent Framework concurrent orchestration |
| **Every agent pays for every other agent's tokens** | Agent Framework group chat broadcasts full history each turn; Microsoft lists growing context as an antipattern |
| **The wire shape is chosen per model family, not per account** | OpenClaw's Foundry plugin defaults GPT, `o*`, and DeepSeek-V4 to Responses; SPIKE-33 never measured which deployments answer it |
| **A resource name is not an endpoint** | n8n's Azure credential composes a hostname; no base URL field is documented |
| **Hand-declared model metadata** | OpenClaw's `models[]` needs `contextWindow`, `maxTokens`, and `cost` typed in, the same gap SPIKE-32 found in the catalog |
| **The framework you are told to use is not the one in the tutorials** | Semantic Kernel and AutoGen both superseded; Foundry connected agents deprecated with a 2027 retirement date |
| **Skills and modes are not orchestration** | LangChain's `skills` pattern keeps "a single agent in control"; several vendors market this as multi-agent |

On cost specifically, the guide's existing warning needs one more sentence rather than a rewrite. Its current framing is that an agentic tool issues many calls per task. **Orchestration multiplies that by the fan-out width, and the fan-out width is a config value with a default nobody reads.** The concrete numbers to put in front of a reader: 10 (goose), 8 (OpenClaw), and 2 (the OpenHands sample), against six deployments already at 100 percent of their subscription quota per SPIKE-32.

---

## What this changes

1. **OpenClaw is a live option for this account and should be written up, not dismissed.** It is MIT, foundation-governed, model-agnostic, and ships a Microsoft Foundry plugin that names MAI-Image-2.5 explicitly. The guide currently does not mention it.
2. **The guide's agentic warning needs an orchestration tier above it.** Four tools it already documents (goose, opencode, OpenHands, Aider) can run several agents, and their concurrency defaults are the cost driver, not their per-call behaviour.
3. **"Agentic" and "orchestrating" should be two separate labels in the guide's tables.** Right now Aider and Cline carry the same label, and one of them runs two models in a pipeline while the other does not.
4. **Any ADR or backlog item naming Semantic Kernel or AutoGen as a candidate should be reworded to Agent Framework**, with the migration guides cited. Same for Foundry connected agents, which have a published retirement date of 31 March 2027.
5. **SPIKE-33's unmeasured Responses question is now blocking a second thing.** It was a Codex CLI footnote. It is now also the most likely first failure of an OpenClaw install, because that plugin defaults five of this account's deployments to the Responses wire shape. The one-curl-per-deployment test should be promoted out of the "unknown" list and actually run.
6. **opencode deserves a second entry in the guide.** It is currently listed as a terminal client. It is also the cheapest documented route to a multi-model, multi-role setup on this account.
7. **n8n should not be recommended until the hostname question is answered**, and if it is recommended, with the account-name form rather than the full endpoint URL.

## Update, 2026-08-06

The second row below was tested after this spike was written. `gpt-5-6-sol`, `gpt-5-6-terra`, `gpt-5-6-luna`, `deepseek-v4-pro`, and `deepseek-v4-flash`, the five deployments OpenClaw's Foundry plugin defaults to the Responses wire shape, all answer `POST /openai/v1/responses` with HTTP 200. The remaining deployments on this account were not tested. This does not resolve the OpenClaw-specific question in the row above it (whether the plugin itself resolves this account's deployment names correctly); it resolves only the underlying wire-shape question.

## What is still unknown

| Unknown | What would resolve it |
|---|---|
| Whether OpenClaw's `microsoft-foundry` provider resolves this account's deployment names against `services.ai.azure.com` | Install, configure one deployment, send one prompt |
| Which deployments answer `/openai/v1/responses` (inherited from SPIKE-33, now higher priority) | **Partially resolved 2026-08-06, see above.** One `curl` per deployment for the rest; `400 Model not supported` is the negative |
| Whether OpenAI acquired, hired from, or has any governance role in OpenClaw | A first-party OpenAI or OpenClaw Foundation announcement; the repository states only the foundation |
| Whether a goose subrecipe can pin its own model or provider | The recipe schema reference, or a recipe with a model field that does not error |
| Whether n8n composes `openai.azure.com` or `services.ai.azure.com` from the resource name | Configure the credential and read n8n's execution log |
| Whether Crush exposes user-configurable primary/subagent orchestration in a shipping build | A first-party doc page, or `crush --help` on a current install |
| What Continue's Cloud Agents are and whether they coordinate | Any retrievable page under `docs.continue.dev/agents` |
| Whether Agent Framework's `base_url` route works against this account without `azure_endpoint` and a credential | One agent run with `base_url` set to the v1 endpoint and a key |
| Whether OpenClaw's forced `supportsDeveloperRole: false` guard is sufficient for the `gpt-5-6-*` parameter mismatches, or whether `extra_body` is also needed | Send one request through each path and compare |
| Whether any of these frameworks send Entra bearer tokens correctly against this account, versus keys only | Per platform: configure a token and watch for `401` |

None of the above needs Azure write access. All are single requests or single local installs.

## Sources

Microsoft first-party:

- [Microsoft Agent Framework overview](https://learn.microsoft.com/agent-framework/overview/) - successor to Semantic Kernel and AutoGen.
- [Workflow orchestrations](https://learn.microsoft.com/agent-framework/workflows/orchestrations/) - the five named patterns.
- [Group Chat orchestration](https://learn.microsoft.com/agent-framework/workflows/orchestrations/group-chat) - full-history broadcast per turn.
- [Handoff orchestration](https://learn.microsoft.com/agent-framework/workflows/orchestrations/handoff) - triage plus specialist sample with an Azure client.
- [OpenAI-compatible endpoints](https://learn.microsoft.com/agent-framework/integrations/openai-endpoints?pivots=programming-language-python) - `base_url` on the generic clients, the Azure route, and the compatible-server table.
- [AzureOpenAIChatClient API reference](https://learn.microsoft.com/python/api/agent-framework-core/agent_framework.azure.azureopenaichatclient?view=agent-framework-python-latest)
- [Python 2026 significant changes](https://learn.microsoft.com/agent-framework/support/upgrade/python-2026-significant-changes) - client class renames.
- [Migration guide from AutoGen](https://learn.microsoft.com/agent-framework/migration-guide/from-autogen/) and [from Semantic Kernel](https://learn.microsoft.com/agent-framework/migration-guide/from-semantic-kernel/)
- [Semantic Kernel agent orchestration](https://learn.microsoft.com/semantic-kernel/frameworks/agent/agent-orchestration/) - same five patterns, marked experimental.
- [AI agent orchestration patterns](https://learn.microsoft.com/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - pattern selection, antipatterns, and the Foundry Agent Service caveat.
- [Connected agents (classic)](https://learn.microsoft.com/azure/foundry-classic/agents/how-to/connected-agents) - deprecation and the 31 March 2027 retirement date.
- [Connect to an A2A agent endpoint](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/agent-to-agent) - workflows as the replacement.
- [Transparency Note for Foundry Agent Service](https://learn.microsoft.com/azure/foundry/responsible-ai/agents/transparency-note) - multi-agent guidance and the Responses-API wireline-compatibility statement.
- [Azure OpenAI v1 API](https://learn.microsoft.com/azure/foundry/openai/api-version-lifecycle#code-changes) - both hostname forms accepted.

OpenClaw first-party:

- [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw) - MIT licence, OpenClaw Foundation governance, model-agnostic provider support.
- [Model providers](https://docs.openclaw.ai/concepts/model-providers) - custom `openai-completions` provider config, the non-native-endpoint compatibility guard, `extra_body`.
- [Microsoft Foundry plugin](https://docs.openclaw.ai/plugins/reference/microsoft-foundry) - `/openai/v1`, `microsoft-foundry/<deployment-name>`, Entra via Azure CLI, MAI image models and their constraints, per-family wire-shape defaults.
- [Tools overview](https://docs.openclaw.ai/tools) - the `subagents`, `agents_wait`, and `agents_list` tools.
- [Sub-agents reference](https://github.com/openclaw/openclaw/blob/main/docs/tools/subagents.md) - `sessions_spawn` semantics, spawn depth, per-spawn model override.
- [Configuration, agents](https://docs.openclaw.ai/gateway/config-agents) - multi-agent entries, per-agent models, the subagents concurrency block.

Other vendor first-party:

- [LangChain, AzureChatOpenAI integration](https://docs.langchain.com/oss/python/integrations/chat/azure_chat_openai) - the recommendation to use `ChatOpenAI` with an `/openai/v1/` base URL.
- [LangChain, multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent) - subagents, handoffs, skills, router, custom workflow.
- [langgraph-supervisor-py](https://github.com/langchain-ai/langgraph-supervisor-py) and [langgraph-swarm-py](https://github.com/langchain-ai/langgraph-swarm-py)
- [CrewAI, LLMs](https://docs.crewai.com/en/concepts/llms) and [CrewAI, Processes](https://docs.crewai.com/en/concepts/processes)
- [OpenAI Agents SDK, models](https://openai.github.io/openai-agents-python/models/) and [orchestrating multiple agents](https://openai.github.io/openai-agents-python/multi_agent/)
- [AG2, LLM configuration deep-dive](https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/llm-configuration-deep-dive/)
- [n8n, Azure OpenAI credentials](https://docs.n8n.io/integrations/builtin/credentials/azureopenai), [OpenAI credentials](https://docs.n8n.io/integrations/builtin/credentials/openai), [OpenAI Chat Model node](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/)
- [Dify, OpenAI-API-compatible plugin](https://marketplace.dify.ai/plugin/langgenius/openai_api_compatible) and [github.com/langgenius/dify](https://github.com/langgenius/dify)
- [goose, subrecipes](https://goose-docs.ai/docs/guides/recipes/subrecipes) and [running subrecipes in parallel](https://goose-docs.ai/docs/tutorials/subrecipes-in-parallel)
- [opencode, agents](https://opencode.ai/docs/agents/)
- [OpenHands, agent delegation example](https://github.com/OpenHands/software-agent-sdk/blob/main/examples/01_standalone_sdk/25_agent_delegation.py) - cited in place of the documentation page, which did not serve.
- [Aider, chat modes](https://aider.chat/docs/usage/modes.html) - architect and editor models.
- [charmbracelet/crush issue 1320](https://github.com/charmbracelet/crush/issues/1320) - an open feature request, cited as evidence of absence, not as documentation.
- [continuedev/continue](https://github.com/continuedev/continue) - cited for what it does say, given the agents pages did not serve.

Internal:

- [SPIKE-33](./SPIKE-33-client-tool-survey) - the client-tool baseline, the three wire shapes, and the unmeasured Responses question this spike inherits.
- [SPIKE-32](./SPIKE-32-model-region-availability-matrix) - deployment inventory, the six models at quota ceiling, and the missing published token limits.
- [Connect your tools](../guide/connect-your-tools) - the tools already documented, and the cost warning this spike extends.
- [Using your deployment](../guide/using-your-deployment) - endpoint, auth, and hostname mechanics.
