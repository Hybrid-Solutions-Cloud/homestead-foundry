# Hardware requirements and sizing for local Foundry

::: info Scope and review date
This page compares **Foundry Local**, the single-device runtime, and **Foundry
Local on Azure Local**, the cluster service. It covers inference hardware, not
Azure-hosted Microsoft Foundry. Sources were checked against current Microsoft
Learn pages on **2026-08-11**.
:::

## Start with the workload

Hardware sizing starts with the serving pattern, not with a model parameter
count. The same quantized model can be appropriate on a laptop for one user and
inappropriate there as a shared service.

| Example workload | Foundry Local | Foundry Local on Azure Local | Why |
|---|---|---|---|
| Private chat or document summary for one person | **Good fit** | Possible, but usually excessive | Foundry Local is designed for an application running on the end user's device. |
| One developer's local coding assistant | **Good fit** | Possible, but usually excessive | One active user and an on-device model match the Foundry Local design point. |
| Offline speech-to-text on one device | **Good fit** | Good fit when it must be shared | Both catalogs include speech transcription. The cluster target adds a managed endpoint and replicas. |
| Small, application-managed retrieval workflow | **Good fit** when compatible embedding and chat models fit | **Good fit** | Foundry Local can supply local chat, speech, and embedding models. The application still owns retrieval. Azure Local also offers a separate Agentic Retrieval extension. |
| Shared team chat endpoint | **Not the intended target** | **Good fit** | Foundry Local does not provide concurrent request queueing, continuous batching, or efficient shared-GPU scheduling. |
| Several models behind governed internal APIs | **Not the intended target** | **Good fit** | Foundry Local on Azure Local supports multi-model serving, Kubernetes scheduling, authentication, and replicas. |
| High-availability on-premises inference | **No** | **Good fit** with multiple workers and replicas | A single device has no cluster failover. Azure Local can spread worker VMs and reschedule replicas. |
| High-concurrency 4B to 20B chat or reasoning | **No** as a shared service | **Good fit** with measured GPU capacity | vLLM on Azure Local provides continuous batching, GPU memory planning, and inference-aware routing. |
| A 20B model for one user on a powerful workstation | **Possible, not a guaranteed fit** | **Good fit** with a supported GPU profile | The device catalog includes GPT OSS models, but Microsoft publishes no universal device requirement. Validate the exact variant on the exact device. |
| Predictive ONNX scoring, classification, or object detection | Application-specific | **Supported** with a bring-your-own ONNX model | Azure Local has a documented predictive inference path. On-device use depends on compiling or packaging a compatible model for the application. |
| Agentic Retrieval over enterprise documents and images | **No built-in service** | **Supported, but infrastructure-heavy** | The Azure Local extension needs CPU workers, embedding GPUs, storage, and a separate language-model endpoint. |
| Image generation, text-to-speech, or video generation | **Not in the documented local workloads** | **Not in the documented local workloads** | Use an Azure-hosted model or another runtime whose catalog and support boundary include the required modality. |
| A 70B-class or larger shared model | **Not a fit** | **Bring-your-own validation only** | It is not a published sizing baseline. It requires supported model packaging, multi-GPU capacity, and workload-specific testing. |

## Why an LLM can run on a laptop

"Large language model" describes the model family, not a fixed hardware bill.
Four factors make selected models practical on consumer devices:

1. The local catalog contains small models, including sub-1B, 4B, and 7B
   examples, not only frontier-scale models.
2. Quantization stores model weights at lower precision, reducing disk and
   memory consumption.
3. Foundry Local is optimized for one user on one device, so it does not reserve
   capacity for many simultaneous requests.
4. CPU fallback lets a compatible model run without a dedicated accelerator.
   A GPU or NPU changes speed more often than basic feasibility.

Microsoft's Windows tutorial downloads a Phi-3.5 Mini variant of approximately
2.53 GB. That file size does **not** equal the RAM requirement: the operating
system, application, runtime, context, and key-value cache also consume memory.
It does show why a carefully compressed model can fit on a laptop while the
uncompressed training model would not.

## How to read the numbers

Hardware claims use the provenance labels required by
[ADR-0020](../adr/ADR-0020-on-premises-hardware-sizing-and-gpu-scope):

