# ADR-0019: The on-premises model rosters, and the first increment for each

- Status: Proposed
- Date: 2026-07-30

## Context

Neither on-premises target has a chosen model. The catalogs are now enumerated in
full ([SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), 170 entries),
and [model selection](../guide/model-selection) says a model entering the roster
is a catalog row plus a registry entry rather than a new ADR. This ADR is
therefore not a per-model decision. It settles the two things the methodology
cannot express on its own: **which roster each target draws from**, and **what
the first increment is** on hardware that does not exist yet.

Three findings constrain it.

**The rosters diverge in both directions.** Azure Local Foundry carries 100 vLLM
entries Foundry Local cannot run; Foundry Local carries NPU and generic-GPU
variants Azure Local Foundry never syncs. Only a 35-alias ONNX core is shared.

**Neither on-premises target generates images, synthesizes speech, or produces
embeddings.** Nothing in this repository's cloud roster has an on-premises
equivalent. The rosters are disjoint from the cloud one, not a subset of it.

**No CPU, RAM, or disk minimum is published for Foundry Local on Windows**
([SPIKE-25](../research/SPIKE-25-local-track-hardware-sizing)), so a first
increment cannot be justified by a sizing table. It has to be justified by being
small enough that the sizing question does not bind.

## Decision

1. **Each target draws from its own column of the shared catalog page**, not from
   a target-specific page. [ADR-0017](./ADR-0017-deployment-target-documentation-structure)
   decision 5, as annotated, settled this: one page, three sections, two
   per-target columns.

2. **The first increment on both on-premises targets is the shared ONNX core,
   CPU-only.** Specifically `Phi-4-mini-instruct-generic-cpu`, which is the one
   entry with a published size (4.8 GB CPU) **and** a published licence (MIT).
   Every other row in the catalog has `UNKNOWN` in at least one of those columns,
   and adopting a model whose licence is unverified is not acceptable in a
   repository that is public.

3. **No GPU is required for either first increment.** This carries forward
   [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers)'s amendment
   of ADR-0009: CPU-backed deployments are a first-class documented path, so the
   GPU precondition is not a gate on getting started.

4. **The vLLM roster is out of scope for the first increment**, on both targets:
   it is GPU-only, it is 100 entries with no published sizes, and it exists on
   only one of the two targets. It becomes in scope when GPU hardware exists and
   a workload needs it.

5. **Vision, if ever required on premises, forces Azure Local Foundry.**
   `pixtral-12b-2409` and the three `nemotron-nano-12b-v2-vl` variants are the
   only vision-capable on-premises entries and they are vLLM and GPU only.
   Recorded here so the constraint is not rediscovered later.

6. **Speech to text is available on both targets and is the one modality that
   transfers from the cloud roster in spirit.** Five Whisper sizes on both, plus
   three NVIDIA streaming ASR models on Foundry Local and one on Azure Local
   Foundry. It is not adopted in the first increment, but it is the obvious
   second.

7. **Sizes and licences stay `UNKNOWN` in the catalog until a running install
   reports them.** They must not be back-filled from upstream model cards. The
   ONNX build's licence is a property of the build, not of the upstream model,
   and assuming otherwise is exactly the kind of unsourced claim this repository
   treats as a defect.

8. **No model is marked `deployed` on either target until it has answered a real
   request.** Until then every on-premises registry entry is `planned`.

## Consequences

Both targets start from the same model, which makes the first cross-target
comparison meaningful: the same weights, the same execution provider class, two
different hosting stories. That is the most useful possible first data point for
a methodology repository.

Choosing the only MIT-licensed, fully-sized row means the first increment is
defensible in public without any further research. It also means the choice is
driven by documentation quality rather than by capability, which is an honest
constraint to state rather than hide.

The rosters staying disjoint from the cloud one means this repository will
maintain two unrelated model stories permanently. That is a real ongoing cost and
it is the direct consequence of the products actually being different.

Nothing here is deployable until Phase P writes the automation and hardware
exists.

## Alternatives considered

**Adopt `gpt-oss-20b` as the first increment**, since it is Microsoft's
recommended model for Agentic Retrieval. Rejected for now: it "requires its own
GPU", its ONNX size is `UNKNOWN`, and its vLLM entry wants 14.793 GB of GPU
memory with Blackwell-class hardware recommended. It is the right second step
once a GPU exists.

**Mirror the cloud roster on premises.** Impossible, not merely undesirable. No
cloud model in this repository's catalog has an on-premises build.

**Pick the largest model each target can run.** Rejected. With no published
hardware minimum on Foundry Local, "largest it can run" is unknowable in advance,
and SPIKE-25 showed the one available measurement does not generalize.

**Defer any model choice until hardware exists.** Rejected. The choice is
research-complete now, and deferring it would leave the target pages unable to
say anything concrete.

## Sources

- [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), the full 170-entry enumeration and the divergence finding.
- [SPIKE-25](../research/SPIKE-25-local-track-hardware-sizing), the absence of any published hardware minimum.
- [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers), the CPU-first amendment to ADR-0009.
- [Available models: Foundry Local and Azure Local Foundry](../reference/model-catalog-foundry-local), the catalog these rosters draw from.
