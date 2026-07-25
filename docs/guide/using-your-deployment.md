# Using your deployment

You ran the [deployment runbook](./deployment.md) and it succeeded. Resources exist. This page takes you from there to your first working inference call.

Everything here is copy-paste. Replace the placeholders and it runs.

::: info These samples were run, not just written
The chat samples, both authentication methods, both hostnames, the `404` and `429` behaviours, and the image hostname difference on this page were all executed against a real deployment and their responses checked. Where something failed, the page says so rather than describing what should have happened.
:::

::: tip Read this first if nothing else
Azure exposes an **OpenAI-compatible v1 API**. Your base URL is `https://<account>.services.ai.azure.com/openai/v1/`, the `model` field is your **deployment name** (not the vendor's model id), and the API key works in a plain `Authorization: Bearer` header. That combination is what makes almost every OpenAI-compatible tool work against your deployment. See [Connect your tools](./connect-your-tools.md).
:::

## Step 1: Find your endpoint and key

Everything below needs two values. Get them from the Azure CLI.

```bash
# Set these to match what you deployed
RG="rg-<workload>-<env>-<region>-01"
ACCOUNT="aif-<workload>-<env>-<region>-01"

# Your endpoint
az cognitiveservices account show \
  --name "$ACCOUNT" --resource-group "$RG" \
  --query "properties.endpoint" -o tsv
```

```powershell
$RG      = "rg-<workload>-<env>-<region>-01"
$ACCOUNT = "aif-<workload>-<env>-<region>-01"

az cognitiveservices account show `
  --name $ACCOUNT --resource-group $RG `
  --query "properties.endpoint" -o tsv
```

That returns something like `https://<account>.cognitiveservices.azure.com/`. Your account also answers on two other hostnames, and **which one you use matters for tooling**:

| Hostname | Use it for |
|---|---|
| `https://<account>.services.ai.azure.com` | Foundry Models, agents, and the v1 API. **Prefer this one.** |
| `https://<account>.openai.azure.com` | The same v1 API. Interchangeable for chat and images. |
| `https://<account>.cognitiveservices.azure.com` | What the CLI returns. Fine for SDKs, less commonly accepted by third-party tools. |

### Which models can I call?

List your deployment names. **This is the single most useful command on this page**, because the deployment name is what you pass as `model` in every request.

```bash
az cognitiveservices account deployment list \
  --name "$ACCOUNT" --resource-group "$RG" \
  --query "[].{deployment:name, model:properties.model.name, version:properties.model.version}" -o table
```

The `deployment` column is what you pass as `model`. The `model` column is the vendor's id. They are usually different, and using the vendor id where a deployment name belongs is the most common cause of a `404 DeploymentNotFound`.

## Step 2: Choose how you authenticate

Two options. Both work everywhere in this guide.

### Option A: Entra ID, no key (recommended)

Nothing to store, nothing to rotate, nothing to leak. This is the method this methodology deploys by default, and image access is keyless by design.

```bash
az login
TOKEN=$(az account get-access-token \
  --resource https://cognitiveservices.azure.com \
  --query accessToken -o tsv)
```

Then send `Authorization: Bearer $TOKEN`.

**You need a role for this to work.** The deployment creates security groups for exactly this purpose. A user who is not a member of one gets a `401` or `403`, no matter how valid their token is:

| Group | Role it carries | Grants |
|---|---|---|
| `sg-<workload>-image-users-<env>-<region>-01` | Cognitive Services User | Calling deployed models on the account |
| `sg-<workload>-speech-users-<env>-<region>-01` | Cognitive Services Speech User | The Speech endpoint for voice |

Add a user to the right group, or assign the role directly:

```bash
az role assignment create \
  --assignee "<user-or-group-object-id>" \
  --role "Cognitive Services User" \
  --scope "$(az cognitiveservices account show --name "$ACCOUNT" --resource-group "$RG" --query id -o tsv)"
```

Role assignments can take a few minutes to propagate. If you just added yourself and still get a 403, wait and retry before debugging anything else.

### Option B: API key

Simpler, and required by tools that cannot do Entra. It is a long-lived credential, so treat it like a password.

```bash
KEY=$(az cognitiveservices account keys list \
  --name "$ACCOUNT" --resource-group "$RG" \
  --query key1 -o tsv)
```

Azure accepts the key in **either** header, which is the detail that makes generic OpenAI clients work:

- `api-key: <key>` (the Azure-native form)
- `Authorization: Bearer <key>` (the OpenAI-shaped form)

Never commit a key. Never paste one into a config file that gets committed. Put it in an environment variable or your key vault.

## Step 3: Your first call

### Chat and reasoning models

The v1 API. Note there is **no deployment name in the URL** and **no `api-version` needed**: the deployment goes in the `model` field, exactly like OpenAI.

```bash
curl "https://<account>.services.ai.azure.com/openai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "model": "<your-deployment-name>",
    "messages": [
      {"role": "user", "content": "Reply with exactly: it works"}
    ]
  }'
```

```powershell
$body = @{
  model    = "<your-deployment-name>"
  messages = @(@{ role = "user"; content = "Reply with exactly: it works" })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "https://<account>.services.ai.azure.com/openai/v1/chat/completions" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $env:TOKEN"; "Content-Type" = "application/json" } `
  -Body $body |
  ForEach-Object { $_.choices[0].message.content }
```

Python, using the stock `openai` package with no Azure-specific client:

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://<account>.services.ai.azure.com/openai/v1/",
    api_key=os.environ["AZURE_AI_KEY"],   # or a bearer token, see below
)

resp = client.chat.completions.create(
    model="<your-deployment-name>",
    messages=[{"role": "user", "content": "Reply with exactly: it works"}],
)
print(resp.choices[0].message.content)
```

Python with keyless Entra auth:

```python
import os
from openai import OpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(),
    "https://cognitiveservices.azure.com/.default",
)

client = OpenAI(
    base_url="https://<account>.services.ai.azure.com/openai/v1/",
    api_key=token_provider(),   # refresh per session, tokens expire
)
```

JavaScript, also with the stock OpenAI package:

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://<account>.services.ai.azure.com/openai/v1/",
  apiKey: process.env.AZURE_AI_KEY,
});

