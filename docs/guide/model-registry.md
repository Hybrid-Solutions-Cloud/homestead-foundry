# Model registry

`models/registry.schema.json` is the JSON Schema every registry file validates against. It exists so a consuming project can resolve a model by a stable `id` instead of hardcoding a Foundry deployment name directly in application code - the same problem that caused two brand-specific consumer repos in this project's own first build to drift out of sync with each other over time (see the ADR-0008 worked example for that history).

## Entry shape

Nine fields are required on every entry. The rest are optional, or required only
on one kind of deployment target: `models/registry.schema.json` expresses that as
a `target` discriminator with an `if`/`then`/`else`, so a field that is
meaningless for a target is not merely ignored, it fails validation. See
[ADR-0018](../adr/ADR-0018-model-registry-schema-v2.md).

| Field | Required | Values | Notes |
|---|---|---|---|
| `id` | always | kebab-case string, no dots | Stable identifier a consuming project references. Never reused across two different models once published. |
| `kind` | always | `image` \| `voice` \| `video` \| `reasoning` \| `text` \| `speech-to-text` \| `embedding` | The registry schema's enum is authoritative; new modalities get a new enum value, not an inferred guess from the model name. `embedding` is separate from `text` because an embedding deployment answers on the embeddings route, not chat completions. |
| `provider` | always | e.g. `Microsoft`, `BlackForestLabs`, `OpenAI`, `xAI` | Prefer the vendor's own name. Doubles as the fallback model **format** when the deploy-time catalog omits one, because Azure's format is the publisher. |
| `deploymentName` | always | string | The actual name a caller passes as the `model` parameter. On an on-premises target it is the catalog alias. |
| `status` | always | `deployed` \| `planned` \| `rejected` | Rejected entries are kept, with `notes` explaining why, so a candidate is never re-researched from scratch later. |
| `accessGating` | always | string | e.g. `none`, a limited-access registration URL, or a vendor-terms-acceptance requirement. |
| `capabilities` | always | array of strings | e.g. `text-to-image`, `vision-input`, `word-timestamps`, `text-embedding`. |
| `notes` | always | string | Short and factual; longer rationale lives in the linked `sourceRef` document. |
| `sourceRef` | always | relative path | Points at the spike, ADR, or backlog entry that backs this entry. |
| `target` | optional | array of `azure-cloud` \| `windows-server` \| `azure-local` | Omit it and the entry means `["azure-cloud"]`, which is why every pre-v2 registry file still validates. Always an array, even for one value. `azure-cloud` cannot be combined with an on-premises target. |
| `sku` | Azure only, and required there | string | e.g. `GlobalStandard`, `S0`. **Forbidden** on an on-premises entry. |
| `region` | Azure only, and required there | string | The Azure region the deployment targets. **Forbidden** on an on-premises entry. |
| `capacity` | Azure only, optional | integer, minimum 1 | Provisioned SKU capacity for this one deployment. **Set it.** Omitting it inherits the stack-wide `modelDeploymentCapacity` fallback, which defaults to 1. **Forbidden** on an on-premises entry. |
| `variant` | on-premises only, and required there | string | The catalog entry name, e.g. `Phi-4-mini-instruct-generic-cpu`. The variant, not the model name, is the deployable unit on both on-premises targets. **Forbidden** on an Azure entry. |
| `executionProvider` | on-premises only, and required there | `CPUExecutionProvider` \| `CUDAExecutionProvider` \| `QNNExecutionProvider` \| `VitisAIExecutionProvider` \| `OpenVINOExecutionProvider` \| `WebGpuExecutionProvider` \| `NvTensorRTRTXExecutionProvider` \| `vllm` | **Forbidden** on an Azure entry. |
| `sizeNote` | on-premises only, optional | string | Free text, because the published catalog carries no size column and the honest value is usually `UNKNOWN`. Any number here carries its provenance. **Forbidden** on an Azure entry. |

### Set `capacity` on every deployed entry

`capacity` is optional in the schema so that an older registry file keeps
validating. It is not optional in practice. An entry that omits it deploys at the
`modelDeploymentCapacity` fallback, which defaults to 1, and capacity 1 measures
at roughly **one request per minute**. That is a throughput floor, not a spend
control: on a `GlobalStandard` deployment you are billed per token consumed, so
raising capacity raises the rate ceiling without creating any standing charge.
Anything left on the fallback breaks an agentic caller on its second call.

Capacity units are not comparable between models, which is why the number lives
per entry rather than once for the whole stack. Pick it per model from what that
model actually has to serve, then confirm the result: `infra/main.bicep` emits an
`inheritedCapacityRegistryIds` output listing every deployable id that did not
declare one. On a finished roster it is empty.

Two entries in `registry.starter.json` deliberately carry no `capacity`: the
voice entries. They are reached through the Speech endpoint by SSML voice name,
produce no deployment resource at all, and belong in `skipDeploymentModelIds`.

## Which registry file to start from

- **`models/registry.starter.json`** is the one to copy. It is a real, working roster of 28 models taken from this repo's own research: six image models, two voice entries, fourteen reasoning models and two embedding models marked `deployed`, plus one `planned` and three `rejected` entries kept so their decisions are not re-researched. Every deployed entry that becomes a deployment resource carries an explicit `capacity`, and every entry carries a `sourceRef` to the spike or ADR behind it. Delete what you do not need, adjust `region` and `capacity`, and point the Bicep at it.
- **`models/registry.example.json`** is a minimal shape reference with placeholder values, one entry per `kind` for all seven kinds and at least one per `status`. Use it to understand the schema, not to deploy.

Model availability, versions, and regions change over time. Confirm each entry against your own subscription with `az cognitiveservices account list-models` before deploying, rather than trusting the starter file verbatim.

## How a consuming project resolves a model

1. Load the registry.
2. Look up the entry by `id`.
3. Fail fast if `status` is not `deployed` - never silently call a `planned` or `rejected` model.
4. Use `kind` to pick the route, not the model name. `embedding` goes to the embeddings route; `image`, `voice` and `speech-to-text` each have their own. Only `text` and `reasoning` are chat completions.
5. Use `deploymentName` and `region` to build the actual Foundry endpoint.
6. Read `capacity` and size your own concurrency and retry policy from it. It is the entry's rate ceiling, so it tells a caller how hard it may push before it earns a `429`. An entry with no `capacity` inherited the stack fallback, so treat it as the lowest possible ceiling and back off accordingly.
7. Use `accessGating` to surface a clear, actionable error if the caller's credentials do not have the access the entry requires.

This is a deliberately small contract. It replaces per-project hardcoded model names with one shared lookup, without requiring a consuming project to adopt anything else about how this repo is built.
