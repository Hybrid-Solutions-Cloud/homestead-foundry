# Available models: Foundry Local and Azure Local Foundry

::: info Scope: the two on-premises targets
This page covers **Foundry Local** (a single Windows Server you own) and **Azure
Local Foundry** (cluster scale on Azure Local). The hosted cloud target draws
from a completely different roster: see
[Available models: Azure AI Foundry](./model-availability-azure-cloud). Compare
all three on [Deployment targets](../targets/).
:::

Unlike the cloud catalog, these two are **bounded and enumerable**, so this page
lists them in full. Everything here is drawn from
[SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), which read the
published catalog snapshot dated 2026-07-28.

::: warning Nothing here is deployed
Neither on-premises target has a deployment behind it in this repository, so
**no row on this page is `deployed`**. Everything in the catalog and deployable
in principle is `available`. This is an availability reference, not an as-built
record. For what this project actually chose and runs, see the
[model catalog](./model-catalog).
:::

## The headline: these are two catalogs, not one

It is tempting to read "Foundry Local" as one product with two hosting options.
The rosters say otherwise. They **diverge in model identity, in both
directions**:

- **Azure Local Foundry carries 100 entries Foundry Local cannot run at all.**
  These are the vLLM roster, a GPU-only container runtime with no device-SDK
  equivalent.
- **Foundry Local carries NPU and generic-GPU variants Azure Local Foundry never
  syncs.** Its catalog sync paginates CPU and GPU only.

Only the middle, the shared ONNX core, is common to both. That is 35 aliases out
of 170 total entries.

This corrected the premise of
[ADR-0017](../adr/ADR-0017-deployment-target-documentation-structure) decision 5,
which had assumed the two differed only in execution provider and deployment
mechanics. The decision's outcome, one shared page, still stands: the two
per-target columns below are exactly what expresses the divergence, and a row
present on one target and absent on the other is more legible as a filled cell
next to an empty one than as two pages a reader has to diff by hand.

## What neither target has

Both rosters are **text, reasoning, code, and speech-to-text only**. Confirmed
absent from both ([SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog) Q5):

| Capability | On either on-premises target |
|---|---|
| Image generation | No |
| Text to speech | No |
| Embeddings | No |
| Video generation | No |

