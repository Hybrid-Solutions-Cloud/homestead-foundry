# Available models: Foundry Local

::: info One of three availability references
This page covers **Foundry Local**, the runtime that ships inside your own
application on a machine you own. The other two targets carry different rosters:
[Azure AI Foundry](./model-availability-azure-cloud) (hosted cloud) and
[Azure Local Foundry](./model-availability-azure-local-foundry) (cluster scale on
Azure Local). Compare all three on [Deployment targets](../targets/).
:::

Everything here is drawn from
[SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), which read the
published catalog snapshot dated 2026-07-28.

::: warning Nothing here is deployed
This target has no deployment behind it in this repository, so **no row on this
page is `deployed`**. Everything in the catalog and deployable in principle is
`available`. This is an availability reference, not an as-built record. For what
this project actually chose and runs, see the [model catalog](./model-catalog).
:::

## What Foundry Local is, precisely

It is a **library that ships inside your application**, not a server product. The
runtime adds roughly 20 MB to your package and loads in-process through a C#,
JavaScript, Python or Rust SDK. There is no separate installer or background
service for end users to manage.

| | |
|---|---|
| Supported platforms | **Windows 10 and later**, and cross-platform: macOS and Linux |
| Install (CLI, for exploration) | `winget install Microsoft.FoundryLocal`, or `brew tap microsoft/foundrylocal` |
| Runtime | ONNX Runtime, with **WinML** on Windows for execution-provider registration |
| Model acquisition | Cloud-hosted Foundry Catalog, downloaded on first use, then cached and run fully offline |
| Azure subscription | **Not required** |
| Server edition | **There is no Windows Server SKU.** Microsoft scopes this as PCs and cross-platform devices. Running it on Windows Server is running the device runtime on server hardware, not a distinct product. For a server-class, cluster-scale deployment, the product is [Azure Local Foundry](./model-availability-azure-local-foundry). |

The optional local server is an OpenAI-compatible HTTP endpoint you can start
inside your process for tools like LangChain or Open WebUI. It is not required
for SDK use.

## What this target does not have

**Text, reasoning, code, and speech-to-text only.** Confirmed absent
([SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog) Q5):

| Capability | Available on Foundry Local |
|---|---|
| Image generation | No |
| Text to speech | No |
| Embeddings | No |
| Video generation | No |
| **Vision input** | **No.** Vision-language models are an Azure Local Foundry exclusive |

