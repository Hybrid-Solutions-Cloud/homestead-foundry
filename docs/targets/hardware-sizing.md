# Hardware requirements and sizing for local Foundry

::: info Scope and review date
This page compares **Foundry Local**, the single-device runtime, and **Azure
Local Foundry**, the cluster service Microsoft documents as Foundry Local on
Azure Local. It covers inference hardware, not the Azure-hosted target. Sources
were checked against Microsoft Learn on **2026-08-11**.
:::

## The short answer

| Question | Foundry Local | Azure Local Foundry |
|---|---|---|
| Smallest supported shape | Microsoft publishes no universal CPU, RAM, disk, or video RAM minimum. The CPU provider is the fallback on Windows, Linux, and macOS. | One `Standard_D4s_v3` Linux worker, 4 virtual CPUs and 16 GiB RAM, with at least 14 GiB allocatable memory. |
| Sensible starting point | A small quantized model on a modern 8-core device with 16 to 32 GB RAM. Add an accelerator when interactive latency matters. This is **transferred guidance**, not a Microsoft minimum. | Two or more `Standard_D8s_v3` workers, each with 8 virtual CPUs and 32 GiB RAM. This is Microsoft's recommended worker profile. |
| Is a GPU required? | No. CPU fallback is supported. A graphics processing unit (GPU) or neural processing unit (NPU) improves latency when a compatible model variant exists. | No for supported ONNX CPU models. Yes for CUDA model variants, vLLM, larger models, and the recommended Agentic Retrieval language model. |
| Best fit | One application and one user on a workstation or device. | Concurrent users, multiple models, replicas, high availability, and governed on-premises serving. |
| Practical upper end | A 20-billion-parameter model is possible, but it moves beyond the modest-device design point. Validate it on the exact device. | Multiple CPU and GPU pools. The listed worker shapes reach 32 virtual CPUs, 128 GiB RAM, two GPUs, and 96 GiB aggregate video RAM per virtual machine. Scale beyond one virtual machine with replicas and nodes. |

There is no single useful answer such as "Foundry Local needs 16 GB RAM." The
model format, quantization, context length, runtime, and concurrency all change
the answer. RAM determines whether the model and its key-value cache fit. CPU,
GPU, and NPU capacity then determine how quickly requests complete.

## How to read the numbers

Hardware claims use the provenance labels required by
[ADR-0020](../adr/ADR-0020-on-premises-hardware-sizing-and-gpu-scope):

- **Published** means Microsoft states the number for this product or workload.
- **Transferred** means the number comes from a named, adjacent Microsoft
  deployment example and is being used as a planning boundary, not a support
  promise.
- **Observed** means this project measured the number on named hardware. There
  are no observed numbers on this page because the repository has not yet run
  the gated benchmark.

::: warning Size for a service-level objective, not for model loading
A model loading successfully proves only that the weights fit. It does not prove
acceptable first-token latency, output rate, concurrency, or recovery time.
Benchmark the exact model variant, context length, prompt distribution, and
replica count before buying hardware.
:::

## Foundry Local hardware

### What Foundry Local is designed to run

Foundry Local is an in-application runtime for a single user's device. Microsoft
supports Windows, Linux, and macOS on Apple silicon. The software detects the
hardware, chooses a compatible model variant and execution provider, and falls
back to CPU when no supported accelerator is available. The core runtime can be
embedded in an application; the command-line interface and local REST server are
development and integration surfaces.

The supported scenarios are:

- local chat, reasoning, text generation, and code assistance;
- local Whisper speech-to-text transcription;
- applications that must keep prompts and outputs on the device;
- applications that must continue offline after models and execution providers
  have been downloaded;
- one-user or one-process interactive inference; and
- native software development kit access or a local OpenAI-compatible endpoint.

It is not a multi-user server stack. Microsoft says it has no concurrent request
queueing, continuous batching, or efficient shared-GPU scheduling. Use Azure
Local Foundry or another server-oriented runtime for a shared endpoint. See the
[Foundry Local overview](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local)
and [architecture](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture).

### Supported operating systems and accelerators