- **Published** means Microsoft states the number for this product or workload.
- **Transferred** means the number comes from a named, adjacent Microsoft
  example and is a planning boundary, not a support promise.
- **Observed** means this project measured the number on named hardware. There
  are no observed numbers here because the repository has not run the gated
  benchmark.

::: warning Size for a service-level objective, not for model loading
A model loading successfully proves only that the weights fit. It does not prove
acceptable first-token latency, output rate, concurrency, or recovery time.
Benchmark the exact model variant, context length, prompt distribution, and
replica count before buying hardware.
:::

## Foundry Local hardware

### Product boundary

Foundry Local is an on-device runtime for applications on Windows, Linux, and
Apple-silicon macOS. It detects available hardware, selects a compatible model
variant and execution provider, and falls back to CPU when no supported
accelerator is available.

Microsoft explicitly says it is not a distributed, containerized, or
multi-machine production serving stack. The optional local server can expose an
OpenAI-compatible endpoint to local processes, but it does not add request
queueing, continuous batching, or multi-user capacity management. See the
[Foundry Local overview](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local)
and [best practices](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice#production-deployment-scope).

### Published hardware floor

Microsoft's current product documentation publishes **no universal minimum**
for processor cores, system RAM, free disk, video RAM, or NPU throughput. The
Windows AI WinML tutorial lists Windows 11 24H2, .NET 9, and a DirectX 12 GPU for
that specific sample path. Those are not universal requirements for the
cross-platform Foundry Local SDK, which supports CPU fallback.

The dependable minimum is model-specific:

1. The operating system and execution provider must be supported.
2. The selected catalog variant must be available for that device.
3. System or accelerator memory must hold the model, runtime state, context,
   and key-value cache.
4. Disk must hold the model and any downloaded execution providers.

Run `foundry model info <model>` on the target device before stating a numeric
requirement. Run `foundry model list --device cpu`, `--device gpu`, or
`--device npu` to see the variants the installed runtime exposes.

### Supported accelerator paths

| Platform or accelerator | Supported path | Published boundary |
|---|---|---|
| CPU | CPU execution provider | Universal fallback. Microsoft publishes no minimum CPU generation or core count. |
| Apple silicon | WebGPU through Dawn and Metal, with CPU fallback | Intel Mac is not listed as supported. No minimum Apple chip or unified-memory amount is published. |
| NVIDIA GPU | CUDA, WebGPU, or NVIDIA TensorRT RTX | Current CUDA and TensorRT RTX guidance names GeForce RTX 30 series or later, CUDA 12.5, and the documented driver level. |
| Intel on Windows | OpenVINO on CPU, integrated GPU, or NPU | Tiger Lake or later for CPU, Alder Lake or later for GPU, and Arrow Lake or later for NPU, with current driver requirements. |
| Qualcomm NPU on Windows | Qualcomm Neural Network execution provider | Snapdragon X Elite or X Plus with driver 30.0.140.0 or later. |
| AMD NPU on Windows | Vitis AI execution provider | Microsoft publishes a bounded driver range. Check it before deployment because both a minimum and maximum apply. |
| Other compatible GPU | WebGPU through Dawn | Generic GPU fallback. A compatible catalog variant still has to exist for the model. |

The current compatibility table is in the
[Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli#execution-providers).

### Device planning profiles

These rows are planning statements, not product certifications.

| Workload class | What Microsoft publishes | Defensible planning use | Confidence |
|---|---|---|---|
| Quick install test | `qwen2.5-0.5b` is identified as the smallest common alias and a good quick test. CPU fallback is supported. | Start here on an existing supported device. Do not infer a numeric host minimum from it. | **Published** |
| Single-user 3B to 4B chat | The Windows tutorial downloads a 2.53 GB Phi-3.5 Mini variant. An adjacent Azure Local Phi-4 Mini CPU example uses 4 CPU and 16 GiB requests, with 8 CPU and 32 GiB limits. | A modern device with 16 to 32 GB system memory is a reasonable **test range**, not a Microsoft requirement. Accelerator support usually matters more for interactive speed. | **Published file size; transferred resource range** |
| Single-user 7B chat or reasoning | The current tutorial lists Qwen 2.5 7B and DeepSeek R1 7B as common aliases. No device RAM or video-memory minimum is published. | Test the exact quantized variant. Prefer more memory and a compatible accelerator, but do not publish a fixed requirement without measurement. | **Published availability; numeric requirement unknown** |
| Single-user 20B reasoning | The device overview says the curated catalog covers GPT OSS models. Microsoft publishes 24 GB GPU memory minimum and 48 GB recommended only for GPT-OSS-20B hosted on Azure Local. | Treat 24/48 GB as a conservative adjacent reference, not a Foundry Local device requirement or certification. | **Transferred** |
| Any multi-user or availability-sensitive service | Microsoft says Foundry Local is not a server inference stack. | Stop sizing the device product and use Foundry Local on Azure Local or another server runtime. | **Published product boundary** |

### Buying guidance

- Test the exact model alias and selected hardware variant before buying.
- Prioritize enough memory for the operating system, application, weights,
  context, and cache. CPU, GPU, and NPU capacity then determine latency.
- On Apple silicon, unified memory is shared by the operating system,
  application, and GPU. Installed memory is not all available to the model.
- On Windows, a current accelerator with a listed execution provider is more
  useful than an older device without a supported software path.
- If the requirement includes simultaneous users, high availability, or a
  throughput commitment, Foundry Local is the wrong product boundary.

## Foundry Local on Azure Local hardware

### The node-size names are not Azure cloud VM purchases

Microsoft's AKS on Azure Local documentation uses labels such as
`Standard_D4s_v3`, `Standard_D8s_v3`, and `Standard_NC8_A2`. In this context they
are **AKS Arc node-size profile names** that map to vCPU, RAM, GPU assignment,
and GPU memory for virtual machines running on the customer's Azure Local
infrastructure.

They are not Azure public-cloud VM deployments, regional capacity promises, or
physical server SKUs. The cores, memory, storage, and NVIDIA GPUs come from the
customer's validated Azure Local hardware. Use the profile label only when
configuring AKS Arc. Use the actual resource quantities when planning or buying
hardware.

### Platform floor

| Requirement | Minimum actual capacity | Recommended actual capacity | AKS Arc profile reference | Provenance |
|---|---|---|---|---|
| Linux worker VM | 4 vCPU, 16 GiB RAM, at least 14 GiB allocatable | 8 vCPU, 32 GiB RAM, at least 28 GiB allocatable | `Standard_D4s_v3`; `Standard_D8s_v3` | **Published** |
| Worker count | 1 | 2 or more for high availability or CPU/GPU pool separation | Node-pool count, not a cloud SKU | **Published** |
| Free capacity for extension installation | 3 vCPU and 6 GB RAM after existing cluster workloads | Use the recommended worker capacity instead of planning to this installation-only floor | No separate profile | **Published** |
| Model cache | 100 GiB PVC by default | Increase `spec.vllm.modelCacheStorageGi` when a model exceeds 100 GiB | Kubernetes storage, backed by local physical storage | **Published** |
| AKS node OS disk | 200 GB default on Azure Local 2509 and later | Reserve physical storage for every dynamically expanding node disk and model volume | Local virtual disk | **Published** |

Do not use the default 4-vCPU, 8-GB AKS Arc Linux worker profile for this
service. Microsoft explicitly requires at least the 4-vCPU, 16-GiB profile. See
[Foundry Local on Azure Local requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#cluster-and-hardware-requirements)
and [AKS on Azure Local scale requirements](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements).

### Translate worker VMs into physical Azure Local capacity

A node profile is only a virtual allocation. A physical design must include:

1. AKS control-plane VMs.
2. Every CPU worker VM and GPU worker VM at its full configured vCPU and RAM.
3. GPUs assigned through discrete device assignment to Linux worker VMs.
4. Azure Local infrastructure, Arc resource bridge, AKS system pods, Istio,
   certificate services, monitoring, and unrelated cluster workloads.
5. Node operating-system disks, model-cache PVCs, container images, logs, and
   update headroom.
6. Failure capacity. For production, the remaining physical hosts must be able
   to run the required worker VMs and replicas after one host is unavailable.

Do not add only the model pod requests and call that a server bill of materials.
Use a validated system from the
[Azure Local catalog](https://aka.ms/azurelocalcatalog), then perform a complete
cluster capacity calculation with the hardware vendor.

### Runtime choice

| Runtime | CPU | GPU | Use it for |
|---|---|---|---|
| ONNX Runtime / ONNX-GenAI | Supported and the only generative CPU runtime | Supported with CUDA model variants | Smaller models, lower overhead, predictive ONNX workloads, and cases where measured CPU latency is acceptable |
| vLLM | Not supported | Required | Large models, high concurrency, continuous batching, multi-replica routing, and more efficient GPU memory use |

The vLLM planner tunes memory utilization, context length, and batch settings
from the available GPU. Multi-replica vLLM deployments can use the Endpoint
Picker for queue-depth and key-value-cache-aware routing. See
[inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes).

### Supported physical GPU families and local node profiles

GPU workloads require Linux node pools, NVIDIA drivers, and the NVIDIA device
plugin. AKS on Azure Local uses discrete device assignment for these workloads
and does not support GPU partitioning. AMD GPUs are not supported by Foundry
Local on Azure Local.

| Physical NVIDIA GPU | Earliest listed Azure Local release | Published local GPU-node resources | AKS Arc profile labels |
|---|---:|---|---|
| T4 | 2408.0 | 6 to 12 vCPU, 12 to 24 GiB RAM, 8 to 16 GiB GPU memory | `Standard_NK6`, `Standard_NK12` |
| A2 | 2311.2 | 4 to 32 vCPU, 8 to 128 GiB RAM, 16 to 32 GiB GPU memory | `Standard_NC4_A2` through `Standard_NC32_A2` |
| A16 | 2402.0 | 4 to 32 vCPU, 8 to 128 GiB RAM, 16 to 32 GiB GPU memory | `Standard_NC4_A16` through `Standard_NC32_A16` |
| L4 | 2512.0 | 16 to 32 vCPU, 64 to 128 GiB RAM, 24 to 48 GiB GPU memory | `Standard_NC16_L4_1` through `Standard_NC32_L4_2` |
| L40 | 2512.0 | 16 to 32 vCPU, 64 to 128 GiB RAM, 48 to 96 GiB GPU memory | `Standard_NC16_L40_1` through `Standard_NC32_L40_2` |
| L40S | 2512.0 | 16 to 32 vCPU, 64 to 128 GiB RAM, 48 to 96 GiB GPU memory | `Standard_NC16_L40S_1` through `Standard_NC32_L40S_2` |
| RTX Pro 6000 | 2603.0 | 16 to 32 vCPU, 64 to 128 GiB RAM, 48 to 96 GiB GPU memory | `Standard_NC16_RTX6000Pro_1` through `Standard_NC32_RTX6000Pro_2` |

The L4, L40, L40S, and RTX Pro 6000 profiles are listed as preview in the
current AKS table. Recheck the
[AKS GPU compatibility table](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements#supported-gpu-models)
and the Azure Local catalog before procurement.

### Published vLLM model memory anchors

These figures apply to the named vLLM profiles. They are not general rules for
all models with the same parameter count.

| Model | Recommended GPU generation | Required GPU memory |
|---|---|---:|
| Phi-3.5-mini-instruct | Ampere or later | 8.428 GB |
| Phi-4-mini-instruct | Ampere or later | 7.806 GB |
| Phi-4-mini-reasoning | Ampere or later | 7.806 GB |
| Mistral-7B-Instruct-v0.2 | Ampere or later | 15.64 GB |
| GPT-OSS-20B | Blackwell recommended | 14.793 GB |

The [vLLM model reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models)
also publishes A10 benchmark results for these five models at one, two, four,
and eight concurrent requests. Those figures are useful evidence for that exact
GPU and test method. They are not performance promises for A2, L4, L40, L40S,
RTX Pro 6000, or CPU nodes.

### Workload planning profiles

| Workload | Actual resource starting point | GPU | Scale and availability | Provenance |
|---|---|---|---|---|
| Extension validation and one small CPU model | One worker VM with 4 vCPU, 16 GiB RAM, and at least 14 GiB allocatable | None | Proof of concept only, with no node redundancy | **Published minimum** |
| Shared CPU inference, 4B class | Two or more worker VMs with 8 vCPU and 32 GiB RAM each. Start model testing at 4 CPU and 16 GiB requests, with 8 CPU and 32 GiB limits. | None | Measure one replica first, then add replicas only when the CPU latency target passes | **Published worker recommendation; transferred model example** |
| Low-concurrency 4B GPU inference | One local GPU worker with at least 16 GiB GPU memory and enough RAM for the selected node profile | One supported A2 or A16 assignment | Development or measured low concurrency. Keep CPU capacity for platform services. | **Transferred from published GPU profiles and model memory** |
| 7B model with context headroom | Start with a supported 24-GiB GPU profile rather than filling a 16-GiB device to a 15.64-GB model requirement | One L4 assignment | Validate one replica, then add a second GPU worker and replica for availability | **Transferred from published model memory and GPU profiles** |
| GPT-OSS-20B development | 8 or more vCPU, 32 GB RAM, at least 50 GB model storage | One NVIDIA GPU with at least 24 GB GPU memory | Development and low concurrency | **Published Agentic Retrieval model-host minimum** |
| GPT-OSS-20B production | 16 or more vCPU, 64 GB RAM, and 50 to 100 GB storage per replica | One NVIDIA GPU with at least 48 GB GPU memory per replica | Use multiple GPU workers and replicas when availability is required | **Published per-host recommendation; replica topology requires measurement** |
| High-concurrency or multi-model serving | Separate CPU and GPU pools. Add workers and replicas from measured request, memory, and GPU demand. | L40, L40S, or RTX Pro 6000 where validated and justified | Size the physical cluster for normal load and one-host failure | **Supported pattern; exact quantity requires measurement** |

The `Standard_D*`, `Standard_NC*`, and `Standard_NK*` names may appear in
deployment commands. They are implementation labels for the local worker VM
resources above, not substitutes for the physical-capacity calculation.

### Agentic Retrieval is a separate sizing class

Microsoft's current Agentic Retrieval requirements state:

- three or more CPU VMs, each with at least 8 vCPU and 32 GB RAM;
- two GPU-enabled VMs for the BGE-M3 text-embedding and CLIP ViT-L/14
  image-embedding roles;
- a separate language-model endpoint;
- when GPT-OSS-20B supplies that endpoint, one additional GPU with at least
  24 GB GPU memory, or at least 48 GB for production; and
- at least 50 GB model storage, increasing to 50 to 100 GB per GPT-OSS-20B
  replica for production.

::: warning Preview documentation conflict
The same Microsoft requirements page says two embedding GPU VMs in its resource
description and deployment-mode table, but its minimum cluster-capacity summary
shows one GPU worker for combined mode. Plan conservatively for the two named
embedding roles and confirm the supported topology during preview onboarding
before purchasing hardware.
:::

See the complete
[Agentic Retrieval requirements](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements).

## From minimum to production

1. Select the exact model variant and runtime before selecting hardware.
2. Confirm that weights, runtime state, context, and key-value cache fit.
3. Measure time to first token, output tokens per second, and peak memory with
   representative prompts.
4. Add expected concurrency and repeat the test.
5. Add nodes or replicas only when the runtime and scheduler can use them.
   A larger device does not turn Foundry Local into a concurrent server.
6. For production on Azure Local, reserve enough physical capacity to run the
   required replicas after one host fails.
7. Recheck Microsoft compatibility tables before procurement. Both products
   evolve quickly, and Foundry Local on Azure Local remains in preview.

## Related pages

- [Choose a deployment target](./choosing)
- [Available models: Foundry Local](../reference/model-availability-foundry-local)
- [Available models: Foundry Local on Azure Local](../reference/model-availability-azure-local-foundry)
- [Foundry Local](./windows-server/)
- [Foundry Local on Azure Local](./azure-local/)
- [SPIKE-25: local-track hardware sizing](../research/SPIKE-25-local-track-hardware-sizing)
- [ADR-0020: on-premises hardware sizing](../adr/ADR-0020-on-premises-hardware-sizing-and-gpu-scope)
