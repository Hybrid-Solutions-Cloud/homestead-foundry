# SPIKE-25: Hardware sizing and capacity planning for the two local Foundry tracks

Role: foundry-researcher (Opus). Status: research spike complete. Read-only: no Azure resources created, read, or modified; no `az` command run; no software installed; no benchmark executed; no cluster touched. First-party documentation review only.
Date: 2026-07-30
Scope: hardware sizing and capacity planning for deployment track 2 (Foundry Local on Windows Server) and track 3 (Foundry Local on Azure Local). Closes SPIKE-19 UNKNOWN #4 (whether the GPU SKUs in scope are release-gated, and how) and fills the sizing gap that neither track currently documents: ADR-0013 commits track 2 to a CPU-only quantized model without saying what hardware that needs, and ADR-0014 commits track 3 to a `Standard_D8s_v3` worker pool without saying what `resources` a `ModelDeployment` on it should carry. Every factual claim is grounded in a first-party (Microsoft Learn) source, cited inline. Anything Microsoft has not published is marked **UNKNOWN** with the test or doc that would resolve it. Any figure I derived by arithmetic from first-party numbers is labelled **derived** at the point of use. This spike authorizes no deployment and no spend.

Depends on: `docs/research/SPIKE-08-foundry-local-on-device.md`, `docs/research/SPIKE-09-azure-local-foundry.md`, `docs/research/SPIKE-18-foundry-local-windows-server.md`, `docs/research/SPIKE-19-foundry-local-azure-local-deployment.md`, `docs/adr/ADR-0013-foundry-local-windows-server-install.md`, `docs/adr/ADR-0014-foundry-local-azure-local-deployment-layers.md`. All six were read first. This spike verifies and corrects against Microsoft Learn; it does not restate them.

**Headline, three parts.** First, **Microsoft publishes no CPU, RAM, or disk minimum for Foundry Local on Windows at all.** The Windows prerequisites name an OS build, a .NET SDK, and a GPU, and nothing else. Every track 2 number in this spike is therefore transferred from an adjacent first-party source and labelled as such, or marked UNKNOWN. Second, **SPIKE-18's claim that core count rather than RAM is the binding CPU constraint is not supported by any first-party statement, and Microsoft's own troubleshooting guidance points the other way.** It happens to be true of the specific 64 GB host SPIKE-18 measured; it is wrong as a general rule. Third, **SPIKE-19 UNKNOWN #4 closes at the documentation level**: GPU support on Azure Local is gated by Azure Local release number, and the release that added each NVIDIA model is now published in a single table. What remains open is an environment question (which release the operator runs), not a research one.

A fourth finding is worth flagging early because it contradicts nothing but surprises everyone: **Microsoft now answers "Can Foundry Local run on a server?" directly**, and the answer is a qualified yes with a clear steer away. SPIKE-08 and SPIKE-18 both recorded this as unstated. It is now stated. See Q1.

---

## Question

Eight questions. Questions 1 to 4 size track 2, questions 5 to 7 size track 3, question 8 spans both.

1. What are the documented minimum and recommended hardware requirements for Foundry Local on Windows: CPU cores, RAM, disk, and OS build? Separate what Microsoft states as a requirement from what it merely mentions in a quickstart.
2. How does the RAM requirement scale with model size and quantization, across the 4B-class to 20B-class range? Test SPIKE-18's claim that core count rather than RAM is the binding CPU constraint.
3. How much disk does the model cache need per model, where does it live by default, and can that location be relocated?
4. What is the GPU and accelerator support matrix for Foundry Local: which NVIDIA generations, which AMD parts, which NPUs, and what minimum VRAM per model class?
5. For track 3: what are the documented AKS Arc worker node sizes, what is the floor, and what is recommended? Confirm SPIKE-19's `Standard_A4_v2` and `Standard_D8s_v3` findings and enumerate the full documented list.
6. For track 3 GPU: which GPU SKUs are available on Azure Local, what is the release gating (SPIKE-19 UNKNOWN #4), and what are the DDA versus GPU-P constraints? Confirm AMD is unsupported and NVIDIA-only via DDA.
7. What CPU and memory `resources` should a `ModelDeployment` set for a 4.8 GB model, given that ADR-0014 decision 6 forbids the CRD defaults but names no replacement?
8. Is there **any** first-party throughput or latency figure for CPU inference on either target?

---

## Findings

### Q1. Microsoft states an OS build, a .NET version, and a GPU. It states no CPU, RAM, or disk minimum for Foundry Local on Windows

This is the whole of the documented prerequisite set, and the distinction the tasking asks for matters, because the two first-party pages disagree in scope.

**The Windows AI quickstart's prerequisites**, which are the strictest published set:

> - Windows 11, version 24H2 (build 26100) or later
> - .NET 9.0 SDK or later
> - A DirectX 12-capable GPU (integrated or discrete). The `WinML` package uses hardware acceleration and requires real GPU hardware, virtual machines without GPU passthrough are not supported.

Source: [Get started with Foundry Local (Windows AI)](https://learn.microsoft.com/windows/ai/foundry-local/get-started). Note carefully what these are prerequisites **for**: that page is titled around building a C# app with the `Microsoft.AI.Foundry.Local.WinML` NuGet package. The GPU line attaches to that package. The same page states that the cross-platform `Microsoft.AI.Foundry.Local` package "omits the Windows-specific hardware acceleration," and its own troubleshooting section confirms the failure mode is specific: "The WinML backend requires a DirectX 12-capable GPU. Virtual machines without GPU passthrough return a successful response with empty content." That is a materially more useful statement than SPIKE-08 had. A GPU-less VM running the WinML package does not error, it returns **empty content**, which is a silent failure an automated validation step would miss unless it asserts on response body length.

**The CLI reference's prerequisites**, which are the loosest published set and the ones that govern track 2's actual install:

> - Install Foundry Local.
> - A local terminal where the `foundry` CLI is available.
> - Ensure you have internet access for first-time downloads (execution providers and models).
> - Azure RBAC: Not applicable (runs locally).
> - If you have an Intel NPU on Windows, install the Intel NPU driver for optimal NPU acceleration.

Source: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). No GPU. No core count. No RAM. No disk. No Windows edition. Plus "Make sure you have admin rights to install software."

**So the honest answer to Q1 is: the only hard, stated requirements are OS build 26100 or later, .NET 9.0 SDK or later for the SDK path, and a DirectX 12 GPU for the WinML package specifically. CPU cores, RAM, and disk are UNKNOWN as documented minimums.** They are not "small," they are unstated. Any number this spike gives for track 2 is transferred from elsewhere and labelled.

**New since SPIKE-18: Microsoft now answers the server question.** The FAQ carries an entry titled "Can Foundry Local run on a server?":

> Foundry Local is optimized for hardware-constrained devices where a single user accesses the model at a time. While you can technically install and run it on server hardware, it isn't designed as a server inference stack.
>
> Server-oriented runtimes like vLLM or Triton Inference Server are built for multi-user scenarios, they handle concurrent request queuing, continuous batching, and efficient GPU sharing across many simultaneous clients. Foundry Local doesn't provide these capabilities.

Source: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions). The best-practices page says the same thing more bluntly: "Foundry Local is for on-device inference, not distributed, containerized, or multi-machine production deployments." Source: [Best practices and troubleshooting guide for Foundry Local](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice).

This does not close SPIKE-18 UNKNOWN #1, which asked whether Foundry Local is **supported** on Windows Server 2025. "You can technically install and run it on server hardware" is a statement about capability, not about a support boundary, and it still names no Windows edition. But it does two useful things: it removes the reading that running on a server is anomalous or undocumented, and it sizes the workload honestly. **Track 2 is a single-user, one-request-at-a-time capability by Microsoft's own description.** Every sizing number below is therefore for concurrency of one. Sizing track 2 for concurrent requests is sizing for something the product says it does not do.

### Q2. RAM scaling, and SPIKE-18's binding-constraint claim is wrong as a general rule

**There is no first-party rule of thumb.** Microsoft publishes no "N GB of RAM per billion parameters" statement anywhere in the Foundry Local documentation set. What it publishes is a set of concrete anchor points, and the anchors are good enough to bracket the 4B-to-20B range without inventing a coefficient.

