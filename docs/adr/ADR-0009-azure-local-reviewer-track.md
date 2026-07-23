# ADR-0009: Azure Local on-prem reviewer / RAG track (open-weight substitute)

- Status: Proposed
- Date: 2026-07-22

This ADR records the decision to open a narrowly scoped, on-premises track for
an open-weight reviewer / RAG capability on the owner's existing **Azure Local**
cluster, as a substitute (not identical) parallel to the cloud reviewer-LLM
pairing already planned in the model roster (`gpt-5.6-terra`,
`grok-4-1-fast-reasoning`). It is grounded entirely in
`docs/research/SPIKE-09-azure-local-foundry.md`; where that spike logged an
UNKNOWN, this ADR carries it forward rather than resolving it.

This ADR authorizes **no deployment**. It records that the track is worth
pursuing and under what conditions, gated the same way every other model in
this backlog is: spike, then ADR, then design, then a gated deploy.

## Context

SPIKE-09 (`docs/research/SPIKE-09-azure-local-foundry.md`) independently verified,
against Microsoft first-party sources, whether this repo's Foundry model roster
(or comparable models) can run on Azure Local (Arc-connected, cluster-scale
on-prem infrastructure, formerly Azure Stack HCI) as a second hosting target
beside the cloud AIServices path. Its companion, SPIKE-08, covers Foundry Local
as an on-device runtime; the two are cross-referenced but distinct products.

The forces this decision must reconcile, all from SPIKE-09:

- **The on-prem mechanism is Kubernetes-native, open-weight, text-only.** The
  first-party path is "Foundry Local on Azure Local" (public preview), an Azure
  Arc extension (extension type `Microsoft.Foundry`) on AKS enabled by Azure Arc.
  It serves open-weight small language models and predictive models through an
  OpenAI-compatible API, on two engines: ONNX-GenAI (CPU or GPU) and vLLM (GPU
  only). There is **no image-generation engine and no text-to-speech engine** in
  the supported-workloads list.
- **Zero of this repo's roster runs there.** SPIKE-09's roster-fit table
  confirms MAI-Image-2.5, the three FLUX models, MAI-Voice-2, and Sora have no
  runtime on Azure Local (no diffusion, no TTS, no video engine; also all
  proprietary hosted, not open weights). The planned cloud reviewers
  `gpt-5.6-terra` (OpenAI) and `grok-4-1-fast-reasoning` (xAI) also cannot run
  there: they are cloud-only hosted models, not open weights.
- **The one genuine, if inexact, fit is the reviewer / RAG role.** Comparable
  open-weight reasoning models are in the Foundry Local catalog (`gpt-oss-20b`,
  Phi-4 / Phi-4-mini-reasoning, DeepSeek-R1-distill-Qwen, Qwen2.5). These can
  serve a local "second eyes" reviewer or a RAG assistant, optionally fronted by
  Agentic Retrieval for grounding over the repo's own prompt and brand material,
  keeping that content on-prem. They are substitutes for the planned cloud pair,
  not the exact roster entries.
- **The owner already operates the substrate.** Azure Local is the current name
  for Azure Stack HCI, so the owner's S2D storage, Hyper-V compute, Network ATC
  networking, and failover clustering are the same platform. The marginal cost
  of adding a local open-weight inference capability is mostly GPU hardware plus
  power, not a greenfield platform build. That is the whole reason this track is
  worth an ADR rather than a rejection.
- **Governance carries over.** Because Azure Local is Arc-managed, the repo's
  CAF / WAF model applies with little change: Entra ID token auth (via a
  Microsoft identity sidecar) or API keys, Azure RBAC, Azure Policy, Azure
  Monitor, and Cost Management all reach the on-prem endpoint. CAF naming and WAF
  pillar reviews apply unchanged.
- **Cost is structurally opposite to cloud.** Azure Local bills a flat rate per
  physical processor core per month on the Azure invoice, with no per-token or
  per-character inference charge; inference runs on owned cores and GPUs. Cloud
  AIServices is pure consumption (token-metered images, $22 per 1M characters for
  voice per SPIKE-02). Azure Local rewards high, steady utilization; the cloud
  path rewards bursty, low-volume use. This repo's generation workloads are the
  bursty kind, so cloud stays cheaper for them unless the cluster and GPUs
  already exist and are justified by other workloads.

## Decision

**Open a narrowly scoped Azure Local reviewer / RAG track as a substitute,
parallel option to the cloud reviewer-LLM pairing, not a rehost of the
generation backbone, and not a replacement for the planned cloud reviewers.**

