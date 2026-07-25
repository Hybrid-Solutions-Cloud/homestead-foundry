# Connect your tools

How to point VS Code, Cursor, and other AI clients at the models you deployed, so your editor talks to your own Azure endpoint instead of a vendor's.

Read [Using your deployment](./using-your-deployment.md) first and get one `curl` call working. **If curl does not work, no tool will.** Every configuration on this page is the same three values you already used.

## The one thing that makes this work

Historically, connecting a generic OpenAI client to Azure was painful, because Azure's URL shape was different from OpenAI's:

| | URL shape | Deployment goes | `api-version` |
|---|---|---|---|
| OpenAI | `{base}/v1/chat/completions` | in the `model` body field | not used |
| Azure, legacy | `{base}/openai/deployments/{name}/chat/completions` | in the **URL path** | **required** |
| **Azure, v1 API** | `{base}/openai/v1/chat/completions` | in the `model` body field | optional |

The v1 API removes both incompatibilities. The deployment name moved into the body and `api-version` became optional, so the request is shaped exactly like an OpenAI request. Azure also accepts the API key in a plain `Authorization: Bearer` header, not just its own `api-key` header.

**The practical consequence: any tool with a configurable base URL should work.** That is the whole trick.

Your three values, every time:

| Setting | Value |
|---|---|
| Base URL | `https://<account>.services.ai.azure.com/openai/v1/` |
| API key | Account key, or an Entra bearer token |
| Model | Your **deployment name** (from `az cognitiveservices account deployment list`) |

::: warning Verify per tool, do not assume
Client tools change fast and their Azure handling varies. The configurations below follow each tool's documented custom-endpoint mechanism, but **treat any tool as unverified until you have seen it return a completion from your endpoint.** Where a tool rewrites paths or forces its own URL suffix, it may not work regardless of correct settings. Test with the checklist at the bottom.
:::

## VS Code

Two routes, depending on what you want.

### GitHub Copilot Chat, bring your own key

Copilot Chat supports adding model providers with your own key. Choose the OpenAI-compatible or Azure provider option, then supply the base URL and key above. Open the model picker in the Chat view and select **Manage Models**, then follow the provider prompts.

Because Copilot's provider list and BYOK flow change between releases, check what your installed version offers before assuming a given provider entry exists.

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

## Cursor

Cursor supports an OpenAI-compatible override in **Settings > Models**:

1. Enable **Override OpenAI Base URL** and set it to `https://<account>.services.ai.azure.com/openai/v1/`.
2. Put your account key in the OpenAI API key field.
3. Add a custom model whose name is **exactly your deployment name**, and disable the built-in models you are not using so Cursor does not route to them.
4. Verify the key, which sends a real request. If it fails, your base URL or model name is wrong.

Cursor also ships an Azure integration that expects the legacy path shape. If you use that instead of the base-URL override, supply the Azure deployment name where it asks for one rather than a vendor model id.

Note that some Cursor features (Tab completion, and parts of Composer) run against Cursor's own hosted models and will not route to your endpoint no matter what you configure. Chat is what you are redirecting here.

## Cline and Roo Code

Both are VS Code agent extensions with a first-class **OpenAI Compatible** provider. Select it and fill in:

- Base URL: `https://<account>.services.ai.azure.com/openai/v1/`
- API key: your account key
- Model ID: your deployment name

These extensions are agentic and will issue many calls per task. Read the cost warning below before pointing one at your endpoint.

## Antigravity and other newer agent IDEs

Newer agentic editors generally expose either an OpenAI-compatible endpoint override or a custom-provider block. The values are the same three. What varies is whether the tool appends its own path segment to your base URL.

If the tool has a request log or debug console, check the exact URL it produces. You want:

```
https://<account>.services.ai.azure.com/openai/v1/chat/completions
```

If you see a doubled path (`/openai/v1/v1/chat/completions`) or the deployment name in the URL path, the tool is rewriting your base URL. Try supplying the base without the trailing `/openai/v1/` or without the trailing slash, depending on which direction it is wrong.

## Open WebUI, LibreChat, and other self-hosted front ends

These are typically the easiest, because they are built around an OpenAI-compatible base URL. In Open WebUI, add an OpenAI-compatible connection with your base URL and key, and the model list should populate from your deployments.

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

## Cost warning, read before connecting an agentic tool

This is the part that costs people real money.

The budget deployed by this methodology is **alert-only**. It emails at thresholds. It does not stop spend. See [cost and governance](../design/cost-and-governance.md).

Agentic tools (Cline, Roo, Cursor's agent mode, hosted agents) issue **many** model calls per task, often with the full file context attached, sometimes in retry loops. A single misconfigured agent left running against a large repository can generate more spend in an hour than a person does in a month of chat.

Before you connect one:

- Start with the cheapest deployment you have, not the largest.
- Deployments in this methodology default to **capacity 1**, which throttles hard. That is a feature here: it is an accidental brake. Do not raise it until you know your call volume.
- Watch Cost Management for the first day of real use rather than trusting the alert thresholds to be timely.
- If you need a hard stop, it has to live in the caller. Nothing in the deployment provides one.

## Verify it, do not assume it

A tool is working when you have seen it return a completion **from your endpoint**, not when the settings look right. Confirm:

1. `curl` against the v1 endpoint returns HTTP 200. If not, stop; nothing else will work.
2. The tool returns a response to a trivial prompt.
3. The call actually reached Azure, confirmed by either the tool's request log showing your hostname, or a new entry under your account's metrics in the portal.

Step 3 is the one people skip. A tool that silently fell back to its own hosted model will look like it is working.
