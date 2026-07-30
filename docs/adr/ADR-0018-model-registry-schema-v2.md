# ADR-0018: Model registry schema v2, with a target discriminator

- Status: Proposed
- Date: 2026-07-30

## Context

`models/registry.schema.json` describes one deployment shape: an Azure AI Foundry
model deployment, with a SKU, a capacity, and a version. It predates the
three-target split and cannot express a model that runs on Foundry Local or on
Azure Local Foundry, because those have no SKU, no capacity, and no Azure
deployment resource at all.

[ADR-0017](./ADR-0017-deployment-target-documentation-structure) decision 7
committed to "one schema with an optional target discriminator" rather than three
registries. This ADR settles the shape of that discriminator.

Two hard constraints bound the design.

**The schema is closed and the Bicep is coupled to it.**
`models/registry.schema.json` sets `additionalProperties: false`, and
`infra/types.bicep` declares a closed `registryEntry` user-defined type that
`infra/main.bicep` consumes through `loadJsonContent`. A field added to one and
not the other breaks the Bicep build. They are a single unit of change.

**The two on-premises rosters are not one roster.**
[SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog) found the Foundry
Local and Azure Local Foundry catalogs diverge in model identity in both
directions: 100 vLLM entries only Azure Local Foundry can run, and NPU and
generic-GPU variants only Foundry Local carries. A single `local` target value
would be a lie.

## Decision

1. **`target` is an optional string enum with three values: `azure-cloud`,
   `windows-server`, `azure-local`.** These are the `docs/targets/` slugs, which
   are already the stable identifier for a target across this repository. An
   entry that omits `target` means `azure-cloud`, so **every existing registry
   file stays valid without edits.**

2. **`target` may also be an array**, for an entry that genuinely runs on more
   than one. This is the shared ONNX core: 35 aliases that both on-premises
   targets carry. Writing them twice would guarantee the two copies drift.

3. **The Azure-only fields become conditionally required, not unconditionally
   required.** `sku`, `capacity`, and `version` are required when `target`
   resolves to `azure-cloud` and forbidden otherwise, expressed as a JSON Schema
   `if`/`then`/`else`. A capacity of 10 on a Foundry Local entry is meaningless
   and must fail validation rather than be silently ignored.

4. **On-premises entries carry `variant` and `executionProvider` instead.**
   `variant` is the catalog entry name (`Phi-4-mini-instruct-generic-cpu`), and
   `executionProvider` is one of `CPUExecutionProvider`, `CUDAExecutionProvider`,
   `QNNExecutionProvider`, `VitisAIExecutionProvider`,
   `OpenVINOExecutionProvider`, `WebGpuExecutionProvider`,
   `NvTensorRTRTXExecutionProvider`, or `vllm`. SPIKE-22 established that the
   variant, not the model name, is the deployable unit on both on-premises
   targets.

5. **The `status` enum is unchanged**: `deployed`, `planned`, `rejected`. The
   catalog's four-status human vocabulary continues to map onto it as documented
   in [model selection](../guide/model-selection). Adding a status would break
   every consumer for no gain.

6. **`additionalProperties: false` stays.** It is the property that makes a typo
   in a registry file a build failure instead of a silently ignored key. The cost
   is the coupling in decision 7, and that cost is worth paying.

7. **The schema and `infra/types.bicep` change in the same commit, and the
   commit is gated on `az bicep build` succeeding and
   `az deployment sub what-if` reporting no changes against the live Azure AI
   Foundry environment.** A schema change that alters the deployed resource graph
   is out of scope for this ADR: v2 is additive and must be provably inert.

8. **`infra/main.bicep` filters to `target == 'azure-cloud'` (or absent) before
   generating deployments.** The Bicep must ignore on-premises entries rather
   than fail on them, because a single registry now legitimately contains rows it
   cannot deploy.

## Consequences

Existing registries keep working untouched, which is the property that makes this
safe to land before any on-premises automation exists. The registry becomes the
single machine-readable roster across all three targets, so
[the availability catalogs](../reference/model-catalog-foundry-local) and the
Bicep read from one source.

The conditional-requirement rules make the schema meaningfully harder to read
than v1. That is accepted: the alternative is a schema that validates nonsense.

The `types.bicep` coupling means anyone editing the registry schema must run the
Bicep gate, and this ADR is the record of why. Someone who changes only the JSON
will get a build failure whose cause is not obvious from the error message.

Nothing here deploys anything on either on-premises target. Automation for those
is Phase P and is deliberately not in scope.

## Alternatives considered

**Three separate registry files.** Rejected. The shared ONNX core would be
duplicated across two of them, and duplication of a 35-row list is a drift
generator. It would also mean three schemas, three validators, and three loaders.

**A free-form `metadata` object for on-premises fields.** Rejected. It defeats
`additionalProperties: false`, which is the schema's main safety property, and
moves validation from build time to nobody's time.

**A single `local` target value covering both on-premises targets.** Rejected on
evidence. SPIKE-22 proved the two rosters diverge in both directions, so one
value could not express which entries actually run where.

**Making `target` required.** Rejected. It would invalidate every existing
registry file and force a migration for no benefit, since the default is
unambiguous.

## Sources

- [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), the two on-premises catalogs and the variant-as-deployable-unit finding.
- [ADR-0017](./ADR-0017-deployment-target-documentation-structure) decision 7, which committed to one schema with a discriminator.
- `models/registry.schema.json` and `infra/types.bicep`, the two coupled artifacts.