Nothing in [this project's cloud catalog](./model-catalog) runs here, and
nothing here runs on the cloud target. The rosters are disjoint.

## Two notes before you read the tables

**Sizes and licences are mostly `UNKNOWN`, deliberately.** The published catalog
snapshot carries no size column, and licence values are published for exactly
one model. Resolving either is a *query against a running install*, not a
research question, and back-filling them from upstream model cards would be
guessing. This repository marks unverifiable facts `UNKNOWN` rather than
inventing them.

**Publisher reads `Microsoft` on every ONNX row.** That field means "publisher of
the ONNX build," not the originating lab. The originating lab is given after the
slash where it differs.

## Section 1: the shared ONNX core

35 aliases, 70 catalog entries, **available on both targets**. Every row has both
a `-generic-cpu` and a `-cuda-gpu` entry under the same base name.

| Model (alias) | Publisher / origin | Variant and execution provider | Foundry Local | Azure Local Foundry | Size and RAM | Licence | Status |
|---|---|---|---|---|---|---|---|
| `phi-4-mini` | Microsoft / Microsoft | `Phi-4-mini-instruct-generic-cpu:5` CPU; `-cuda-gpu:5` CUDA | yes | yes (`onnx-genai`, cpu or gpu) | 4.8 GB CPU, 3.6 GB GPU; GPU memory 7.806 GB (vLLM entry); RAM UNKNOWN | **MIT** | available |
| `phi-4-mini-reasoning` | Microsoft / Microsoft | `Phi-4-mini-reasoning-generic-cpu:3`; `-cuda-gpu:3` | yes | yes | UNKNOWN; GPU memory 7.806 GB (vLLM entry) | UNKNOWN | available |
| `phi-4` | Microsoft / Microsoft | `Phi-4-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available |
| `phi-3.5-mini` | Microsoft / Microsoft | `Phi-3.5-mini-instruct-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | 2.53 GB device download; GPU memory 8.428 GB (vLLM entry) | UNKNOWN | available |
| `phi-3-mini-4k` | Microsoft / Microsoft | `Phi-3-mini-4k-instruct-generic-cpu:3`; `-cuda-gpu:2` (version skew) | yes | yes | UNKNOWN; 3.8B params | UNKNOWN | available |
| `phi-3-mini-128k` | Microsoft / Microsoft | `Phi-3-mini-128k-instruct-generic-cpu:3`; `-cuda-gpu:2` | yes | yes | UNKNOWN; 3.8B params | UNKNOWN | available |
| `gpt-oss-20b` | Microsoft / OpenAI (open weight) | `gpt-oss-20b-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN on ONNX; GPU memory 14.793 GB and Blackwell CC 10.0+ recommended on the vLLM entry | UNKNOWN | available |
| `qwen3-0.6b` | Microsoft / Alibaba | `qwen3-0.6b-generic-cpu:4`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen3-1.7b` | Microsoft / Alibaba | `qwen3-1.7b-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen3-4b` | Microsoft / Alibaba | `qwen3-4b-generic-cpu:3`; `-cuda-gpu:2` (version skew) | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen3-8b` | Microsoft / Alibaba | `qwen3-8b-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen3-14b` | Microsoft / Alibaba | `qwen3-14b-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen3.5-2b-text` | Microsoft / Alibaba | `qwen3.5-2b-text-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen2.5-0.5b` | Microsoft / Alibaba | `qwen2.5-0.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN; 0.5B params | UNKNOWN | available |
| `qwen2.5-1.5b` | Microsoft / Alibaba | `qwen2.5-1.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN; 1.5B params | UNKNOWN | available |
| `qwen2.5-7b` | Microsoft / Alibaba | `qwen2.5-7b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen2.5-14b` | Microsoft / Alibaba | `qwen2.5-14b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-0.5b` | Microsoft / Alibaba | `qwen2.5-coder-0.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-1.5b` | Microsoft / Alibaba | `qwen2.5-coder-1.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-7b` | Microsoft / Alibaba | `qwen2.5-coder-7b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `qwen2.5-coder-14b` | Microsoft / Alibaba | `qwen2.5-coder-14b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `deepseek-r1-7b` | Microsoft / DeepSeek | `deepseek-r1-distill-qwen-7b-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `deepseek-r1-14b` | Microsoft / DeepSeek | `deepseek-r1-distill-qwen-14b-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available |
| `mistral-7b-v0.2` | Microsoft / Mistral AI | `mistralai-Mistral-7B-Instruct-v0-2-generic-cpu:3`; `-cuda-gpu:2` | yes | yes | UNKNOWN; GPU memory 15.64 GB on the vLLM entry | UNKNOWN | available |
| `mistral-nemo-12b-instruct` | Microsoft / Mistral AI and NVIDIA | `mistral-nemo-12b-instruct-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available |
| `olmo-3-7b-instruct` | Microsoft / Allen Institute for AI | `olmo-3-7b-instruct-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available |
| `smollm3-3b` | Microsoft / Hugging Face | `smollm3-3b-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available |
| `whisper-tiny` | Microsoft / OpenAI | `openai-whisper-tiny-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-base` | Microsoft / OpenAI | `openai-whisper-base-generic-cpu:3`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-small` | Microsoft / OpenAI | `openai-whisper-small-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-medium` | Microsoft / OpenAI | `openai-whisper-medium-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) |
| `whisper-large-v3-turbo` | Microsoft / OpenAI | `openai-whisper-large-v3-turbo-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) |
| `nemotron-speech-streaming-en-0.6b` | Microsoft / NVIDIA | `nemotron-speech-streaming-en-0.6b-generic-cpu:3`; `-cuda-gpu:1` | yes | yes | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) |
| `nemotron-speech-streaming-es-0.6b` | Microsoft / NVIDIA | `nemotron-speech-streaming-es-0.6b-ft-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) |
| `nemotron-3.5-asr-streaming-0.6b` | Microsoft / NVIDIA | `nemotron-3.5-asr-streaming-0.6b-generic-cpu:3`; `-cuda-gpu:2` | yes | yes | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) |

