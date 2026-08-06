# Connect your tools

How to point VS Code, Cursor, terminal agents, and other AI clients at the models you deployed, so your editor or terminal talks to your own Azure endpoint instead of a vendor's.

Read [Using your deployment](./using-your-deployment.md) first and get one `curl` call working. **If curl does not work, no tool will.** Every configuration on this page is the same three values you already used.

## The one thing that makes this work

Historically, connecting a generic OpenAI client to Azure was painful, because Azure's URL shape was different from OpenAI's:

| | URL shape | Deployment goes | `api-version` |
|---|---|---|---|
| OpenAI | `{base}/v1/chat/completions` | in the `model` body field | not used |
| Azure, legacy | `{base}/openai/deployments/{name}/chat/completions` | in the **URL path** | **required** |
| **Azure, v1 API** | `{base}/openai/v1/chat/completions` | in the `model` body field | optional |
| **Azure, Responses API** | `{base}/openai/v1/responses` | in the `model` body field | optional |

The v1 API removes both incompatibilities. The deployment name moved into the body and `api-version` became optional, so the request is shaped exactly like an OpenAI request. Azure also accepts the API key in a plain `Authorization: Bearer` header, not just its own `api-key` header.

**The practical consequence: any tool with a configurable base URL should work, for the tools that speak Chat Completions.** A fourth category exists that this trick does not cover: **Responses-only clients**, most notably OpenAI's own Codex CLI, which documents `wire_api = "responses"` as its only supported value. Microsoft states that "if a deployment doesn't support the Responses API, the request returns `400 Model not supported`."

::: tip Measured, 2026-08-06
`gpt-5-6-sol`, `gpt-5-6-terra`, `gpt-5-6-luna`, `deepseek-v4-pro`, and `deepseek-v4-flash` all answer `POST /openai/v1/responses` with HTTP 200. This was an open question in [SPIKE-33](../research/SPIKE-33-client-tool-survey) and [SPIKE-34](../research/SPIKE-34-orchestration-options); it is now resolved for these five deployments by direct test, not inferred from documentation. The remaining deployments on this account have not been tested.
:::

Your three values, every time:

| Setting | Value |
|---|---|
| Base URL | `https://<account>.services.ai.azure.com/openai/v1/` |
| API key | Account key, or an Entra bearer token |
| Model | Your **deployment name** (from `az cognitiveservices account deployment list`) |

::: warning Verify per tool, do not assume
Client tools change fast and their Azure handling varies. The configurations below follow each tool's documented custom-endpoint mechanism, but **treat any tool as unverified until you have seen it return a completion from your endpoint.** Where a tool rewrites paths or forces its own URL suffix, it may not work regardless of correct settings. Test with the checklist at the bottom.
:::

## The completion feature usually does not move

This is not a Cursor quirk. It recurs across five independently documented tools: Cursor's Tab, Tabnine's code completions, GitHub Copilot's inline suggestions and embeddings, JetBrains' code completion and next-edit suggestions, and Zed's Edit Prediction all stay on the vendor's own models even after you redirect chat, because each is a first-party-documented separate code path.

**Redirecting chat does not redirect completion.** If your editor keeps completing code from somewhere other than your endpoint after you have configured everything correctly, this is why, not a misconfiguration. Some tools (JetBrains AI Assistant) let you point completion at your endpoint too, as a second, separate setting. Most do not.

## VS Code

Two routes, depending on what you want.

::: warning First, know which surface you are configuring
VS Code has no single model list. **Each extension keeps its own, and a
configuration written for one is invisible in the others.** Copilot Chat, Continue,
Cline, Roo and Cursor are five separate configuration surfaces.

This bites in a specific way: you configure Continue, open the **Copilot** picker,
see none of your models, and conclude the endpoint is broken. It is not. You are
reading a different list.

Check what is actually installed before configuring anything:

```bash
code --list-extensions
```

Then configure the surface you actually use.
:::

### Telling your models apart from everything else in the picker

A populated Copilot picker is crowded, and **most of what is in it is not yours.**
A typical list contains:

| What you see | Where it comes from | Yours? |
|---|---|---|
| Claude models | GitHub-hosted, billed by your Copilot subscription | no |
| Two near-identical Copilot groups | GitHub-hosted | no |
| A DeepSeek entry | often a third-party extension, for example `vizards.deepseek-v4-for-copilot` | no |
| A second DeepSeek | GitHub-hosted | no |
| A model with a **red X** and a fetch error | a hosted model failing to load | no |
| An **"AI Foundry"** section | the `ms-azuretools.vscode-azure-github-copilot` extension | **yes, once you fill it in** |

**An empty "AI Foundry" section is the normal state before configuration.** The
extension has registered the provider and has no endpoint or key yet. That section,
once populated, is the only place your own deployments appear.

**In Continue you can prefix the display name and end the guessing.** Continue's
`name` field is a free-text label, so a prefix such as `hcs-` sorts your
deployments together and makes them unmistakable:

```yaml
models:
  - name: hcs-<your-deployment-name> (<vendor>)   # label only, prefix freely
    provider: openai
    model: <your-deployment-name>                  # WIRE VALUE, never prefix this
```

**Never prefix `model`.** That value goes to Azure, and a decorated one returns
`404 DeploymentNotFound`. Copilot, Cursor and Cline take their labels from the
provider and cannot be renamed this way; renaming there means renaming the Azure
deployments themselves, which changes the real identifier for every consumer.

### GitHub Copilot Chat, bring your own key

Copilot Chat supports adding model providers with your own key. Choose the OpenAI-compatible or Azure provider option, then supply the base URL and key above. Open the model picker in the Chat view and select **Manage Models**, then follow the provider prompts.

Because Copilot's provider list and BYOK flow change between releases, check what your installed version offers before assuming a given provider entry exists. Microsoft's own documentation is more precise than that advice on what BYOK does and does not cover:

> "Some features still require a GitHub account: semantic search, inline suggestions (code completions), and features that rely on embeddings. BYOK applies to the chat experience and utility tasks only."
>
> Source: [VS Code, use your own language model key](https://code.visualstudio.com/docs/copilot/customization/language-models)

BYOK models are also blocked in **agent host sessions** unless `chat.agentHost.byokModels.enabled` is set. If Copilot's agent mode is not offering your model at all, check that setting before assuming the provider is broken.

### Continue.dev (most reliable, fully configurable)

Continue is an open-source VS Code and JetBrains extension with explicit OpenAI-compatible support, which makes it the lowest-friction option. Edit its config:

```yaml
models:
  - name: My Foundry reasoning model
    provider: openai
    model: <your-deployment-name>
    apiBase: https://<account>.services.ai.azure.com/openai/v1/
    apiKey: <your-key>
    roles:
      - chat
      - edit
```

The important field is `apiBase`. `provider: openai` tells Continue to speak plain OpenAI protocol rather than Azure's legacy path shape, which is what you want against the v1 API.

## JetBrains

Three distinct configuration surfaces live inside one IDE family, the same situation VS Code has. Check which one you actually mean before configuring anything.

### JetBrains AI Assistant

**Settings | Tools | AI Assistant | Providers & API keys** has a documented OpenAI-compatible provider, described by JetBrains as being for "services that expose an API compatible with the OpenAI API." It takes a Base URL, API Key, Model name, a tool-calling toggle, and a test-connection action. Azure is not named as a distinct provider, so this is the plain v1 route.

Code completion and next-edit suggestions default to JetBrains' own models regardless of this setting; redirect those separately under AI Completion if you want them on your endpoint too.

### JetBrains Junie

Junie is agentic, and it carries the single easiest-to-miss detail in this whole guide. Its `apiType: OpenAICompletion` accepts a custom endpoint, but:

> "The `baseUrl` is used as the complete endpoint URL. Junie does not append a path to it."
>
> Source: [Junie, custom LLMs](https://junie.jetbrains.com/docs/custom-llm-models.html)

Every other tool on this page takes a base and builds the rest. **Junie takes the finished URL.** Give it `https://<account>.services.ai.azure.com/openai/v1/chat/completions` in full, not the bare base you use everywhere else, or it will fail.

::: warning Conflicting reports, unresolved
JetBrains' own issue tracker carries an open defect, [LLM-22660](https://youtrack.jetbrains.com/projects/LLM/issues/LLM-22660/P1-BYOK-in-AI-Assistant-Junie-Agent-works-only-with-OpenAI-and-Anthropic-providers), stating the Junie agent works only with OpenAI and Anthropic providers, which would contradict the documentation above. Which one describes the shipping build is unverified. Configure it and watch what actually happens.
:::

### Continue for JetBrains

Not a distinct product: same `provider: openai` plus `apiBase` configuration as [Continue.dev](#continuedev-most-reliable-fully-configurable) below, delivered as a JetBrains plugin. Worth knowing before installing it: Continue's own README says "We recommend using the Continue CLI instead of the JetBrains plugin." See [Continue CLI](#continue-cli) under terminal tools.

## Cursor

Cursor supports an OpenAI-compatible override in **Settings > Models**:

1. Enable **Override OpenAI Base URL** and set it to `https://<account>.services.ai.azure.com/openai/v1/`.
2. Put your account key in the OpenAI API key field.
3. Add a custom model whose name is **exactly your deployment name**, and disable the built-in models you are not using so Cursor does not route to them.
4. Verify the key, which sends a real request. If it fails, your base URL or model name is wrong.

Cursor also ships an Azure integration that expects the legacy path shape. If you use that instead of the base-URL override, supply the Azure deployment name where it asks for one rather than a vendor model id.

Cursor confirms first-party that "Tab completion continues using Cursor's built-in models" regardless of your override. This is the general rule described above, not a Cursor-specific limitation. Chat is what you are redirecting here.

## Cline and Roo Code

Both are VS Code agent extensions with a first-class **OpenAI Compatible** provider. Select it and fill in:

- Base URL: `https://<account>.services.ai.azure.com/openai/v1/`
- API key: your account key
- Model ID: your deployment name

These extensions are agentic and will issue many calls per task. Read the cost warning below before pointing one at your endpoint.

## Zed

Zed configures OpenAI-compatible providers under `language_models.openai_compatible`, with the vendor's own example given verbatim:

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

Set `api_url` to `https://<account>.services.ai.azure.com/openai/v1` and add one entry per deployment under `available_models`. **Zed does not discover deployments for you.** Each one is a hand-written entry with a hand-written `max_tokens`, and only 9 of 134 cloud models in this account's catalog publish a real token limit (see [SPIKE-32](../research/SPIKE-32-model-region-availability-matrix)), so most of those numbers will be a judgement call, not a lookup.

Zed's agent panel is agentic; read the cost warning below before pointing it at your endpoint. Zed's **Edit Prediction** feature is a separate provider block and defaults to Zed's own model. It accepts an OpenAI-compatible **completion** (fill-in-the-middle) endpoint, not chat completions. No deployment on this account is that shape, so Edit Prediction cannot be redirected here regardless of configuration.

## Kilo Code

A VS Code extension with a first-class OpenAI Compatible provider: Provider ID, Base URL, API key, and a manual or auto-fetched model list.

::: danger Do not use the generic provider against gpt-5-6-*
Kilo Code's own documentation says: "Do not use a custom OpenAI-compatible provider for Azure OpenAI GPT-5 deployments. Azure GPT-5 rejects the `max_tokens` parameter used by generic OpenAI-compatible providers and requires Azure-specific handling."

This account runs `gpt-5-6-sol`, `gpt-5-6-terra`, and `gpt-5-6-luna`. This is the same class of failure documented below for Copilot and `temperature`: a client hardcodes a parameter the model rejects. Here the parameter is `max_tokens`, which that model family replaced with `max_completion_tokens`. Whether the [model gateway](./model-gateway) already repairs this the same way it repairs `temperature` is unconfirmed; the gateway's retry logic strips whatever parameter Azure's error names, so it should, but this has not been tested against `max_tokens` specifically. Use Kilo Code's own `azure` provider mode against the three `gpt-5-6-*` deployments instead of the generic OpenAI-compatible one.
:::

## Antigravity and other newer agent IDEs

Newer agentic editors generally expose either an OpenAI-compatible endpoint override or a custom-provider block. The values are the same three. What varies is whether the tool appends its own path segment to your base URL.

If the tool has a request log or debug console, check the exact URL it produces. You want:

```
https://<account>.services.ai.azure.com/openai/v1/chat/completions
```

If you see a doubled path (`/openai/v1/v1/chat/completions`) or the deployment name in the URL path, the tool is rewriting your base URL. Try supplying the base without the trailing `/openai/v1/` or without the trailing slash, depending on which direction it is wrong.

## Enterprise-gated tools

Two prominent tools document a path to a custom endpoint that is not reachable from a personal deployment. Listed here so a reader does not spend time chasing either as an option.

**Sourcegraph Cody** has the widest documented provider list of any tool surveyed for this guide (`openaicompatible`, `azureOpenAI`, and others), but Cody Free and Cody Pro were discontinued 23 July 2025. It is now Enterprise-only, and its `modelConfiguration` is site configuration set by an administrator on a Sourcegraph instance, not a per-user setting.

**Tabnine** can connect an Azure endpoint (`Azure endpoint, Key, Deployment ID`, the legacy shape), but only on an Enterprise plan, configured by an admin. Its own documentation adds a second limit that matters even on Enterprise: "Tabnine's code completions only use the Tabnine Universal code completions model, which is both private and protected." A custom endpoint only ever serves Tabnine's chat, never its completions.

## Console and CLI tools

Everything above runs inside an editor. These run in a terminal instead, the same way Claude Code does. They are a separate tool family, though, not a Claude Code configuration.

::: warning Claude Code cannot point at these deployments
Claude Code speaks Anthropic's Messages API, not the OpenAI-shaped API these
deployments expose. `ANTHROPIC_BASE_URL` redirects Claude Code to another
**Anthropic-compatible** endpoint, such as Bedrock, Vertex, or a proxy that
translates the wire format. It does not make Claude Code speak to an Azure
OpenAI-shaped deployment. There is no setting that connects Claude Code
directly to `gpt-5-6-sol`, `grok-4-3`, `deepseek-v4-pro`, or any other
deployment on this account. That is a protocol boundary, not a missing
feature or a configuration gap.

The two tools below are the actual terminal equivalents: OpenAI-API-native CLI
agents that take the same three values as everything else on this page.
:::

### Aider

The most mature terminal coding agent for this, with native Azure support. Its architect mode is a small **orchestrator**, not just an agent: it runs two models in a fixed pipeline, one proposing a solution and a second turning that proposal into file edits. See [Building agents](./building-agents.md#already-in-your-toolset) for the config and the wider orchestration picture.

```bash
# Mac/Linux
export AZURE_API_KEY=<your-key>
export AZURE_API_VERSION=2024-12-01-preview
export AZURE_API_BASE=https://<account>.services.ai.azure.com

aider --model azure/<your-deployment-name>
```

```powershell
# Windows, then restart the shell before running aider
setx AZURE_API_KEY "<your-key>"
setx AZURE_API_VERSION "2024-12-01-preview"
setx AZURE_API_BASE "https://<account>.services.ai.azure.com"
```

`AZURE_API_BASE` takes the **account hostname only**, not the full
`/openai/v1/` path; Aider builds the rest itself. `aider --list-models azure/`
lists everything Aider knows how to reach through Azure in general, not what
exists on your account. For that, use
`az cognitiveservices account deployment list`.

### goose

Open-source terminal agent from Block, and a real **orchestrator**: its subrecipes run in isolated sessions with up to 10 concurrent workers, not just one agent looping tool calls. See [Building agents](./building-agents.md#already-in-your-toolset) before turning that on against a deployment near its quota ceiling. Configure through
`goose configure` > Configure Providers > the OpenAI-compatible provider, or
set the environment directly:

```bash
export OPENAI_HOST=https://<account>.services.ai.azure.com
export OPENAI_BASE_PATH=openai/v1/chat/completions
export OPENAI_API_KEY=<your-key>
```

Set the model to your deployment name when goose prompts for one.

### OpenAI Codex CLI

::: warning Responses API only
Codex CLI's `wire_api` setting documents `responses` as "the only supported value, and it is the default when omitted." It cannot speak plain Chat Completions. Per the compatibility note at the top of this page, a deployment that does not support the Responses API returns `400 Model not supported`, not a graceful fallback. **Measured 2026-08-06: `gpt-5-6-sol/terra/luna` and `deepseek-v4-pro/flash` all answer `/openai/v1/responses` with HTTP 200.** The rest of this account's roughly twenty deployments have not been tested individually; run the same one-`curl`-per-deployment check before relying on Codex CLI against anything outside that list of five.
:::

Codex's documented Azure example uses the legacy shape:

```toml
[model_providers.azure]
name = "Azure"
base_url = "https://YOUR_PROJECT_NAME.openai.azure.com/openai"
env_key = "AZURE_OPENAI_API_KEY"
query_params = { api-version = "2025-04-01-preview" }
wire_api = "responses"
```

Whether pointing `base_url` at `.../openai/v1` and dropping `query_params` also works, the way it does for Chat Completions clients elsewhere on this page, is not documented and has not been tested.

### Qwen Code

Documents `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` in `.qwen/.env` (or a `providers` block in `~/.qwen/settings.json`), and names Azure OpenAI explicitly as a supported endpoint. Set `OPENAI_BASE_URL` to the v1 endpoint. It is agentic; read the cost warning below first.

### Crush

Charm's terminal agent. The provider type name is the trap: `openai-compat` is for custom endpoints, `openai` is reserved for proxying real OpenAI. Add yours with:

```bash
crush provider add hcs-foundry --type openai-compat --base-url https://<account>.services.ai.azure.com/openai/v1/ --api-key <your-key>
crush model add hcs-foundry/<your-deployment-name> --name "<label>" --context-window <n>
```

Crush also has native Azure environment variables (`AZURE_OPENAI_API_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`) and is one of the few tools surveyed that documents keyless Entra ID auth against Azure.

### opencode

Also an **orchestrator**, and the cleanest one already in this guide: primary agents can invoke subagents, and each agent takes its own `model` override, so one config can route a planning role to one deployment and a worker role to another. See [Building agents](./building-agents.md#already-in-your-toolset) for the multi-model config. Provider block naming the npm package to use:

```json
{
  "provider": {
    "hcs-foundry": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "HCS Foundry",
      "options": { "baseURL": "https://<account>.services.ai.azure.com/openai/v1" },
      "models": { "<your-deployment-name>": { "name": "<label>" } }
    }
  }
}
```

opencode's dedicated Azure mode requires the deployment name to equal the vendor model id, which this account's naming deliberately avoids (see [Telling your models apart](#telling-your-models-apart-from-everything-else-in-the-picker)). The generic `openai-compatible` route above sidesteps that requirement entirely. Use it, not the Azure mode.

### OpenHands

Routes through LiteLLM. Wants a model of `azure/<your-deployment-name>`, a base URL, an API key, and `LLM_API_VERSION` set as an environment variable: the legacy shape. It is among the heaviest agents surveyed for calls per task, and it orchestrates too: its `DelegateTool` spawns and delegates to sub-agents in parallel threads. Those sub-agents inherit the parent's model rather than taking their own, so the fan-out lands entirely on one quota bucket. See [Building agents](./building-agents.md#already-in-your-toolset).

### aichat

The cheapest terminal option surveyed, a REPL and shell assistant rather than a coding agent. `type: openai-compatible` takes `api_base`, `api_key`, and a `models` list with hand-declared `max_input_tokens` and capability flags per model.

### llm (Simon Willison)

Configured through `extra-openai-models.yaml`:

```yaml
- model_id: hcs-foundry-model
  model_name: <your-deployment-name>
  api_base: "https://<account>.services.ai.azure.com/openai/v1"
  api_key_name: hcs-foundry-key
```

Setting `api_base` stops `llm`'s default OpenAI key from being sent automatically, so `api_key_name` (referencing a key stored with `llm keys set`) is required. `model_id` is the local alias, prefix it freely; `model_name` is the wire value that must be the exact deployment name, the same rule as everywhere else on this page.

### Warp

Warp's custom inference endpoint documents keys stored only in the OS keychain, never synced, and one hard precondition: the endpoint **must be reachable at a public URL**. Private ranges and `localhost` are rejected outright, which also rules out pointing Warp at a locally run [model gateway](./model-gateway). This account's endpoint is public, so that precondition is satisfied. What is unverified is the path arithmetic, whether Warp appends `/v1/chat/completions` or only `/chat/completions` to what you type, so check its request log for a doubled path the first time you configure it.

### Continue CLI

Same configuration surface as the [VS Code extension](#continuedev-most-reliable-fully-configurable) above (`provider: openai`, `apiBase`), packaged as `@continuedev/cli` instead of a plugin. Agentic; read the cost warning below.

### Anything else that runs in a terminal

Same recipe as [Anything else](#anything-else) below: find its custom base
URL setting, point it at the v1 endpoint, and verify with a real completion
before trusting it.

## Desktop apps

**Jan** documents the exact shape this account uses, verbatim, in its own Azure guide: set the Base URL "to your Azure OpenAI resource endpoint (e.g. `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1`)." That is the v1 route, first-party, with no `api-version` and no deployment in the path: the closest documented match found for this account's shape anywhere in the survey.

**Msty Studio** wants the **Target URI** from the Azure portal, mainly the portion `https://<your-resource-name>.cognitiveservices.azure.com/openai/`, and notes the API Version field is "typically not required" on current API versions. This is the `cognitiveservices` hostname that [Using your deployment](./using-your-deployment) flags as the one third-party tools accept least reliably. Here a vendor documents it directly, so it is worth trying if the `services.ai.azure.com` form does not work in Msty specifically. Msty also warns that "all models will be listed but you can only utilize the ones you've deployed": expect to see entries in the picker for models this account does not have.

**AnythingLLM** offers both a dedicated Azure OpenAI provider and an `OpenAI (Generic)` provider for the plain v1 route. The generic provider requires Base URL, API Key, Chat Model Name, Token Context Window, and Max Tokens entered by hand, the same hand-entered-metadata problem as Zed above, and AnythingLLM's own documentation cautions it "may not function as intended if you input any configuration setting incorrectly."

## Open WebUI, LibreChat, and other self-hosted front ends

These are typically the easiest, because they are built around an OpenAI-compatible base URL. In Open WebUI, add an OpenAI-compatible connection with your base URL and key, and the model list should populate from your deployments.

**LibreChat**'s `endpoints.azureOpenAI` configuration is group-based: `apiKey`, `instanceName`, `deploymentName`, `version`, and an optional templatable `baseURL` supporting `${INSTANCE_NAME}` and `${DEPLOYMENT_NAME}` placeholders. Its `instanceName` field "supports both domain formats: .openai.azure.com (legacy) and .cognitiveservices.azure.com (new)," so either hostname this repository's docs use will work.

## Tools that cannot do this

Naming what does not work is as useful as naming what does. These are natural assumptions that turn out to be wrong.

**Claude Code** cannot point at these deployments; see the warning under [Console and CLI tools](#console-and-cli-tools) above. A protocol boundary, not a missing feature.

**LM Studio** is the server side of this relationship, not the client side. Its own documentation describes serving local models on OpenAI-like endpoints and operating offline; it has no documented feature for calling a *remote* OpenAI-compatible provider. It is easy to assume a tool that speaks OpenAI's API can also consume one, and LM Studio is the case where that assumption is wrong.

**Windsurf**, on current evidence, has no first-party-documented custom base URL setting. Its BYOK feature is documented as bringing your own vendor key (for example, an Anthropic key) to use that vendor's *hosted* models, not a base URL override. Several third-party guides claim a `generic-chat-completion-api` provider exists; no first-party page confirms it, so it is marked unverified here rather than listed as working. Windsurf's documentation moved to `docs.devin.ai` after its acquisition, and a current screenshot or a first-party page is what would resolve this either way.

## Anything else

The general recipe, in order:

1. Find the tool's setting for a **custom OpenAI base URL** (sometimes called API base, endpoint override, or custom provider).
2. Set it to `https://<account>.services.ai.azure.com/openai/v1/`.
3. Set the API key.
4. Set the model to your **deployment name**, not the vendor's model id.
5. If the tool offers a "test" or "verify" button, use it. It sends a real request and gives you a real error.

## When it does not work

| Symptom | Cause | Fix |
|---|---|---|
| `404 DeploymentNotFound` | Vendor model id used instead of deployment name | Use `az cognitiveservices account deployment list` and copy the `deployment` column exactly |
| `404` with a doubled path in logs | Tool appends `/v1` to your base URL | Drop `/openai/v1/` from the base, or drop the trailing slash |
| `401` | Key wrong, or token expired | Keys do not expire; Entra tokens do. Re-fetch the token |
| `403` | No role assignment | Add the identity to the image-users group or assign Cognitive Services User |
| Tool insists on `api-version` | Tool is built for the legacy Azure path | Use its Azure provider mode with the deployment name, not the OpenAI-compatible mode |
| Works in curl, fails in tool | Tool is rewriting the URL | Find its request log and compare the actual URL against the target above |
| Streaming breaks, non-streaming works | Tool sends parameters your model rejects | Disable streaming to confirm, then check which parameters the deployed model supports |
| Empty model dropdown | Tool tried to call `/models` and got nothing usable | Add the model manually by deployment name |
| `400 Model not supported` | Tool is a Responses-only client (Codex CLI, OpenClaw's Foundry plugin by default) against a deployment that does not answer the Responses API | Switch to a tool that speaks Chat Completions, or confirm the specific deployment supports Responses first. `gpt-5-6-sol/terra/luna` and `deepseek-v4-pro/flash` are confirmed to answer it; other deployments are untested |

## Cost warning, read before connecting an agentic tool

This is the part that costs people real money.

The budget deployed by this methodology is **alert-only**. It emails at thresholds. It does not stop spend. See [cost and governance](../design/cost-and-governance.md).

Agentic tools issue **many** model calls per task, often with the full file context attached, sometimes in retry loops, and often resending the entire conversation history on every turn, not just the new message. A single misconfigured agent left running against a large repository can generate more spend in an hour than a person does in a month of chat. Every tool on this page marked agentic is in that category: Cline, Roo, Cursor's agent mode, Junie, Kilo Code, Zed's agent panel, Codex CLI, Qwen Code, Crush, opencode, OpenHands, Continue (extension and CLI), Warp's agent, and any hosted agent.

**This is not theoretical on this account.** [SPIKE-32](../research/SPIKE-32-model-region-availability-matrix) found six deployed models already sitting at 100 percent of their real subscription quota, and the smallest chat deployment on this account carries barely enough throughput to survive one agent-mode conversation before it throttles. An established chat history alone can exceed a small deployment's per-minute token budget, so requests fail before the agent does anything, regardless of what was asked. Point agentic tools at your largest-capacity deployment, not your smallest.

Before you connect one:

- Start with the cheapest deployment you have, not the largest.
- **Do not use deployment capacity as a cost control.** A model deployment left at capacity 1 throttles to roughly one request per minute, which does not save money, it just breaks the tool: an agentic client hits `429` on its second call and either stalls or retries the same work. On `GlobalStandard`, billing is per token consumed either way, so a throttled deployment can spend the same and deliver less. Set `capacity` deliberately per model in your registry, sized to what that model actually has to serve. On a provisioned SKU the arithmetic is different: there you pay per provisioned unit per hour, so capacity is the cost driver and this advice does not transfer.
- Watch Cost Management for the first day of real use rather than trusting the alert thresholds to be timely.
- If you need a hard stop, it has to live in the caller: a cap on iterations, a cap on tokens per task, or both. Nothing in the deployment provides one. The budget only emails, and deployment capacity only slows you down.

## Verify it, do not assume it

A tool is working when you have seen it return a completion **from your endpoint**, not when the settings look right. Confirm:

1. `curl` against the v1 endpoint returns HTTP 200. If not, stop; nothing else will work.
2. The tool returns a response to a trivial prompt.
3. The call actually reached Azure, confirmed by either the tool's request log showing your hostname, or a new entry under your account's metrics in the portal.

Step 3 is the one people skip. A tool that silently fell back to its own hosted model will look like it is working.

## When the tool sends something the model refuses

Some clients hardcode request parameters and give you no field to change them.
GitHub Copilot Chat sends `temperature: 0.1` on every request, and reasoning
models reject any temperature but their default, so those deployments answer 400
through the editor while working perfectly over `curl`.

There is no setting on the Azure side that fixes this, because the parameter is
chosen by the client. See [model behaviour and limits](./model-behaviour-and-limits#the-client-makes-this-worse)
for why, and [model gateway](./model-gateway) for the shim that repairs it.

**Most rosters do not need that gateway.** On one measured account, ten of eleven
chat deployments accepted a custom temperature without complaint. Deploy it only
when a tool you cannot configure meets a model that will not budge.
