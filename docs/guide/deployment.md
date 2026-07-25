# Deployment

This is the runbook. Following it end to end stands up an Azure AI Foundry environment in your own subscription: a resource group, a Foundry account, model deployments driven by your model registry, an optional project, data-plane RBAC, a cost budget, and Key Vault secret-name references.

The environment described in `docs/implementation/as-built.md` was deployed from exactly this template.

## Before you start

You need:

- **An Azure subscription** you can create resource groups in, and the **Azure CLI** logged in to it (`az login`, then `az account set --subscription <id-or-name>`).
- **Owner or User Access Administrator** on the subscription, because the template creates role assignments. If you cannot create role assignments, set `manageRoleAssignments = false` and have someone else grant the two data-plane roles afterwards.
- **An existing Key Vault.** The template reuses a vault by name and never creates one, so that a wipe-and-redeploy of the environment cannot destroy your secrets. It records secret names only; it never reads or writes a secret value.
- **Node.js**, for the model-catalog generator in step 3.

Pick your region first. Model availability differs by region and it is the single hardest thing to change later, because the template deliberately allows only one region for the whole environment. Check what your target region actually offers:

```bash
az cognitiveservices model list --location eastus -o table
```

## 1. Choose your models

Copy the starter registry and edit it:

```bash
cp models/registry.starter.json models/registry.mine.json
```

`registry.starter.json` is a real 26-model roster: six image models, two voice entries, fourteen reasoning models, and four `rejected` entries kept so their decisions are not re-researched. Delete what you do not need. Keep `rejected` entries rather than deleting them; they cost nothing and they stop a future reader from re-litigating a closed question.

Only entries with `status: "deployed"` produce a deployment resource. See [the model registry guide](./model-registry) for the field reference.

Two notes that catch people out:

- **Voice models need no deployment resource.** A voice model reached through the Speech endpoint by SSML voice name is not a `Microsoft.CognitiveServices/accounts/deployments` resource. List those ids in `skipDeploymentModelIds` or the deployment fails looking for a catalog entry that cannot exist.
- **Idle deployments of pay-as-you-go base models cost nothing.** Billing is per token. Deploying twenty models you rarely call does not create a standing charge. The exceptions are fine-tuned models and provisioned throughput, neither of which this template uses.

## 2. Create the two security groups

Data-plane access is granted to Entra security groups rather than to individuals, so access is managed by group membership instead of by redeploying infrastructure. The groups are Entra objects, not ARM resources, so create them first:

```bash
az ad group create \
  --display-name "sg-<workload>-image-users-<env>-<region>-01" \
  --mail-nickname "sg-<workload>-image-users-<env>-<region>-01" \
  --query id -o tsv

az ad group create \
  --display-name "sg-<workload>-speech-users-<env>-<region>-01" \
  --mail-nickname "sg-<workload>-speech-users-<env>-<region>-01" \
  --query id -o tsv
```

Keep both object ids. Add yourself to both groups, or you will not be able to call the models you just deployed.

The image group receives **Cognitive Services User** and the speech group receives **Cognitive Services Speech User**. Two groups rather than one because the generic role grants no Speech data-plane access, so a single role cannot cover both paths.

## 3. Generate the model catalog

Model names and versions are re-queried at deploy time and never committed, because preview models change version without notice. Generate the catalog against your own subscription:

```bash
node scripts/build-model-catalog.mjs \
  --location eastus \
  --registry models/registry.mine.json \
  --skip mai-voice-2,azure-neural-standard
```

This writes `infra/params/model-catalog.json`. If it reports models that are not available in your region, fix your registry before continuing: remove them, set their status to `planned`, or choose a different region. A deployable registry entry with no catalog entry fails the deployment fast, by design.

## 4. Fill in your parameters

```bash
cp infra/params/starter.bicepparam infra/params/prod.local.bicepparam
```

`*.local.bicepparam` is gitignored, so your real values never get committed. Replace every value marked `REPLACE`: the CAF name segments, your owner alias, the two group object ids, your Key Vault name, your monthly budget cap, and your alert email. Point `modelRegistry` at `registry.mine.json` if you renamed it.

Then check it compiles:

```bash
az bicep build --file infra/main.bicep
```

## 5. Preview, then deploy

Never skip the preview. It is read-only and it is the step that catches a template about to modify something you care about:

```bash
az deployment sub what-if \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters infra/params/prod.local.bicepparam
```

