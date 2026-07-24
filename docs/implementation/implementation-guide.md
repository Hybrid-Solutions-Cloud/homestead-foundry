# Implementation guide: Azure AI Foundry deployment runbook

- Status: draft for phase 7 review (guide only; a later phase executes it). Main body rewritten brand-neutral 2026-07-23, per D-03 and D-16 (the decision log); see the closing "Worked example" section for the real, already-deployed instance this runbook was actually followed to build.
- Date: 2026-07-11 (original authoring)
- Author: foundry-implementer
- Grounded in: the seven design docs in `docs/design/` (especially `resource-topology-and-caf-naming.md`, `identity-and-security.md`, `cost-and-governance.md`, `reliability-and-operations.md`) and ADR-0001 through ADR-0008
- Companion diagrams (`docs/design/diagrams.md`): **#10 Deployment runbook** (this guide's steps 2 through 8 in dependency order) and **#9 Tenant selection and fallback decision** (this guide's section 10)

This is the ordered, gated runbook that stands up an Azure AI Foundry (AIServices) deployment in a target subscription and region, through verification, and then **holds**. It is written as a general procedure any Azure AI Foundry build in this repo can follow: CAF-shaped placeholder names stand in for the real workload, environment, region, and instance tokens a given deployment locks once at design time (per `resource-topology-and-caf-naming.md`). Bulk generation of any downstream artifact (images, audio, or otherwise) is a separate, owner-driven step and is not part of this runbook (MASTER-PLAN-pattern scope). The closing "Worked example" section restates the real, concrete instance as proof this runbook was actually followed in production.

---

## 0. How to use this runbook

### 0.1 Conventions

- Every command is marked **READ** (no Azure state change) or **WRITE** (creates, modifies, or spends). **Every WRITE is a hard confirmation point:** the operator confirms it explicitly, runs it alone, and never batches writes (MASTER-PLAN-pattern guardrail, repo hard rule).
- Steps run in order. Each step ends with a verification READ and a gate condition; do not proceed past a failed gate.
- Commands are shown in POSIX shell form (matching the design docs). On PowerShell, run each `az` command on one logical line and adapt variable assignment; the flags are identical.
- **ID hygiene (hard rule):** no subscription IDs, tenant GUIDs, keys, or tokens in any committed file, log, or transcript. Where a command needs a resource ID or subscription ID, resolve it into a shell variable at run time and let it die with the shell. Tenant and subscription appear by display name only.
- Record the outcome of every step (real names, chosen version strings, role assignments, secret names by name only, budget configuration) for `docs/implementation/as-built.md`, which is written when deployment completes.

### 0.2 Canonical names (CAF-shaped placeholder pattern)

Fixed by `resource-topology-and-caf-naming.md`'s naming convention. Lock the real `<workload>`, `<env>`, `<region>`, and `<instance>` tokens once per deployment (an ADR is the right place to do it) and hold them across every resource below; the worked example restates the real, resolved names for this repo's own instance.