::: warning What "yes" means in the Foundry Local column
It means the entry comes from the `foundry-local` source that the device SDK
also consumes, and the device documentation names several of these aliases
directly. It does **not** mean each row has been observed in a device-side
`foundry model list`. Confirming that needs a running install, and it is
recorded as an open unknown in
[SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog#what-is-still-unknown).
:::

Two further device-side entries appear in the CLI reference as sample filter
values but not in the catalog snapshot:
`deepseek-r1-distill-qwen-1.5b-generic-cpu` and the alias `phi4-cpu`. Those are
documentation samples rather than a catalog dump, so they suggest more Foundry
Local breadth without proving it.

## Section 2: Azure Local Foundry only, the vLLM roster

100 entries, **GPU only**, and **not available on Foundry Local** at all: vLLM is
a GPU-only container runtime with no device-SDK equivalent. Grouped by family,
with every alias named. Framework is `vllm` and task is `chat-completion` except
where noted. Size, RAM, and licence are `UNKNOWN` on every row except the five
with published GPU memory figures.

| Family | Aliases | Notes | Status |
|---|---|---|---|
| Microsoft Phi | `phi-4`, `phi-4-reasoning`, `phi-4-mini-instruct`, `phi-4-mini-reasoning`, `phi-3.5-mini-instruct` | `phi-4-reasoning` has **no ONNX entry**, so it is Azure Local Foundry only | available |
| OpenAI open weight | `gpt-oss-20b`, `gpt-oss-120b` | `gpt-oss-120b` is Azure Local Foundry only. `gpt-oss-20b` is Microsoft's recommended model for Agentic Retrieval and "requires its own GPU" | available |
| DeepSeek | `deepseek-r1-distill-qwen-1.5b`, `-7b`, `-14b`, `deepseek-v3-0324`, `deepseek-v3.1`, `deepseek-v3.2`, `deepseek-v3.2-speciale` | The V3 line is Azure Local Foundry only and very large | available |
| Qwen | `qwen2.5-0.5b-instruct`, `-1.5b-instruct`, `-7b-instruct`, `-14b-instruct`, `qwen2.5-coder-0.5b/1.5b/7b/14b-instruct`, `qwen3-0.6b`, `-1.7b`, `-8b`, `-14b`, `-32b` | `qwen3-32b` is Azure Local Foundry only | available |
| Mistral AI, dense | `mistral-7b-instruct-v0.2`, `-v0.3`, `mistral-nemo-instruct-2407`, `mistral-nemo-instruct-fp8-2407`, `mistral-small-24b-instruct-2501`, `mistral-small-3.1-24b-instruct-2503`, `mistral-small-3.2-24b-instruct-2506`, `mistral-small-4-119b-2603`, `mistral-small-4-119b-2603-nvfp4`, `mistral-large-3-675b-instruct-2512` | `mistral-large-3-675b` is the largest entry in the catalog | available |
| Mistral AI, MoE and specialist | `mixtral-8x7b-instruct-v0.1`, `mixtral-8x22b-instruct-v0.1`, `magistral-small-2506`, `-2507`, `-2509`, `devstral-small-2505`, `-2507`, `mathstral-7b-v0.1`, `ministral-3-3b-instruct-2512`, `ministral-3-8b-instruct-2512`, `ministral-3-14b-reasoning-2512` | Microsoft names `magistral` as a model that exceeds the 100 GiB `vllm.modelCacheStorageGi` default | available |
| Mistral AI, vision | `pixtral-12b-2409` | **Vision-language** | available |
| NVIDIA Nemotron, vision | `nemotron-nano-12b-v2-vl-bf16`, `-fp8`, `-nvfp4-qad` | **Vision-language** | available |
| NVIDIA Nemotron, omni | `nemotron-3-nano-omni-30b-a3b-reasoning-bf16`, `-fp8`, `-nvfp4` | Multi-modal by name; capability surface not documented | available |
| NVIDIA Nemotron, general | `nemotron-nano-9b-v2`, `-fp8`, `-nvfp4`, `-japanese`, `nemotron-nano-12b-v2`, `nemotron-3-nano-4b-bf16`, `-fp8`, `nemotron-3-nano-30b-a3b-bf16`, `-nvfp4`, `nemotron-3-super-120b-a12b-bf16`, `-fp8`, `-nvfp4`, `nemotron-4-mini-hindi-4b-instruct` | Quantization is encoded in the alias | available |
| NVIDIA Nemotron, code | `opencodereasoning-nemotron-7b`, `-14b`, `-32b`, `-32b-ioi`, `opencodereasoning-nemotron-1.1-7b`, `-1.1-14b`, `-1.1-32b`, `nemotron-terminal-8b`, `-14b`, `-32b` | | available |
| NVIDIA Nemotron, math and reasoning | `openmath-nemotron-1.5b`, `-7b`, `-14b`, `-14b-kaggle`, `-32b`, `openreasoning-nemotron-1.5b`, `-7b`, `-14b`, `-32b`, `acereason-nemotron-7b`, `-14b`, `acereason-nemotron-1.1-7b`, `acemath-rl-nemotron-7b` | | available |
| Allen Institute for AI | `olmo-3-7b-instruct`, `olmo-3.1-32b-instruct` | `olmo-3.1-32b` is Azure Local Foundry only | available |
| Hugging Face | `smollm3-3b` | | available |
| OpenAI Whisper (ASR) | `whisper-tiny`, `whisper-base`, `whisper-small`, `whisper-medium`, `whisper-large-v3-turbo` | task `automatic-speech-recognition` | available (ASR) |
| NVIDIA streaming ASR | `nemotron-speech-streaming-en-0.6b` | task `automatic-speech-recognition` | available (ASR) |

**Vision input is an Azure Local Foundry exclusive.** `pixtral-12b-2409` and the
three `nemotron-nano-12b-v2-vl` variants are vision-language models, and they
appear only in this roster. Foundry Local has no vision-capable entry.

## Section 3: Foundry Local only, the NPU and alternate-accelerator variants

Azure Local Foundry's catalog sync paginates CPU and GPU only, so every variant
class below is **absent from it**. These are what you gain by running on a
device rather than a cluster.

| Variant class | Suffix | Execution provider | Foundry Local | Azure Local Foundry |
|---|---|---|---|---|
| Qualcomm NPU | `-qnn-npu` | `QNNExecutionProvider` | yes (Snapdragon X Elite / X Plus, driver 30.0.140.0+) | **no** |
| AMD NPU | `-vitis-npu` | `VitisAIExecutionProvider` | yes (Adrenalin 25.6.3 to 25.9.1) | **no** |
| Intel NPU and GPU | (per model) | `OpenVINOExecutionProvider` | yes (Intel TigerLake+ / AlderLake+ / ArrowLake+) | **no** |
| Generic GPU (WebGPU/Dawn) | `-generic-gpu` | `WebGpuExecutionProvider` | yes, the cross-platform GPU fallback | **no** |
| NVIDIA TensorRT RTX | (per model) | `NvTensorRTRTXExecutionProvider` | yes (RTX 30 series and newer) | **no** |

**The specific per-model NPU list is not enumerable from documentation.**
Microsoft's own guidance is to ask the hardware:

```bash
foundry model list --filter device=NPU
```

## Keeping this current

This page is a transcription of a catalog snapshot dated 2026-07-28. It will
drift. Generating it from the live catalog, alongside the cloud snapshot, is
tracked as a feature request rather than left as a recurring manual chore: see
[issue #15, auto-refresh the model availability catalogs](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/issues/15).

## See also

- [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), the research behind every row here, including the open unknowns.
- [Available models: Azure AI Foundry](./model-availability-azure-cloud), the cloud roster.
- [Model catalog](./model-catalog), what this project chose and why.
- [Model selection](../guide/model-selection), the methodology behind the choosing.
- [Foundry Local: models](../targets/windows-server/models) and [Azure Local Foundry: models](../targets/azure-local/models).
