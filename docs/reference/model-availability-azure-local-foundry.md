# Available models: Azure Local Foundry

::: info One of three availability references
This page covers **Azure Local Foundry**, cluster-scale inference on Azure Local.
The other two targets carry different rosters:
[Azure AI Foundry](./model-availability-azure-cloud) (hosted cloud) and
[Foundry Local](./model-availability-foundry-local) (a runtime inside your own
application). Compare all three on [Deployment targets](../targets/).
:::

Everything here is drawn from
[SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), which read the
published catalog snapshot dated 2026-07-28, with GPU figures confirmed against
Microsoft's published vLLM reference.

::: warning Nothing here is deployed
This target has no deployment behind it in this repository, so **no row on this
page is `deployed`**. Everything in the catalog and deployable in principle is
`available`. This is an availability reference, not an as-built record.
:::

## What Azure Local Foundry is, precisely

An **Azure Arc-enabled Kubernetes extension**, not a device runtime. An operator
control plane watches cluster state and reconciles model resources through
declarative custom resources (`Model` and `ModelDeployment` CRDs).

| | |
|---|---|
| Deployment | Arc extension, or Helm |
| Availability | **Preview, by request.** Submit the access request form before planning around it |
| Runtimes | **ONNX-GenAI** (CPU or GPU) and **vLLM** (GPU only, high throughput) |
| API | OpenAI-compatible: `/v1/chat/completions` generative, `/v1/predict` predictive |
| Azure subscription | **Required**, plus Entra permissions and a supported region |
| Auth | API keys or Microsoft Entra ID, TLS-terminated gateway |
| Disconnected | Supported, with a deployment model consistent with connected scenarios |

It also supports **bring-your-own models** containerized with ONNX or vLLM,
including Hugging Face models and fine-tuned variants. Predictive workloads
support BYO models **only**; catalog models cannot serve predictive tasks.

## What this target does not have

**Text, reasoning, code, speech-to-text, and vision input.** Confirmed absent
([SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog) Q5):

| Capability | Available on Azure Local Foundry |
|---|---|
| Image generation | No |
| Text to speech | No |
| Embeddings | No |
| Video generation | No |
| **Vision input** | **Yes** - and this is exclusive to this target |

