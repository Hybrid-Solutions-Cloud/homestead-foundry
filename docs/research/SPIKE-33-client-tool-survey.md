# SPIKE-33: Which client tools can point at this endpoint, and what each one gets wrong

Role: foundry-researcher (Opus). Status: research spike complete. Read-only: no Azure resources created, updated, or deleted, and **no inference call was made against the account**. This spike installed no software and incurred no spend. It is a documentation survey, not a bench test, and the difference matters: see the method section.
Date: 2026-08-06
Scope: a first-party-sourced survey of client tools across IDE, terminal, desktop, and self-hosted categories that can be pointed at an OpenAI-compatible custom endpoint, measured against the account this repository deploys. Deliberately broader than [Connect your tools](../guide/connect-your-tools), which is the consumer of this spike.

Depends on: [`SPIKE-32`](./SPIKE-32-model-region-availability-matrix) for what is actually deployed and what quota it holds, and on the two guide pages that are this spike's ground truth: [Using your deployment](../guide/using-your-deployment) for the endpoint mechanics, and [Connect your tools](../guide/connect-your-tools) for the tools already covered.

**Headline: the survey found twenty-three tools with a first-party-documented path to a custom endpoint, and fourteen of them are absent from the guide.** The more useful finding is a fault line the guide does not yet draw. Tools now split into **three** wire shapes, not two: the plain OpenAI Chat Completions shape the guide describes, the legacy Azure shape it warns about, and a third that has appeared since the guide was written - **Responses-API-only clients**. OpenAI's own Codex CLI is now in that third group, and its documented `wire_api` reference states `responses` is "the only supported value". Microsoft's own documentation says a deployment that does not support the Responses API returns `400 Model not supported`, so **Codex CLI's reach across this account is a per-deployment question with no answer in any document.**

The second finding is a pattern worth naming, because it repeats across five vendors independently: **the feature you most want to redirect is the one most likely to stay on the vendor's models.** Cursor's Tab, Tabnine's completions, Copilot's inline suggestions, JetBrains' next-edit suggestions, and Zed's Edit Prediction are all documented as staying put or requiring a separate configuration. The guide notes this for Cursor alone and reads as if Cursor is the exception. It is the rule.

---

## Question

1. Which prominent client tools, beyond the ten already in [Connect your tools](../guide/connect-your-tools), can be pointed at an OpenAI-compatible custom base URL, confirmed from the vendor's own documentation?
2. For each, does it want the **plain v1 shape** this account exposes, or the **legacy Azure path shape** (deployment in the URL plus `api-version`)?
3. Which are agentic, and therefore land in the cost warning the guide already carries?
4. Which have hardcoded parameters, path-rewriting behaviour, or features that stay on the vendor's own models regardless of the override?
5. Which prominent tools **cannot** do this, so the guide can say so rather than leaving a reader to discover it?

---

## Method, and the limit that matters most

Every tool below was accepted only on evidence from the vendor's own documentation, repository, or changelog. The URL is cited inline. Where the vendor's documentation was silent, the tool is marked **UNVERIFIED** and says what would settle it, rather than being written up from reputation.

::: danger This is a survey of claims, not a record of results
**Not one of these configurations was executed against
`aif-studioai-prod-eus-01`.** Every row is what a vendor says its tool does.
This repository has been burned enough times by the gap between the two that
the standing rule is worth restating here: *documentation is a claim, the API
is a fact.*

Three specific claims in this spike are the most likely to fail on contact:
whether a tool appends a path segment to the base URL you give it, whether
`/openai/v1/models` returns something a model picker can use, and whether a
given deployment answers the Responses API at all. All three are single-curl
questions and none of them were asked. Treat the table as a shortlist of what
to test, not as a compatibility guarantee.
:::

A second limit: tool vendors in this category ship weekly, and several changed
identity during this survey. Windsurf's documentation now redirects to
`docs.devin.ai` following the Cognition acquisition, Sourcegraph and Amp split
into separate companies on 2 December 2025, Kilo Code's documentation moved
host mid-survey, and OpenAI's Codex configuration reference now redirects to
`learn.chatgpt.com`. Every URL in the sources list resolved on 2026-08-06.

---

## Findings

### F1. Three wire shapes, not two

The guide's compatibility table has two rows for Azure (legacy and v1). The
survey found a third shape in active use, and it changes which tools can reach
which deployments.