Nothing in [this project's cloud catalog](./model-catalog) runs here.

## Two notes before you read the tables

**Sizes and licences are mostly `UNKNOWN`, deliberately.** The published catalog
snapshot carries no size column, and licence values are published for exactly one
model. Resolving either is a *query against a running install*, not a research
question, and back-filling from upstream model cards would be guessing. This
repository marks unverifiable facts `UNKNOWN` rather than inventing them.

**Publisher reads `Microsoft` on every ONNX row.** That field means "publisher of
the ONNX build," not the originating lab. The originating lab is given after the
slash where it differs.

## What each family is actually for

The alias tells you the size and the vendor. It does not tell you what the model
is good at. This section does.

| Family | Reach for it when | Avoid it when |
|---|---|---|
| **Phi** (Microsoft) | You want the best quality per gigabyte. `phi-4-mini` is the sensible default on a device: it is the only row with a confirmed **MIT** licence, and it fits in 3.6 GB on GPU. `phi-4-mini-reasoning` trades speed for multi-step working. | You need broad world knowledge or long multi-document context. Small models trade breadth for efficiency. |
| **Qwen** (Alibaba) | You need **multilingual** work, or you want to tune size precisely: the family spans 0.6B to 14B, so you can dial quality against RAM on the exact hardware you have. | Licence certainty matters and you have not checked. Licence is `UNKNOWN` on every Qwen row here. |
| **Qwen Coder** | Code generation, completion, refactoring, and developer tooling. `qwen2.5-coder-7b` is the usual balance point; `-14b` if the machine can hold it. | You want general chat. These are tuned for code and are worse at prose than their non-coder siblings of the same size. |
| **DeepSeek R1 distills** | **Reasoning-heavy** tasks where you want visible working: analysis, multi-step derivation, planning. Distilled onto Qwen, so they inherit its efficiency. | Latency matters. Reasoning models emit far more tokens before answering, and on a device that is wall-clock time. |
| **Mistral** | General-purpose chat with a widely-understood open model. `mistral-7b-v0.2` is the most broadly adopted instruct model in the roster. | Memory is tight. It is the heaviest documented entry at **15.64 GB** GPU memory, roughly double Phi-4-mini. |
| **gpt-oss-20b** | You want the largest open-weight model that still runs locally, with strong function calling and structured output. | Your hardware is modest. See the GPU note below. |
| **OLMo, SmolLM** | Fully-open-provenance work (OLMo, Allen Institute) or the smallest viable footprint (SmolLM3, 3B). Good for embedded and edge cases where 7B will not fit. | You need frontier quality. These are chosen for openness and size, not for benchmark scores. |
| **Whisper** (ASR) | Speech to text. `whisper-tiny` and `-base` for real-time on modest hardware; `-large-v3-turbo` when accuracy matters more than latency. | You want text **to** speech. Nothing on this target does TTS. |
| **Nemotron streaming ASR** (NVIDIA) | **Live** transcription, where Whisper's batch-oriented shape adds latency. English and Spanish variants at 0.6B. | You need languages beyond those published. |

::: tip Start here
`phi-4-mini` for general use, `qwen2.5-coder-7b` for code, `whisper-base` for
transcription. All three run on modest hardware, and the first has a confirmed
permissive licence.
:::

::: warning gpt-oss-20b is not a modest-hardware model
On the cluster target its vLLM entry recommends **Blackwell (CC 10.0)** GPUs and
14.793 GB of GPU memory. The ONNX build here will run on less, but "runs" and
"runs usefully" are different claims, and no device-side figure is published.
Measure it on your hardware before designing around it.
:::

## Section 1: the ONNX roster

35 aliases, 70 catalog entries. Every row has both a `-generic-cpu` and a
`-cuda-gpu` entry under the same base name. **Every model in this table also runs
on [Azure Local Foundry](./model-availability-azure-local-foundry)**; this is the
shared core the two on-premises targets have in common.

| Model (alias) | Publisher / origin | Variant and execution provider | Size and RAM | Licence | Status |
|---|---|---|---|---|---|
| `phi-4-mini` | Microsoft / Microsoft | `Phi-4-mini-instruct-generic-cpu:5` CPU; `-cuda-gpu:5` CUDA | 4.8 GB CPU, 3.6 GB GPU; RAM UNKNOWN | **MIT** | available |
| `phi-4-mini-reasoning` | Microsoft / Microsoft | `Phi-4-mini-reasoning-generic-cpu:3`; `-cuda-gpu:3` | UNKNOWN | UNKNOWN | available |
| `phi-4` | Microsoft / Microsoft | `Phi-4-generic-cpu:2`; `-cuda-gpu:2` | UNKNOWN | UNKNOWN | available |
| `phi-3.5-mini` | Microsoft / Microsoft | `Phi-3.5-mini-instruct-generic-cpu:2`; `-cuda-gpu:2` | 2.53 GB device download | UNKNOWN | available |
| `phi-3-mini-4k` | Microsoft / Microsoft | `Phi-3-mini-4k-instruct-generic-cpu:3`; `-cuda-gpu:2` (version skew) | UNKNOWN; 3.8B params | UNKNOWN | available |
| `phi-3-mini-128k` | Microsoft / Microsoft | `Phi-3-mini-128k-instruct-generic-cpu:3`; `-cuda-gpu:2` | UNKNOWN; 3.8B params | UNKNOWN | available |
| `gpt-oss-20b` | Microsoft / OpenAI (open weight) | `gpt-oss-20b-generic-cpu:1`; `-cuda-gpu:1` | UNKNOWN on ONNX | UNKNOWN | available |
| `qwen3-0.6b` | Microsoft / Alibaba | `qwen3-0.6b-generic-cpu:4`; `-cuda-gpu:2` | UNKNOWN | UNKNOWN | available |
| `qwen3-1.7b` | Microsoft / Alibaba | `qwen3-1.7b-generic-cpu:2`; `-cuda-gpu:2` | UNKNOWN | UNKNOWN | available |
| `qwen3-4b` | Microsoft / Alibaba | `qwen3-4b-generic-cpu:3`; `-cuda-gpu:2` (version skew) | UNKNOWN | UNKNOWN | available |
| `qwen3-8b` | Microsoft / Alibaba | `qwen3-8b-generic-cpu:2`; `-cuda-gpu:2` | UNKNOWN | UNKNOWN | available |
| `qwen3-14b` | Microsoft / Alibaba | `qwen3-14b-generic-cpu:2`; `-cuda-gpu:2` | UNKNOWN | UNKNOWN | available |
| `qwen3.5-2b-text` | Microsoft / Alibaba | `qwen3.5-2b-text-generic-cpu:1`; `-cuda-gpu:1` | UNKNOWN | UNKNOWN | available |
| `qwen2.5-0.5b` | Microsoft / Alibaba | `qwen2.5-0.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN; 0.5B params | UNKNOWN | available |
| `qwen2.5-1.5b` | Microsoft / Alibaba | `qwen2.5-1.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN; 1.5B params | UNKNOWN | available |
| `qwen2.5-7b` | Microsoft / Alibaba | `qwen2.5-7b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `qwen2.5-14b` | Microsoft / Alibaba | `qwen2.5-14b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-0.5b` | Microsoft / Alibaba | `qwen2.5-coder-0.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-1.5b` | Microsoft / Alibaba | `qwen2.5-coder-1.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-7b` | Microsoft / Alibaba | `qwen2.5-coder-7b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-14b` | Microsoft / Alibaba | `qwen2.5-coder-14b-instruct-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `deepseek-r1-7b` | Microsoft / DeepSeek | `deepseek-r1-distill-qwen-7b-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `deepseek-r1-14b` | Microsoft / DeepSeek | `deepseek-r1-distill-qwen-14b-generic-cpu:4`; `-cuda-gpu:4` | UNKNOWN | UNKNOWN | available |
| `mistral-7b-v0.2` | Microsoft / Mistral AI | `mistralai-Mistral-7B-Instruct-v0-2-generic-cpu:3`; `-cuda-gpu:2` | UNKNOWN | UNKNOWN | available |
| `mistral-nemo-12b-instruct` | Microsoft / Mistral AI and NVIDIA | `mistral-nemo-12b-instruct-generic-cpu:1`; `-cuda-gpu:1` | UNKNOWN | UNKNOWN | available |
| `olmo-3-7b-instruct` | Microsoft / Allen Institute for AI | `olmo-3-7b-instruct-generic-cpu:1`; `-cuda-gpu:1` | UNKNOWN | UNKNOWN | available |
| `smollm3-3b` | Microsoft / Hugging Face | `smollm3-3b-generic-cpu:1`; `-cuda-gpu:1` | UNKNOWN | UNKNOWN | available |
| `whisper-tiny` | Microsoft / OpenAI | `openai-whisper-tiny-generic-cpu:4`; `-cuda-gpu:3` | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-base` | Microsoft / OpenAI | `openai-whisper-base-generic-cpu:3`; `-cuda-gpu:3` | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-small` | Microsoft / OpenAI | `openai-whisper-small-generic-cpu:4`; `-cuda-gpu:3` | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-medium` | Microsoft / OpenAI | `openai-whisper-medium-generic-cpu:4`; `-cuda-gpu:3` | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-large-v3-turbo` | Microsoft / OpenAI | `openai-whisper-large-v3-turbo-generic-cpu:4`; `-cuda-gpu:3` | UNKNOWN | UNKNOWN | available (ASR) |
| `nemotron-speech-streaming-en-0.6b` | Microsoft / NVIDIA | `nemotron-speech-streaming-en-0.6b-generic-cpu:3`; `-cuda-gpu:1` | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) |
| `nemotron-speech-streaming-es-0.6b` | Microsoft / NVIDIA | `nemotron-speech-streaming-es-0.6b-ft-generic-cpu:1`; `-cuda-gpu:1` | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) |
| `nemotron-3.5-asr-streaming-0.6b` | Microsoft / NVIDIA | `nemotron-3.5-asr-streaming-0.6b-generic-cpu:3`; `-cuda-gpu:2` | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) |

::: warning What "available" means here
The entry comes from the `foundry-local` source that the device SDK also
consumes, and the device documentation names several of these aliases directly.
It does **not** mean each row has been observed in a device-side
`foundry model list`. Confirming that needs a running install, and it is recorded
as an open unknown in
[SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog#what-is-still-unknown).
:::

Two further device-side entries appear in the CLI reference as sample filter
values but not in the catalog snapshot:
`deepseek-r1-distill-qwen-1.5b-generic-cpu` and the alias `phi4-cpu`. Those are
documentation samples rather than a catalog dump, so they suggest more breadth
without proving it.

## Section 2: NPU and alternate-accelerator variants, exclusive to this target

Azure Local Foundry's catalog sync paginates CPU and GPU only, so **every variant
class below is absent from it.** These are what you gain by running on a device
rather than a cluster.

| Variant class | Suffix | Execution provider | Hardware |
|---|---|---|---|
| Qualcomm NPU | `-qnn-npu` | `QNNExecutionProvider` | Snapdragon X Elite / X Plus, driver 30.0.140.0+ |
| AMD NPU | `-vitis-npu` | `VitisAIExecutionProvider` | Adrenalin 25.6.3 to 25.9.1 |
| Intel NPU and GPU | (per model) | `OpenVINOExecutionProvider` | Intel TigerLake+ / AlderLake+ / ArrowLake+ |
| Generic GPU (WebGPU/Dawn) | `-generic-gpu` | `WebGpuExecutionProvider` | the cross-platform GPU fallback |
| NVIDIA TensorRT RTX | (per model) | `NvTensorRTRTXExecutionProvider` | RTX 30 series and newer |

The CPU execution provider is always available as a fallback. If no GPU or NPU is
detected, inference runs on CPU automatically.

**The specific per-model NPU list is not enumerable from documentation.**
Microsoft's own guidance is to ask the hardware:

```bash
foundry model list --filter device=NPU
foundry model list --filter task=chat-completion
foundry model info phi-4-mini
```

**That command is the authority, and this page is not.** A capability read from
documentation is a claim; exercised against the runtime it is a fact.

## Compile your own

You are not limited to the catalog. Models compiled to ONNX can be run on this
target, including Hugging Face models converted for the purpose. See
[Compile Hugging Face models to run on Foundry Local](https://learn.microsoft.com/azure/foundry-local/how-to/how-to-compile-hugging-face-models).

## Keeping this current

This page is a transcription of a catalog snapshot dated 2026-07-28. **It will
drift**, and the product is in active development. Generating it from the live
catalog is tracked as a feature request rather than left as a recurring manual
chore: see
[issue #15, auto-refresh the model availability catalogs](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/issues/15).

## See also

- [Model availability matrix](./model-matrix), all three targets side by side, filterable.
- [Available models: Azure AI Foundry](./model-availability-azure-cloud), the hosted cloud roster.
- [Available models: Azure Local Foundry](./model-availability-azure-local-foundry), the cluster roster.
- [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), the research behind every row here, including the open unknowns.
- [Model catalog](./model-catalog), what this project chose and why.
- [Model selection](../guide/model-selection), the methodology behind the choosing.
- [Foundry Local: models](../targets/windows-server/models).