Nothing in [this project's cloud catalog](./model-catalog) runs here.

## Two notes before you read the tables

**Sizes and licences are mostly `UNKNOWN`, deliberately.** The published catalog
snapshot carries no size column, and licence values are published for exactly one
model. Resolving either is a *query against a running cluster*, not a research
question. This repository marks unverifiable facts `UNKNOWN` rather than
inventing them.

**Publisher reads `Microsoft` on every ONNX row.** That field means "publisher of
the ONNX build," not the originating lab.

## What each family is actually for

The alias tells you the size, the vendor, and often the quantization. It does not
tell you what the model is good at. This section does.

| Family | Reach for it when | Avoid it when |
|---|---|---|
| **Phi** (Microsoft) | You want the best quality per gigabyte of GPU. `phi-4-mini-instruct` fits in 7.8 GB with a 93,520 context. `phi-4-reasoning` is cluster-exclusive and the choice for multi-step working. | You need broad world knowledge or very long documents. |
| **gpt-oss-20b / 120b** (OpenAI, open weight) | Strong function calling, structured output, and reasoning. **`gpt-oss-20b` is Microsoft's recommended model for Agentic Retrieval.** `120b` when quality outranks cost. | Your GPUs are Ampere. See the GPU warning below, and note Microsoft says `gpt-oss-20b` "requires its own GPU". |
| **DeepSeek R1 distills** | Reasoning-heavy analysis where you want visible working, at 1.5B/7B/14B so you can size to the node. | Latency matters: reasoning models emit far more tokens before answering. |
| **DeepSeek V3 line** | Frontier-class open-weight quality on-premises. Cluster-exclusive. | Your cluster is small. These are very large and will dominate a node's memory. |
| **Qwen** (Alibaba) | Multilingual work, and precise size selection from 0.6B to 32B. `qwen3-32b` is cluster-exclusive. | Licence certainty matters and you have not checked. |
| **Qwen Coder** | Code generation and developer tooling, 0.5B to 14B. | General chat: these are worse at prose than same-size siblings. |
| **Mistral dense** | General chat with widely-adopted open models, scaling from 7B to `mistral-large-3-675b`, the largest entry in the catalog. | Memory is tight. `mistral-7b-v0.2` alone needs **15.64 GB**, roughly double Phi-4-mini. |
| **Mistral MoE and specialist** | Mixture-of-experts throughput (`mixtral`), agentic coding (`devstral`), maths (`mathstral`), reasoning (`magistral`, `ministral-3-14b-reasoning`). | You have left `vllm.modelCacheStorageGi` at its 100 GiB default: **Microsoft names `magistral` as a model that exceeds it.** |
| **Pixtral, Nemotron VL** | **Vision input.** Document understanding, screenshots, diagrams, image Q and A. **These are the only vision-capable models on any on-premises target.** | You only need text. Vision models cost more memory for no benefit. |
| **Nemotron general and omni** (NVIDIA) | High-throughput GPU serving, tuned for concurrency rather than single-request latency. Quantization is in the alias: `bf16` quality, `fp8` balance, `nvfp4` smallest. | You are on non-NVIDIA hardware or older generations. |
| **Nemotron code / math / reasoning** | Narrow, deep specialisms: competitive coding (`opencodereasoning`, `-ioi`), terminal and tool use (`nemotron-terminal`), mathematics (`openmath`, `acemath`), reasoning (`openreasoning`, `acereason`). | You want one model for everything. These are deliberately narrow. |
| **OLMo, SmolLM** | Fully-open provenance (OLMo, Allen Institute; `olmo-3.1-32b` is cluster-exclusive) or the smallest viable footprint (SmolLM3, 3B). | You need frontier quality. |
| **Whisper** (ASR) | Speech to text. `-tiny` and `-base` for throughput, `-large-v3-turbo` for accuracy. | You want text **to** speech. Nothing on this target does TTS. |
| **Nemotron streaming ASR** | **Live** transcription where Whisper's batch shape adds latency. | You need languages beyond English. |

::: tip Start here
`phi-4-mini-instruct` for general use, `qwen2.5-coder-7b` for code,
`gpt-oss-20b` if you are building Agentic Retrieval and have the GPU for it,
`pixtral-12b-2409` if you need to read images, `whisper-large-v3-turbo` for
transcription.
:::

## Section 1: the ONNX roster

35 aliases, 70 catalog entries, served by the **ONNX-GenAI** runtime on CPU or
GPU. **Every model in this table also runs on
[Foundry Local](./model-availability-foundry-local)**; this is the shared core the
two on-premises targets have in common.

| Model (alias) | Publisher / origin | Runtime | Notes | Status |
|---|---|---|---|---|
| `phi-4-mini` | Microsoft / Microsoft | `onnx-genai`, cpu or gpu | Also a vLLM entry; **MIT** licence; 7.806 GB GPU memory on vLLM | available |
| `phi-4-mini-reasoning` | Microsoft / Microsoft | `onnx-genai` | Also a vLLM entry; 7.806 GB GPU memory | available |
| `phi-4` | Microsoft / Microsoft | `onnx-genai` | Also a vLLM entry | available |
| `phi-3.5-mini` | Microsoft / Microsoft | `onnx-genai` | Also a vLLM entry; 8.428 GB GPU memory | available |
| `phi-3-mini-4k` | Microsoft / Microsoft | `onnx-genai` | 3.8B params | available |
| `phi-3-mini-128k` | Microsoft / Microsoft | `onnx-genai` | 3.8B params | available |
| `gpt-oss-20b` | Microsoft / OpenAI (open weight) | `onnx-genai` | Also a vLLM entry; see the GPU warning below | available |
| `qwen3-0.6b` / `-1.7b` / `-4b` / `-8b` / `-14b` | Microsoft / Alibaba | `onnx-genai` | `qwen3-4b` has CPU/GPU version skew | available |
| `qwen3.5-2b-text` | Microsoft / Alibaba | `onnx-genai` | | available |
| `qwen2.5-0.5b` / `-1.5b` / `-7b` / `-14b` | Microsoft / Alibaba | `onnx-genai` | Also vLLM entries | available |
| `qwen2.5-coder-0.5b` / `-1.5b` / `-7b` / `-14b` | Microsoft / Alibaba | `onnx-genai` | Also vLLM entries | available |
| `deepseek-r1-7b` / `-14b` | Microsoft / DeepSeek | `onnx-genai` | Distilled Qwen; also vLLM entries | available |
| `mistral-7b-v0.2` | Microsoft / Mistral AI | `onnx-genai` | Also a vLLM entry; **15.64 GB GPU memory** | available |
| `mistral-nemo-12b-instruct` | Microsoft / Mistral AI and NVIDIA | `onnx-genai` | | available |
| `olmo-3-7b-instruct` | Microsoft / Allen Institute for AI | `onnx-genai` | | available |
| `smollm3-3b` | Microsoft / Hugging Face | `onnx-genai` | | available |
| `whisper-tiny` / `-base` / `-small` / `-medium` / `-large-v3-turbo` | Microsoft / OpenAI | `onnx-genai` | task `automatic-speech-recognition` | available (ASR) |
| `nemotron-speech-streaming-en-0.6b` / `-es-0.6b` | Microsoft / NVIDIA | `onnx-genai` | 0.6B params | available (ASR) |
| `nemotron-3.5-asr-streaming-0.6b` | Microsoft / NVIDIA | `onnx-genai` | 0.6B params | available (ASR) |

## Section 2: the vLLM roster, exclusive to this target

100 entries, **GPU only**, and **not available on Foundry Local at all**: vLLM is
a GPU-only container runtime with no device-SDK equivalent. Grouped by family,
with every alias named. Framework is `vllm` and task is `chat-completion` except
where noted. Size, RAM, and licence are `UNKNOWN` except where GPU memory is
published.

| Family | Aliases | Notes | Status |
|---|---|---|---|
| Microsoft Phi | `phi-4`, `phi-4-reasoning`, `phi-4-mini-instruct`, `phi-4-mini-reasoning`, `phi-3.5-mini-instruct` | `phi-4-reasoning` has **no ONNX entry**, so it is exclusive to this target | available |
| OpenAI open weight | `gpt-oss-20b`, `gpt-oss-120b` | `gpt-oss-120b` is exclusive to this target. `gpt-oss-20b` is Microsoft's recommended model for Agentic Retrieval and "requires its own GPU" | available |
| DeepSeek | `deepseek-r1-distill-qwen-1.5b`, `-7b`, `-14b`, `deepseek-v3-0324`, `deepseek-v3.1`, `deepseek-v3.2`, `deepseek-v3.2-speciale` | The V3 line is exclusive to this target and very large | available |
| Qwen | `qwen2.5-0.5b-instruct`, `-1.5b-instruct`, `-7b-instruct`, `-14b-instruct`, `qwen2.5-coder-0.5b/1.5b/7b/14b-instruct`, `qwen3-0.6b`, `-1.7b`, `-8b`, `-14b`, `-32b` | `qwen3-32b` is exclusive to this target | available |
| Mistral AI, dense | `mistral-7b-instruct-v0.2`, `-v0.3`, `mistral-nemo-instruct-2407`, `mistral-nemo-instruct-fp8-2407`, `mistral-small-24b-instruct-2501`, `mistral-small-3.1-24b-instruct-2503`, `mistral-small-3.2-24b-instruct-2506`, `mistral-small-4-119b-2603`, `mistral-small-4-119b-2603-nvfp4`, `mistral-large-3-675b-instruct-2512` | `mistral-large-3-675b` is the largest entry in the catalog | available |
| Mistral AI, MoE and specialist | `mixtral-8x7b-instruct-v0.1`, `mixtral-8x22b-instruct-v0.1`, `magistral-small-2506`, `-2507`, `-2509`, `devstral-small-2505`, `-2507`, `mathstral-7b-v0.1`, `ministral-3-3b-instruct-2512`, `ministral-3-8b-instruct-2512`, `ministral-3-14b-reasoning-2512` | Microsoft names `magistral` as a model that exceeds the 100 GiB `vllm.modelCacheStorageGi` default | available |
| Mistral AI, vision | `pixtral-12b-2409` | **Vision-language** | available |
| NVIDIA Nemotron, vision | `nemotron-nano-12b-v2-vl-bf16`, `-fp8`, `-nvfp4-qad` | **Vision-language** | available |
| NVIDIA Nemotron, omni | `nemotron-3-nano-omni-30b-a3b-reasoning-bf16`, `-fp8`, `-nvfp4` | Multi-modal by name; capability surface not documented | available |
| NVIDIA Nemotron, general | `nemotron-nano-9b-v2`, `-fp8`, `-nvfp4`, `-japanese`, `nemotron-nano-12b-v2`, `nemotron-3-nano-4b-bf16`, `-fp8`, `nemotron-3-nano-30b-a3b-bf16`, `-nvfp4`, `nemotron-3-super-120b-a12b-bf16`, `-fp8`, `-nvfp4`, `nemotron-4-mini-hindi-4b-instruct` | Quantization is encoded in the alias | available |
| NVIDIA Nemotron, code | `opencodereasoning-nemotron-7b`, `-14b`, `-32b`, `-32b-ioi`, `opencodereasoning-nemotron-1.1-7b`, `-1.1-14b`, `-1.1-32b`, `nemotron-terminal-8b`, `-14b`, `-32b` | | available |
| NVIDIA Nemotron, math and reasoning | `openmath-nemotron-1.5b`, `-7b`, `-14b`, `-14b-kaggle`, `-32b`, `openreasoning-nemotron-1.5b`, `-7b`, `-14b`, `-32b`, `acereason-nemotron-7b`, `-14b`, `acereason-nemotron-1.1-7b`, `acemath-rl-nemotron-7b` | | available |
| Allen Institute for AI | `olmo-3-7b-instruct`, `olmo-3.1-32b-instruct` | `olmo-3.1-32b` is exclusive to this target | available |
| Hugging Face | `smollm3-3b` | | available |
| OpenAI Whisper (ASR) | `whisper-tiny`, `whisper-base`, `whisper-small`, `whisper-medium`, `whisper-large-v3-turbo` | task `automatic-speech-recognition` | available (ASR) |
| NVIDIA streaming ASR | `nemotron-speech-streaming-en-0.6b` | task `automatic-speech-recognition` | available (ASR) |

**Vision input is exclusive to this target.** `pixtral-12b-2409` and the three
`nemotron-nano-12b-v2-vl` variants are vision-language models and appear only
here. Foundry Local has no vision-capable entry.

## Published GPU requirements: size the cluster from these

These five are the only entries Microsoft publishes hard figures for. **Read the
GPU generation column before sizing anything.**

| Model | Max context | Recommended minimum GPU | Required GPU memory | GPU utilization |
|---|---|---|---|---|
| Phi-3.5-mini-instruct | 29,472 | Ampere (CC 8.0)+ | 8.428 GB | 0.85 |
| Phi-4-mini-instruct | 93,520 | Ampere (CC 8.0)+ | 7.806 GB | 0.85 |
| Phi-4-mini-reasoning | 93,520 | Ampere (CC 8.0)+ | 7.806 GB | 0.85 |
| Mistral-7B-Instruct-v0.2 | 29,328 | Ampere (CC 8.0)+ | 15.64 GB | 0.85 |
| **gpt-oss-20b** | 96,784 | **Blackwell (CC 10.0)+** | 14.793 GB | 0.8 |

::: danger gpt-oss-20b is two GPU generations ahead of everything else
Every other documented model recommends **Ampere (CC 8.0)**. `gpt-oss-20b`
recommends **Blackwell (CC 10.0)**, and it is also the model Microsoft recommends
for Agentic Retrieval. **Sizing a cluster from the other four rows and adding
gpt-oss-20b later is an expensive surprise.** Minimum supported across all five is
Volta (CC 7.0), but minimum supported is not the same as usable.
:::

## The authoritative list is your cluster, not this page

No published Microsoft page is a complete catalog. `concept-models` shows five
models and calls them "representative examples only"; `concept-model-catalog`
shows twelve and says the table "isn't exhaustive." The two disagree in scope for
the same product. Ask the cluster:

```bash
kubectl get configmap foundry-local-catalog -n foundry-local-operator \
  -o jsonpath="{.data['catalog\.json']}" | ConvertFrom-Json |
  Select-Object -ExpandProperty models |
  Format-Table alias, displayName, task, framework
```

Or through the REST API, with port forwarding to `inference-operator-api`:

```bash
curl -k -s https://localhost:8080/api/v1/models -H "Authorization: Bearer $token"
```

**A capability read from documentation is a claim; exercised against the cluster
it is a fact.**

## Keeping this current

This page is a transcription of a catalog snapshot dated 2026-07-28. **It will
drift**, and the product is in preview under active deployment. Generating it
from the live catalog is tracked as a feature request: see
[issue #15, auto-refresh the model availability catalogs](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/issues/15).

## See also

- [Model availability matrix](./model-matrix), all three targets side by side, filterable.
- [Available models: Azure AI Foundry](./model-availability-azure-cloud), the hosted cloud roster.
- [Available models: Foundry Local](./model-availability-foundry-local), the in-application runtime roster.
- [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), the research behind every row here, including the open unknowns.
- [Model catalog](./model-catalog), what this project chose and why.
- [Model selection](../guide/model-selection), the methodology behind the choosing.
- [Azure Local Foundry: models](../targets/azure-local/models).