| Shape | What the client sends | Which tools want it |
|---|---|---|
| **Plain OpenAI Chat Completions** | `POST {base}/chat/completions`, deployment in the `model` field, no `api-version` | The majority. Point them at `https://<account>.services.ai.azure.com/openai/v1/` |
| **Legacy Azure** | `POST {base}/openai/deployments/{name}/chat/completions?api-version=...` | Tools with a dedicated "Azure" provider: Tabnine, OpenHands, LibreChat, Msty, AnythingLLM's Azure provider, Crush's Azure mode |
| **Responses API** | `POST {base}/responses` | **OpenAI Codex CLI**, and JetBrains Junie's `OpenAIResponses` API type |

The third row is the new one. Microsoft documents the Responses API as working
with Azure OpenAI models and with Foundry Models sold by Azure "that support
it, such as DeepSeek, Llama, and Grok models," and states plainly: "If a
deployment doesn't support the Responses API, the request returns
`400 Model not supported`. In that case, use the Chat Completions API"
([Endpoints for Microsoft Foundry Models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/endpoints#azure-openai-inference-endpoint)).

That sentence is the whole problem for a Responses-only client. This account
carries roughly twenty deployments spanning Microsoft, xAI, DeepSeek, Moonshot,
Mistral, Meta, and Microsoft Research families. **Which of them answer
`/openai/v1/responses` is UNKNOWN and is not published anywhere.** It is one
`curl` per deployment to find out.

Microsoft also confirms the base URL is accepted in both hostname forms:
"`base_url` accepts both `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/`
and `https://YOUR-RESOURCE-NAME.services.ai.azure.com/openai/v1/` formats"
([v1 API](https://learn.microsoft.com/azure/foundry/openai/api-version-lifecycle#code-changes)),
which is what makes the plain-shape column viable at all.

### F2. The master table

Everything verified, in one place. "New" means absent from
[Connect your tools](../guide/connect-your-tools) as of this spike.

| Tool | Category | New | Shape it wants | Agentic | The catch |
|---|---|---|---|---|---|
| **JetBrains AI Assistant** | IDE | **yes** | plain v1 | no (chat) | Completion and next-edit stay on JetBrains models unless separately configured |
| **JetBrains Junie** | IDE agent | **yes** | plain v1, **full URL** | **yes** | `baseUrl` is the complete endpoint; Junie appends nothing |
| **Continue (JetBrains)** | IDE | **yes** | plain v1 | no by default | Continue's own README recommends its CLI over this plugin |
| **Continue CLI** | terminal | **yes** | plain v1 | **yes** | Same config surface as the extension |
| **Zed** | IDE | **yes** | plain v1 | **yes** (agent panel) | Models must be hand-listed; Edit Prediction is a separate provider |
| **Kilo Code** | VS Code ext | **yes** | plain v1, or its own `azure` provider | **yes** | Docs warn the generic provider breaks on Azure GPT-5 deployments |
| **VS Code Copilot Chat BYOK** | IDE | covered, thinly | legacy Azure (url + deployment id) | partly | Inline completions, semantic search, embeddings stay on GitHub |
| **Cursor** | IDE | covered | legacy Azure, or base-URL override | **yes** | Tab stays on Cursor's models, confirmed first-party |
| **Sourcegraph Cody** | IDE | **yes** | plain v1 (`openaicompatible`) or `azureOpenAI` | **yes** | **Enterprise-only since July 2025**; configured in site config by an admin |
| **Tabnine** | IDE | **yes** | legacy Azure (endpoint + Deployment ID) | no | **Enterprise admin only, and completions never use your model** |
| **Windsurf** | IDE | **yes**, negative | UNVERIFIED | yes | BYOK documented for vendor keys only; no first-party custom base URL found |
| **OpenAI Codex CLI** | terminal | **yes** | **Responses only** | **yes** | Reach depends on per-deployment Responses support |
| **Qwen Code** | terminal | **yes** | plain v1 | **yes** | Docs name Azure OpenAI explicitly as a supported endpoint |
| **Crush** (Charm) | terminal | **yes** | plain v1 (`openai-compat`) or Azure env vars | **yes** | `openai` type is reserved; use `openai-compat` |
| **opencode** | terminal | **yes** | plain v1 (`@ai-sdk/openai-compatible`) | **yes** | Azure mode wants deployment name to equal model name |
| **OpenHands** | terminal / web agent | **yes** | legacy Azure (`azure/<deployment>`) | **yes** | Needs `LLM_API_VERSION` set as an environment variable |
| **aichat** | terminal | **yes** | plain v1, or native `azure-openai` | no | Per-model capability flags are hand-declared |
| **llm** (Willison) | terminal | **yes** | plain v1 | no | Setting `api_base` stops the default OpenAI key being sent |
| **Warp** | terminal | **yes** | plain v1 | **yes** | Endpoint must be a **public** URL; localhost and private ranges rejected |
| **Jan** | desktop | **yes** | **plain v1, documented verbatim** | no | The closest first-party match to this account's shape |
| **Msty Studio** | desktop | **yes** | legacy-ish, `cognitiveservices` hostname | no | Model list shows models you have not deployed |
| **AnythingLLM** | self-hosted UI | **yes** | plain v1 (`OpenAI (Generic)`) or Azure provider | partly | Generic provider makes you type the context window by hand |
| **LibreChat** | self-hosted UI | covered, thinly | `azureOpenAI` with group config | no | Supports both `.openai.azure.com` and `.cognitiveservices.azure.com` |
| **LM Studio** | desktop | **yes**, negative | n/a | no | **It is a server, not a client. It cannot call your endpoint.** |

### F3. IDE tools

**JetBrains AI Assistant** has a documented OpenAI-compatible provider at
**Settings | Tools | AI Assistant | Providers & API keys**, described as being
for "services that expose an API compatible with the OpenAI API (for example,
llama.cpp or LiteLLM)". It takes a Base URL, an API Key, a Model name, a tool
calling toggle, and offers a test-connection action
([Use third-party and local models](https://www.jetbrains.com/help/ai-assistant/use-custom-models.html)).
Azure is not named as a provider, so this is the plain-shape route.

The limitation is the one that repeats everywhere: **code completion and next
edit suggestions rely on JetBrains models by default**, and use an
OpenAI-compatible provider only if separately configured under AI Completion.
Redirecting chat does not redirect completion.

**JetBrains Junie** is the more interesting entry, and it carries the single
most easily missed configuration detail in this survey. Junie's custom LLM
documentation lists four `apiType` values: `OpenAICompletion`, `OpenAIResponses`,
`Google`, and `Anthropic`, with `OpenAICompletion` described as "Compatible with
most self-hosted and third-party OpenAI-compatible endpoints." Then:

> "The `baseUrl` is used as the complete endpoint URL - Junie does not append a path to it."

([Custom LLMs, Junie documentation](https://junie.jetbrains.com/docs/custom-llm-models.html))

Every other tool in this survey takes a base and builds the rest. Junie takes
the finished URL. For this account that means supplying
`https://<account>.services.ai.azure.com/openai/v1/chat/completions` in full.
Give Junie the base URL the guide prints everywhere else and it will fail.

Junie's documentation also warns that it is agentic and "places high demands on
models", citing malformed tool calls and looping on weaker ones. Separately,
JetBrains' own issue tracker carries **LLM-22660**, titled "P1 BYOK in AI
Assistant: Junie Agent works only with OpenAI and Anthropic providers"
([youtrack.jetbrains.com](https://youtrack.jetbrains.com/projects/LLM/issues/LLM-22660/P1-BYOK-in-AI-Assistant-Junie-Agent-works-only-with-OpenAI-and-Anthropic-providers)).
That is an open defect report, not documentation, and the two sources appear to
disagree. **Which one describes the shipping build is UNVERIFIED.** Configuring
Junie against this account and observing the result is the only way to settle it.

**Continue for JetBrains is not a distinct product.** The Continue README states
plainly: "Continue is a coding agent available as a CLI, VS Code extension, and
JetBrains plugin" ([github.com/continuedev/continue](https://github.com/continuedev/continue)).
The `provider: openai` plus `apiBase` configuration the guide already prints is
the same configuration. Two things are worth carrying into the guide anyway.
First, **there is a Continue CLI** (`@continuedev/cli`), which belongs in the
terminal section the guide already has. Second, Continue's own README says "We
recommend using the Continue CLI instead of the JetBrains plugin" - the vendor
steering users off its own JetBrains surface is worth a reader knowing before
they install it.

**Zed** configures OpenAI-compatible providers under
`language_models.openai_compatible`, with the example given verbatim as:

```json
{
  "language_models": {
    "openai_compatible": {
      "my-provider": {
        "api_url": "https://example.com/v1",
        "available_models": [
          { "name": "my-model", "display_name": "My Model", "max_tokens": 128000 }
        ]
      }
    }
  }
}
```

([Zed, Use API Access](https://zed.dev/docs/ai/use-api-access)). Note
`available_models` is an explicit list: Zed does not discover deployments for
you, so each deployment is a hand-written entry with a hand-written
`max_tokens`. SPIKE-32 is directly relevant here, since **only 9 of 134 cloud
models publish a token limit in the catalog at all**, so most of those numbers
are a judgement rather than a lookup.

Zed's Edit Prediction is a separate provider block. Its default is "Zeta, an
open source model developed by Zed", and while the docs say you "can use local
or self-hosted edit prediction models through Ollama or any server that
implements the OpenAI **completion** API format"
([Zed, Edit Prediction](https://zed.dev/docs/ai/edit-prediction)), that is the
completion and fill-in-the-middle shape, not chat completions. **A chat
deployment on this account will not serve Zed's edit prediction**, and no
deployment on the account is a completion-format model.

**Kilo Code** contributes the most account-specific warning in the survey. Its
OpenAI Compatible provider takes a Provider ID, display name, Base URL, API key,
a manual or auto-fetched model list, and optional custom headers. But its
documentation says:

> "Do not use a custom OpenAI-compatible provider for Azure OpenAI GPT-5 deployments. Azure GPT-5 rejects the `max_tokens` parameter used by generic OpenAI-compatible providers and requires Azure-specific handling."

([Kilo Code, OpenAI Compatible](https://kilo.ai/docs/providers/openai-compatible))

This account runs `gpt-5-6-sol`, `gpt-5-6-terra`, and `gpt-5-6-luna`. This is
the same class of failure the guide already documents for temperature under
"When the tool sends something the model refuses", and the same class the model
gateway exists to repair, but with a different parameter. `max_tokens` was
superseded by `max_completion_tokens` on that model family. **Whether the
gateway currently rewrites `max_tokens` is UNKNOWN from this spike** and is a
question for whoever owns `docs/guide/model-gateway.md`.

**VS Code Copilot Chat** is already in the guide but described vaguely, and
Microsoft's own documentation is more precise than the guide is. Azure is a
listed BYOK provider, configured with an endpoint `url` such as
`https://<my-endpoint>.openai.azure.com`, a deployment name as `id`, and either
an API key or Entra ID. The limits are stated first-party:

> "Some features still require a GitHub account: semantic search, inline suggestions (code completions), and features that rely on embeddings. BYOK applies to the chat experience and utility tasks only."

BYOK models are also blocked in agent host sessions unless
`chat.agentHost.byokModels.enabled` is set
([VS Code, language models](https://code.visualstudio.com/docs/copilot/customization/language-models)).
That is a sharper statement than the guide's current "check what your installed
version offers", and it is from Microsoft rather than inferred.

**Cursor's** documentation confirms the guide's existing claim first-party.
Azure OpenAI is a supported custom-key provider ("Models deployed in your Azure
OpenAI Service instance"), and "Tab completion continues using Cursor's
built-in models" ([Cursor, API keys](https://cursor.com/docs/settings/api-keys)).

**Sourcegraph Cody** supports the widest provider list of any tool here.
`serverSideConfig` accepts `openaicompatible`, `azureOpenAI`, `awsBedrock`,
`anthropic`, `fireworks`, `google`, `openai`, and `huggingface-tgi`, with
`endpoint` or `url`, `accessToken`, and custom `headers` from Sourcegraph 6.4
onward, and third-party providers can serve **autocomplete as well as chat**
([Cody model configuration](https://sourcegraph.com/docs/cody/enterprise/model-configuration)).

The catch is commercial, not technical. Cody Free and Cody Pro were
discontinued on 23 July 2025 and users were pointed at Amp
([Changes to Cody Free, Pro, and Enterprise Starter plans](https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans)).
Cody is now an Enterprise product, and `modelConfiguration` is site
configuration set by an administrator on a Sourcegraph instance. **For a
personal deployment this is documented but not reachable**, and the guide
should say so rather than listing it as an option.

**Tabnine** is the clearest example of the pattern in the headline. Enterprise
admins can connect internal endpoints, choosing among Amazon Bedrock, GCP Vertex
AI, **Azure**, OpenAI, and OpenAI-Compatible. Azure asks for "Azure endpoint,
Key, Deployment ID", which is the legacy shape. And then:

> "Tabnine's code completions only use the **Tabnine Universal code completions model**, which is both private and protected."

([Tabnine models settings](https://docs.tabnine.com/main/administering-tabnine/managing-your-team/settings/models-settings))

Custom endpoints serve **chat only**. Tabnine is a completion-first product, so
pointing it at this account redirects the smaller half of what it does, and it
requires an Enterprise plan to do even that.

**Windsurf is the one negative result among the IDEs, and it is a soft
negative.** Windsurf's own documentation moved to `docs.devin.ai` after the
Cognition acquisition and the pages that survived the move cover model pricing,
not provider configuration. The Windsurf changelog documents BYOK as bringing
"your own API Key from Anthropic to use the Claude 4 Sonnet ... models in
Cascade" ([windsurf.com/changelog](https://windsurf.com/changelog)), which is a
vendor key for a vendor-hosted model, **not a custom base URL**. Several
third-party guides assert a `generic-chat-completion-api` provider exists.
**That claim is UNVERIFIED: no first-party page was found stating it**, and on
the standard this spike applies, it does not get written up as fact. What would
resolve it: a page under `docs.devin.ai` or `docs.windsurf.com` documenting a
custom provider block, or a screenshot of the setting in a current build.

### F4. Terminal tools

**OpenAI Codex CLI** is the significant addition and the significant caveat.
Its configuration reference documents `model_providers.<id>` with `base_url`,
`env_key`, `wire_api`, `query_params`, `http_headers`, and `env_http_headers`,
and describes `wire_api` as: "`responses` is the only supported value, and it is
the default when omitted"
([Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)).
The advanced page carries an Azure example verbatim:

```toml
[model_providers.azure]
name = "Azure"
base_url = "https://YOUR_PROJECT_NAME.openai.azure.com/openai"
env_key = "AZURE_OPENAI_API_KEY"
query_params = { api-version = "2025-04-01-preview" }
wire_api = "responses"
request_max_retries = 4
stream_max_retries = 10
stream_idle_timeout_ms = 300000
```

([Codex advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced))

Two things follow. First, against the v1 route the `base_url` should be
`.../openai/v1` and `query_params` should be unnecessary, since the v1 route is
implicitly versioned. **That variant is UNVERIFIED**; only the legacy-style
example above is documented. Second, and more consequentially, a
Responses-only client can only reach deployments that serve Responses, and per
Microsoft the rest return `400 Model not supported`. **Codex CLI's usable model
list on this account is a measurement nobody has taken.**

**Qwen Code** documents `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`
(aliased `QWEN_MODEL`) in `.qwen/.env` or a `providers` block with `baseUrl` in
`~/.qwen/settings.json`, and states the approach works for "OpenAI, Azure
OpenAI, OpenRouter, Requesty, ModelScope, Alibaba Cloud, [or] any
OpenAI-compatible endpoint"
([Qwen Code authentication](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/auth/)).
It is a Gemini-CLI-lineage agent and issues many calls per task.

**Crush** distinguishes two provider types, and the distinction is a trap:
`openai-compat` is the one for custom endpoints, while `openai` is reserved for
proxying real OpenAI. Providers are added with
`provider add <name> --type openai-compat --base-url <url> --api-key <key>`,
and models with `model add <provider>/<model> --name ... --context-window ...`.
For Azure specifically it reads `AZURE_OPENAI_API_ENDPOINT`,
`AZURE_OPENAI_API_KEY` (optional with Entra ID), and `AZURE_OPENAI_API_VERSION`
([github.com/charmbracelet/crush](https://github.com/charmbracelet/crush)). The
Entra ID note is worth flagging: it is one of the few tools in this survey that
documents keyless auth against Azure at all.

**opencode** takes a provider block naming the npm package to use:

```json
{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My AI Provider",
      "options": { "baseURL": "https://api.myprovider.com/v1" },
      "models": { "my-model-name": { "name": "My Model Display Name" } }
    }
  }
}
```

For Azure it uses `AZURE_RESOURCE_NAME` and requires the deployment name to
match the model name
([opencode providers](https://opencode.ai/docs/providers/)). That last
requirement is worth calling out: this repository's deployment names are
deliberately not vendor model ids, which is the exact mismatch that produces
`404 DeploymentNotFound`. The generic `openai-compatible` route avoids the
problem entirely.

**OpenHands** routes through LiteLLM and wants the legacy shape: a custom model
of `azure/<deployment-name>`, a base URL like
`https://example-endpoint.openai.azure.com`, an API key, and `LLM_API_VERSION`
set as an environment variable
([OpenHands, Azure](https://docs.openhands.dev/usage/llms/azure-llms)). It is
among the heaviest agents in this list.

**aichat** supports both shapes. `type: openai-compatible` takes `name`,
`api_base`, `api_key`, and a `models` list with per-model
`max_input_tokens`, `supports_function_calling`, and `supports_vision` flags;
`type: azure-openai` takes `api_base: https://{RESOURCE}.openai.azure.com`
([config.example.yaml](https://raw.githubusercontent.com/sigoden/aichat/main/config.example.yaml)).
It is a REPL and shell assistant rather than a coding agent, so it is the
cheapest terminal option here by a wide margin.

**llm** uses `extra-openai-models.yaml`:

```yaml
- model_id: orca-openai-compat
  model_name: orca-mini-3b.ggmlv3
  api_base: "http://localhost:8080"
  api_key_name: your-key-name
```

with the important note that when `api_base` is set, "the existing configured
openai API key will not be sent by default", so `api_key_name` is required
([llm, other models](https://llm.datasette.io/en/stable/other-models.html)).
`model_id` is the local alias and `model_name` is what goes on the wire, which
maps cleanly onto this repository's advice about labelling: prefix `model_id`
freely, never `model_name`. No Azure-specific support is documented, so this is
a plain-shape tool.

**Warp** is the one terminal tool here with an infrastructure precondition. Its
custom inference endpoint "expects your endpoint to implement the OpenAI Chat
Completions API (`POST /v1/chat/completions`)", keys are stored "only on your
device (in your OS keychain or equivalent secure storage)", and the endpoint
must be "reachable at a public URL", with private addresses and localhost
rejected ([Warp, custom inference endpoint](https://docs.warp.dev/agent-platform/inference/custom-inference-endpoint/)).
The public-URL rule is satisfied by this account but would block a
private-endpoint deployment, and it rules out pointing Warp at a locally run
gateway. **What is UNVERIFIED is the path arithmetic**: whether Warp appends
`/v1/chat/completions` to what you type, in which case the base is
`https://<account>.services.ai.azure.com/openai`, or appends only
`/chat/completions`, in which case it is the usual `/openai/v1`. This is
precisely the doubled-path failure the guide's troubleshooting table already
describes, and one request log settles it.

### F5. Desktop and self-hosted front ends

**Jan** is the closest first-party match to this account's exact shape found
anywhere in the survey. Its Azure documentation says to "set your **Base URL**
to your Azure OpenAI resource endpoint (e.g.
`https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1`)"
([Jan, Azure OpenAI](https://www.jan.ai/docs/desktop/remote-models/azure)).
That is the v1 route, in a vendor's own documentation, with no `api-version`
and no deployment in the path.

**Msty Studio** documents entering "the **Target URI** from the Azure OpenAI
Foundry portal into the **Base URL** field, mainly this portion:
`https://<your-resource-name>.cognitiveservices.azure.com/openai/`", or omitting
the base URL and supplying the resource name instead, and notes the API Version
field is "typically not required in Azure's latest API versions"
([Msty Studio, Azure OpenAI](https://docs.msty.ai/studio/how-tos/azure-openai)).
Two notes for the guide: this is the `cognitiveservices` hostname that
[Using your deployment](../guide/using-your-deployment) flags as the least
commonly accepted by third-party tools, so here the vendor documents the
hostname the repository steers people away from. And Msty warns that "all
models will be listed but you can only utilize the ones you've deployed", which
is a good example of a picker that will show a reader models this account does
not have.

**AnythingLLM** offers both a dedicated Azure OpenAI provider and an
`OpenAI (Generic)` provider described as "an easy way to interact with any LLM
provider that we do not explicitly integrate with and is OpenAi-compatible in
both API functionality and inference response"
([AnythingLLM, OpenAI Generic](https://docs.anythingllm.com/setup/llm-configuration/cloud/openai-generic)).
The generic provider's required fields are Base URL, API Key, Chat Model Name,
Token Context Window, and Max Tokens, with the caution that it "may not function
as intended if you input any configuration setting incorrectly". The two
hand-entered token figures are the same problem Zed has.

**LibreChat** is in the guide already but only as a one-line mention. Its
`endpoints.azureOpenAI` configuration is group-based, with `apiKey`,
`instanceName`, `deploymentName`, `version`, an optional `baseURL` supporting
`${INSTANCE_NAME}` and `${DEPLOYMENT_NAME}` placeholders, and a `serverless`
flag. Notably `instanceName` "supports both domain formats: .openai.azure.com
(legacy) and .cognitiveservices.azure.com (new)"
([LibreChat, Azure OpenAI](https://www.librechat.ai/docs/configuration/librechat_yaml/ai_endpoints/azure)).
Because `baseURL` is templatable, LibreChat can be driven into either shape.

**LM Studio does not belong on the list, and that is the finding.** Its
documentation describes serving: "Serve local models on OpenAI-like endpoints,
locally and on the network", and states LM Studio "can operate entirely offline"
([LM Studio docs](https://lmstudio.ai/docs)). **No first-party remote or cloud
provider feature is documented.** LM Studio is the *server* side of this
relationship, not the client side. Community plugins exist that route LM Studio
chats to a remote OpenAI-compatible provider, but they are third-party and this
spike does not certify them. The guide should list LM Studio explicitly as a
tool that cannot do this, next to Claude Code, because the assumption that a
local model UI can also front a remote endpoint is a natural one to make.

### F6. The cross-cutting traps

Five behaviours recurred often enough to be worth stating once rather than per
tool.

| Trap | Where it appeared |
|---|---|
| **Completion features stay on the vendor's model** | Cursor Tab, Tabnine completions, Copilot inline suggestions and embeddings, JetBrains completion and next-edit, Zed Edit Prediction |
| **The base URL is not a base** | Junie takes the complete URL; Warp expects `/v1/chat/completions`; Codex CLI's Azure example ends at `/openai` |
| **Hand-entered model metadata** | Zed `available_models` with `max_tokens`, AnythingLLM's context window and max tokens, Crush `--context-window`, aichat capability flags |
| **Hardcoded parameters the client will not let you change** | Kilo Code on `max_tokens` against Azure GPT-5; the guide already documents Copilot on `temperature` |
| **Deployment name versus model id** | opencode's Azure mode requires them to be equal; this repository's naming makes them different by design |

The first row deserves its own line in the guide. A reader who redirects chat
and then sees their editor still completing code has not misconfigured
anything: five separate vendors document that behaviour as intended.

On the agentic cost question the guide already raises, the survey adds
**twelve** more tools that issue many calls per task: Junie, Kilo Code, Zed's
agent panel, Cody, Codex CLI, Qwen Code, Crush, opencode, OpenHands, Continue
CLI, Warp's agent, and Cursor's agent mode. The guide's cost warning currently
names four. Every point in it applies unchanged to all of them, including the
one that matters most on this account: **deployment capacity is not a spend
control**, and SPIKE-32 showed six models on this subscription already sitting
at 100 percent of their real quota ceiling.

---

## What this changes

1. **The compatibility table in the guide needs a third row.** Responses-only
   clients exist, OpenAI ships one, and `400 Model not supported` is a distinct
   failure from `404 DeploymentNotFound`. It belongs in the troubleshooting
   table too.
2. **The Cursor Tab note should be generalised into its own section.** It is
   not a Cursor quirk. It is how five vendors ship, and a reader who thinks it
   is one vendor's quirk will misdiagnose four other tools.
3. **The guide should carry a short "cannot do this" list, not just Claude
   Code.** LM Studio and, on current evidence, Windsurf belong there. Naming
   what does not work is as useful as naming what does.
4. **The JetBrains category is missing entirely** and is the largest single
   gap: AI Assistant, Junie, and Continue's JetBrains plugin are three distinct
   configuration surfaces in one IDE family, exactly the situation the guide
   already warns about for VS Code.
5. **The terminal section can roughly triple.** It currently has two entries.
   Codex CLI, Qwen Code, Crush, opencode, OpenHands, aichat, llm, Warp, and the
   Continue CLI are all first-party documented.
6. **The Kilo Code `max_tokens` warning is account-specific and should be
   surfaced next to the existing temperature warning**, because this account
   runs three GPT-5-family deployments.
7. **Two enterprise-gated tools should be labelled as such rather than
   listed as options**: Cody is Enterprise-only since July 2025, and Tabnine's
   custom endpoints need an Enterprise plan and only serve chat.

## Update, 2026-08-06

The first row below was tested after this spike was written. `gpt-5-6-sol`, `gpt-5-6-terra`, `gpt-5-6-luna`, `deepseek-v4-pro`, and `deepseek-v4-flash` all answer `POST /openai/v1/responses` with HTTP 200. The remaining ~15 deployments on this account were not tested and remain unmeasured. See [Connect your tools](../guide/connect-your-tools#the-one-thing-that-makes-this-work) for where this is now recorded.

## What is still unknown

| Unknown | What would resolve it |
|---|---|
| Which deployments on this account answer `/openai/v1/responses` | **Partially resolved 2026-08-06, see above.** One `curl` per deployment against the Responses route for the rest; a `400 Model not supported` is the negative |
| Whether Codex CLI works against `.../openai/v1` with no `query_params` | Configure the provider that way and run one prompt |
| Whether `GET /openai/v1/models` returns this account's deployments in a form a model picker can use | `curl` the route and inspect the ids; the REST reference documents the route but not what an AIServices account returns |
| Whether Warp appends `/v1/chat/completions` or `/chat/completions` to the URL you supply | Configure it and read the request log, or watch account metrics for the hostname |
| Whether Windsurf has any custom base URL setting in a current build | A first-party page under `docs.devin.ai`, or the setting itself in a current install |
| Whether Junie's `OpenAICompletion` type actually accepts a non-OpenAI, non-Anthropic endpoint, given YouTrack LLM-22660 | Configure Junie against this account and observe |
| Whether the deployed model gateway rewrites `max_tokens` to `max_completion_tokens`, not just `temperature` | Read the gateway's transform list; send a `max_tokens` request through it to a `gpt-5-6-*` deployment |
| Whether any of these tools send Entra bearer tokens correctly, versus keys only | Per tool: configure a token and watch for `401` |
| Whether JetBrains AI Assistant appends a path to its Base URL field | Its request log, or a deliberate doubled-path test |

None of the above needs Azure write access. All of them are single requests
against an existing deployment.

## Sources

Microsoft first-party:

- [Endpoints for Microsoft Foundry Models](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/endpoints#azure-openai-inference-endpoint) - the v1 route, implicit versioning, deployment name in the `model` field, and the `400 Model not supported` behaviour for Responses.
- [Azure OpenAI in Microsoft Foundry Models v1 API](https://learn.microsoft.com/azure/foundry/openai/api-version-lifecycle#code-changes) - `base_url` accepts both the `openai.azure.com` and `services.ai.azure.com` forms; `api-version` no longer required.
- [Azure OpenAI models, List models](https://learn.microsoft.com/rest/api/microsoft-foundry/azureopenai/models#list-models) - `GET {endpoint}/openai/v1/models`.
- [Azure OpenAI responses reference](https://learn.microsoft.com/rest/api/microsoft-foundry/azureopenai/responses#create-response) - `POST {endpoint}/openai/v1/responses`.
- [VS Code, use your own language model key](https://code.visualstudio.com/docs/copilot/customization/language-models) - Azure as a BYOK provider, and what BYOK does not cover.

Vendor first-party, IDE:

- [JetBrains AI Assistant, use third-party and local models](https://www.jetbrains.com/help/ai-assistant/use-custom-models.html)
- [JetBrains Junie, custom LLMs](https://junie.jetbrains.com/docs/custom-llm-models.html)
- [JetBrains YouTrack LLM-22660](https://youtrack.jetbrains.com/projects/LLM/issues/LLM-22660/P1-BYOK-in-AI-Assistant-Junie-Agent-works-only-with-OpenAI-and-Anthropic-providers) - an open issue, cited as a contradicting report, not as documentation.
- [Continue README](https://github.com/continuedev/continue) - CLI, VS Code, JetBrains.
- [Zed, use API access](https://zed.dev/docs/ai/use-api-access) and [Zed, edit prediction](https://zed.dev/docs/ai/edit-prediction)
- [Kilo Code, OpenAI Compatible provider](https://kilo.ai/docs/providers/openai-compatible)
- [Cursor, API keys](https://cursor.com/docs/settings/api-keys)
- [Sourcegraph Cody, model configuration](https://sourcegraph.com/docs/cody/enterprise/model-configuration) and [Changes to Cody Free, Pro, and Enterprise Starter plans](https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans)
- [Tabnine, models settings](https://docs.tabnine.com/main/administering-tabnine/managing-your-team/settings/models-settings)
- [Windsurf changelog](https://windsurf.com/changelog) - BYOK for vendor keys; no custom base URL documented.

Vendor first-party, terminal:

- [Codex CLI configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) and [advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
- [Qwen Code authentication](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/auth/)
- [Crush](https://github.com/charmbracelet/crush)
- [opencode providers](https://opencode.ai/docs/providers/)
- [OpenHands, Azure LLMs](https://docs.openhands.dev/usage/llms/azure-llms) and [custom LLM configs](https://docs.openhands.dev/usage/llms/custom-llm-configs)
- [aichat config.example.yaml](https://raw.githubusercontent.com/sigoden/aichat/main/config.example.yaml)
- [llm, other models](https://llm.datasette.io/en/stable/other-models.html)
- [Warp, custom inference endpoint](https://docs.warp.dev/agent-platform/inference/custom-inference-endpoint/) and [bring your own API key](https://docs.warp.dev/agent-platform/inference/bring-your-own-api-key/)

Vendor first-party, desktop and self-hosted:

- [Jan, Azure OpenAI](https://www.jan.ai/docs/desktop/remote-models/azure)
- [Msty Studio, Azure OpenAI](https://docs.msty.ai/studio/how-tos/azure-openai)
- [AnythingLLM, OpenAI (Generic)](https://docs.anythingllm.com/setup/llm-configuration/cloud/openai-generic) and [Azure OpenAI](https://docs.anythingllm.com/setup/llm-configuration/cloud/azure-openai)
- [LibreChat, Azure OpenAI](https://www.librechat.ai/docs/configuration/librechat_yaml/ai_endpoints/azure)
- [LM Studio developer docs](https://lmstudio.ai/docs) - cited for the absence of a remote provider feature.

Internal:

- [Connect your tools](../guide/connect-your-tools) - the baseline this spike extends.
- [Using your deployment](../guide/using-your-deployment) - endpoint, auth, and hostname mechanics.
- [SPIKE-32](./SPIKE-32-model-region-availability-matrix) - deployment inventory, quota state, and the published-token-limit gap that makes hand-entered context windows a guess.
