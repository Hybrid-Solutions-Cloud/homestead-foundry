# Session handoff

Updated: 2026-08-11

## Current task

Fact-check and correct the public hardware requirements and sizing guidance for
Foundry Local and Foundry Local on Azure Local, then create a professionally
formatted Word field guide with workload-fit examples and separate product
sections.

## Status

Complete and validated. Changes are local and uncommitted because the owner did
not request a commit or push. The Word deliverable is outside the repository at
`D:/tmp/Foundry-Local-Hardware-Requirements-and-Sizing-Guide-2026-08-11.docx`
because repository governance permits Markdown documentation only.

## Repository changes

- Rebuilt `docs/targets/hardware-sizing.md` around workload fit, the device
  product boundary, model-specific sizing, actual Azure Local capacity, GPU
  assignment, runtime choice, Agentic Retrieval, and a measurable acceptance
  method.
- Corrected `docs/targets/azure-local/index.md` and
  `docs/targets/choosing.md` so Azure Local resource requirements lead with
  vCPU, RAM, allocatable memory, storage, GPU, and worker count.
- Updated ADR-0020 to require actual resource quantities before AKS Arc
  node-profile labels.
- Added a dated correction to SPIKE-25 for the AKS Arc terminology, current A10
  vLLM benchmarks, whole-GPU DDA behavior, Kubernetes request-based scheduling,
  and the Agentic Retrieval preview-document conflict.

## Important conclusions

- `Standard_D*`, `Standard_NC*`, and `Standard_NK*` names in the relevant AKS
  on Azure Local documentation are local node-size profile labels. They are not
  Azure public-cloud VM purchases or physical server models.
- The published Foundry Local on Azure Local floor is one Linux worker VM with
  4 vCPU, 16 GiB RAM, and at least 14 GiB allocatable memory. The recommended
  worker allocation is 8 vCPU, 32 GiB RAM, and at least 28 GiB allocatable, with
  two or more workers recommended for availability or pool separation.
- Current Microsoft documentation publishes no universal numeric CPU, RAM,
  disk, GPU-memory, or NPU minimum for device Foundry Local. Tutorial
  prerequisites are path-specific, and the exact catalog variant must be tested
  on the exact device.
- Foundry Local is an on-device, single-user runtime, not a distributed or
  concurrent shared-serving stack. Foundry Local on Azure Local is the correct
  target for shared endpoints, replicas, high availability, and vLLM serving.
- Kubernetes schedules from resource requests, not limits. A 16 GiB request
  with a 32 GiB limit can schedule on a 28 GiB-allocatable worker, but the higher
  limit is overcommit and is not guaranteed capacity.
- AKS Arc GPU workers use whole-GPU DDA on Linux. GPU partitioning is not
  supported for AKS Arc, but a supported worker profile may receive one or two
  whole GPUs.
- Current Agentic Retrieval preview documentation names two embedding GPU roles
  but shows one GPU worker in a separate combined-capacity summary. The guide
  uses the conservative two-role interpretation and requires preview validation
  before procurement.

## Word deliverable validation

- Ten-page document rendered and visually inspected page by page at 150 DPI.
- Exact Word table geometry audit passed for every table.
- Accessibility audit passed with zero high, medium, or low findings.
- The document uses Letter portrait, one-inch margins, Calibri, repeated table
  headers, real numbered lists, source hyperlinks, running headers, and page
  numbers.

## Repository validation

- `npm run docs:build` from `docs/`: passed.
- `git diff --check`: passed.
- Changed-file em-dash check: passed.
- VitePress emitted only the existing large-chunk advisory.

## Working tree

Modified:

- `docs/adr/ADR-0020-on-premises-hardware-sizing-and-gpu-scope.md`
- `docs/research/SPIKE-25-local-track-hardware-sizing.md`
- `docs/targets/azure-local/index.md`
- `docs/targets/choosing.md`
- `docs/targets/hardware-sizing.md`

The `.ai/` directory remains untracked session state. No commit or push was
performed.

## Open work

- No workload benchmark was run. Exact latency, throughput, concurrency, model
  density, and recovery behavior remain workload-specific acceptance tests.
- Recheck the live Microsoft compatibility tables before hardware procurement.
- Owner review, commit, and push are optional next steps.