const resp = await client.chat.completions.create({
  model: "<your-deployment-name>",
  messages: [{ role: "user", content: "Reply with exactly: it works" }],
});
console.log(resp.choices[0].message.content);
```

C#:

```csharp
using Azure.AI.OpenAI;
using Azure.Identity;

var client = new AzureOpenAIClient(
    new Uri("https://<account>.services.ai.azure.com"),
    new DefaultAzureCredential());

var chat = client.GetChatClient("<your-deployment-name>");
var result = await chat.CompleteChatAsync("Reply with exactly: it works");
Console.WriteLine(result.Value.Content[0].Text);
```

### Image models

Same v1 base, different route, and **one difference that will cost you an hour if you miss it**: image generation is served on the `openai.azure.com` hostname, not `services.ai.azure.com`. It also wants an explicit `api-version=preview`.

```bash
curl "https://<account>.openai.azure.com/openai/v1/images/generations?api-version=preview" \
  -H "Content-Type: application/json" \
  -H "api-key: $KEY" \
  -d '{
    "model": "<your-image-deployment-name>",
    "prompt": "a red bicycle leaning against a stone wall",
    "n": 1
  }'
```

::: warning Use the openai.azure.com hostname for images
The two hostnames are interchangeable for **chat**, but not for images. Calling
`https://<account>.services.ai.azure.com/openai/v1/images/generations` returns:

```json
{"error":{"code":"not_found","message":"Requested path is not found"}}
```

That is a `404` on the **path**, not on your deployment, so it is easy to misread as a wrong deployment name. If you get "Requested path is not found" from an image call, check the hostname first.
:::

The response carries base64 image data in `data[0].b64_json`. Decode it to a file:

