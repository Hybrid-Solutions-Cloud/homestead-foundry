# Model registry

`models/registry.schema.json` is the JSON Schema every registry file validates against. It exists so a consuming project can resolve a model by a stable `id` instead of hardcoding a Foundry deployment name directly in application code - the same problem that caused two brand-specific consumer repos in this project's own first build to drift out of sync with each other over time (see the ADR-0008 worked example for that history).

## Entry shape

Every entry in a registry file has these fields:

| Field | Values | Notes |
|---|---|---|
| `id` | kebab-case string | Stable identifier a consuming project references. Never reused across two different models once published. |
| `kind` | `image` \| `voice` \| `video` \| `reasoning` | The registry schema's enum is authoritative; new modalities get a new enum value, not an inferred guess from the model name. |
| `provider` | e.g. `Microsoft`, `BlackForestLabs`, `OpenAI`, `xAI` | Prefer the vendor's own name. |
| `deploymentName` | string | The actual name a caller passes as the `model` parameter. |
| `sku` | string | e.g. `GlobalStandard`, `S0`. |
| `region` | string | The Azure region the deployment targets. |
| `status` | `deployed` \| `planned` \| `rejected` | Rejected entries are kept, with `notes` explaining why, so a candidate is never re-researched from scratch later. |
| `accessGating` | string | e.g. `none`, a limited-access registration URL, or a vendor-terms-acceptance requirement. |
| `capabilities` | array of strings | e.g. `text-to-image`, `vision-input`, `word-timestamps`. |
| `notes` | string | Short and factual; longer rationale lives in the linked `sourceRef` document. |
| `sourceRef` | relative path | Points at the spike, ADR, or backlog entry that backs this entry. |

## Example entries

`models/registry.example.json` is a brand-neutral example populated with placeholder values, one entry per `kind` and one per `status`, so it demonstrates the full shape without hardcoding any project's real deployment names.

## How a consuming project resolves a model

1. Load the registry.
2. Look up the entry by `id`.
3. Fail fast if `status` is not `deployed` - never silently call a `planned` or `rejected` model.
4. Use `deploymentName` and `region` to build the actual Foundry endpoint.
5. Use `accessGating` to surface a clear, actionable error if the caller's credentials do not have the access the entry requires.

This is a deliberately small contract. It replaces per-project hardcoded model names with one shared lookup, without requiring a consuming project to adopt anything else about how this repo is built.