| Item | Name pattern | Status |
| --- | --- | --- |
| Resource group | `rg-<workload>-<env>-<region>-<instance>` | Canonical pattern |
| Foundry account (kind `AIServices`, SKU `S0`) | `ais-<workload>-<env>-<region>-<instance>` (a documented deviation from the current CAF `aif` mapping for kind `AIServices`; see topology design section 2.1) | Canonical pattern |
| Model deployment (primary image model, GlobalStandard) | `<image-deployment-name>` (named after the model itself so redeploying under version churn never renames it, for example `mai-image-25` for MAI-Image-2.5) | Canonical pattern |
| Foundry project (optional, deferrable) | `proj-<workload>-<purpose>-<instance>` | Canonical pattern |
| Monthly budget (RG scope) | `budget-<workload>-<env>-<region>-<instance>` | Canonical pattern |
| Action group (budget email) | `ag-<workload>-<env>-<region>-<instance>` | Proposed (reviewer confirms string) |
| Credit budget (subscription scope, optional) | `budget-<workload>-credit-sub-<instance>` | Proposed (reviewer confirms string) |
| Key Vault (REUSE, never create) | `<vault>` (an existing platform Key Vault, by name only) | Pre-existing |
| Region | `<region>` (pinned to whichever region satisfies every model's availability, residency, and preview-flag constraints in scope; verify at deploy time) | Fixed once locked (ADR-0001 pattern) |
| Tags | `initiative=<workload>`, `env=<env>`, `owner=<alias>`, `costCenter=<value>` | Fixed keys (ADR-0006 pattern) |

Out of scope and never touched by this runbook: any pre-existing, adjacent single-purpose service account and its resource group (kept isolated per ADR-0004 pattern), any content storage outside Azure and outside CAF scope, and the reused vault itself (only this initiative's own secrets inside it, per section 6).

### 0.3 Confirmation-point register

Required path: **11 confirmation points** (8 `az` writes, 1 portal write, 2 bounded metered smoke calls).

| # | Step | Write | Kind |
| --- | --- | --- | --- |
| W1 | 2 | `az group create` `rg-<workload>-<env>-<region>-<instance>` | Control plane |
| W2 | 3 | `az cognitiveservices account create` `ais-<workload>-<env>-<region>-<instance>` | Control plane |
| W3 | 4 | `az cognitiveservices account deployment create` `<image-deployment-name>` | Control plane |
| W4 | 5 | Role assignment: Cognitive Services User | Control plane |
| W5 | 5 | Role assignment: Cognitive Services Speech User | Control plane |
| W6 | 6 | `az keyvault secret set` `<workload>-speech-key` | Data plane (vault) |
| W7 | 7 | `az monitor action-group create` `ag-<workload>-<env>-<region>-<instance>` | Control plane |
| W8 | 7 | Budget PUT `budget-<workload>-<env>-<region>-<instance>` | Control plane |
| W9 | 7 | Enable Cost Management tag inheritance | Portal setting |
| W10 | 8 | Smoke test: one image generation | Metered spend |
| W11 | 8 | Smoke test: one short TTS synthesis | Metered spend |

Conditional and optional gated writes (each also a confirmation point if taken): C1 provider registration (only if precondition P2 fails), C2 Foundry project `proj-<workload>-<purpose>-<instance>` (designed, deferrable), C3 Cognitive Services Contributor grant and its later removal (only if the deployer's existing rights do not cover W3), C4/C5 convenience vault entries (`<workload>-speech-region`, `<workload>-image-endpoint`), C6 subscription-scoped credit budget (blocked on owner input O5), C7 saved Cost Analysis view plus scheduled email (portal), C8 service IP allowlist (owner opt-in, default off). Rollback deletions (section 9) are each individually gated. Fallback pre-check writes (section 10) are each individually gated.

### 0.4 Owner-input prompts (fill at deploy time)

These values are set by no ADR or design doc. The operator prompts the owner for them at the marked steps; none may be invented.

| # | Prompt | Used at | Default if unanswered |
| --- | --- | --- | --- |
| O1 | `owner` tag value (an alias, a name only, never an ID) | W1, W2 | None; required before W1 |
| O2 | `costCenter` tag value | W1, W2 | Optional per ADR-0006 pattern; if declined, omit the key and record that in as-built |
| O3 | Owner alert email for the action group | W7 | Required before W7 |
| O4 | Pipeline identity UPN (normally the owner's signed-in `az login` user; read it with the step 5 READ) | W4, W5 | Required before W4 |
| O5 | Monthly credit amount | C6 credit budget; reporting cadence | C6 skipped until supplied |
| O6 | Speech-key rotation cadence | Step 6 record, as-built | Design default: rotate on suspicion of exposure, retire the key at the Entra-for-Speech migration; a calendar cadence is an owner call (identity design, ADR gap) |
| O7 | Service IP-allowlist opt-in | C8 | Default off (identity design section 4) |
| O8 | Monthly budget cap (USD), the workload's spending cap enforced across all three cost-governance layers (ADR-0006 pattern) | W8; also the pipeline guard's own default | Required before W8; no safe default exists |

---

## 1. Step 1: preconditions (all READ)

No write happens in this step. All seven checks must pass before W1.

**P1. Subscription context is the target subscription (by name).**

```sh
# READ: confirm the active subscription by display name
az account show --query "{name:name, state:state, user:user.name}" -o table
```

Expected: `name` matches the deployment's chosen target subscription display name exactly (locked once at design time and recorded in as-built), and `state` is `Enabled`. If another subscription is active, switch context by name (a local CLI context change, not an Azure write):

```sh
az account set --subscription "<target-subscription-display-name>"
```

**P2. Resource provider registered.**

```sh
# READ: provider registration state
az provider show --namespace Microsoft.CognitiveServices --query registrationState -o tsv
```

Expected: `Registered` (confirmed in `ai/verification/environment-readiness.md` for this repo's own instance). If it ever reads `NotRegistered`, registering it is conditional write **C1** (`az provider register --namespace Microsoft.CognitiveServices`, confirm first, then wait for propagation).

**P3. Re-check the current version string of every preview model in scope. Never hardcode it.**

Any model still in active preview churns its version string over time, and its CLI metadata may carry an inference-deprecation date, read as a version-churn signal, not model end-of-life, unless the model is separately listed on the published retirement schedule (ADR-0002 pattern). The deploy step uses whatever the catalog says on deploy day, so run this READ now and again immediately before W3:

```sh
# READ: current catalog entry for the primary model in the target region
az cognitiveservices model list --location "<region>" \
  --query "[?model.name=='<primary-model-name>'].{name:model.name, version:model.version, lifecycle:model.lifecycleStatus, format:model.format}" -o table
```

Expected: at least one row, `format` `Microsoft`, `lifecycle` `Preview` (or later). If several dated versions appear, choose the newest and record the chosen string for as-built. If the model is absent from the catalog, STOP: do not substitute a different, soon-to-retire sibling model (for example, an older generation lacking an edits endpoint) without checking its own retirement date and confirming the substitution against an ADR update (ADR-0002 pattern).

**P4. SKU offerability and quota headroom (optional re-check).**

```sh
# READ: AIServices S0 offerable in the target region
az cognitiveservices account list-skus --kind AIServices --location "<region>" -o table

# READ: account-count and primary-model RPM meters
az cognitiveservices usage list --location "<region>" \
  --query "[?contains(name.value, 'AIServices')].{meter:name.value, used:currentValue, limit:limit}" -o table
```

Expected: S0 offerable; `AIServices.S0.AccountCount` under its limit; the primary model's Global Standard RPM meter at the tier this deployment expects (this repo's own MAI-Image-2.5 deployment sits at Tier 5, limit 10).

**P5. The reused vault is reachable and writable by the operator.**

```sh
# READ: vault exists (REUSE; this runbook never creates or modifies the vault itself)
az keyvault show --name "<vault>" --query name -o tsv
```

The identity design assumes the owner already holds data-plane secret rights on this platform vault (ADR gap, identity design). If W6 later fails with an authorization error, the fix is a Key Vault Secrets Officer grant scoped to this vault for the operator, an owner decision outside this runbook.

**P6. Names validated.** Validate the canonical names in section 0.2 against the governance MCP `validate` check (per the topology design, section 1). If the MCP is unreachable, the names in the committed design docs are the validated fallback.

**P7. Azure spending limit is ON.** Portal READ: Cost Management + Billing, confirm the spending limit is in force on this credit subscription, wherever a credit subscription is in play. It stays ON for the entire runbook; removing it is the one write this guide forbids outright (ADR-0006 layer 3 pattern).

**Gate 1:** all seven pass. If P1 fails because the subscription is disabled or unreachable long-term, this runbook does not proceed; the fallback path (section 10) is an owner decision, never an automatic switch.

---

## 2. Step 2: resource group

**W1 (WRITE, CONFIRMATION POINT): create the resource group.** Requires O1 (and O2 if supplied). Tags go on at create time so they precede all cost records (tags are not retroactive; ADR-0006 pattern).

```sh
# WRITE W1: resource group, tagged
az group create \
  --name "rg-<workload>-<env>-<region>-<instance>" \
  --location "<region>" \
  --tags initiative=<workload> env=<env> owner=<owner-alias> costCenter=<cost-center>
```

Verification:

```sh
# READ: confirm state and tags
az group show --name "rg-<workload>-<env>-<region>-<instance>" --query "{state:properties.provisioningState, location:location, tags:tags}"
```

**Gate 2:** `provisioningState` is `Succeeded`, `location` matches the locked region, all tag keys present.

---

## 3. Step 3: Foundry account (kind AIServices)

**W2 (WRITE, CONFIRMATION POINT): create the account.** Kind `AIServices`, SKU `S0`, target region, custom subdomain equal to the account name (the Entra prerequisite; ADR-0004, ADR-0005 pattern), system-assigned managed identity enabled, tags applied at create.

```sh
# WRITE W2: the shared Foundry account
az cognitiveservices account create \
  --name "ais-<workload>-<env>-<region>-<instance>" \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --kind AIServices \
  --sku S0 \
  --location "<region>" \
  --custom-domain "ais-<workload>-<env>-<region>-<instance>" \
  --assign-identity \
  --tags initiative=<workload> env=<env> owner=<owner-alias> costCenter=<cost-center> \
  --yes
```

Notes:

- `--yes` accepts the Responsible AI terms non-interactively. If the CLI still errors on terms (possible on the first account of a kind in a subscription), acknowledge them once in the portal and re-run.
- `--assign-identity` enables the system-assigned managed identity. It is forward-looking and harmless; the pipeline authenticates as the operator's Entra user, not as this identity, whenever the pipeline runs outside Azure (identity design section 1.2).
- Public network access stays **Enabled** (the default) whenever the publish pipeline runs on a workstation outside Azure. Do not disable it and do not add private endpoints in that case: the only endorsed hardening is the optional IP allowlist, **C8**, owner opt-in O7, off by default.
- Local (key) authentication stays enabled for as long as the Speech path needs it, until an Entra-for-Speech migration lands (ADR-0005 pattern).

Verification:

```sh
# READ: state, subdomain, endpoint, network posture
az cognitiveservices account show \
  --name "ais-<workload>-<env>-<region>-<instance>" \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --query "{state:properties.provisioningState, subdomain:properties.customSubDomainName, endpoint:properties.endpoint, publicNetwork:properties.publicNetworkAccess, kind:kind, sku:sku.name}"
```

**Gate 3:** `Succeeded`, `subdomain` equals the account name, kind `AIServices`, SKU `S0`, public network `Enabled`. The image data-plane host is `https://ais-<workload>-<env>-<region>-<instance>.services.ai.azure.com` (confirm the endpoint output agrees; the subdomain defaults to the account name, verified here per the identity design).

---

## 4. Step 4: primary image model deployment

**Re-run the P3 catalog READ immediately before this write** and capture the version into a shell variable; the version string is never typed by hand and never hardcoded (ADR-0002 pattern, decision 1):

```sh
# READ: resolve the current version at deploy time
IMAGE_MODEL_VERSION=$(az cognitiveservices model list --location "<region>" \
  --query "[?model.name=='<primary-model-name>'] | [0].model.version" -o tsv)
echo "Deploying <primary-model-name> version: $IMAGE_MODEL_VERSION"
```

**W3 (WRITE, CONFIRMATION POINT): create the deployment** named `<image-deployment-name>` (version-free on purpose: callers pass this string as the `model` parameter, so preview version churn is absorbed by redeploying under the same name; ADR-0002 pattern, topology design section 2).

```sh
# WRITE W3: the model deployment
az cognitiveservices account deployment create \
  --name "ais-<workload>-<env>-<region>-<instance>" \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --deployment-name "<image-deployment-name>" \
  --model-name "<primary-model-name>" \
  --model-format Microsoft \
  --model-version "$IMAGE_MODEL_VERSION" \
  --sku-name GlobalStandard \
  --sku-capacity 1
```

Verification:

```sh
# READ: deployment health
az cognitiveservices account deployment show \
  --name "ais-<workload>-<env>-<region>-<instance>" \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --deployment-name "<image-deployment-name>" \
  --query "{state:properties.provisioningState, model:properties.model.name, version:properties.model.version, sku:sku.name, capacity:sku.capacity}"
```

**Gate 4:** `Succeeded`, model matches the chosen primary model at the captured version, SKU `GlobalStandard`, capacity 1. Record the deployed version string for as-built and diary a catalog re-check on whatever cadence the model's own preview lifecycle warrants (reliability design section 3).

Notes:

- A model selected per call by name (for example, a voice model selected via SSML voice name against the account's Speech surface) has **no deployment step by design** (ADR-0004 pattern). This repo's own MAI-Voice-2 surface works exactly this way; nothing to create for it here.
- **C2 (optional WRITE, CONFIRMATION POINT if taken): the Foundry project `proj-<workload>-<purpose>-<instance>`.** The design creates one for a playground audition and the auto-applied `project` cost tag whenever no pipeline call depends on it, so it may be deferred without blocking the hold gate (topology design section 6, decision 2). Create it in the Foundry portal on the account, or via ARM (`Microsoft.CognitiveServices/accounts/projects`, current api-version at deploy time) with the locked region and a system-assigned identity. If deferred, record that in as-built.

---

## 5. Step 5: identity and RBAC

Auth model (identity design sections 1 and 2): the **image path is keyless Entra** (`DefaultAzureCredential`, token scope `https://cognitiveservices.azure.com/.default`, zero stored secret) and the **Speech path is key-based for now** (one vault-sourced key, step 6), with the custom subdomain already in place so a later Entra-for-Speech migration stays cheap. Both data-plane roles go to the pipeline identity now so that migration needs no new grant.

Resolve the assignee and scope at run time (IDs stay in the shell, never in a file):

```sh
# READ: the pipeline identity UPN (O4; normally the signed-in owner)
az ad signed-in-user show --query userPrincipalName -o tsv

# READ: the account resource ID, held only in this shell
AIS_ID=$(az cognitiveservices account show \
  --name "ais-<workload>-<env>-<region>-<instance>" \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --query id -o tsv)
```

**W4 (WRITE, CONFIRMATION POINT): Cognitive Services User to the pipeline identity**, account scope. This is the Entra data-plane role for the image generations and edits endpoints; it cannot deploy models or list keys (ADR-0005 pattern).

```sh
# WRITE W4: image data plane
az role assignment create \
  --assignee "<pipeline-upn>" \
  --role "Cognitive Services User" \
  --scope "$AIS_ID"
```

**W5 (WRITE, CONFIRMATION POINT): Cognitive Services Speech User to the same identity**, account scope. Granted now, active once Entra-for-Speech lands; the generic Owner and Contributor roles grant no Speech data-plane access, which is why the Speech-named role is required (ADR-0005 pattern).

```sh
# WRITE W5: Speech data plane
az role assignment create \
  --assignee "<pipeline-upn>" \
  --role "Cognitive Services Speech User" \
  --scope "$AIS_ID"
```

**C3 (conditional WRITE, CONFIRMATION POINT if taken): Cognitive Services Contributor, human-held, one time.** The account and group creates in steps 2 and 3 ran under the owner's existing subscription rights. If the human running W3 (the model deployment) and the step 6 key retrieval lacks equivalent rights, grant Cognitive Services Contributor on `$AIS_ID` to that human only, never to the pipeline identity (over-privileged, and Contributor cannot make Entra inference calls anyway; ADR-0005 pattern). Remove the grant after step 6 completes (`az role assignment delete`, also gated).

Explicitly not granted, per ADR-0005 pattern: Contributor to the pipeline identity, generic Owner or Contributor for Speech data plane, Cognitive Services Speech Contributor.

Verification:

```sh
# READ: exactly the intended assignments, nothing broader
az role assignment list --scope "$AIS_ID" -o table
```

**Gate 5:** the table shows Cognitive Services User and Cognitive Services Speech User for the pipeline identity (plus the temporary Contributor if C3 was taken, flagged for removal). Allow a few minutes for RBAC propagation before the step 8 Entra smoke call; a fresh 401 there means wait and retry, never widen a role.

---

## 6. Step 6: secrets (one key, into the existing vault)

**Do not create a vault.** `<vault>` is the pre-existing platform vault, reused by name (ADR-0005 pattern). One secret is stored, total. The image path is keyless Entra, so **`<workload>-image-key` is never created** (identity design rule: if a surface uses Entra, its `*_KEY` secret simply does not exist).

**W6 (WRITE, CONFIRMATION POINT): retrieve the Speech key and write it straight into the vault.** Single command so the value never lands in a file, the terminal, or history; `--output none` matters because `az keyvault secret set` echoes the value back otherwise.

```sh
# WRITE W6: key straight from the account into the vault, never displayed
az keyvault secret set \
  --vault-name "<vault>" \
  --name "<workload>-speech-key" \
  --value "$(az cognitiveservices account keys list \
      --name "ais-<workload>-<env>-<region>-<instance>" \
      --resource-group "rg-<workload>-<env>-<region>-<instance>" \
      --query key1 -o tsv)" \
  --output none
```

(The inner `keys list` is a control-plane read of a sensitive value: it must never be run standalone into a log or transcript.)

**C4 and C5 (optional WRITEs, CONFIRMATION POINTS if taken): the two convenience entries**, values not secret, co-located for one-stop retrieval (topology design section 3.4):

```sh
# WRITE C4: region companion (not a secret)
az keyvault secret set --vault-name "<vault>" \
  --name "<workload>-speech-region" --value "<region>" --output none

# WRITE C5: image endpoint host (not a secret)
az keyvault secret set --vault-name "<vault>" \
  --name "<workload>-image-endpoint" \
  --value "https://ais-<workload>-<env>-<region>-<instance>.services.ai.azure.com" --output none
```

Verification (names only, never values):

```sh
# READ: the secret exists, by name only
az keyvault secret list --vault-name "<vault>" \
  --query "[?starts_with(name, '<workload>-')].name" -o tsv
```

**Gate 6:** `<workload>-speech-key` listed (plus C4/C5 if taken); `<workload>-image-key` absent and stays absent.

Post-step notes (no Azure writes): on the publish machine, the developer pulls the key from the vault into a gitignored local secrets file (for example, `.dev.vars`) as the pipeline's Speech-key environment variable, alongside the region companion value, per the identity design. Rotation posture is O6: design default is rotate on suspicion plus retire at the Entra-for-Speech migration; ask the owner whether a calendar cadence is wanted and record the answer in as-built. The Speech data-plane endpoint for the key path is the regional `https://<region>.tts.speech.microsoft.com/cognitiveservices/v1`.

---

## 7. Step 7: budget, action group, and cost governance

The budget is layer 2 of three: a notify-only backstop, evaluated roughly daily, after the spend. The real cap is the pipeline's own budget guard, and the invoice stop is the spending limit staying ON (ADR-0006 pattern). Nothing in this step is a hard spend cap and nothing here may be treated as one.

**W7 (WRITE, CONFIRMATION POINT): the action group.** Requires O3. The name is Proposed status (section 0.2); use the reviewer-confirmed string.

```sh
# WRITE W7: one action group, one owner email
az monitor action-group create \
  --name "ag-<workload>-<env>-<region>-<instance>" \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --short-name "<short-name>" \
  --action email owner "<owner-alert-email>"
```

**W8 (WRITE, CONFIRMATION POINT): the budget.** `budget-<workload>-<env>-<region>-<instance>`, resource-group scope, monthly cap set to O8's answer, actual-cost alerts at 50, 75, 90, and 100 percent plus a forecasted alert at 100 percent (five notifications, the platform maximum), wired to the action group. The plain `az consumption budget create` cannot wire notifications, so use `az rest` (the portal Budgets blade configured identically is an acceptable equivalent). The body embeds the action-group resource ID, so build it in a temp directory outside the repo and delete it after.

```sh
# READ: runtime-only identifiers (never committed)
SUB_ID=$(az account show --query id -o tsv)
AG_ID=$(az monitor action-group show \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --name "ag-<workload>-<env>-<region>-<instance>" --query id -o tsv)
MONTHLY_CAP_USD="<owner-supplied-monthly-cap-usd>"   # O8

# Build the body in a temp dir (contains the AG resource ID; never commit it)
cat > "${TMPDIR:-/tmp}/budget.json" <<EOF
{
  "properties": {
    "category": "Cost",
    "amount": $MONTHLY_CAP_USD,
    "timeGrain": "Monthly",
    "timePeriod": { "startDate": "$(date -u +%Y-%m-01)T00:00:00Z" },
    "notifications": {
      "Actual50":    { "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 50,  "thresholdType": "Actual",     "contactGroups": [ "$AG_ID" ] },
      "Actual75":    { "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 75,  "thresholdType": "Actual",     "contactGroups": [ "$AG_ID" ] },
      "Actual90":    { "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 90,  "thresholdType": "Actual",     "contactGroups": [ "$AG_ID" ] },
      "Actual100":   { "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 100, "thresholdType": "Actual",     "contactGroups": [ "$AG_ID" ] },
      "Forecast100": { "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 100, "thresholdType": "Forecasted", "contactGroups": [ "$AG_ID" ] }
    }
  }
}
EOF

# WRITE W8: create the budget at resource-group scope
az rest --method put \
  --url "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/rg-<workload>-<env>-<region>-<instance>/providers/Microsoft.Consumption/budgets/budget-<workload>-<env>-<region>-<instance>?api-version=2023-11-01" \
  --body @"${TMPDIR:-/tmp}/budget.json"

rm "${TMPDIR:-/tmp}/budget.json"
```

(Use the current `Microsoft.Consumption/budgets` api-version at deploy time if `2023-11-01` has been superseded; the start date must be the first of the current month.)

**W9 (WRITE, CONFIRMATION POINT, portal): enable Cost Management tag inheritance** on the subscription (Cost Management, Settings, Manage subscription, tag inheritance on) so the resource-group tags flow into cost records (ADR-0006 pattern; cost design section 3).

**Spending limit: no action.** Portal READ re-confirming it is still ON, wherever a credit subscription is in play. Removing it converts the subscription to pay-as-you-go and is forbidden by this guide (ADR-0006 layer 3 pattern; only a deliberate owner election outside this runbook can change that).

Optional, per the cost design:

- **C6 (optional WRITE, gated on O5):** subscription-scoped credit budget `budget-<workload>-credit-sub-<instance>` at the monthly credit amount, watching total credit burn-down (credit alerts are Enterprise-Agreement-only and unavailable on most subscription types). Skipped until the owner supplies the amount.
- **C7 (optional, portal):** saved Cost Analysis view scoped to `rg-<workload>-<env>-<region>-<instance>`, accumulated monthly, Group by Meter, plus a scheduled email off it (daily during any credit-burn push, weekly at steady state).

Verification:

```sh
# READ: budget exists with five notifications
az rest --method get \
  --url "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/rg-<workload>-<env>-<region>-<instance>/providers/Microsoft.Consumption/budgets/budget-<workload>-<env>-<region>-<instance>?api-version=2023-11-01" \
  --query "{amount:properties.amount, grain:properties.timeGrain, notifications:keys(properties.notifications)}"
```

**Gate 7:** budget present, amount matches O8's answer, monthly, all five notification keys, action group wired; tag inheritance on; spending limit ON. The budget exists **before** any metered call in step 8 (environment-readiness deployment prerequisite: budget before any spend).

---

## 8. Step 8: verification and bounded smoke test

### 8.1 Read-only health and auth checks

```sh
# READ: account healthy
az cognitiveservices account show \
  --name "ais-<workload>-<env>-<region>-<instance>" --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --query "{state:properties.provisioningState, subdomain:properties.customSubDomainName}"

# READ: deployment healthy
az cognitiveservices account deployment show \
  --name "ais-<workload>-<env>-<region>-<instance>" --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --deployment-name "<image-deployment-name>" \
  --query "{state:properties.provisioningState, version:properties.model.version}"

# READ: roles exactly as designed
az role assignment list --scope "$AIS_ID" -o table

# READ: secret present, by name only
az keyvault secret list --vault-name "<vault>" \
  --query "[?name=='<workload>-speech-key'].name" -o tsv

# READ: an Entra token mints for the inference scope (displays expiry only, never the token)
az account get-access-token --scope https://cognitiveservices.azure.com/.default \
  --query expiresOn -o tsv
```

Also at this milestone (READs, owner-facing, from the cost design deploy checklist): read the live rate card for the primary model in the Foundry portal (published figures are stated in the cost design as verification-gated; never authorize a batch against an unread rate card), confirm the voice meter on the Azure Speech pricing page, and confirm the credit offer type and reset date in Cost Management + Billing, wherever a credit subscription is in play.

### 8.2 The bounded smoke test (two metered calls, then stop)

This is the definition-of-done probe: one real image and one real audio clip from the deployed endpoints with auth confirmed. It is deliberately tiny; a fuller cost-probe micro-batch and every bulk run are later, owner-authorized work, not part of this runbook.

**W10 (WRITE, CONFIRMATION POINT, metered): one image generation, Entra keyless.** Use the deployment's standardized canvas (this repo's own instance uses 1248x832, ADR-0002 pattern); the prompt keeps whatever non-photorealistic, hand-drawn-style framing habit this deployment's content calls for and contains no trademark tokens (ADR-0007 pattern). Estimated cost is small, typically a fraction of a US dollar at the conservative per-image token assumption the cost design carries until measured.

```sh
# WRITE W10: single generations call (bounded spend)
curl -sS -X POST \
  "https://ais-<workload>-<env>-<region>-<instance>.services.ai.azure.com/mai/v1/images/generations" \
  -H "Authorization: Bearer $(az account get-access-token --scope https://cognitiveservices.azure.com/.default --query accessToken -o tsv)" \
  -H "Content-Type: application/json" \
  -d '{"model":"<image-deployment-name>","prompt":"<non-trademarked, non-photorealistic test prompt in the deployment's own house style>","width":1248,"height":832}' \
  -o smoke-image.json
```

Then, from the response (field names may differ on the preview surface; inspect the raw JSON):

```sh
# READ: metadata without the image payload, then decode the PNG
jq 'del(.data[].b64_json)' smoke-image.json
jq -r '.data[0].b64_json' smoke-image.json | base64 -d > smoke-image.png
```

Record for as-built and the pipeline ledger, per the measurement plan (cost design section 7):

- Whether the response carries a **usage or token-count field**. If yes, record **tokens per image** and replace the pipeline's conservative token assumption with the measured value. If no, record its absence; the meter-delta micro-batch method is the later owner-authorized step.
- That the image decodes and looks sane (a human glance suffices).
- Any content-filter refusal verbatim (a prompt-engineering signal, ADR-0007 pattern).

**W11 (WRITE, CONFIRMATION POINT, metered): one short TTS synthesis, vault-sourced key.** Use a confirmed published voice; the exact voice identifier and any expressive-style spelling are the later voice spike's questions, deliberately not tested here. About 60 characters, cost well under a cent.

```sh
# READ (sensitive): key into the shell only, never echoed
SPEECH_KEY=$(az keyvault secret show --vault-name "<vault>" \
  --name "<workload>-speech-key" --query value -o tsv)

# WRITE W11: single synthesis call (bounded spend)
curl -sS -X POST "https://<region>.tts.speech.microsoft.com/cognitiveservices/v1" \
  -H "Ocp-Apim-Subscription-Key: $SPEECH_KEY" \
  -H "Content-Type: application/ssml+xml" \
  -H "X-Microsoft-OutputFormat: audio-24khz-160kbitrate-mono-mp3" \
  -H "User-Agent: <workload>-smoke" \
  --data '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-<voice-name>:MAI-Voice-2">Deployment smoke test, one short line only.</voice></speak>' \
  --output smoke-tts.mp3

unset SPEECH_KEY
```

A playable MP3 confirms three things at once: the AIServices-kind key authenticates against the regional endpoint (an ADR-0003-pattern spike question, answered early), the voice model serves from this account, and the vault round-trip works.

**Gate 8 (the hold gate):** account and deployment `Succeeded`; roles exact; secret named; budget live before the first metered call; a real decoded image; a playable audio file; both auth paths (Entra bearer for image, vault key for Speech) proven; tokens-per-image either measured or recorded as not-exposed. On pass: write `docs/implementation/as-built.md` (real names, region, deployed version string, role assignments, secret names by name only, budget configuration, owner-input answers, deviations), update the board, and **HOLD**. No bulk generation, no pilot batch, no backfill: those are owner-driven, budgeted, separate work (MASTER-PLAN-pattern handoff). A subsequent, independent environment-verification pass then re-verifies this deployment.

---

## 9. Rollback and cleanup

Every rollback action is a WRITE and an individual confirmation point. Reverse dependency order for targeted rollback; the resource-group delete is the clean sweep.

Boundaries first, because cleanup is where accidents happen:

- **Never** delete, purge, or modify `<vault>` itself. Only this initiative's secrets inside it (`<workload>-speech-key`, and C4/C5 if created) are ever removed.
- **Never** touch any pre-existing, adjacent single-purpose service account and its resource group, any content storage outside Azure and outside CAF scope, or any downstream consumer's already-published assets.
- Rollback does not refund consumed tokens; smoke-test spend stays on the meter. Ledger and provenance records committed to git stay as history.

Targeted rollback, reverse order:

```sh
# WRITE R1: remove the model deployment
az cognitiveservices account deployment delete \
  --name "ais-<workload>-<env>-<region>-<instance>" --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --deployment-name "<image-deployment-name>"

# WRITE R2: remove role assignments (repeat per role granted in step 5)
az role assignment delete --assignee "<pipeline-upn>" \
  --role "Cognitive Services User" --scope "$AIS_ID"

# WRITE R3: remove this initiative's secrets (soft-delete applies; purge per vault policy only)
az keyvault secret delete --vault-name "<vault>" --name "<workload>-speech-key"

# WRITE R4: remove the budget
az rest --method delete \
  --url "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/rg-<workload>-<env>-<region>-<instance>/providers/Microsoft.Consumption/budgets/budget-<workload>-<env>-<region>-<instance>?api-version=2023-11-01"

# WRITE R5: remove the action group
az monitor action-group delete \
  --name "ag-<workload>-<env>-<region>-<instance>" --resource-group "rg-<workload>-<env>-<region>-<instance>"

# WRITE R6: remove the account (enters the Cognitive Services soft-deleted state)
az cognitiveservices account delete \
  --name "ais-<workload>-<env>-<region>-<instance>" --resource-group "rg-<workload>-<env>-<region>-<instance>"

# WRITE R7: purge the soft-deleted account (frees the name and custom subdomain for reuse)
az cognitiveservices account purge \
  --name "ais-<workload>-<env>-<region>-<instance>" --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --location "<region>"

# WRITE R8: the clean sweep (removes budget, action group, account, deployment in one)
az group delete --name "rg-<workload>-<env>-<region>-<instance>"
```

Notes: a deleted Cognitive Services account is soft-deleted, and its name (and custom subdomain) stays reserved until purged (R7), so a re-deploy under the same canonical name needs the purge first. After R8, re-check that the reused vault and any adjacent pre-existing resource group are untouched. On the publish machine, remove the Speech-key and region environment variables from the local secrets file if retiring for good. If rolling back only the deployment (version churn, a scheduled re-check), R1 followed by a fresh W3 under the same `<image-deployment-name>` is the whole procedure and is invisible to callers.

---

## 10. Fallback path: an alternate tenant

Companion diagram: **#9 Tenant selection and fallback decision** (`docs/design/diagrams.md`). The fallback is activated **only** by an owner decision after the primary becomes unusable long-term (ADR-0001 pattern; reliability design section 7), and only after **all three read-only pre-checks below pass**. It is never an automatic switch and the pre-checks are not a gate on the primary.

Context switch, by names only:

```sh
# Local context change: sign in to the fallback tenant by domain name
az login --tenant "<fallback-tenant-domain>"
az account set --subscription "<fallback-subscription-display-name>"
```

**Pre-check 1 (READ): enumerate inherited management-group policy.** The primary environment check saw subscription scope only; landing zones commonly enforce guardrails at management-group level that inherit down and cannot be overridden by a subscription owner.

```sh
# READ: include assignments inherited from parent scopes
az policy assignment list --disable-scope-strict-match \
  --query "[].{name:name, displayName:displayName, scope:scope, definition:policyDefinitionId}" -o table

# READ: repeat per ancestor management group
az policy assignment list --management-group <ancestor-mg-name> -o table

# READ: for each hit, inspect effect and parameters
az policy assignment show --name <assignment-name>
az policy definition show --name <definition-name> --query "{effect:policyRule.then.effect, parameters:parameters}"
```

Confirm all three of: no Allowed-locations assignment that excludes the target region; no Allowed-resource-types assignment that excludes `Microsoft.CognitiveServices/accounts`; no Deny on key access (a disable-local-auth Deny would break the Speech key path, ADR-0005 pattern).

**Pre-check 2 (READ): note any silent-mutation policy.** In the same enumeration, record any **Modify** or **DeployIfNotExists** assignment that would disable public network access (breaks a publish pipeline running from a workstation) or disable local authentication (breaks the Speech key path). These mutate rather than deny, so pre-check 3 will not surface them; this scan is the only net that catches them.

**Pre-check 3: non-destructive deployment preflight.** `az deployment group what-if` needs a resource group to aim at, so this pre-check carries two small gated writes of its own: create the (empty, harmless) resource group first, and delete it if the fallback is abandoned.

```sh
# WRITE F1 (CONFIRMATION POINT): empty resource group for the preflight
az group create --name "rg-<workload>-<env>-<region>-<instance>" --location "<region>" \
  --tags initiative=<workload> env=<env> owner=<owner-alias>
```

```bicep
// fallback-whatif.bicep (names only; nothing sensitive)
resource ais 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'ais-<workload>-<env>-<region>-<instance>'
  location: '<region>'
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: 'ais-<workload>-<env>-<region>-<instance>'
    publicNetworkAccess: 'Enabled'
  }
}
```

```sh
# READ: server-side preflight; evaluates policy with no side effects.
# A RequestDisallowedByPolicy here is a pre-check failure.
az deployment group what-if \
  --resource-group "rg-<workload>-<env>-<region>-<instance>" \
  --template-file fallback-whatif.bicep

# WRITE F2 (CONFIRMATION POINT): remove the scratch group if abandoning the fallback
az group delete --name "rg-<workload>-<env>-<region>-<instance>"
```

(What-if catches Deny effects that evaluate at preflight; it does not reveal Modify or DeployIfNotExists mutation, which is why pre-check 2 remains mandatory.)

**The regional-availability caveat for the primary model (a real constraint, not a preference).** If pre-check 1 finds an Allowed-locations assignment forcing a region the deployment's primary model is not offered in: **STOP.** This repo's own MAI-Image-2.5 deployment hits exactly this case: the model's Global Standard tier is offered in seven regions, and `eastus2` is not one of them (a real, current constraint, ADR-0002 pattern); MAI-Voice-2 would work there but the image model would not deploy, which breaks a one-shared-resource design. Proceeding then requires an owner decision on a region-exemption request or a resource split, neither of which is pre-approved by any ADR (ADR-0001 pattern). A different primary model in scope would need this same regional-availability constraint re-derived against its own current model catalog.

Further fallback caveats to surface to the owner before proceeding:

- The fallback's default tier for the primary model is commonly a lower rate limit than the primary tenant's provisioned tier; fine for a pilot, slow for backfill; the remedy is a quota-increase request (Microsoft's own quota-request form for the relevant model family).
- `<vault>` lives in the primary tenant, so the step 6 secret-storage arrangement must be reopened (an owner call; no ADR designs a fallback vault).
- Re-check that any preview voices-and-styles flag this deployment depends on still holds in the effective region.

If all three pre-checks pass and the target region is permitted, re-run this runbook from step 1 in the fallback subscription with the same canonical names, recording the tenant change in as-built.

---

## Sources

- `docs/design/resource-topology-and-caf-naming.md` (canonical names, tags, topology, deployment shape, reuse rules)
- `docs/design/identity-and-security.md` (auth models per surface, RBAC table, secret rules, network posture, security checklist)
- `docs/design/cost-and-governance.md` (three enforcement layers, budget spec, tag inheritance, measurement plan, cost checklist)
- `docs/design/reliability-and-operations.md` (version pinning and the periodic re-check, operating rhythm, failure modes, fallback ordering)
- `docs/design/architecture-overview.md`, `docs/design/performance-efficiency.md`, `docs/design/pipeline-integration-design.md` (endpoints, canvas, pacing, ledger sidecar)
- `docs/adr/ADR-0001-target-tenant.md` (primary and fallback, three pre-checks, regional-availability blocker pattern)
- `docs/adr/ADR-0002-image-model-and-access.md` (version re-query, retiring siblings, canvas, cost probe)
- `docs/adr/ADR-0003-voice-model-and-voice-set.md` (no voice deployment, voice set, spike questions)
- `docs/adr/ADR-0004-foundry-topology-and-region.md` (kind, SKU, subdomain, two-resource split)
- `docs/adr/ADR-0005-identity-and-secrets.md` (Entra for image, key for Speech, role table, secret naming)
- `docs/adr/ADR-0006-cost-governance.md` (budget thresholds, action group, spending limit ON, tag scheme)
- `docs/adr/ADR-0007-content-safety-and-responsible-ai.md` (prompt hygiene applied to the smoke test)
- `docs/adr/ADR-0008-publish-pipeline-integration.md` (pre-render invariants; nothing at runtime depends on Azure)
- `docs/research/SPIKE-03-tenant-readiness.md` (fallback pre-check commands and reasoning, credit mechanics)
- `ai/verification/environment-readiness.md` (precondition baselines, budget-before-spend prerequisite)
- `docs/design/diagrams.md` (diagrams #9 and #10)

&lt;!-- safety-scan-worked-example:start -->

## Worked example: Brand A / Brand B

This section restates the real, already-deployed instance of the runbook above, in full, as proof it was actually followed to build and hold this repo's own production deployment. Every name and value below is real (anonymized to the generic CAF pattern for this public writeup); nothing here is a placeholder in the sense of being made up.

**Real subscription and tenant:** deployed in **the MVP credit subscription** (by name only), region **East US** (`eastus`), fixed by ADR-0001.

**Real canonical names (section 0.2, resolved):**

| Item | Real name |
| --- | --- |
| Resource group | `rg-<workload>-<env>-<region>-01` |
| Foundry account (kind `AIServices`, SKU `S0`) | `aif-<workload>-<env>-<region>-01` |
| Model deployment (MAI-Image-2.5, GlobalStandard) | `mai-image-25` |
| Foundry project | `proj-<workload>-media-01` |
| Monthly budget (RG scope) | `budget-<workload>-<env>-<region>-01` |
| Action group (budget email) | `ag-<workload>-<env>-<region>-01` |
| Credit budget (subscription scope, optional) | `budget-<workload>-credit-sub-01` |
| Key Vault (REUSE, never created) | `kv-<workload>-<env>-01` |
| Tags | `initiative=<workload>`, `env=prod`, `owner=<alias>`, `costCenter=<value>` |

**Real owner-input answers (section 0.4):** O8 (monthly budget cap) was set to **100 USD**, the real spending cap enforced across all three governance layers (the pipeline's own `--mai-budget-usd` guard, `budget-<workload>-<env>-<region>-01`, and the subscription spending limit kept ON). The action-group short name used at W7 was `<workload>01`.

**Real preconditions and model facts (section 1):** the primary model is **MAI-Image-2.5**; at authoring time its catalog version was `2026-06-02`, carrying an inference-deprecation date of `2026-09-01` read as a version-churn signal, with a follow-up catalog re-check diaried around and after that date. The two retiring sibling models explicitly never substituted are **MAI-Image-2** and **MAI-Image-2e**, both retiring 2026-08-15. The deployed tier is Global Standard Tier 5 (10 requests per minute).

**Real endpoints (sections 3, 6, 8):** image at `https://aif-<workload>-<env>-<region>-01.services.ai.azure.com/mai/v1/images/generations` (and `.../edits`); Speech (key path) at the regional `https://eastus.tts.speech.microsoft.com/cognitiveservices/v1`.

**Real secrets (section 6):** the one stored secret is `<workload>-speech-key` in `kv-<workload>-<env>-01`; the two convenience entries `<workload>-speech-region` (`eastus`) and `<workload>-image-endpoint` were also created; `<workload>-image-key` was never created (the image path is Entra keyless). On the publish machine, the key is pulled into the gitignored `.dev.vars` as `MAI_SPEECH_KEY` with `MAI_SPEECH_REGION=eastus` (both consuming reader-app repos gitignore `.dev.vars`).

**Real smoke test (section 8.2):** W10 used the standardized 1248x832 canvas with a hand-drawn, graphite-and-colored-pencil framed prompt describing a single acorn resting on plain paper (no trademarked tokens, per ADR-0007). W11 used the confirmed published voice **Harper** (`en-US-Harper:MAI-Voice-2`) with the line "smoke test, one short line only." The exact Lisa (en-AU) voice identifier and the `excited` expressive-style spelling were deliberately left to the later voice spike, not tested in this smoke test.

**Real adjacent estate, never touched by this runbook (sections 0.2, 9):** the existing narrator Speech account (the legacy narrator Speech resource, kind SpeechServices, F0) in its own resource group; the Cloudflare R2 content buckets for Brand A and Brand B; both reader apps' site repos' already-published assets.

**Real fallback tenant (section 10, not activated):** the recorded fallback is a secondary Azure Local tenant, gated on the three read-only pre-checks and never used to date. The regional-availability caveat applies exactly as generalized above: a management-group policy forcing `eastus2` in that tenant would be a hard blocker for the MAI-Image-2.5 deployment, since Global Standard is not offered there.

**Real outcome:** this runbook was executed in full through Gate 8 for both Brand A and Brand B; `docs/implementation/as-built.md` records the completed run, and the deployment has been held per Gate 8 pending owner-authorized bulk generation.

&lt;!-- safety-scan-worked-example:end -->