```python
import base64, os
from openai import OpenAI

client = OpenAI(
    base_url="https://<account>.openai.azure.com/openai/v1/",   # note the hostname
    api_key=os.environ["AZURE_AI_KEY"],
)

img = client.images.generate(
    model="<your-image-deployment-name>",
    prompt="a red bicycle leaning against a stone wall",
    n=1,
)
with open("output.png", "wb") as f:
    f.write(base64.b64decode(img.data[0].b64_json))
```

Image generation typically takes 10 to 30 seconds depending on model, size, and quality. A client with a short default timeout will give up before the service does. If your request seems to hang, raise the timeout before assuming it failed.

### Voice models

Voice is different, and it trips people up. **A text-to-speech voice is not a model deployment.** It is not in your deployment list and it has no deployment name. It is reached through the regional Speech endpoint with the voice chosen by name inside SSML.

That is why this methodology's registry lists more entries as deployed than the account shows deployments: voice entries are in `skipDeploymentModelIds` precisely because there is nothing to deploy.

```bash
SPEECH_KEY="<from your key vault>"
REGION="<your-region>"

curl "https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1" \
  -H "Ocp-Apim-Subscription-Key: ${SPEECH_KEY}" \
  -H "Content-Type: application/ssml+xml" \
  -H "X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3" \
  --data-raw '<speak version="1.0" xml:lang="en-US">
    <voice name="<voice-name>">It works.</voice>
  </speak>' \
  --output out.mp3
```

Membership of the speech-users group also grants Entra access to the same surface, so a bearer token works here too if you prefer not to handle the key.

## Troubleshooting

Work down this table before anything else. Nearly every first-call failure is one of these.

| Symptom | Almost always means | Fix |
|---|---|---|
| `401 Unauthorized` | Token expired, wrong scope, or key sent in the wrong header | Re-run `az account get-access-token` with `--resource https://cognitiveservices.azure.com`. Tokens are short-lived. |
| `403 Forbidden` | Authenticated fine, but no role | Add the identity to the image-users or speech-users group, or assign Cognitive Services User. Wait a few minutes for propagation. |
| `404 DeploymentNotFound` | You passed the **vendor model id** instead of your **deployment name** | Run the deployment list command in step 1 and use the `deployment` column. |
| `404` on the URL itself | Wrong hostname or a stray `/openai/deployments/...` path | With the v1 API the deployment belongs in the body, not the path. |
| `429 Too Many Requests` | Capacity, not a bug | Deployments here default to capacity 1. Raise capacity in the registry and redeploy, or back off and retry. |
| Model works in the portal, fails in your tool | Tool is sending an OpenAI-shaped path your endpoint does not serve | See [Connect your tools](./connect-your-tools.md). |
| Image call returns `"Requested path is not found"` | Wrong hostname for images | Use `<account>.openai.azure.com`, not `services.ai.azure.com`. Chat accepts both; images do not. |
| Image call times out | Client timeout shorter than generation time | Raise the client timeout to 60 seconds or more. |
| Voice deployment "missing" | It is not a deployment | Expected. Use the Speech endpoint and SSML, above. |

### Prove it end to end

If you want one command that confirms auth, routing, and the deployment name together:

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  "https://<account>.services.ai.azure.com/openai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model":"<your-deployment-name>","messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```

`HTTP 200` and a JSON body means the deployment is live and you are authorized. Anything else, take the status code to the table above.

## Cost, before you wire this into anything

The budget this methodology deploys is **alert-only**. It emails at thresholds and does **not** stop spend. See [cost and governance](../design/cost-and-governance.md). Before you point a tool or an agent loop at these endpoints, know that an automated caller can generate cost far faster than a human can, and nothing in the deployment will stop it.

Set a hard stop in whatever calls the endpoint if you need one.

## Next

- [Connect your tools](./connect-your-tools.md) to use these models in VS Code, Cursor, and other clients.
- [Building agents](./building-agents.md) to build agents on top of them.
- [Model registry](./model-registry.md) to add, remove, or resize deployments.