1. **The cloud AIServices path stays the backbone for scene art and narration.**
   No image or voice generation moves to Azure Local. This is closed by
   SPIKE-09's finding that no image-generation and no TTS engine exists there.
2. **The only on-prem workload in scope is an open-weight reviewer / RAG
   capability**: a local reasoning model (`gpt-oss-20b`, Phi-4-reasoning,
   DeepSeek-R1-distill, or Qwen2.5), optionally fronted by Agentic Retrieval for
   on-prem grounding over the repo's own prompt and brand material. This is a
   sovereign, on-prem "second eyes" reviewer or RAG assistant.
3. **This track is a substitute / parallel option, not a replacement.** The
   planned cloud pair (`gpt-5.6-terra`, `grok-4-1-fast-reasoning`) in
   the model roster remains the primary reviewer plan and is not superseded by
   this ADR. The Azure Local option is recorded as a distinct track the owner may
   pursue where on-prem sovereignty, fixed-cost economics, or disconnected
   operation matter more than exact model parity.
4. **The track is gated on three preconditions surfaced by SPIKE-09**, all of
   which must hold before any design or deploy work begins:
   - (a) **GPU-validated Azure Local hardware with a supported NVIDIA card
     actually present.** The owner's existing S2D / Hyper-V / Network ATC
     capability does not imply GPUs are installed. AKS Arc GPU support is on
     Linux node pools only, from the release-gated matrix (A2, A16, T4, then
     L4 / L40 / L40S, then RTX Pro 6000).
   - (b) **An AKS enabled by Azure Arc cluster with a GPU-enabled Linux user node
     pool using DDA passthrough.** AKS Arc does not support GPU partitioning
     (GPU-P); it uses Discrete Device Assignment (vfio-pci passthrough) only,
     which means no GPU live migration and lower density than GPU-P, a real
     trade against the usual clustered-VM HA expectations. The cluster control
     plane and system node pool must use a standard non-GPU VM size; the GPU
     Linux user node pool is added afterward.
   - (c) **Preview access approval for the Foundry Local Arc extension**, which is
     public preview by request (`aka.ms/FoundryLocalAzure_PreviewRequest`), no
     SLA. Preview-no-SLA risk is accepted the same way the owner already accepted
     it for the cloud MAI models.
5. **CAF / WAF discipline applies (D-04), unchanged.** Any resource this track
   provisions follows this repo's CAF pattern
   `<resource-type-abbreviation>-<workload>-<env>-<region>-<instance>` (example
   only, not a provisioning instruction: an AKS Arc cluster named
   `aks-foundryrev-demo-eus-01` in a resource group `rg-foundryrev-demo-eus-01`),
   passes a five-pillar WAF review before it is considered reviewable, and gets a
   Bicep parameter entry once Phase D's registry-driven deployment exists.
   Governance uses Entra ID token auth, Azure RBAC, Azure Policy, Azure Monitor,
   and Cost Management, all of which reach the Arc-managed endpoint.
6. **Standard gate, no live deploy from this ADR.** If pursued, a follow-up
   design doc and a separately gated deployment are required. This ADR is a
   decision record only; it authorizes no provisioning, no preview enrollment,
   and no spend.

## Consequences

**Positive.**
- Records a real, first-party-verified on-prem option for the reviewer / RAG
  role without pretending the generation backbone can move on-prem (it cannot).
- Leans on infrastructure the owner already operates, so the incremental cost of
  the capability is mostly GPU hardware plus power, not a new platform.
- Fixed-cost, per-physical-core economics with no per-token inference charge can
  favor a steady, sovereign reviewer workload, and disconnected / air-gapped
  operation is supported (local container registry, cert-manager, local AD).
- Keeps the CAF / WAF governance model intact because the whole thing is
  Arc-managed: Entra ID, Azure RBAC, Azure Policy, Azure Monitor, Cost
  Management all apply.

**Negative / trade-offs.**
- The on-prem reviewer is a **substitute**, not the exact planned pair; model
  parity with `gpt-5.6-terra` / `grok-4-1-fast-reasoning` is not achieved.
- AKS Arc is DDA-passthrough only (no GPU-P), so the GPU node cannot live-migrate
  and GPU density is lower, a real trade against the owner's usual clustered-VM
  HA expectations.
- Foundry Local on Azure Local is public preview, by request, with no SLA and no
  published GA date; any production reliance waits on GA or an explicit accepted
  preview-risk decision.
- The fixed-cost model only pays off at high, steady utilization; for this
  repo's bursty, low-volume generation shape the cloud path stays cheaper, so
  this track's economic case rests on the cluster and GPUs already being
  justified by other workloads.