| Platform or accelerator | Supported path | Published boundary |
|---|---|---|
| Windows CPU | CPU execution provider | Runs as the universal fallback. Microsoft publishes no minimum CPU generation or core count. |
| Linux CPU | CPU execution provider | Runs as the universal fallback. Microsoft publishes no minimum CPU generation or core count. |
| macOS | Apple silicon using WebGPU through Dawn and Metal, with CPU fallback | Intel Mac is not listed as supported. No minimum Apple chip or unified-memory amount is published. |
| NVIDIA GPU on Windows or Linux | CUDA, WebGPU, or NVIDIA TensorRT RTX | TensorRT RTX requires GeForce RTX 30 series or later, CUDA 12.5, and the documented driver level. WebGPU is the generic GPU fallback. |
| Intel on Windows | OpenVINO on CPU, integrated GPU, or NPU | Tiger Lake or later for CPU, Alder Lake or later for GPU, and Arrow Lake or later for NPU, with the documented driver levels. |
| Qualcomm NPU on Windows | Qualcomm Neural Network execution provider | Snapdragon X Elite or X Plus with driver 30.0.140.0 or later. |
| AMD NPU on Windows | Vitis AI execution provider | Microsoft lists a bounded Adrenalin and NPU driver range. Check the current range before deployment because it has both a minimum and a maximum. |
| Other Direct3D or WebGPU-capable GPU | WebGPU through Dawn | Supported as the generic GPU path. A compatible catalog variant still has to exist for the selected model. |