**Anchor 1: on-disk model sizes for the same model at different quantizations.** The catalog carries `Phi-4-mini-instruct` as three separate entries, and Microsoft publishes the actual catalog JSON:

| Catalog entry | Compute | Runtime | Execution provider | Size |
|---|---|---|---|---|
| `Phi-4-mini-instruct-generic-cpu` | CPU | ONNX | `CPUExecutionProvider` | ~4.8 GB (`fileSizeBytes` 5,153,960,755) |
| `Phi-4-mini-instruct-cuda-gpu` | GPU | ONNX | `CUDAExecutionProvider` | ~3.6 GB (`fileSizeBytes` 3,865,470,566) |
| `Phi-4-mini-instruct` | GPU | vLLM | (managed by vLLM) | N/A |

Source: [Model catalog and sourcing in Foundry Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog#image-selection). The CPU variant is **larger** than the CUDA variant for the same model, which is the opposite of the intuition most people bring, and it is worth stating plainly because it inverts a common sizing assumption. Separately, the Windows quickstart puts `phi-3.5-mini` at 2.53 GB. Source: [Get started with Foundry Local (Windows AI)](https://learn.microsoft.com/windows/ai/foundry-local/get-started).

**Anchor 2: published required memory by model, from the vLLM reference.** These are GPU memory figures on an NVIDIA A10, not host RAM, and must not be read as RAM requirements. They are included because they are the only published per-model memory numbers Microsoft gives, and they establish the shape of the curve:

| Model | Parameter class | Max context length | Recommended minimum GPU generation | Required GPU memory |
|---|---|---|---|---|
| Phi-3.5-mini-instruct | 4B | 29,472 | Ampere (CC 8.0)+ | 8.428 GB |
| Phi-4-mini-instruct | 4B | 93,520 | Ampere (CC 8.0)+ | 7.806 GB |
| Phi-4-mini-reasoning | 4B | 93,520 | Ampere (CC 8.0)+ | 7.806 GB |
| Mistral-7B-Instruct-v0.2 | 7B | 29,328 | Ampere (CC 8.0)+ | 15.64 GB |
| gpt-oss-20b | 20B | 96,784 | Blackwell (CC 10.0)+ | 14.793 GB |

Sources: [Generative small language models in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-models), [vLLM Runtime Model Reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models). Note that gpt-oss-20b needs **less** memory than Mistral-7B despite being three times the parameter count, because it ships more aggressively quantized. That is the clearest available demonstration that parameter count alone does not predict memory, and it is why a naive per-billion-parameter rule would mis-size this catalog by a factor of two in either direction.

**Anchor 3: Microsoft's own `resources` values in its own examples**, which is the closest thing to a stated RAM budget:

| First-party example | Compute and runtime | `requests.cpu` | `requests.memory` | `limits.cpu` | `limits.memory` |
|---|---|---|---|---|---|
| BYO generative CPU deployment | `cpu`, `onnx-genai` | `"4"` | `"16Gi"` | `"8"` | `"32Gi"` |
| Catalog deployment (kubectl) | `gpu`, `vllm` | `"2"` | `"32Gi"` | `"4"` | `"64Gi"` |
| Catalog deployment (REST) | `gpu`, `vllm` | `"2"` | `"8Gi"` | `"4"` | `"16Gi"` |
| CRD default (do not use) | any | `100m` | `256Mi` | `1000m` | `1Gi` |

Sources: [Run inference on Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-run-inference#run-inference-with-a-bring-your-own-byo-model) (the CPU row), [Deploy a catalog model on Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-deploy-model) and [Quickstart: Deploy your first model](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-run-first-model) (the two catalog rows), [ModelDeployment and operator configuration reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator) (the defaults).

**Anchor 4: the only published host RAM figure for a 20B-class model.** For gpt-oss-20b served by Foundry Local as the language model endpoint for Agentic Retrieval:

| Resource | Minimum | Recommended (production) |
|---|---|---|
| GPU | 1 x NVIDIA GPU, >= 24 GB VRAM | 1 x NVIDIA GPU, >= 48 GB VRAM |
| CPU | 8+ vCPUs | 16+ vCPUs |
| RAM | 32 GB | 64 GB |
| Storage | >= 50 GB | >= 50 to 100 GB per replica |

Source: [Requirements for Agentic Retrieval in Foundry Local](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements#hardware-requirements-gpt-oss-20b-via-foundry-local). This is the only place Microsoft states host RAM, CPU, and storage for a Foundry Local model in one table, and it is for the 20B class.

**The rule of thumb, stated honestly.** Combining anchors 3 and 4, both first-party:

- **4B class**: Microsoft's own CPU example provisions **16 GiB memory request, 32 GiB limit, 4 CPU request, 8 CPU limit**.
- **20B class**: Microsoft states **32 GB RAM minimum, 64 GB recommended, 8+ vCPU minimum, 16+ vCPU recommended**.
- **7B class**: not separately stated. Bracketed by the two above.

Expressed as a ratio against the on-disk size, **derived arithmetic on the numbers above, not a Microsoft statement**: Microsoft's CPU example provisions roughly 3.3x the 4.8 GB model size as the memory request and roughly 6.7x as the limit. That multiple is large because it has to absorb the KV cache for a 93,520-token context window, not just the weights. **Use it as a sanity check on a generated manifest, never as the primary source.** The primary source is the table above.

**Now the SPIKE-18 claim.** SPIKE-18 recorded, in its measured-host table and again in Q3, that on an 8-core, 64 GB, GPU-less host "RAM is not the binding constraint here; core count is." Tested against the sources:

- **No first-party statement supports it.** Microsoft's diagnosis for slow inference is: issue "Slow inference," cause "CPU-only model with a large parameter count," solution "Use GPU-optimized model variants when available." Source: [Best practices and troubleshooting](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice#troubleshooting). The cause named is the combination of CPU execution and parameter count. Cores are not mentioned. Neither is RAM.
- **Microsoft's own first diagnostic step is memory, not cores.** Its performance best practices list is: stop any competing Foundry Toolkit inference session, use GPU acceleration when available, "identify bottlenecks by monitoring memory usage during inference," try more quantized variants (INT8 instead of FP16), and adjust batch sizes for non-interactive workloads. Source: same page. Three of those five levers are memory levers.
- **Microsoft's own resource examples provision both generously.** The CPU example is 4 to 8 CPU **and** 16 to 32 GiB. It does not treat one as the constraint and the other as free.

**Verdict on the claim: refuted as a general rule, accepted as a host-specific observation.** The correct formulation, and the one this spike recommends carrying into the ADRs, is a two-stage one: **RAM determines whether a model runs at all, and cores determine how fast it runs once it fits.** On a 64 GB host running a 4.8 GB model, RAM is nowhere near binding, so SPIKE-18's observation is locally true and its host-specific conclusion (a 4B-class model is the realistic ceiling for interactive use) stands. But the sentence as written generalizes to hosts where it is false: a 16 GB workstation running a 20B-class model is RAM-bound long before it is core-bound, and Microsoft's own 32 GB minimum for that class is the evidence. ADR-0013 does not repeat the claim, so no ADR text is wrong today; the correction belongs in the sizing table so nobody re-derives the general rule from the specific measurement.

### Q3. Model cache: sizes are documented, the default location is not, and it is relocatable

**Per-model disk, track 2.** The unit of disk is the model file, and the catalog publishes exact byte counts (Q2, anchor 1): ~4.8 GB for the 4B CPU variant, ~3.6 GB for the 4B CUDA variant, 2.53 GB for `phi-3.5-mini`. For the 20B class, Microsoft's only storage statement is ">= 50 GB" minimum and "50 to 100 GB per replica" recommended. Source: [Agentic Retrieval requirements](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements#hardware-requirements-gpt-oss-20b-via-foundry-local).

**Model files are not the only download.** Execution providers are downloaded separately and on first use: "When you run `foundry model list` for the first time after installation, Foundry Local automatically downloads the relevant execution providers (EPs) for your machine's hardware configuration." Source: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). Microsoft's own sample code comments that "EP packages include dependencies and may be large." Source: [Get started with Foundry Local](https://learn.microsoft.com/azure/foundry-local/get-started). **No size is published for the EP packages.** That is an UNKNOWN, and it is the reason a disk budget of exactly the model size is wrong.

**Where the cache lives by default is not documented on Microsoft Learn.** No first-party page in this review states the default cache path on Windows. Third-party sources give a path; this spike does not repeat it, because a cache path is exactly the kind of value that a product changes between preview releases and a wrong path in an automation script is a silent failure. Marked UNKNOWN, and it is trivially resolvable at run time rather than at design time.

**It is discoverable and relocatable, first-party.** The CLI exposes cache management directly:

| Command | Documented behaviour |
|---|---|
| `foundry cache location` | "Shows the current cache directory." |
| `foundry cache list` | "Lists all models stored in the local cache." |
| `foundry cache cd <path>` | "Changes the cache directory to the specified path." |
| `foundry cache remove <model>` | "Removes a model from the local cache." |

Source: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). **So the answer to "can it be relocated" is yes, via `foundry cache cd`, and the answer to "where is it by default" is "run `foundry cache location` and read it."** That is the correct shape for track 2's automation anyway: ADR-0013 decision 6 stage 2 already makes the on-disk cache the unit of state and queries it with `foundry cache list` rather than trusting a flag file. Add `foundry cache location` to the same stage and the script never needs a hardcoded path.

One security note that bears on where the cache is put: "Encrypt disks on devices that cache models containing sensitive fine-tuning data." Source: [Best practices and troubleshooting](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice). Relocating the cache to a non-encrypted volume to save space would trade against that.

**Per-model disk, track 3.** Different mechanism, different numbers, and there is a documented inconsistency worth naming:

- The cluster storage planning guidance says: "The model cache persistent volume claim (PVC) defaults to 100 GiB, which is enough for most models. To deploy large models such as `magistral`, allocate more storage by setting `spec.vllm.modelCacheStorageGi` on the deployment." Source: [Requirements for Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#on-premises-resources).
- The CRD reference gives the same default (`vllm.modelCacheStorageGi`, integer, default 100, minimum 1) but adds a scope restriction the requirements page omits: "This field applies only to deployments that use `runtime: vllm`." Source: [ModelDeployment reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator#configure-model-cache-storage).

**These two statements do not compose.** If the field only exists for vLLM, then a CPU `onnx-genai` deployment (which is exactly ADR-0014's committed first increment) has no documented way to size its model cache, and it is not clear whether the 100 GiB PVC default even applies to it. Carried as UNKNOWN #4 below. It does not block the first increment, because one 4.8 GB model is far inside 100 GiB either way, but a registry-driven generator that emits `modelCacheStorageGi` on a CPU deployment would be emitting a field the CRD reference says is ignored there.

**Node disk, track 3.** "Starting with the Azure Local 2509 release, the default OS disk size for VMs used as AKS Arc nodes is set to 200 GB. These are dynamically expanding virtual hard disks and you should ensure sufficient physical disk space is available for the node pools that you create on AKS Arc." Source: [Scale requirements for AKS on Azure Local](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements). Dynamically expanding is the operationally important word: the 200 GB is a ceiling that grows into physical capacity, so the physical S2D volume must be sized for the sum of the node disks plus the model cache PVCs, not for the initial allocation.

### Q4. The accelerator matrix for track 2, and the VRAM answer is UNKNOWN

Foundry Local's own hardware abstraction table, the device-side product:

| Execution provider | Device type | Platform |
|---|---|---|
| NVIDIA CUDA | GPU | Windows, Linux |
| WebGPU (via Dawn) | GPU | Windows, Linux, macOS |
| AMD Vitis | NPU | Windows |
| Qualcomm | NPU | Windows |
| Intel OpenVINO | GPU | Windows |
| CPU | CPU | Windows, Linux, macOS |

Source: [Foundry Local architecture overview](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture#hardware-abstraction). "The CPU execution provider is always available as a fallback. If no GPU or NPU is detected, Foundry Local runs inference on the CPU automatically."

The CLI reference is more specific and gives the actual hardware and driver floors, which the architecture table does not. This is the load-bearing table for Q4:

| Execution provider (vendor) | Documented hardware and driver requirement |
|---|---|
| CPU (built in) | "Uses Microsoft Linear Algebra Subroutines (MLAS) to run on any CPU and is the CPU fallback for Foundry Local." No stated minimum. |
| WebGPU (built in, via Dawn) | "For acceleration on any GPU, and is the GPU fallback for Foundry Local." No stated minimum. |
| CUDA (built in) | "Requires an NVIDIA GeForce RTX 30 series and later with a minimum recommended driver version 32.0.15.5585 and CUDA version 12.5." |
| `NvTensorRTRTXExecutionProvider` (NVIDIA, plugin) | "NVIDIA GeForce RTX 30XX and later versions with minimum recommended driver version 32.0.15.5585 and CUDA version 12.5" |
| `OpenVINOExecutionProvider` (Intel, plugin) | CPU: Intel TigerLake (11th Gen) and later, min recommended driver 32.0.100.9565. GPU: Intel AlderLake (12th Gen) and later, min driver 32.0.101.1029. NPU: Intel ArrowLake (15th Gen) and later, min driver 32.0.100.4239 |
| `QNNExecutionProvider` (Qualcomm, plugin) | Snapdragon X Elite (X1Exxxxx) and Snapdragon X Plus (X1Pxxxxx), Qualcomm Hexagon NPU, minimum driver version 30.0.140.0 and later |
| `VitisAIExecutionProvider` (AMD, plugin) | Min: Adrenalin Edition 25.6.3 with NPU driver 32.00.0203.280. Max: Adrenalin Edition 25.9.1 with NPU driver 32.00.0203.297 |

Source: [Foundry Local CLI reference, Execution providers](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli#execution-providers).

Five things worth pulling out, because they are not obvious from the matrix:

1. **NVIDIA's floor is RTX 30 series (Ampere), not "any CUDA GPU."** Pre-Ampere consumer cards fall back to WebGPU or CPU. This is a stricter floor than SPIKE-08 recorded and it disqualifies a lot of older hardware someone might expect to work.
2. **AMD is NPU-only among the vendor providers.** There is no AMD GPU execution provider. An AMD discrete or integrated **GPU** is reachable only through the generic WebGPU provider; the Vitis AI provider targets the **NPU** in recent Ryzen AI parts and is version-**bounded on both ends** (min Adrenalin 25.6.3, max 25.9.1), which is unusual and means a too-new driver is as much a problem as a too-old one. Anyone sizing an AMD host should plan for WebGPU, not for a CUDA-equivalent path.
3. **The AMD Vitis and Qualcomm QNN entries are NPUs, and NPUs are a different sizing question entirely.** They have their own memory pools and no published per-model requirement.
4. **Plugin providers self-update.** "Foundry Local automatically downloads these execution providers on first run. The plugin execution providers automatically update when new versions are available." Source: same page. On a governed server that is an unmanaged automatic-update path, which is an operational consideration ADR-0013 has not recorded.
5. **Each plugin provider carries its own license terms**, listed per row on the same page (NVIDIA CUDA EULA, an Intel distribution license, the QNN license bundled inside the Qualcomm SDK zip). Track 2's license question is therefore two questions, not one: per-model licenses (`foundry model info <model> --license`, already carried as SPIKE-18 UNKNOWN #6) **and** per-execution-provider licenses.

**Minimum VRAM per model class for the device SDK: UNKNOWN.** No VRAM table is published for Foundry Local on Windows. The only per-model memory figures Microsoft publishes are the vLLM-on-A10 GPU memory numbers in Q2 anchor 2, which belong to the Azure Local product and a different runtime. SPIKE-08 already warned against reading those as device-SDK requirements and that warning stands. They are a **lower bound at best**: a model needing 7.806 GB under vLLM's PagedAttention memory management will not need less under ONNX Runtime, which the comparison table describes as "Standard ONNX Runtime" memory optimization against vLLM's "PagedAttention, FP8, KV cache, chunked prefill." Source: [Inference runtimes in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes#comparison).

**Track 2's practical answer stands unchanged from ADR-0013 decision 9:** the target host has no GPU passthrough, so the WinML accelerated path is out by its own documented requirement, CPU is the execution provider, and the accelerator matrix is planning material for a future host rather than a constraint on the committed increment.

### Q5. Track 3 node sizes: SPIKE-19 confirmed, and the full documented list

**SPIKE-19's two findings are confirmed verbatim.** The Foundry Local requirements page states:

| Requirement | Minimum | Recommended |
|---|---|---|
| Worker node VM size | `Standard_D4s_v3` (4 vCPU / 16 GiB) | `Standard_D8s_v3` (8 vCPU / 32 GiB) |
| Allocatable memory per node | >= 14 GiB | >= 28 GiB |
| Worker node count | 1 | 2+ (high availability or GPU pool separation) |

And the warning: "Don't use the `az aksarc create` default worker size `Standard_A4_v2` (8 GiB). Use at least `Standard_D4s_v3`." Source: [Requirements for Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#worker-node-capacity).

**The full documented AKS Arc list**, which neither SPIKE-19 nor ADR-0014 enumerates:

Worker node sizes (non-GPU):

| VM size | vCPU | Memory (GB) | Verdict against the Foundry Local floor |
|---|---|---|---|
| `Standard_A2_v2` | 2 | 4 | Below floor |
| `Standard_K8S3_v1` | 4 | 6 | Below floor |
| `Standard_A4_v2` | 4 | 8 | Below floor, and it is the `az aksarc create` default |
| `Standard_D4s_v3` | 4 | 16 | Minimum |
| `Standard_D8s_v3` | 8 | 32 | Recommended |
| `Standard_D16s_v3` | 16 | 64 | Above recommended |
| `Standard_D32s_v3` | 32 | 128 | Above recommended |

Control plane node sizes (a separate, shorter list): `Standard_K8S3_v1` (4 / 6), `Standard_A4_v2` (4 / 8), `Standard_D4s_v3` (4 / 16), `Standard_D8s_v3` (8 / 32).

Default sizes if nothing is specified: AKS Arc control plane `Standard_A4_v2`, AKS Arc Linux worker `Standard_A4_v2`, AKS Arc Windows worker `Standard_K8S3_v1`.

Source for all four: [Scale requirements for AKS on Azure Local](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements). `Standard_D16s_v3` and `Standard_D32s_v3` were added in Azure Local release 2503. Source: [What's new in AKS enabled by Azure Arc on Azure Local](https://learn.microsoft.com/azure/aks/aksarc/aks-whats-new-local).

**Three sizing traps this list exposes, which ADR-0014 does not currently record.**

**Trap 1: three of the seven documented worker sizes are below the Foundry Local floor, and the default is one of them.** SPIKE-19 caught `Standard_A4_v2`. The list shows `Standard_A2_v2` and `Standard_K8S3_v1` are also below it. An implementer picking "the smallest thing that appears in the docs" has a two-in-three chance of picking something that cannot run the product.

**Trap 2, and this is the substantive new finding: Microsoft's own recommended node cannot satisfy Microsoft's own recommended memory limit.** The CPU `ModelDeployment` example sets `limits.memory: "32Gi"`. The recommended worker node is `Standard_D8s_v3` with 32 GiB total and ">= 28 GiB" allocatable. **A 32Gi limit cannot be scheduled on a node with 28 GiB allocatable.** The pod would be unschedulable, and this is not an edge case, it is the documented example on the documented recommended node. SPIKE-19 spotted the same shape in the `storeModel.cacheJob` defaults ("16Gi for requests and 32Gi for limits" against a 32 GiB recommended node) and called it "a tension." It is the same defect twice, and it is worth stating as a rule rather than as two separate observations:

> **Any `memory` limit at or near 32Gi requires a `Standard_D16s_v3` (16 vCPU / 64 GiB) node or larger. On a `Standard_D8s_v3` it does not fit.**

Derived by comparing the two first-party figures; Microsoft does not state it. It is arithmetic, not inference: 32 > 28.

**Trap 3: the CPU request in the example is half the node.** `requests.cpu: "4"` on an 8 vCPU node reserves half the schedulable CPU for one pod, before the operator, cert-manager, istiod, and the cluster's own system pods. One model per node is the realistic density on `Standard_D8s_v3`, and ADR-0014's "worker node count 2+" recommendation should be read as the practical minimum rather than an HA nicety.

**Two capacity items carried forward from SPIKE-19, both confirmed.** The `storeModel.cacheJob` memory defaults of 16Gi request and 32Gi limit, tunable at install with `storeModel.cacheJob.resources.requests.memory` and `.limits.memory`, with the explicit caution "Ensure that the requests value doesn't exceed the limits value." Source: [Deploy Foundry Local as an Azure Arc extension](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension). And: "If you run multireplica `vLLM` deployments, reserve extra capacity for one Endpoint Picker (EPP) pod per ModelDeployment (about 512 MiB request and 2 GiB limit)." The operator configuration confirms the exact figures as `requests: { cpu: 250m, memory: 512Mi }`, `limits: { cpu: "2", memory: 2Gi }`, one replica per opted-in deployment. Sources: [Requirements](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#worker-node-capacity), [ModelDeployment reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator).

New, and not in SPIKE-19: **EPP turns itself on when you scale.** `spec.vllm.epp.enabled` defaults to `true` when `replicas > 1` and `false` when `replicas == 1`, and "the default re-evaluates on scaling: a deployment created at one replica with the field unset brings up the EPP stack the moment it is scaled to two or more." Source: [ModelDeployment reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator). So a scale-up from 1 to 2 replicas silently adds a pod with a 2 GiB limit that was not in the capacity plan. Worth a line in the track 3 sizing table.

### Q6. Track 3 GPU: SPIKE-19 UNKNOWN #4 closes, AMD confirmed unsupported, DDA confirmed

**Release gating, which is what SPIKE-19 UNKNOWN #4 asked for.** It is published, in one table, keyed by Azure Local release:

| Manufacturer | GPU model | Supported from Azure Local version |
|---|---|---|
| NVIDIA | A2 | 2311.2 |
| NVIDIA | A16 | 2402.0 |
| NVIDIA | T4 | 2408.0 |
| NVIDIA | L4 | 2512.0 |
| NVIDIA | L40 | 2512.0 |
| NVIDIA | L40S | 2512.0 |
| NVIDIA | RTX Pro 6000 | 2603.0 |

"GPUs are only supported on Linux OS node pools. GPUs aren't supported on Windows OS node pools." Sources: [Use GPUs for compute-intensive workloads in AKS on Azure Local](https://learn.microsoft.com/azure/aks/aksarc/deploy-gpu-node-pool#supported-gpu-models), duplicated in [Scale requirements](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements).

**Additionally, four of the seven GPU SKU families are still marked Preview in the SKU tables**: L4, L40, L40S, and RTX Pro 6000 are each headed "(Preview)". A2, A16, and T4 are not. Source: same pages. So the gating is two-dimensional: a release floor **and** a preview status, and the newer and larger the card, the more likely both apply.

**The full GPU VM SKU list**, which no prior spike enumerated completely:

| GPU model | VM size | GPUs | GPU memory (GiB) | vCPU | Memory (GiB) |
|---|---|---|---|---|---|
| T4 | `Standard_NK6` | 1 | 8 | 6 | 12 |
| T4 | `Standard_NK12` | 2 | 16 | 12 | 24 |
| A2 | `Standard_NC4_A2` | 1 | 16 | 4 | 8 |
| A2 | `Standard_NC8_A2` | 1 | 16 | 8 | 16 |
| A2 | `Standard_NC16_A2` | 2 | 32 | 16 | 64 |
| A2 | `Standard_NC32_A2` | 2 | 32 | 32 | 128 |
| A16 | `Standard_NC4_A16` | 1 | 16 | 4 | 8 |
| A16 | `Standard_NC8_A16` | 1 | 16 | 8 | 16 |
| A16 | `Standard_NC16_A16` | 2 | 32 | 16 | 64 |
| A16 | `Standard_NC32_A16` | 2 | 32 | 32 | 128 |
| L4 (Preview) | `Standard_NC16_L4_1` / `_2` | 1 / 2 | 24 / 48 | 16 | 64 |
| L4 (Preview) | `Standard_NC32_L4_1` / `_2` | 1 / 2 | 24 / 48 | 32 | 128 |
| L40 (Preview) | `Standard_NC16_L40_1` / `_2` | 1 / 2 | 48 / 96 | 16 | 64 |
| L40 (Preview) | `Standard_NC32_L40_1` / `_2` | 1 / 2 | 48 / 96 | 32 | 128 |
| L40S (Preview) | `Standard_NC16_L40S_1` / `_2` | 1 / 2 | 48 / 96 | 16 | 64 |
| L40S (Preview) | `Standard_NC32_L40S_1` / `_2` | 1 / 2 | 48 / 96 | 32 | 128 |
| RTX Pro 6000 (Preview) | `Standard_NC16_RTX6000Pro_1` / `_2` | 1 / 2 | 48 / 96 | 16 | 64 |
| RTX Pro 6000 (Preview) | `Standard_NC32_RTX6000Pro_1` / `_2` | 1 / 2 | 48 / 96 | 32 | 128 |

Source: [Scale requirements for AKS on Azure Local](https://learn.microsoft.com/azure/aks/aksarc/scale-requirements#supported-gpu-vm-sizes).

Two GPU SKUs are below the Foundry Local **memory** floor despite carrying a GPU: `Standard_NC4_A2` and `Standard_NC4_A16` have 8 GiB of host RAM, the same as the forbidden `Standard_A4_v2`. `Standard_NK6` has 12 GiB, also below the 14 GiB allocatable minimum. **Having a GPU does not exempt a node from the host memory floor**, and three of the documented GPU SKUs fail it.

**AMD: confirmed unsupported, and the sentence is unambiguous.** "Supported NVIDIA DDA-passthrough SKUs include `Standard_NC*_A2`, `Standard_NC*_L4_*`, `Standard_NC*_L40_*`, `Standard_NC*_L40S_*`, `Standard_NC*_RTX6000Pro_*`, and Tesla T4 `Standard_NK*`. AMD GPUs aren't supported." Source: [Requirements for Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements#gpu-requirements). SPIKE-19's finding confirmed verbatim.

**DDA versus GPU-P: confirmed, with the full matrix.** Azure Local offers both attach models:

- **DDA** dedicates "a physical GPU to your workload," workloads "run on the native driver and typically have full access to the GPU's functionality," VM density "Low (one GPU to one VM)," VRAM "Up to VRAM supported by the GPU."
- **GPU-P** shares "a GPU with multiple workloads by splitting the GPU into dedicated fractional partitions," VM density "High (one GPU to many VMs)," VRAM "Up to VRAM supported by the GPU per partition."

And the decisive footnote: **"AKS Arc doesn't currently support GPU partitions."** The support matrix by assignment type confirms it column by column: every NVIDIA model that is supported for AKS is supported under the DDA columns only, and the GPU-P column is labelled "VMs only". T4 is additionally a No under GPU-P entirely. A10 and A40 are supported for unmanaged VMs and GPU-P but are **not** supported for AKS at all. Source: [Prepare GPUs for Azure Local](https://learn.microsoft.com/azure/azure-local/manage/gpu-preparation). SPIKE-09's and SPIKE-19's DDA-not-partitioning finding is confirmed, and the consequence is unchanged: one GPU per AKS Arc worker node, no fractional sharing, and the loss of GPU live migration.

**Two capacity constraints that follow from DDA and belong in a sizing plan.**

1. **Homogeneous GPUs across the whole instance.** "You must create a homogeneous configuration for GPUs across all the machines in your system. A homogeneous configuration consists of installing the same make and model of GPU." Source: [Prepare GPUs for Azure Local](https://learn.microsoft.com/azure/azure-local/manage/gpu-preparation#host-requirements). You cannot mix an L4 node and an L40S node in one Azure Local instance.
2. **Rolling upgrades need a spare physical GPU per host.** "Have one extra GPU per physical host if you're running the `Standard_NK6` or two extra GPUs if you're running `Standard_NK12`. If you're running at full capacity and don't have an extra GPU, scale down your node pool to a single node before the upgrade, then scale up after the upgrade succeeds." And the failure mode if you do not: "the upgrade process hangs until a GPU is available." Source: [Use GPUs in AKS on Azure Local, FAQ](https://learn.microsoft.com/azure/aks/aksarc/deploy-gpu-node-pool#faq). **This is a capacity-planning tax nobody has recorded: a GPU-backed track 3 needs N+1 physical GPUs per host to be upgradeable without downtime.**

**Net on SPIKE-19 UNKNOWN #4: closed at the documentation level, reduced to an environment check.** The gating mechanism and the full mapping are published. What is not knowable from documentation is which Azure Local release a given instance runs and which physical cards are installed. Those are the two environment questions SPIKE-19 already carried as UNKNOWN 6a and 6b, and they remain the right place for them. The research question is answered.

### Q7. What a `ModelDeployment` for a 4.8 GB model should actually set

ADR-0014 decision 6 forbids the CRD defaults and names no replacement. Here is the sourced replacement.

**Microsoft's stated guidance, verbatim:** "Adjust CPU, memory, and GPU resource values based on your model size, quantization level, and expected concurrency. For CPU-only deployments, set `compute` to `cpu`, `runtime` to `onnx-genai`, and remove the `gpu` limit." Source: [Deploy a catalog model on Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-deploy-model#deploy-a-model). That names the three inputs (size, quantization, concurrency) and gives no formula.

**Microsoft's only worked CPU generative example**, from the BYO inference walkthrough, with `workloadType: generative`, `compute: cpu`, `replicas: 1`:

```yaml
  resources:
    requests:
      cpu: "4"
      memory: "16Gi"
    limits:
      cpu: "8"
      memory: "32Gi"
```

Source: [Run inference on Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-run-inference#run-inference-with-a-bring-your-own-byo-model).

**Recommendation for a 4.8 GB CPU catalog model, and the reasoning for each number:**

| Field | Value | Basis |
|---|---|---|
| `resources.requests.cpu` | `"4"` | Microsoft's CPU example. Half a `Standard_D8s_v3`. |
| `resources.requests.memory` | `"16Gi"` | Microsoft's CPU example. Roughly 3.3x the 4.8 GB model (derived), which covers weights plus a working KV cache. |
| `resources.limits.cpu` | `"8"` | Microsoft's CPU example. Equals the whole `Standard_D8s_v3`, so it is a burst ceiling, not a reservation. |
| `resources.limits.memory` | `"24Gi"` **on a `Standard_D8s_v3`**, `"32Gi"` on a `Standard_D16s_v3` or larger | **Deviation from Microsoft's example, and deliberate.** 32Gi exceeds the >= 28 GiB allocatable on the recommended node (Q5 trap 2) and the pod will not schedule. 24Gi fits inside 28 GiB with room for system pods. Choosing 32Gi means choosing a bigger node. |
| `resources.limits.gpu` | omitted entirely | "For CPU-only deployments ... remove the `gpu` limit." |
| `compute` | `cpu` | Required field. |
| `runtime` | not set | "You don't need to set the runtime manually for catalog models." The operator reads the framework from the catalog. Set it only for BYO. |
| `replicas` | `1` | Default. Keeps EPP off (it auto-enables above 1). |
| `workloadType` | `generative` | Required field. |

Sources for the non-`resources` rows: [ModelDeployment reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator), [Inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes#how-the-runtime-is-selected).

**The `limits.memory` deviation is the one judgement call in this spike and it is flagged as such.** Microsoft's example says 32Gi; Microsoft's node recommendation says 28 GiB allocatable; both cannot be honoured on one `Standard_D8s_v3`. This spike resolves it downward (fit the node) rather than upward (buy a bigger node) for the first increment, because ADR-0014's first increment is one small model and a `Standard_D16s_v3` is double the cost for headroom nothing is using. **A deployer whose model or context is larger should resolve it the other way.** Either resolution is defensible; silently emitting 32Gi onto a 32 GiB node is not.

For completeness, the GPU catalog example Microsoft publishes is `requests` 2 CPU / 32Gi and `limits` 4 CPU / 64Gi with `gpu: 1`, which fits a `Standard_NC16_L4_1` (16 vCPU / 64 GiB) only in the sense that the limit equals the whole node. The same trap applies one size up.

### Q8. There is no first-party CPU throughput or latency figure. There is a rich GPU one

**Refuting the premise partially, and confirming it where it counts.**

**Microsoft does publish first-party performance numbers**, which neither SPIKE-18 nor SPIKE-19 found. The vLLM model reference gives measured time-to-first-token and output throughput per model at four concurrency levels, all on an NVIDIA A10 (Ampere, SM 8.0):

| Model | Concurrency | Mean TTFT (ms) | P99 TTFT (ms) | Output throughput (tokens/s) |
|---|---|---|---|---|
| Phi-4-mini-instruct | 1 request | 40.32 | 62.34 | 49.96 |
| Phi-4-mini-instruct | 8 requests | 71.30 | 107.32 | 196.12 |
| Phi-4-mini-reasoning | 1 request | 41.53 | 62.45 | 49.92 |
| Mistral-7B-Instruct-v0.2 | 1 request | 75.97 | 146.06 | 30.34 |
| gpt-oss-20b | 1 request | 52.68 | 232.26 | 97.54 |
| gpt-oss-20b | 8 requests | 87.54 | 169.05 | 354.41 |

Source: [vLLM Runtime Model Reference for Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models). A second set of measured figures exists for Endpoint Picker routing on a 3-replica vLLM deployment (14% lower mean TTFT at 20 concurrent users, 16% higher per-user throughput on multi-turn chat at one concurrent user). Source: [Inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes#performance-benefits).

**Every one of those figures is vLLM on a GPU. vLLM cannot run on CPU** ("Requires GPU (CUDA). CPU isn't supported"). Source: same page. So none of them transfers to either track's committed CPU increment.

**For CPU inference, on either target, there is no first-party throughput or latency figure. Stated plainly, as the tasking asks: none exists.** No ONNX Runtime CPU benchmark, no tokens-per-second table, no latency figure, no worked example with a wall-clock number, on the device product or the Azure Local product. The nearest thing to guidance is qualitative and unquantified: ONNX Runtime is "well-suited for compact models such as Phi-4 and Qwen 2.5 that fit in CPU memory or a single GPU" with "lower resource overhead than vLLM," and vLLM's continuous batching "deliver[s] higher tokens-per-second than ONNX Runtime under concurrent load." Source: [Inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes). Direction, no magnitude.

**This spike substitutes no third-party benchmark for the missing number, and recommends that no ADR does either.** SPIKE-18 UNKNOWN #2 and SPIKE-19 UNKNOWN #7 both stand, unchanged and unresolvable from documentation. They resolve by measurement, and the two measurements are worth taking with the same prompt and the same model so the results compare.

One useful consequence of the GPU numbers existing: they set a **ceiling** for the CPU case. A Phi-4-mini-class model produces about 50 tokens per second single-request on an A10 under the throughput-optimized runtime. CPU under a non-batching runtime will not beat that. Anyone budgeting a synchronous publish-time review step should plan against a number well below 50 tokens per second and confirm by measurement. That is a bound, not a prediction, and it is labelled as such.

---

## The sizing tables

These are the deliverable. Every cell carries a basis. Cells with no first-party basis say UNKNOWN rather than guessing.

### Track 2: Foundry Local on Windows Server (single host, single user, concurrency of one)

Microsoft publishes no CPU, RAM, or disk minimum for this product (Q1). Rows 1 to 3 are therefore **transferred** from the first-party `ModelDeployment` resource examples for the same models on the sibling product, on the basis that the same ONNX model in the same runtime has the same working-set requirement whether the process runs in a container or on bare Windows. Row 4 is stated first-party. **Treat rows 1 to 3 as planning figures pending the ADR-0013 install test, not as documented requirements.**

| Workload class | Model class (example) | Min cores | Min RAM | Disk | GPU needed | Node SKU |
|---|---|---|---|---|---|---|
| **Smoke test / functional validation** | 0.5B to 4B (`qwen2.5-0.5b`, `phi-3.5-mini` at 2.53 GB) | **UNKNOWN.** No first-party minimum. 4 cores is the smallest CPU request in any first-party Foundry example (transferred) | **UNKNOWN.** No first-party minimum. 8 GiB is the smallest memory request in any first-party Foundry example (transferred) | Model size (2.53 GB for `phi-3.5-mini`) **plus execution provider packages, size UNKNOWN**. Budget 20 GB | No. CPU EP "is always available as a fallback" | n/a, single host |
| **Interactive single user, 4B class** (the ADR-0013 committed increment) | `Phi-4-mini-instruct-generic-cpu`, 4.8 GB, `CPUExecutionProvider` | 4 cores sustained, 8 burst (transferred from the CPU example) | 16 GiB working set, 32 GiB headroom (transferred from the CPU example) | 4.8 GB model plus EP packages. Budget 30 GB | No. DirectX 12 GPU required **only** if the `WinML` package is used; a VM without passthrough returns empty content rather than erroring | n/a, single host |
| **7B class** | `Mistral-7B-Instruct-v0.2` | **UNKNOWN.** Bracketed: >= 4 (4B figure) and <= 8+ (20B figure) | **UNKNOWN.** Bracketed: >= 16 GiB and <= 32 GB. Reference point: 15.64 GB required GPU memory under vLLM | Model size not published for the CPU ONNX variant. Budget 40 GB | No, but expect it to be slow. Microsoft's named cause of slow inference is "CPU-only model with a large parameter count" | n/a, single host |
| **20B class** | `gpt-oss-20b` | **8+ vCPU minimum, 16+ recommended** (first-party) | **32 GB minimum, 64 GB recommended** (first-party) | **>= 50 GB minimum, 50 to 100 GB per replica recommended** (first-party) | **Yes.** Microsoft states this model "requires its own GPU": >= 24 GB VRAM minimum, >= 48 GB recommended. Note the device SDK's CUDA floor is RTX 30 series or later | n/a, single host |

Additional track 2 requirements, all first-party and non-negotiable: Windows build 26100 or later; .NET 9.0 SDK or later for the SDK path; admin rights to install; internet access for first-time model and execution-provider downloads.

### Track 3: Foundry Local on Azure Local (AKS Arc)

| Workload class | Model class | Node SKU | Min cores | Min RAM (allocatable) | Disk | GPU needed |
|---|---|---|---|---|---|---|
| **Absolute documented floor** | 4B CPU catalog variant | `Standard_D4s_v3` (4 vCPU / 16 GiB) | 4 | >= 14 GiB | 200 GB node OS disk (default, dynamically expanding); 100 GiB model cache PVC default | No |
| **Recommended CPU baseline** (the ADR-0014 committed increment) | `Phi-4-mini-instruct-generic-cpu`, 4.8 GB | `Standard_D8s_v3` (8 vCPU / 32 GiB) | 8 | >= 28 GiB | as above | No |
| **CPU with Microsoft's full example limits** | 4B to 7B CPU catalog | `Standard_D16s_v3` (16 vCPU / 64 GiB) | 16 | 64 GiB | as above | No. Required if `limits.memory` is 32Gi, which does not fit a `Standard_D8s_v3` |
| **GPU baseline, 4B to 7B, vLLM or `*-cuda-gpu`** | Phi-4-mini (7.806 GB VRAM), Mistral-7B (15.64 GB VRAM) | `Standard_NC16_L4_1` (1 GPU / 24 GiB VRAM / 16 vCPU / 64 GiB). `Standard_NC8_A2` (1 GPU / 16 GiB VRAM) fits the VRAM but only has 16 GiB host RAM | 16 | 64 GiB | as above | **Yes**, NVIDIA only, DDA passthrough, Linux node pool only. L4 is release 2512.0+ and marked Preview |
| **20B class / Agentic Retrieval endpoint** | `gpt-oss-20b` (14.793 GB VRAM under vLLM; Microsoft's practical figure is >= 24 GB) | `Standard_NC16_L40S_1` (1 GPU / 48 GiB VRAM / 16 vCPU / 64 GiB) or `Standard_NC16_RTX6000Pro_1` | 8+ minimum, 16+ recommended | 32 GB minimum, 64 GB recommended | >= 50 GB, 50 to 100 GB per replica | **Yes**, >= 24 GB VRAM minimum, >= 48 GB recommended. L40S is release 2512.0+, RTX Pro 6000 is 2603.0+, both marked Preview |

Cluster-wide capacity additions, all first-party:

| Item | Capacity to reserve | When |
|---|---|---|
| `storeModel` cache job | 16 GiB request, 32 GiB limit by default; tunable down at extension install | Always, during model caching. On a 32 GiB node this must be tuned down |
| Endpoint Picker (EPP) pod | 512 MiB request, 2 GiB limit, 1 replica per opted-in deployment | Automatically, per `ModelDeployment`, as soon as `replicas` goes above 1 |
| Spare physical GPU | 1 per physical host (2 for `Standard_NK12`) | For rolling node-pool upgrades. Without it the upgrade hangs |
| Worker node count | 2+ recommended | HA, or separating a GPU pool from a CPU pool |
| Kubernetes version | 1.29 or later | Always |

Forbidden or below-floor worker sizes, for a validation check: `Standard_A2_v2`, `Standard_K8S3_v1`, `Standard_A4_v2` (the `az aksarc create` default), and the GPU SKUs `Standard_NC4_A2`, `Standard_NC4_A16`, and `Standard_NK6`, all of which fall below the 14 GiB allocatable memory minimum.

---

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | **Documented CPU core, RAM, and disk minimums for Foundry Local on Windows.** | Microsoft publishes an OS build, a .NET version, and a GPU requirement for the WinML package, and nothing else. The product is positioned for consumer devices where any modern machine is assumed adequate. | Nothing in documentation will resolve this; it is an absence, not an omission. The practical resolution is the ADR-0013 install test, which should record peak working-set memory and CPU utilization alongside the tokens-per-second figure it already scopes. Two extra counters, no extra runs. |
| 2 | **CPU inference throughput and latency, either track.** Carried unchanged from SPIKE-18 UNKNOWN #2 and SPIKE-19 UNKNOWN #7. | Microsoft publishes benchmarks only for vLLM on GPU, and vLLM cannot run on CPU. | Measure. Same fixed prompt, same model class, on both targets, so the two results compare. The published A10 vLLM figure (about 50 tokens/s single-request for Phi-4-mini) is a ceiling to judge against, not a prediction. |
| 3 | **The default model cache path on Windows, and the on-disk size of the execution provider packages.** | The CLI reference documents the commands that read and change the cache location but never prints the default. EP package sizes are described only as "may be large" in sample code comments. | Both resolve in one command each at install time: `foundry cache location`, then measure the directory after the first `foundry model list`. Add both to the ADR-0013 install test's recorded output. |
| 4 | **Whether the 100 GiB model cache PVC default applies to CPU `onnx-genai` deployments, and how to size it if so.** | The requirements page presents 100 GiB as the general cluster storage default; the CRD reference says `vllm.modelCacheStorageGi` "applies only to deployments that use `runtime: vllm`." The two statements do not compose. | Read `kubectl get pvc -n foundry-local-operator` after the first CPU `ModelDeployment` reaches Running, and check the requested size. Until then, do not emit `modelCacheStorageGi` on a CPU deployment. |
| 5 | **Minimum VRAM per model class for the device SDK (track 2).** | No VRAM table is published for Foundry Local on Windows. The only per-model memory figures belong to vLLM on Azure Local. | Not resolvable from documentation. The vLLM figures are a defensible lower bound because ONNX Runtime has less memory optimization than vLLM's PagedAttention. Irrelevant to the committed CPU-only increment. |
| 6 | **Which Azure Local release the target instance runs, and which physical GPU cards are installed.** Carried from SPIKE-19 UNKNOWN 6a and 6b, narrowed. | Environment questions, not documentation questions. The **mapping** from release to supported GPU is now fully published (Q6), which is what SPIKE-19 UNKNOWN #4 asked for. | Compare the instance's release number against the Q6 table, and the physical card inventory against the supported model list. Read-only. Not needed for a CPU-only first increment. |
| 7 | **Whether the automatic execution-provider update mechanism is acceptable on a governed host.** | Microsoft states plugin EPs "automatically update when new versions are available" and documents no way to pin or disable it. | Look for a `foundry service set` option controlling EP updates once installed, or accept it as a documented preview behaviour and record it as a risk in ADR-0013. |
| 8 | **Per-execution-provider license terms.** | Listed per provider on the CLI reference (NVIDIA CUDA EULA, an Intel distribution license, a QNN license distributed inside a downloadable SDK zip), but not summarized and not machine-readable. | Read each applicable provider's license before a host uses that accelerator. Only the CPU provider applies to the committed increment, and it carries no additional license line. |

Unknowns 1, 2, 3, and 7 all resolve from the single install test ADR-0013 already gates, at the cost of recording four extra values. Unknowns 4 and 6 are read-only and need no authorization. Unknowns 5 and 8 are not blocking.

---

## Recommendation

1. **Add the two sizing tables above to ADR-0013 and ADR-0014 as a sizing decision, not as an appendix.** Both ADRs commit to a hardware shape (a GPU-less Windows host, a `Standard_D8s_v3` worker pool) without saying what that shape can and cannot run. The tables close that. Track 2's table must carry the transferred-not-documented caveat visibly, because "Microsoft publishes no minimum" is itself the finding and softening it into a confident number would be dishonest.

2. **Fix the 32Gi-on-a-32-GiB-node collision in ADR-0014, in both places it occurs.** ADR-0014 decision 4 already tunes `storeModel.cacheJob` memory down for the first increment, which is correct. Decision 6 forbids the CRD defaults but names no replacement, so a generator following it literally would reach for Microsoft's published example and emit `limits.memory: "32Gi"` onto a node with 28 GiB allocatable, producing an unschedulable pod. Add the explicit values from Q7, and add the rule as a validation check on the generator: **no `limits.memory` may exceed the target node's documented allocatable memory.** That check is cheap, it is arithmetic, and it catches the exact class of error twice.

3. **Correct SPIKE-18's binding-constraint framing wherever it is repeated.** The finding stands for the host it was measured on and fails as a general rule. Replace it with the two-stage formulation: RAM determines whether a model runs at all, cores determine how fast it runs once it fits. This matters for a methodology repo specifically, because a deployer with a 16 GB workstation reading "core count is the constraint" will size the wrong thing.

4. **Record Microsoft's new server FAQ answer in ADR-0013's context, and let it sharpen the scope rather than reopen the decision.** "You can technically install and run it on server hardware, it isn't designed as a server inference stack" does not resolve the Windows Server support question, but it does settle the workload shape: track 2 is single-user, one request at a time, by the product's own description. That justifies ADR-0013's CPU-only single-model increment more strongly than the ADR currently argues it, and it forecloses any later attempt to grow track 2 into a shared service. Microsoft's routing of multi-user inference to vLLM or Triton is the same routing ADR-0013 decision 10 already records toward track 3.

5. **Add four recorded values to the ADR-0013 install test. Do not add a run.** The test as scoped already provisions, checks service status, pulls `phi-4-mini`, times one prompt, and uninstalls. Recording `foundry cache location`, the cache directory size after the EP download, peak working-set memory during inference, and peak CPU utilization costs nothing extra and closes UNKNOWNs 1 and 3 alongside the ones the test already targets. **This does not change the authorization the test needs; it is the same single owner-gated install.**

6. **Close SPIKE-19 UNKNOWN #4 as answered, and re-file its residue as an environment check.** The release gating is published and enumerated in Q6. Keep the two genuinely environmental questions (which release, which cards) where SPIKE-19 already put them, as UNKNOWN 6a and 6b, and delete UNKNOWN #4 rather than leaving a resolved research question sitting open as if it were a blocker. It is not a blocker for a CPU-only first increment in any case.

7. **Record the GPU capacity taxes in ADR-0014 before anyone budgets a GPU purchase.** Three constraints materially change the cost of a GPU-backed track 3 and none is currently written down: GPUs must be homogeneous across every machine in the Azure Local instance; AKS Arc uses DDA only, so it is one whole GPU per worker node with no partitioning and no live migration; and a rolling node-pool upgrade needs one spare physical GPU per host or it hangs. **A two-node GPU-backed cluster is a four-GPU purchase, not a two-GPU purchase, if it is to be upgradeable.** That is the kind of number that changes a decision, and it should be in the ADR rather than discovered during the first upgrade.

8. **Do not substitute a third-party benchmark for the missing CPU throughput figure, in any document.** The temptation is real: plenty of third-party tokens-per-second numbers exist for these exact models. None of them is measured on this stack, this runtime, this quantization, or this hardware, and quoting one would give a decision a false foundation. The honest record is "Microsoft publishes none, here is the ceiling implied by the GPU figures, measure it." That is what this spike records.

## Verdict: no blocker, and the sizing floor for both tracks is hardware this project already has or can reach without a purchase

Stated plainly, because the tasking asks for an actionable floor.

**Track 2's floor is 4 cores and 16 GiB of RAM with 30 GB of free disk, for the 4B-class CPU model both SPIKE-18 and ADR-0013 committed to.** That figure is transferred from Microsoft's own resource example for the same model on the sibling product, not documented as a Windows minimum, and the tables say so. The host SPIKE-18 measured (8 cores, 63.9 GB, ~800 GB free) clears it by a wide margin, and so will any reasonable dedicated build VM. **Nothing in track 2 is blocked by hardware.** What is unmeasured is speed, and only speed.

**Track 3's floor is one `Standard_D4s_v3` worker node with >= 14 GiB allocatable, and the practical floor is one `Standard_D8s_v3`.** Both are non-GPU sizes, both are documented, and neither requires a card purchase. ADR-0014's committed first increment sits exactly at the recommended row. **The GPU question genuinely does not arise until the increment grows to vLLM, a `*-cuda-gpu` variant, or Agentic Retrieval**, which is what ADR-0014 decision 3 already says and which this spike now backs with the full SKU, release, and VRAM detail.

**Three defects found, all cheap to fix, none of them fatal.** A memory limit that cannot schedule on the node Microsoft recommends (Q5, Q7). A cache-storage field whose documented scope contradicts the page that recommends it (Q3). And a binding-constraint claim in a prior spike that is true of one host and false in general (Q2). Each is a two-line correction to an existing document.

**One number this spike deliberately does not provide: CPU tokens per second.** It does not exist first-party, on either target, and this spike declines to invent it or borrow it. Both prior spikes were right to leave it open, and it stays open until someone measures it.

---

## Sources

All first-party Microsoft Learn. Retrieved 2026-07-30.

- What is Foundry Local? (the server FAQ answer, platform list, curated-catalog rationale, no-subscription statement): <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>
- Get started with Foundry Local (Windows AI) (the only stated Windows prerequisites, the WinML GPU requirement, the empty-content failure mode on GPU-less VMs, `phi-3.5-mini` at 2.53 GB, model aliases): <https://learn.microsoft.com/windows/ai/foundry-local/get-started>
- Foundry Local CLI reference (CLI prerequisites, the cache command set including `cache location` and `cache cd`, the built-in and plugin execution provider tables with hardware and driver floors and license terms, automatic EP download and update, model list filtering by device and provider): <https://learn.microsoft.com/azure/foundry-local/reference/reference-cli>
- Get started with Foundry Local (SDK quickstart, the EP download step and the "EP packages include dependencies and may be large" note): <https://learn.microsoft.com/azure/foundry-local/get-started>
- Foundry Local architecture overview (hardware abstraction and execution provider matrix, model lifecycle, local caching, CPU fallback): <https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture>
- Best practices and troubleshooting guide for Foundry Local (performance best practices including monitor memory and try more quantized variants, the slow-inference cause and remedy, disk encryption for model caches, the on-device-not-distributed scope statement, the winget MSIX machine-scope block): <https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice>
- Requirements for Foundry Local on Azure Local (worker node capacity minimum and recommended, allocatable memory floors, the `Standard_A4_v2` warning, the GPU SKU list and the AMD-unsupported statement, EPP reservation, the 100 GiB model cache PVC statement, Kubernetes 1.29, TLS certificate, connected versus disconnected): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements>
- ModelDeployment and operator configuration reference (full spec field table and defaults including the 256Mi/1Gi trap, `vllm.modelCacheStorageGi` default 100 and its vLLM-only scope, EPP defaults and the auto-enable-on-scale behaviour, EPP resource values, GPU configuration examples): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator>
- Run inference on Foundry Local on Azure Local (the CPU generative `resources` example of 4/16Gi request and 8/32Gi limit, API key retrieval, the large-model cache note): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-run-inference>
- Deploy a catalog model on Foundry Local on Azure Local (the "adjust CPU, memory, and GPU resource values based on your model size, quantization level, and expected concurrency" guidance, the CPU-only instruction to remove the gpu limit, the catalog `resources` example): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/how-to-deploy-model>
- Quickstart: Deploy your first model and run inference (the same `resources` example, prerequisites): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-run-first-model>
- Model catalog and sourcing in Foundry Local (the three Phi-4-mini catalog entries with exact `fileSizeBytes`, the image selection matrix, catalog-sync behaviour): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog>
- Generative small language models in Foundry Local on Azure Local (the model table with max context length, recommended minimum GPU generation, and required GPU memory): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-models>
- vLLM Runtime Model Reference for Foundry Local on Azure Local (the measured TTFT and output throughput tables on NVIDIA A10, per model, at four concurrency levels): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models>
- Inference runtimes in Foundry Local on Azure Local (ONNX Runtime versus vLLM comparison, vLLM GPU-only, memory optimization differences, EPP performance figures, runtime selection from the catalog framework field): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes>
- Model caching and StoreModel lifecycle (the StoreModel phases, the cache Job, the model-store-retriever init container): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-caching>
- Deploy Foundry Local as an Azure Arc extension (the `storeModel.cacheJob.resources` defaults of 16Gi and 32Gi and the tuning guidance, the ordered install steps, `entraAuth` parameters, `api.exposure`): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension>
- Scale requirements for AKS on Azure Local (the full supported worker and control plane VM size lists, the default VM sizes, the 200 GB dynamically expanding node OS disk from release 2509, the full GPU VM SKU tables, cluster and node pool scale limits): <https://learn.microsoft.com/azure/aks/aksarc/scale-requirements>
- Use GPUs for compute-intensive workloads in AKS on Azure Local (the supported GPU model table with the release that added each, Linux-only node pools, the GPU VM SKU tables, the driver preparation sequence, and the FAQ on spare GPUs for rolling upgrades): <https://learn.microsoft.com/azure/aks/aksarc/deploy-gpu-node-pool>
- Prepare GPUs for Azure Local (the DDA versus GPU-P comparison table, the GPU model support matrix by assignment type, the "AKS Arc doesn't currently support GPU partitions" footnote, the homogeneous-configuration host requirement): <https://learn.microsoft.com/azure/azure-local/manage/gpu-preparation>
- What's new in AKS enabled by Azure Arc on Azure Local (the `Standard_D16s_v3` and `Standard_D32s_v3` addition in release 2503, the 200 GB default OS disk in 2509, GPU support history): <https://learn.microsoft.com/azure/aks/aksarc/aks-whats-new-local>
- Requirements for Agentic Retrieval in Foundry Local (the GPT-OSS-20B host hardware table with CPU, RAM, storage and VRAM minimums and recommendations, the minimum cluster node capacity by mode, the two-embedding-GPU shape): <https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements>

Prior records this spike depends on and in two places corrects: `docs/research/SPIKE-08-foundry-local-on-device.md`, `docs/research/SPIKE-09-azure-local-foundry.md`, `docs/research/SPIKE-18-foundry-local-windows-server.md` (Q2 refutes its general binding-constraint framing), `docs/research/SPIKE-19-foundry-local-azure-local-deployment.md` (Q6 closes its UNKNOWN #4), `docs/adr/ADR-0013-foundry-local-windows-server-install.md`, `docs/adr/ADR-0014-foundry-local-azure-local-deployment-layers.md` (Q7 supplies the values its decision 6 requires but does not name).

No `az` command was run, no cluster was queried, no software was installed, and no benchmark was executed in the production of this spike.