Read the output. On a greenfield deployment everything should be a **Create**. Any **Modify** or **Delete** against a resource you did not expect is a stop-and-investigate, not a warning to click past. This preview has caught real damage before: an earlier reconcile run was about to strip the content-safety policy and the version-upgrade setting off live model deployments, and the fix went into the template rather than into a deployment nobody reviewed.

When the preview is what you want:

```bash
az deployment sub create \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters infra/params/prod.local.bicepparam
```

Model deployments are created one at a time, so a large roster takes several minutes.

## 6. Verify

```bash
# The account and its endpoint
az cognitiveservices account show \
  -n aif-<workload>-<env>-<region>-01 \
  -g rg-<workload>-<env>-<region>-01 \
  --query "{name:name, endpoint:properties.endpoint, state:properties.provisioningState}"

# Every model deployment, and its state
az cognitiveservices account deployment list \
  -n aif-<workload>-<env>-<region>-01 \
  -g rg-<workload>-<env>-<region>-01 \
  -o table
```

Every deployment should read `Succeeded`.

Then prove the data plane. A control-plane query showing the resources exist is not the same as showing they serve, and after a rebuild it is the difference that bites. Each of these costs a fraction of a cent:

```bash
TOKEN=$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)
ACCOUNT=aif-<workload>-<env>-<region>-01

# Image, keyless through Entra. Your account must be in the image-users group.
curl -s -X POST "https://$ACCOUNT.services.ai.azure.com/mai/v1/images/generations" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"<your-image-deployment-name>","prompt":"a small blue circle","n":1}' \
  | head -c 200

# A reasoning model, same auth.
curl -s -X POST "https://$ACCOUNT.services.ai.azure.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"<your-reasoning-deployment-name>","messages":[{"role":"user","content":"Reply with exactly: OK"}],"max_completion_tokens":16}'

# Text to speech, using the key from your vault. This also proves the vault
# secret is current, which is exactly what a rebuild invalidates.
KEY=$(az keyvault secret show --vault-name <your-vault> --name <initiative>-speech-key --query value -o tsv)
curl -s -X POST "https://<region>.tts.speech.microsoft.com/cognitiveservices/v1" \
  -H "Ocp-Apim-Subscription-Key: $KEY" \
  -H "X-Microsoft-OutputFormat: audio-16khz-32kbitrate-mono-mp3" \
  -H "Content-Type: application/ssml+xml" \
  --data '<speak version="1.0" xml:lang="en-US"><voice name="<your-voice-name>">Smoke test.</voice></speak>' \
  --output smoke.mp3 && ls -l smoke.mp3
```

Note the two different hostnames. Inference goes to `*.services.ai.azure.com`; the control plane and the account's own `properties.endpoint` use `*.cognitiveservices.azure.com`. Sending inference to the wrong one is a common and confusing failure.

If the image call returns `no_model_name`, you left out the `model` field: it takes your **deployment** name, not the underlying model name.

## Wipe and redeploy

The template is built to support complete teardown and rebuild, not just incremental updates. Deleting the resource group and redeploying lands cleanly back in the same region with no orphaned resources and no manual reconciliation.

Two things survive a teardown because they live outside the resource group: the two Entra security groups, and the Key Vault. That is deliberate.

One consequence to plan for: **deleting and recreating the account rotates its keys.** If anything reads a Speech key from your vault, refresh it after a rebuild:

```bash
az keyvault secret set --vault-name <your-vault> --name <initiative>-speech-key \
  --value "$(az cognitiveservices account keys list -n aif-<workload>-<env>-<region>-01 -g rg-<workload>-<env>-<region>-01 --query key1 -o tsv)"
```

Cognitive Services accounts soft-delete. Redeploying the same account name over a soft-deleted tombstone fails until you either purge it (`az cognitiveservices account purge`) or set `restoreSoftDeletedAccount = true`.

## Reconciling an existing environment

To bring an environment someone built by hand under this template, deploy with parameters that match what already exists and let `what-if` tell you the difference. Two settings matter:

- `manageRoleAssignments = false` if the groups already hold their roles. Azure deduplicates role assignments on principal, role, and scope regardless of assignment name, so an idempotent create cannot win against a hand-made assignment and the deployment fails on `RoleAssignmentExists`.
- Make sure your registry's `deploymentName` values match the live deployment names exactly, or `what-if` will propose deleting and recreating them.

## Everything is gated

Every resource-creating call in this runbook is one a human runs deliberately. The automation in this repository validates freely (`az bicep build`, `what-if`) and deploys only on an explicit instruction. Keep that split when you automate on top of it.