The current device and driver table is in the
[Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli#execution-providers).
Do not turn the versions above into a long-lived procurement list without
checking that table again.

::: tip Ask the installed runtime, not a static table
Run `foundry model list --filter device=CPU`, `device=GPU`, or `device=NPU` on the
target device. The returned catalog is the authoritative list of model variants
that the installed runtime considers compatible with that hardware.
:::

### Official minimum

Microsoft's current product documentation does **not** publish a universal
minimum for processor cores, system RAM, free disk, video RAM, or NPU throughput.
The Windows AI tutorial has stricter prerequisites for its particular WinML
sample, including Windows 11 24H2, a DirectX 12 GPU, and a .NET software
development kit. Those are tutorial-path requirements, not a universal Foundry
Local hardware floor. The cross-platform package can run on CPU without WinML.
See the [Windows AI Foundry Local tutorial](https://learn.microsoft.com/windows/ai/foundry-local/get-started).

The only dependable minimum is model-specific:

1. The operating system and execution provider must be supported.
2. The selected catalog variant must be available for that device.
3. System or accelerator memory must hold the loaded model, runtime state,
   context, and key-value cache.
4. Disk must hold the model files and any downloaded execution providers.

Use `foundry model info <model>` to inspect the exact variant and `foundry cache
location` to locate the cache. Microsoft documents that execution-provider
packages can be large but does not publish one fixed allowance for them.

### Workload planning profiles

These profiles are decision points, not product limits. "Model class" refers to
the packaged variant, not just the raw parameter count. Quantization can make a
20-billion-parameter model consume less accelerator memory than a less-compressed
7-billion-parameter model.

| Workload | Planning hardware | Accelerator | Capacity expectation | Provenance |
|---|---|---|---|---|
| Install validation and short prompts, 0.5B to 1.5B quantized model | Any supported modern CPU; system RAM and disk remain model-dependent | None required | One interactive user, short context, no latency guarantee | **Published:** CPU fallback is supported. Microsoft publishes no numeric host floor. |
| Everyday single-user chat or coding, 4B class | 4 to 8 CPU cores and 16 to 32 GiB available RAM | CPU works. Prefer a compatible NPU or GPU for interactive latency. | One active request. Use short-to-moderate context first. | **Transferred:** Microsoft's 4.8 GB Phi-4-mini CPU deployment example requests 4 CPU and 16 GiB and limits at 8 CPU and 32 GiB. |
| Accelerated 4B chat | Keep 16 to 32 GB system RAM and select the hardware-specific catalog variant | More than 8 GB usable video or unified memory is a defensible test target, not an on-device requirement | Faster interactive response than CPU when the provider is compatible | **Transferred:** the Azure Local vLLM reference reports 7.806 to 8.428 GB required GPU memory for the Phi mini models. ONNX device builds differ, so measure. |
| 7B general chat or reasoning | Start testing at 8 CPU cores and 32 GB system RAM | Prefer at least 16 GB usable accelerator memory | One user and controlled context. CPU may be acceptable for background work but is not promised to be interactive. | **Transferred:** the Mistral 7B vLLM entry requires 15.64 GB GPU memory. Microsoft publishes no Foundry Local host-RAM number for this class. |
| 20B reasoning or tool use | 8 or more virtual CPUs, 32 GB RAM, and 50 GB storage for development; 16 or more virtual CPUs, 64 GB RAM, and 50 to 100 GB storage for production | 24 GB video RAM minimum; 48 GB recommended | Low concurrency at the lower shape. Larger context and production use at the recommended shape. | **Transferred:** Microsoft publishes these exact figures for GPT-OSS-20B hosted through Foundry Local on Azure Local. Treat them as a conservative device planning boundary, not device certification. |

The 4B CPU figures come from Microsoft's
[bring-your-own-model deployment example](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-run-inference?tabs=cpu-key-bash%2Ccpu-ingress-bash%2Cbyo-key-bash%2Cbyo-ingress-bash#run-inference-with-a-bring-your-own-byo-model).
The 20B figures come from the
[Agentic Retrieval requirements](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements#hardware-requirements-gpt-oss-20b-via-foundry-local).

### Foundry Local buying guidance

- For an existing device, start with the smallest catalog model that satisfies
  the task. Do not buy hardware until the exact model has been tested.
- For a new general-purpose developer device, prioritize RAM capacity first,
  then accelerator compatibility, then CPU cores. Memory decides whether the
  model runs; compute decides how fast it runs.
- For Apple silicon, unified memory is shared by the operating system,
  application, and GPU. Do not treat the installed memory amount as entirely
  available to the model.
- For Windows, a current accelerator with a Microsoft-listed execution provider
  is more useful than an older high-end GPU with an unsupported software path.
- If the requirement includes several simultaneous users, high availability, or
  predictable throughput, stop sizing Foundry Local and size Azure Local Foundry.

## Azure Local Foundry hardware

### What Azure Local Foundry is designed to run

Azure Local Foundry is the local cluster target for:

- generative chat and text inference through ONNX-GenAI on CPU or GPU;
- high-throughput generative inference through vLLM on GPU;
- speech-to-text transcription;
- vision input with supported multimodal models on GPU;
- bring-your-own ONNX predictive workloads such as classification, object
  detection, regression, scoring, and anomaly detection;
- several models, applications, users, and replicas on one cluster;
- connected operation managed through Azure Arc; and
- disconnected operation through Azure Local Disconnected Operations 2604.3.0
  or later.

It does not turn the local model catalog into the Azure cloud catalog. Check the
[Azure Local Foundry model roster](../reference/model-availability-azure-local-foundry)
before selecting hardware. The platform scenarios are documented in the
[Azure Local Foundry overview](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview#supported-workloads).

### Platform floor

Azure Local Foundry runs as an Azure Arc extension on an Azure Kubernetes Service
(AKS) cluster on Azure Local. The current Microsoft requirements are explicit:

| Requirement | Minimum | Recommended | Provenance |
|---|---|---|---|
| Worker virtual machine | `Standard_D4s_v3`, 4 virtual CPUs and 16 GiB RAM | `Standard_D8s_v3`, 8 virtual CPUs and 32 GiB RAM | **Published** |
| Allocatable memory per worker | At least 14 GiB | At least 28 GiB | **Published** |
| Worker count | 1 | 2 or more for high availability or GPU-pool separation | **Published** |
| Capacity left for extension installation | 3 virtual CPUs and 6 GB RAM, after other cluster workloads | Use the recommended worker profile instead of planning to this installation-only floor | **Published** |
| Model cache | 100 GiB persistent volume claim by default | Increase `spec.vllm.modelCacheStorageGi` for larger models such as Magistral | **Published** |
| AKS node operating-system disk | 200 GB by default on Azure Local 2509 and later | Add physical storage for every dynamically expanding node disk and model volume | **Published** |

Do not use the AKS default `Standard_A4_v2` worker for this service. It has only
8 GiB RAM and Microsoft explicitly rules it out. See
[Requirements for Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#cluster-and-hardware-requirements)
and [AKS on Azure Local scale requirements](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements).

### CPU and GPU runtime choices

| Runtime | CPU | GPU | Choose it for |
|---|---|---|---|
| ONNX-GenAI | Supported and the only CPU runtime | Supported with CUDA variants | Smaller models, lower overhead, constrained environments, and workloads where CPU latency is acceptable |
| vLLM | Not supported | Required | High throughput, concurrent requests, larger models, continuous batching, and more efficient key-value-cache use |

The vLLM planner automatically chooses memory-safe context and batching settings
from the available GPU. Use the planner first, then tune only after measuring.
See [inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes).

### Supported GPU node families

GPU workloads require Linux node pools, NVIDIA CUDA drivers, and the NVIDIA
Kubernetes device plugin. AKS on Azure Local does not support GPU partitioning,
so plan on whole-GPU discrete device assignment. AMD GPUs are not supported for
this target.

| GPU | Earliest listed Azure Local release | Supported virtual-machine range | Video RAM range per virtual machine | Good starting use |
|---|---:|---|---:|---|
| NVIDIA T4 | 2408.0 | `Standard_NK6` to `Standard_NK12` | 8 to 16 GiB | Older, low-cost validation where the model supports the Turing generation |
| NVIDIA A2 | 2311.2 | `Standard_NC4_A2` to `Standard_NC32_A2` | 16 to 32 GiB | Small and medium ONNX models, or 4B vLLM models |
| NVIDIA A16 | 2402.0 | `Standard_NC4_A16` to `Standard_NC32_A16` | 16 to 32 GiB | Small and medium ONNX models, or 4B vLLM models |
| NVIDIA L4 | 2512.0 | `Standard_NC16_L4_1` to `Standard_NC32_L4_2` | 24 to 48 GiB | 7B to 20B evaluation and efficient production inference |
| NVIDIA L40 | 2512.0 | `Standard_NC16_L40_1` to `Standard_NC32_L40_2` | 48 to 96 GiB | Production 20B-class models, larger contexts, or two-GPU virtual machines |
| NVIDIA L40S | 2512.0 | `Standard_NC16_L40S_1` to `Standard_NC32_L40S_2` | 48 to 96 GiB | Higher-throughput production serving |
| NVIDIA RTX Pro 6000 | 2603.0 | `Standard_NC16_RTX6000Pro_1` to `Standard_NC32_RTX6000Pro_2` | 48 to 96 GiB | Current high-end production serving |

Several of the newer GPU virtual-machine families are preview features. Confirm
the current Azure Local release and support status in the
[AKS GPU table](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements#supported-gpu-models)
and buy only a GPU solution validated in the
[Azure Local catalog](https://aka.ms/azurelocalcatalog).

### Published model memory anchors

These are vLLM requirements, not general video-RAM rules for every model with a
similar parameter count.

| Model | Recommended GPU generation | Required GPU memory |
|---|---|---:|
| Phi-3.5-mini-instruct | Ampere or later | 8.428 GB |
| Phi-4-mini-instruct | Ampere or later | 7.806 GB |
| Phi-4-mini-reasoning | Ampere or later | 7.806 GB |
| Mistral-7B-Instruct-v0.2 | Ampere or later | 15.64 GB |
| GPT-OSS-20B | Blackwell recommended | 14.793 GB for the referenced vLLM profile; the Agentic Retrieval production recommendation is still 48 GB or more |

Source:
[Generative small language models](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-models).
The apparently smaller number for GPT-OSS-20B is a quantization effect. Do not
size from parameter count alone.

### Workload planning profiles

| Workload | Node and model resources | GPU | Scale and availability | Provenance |
|---|---|---|---|---|
| Extension validation and one small CPU model | 1 `Standard_D4s_v3` worker. Start with one replica and a small ONNX CPU model. | None | Proof of concept only. No node redundancy. | **Published:** minimum worker profile. |
| Shared CPU inference, 4B class | 2 or more `Standard_D8s_v3` workers. For a 4.8 GB-class model, start testing at 4 CPU and 16 GiB requests, with 8 CPU and 32 GiB limits. | None | One replica for initial measurements, then two or more if the latency test passes and availability is required. | **Published:** recommended workers. **Transferred:** Microsoft's CPU BYO resource example. |
| Low-concurrency GPU inference, 4B class | One 16 GiB Ampere GPU virtual machine can clear the published 7.806 to 8.428 GB model requirement. Keep CPU workers for the operator and supporting services. | 1 A2 or A16 class GPU | Development or measured low concurrency. | **Transferred:** supported GPU shapes plus published model memory. |
| 7B model or more context headroom | Use a 24 GiB L4 profile rather than planning a 16 GiB device to a 15.64 GB model requirement. | 1 L4 class GPU | One replica for performance validation; add a second GPU node and replica for availability. | **Transferred:** published 15.64 GB requirement plus the next supported VM memory tier. |
| GPT-OSS-20B development | 8 or more virtual CPUs, 32 GB RAM, at least 50 GB model storage | 1 NVIDIA GPU with at least 24 GB video RAM | Low concurrency | **Published:** Agentic Retrieval model-host minimum. |
| GPT-OSS-20B production | 16 or more virtual CPUs, 64 GB RAM, 50 to 100 GB storage per replica | 1 NVIDIA GPU with at least 48 GB video RAM per replica | Two GPU nodes and two or more replicas when availability is required | **Published:** production recommendation for one model host. **Transferred:** second node and replica follow Microsoft's 2-or-more-worker availability guidance. |
| High-concurrency or multi-model serving | Separate CPU and GPU pools. Use 32-vCPU, 128-GiB CPU workers or 48-to-96-GiB GPU virtual machines where measurements justify them. | L40, L40S, or RTX Pro 6000 class | Scale horizontally. The API permits 1 to 100 replicas, but real capacity is bounded by schedulable CPU, memory, GPU, storage, and network throughput. | **Published:** supported VM and replica ranges. Actual replica count requires measurement. |

The largest listed virtual machine is not a universal product maximum. Azure
Local Foundry scales across nodes and replicas. More hardware only helps when
the scheduler can place another replica or the runtime can use the additional
GPU capacity.

### Agentic Retrieval is a separate sizing class

Agentic Retrieval is not just one language-model pod. Microsoft's combined
knowledge-and-agentic profile calls for:

- three CPU workers with at least 8 virtual CPUs and 32 GB RAM each;
- two GPU-enabled virtual machines, one for BGE-M3 text embeddings and one for
  CLIP ViT-L/14 image embeddings, with `Standard_NC8_A2` or
  `Standard_NC8_A16` suggested;
- a separate language-model GPU with at least 24 GB video RAM for GPT-OSS-20B,
  or 48 GB or more for production; and
- at least 50 GB model storage, increasing to 50 to 100 GB per language-model
  replica for production.

That is a minimum of three CPU workers and three GPU-backed model roles when the
recommended local language model is included. Do not size the extension from the
language model alone. See the complete
[Agentic Retrieval requirements](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements).

## From minimum to production

Use this sequence for either local target:

1. Select the exact model variant and runtime before selecting hardware.
2. Establish whether the weights, context, and key-value cache fit.
3. Measure time to first token, output tokens per second, and peak memory with
   representative prompts.
4. Add the expected concurrency and repeat the test.
5. Add a second node or device only if the product supports the required serving
   pattern. Foundry Local does not become a concurrent server by adding a larger
   GPU.
6. For production, reserve failure capacity. Azure Local Foundry needs enough
   remaining capacity to reschedule a replica after one worker fails.
7. Recheck Microsoft compatibility tables before procurement. Both products are
   evolving and Azure Local Foundry is still in preview.

## Related pages

- [Choose a deployment target](./choosing)
- [Available models: Foundry Local](../reference/model-availability-foundry-local)
- [Available models: Azure Local Foundry](../reference/model-availability-azure-local-foundry)
- [Foundry Local](./windows-server/)
- [Azure Local Foundry](./azure-local/)
- [SPIKE-25: local-track hardware sizing](../research/SPIKE-25-local-track-hardware-sizing)
- [ADR-0020: on-premises hardware sizing](../adr/ADR-0020-on-premises-hardware-sizing-and-gpu-scope)
