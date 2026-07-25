# As-built record

This is an anonymized as-built record: it documents the methodology's real,
running deployment with resource names genericized to the CAF placeholder
pattern for this public writeup. It is not a live private inventory, and it
contains no subscription, tenant, group, or vault identifiers.

**Built:** 2026-07-24, net-new, from `infra/main.bicep` in this repository.
**Region:** East US, a single region for every resource.
**Status:** deployment `Succeeded`. Twenty model deployments live, every one reporting `Succeeded`.

## How this environment was built

The first version of this environment was stood up by hand in July 2026,
following `implementation-guide.md` step by step. That proved the runbook, but it
left the environment unreproducible: nothing except a written guide recorded what
existed or why.

It was then rebuilt net-new from the Bicep in `infra/`, under the same canonical
CAF names, so that infrastructure-as-code became the source of truth rather than a
description of what someone once typed. The resource group was deleted, the
soft-deleted account purged, and a single `az deployment sub create` recreated
everything.

That matters more than it sounds. The environment now satisfies the
wipe-and-redeploy contract in `docs/design/resource-topology-and-caf-naming.md` by
demonstration rather than by assertion.

## What exists

| Resource | Name | Detail |
|---|---|---|
| Resource group | `rg-<workload>-<env>-<region>-01` | East US. Tags: `initiative`, `env`, `owner`. |
| AI Foundry account | `aif-<workload>-<env>-<region>-01` | Kind AIServices, SKU S0, custom subdomain, system-assigned managed identity, public network with Entra and RBAC, project management enabled. |
| Foundry project | `proj-<workload>-<purpose>-01` | Scoped inside the account, which already fixes environment and region. |
| Model deployments | twenty | Six image, fourteen reasoning. Each `GlobalStandard` at capacity 1, with the default content-safety policy and automatic version upgrade preserved. Generated from the model registry, not hand-written. |
| Security group | `sg-<workload>-image-users-<env>-<region>-01` | Cognitive Services User on the account scope. |
| Security group | `sg-<workload>-speech-users-<env>-<region>-01` | Cognitive Services Speech User on the account scope. |
| Key Vault | pre-existing platform vault | Reused by name only. Holds the Speech key under an initiative-prefixed secret name. Never created or destroyed by this template. |
| Budget | `budget-<workload>-<env>-<region>-01` | Resource-group scope, monthly, alerts at 50, 75, 90 and 100 percent plus a forecast alert. Alert-only, not a hard spend stop. |

### The model roster

Twenty deployments spanning five vendors: six image models and fourteen reasoning
models. The exact roster is not duplicated here, because the registry is what
actually drives the deployments. See `models/registry.starter.json` and the
[model registry guide](../guide/model-registry.md).

Every deployment was verified against the live catalog at build time and found to
be running the current version, preview models included. Deployment names are
deliberately version-free, so a version change is absorbed by redeploying under the
same name instead of creating a parallel deployment.

The voice model is reached through the Speech endpoint by SSML voice name and is
therefore not a deployment resource at all. Its registry id is listed in
`skipDeploymentModelIds`, which is why the registry marks twenty-two entries
deployed while the account shows twenty deployments.

## Endpoints

- **Image.** The account's Foundry endpoint, authenticated keylessly through Entra
  (`DefaultAzureCredential`, scope `https://cognitiveservices.azure.com/.default`).
  Access comes from membership of the image-users group. No image key is stored
  anywhere.
- **Voice.** The regional Azure Speech endpoint, with the voice selected by name in
  SSML. Authenticated with the key held in the platform Key Vault. Membership of the
  speech-users group also grants Entra access to the same surface.

## What the deployment preview caught

The `what-if` preview earned its place during the reconcile that preceded the
rebuild. Applying the template as written at that moment would have:

- stripped the default content-safety policy from four live image deployments,
- stripped the automatic version-upgrade setting from the same deployments, and
- dropped project management from the account.

None of that was intended, and none of it was visible without reading the preview
output. The template was corrected to preserve all three before anything was
applied. This is the concrete reason the deployment guide insists on reading
`what-if` rather than treating it as a formality.

The rebuild produced a second finding: role assignments cannot be created
idempotently over hand-made ones, because Azure deduplicates on principal, role and
scope regardless of assignment name. That is what the `manageRoleAssignments`
parameter exists for, and why reconciling deployers set it to false.

## Deviations from the design

None outstanding.

The account uses the `aif` CAF abbreviation, the current Microsoft Learn mapping
for a Cognitive Services account of kind AIServices. Earlier drafts of the design
used `ais`, which denotes a different kind; the documentation was corrected to match
the deployment rather than the other way round.

Data-plane access is granted through two Entra security groups rather than by direct
assignment as ADR-0005 originally specified. Same roles, same least privilege,
managed by group membership so that granting someone access does not require
redeploying infrastructure.

## Verification

Both the control plane and the data plane are verified.

**Control plane.** Every resource exists and every model deployment reports
`Succeeded`.

**Data plane, smoke-tested 2026-07-25 after the rebuild.** All three call paths
were exercised with real requests:

| Path | Auth | Result |
|---|---|---|
| Image generation | Keyless Entra, group membership | A 744 KB PNG returned from a one-line prompt |
| Text to speech | Key sourced from the platform Key Vault | HTTP 200, a 7 KB MP3 returned, expressive voice selected by SSML name |
| Reasoning chat completion | Keyless Entra, group membership | Correct completion returned |

This is the check that matters after a rebuild, and it is the one most easily
skipped: a control-plane query proves the resources exist, not that they serve.
The text-to-speech call doubles as proof that the Key Vault secret was correctly
refreshed after the rebuild rotated the account keys, which is the single most
likely thing to be silently broken afterwards.

Re-run all three after any rebuild. The commands are in the
[deployment guide](../guide/deployment.md).

## Known gaps

None outstanding on this environment.

## Reproducing this

Follow the [deployment guide](../guide/deployment.md). It is the runbook this
environment was built from, and the environment described above is what it produces.