**Not yet decided (UNKNOWNs carried from SPIKE-09).**
- **Vision-capable reviewer.** Whether any Foundry Local catalog model is
  vision-capable enough to grade generated art is UNKNOWN. If no vision-capable
  local model exists, this track's role narrows to a **text-only** reviewer / RAG
  assistant, which weakens (but does not kill) the case, since grading images is
  the reviewer pair's core job. Resolve by reading the live catalog
  (`aka.ms/FL_Models`) for a multimodal / vision entry and testing image input on
  `/v1/chat/completions` before committing to design.
- **Exact per-physical-core price.** The per-core billing model is first-party
  confirmed; the specific figure (about $10/core/month host fee, about
  $23.30/core Windows Server guest add-on, Azure Hybrid Benefit may waive the
  host fee) comes from a Microsoft Q&A and the GitHub Enterprise Local billing
  page, not a rendered pricing table. Confirm live at
  `azure.microsoft.com/pricing/details/azure-local/` or via an account rep quote
  at design time.
- **Key Vault path for the extension's own secrets.** A documented Azure Key
  Vault flow for the Foundry Local extension's API keys was not found; docs
  describe API-key and Entra-ID auth and an app registration. Confirm whether the
  extension supports a Key Vault-backed or CSI secret store before design.
- **GPU SKU and matrix GA in the owner's build.** Whether the full
  L4 / L40 / L40S / RTX Pro 6000 matrix and the two-GPU multi-rack SKUs are GA in
  the region and release the owner runs is UNKNOWN (GPU support is release-gated;
  two-GPU SKUs are "not yet GA"). Resolve against the owner's actual Azure Local
  build number and the Azure Local catalog "AI workload" solution list.
- **Preview-to-GA timeline and SLA.** No GA date is published for Foundry Local
  on Azure Local.

**Follow-ups.**
- Before any design work, resolve the vision-capable-reviewer UNKNOWN, since it
  decides whether this hosts a genuine second-eyes image reviewer or only a
  text-only reviewer / RAG assistant.
- If the three gates clear and the vision UNKNOWN resolves acceptably, write the
  design doc and a separately gated deployment plan.
- Confirm the per-core price, the Key Vault secret path, and the GPU SKU / matrix
  GA state against the owner's live environment at design time.

## Alternatives considered

- **Rehost the image / voice generation backbone on Azure Local.** Rejected:
  SPIKE-09 confirms no image-generation engine and no TTS engine exist on Foundry
  Local on Azure Local, and every generation model on the roster is proprietary
  hosted (not open weights). The cloud AIServices path stays the backbone.
- **Replace the planned cloud reviewer pair with the on-prem open-weight model.**
  Rejected: the local models are substitutes, not the exact `gpt-5.6-terra` /
  `grok-4-1-fast-reasoning` pairing, and the vision-grading capability is
  unverified. The cloud pair remains primary; Azure Local is recorded as a
  distinct parallel track, not a replacement decision.
- **Use the on-device Foundry Local runtime (SPIKE-08) instead of Azure Local.**
  Deferred to SPIKE-08 / its own ADR: on-device is device-scale, offline-first,
  no Azure subscription, no cluster HA or Azure RBAC; Azure Local is
  cluster-scale, Arc-governed, multinode. They are complementary deployment
  targets of the same product family, not interchangeable here. The reviewer /
  RAG substitute story is shared by both.
- **Skip an ADR and leave Azure Local out of the backlog entirely.** Rejected:
  the owner already operates the Azure Local substrate, so the incremental cost
  of a sovereign reviewer / RAG capability is small enough to warrant a recorded,
  gated decision rather than an undocumented omission.
- **Authorize a preview enrollment or deployment from this ADR.** Rejected: this
  repo's discipline is spike, then ADR, then design, then a gated deploy. This
  ADR records the decision and its gates only.

## Sources

- `docs/research/SPIKE-09-azure-local-foundry.md` (the mechanism, roster-fit table,
  GPU / DDA-only / Linux-node-pool constraints, per-core cost model, Entra ID /
  Azure RBAC governance fit, preview-by-request status, and all five carried
  UNKNOWNs; this ADR adds no facts beyond it)
- the model roster (the planned cloud reviewer pair `gpt-5.6-terra` and
  `grok-4-1-fast-reasoning`, and the CAF / WAF discipline every backlog model
  follows)
- the decision log (D-04 CAF / WAF enforcement; decision-numbering convention)
- `docs/adr/ADR-0006-cost-governance.md` (the 100 USD cap and the cloud
  consumption cost baseline this on-prem cost model is contrasted against)
- `docs/adr/ADR-0008-publish-pipeline-integration.md` (the cloud generation
  pipeline this track explicitly does not replace)
