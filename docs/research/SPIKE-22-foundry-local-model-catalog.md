# SPIKE-22: The Foundry Local model catalog, and whether tracks 2 and 3 draw from one catalog or two

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no software installed, no cluster touched, no model API called. First-party documentation review only, plus the Microsoft-published catalog snapshot named by those documents.
Date: 2026-07-30
Scope: enumerate the Foundry Local model catalog for deployment tracks 2 (Foundry Local on Windows Server) and 3 (Foundry Local on Azure Local), and resolve the premise ADR-0017 decision 5 asked this spike to confirm or refute. Closes SPIKE-18 unknown 6, SPIKE-19 unknown 1, SPIKE-09 unknown 1, and SPIKE-08 unknown 4. Every factual claim is grounded in a first-party source, cited inline. Anything Microsoft has not published is marked UNKNOWN with the query or test that would resolve it. This spike feeds `docs/reference/model-catalog-foundry-local.md` and ADR-0018; it authorizes no deployment and no spend.

Grounding read first: `SPIKE-08` (device SDK assessment, unknown 4 on per-model licences), `SPIKE-09` (Azure Local assessment, unknown 1 on a vision-capable model), `SPIKE-18` (Windows Server track, unknown 6 on licences), `SPIKE-19` (Azure Local layers, unknown 1 on vision), `docs/reference/model-catalog.md` (the prose-catalog style this must feed), and `ADR-0017` decision 5 (the premise under test). This spike verifies and corrects against first-party sources; it does not restate those documents.

**Headline: ADR-0017 decision 5's stated premise is refuted, but its chosen outcome survives.** Tracks 2 and 3 do not differ only in "execution provider and deployment mechanics, not in model identity." They diverge in model identity, in both directions, and the divergence is large: track 3 carries 100 catalog entries that track 2 cannot run at all, and track 2 carries NPU and generic-GPU variants that track 3 never syncs. One shared page is still the right answer, because the two per-track columns the ADR already specified are exactly the mechanism that expresses the divergence. What must change is the rationale and the page's internal structure, not the page count.

---

## Question

Eight questions, four of them inherited unknowns and four new:

1. What models are in the Foundry Local catalog today? Enumerate them, with publisher, parameter size, quantization, on-disk size, and RAM requirement.
2. What variants and execution providers exist per model, and what is the naming convention for the variant suffix?
3. **The load-bearing one: do the track 2 device SDK and the track 3 `Microsoft.Foundry` inference operator draw from the same catalog, or do they materially diverge?**
4. Is any catalog entry vision-capable (image input)? (SPIKE-09 unknown 1, SPIKE-19 unknown 1)
5. Are there embedding models? Speech-to-text beyond Whisper? Confirm there is no image generation and no text to speech.
6. What is the licence on each model, and are any non-commercial or otherwise restricted? (SPIKE-08 unknown 4, SPIKE-18 unknown 6)
7. How are models versioned and retired, and is there a deprecation policy comparable to the Azure cloud catalog's?
8. For track 3: what does a `ModelDeployment` look like, which fields are required, and which catalog models run on ONNX-GenAI versus vLLM?

---

## Findings

### Q1. The catalog is enumerable, and it is 170 entries in two disjoint halves

Microsoft's own documentation says the catalog is not published exhaustively on Learn: "This table isn't exhaustive. The full catalog includes many additional model families, sizes, variants, and publishers, and is updated regularly," and both Learn pages point at one canonical list, `aka.ms/FL_Models`. Source: [Model catalog and sourcing in Foundry Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog), [Generative small language models in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-models).

`aka.ms/FL_Models` resolves (HTTP 301) to a Microsoft-published catalog snapshot in the Azure-Samples organization: [Azure-Samples/foundry-local-model-catalog, MODEL_CATALOG.md](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md). Its own header states **"Snapshot date (UTC): 2026-07-28"** and its columns are Alias, Display Name, Publisher, Task, Framework, Compute, Execution Provider, Model ID. This is the closest thing to a complete first-party enumeration that exists, and it is what this spike enumerates. Treat it as authoritative for *identity* and explicitly **not** authoritative for size or licence, because it carries neither column.

The snapshot contains **170 entries**, split cleanly by the `source` field the operator's own transform records:

| Half | Entries | Source | Framework | Publisher field | Compute values | Tasks |
|---|---|---|---|---|---|---|
| ONNX | 70 | `foundry-local` | `ONNX` | `Microsoft` on every row | `CPU` or `GPU` | chat-completion, automatic-speech-recognition |
| vLLM | 100 | `foundry` | `vllm` | not populated | not populated | chat-completion, automatic-speech-recognition |

The 70 ONNX entries are exactly **35 aliases, each present twice**, once as `-generic-cpu` and once as `-cuda-gpu`. The two-source split is documented behaviour, not an artifact: catalog-sync "gets model metadata for each enabled source. For **foundry-local**, it paginates per device type (CPU, GPU). For **foundry**, it paginates once without device filters and applies the model allowlist," then "deduplicates by a composite key (source + alias + compute + version)." Source: [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog).

**On size and RAM, the honest answer is that almost none of it is published.** The catalog metadata carries the fields (`fileSizeBytes` per variant in the ConfigMap; `fileSizeMb` on the device SDK's `GET /foundry/list`), but no first-party document tabulates them. Exactly three on-disk figures exist in the documentation set:

| Entry | On-disk size | Source |
|---|---|---|
| `Phi-4-mini-instruct-generic-cpu:5` | `fileSizeBytes: 5153960755` (Microsoft rounds it to "~4.8 GB") | [Model catalog and sourcing, catalog JSON](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog) |
| `Phi-4-mini-instruct-cuda-gpu:5` | `fileSizeBytes: 3865470566` ("~3.6 GB") | same |
| `phi-3.5-mini` (device SDK download) | "2.53 GB" | [Get started with Foundry Local (Windows AI)](https://learn.microsoft.com/windows/ai/foundry-local/get-started) |

Two things follow. First, **the CPU variant is larger than the GPU variant of the same model** (4.8 GB versus 3.6 GB), which is the opposite of the intuition most sizing conversations start from, and it is worth stating on the catalog page. Second, everything else is UNKNOWN and is a one-command query rather than a research problem. Track 3: the `kubectl` recipe Microsoft publishes emits ALIAS, DEVICE, SIZE, MODEL_ID straight from the ConfigMap. Track 2: `foundry model info <model>`. Both are documented. Sources: [Model catalog and sourcing, Query the catalog](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog), [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli).

**On RAM there is no per-model figure at all for CPU inference on either track.** What exists is GPU memory for five vLLM models and node-level minimums for track 3:

| Model | Max context length | Recommended minimum GPU generation | Required GPU memory |
|---|---|---|---|
| Phi-3.5-mini-instruct | 29,472 | Ampere (CC 8.0)+ | 8.428 GB |
| Phi-4-mini-instruct | 93,520 | Ampere (CC 8.0)+ | 7.806 GB |
| Phi-4-mini-reasoning | 93,520 | Ampere (CC 8.0)+ | 7.806 GB |
| Mistral-7B-Instruct-v0.2 | 29,328 | Ampere (CC 8.0)+ | 15.64 GB |
| gpt-oss-20b | 96,784 | Blackwell (CC 10.0)+ | 14.793 GB |

Source: [Generative small language models](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-models), with per-GPU settings and throughput benchmarks in [vLLM runtime model reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models). Note that all five benchmark tables are measured on one card, an NVIDIA A10 (Ampere, SM 8.0), including for gpt-oss-20b whose *recommended* generation is Blackwell. Those benchmarks are GPU numbers and say nothing about the CPU path, so SPIKE-18 unknown 2 and SPIKE-19 unknown 7 stay open.

**Parameter size and quantization are likewise not catalog fields.** Parameter counts are recoverable from the model names themselves for most entries (`qwen2.5-7b`, `qwen3-0.6b`, `gpt-oss-20b`), and quantization is recoverable only for the vLLM half, where it is encoded in the entry name (`-fp8`, `-bf16`, `-nvfp4`, `-nvfp4-qad`). The ONNX half publishes no quantization label anywhere; Microsoft says only that "ONNX Runtime supports quantized models" and that the foundry-local entries "are optimized for on-device inference quantization." Sources: [Foundry Local architecture overview](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture), [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog). The precise quantization of, say, `Phi-4-mini-instruct-generic-cpu` is UNKNOWN.

One caveat that matters more than it looks: **the `publisher` field reads `Microsoft` on all 70 ONNX rows**, including the Qwen, DeepSeek, Mistral, OpenAI, AI2, and NVIDIA models. Microsoft is the publisher of the ONNX conversion, not the originating lab. Any catalog page that prints the `publisher` field as "who made this model" will be wrong on 25 of 35 rows, and any licence reasoning that starts from it will be wrong too.

### Q2. Variants, execution providers, and the suffix convention

The observed variant suffix is `{acceleration}-{device}`, appended to the model name: `-generic-cpu`, `-cuda-gpu`, `-generic-gpu`, `-qnn-npu`, `-vitis-npu`. The full ID adds an integer version after a colon, for example `Phi-4-mini-instruct-generic-cpu:5`.

**No first-party page states this as a rule.** It is inferred, with high confidence, from three converging sources: every one of the 70 ONNX catalog IDs follows it ([snapshot](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md)); Microsoft's own examples use it (`qwen2.5-0.5b-instruct-generic-cpu`, `Phi-4-mini-instruct-cuda-gpu`, `deepseek-r1-distill-qwen-1.5b-generic-cpu`) in the [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli) and the [REST reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest); and the two dimensions match Olive's compile parameters exactly, `--device cpu|gpu|npu` and `--provider CPUExecutionProvider|CUDAExecutionProvider`, in [Compile Hugging Face models to run on Foundry Local](https://learn.microsoft.com/azure/foundry-local/how-to/how-to-compile-hugging-face-models). That page notably does **not** publish a naming rule: it names a compiled model `llama-3.2:1` through an `inference_model.json` `Name` field with a free-form comment ("set the model name as you like, the default version is 1"), which means a BYO model is under no obligation to follow the convention at all. Anything that parses the suffix to infer capability is therefore safe for catalog entries and unsafe for BYO entries. Recorded as UNKNOWN 10.

The **device SDK** (track 2) supports seven execution providers, which are also the legal `--filter provider=` values:

| Execution provider (filter value) | Device | Platform | Licence terms |
|---|---|---|---|
| `CPUExecutionProvider` (MLAS) | CPU | Windows, Linux, macOS | Built in, no additional terms named |
| `WebGpuExecutionProvider` (Dawn) | GPU | Windows, Linux, macOS | Built in, no additional terms named |
| `CUDAExecutionProvider` | GPU | Windows, Linux | NVIDIA SDK EULA |
| `NvTensorRTRTXExecutionProvider` | GPU | Windows | NVIDIA SDK EULA |
| `OpenVINOExecutionProvider` | CPU, GPU, NPU (Intel) | Windows | Intel OBL Distribution Commercial Use License Agreement v2025.02.12 |
| `QNNExecutionProvider` | NPU (Qualcomm Hexagon) | Windows | Qualcomm Neural Processing SDK licence, readable only by downloading the SDK and opening `LICENSE.pdf` |
| `VitisAIExecutionProvider` | NPU (AMD) | Windows | "No additional license required" |

Source: [Foundry Local CLI reference, Execution providers](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli), with the device and platform mapping in [Foundry Local architecture overview, Hardware abstraction](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture). The device filter accepts `CPU`, `GPU`, or `NPU`, negation with `!`, and alias wildcards; only one filter per command. CUDA additionally requires "an NVIDIA GeForce RTX 30 series and later with a minimum recommended driver version 32.0.15.5585 and CUDA version 12.5."

Variant selection is automatic when you pass an alias: "Selects the best model for your available hardware automatically ... if you have a supported NPU available, Foundry Local selects the NPU model," and "when multiple model ID variants are available for an alias, the model list shows the models in priority order. The first model in the list is the model that runs when you specify the model by `alias`." Pass a full model ID to pin a variant. Source: [Foundry Local CLI reference, Model commands](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). The REST API exposes a per-request override too: `ep` accepts `"dml"`, `"cuda"`, `"qnn"`, `"cpu"`, `"webgpu"`. Source: [Foundry Local REST API reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest).

The **track 3 operator** supports exactly two: `CPUExecutionProvider` and `CUDAExecutionProvider` on the ONNX half, and nothing at all on the vLLM half, where the execution provider column is unpopulated because it is "(managed by vLLM)." Source: [Model catalog and sourcing, Example: Same model, multiple catalog entries](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog), and the snapshot itself.

### Q3. They materially diverge, in both directions, and the divergence is not small

This is the question ADR-0017 decision 5 gated on. Answering it plainly:

**Both products consume the same upstream registry.** The device SDK "integrates with the Foundry Catalog for model acquisition," a "cloud-hosted model registry" providing "hardware-optimized model variants: pre-compiled ONNX models tuned for specific hardware configurations (CPU, GPU, NPU)." Track 3's catalog-sync "gets model metadata from the Foundry API." Same upstream. Sources: [Foundry Local architecture overview](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture), [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog).

**But each product consumes a different projection of it, and the two projections are not close.**

| Dimension | Track 2 (device SDK) | Track 3 (inference operator) |
|---|---|---|
| Sources consumed | `foundry-local` only (ONNX) | `foundry-local` **and** `foundry` (vLLM), 70 + 100 entries |
| Device types synced | CPU, GPU, **NPU** | CPU, GPU only ("paginates per device type (CPU, GPU)") |
| Execution providers | 7 (CPU, WebGPU, CUDA, TensorRT, OpenVINO, QNN, VitisAI) | 2 (CPU, CUDA), plus vLLM-managed |
| Runtime | ONNX Runtime, in-process | ONNX Runtime GenAI **or** vLLM, in a container |
| Largest model | Largest ONNX entry is `gpt-oss-20b` | `mistral-large-3-675b-instruct-2512`, `nemotron-3-super-120b-a12b`, `gpt-oss-120b` |
| Vision-capable entries | None found | 4 (see Q4) |
| BYO path | Compile your own ONNX | OCI artifact from any ORAS-compatible registry |

Concretely:

- **100 catalog entries exist on track 3 that track 2 cannot run.** The entire vLLM half. vLLM is GPU-only and container-hosted; it has no device-SDK equivalent. This includes every model above roughly 20B parameters, the whole NVIDIA Nemotron program (Nemotron-3 Nano/Super, OpenCodeReasoning, OpenMath, OpenReasoning, AceReason, AceMath, Nemotron Terminal), the large Mistral line (Mixtral 8x7B and 8x22B, Mistral Large 3 675B, Mistral Small 3.x and 4, Magistral, Devstral, Ministral, Mathstral, Pixtral), DeepSeek V3.x, `gpt-oss-120b`, and `olmo-3.1-32b-instruct`. Sources: the snapshot; [Inference runtimes in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes) for vLLM being GPU-only.
- **Track 2 has variant classes track 3 never sees.** NPU entries (`-qnn-npu`, `-vitis-npu`) and generic-GPU entries (`-generic-gpu`, WebGPU) are real on the device: they are first-class filter values, the SDK selects "a QNN NPU variant on Snapdragon," and the plugin EP table exists specifically to acquire them. Track 3's catalog-sync paginates CPU and GPU only, so no NPU entry can enter the ConfigMap, and no NPU hardware is in the Azure Local GPU support matrix anyway. Sources: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli), [Get started with Foundry Local (Windows AI)](https://learn.microsoft.com/windows/ai/foundry-local/get-started), [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog).
- **The shared core is real and it is the ONNX half.** 35 aliases, each with a `-generic-cpu` and a `-cuda-gpu` entry, identical IDs and version numbers, same upstream source name. This is the part where ADR-0017's "differ in execution provider and deployment mechanics, not in model identity" is true. It is true of about a third of track 3's catalog and an unquantified fraction of track 2's.

**Verdict on the premise: refuted as written.** The identity sets differ, substantially, and in both directions.

**Verdict on the decision: one page, not three.** Splitting into `model-catalog-foundry-local-windows-server.md` and `model-catalog-foundry-local-azure-local.md` would duplicate 35 alias rows verbatim across two files, which is precisely the drift ADR-0017 decision 2 forbids elsewhere in the same document. The per-track columns the ADR already specified are the correct mechanism, and they become load-bearing rather than decorative: `Track 2` and `Track 3` cells that read `yes` / `yes`, `no` / `yes (vLLM, GPU)`, and `yes (NPU variants)` / `no` carry the whole finding. What the ADR should amend is the sentence explaining *why* one page suffices, plus a structural requirement that the page be sectioned into a shared ONNX core, a track-3-only vLLM roster, and a track-2-only variant note.

One more asymmetry worth recording because it changes what the page can promise: **the track 2 catalog is not enumerable from documentation.** The snapshot at `aka.ms/FL_Models` is explicitly titled for Azure Local and is a dump of the operator's ConfigMap. The device-side browsable catalog Microsoft points at, [foundrylocal.ai/models](https://www.foundrylocal.ai/models), is client-rendered and returns "0 models found" to a plain fetch. So the track 2 column can be filled with certainty only where a device-side doc names a model, and everywhere else it is an inference from the shared source name. This is called out as UNKNOWN 2 rather than papered over.

### Q4. Yes, there are vision-capable entries, and they are track 3 only

SPIKE-09 unknown 1 and SPIKE-19 unknown 1 asked whether any catalog model can grade a generated image. **Answer: four entries in the current catalog are vision-language models, all of them on the vLLM half, therefore track 3 only and GPU only.**

| Entry (display name) | Alias | Framework | Task field |
|---|---|---|---|
| `mistralai-Pixtral-12B-2409:1` | `pixtral-12b-2409` | vllm | chat-completion |
| `nvidia-NVIDIA-Nemotron-Nano-12B-v2-VL-BF16:1` | `nemotron-nano-12b-v2-vl-bf16` | vllm | chat-completion |
| `nvidia-NVIDIA-Nemotron-Nano-12B-v2-VL-FP8:1` | `nemotron-nano-12b-v2-vl-fp8` | vllm | chat-completion |
| `nvidia-NVIDIA-Nemotron-Nano-12B-v2-VL-NVFP4-QAD:1` | `nemotron-nano-12b-v2-vl-nvfp4-qad` | vllm | chat-completion |

Source: [Azure-Samples/foundry-local-model-catalog, MODEL_CATALOG.md](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md), snapshot 2026-07-28. Also present is the Nemotron Omni family (`nemotron-3-nano-omni-30b-a3b-reasoning` in bf16, fp8, and nvfp4), whose "Omni" naming indicates multi-modality.

Two caveats, stated rather than glossed:

- **The vision claim rests on model identity, not on a Microsoft capability statement.** "Pixtral" and the `-VL` suffix identify these as vision-language models by construction, but Microsoft's catalog `task` field says `chat-completion` for all four, and no Foundry Local page documents image input. So *the model is vision-capable* is well founded; *the Foundry Local operator's `/v1/chat/completions` accepts image content parts* is not documented and stays UNKNOWN.
- **Track 2 has no vision entry.** The device REST API documents `content` on a chat message as "(string) The actual message text," with no content-part array and no image field, and the ONNX half of the catalog contains no VL entry. Source: [Foundry Local REST API reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest).

Net for the repo's image-grading reviewer question: **the on-premises vision reviewer is possible on track 3 with a GPU node pool and the vLLM runtime, and impossible on track 2.** That is a real change from SPIKE-09's position, and it re-imposes the GPU gate ADR-0014 relaxed, for that one workload only.

### Q5. No embeddings, no text to speech, no image generation. Speech to text goes beyond Whisper

**Definitively, from the full snapshot: the catalog contains exactly two task values, `chat-completion` and `automatic-speech-recognition`.** No row carries an embedding, text-to-speech, image-generation, or text-to-image task. Source: [MODEL_CATALOG.md](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md), snapshot 2026-07-28.

The API surfaces agree on both tracks. Track 2's REST API documents exactly two inference endpoints, `POST /v1/chat/completions` and `POST /v1/audio/transcriptions`, plus catalog and cache management; there is no `/v1/embeddings`, no `/v1/images/generations`, and no `/v1/audio/speech`. Track 3's operator exposes `/v1/chat/completions` for generative and `/v1/predict` for predictive workloads. Sources: [Foundry Local REST API reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest), [Inference operator and model lifecycle](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator).

Two corroborating first-party signals. Microsoft's own summary of the device catalog is that "the catalog covers chat completions ... and audio transcription (for example, Whisper)." And Agentic Retrieval, the RAG product built on this stack, does not source a language model from the catalog at all: "Agentic Retrieval doesn't include any language models. You must provide your own LLM endpoint." Sources: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local), [Choose your language model for Agentic Retrieval](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/prepare-language-model).

**A caveat on embeddings specifically, so this is not over-claimed.** SPIKE-09 recorded that Agentic Retrieval's "combined" mode needs two GPU VMs for a knowledge layer doing text and image embedding. Those embedding models are components of the Agentic Retrieval extension, not entries in the Foundry Local model catalog, and this spike found no first-party document naming them. If an embedding model is a requirement, the path is Agentic Retrieval or a BYO ONNX model, not a catalog entry.

**Speech to text does go beyond Whisper**, which corrects a standing assumption in SPIKE-08 and SPIKE-09. The ASR set is 11 aliases, 22 entries (CPU and GPU each):

| Alias | Family |
|---|---|
| `whisper-tiny`, `whisper-base`, `whisper-small`, `whisper-medium`, `whisper-large-v3-turbo` | OpenAI Whisper, ONNX, both tracks |
| `nemotron-speech-streaming-en-0.6b`, `nemotron-speech-streaming-es-0.6b`, `nemotron-3.5-asr-streaming-0.6b` | NVIDIA streaming ASR, ONNX, both tracks |

The Whisper five also appear on the vLLM half. Source: [MODEL_CATALOG.md](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md). Note that the streaming Nemotron ASR models are ONNX and CPU-capable, which makes streaming transcription a genuine track 2 capability on a GPU-less host, and note equally that **transcription is the inverse of what this repo's narration pipeline needs**, so none of this changes the SPIKE-08 conclusion that MAI-Voice-2 has no local substitute.

### Q6. Licences: the field exists on both tracks, the values are published for exactly one model

This is SPIKE-18 unknown 6 and SPIKE-08 unknown 4, and it closes only partially.

**What is established:**

- **The catalog carries a licence per model, on both tracks.** Track 3: catalog-sync's transform records "model ID, alias, display name, publisher, **license**, task type, variants with compute type and file size, framework, and version." Track 2: `GET /foundry/list` returns `license` ("The license type under which the model is distributed") and `licenseDescription` ("A detailed description or link to the license terms") per model, and the CLI exposes `foundry model info <model> --license`. Sources: [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog), [Foundry Local REST API reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest), [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli).
- **Exactly one model's licence value is published.** All three `Phi-4-mini-instruct` catalog entries carry `"license": "MIT"` in the JSON Microsoft reproduces "directly from the catalog ConfigMap." Source: [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog).
- **The published snapshot has no licence column at all.** It carries Alias, Display Name, Publisher, Task, Framework, Compute, Execution Provider, Model ID and nothing else. So the canonical enumeration cannot answer the licence question for any of the other 169 entries.
- **The execution providers carry their own licences, separately from the models, and one of them is genuinely awkward.** CUDA and TensorRT bind the NVIDIA SDK EULA. OpenVINO binds the "Intel OBL Distribution Commercial Use License Agreement v2025.02.12." Vitis AI needs "no additional license required." And QNN's terms are not readable without an unrelated download: "To view the QNN License, download the Qualcomm Neural Processing SDK, extract the ZIP, and open the LICENSE.pdf file." Source: [Foundry Local CLI reference, Plugin execution providers](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). A track 2 deployment on Snapdragon hardware therefore cannot complete a licence review from published material alone.
- **Microsoft's own instruction is to read the licence before use, per model.** Its best-practice guidance directs you to `foundry model info <model> --license`. Source: [Best practices and troubleshooting guide for Foundry Local CLI](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice).

**What is not established, and must not be guessed:** the licence on the other 169 entries. It is tempting to fill the column from upstream model cards (Apache 2.0 for the Qwen and Mistral lines, MIT for the DeepSeek R1 distills, and so on) and this spike deliberately does not, for two reasons. First, those are not first-party Microsoft sources, which this repo's rules require. Second, and more practically, **the `publisher` field says `Microsoft` on all 70 ONNX rows**, meaning the artifact you download is Microsoft's ONNX build of an upstream model, and whether the ONNX build carries the upstream licence unchanged is exactly the question a licence review has to answer. Reasoning from the upstream card would answer a different question than the one asked.

So: **no catalog model is confirmed non-commercial or restricted, and none is confirmed permissive either, except `Phi-4-mini-instruct` which is MIT.** The unknown is carried forward with a one-command resolution, which is a materially better position than SPIKE-18 left it in, because the command and the field name are now both confirmed and the EP licences are fully enumerated.

### Q7. Versioning is explicit and mechanical. There is no deprecation policy

**Versioning is well specified.** Every catalog entry has an integer `modelVersion` and its full ID is `<displayName>:<version>` (`Phi-4-mini-instruct-generic-cpu:5`). Dedup is on the composite key source + alias + compute + version, so the same alias legitimately holds several versions and several computes at once. A `ModelDeployment` pins with `model.catalog.version`, which "defaults to `latest`." The device SDK's download call requires the version suffix explicitly: "Note that the version suffix must be supplied in the model name," against an `azureml://registries/azureml/models/<name>/versions/<n>` URI. The device catalog is described as offering "version-aware updates: the catalog tracks model versions and pulls updates when newer versions are available," and plugin execution providers "automatically update when new versions are available." Sources: [Model catalog and sourcing](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog), [ModelDeployment and operator configuration reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator), [Foundry Local REST API reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest), [Foundry Local architecture overview](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture), [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli).

Versions do move independently per variant. In the current snapshot `qwen3-4b-generic-cpu` is at `:3` while `qwen3-4b-cuda-gpu` is at `:2`, and `Phi-3-mini-4k-instruct-generic-cpu` is at `:3` while its CUDA sibling is at `:2`. A registry that pins one version per alias will be wrong for one of the two variants.

**Retirement is not specified anywhere.** No Foundry Local page in either doc set (device or Azure Local) states a model deprecation policy, a support window, a notice period, or a retirement schedule. The `whats-new` page for Foundry Local on Azure Local records feature releases for extension versions `2605` and `2606` and mentions no model addition or removal at all. Contrast the hosted catalog, which has a published lifecycle with legacy, deprecated, and retired states, minimum durations in each, a 12-month GA availability commitment, and a dated retirement schedule. Sources: [What's new in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/whats-new), and for the contrast, [Model retirement schedule, Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/model-lifecycle-retirement) and [Foundry Models lifecycle and support policy](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirements).

**And the absence is not theoretical: models have already gone.** Microsoft's own Agentic Retrieval page still lists as available `llama3.2:1b`, `llama3.2:3b`, and `llama3.1:8b`, none of which appear anywhere in the 2026-07-28 catalog snapshot, and lists `phi-3-mini-4k-instruct-generic-cpu:2`, `phi-3.5-mini-instruct-generic-cpu:1`, and `qwen2.5-0.5b-instruct-generic-cpu:3` where the snapshot now carries `:3`, `:2`, and `:4`. Source: [Choose your language model for Agentic Retrieval](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/prepare-language-model) against [MODEL_CATALOG.md](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md). Whether the Llama entries were removed, renamed, or never existed on this catalog is UNKNOWN, but either way a Microsoft page names models the catalog does not have, with no retirement notice, which is the practical definition of no policy.

Two consequences for this repo. First, **pin versions explicitly rather than taking `latest`**, on both tracks, or a six-hourly catalog sync can change the artifact under a running deployment. Second, **the Foundry Local catalog page must carry a snapshot date and the query that regenerates it**, because unlike the cloud catalog there is no deprecation announcement to react to; the only way to know a model is gone is to look.

### Q8. `ModelDeployment` for track 3, and the ONNX-versus-vLLM split

**Required fields are three**, and everything else has a default:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `model` | object | **Yes** | | Set exactly one of `ref`, `catalog`, or `custom` |
| `model.catalog.name` | string | Conditional | | Catalog model name, for example `Phi-4-mini-instruct-generic-cpu` |
| `model.catalog.version` | string | No | `latest` | Pin this |
| `workloadType` | string | **Yes** | | `generative` or `predictive` |
| `compute` | string | **Yes** | | `cpu` or `gpu` |
| `runtime` | string | No | `onnx-genai` | `onnx-genai` or `vllm`; vLLM requires `compute: gpu` |
| `replicas` | integer | No | `1` | 1 to 100 |
| `port` | integer | No | `8080` | 1024 to 65535 |
| `resources.requests.cpu` / `.memory` | string | No | `100m` / `256Mi` | **Far too small for any real model** |
| `resources.limits.cpu` / `.memory` | string | No | `1000m` / `1Gi` | **Far too small; a 4.8 GB model will not run** |
| `resources.limits.gpu` | integer | No | | 0 to 8 |
| `vllm.modelCacheStorageGi` | integer | No | `100` | GiB; "large models, such as `magistral`, can exceed this size" |
| `vllm.epp.enabled` | boolean | No | replica-based | Defaults true when `replicas > 1`, false at 1, and re-evaluates on scaling |
| `endpoint.exposure` | string | No | `internal` | `internal`, `external`, or `none` |
| `nodeSelector`, `tolerations`, `skipGpuResource`, `env` | | No | | `skipGpuResource: true` requires `nodeSelector` |

Source: [ModelDeployment and operator configuration reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator). A minimal catalog deployment is therefore four lines of spec:

```yaml
spec:
  model:
    catalog:
      name: Phi-4-mini-instruct-generic-cpu
      version: "5"
  workloadType: generative
  compute: cpu
```

with explicit `resources` added, because the defaults cannot run the model. Catalog models need no `Model` CR: "The Model CRD is for BYO (custom) models only. Catalog models are resolved from the catalog ConfigMap and do not use this CRD."

**Which models run on which engine is decided by the catalog, not by the operator's `runtime` field.** Each entry carries a `framework` (`ONNX` or `vllm`), and "the operator reads the framework from the catalog and automatically selects the correct container image and configuration. You don't need to set the runtime manually for catalog models." Source: [Inference runtimes in Foundry Local on Azure Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes). So:

- **ONNX-GenAI usable:** the 70 `foundry-local` entries, 35 aliases. `-generic-cpu` entries take `compute: cpu`; `-cuda-gpu` entries take `compute: gpu`. This is the only engine available for a GPU-less cluster.
- **vLLM usable:** the 100 `foundry` entries, plus BYO. GPU only. "vLLM requires GPU compute."
- **Predictive:** BYO only. "Predictive workloads don't support catalog models."

The image-selection matrix the operator uses is published in full, and it is worth mirroring on the catalog page because it is what turns a row into a running pod: generative + CPU + catalog + onnx-genai gives `generative-cpu`; generative + GPU + catalog + onnx-genai gives `generative-gpu`; generative + GPU + any + vllm gives `vllm_gpu`; the custom equivalents are the `-byo (ORAS)` images; predictive is BYO images only. Source: [Model catalog and sourcing, Image selection](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog).

---

## The catalog table for `docs/reference/model-catalog-foundry-local.md`

Columns as ADR-0017 decision 5 specifies. Status uses this repo's catalog vocabulary (`docs/reference/model-catalog.md`): **nothing here is `deployed`**, because neither track has a deployment. Everything in the catalog and deployable in principle is `available`.

Two structural notes. Sizes are `UNKNOWN` on all but three rows because the published snapshot carries no size column, and the resolution is a query, not research (Q1). Licences are `UNKNOWN` on all but one row for the same reason (Q6), and must not be back-filled from upstream model cards.

### Table A: the shared ONNX core (35 aliases, 70 entries, both tracks)

Every row has both a `-generic-cpu` and a `-cuda-gpu` entry with the same base name. Publisher is the catalog's `publisher` field, which reads `Microsoft` on every row and means "publisher of the ONNX build," not the originating lab; the originating lab is given in parentheses where it differs. Source for every row is the [catalog snapshot dated 2026-07-28](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md) unless a second source is named.

| Model (alias) | Publisher (field / origin) | Variant and execution provider | Track 2 | Track 3 | Size and RAM | Licence | Status | Source |
|---|---|---|---|---|---|---|---|---|
| `phi-4-mini` | Microsoft / Microsoft | `Phi-4-mini-instruct-generic-cpu:5` CPUExecutionProvider; `Phi-4-mini-instruct-cuda-gpu:5` CUDAExecutionProvider | yes | yes (`onnx-genai`, cpu or gpu) | 4.8 GB CPU, 3.6 GB GPU; GPU memory 7.806 GB (vLLM entry); RAM UNKNOWN | **MIT** | available | [catalog concept](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog) |
| `phi-4-mini-reasoning` | Microsoft / Microsoft | `Phi-4-mini-reasoning-generic-cpu:3`; `Phi-4-mini-reasoning-cuda-gpu:3` | yes | yes | UNKNOWN; GPU memory 7.806 GB (vLLM entry) | UNKNOWN | available | snapshot, [SLM page](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-models) |
| `phi-4` | Microsoft / Microsoft | `Phi-4-generic-cpu:2`; `Phi-4-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `phi-3.5-mini` | Microsoft / Microsoft | `Phi-3.5-mini-instruct-generic-cpu:2`; `Phi-3.5-mini-instruct-cuda-gpu:2` | yes | yes | 2.53 GB device download; GPU memory 8.428 GB (vLLM entry) | UNKNOWN | available | snapshot, [Windows get-started](https://learn.microsoft.com/windows/ai/foundry-local/get-started) |
| `phi-3-mini-4k` | Microsoft / Microsoft | `Phi-3-mini-4k-instruct-generic-cpu:3`; `-cuda-gpu:2` (version skew) | yes | yes | UNKNOWN; 3.8B params | UNKNOWN | available | snapshot, [Agentic Retrieval model list](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/prepare-language-model) |
| `phi-3-mini-128k` | Microsoft / Microsoft | `Phi-3-mini-128k-instruct-generic-cpu:3`; `-cuda-gpu:2` | yes | yes | UNKNOWN; 3.8B params | UNKNOWN | available | snapshot |
| `gpt-oss-20b` | Microsoft / OpenAI (open weight) | `gpt-oss-20b-generic-cpu:1`; `gpt-oss-20b-cuda-gpu:1` | yes | yes | UNKNOWN on ONNX; GPU memory 14.793 GB and Blackwell CC 10.0+ recommended on the vLLM entry | UNKNOWN | available | snapshot, [vLLM model reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models) |
| `qwen3-0.6b` | Microsoft / Alibaba | `qwen3-0.6b-generic-cpu:4`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen3-1.7b` | Microsoft / Alibaba | `qwen3-1.7b-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen3-4b` | Microsoft / Alibaba | `qwen3-4b-generic-cpu:3`; `-cuda-gpu:2` (version skew) | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen3-8b` | Microsoft / Alibaba | `qwen3-8b-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen3-14b` | Microsoft / Alibaba | `qwen3-14b-generic-cpu:2`; `-cuda-gpu:2` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen3.5-2b-text` | Microsoft / Alibaba | `qwen3.5-2b-text-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen2.5-0.5b` | Microsoft / Alibaba | `qwen2.5-0.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN; 0.5B params | UNKNOWN | available | snapshot, [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli) |
| `qwen2.5-1.5b` | Microsoft / Alibaba | `qwen2.5-1.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN; 1.5B params | UNKNOWN | available | snapshot |
| `qwen2.5-7b` | Microsoft / Alibaba | `qwen2.5-7b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen2.5-14b` | Microsoft / Alibaba | `qwen2.5-14b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen2.5-coder-0.5b` | Microsoft / Alibaba | `qwen2.5-coder-0.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen2.5-coder-1.5b` | Microsoft / Alibaba | `qwen2.5-coder-1.5b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen2.5-coder-7b` | Microsoft / Alibaba | `qwen2.5-coder-7b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `qwen2.5-coder-14b` | Microsoft / Alibaba | `qwen2.5-coder-14b-instruct-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `deepseek-r1-7b` | Microsoft / DeepSeek | `deepseek-r1-distill-qwen-7b-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `deepseek-r1-14b` | Microsoft / DeepSeek | `deepseek-r1-distill-qwen-14b-generic-cpu:4`; `-cuda-gpu:4` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `mistral-7b-v0.2` | Microsoft / Mistral AI | `mistralai-Mistral-7B-Instruct-v0-2-generic-cpu:3`; `-cuda-gpu:2` | yes | yes | UNKNOWN; GPU memory 15.64 GB on the vLLM entry | UNKNOWN | available | snapshot, [vLLM model reference](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models) |
| `mistral-nemo-12b-instruct` | Microsoft / Mistral AI and NVIDIA | `mistral-nemo-12b-instruct-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `olmo-3-7b-instruct` | Microsoft / Allen Institute for AI | `olmo-3-7b-instruct-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `smollm3-3b` | Microsoft / Hugging Face | `smollm3-3b-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN | UNKNOWN | available | snapshot |
| `whisper-tiny` | Microsoft / OpenAI | `openai-whisper-tiny-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) | snapshot, [REST reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest) |
| `whisper-base` | Microsoft / OpenAI | `openai-whisper-base-generic-cpu:3`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) | snapshot |
| `whisper-small` | Microsoft / OpenAI | `openai-whisper-small-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) | snapshot |
| `whisper-medium` | Microsoft / OpenAI | `openai-whisper-medium-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) | snapshot |
| `whisper-large-v3-turbo` | Microsoft / OpenAI | `openai-whisper-large-v3-turbo-generic-cpu:4`; `-cuda-gpu:3` | yes | yes | UNKNOWN | UNKNOWN | available (ASR) | snapshot |
| `nemotron-speech-streaming-en-0.6b` | Microsoft / NVIDIA | `nemotron-speech-streaming-en-0.6b-generic-cpu:3`; `-cuda-gpu:1` | yes | yes | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) | snapshot |
| `nemotron-speech-streaming-es-0.6b` | Microsoft / NVIDIA | `nemotron-speech-streaming-es-0.6b-ft-generic-cpu:1`; `-cuda-gpu:1` | yes | yes | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) | snapshot |
| `nemotron-3.5-asr-streaming-0.6b` | Microsoft / NVIDIA | `nemotron-3.5-asr-streaming-0.6b-generic-cpu:3`; `-cuda-gpu:2` | yes | yes | UNKNOWN; 0.6B params | UNKNOWN | available (ASR) | snapshot |

**Track 2 caveat on every row of Table A:** `yes` means the entry comes from the `foundry-local` source the device SDK also consumes, and the device docs name several of these aliases directly (`phi-3.5-mini`, `phi-4`, `qwen2.5-0.5b`, `qwen2.5-7b`, `deepseek-r1-7b`, `whisper-tiny`, `whisper-base`, `whisper-small`, plus the model IDs `Phi-4-mini-instruct-generic-cpu`, `qwen2.5-coder-0.5b-instruct-generic-cpu`, `deepseek-r1-distill-qwen-1.5b-generic-cpu`). It does **not** mean each row has been observed in a device-side `foundry model list`, which is UNKNOWN 2. Sources: [Windows get-started](https://learn.microsoft.com/windows/ai/foundry-local/get-started), [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli), [REST reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest).

**Two device-side entries the Azure Local catalog does not have.** The device CLI reference names `deepseek-r1-distill-qwen-1.5b-generic-cpu` and the alias `phi4-cpu` as sample filter values; neither appears in the 2026-07-28 Azure Local snapshot. Both are documentation samples rather than catalog dumps, so this is suggestive of further track 2 breadth, not proof of it. Recorded in UNKNOWN 2.

### Table B: the track-3-only vLLM roster (100 entries, GPU only)

Grouped by family, with every alias named. Publisher, compute, and execution provider are unpopulated on all 100 rows in the snapshot; framework is `vllm` and task is `chat-completion` except where noted. Track 2 is `no` on every row, because vLLM is a GPU-only container runtime with no device-SDK equivalent ([Inference runtimes](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes)). Track 3 is `yes (vllm, compute: gpu)` on every row. Size, RAM, and licence are UNKNOWN on every row except the five with published GPU memory figures. Source for every row is the [catalog snapshot dated 2026-07-28](https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md).

| Family | Aliases | Notes | Status |
|---|---|---|---|
| Microsoft Phi | `phi-4`, `phi-4-reasoning`, `phi-4-mini-instruct`, `phi-4-mini-reasoning`, `phi-3.5-mini-instruct` | GPU memory published for three of these (Q1). `phi-4-reasoning` has **no ONNX entry**, so it is track 3 only | available |
| OpenAI open weight | `gpt-oss-20b`, `gpt-oss-120b` | `gpt-oss-120b` is track 3 only. `gpt-oss-20b` is Microsoft's recommended model for Agentic Retrieval and "requires its own GPU" | available |
| DeepSeek | `deepseek-r1-distill-qwen-1.5b`, `-7b`, `-14b`, `deepseek-v3-0324`, `deepseek-v3.1`, `deepseek-v3.2`, `deepseek-v3.2-speciale` | The V3 line is track 3 only and very large | available |
| Qwen | `qwen2.5-0.5b-instruct`, `-1.5b-instruct`, `-7b-instruct`, `-14b-instruct`, `qwen2.5-coder-0.5b/1.5b/7b/14b-instruct`, `qwen3-0.6b`, `-1.7b`, `-8b`, `-14b`, `-32b` | `qwen3-32b` is track 3 only | available |
| Mistral AI, dense | `mistral-7b-instruct-v0.2`, `-v0.3`, `mistral-nemo-instruct-2407`, `mistral-nemo-instruct-fp8-2407`, `mistral-small-24b-instruct-2501`, `mistral-small-3.1-24b-instruct-2503`, `mistral-small-3.2-24b-instruct-2506`, `mistral-small-4-119b-2603`, `mistral-small-4-119b-2603-nvfp4`, `mistral-large-3-675b-instruct-2512` | `mistral-large-3-675b` is the largest entry in the catalog | available |
| Mistral AI, MoE and specialist | `mixtral-8x7b-instruct-v0.1`, `mixtral-8x22b-instruct-v0.1`, `magistral-small-2506`, `-2507`, `-2509`, `devstral-small-2505`, `-2507`, `mathstral-7b-v0.1`, `ministral-3-3b-instruct-2512`, `ministral-3-8b-instruct-2512`, `ministral-3-14b-reasoning-2512` | Microsoft names `magistral` as a model that exceeds the 100 GiB `vllm.modelCacheStorageGi` default | available |
| Mistral AI, vision | `pixtral-12b-2409` | **Vision-language.** See Q4 | available |
| NVIDIA Nemotron, vision | `nemotron-nano-12b-v2-vl-bf16`, `-fp8`, `-nvfp4-qad` | **Vision-language.** See Q4 | available |
| NVIDIA Nemotron, omni | `nemotron-3-nano-omni-30b-a3b-reasoning-bf16`, `-fp8`, `-nvfp4` | Multi-modal by name; capability surface not documented | available |
| NVIDIA Nemotron, general | `nemotron-nano-9b-v2`, `-fp8`, `-nvfp4`, `-japanese`, `nemotron-nano-12b-v2`, `nemotron-3-nano-4b-bf16`, `-fp8`, `nemotron-3-nano-30b-a3b-bf16`, `-nvfp4`, `nemotron-3-super-120b-a12b-bf16`, `-fp8`, `-nvfp4`, `nemotron-4-mini-hindi-4b-instruct` | Quantization is encoded in the alias | available |
| NVIDIA Nemotron, code | `opencodereasoning-nemotron-7b`, `-14b`, `-32b`, `-32b-ioi`, `opencodereasoning-nemotron-1.1-7b`, `-1.1-14b`, `-1.1-32b`, `nemotron-terminal-8b`, `-14b`, `-32b` | | available |
| NVIDIA Nemotron, math and reasoning | `openmath-nemotron-1.5b`, `-7b`, `-14b`, `-14b-kaggle`, `-32b`, `openreasoning-nemotron-1.5b`, `-7b`, `-14b`, `-32b`, `acereason-nemotron-7b`, `-14b`, `acereason-nemotron-1.1-7b`, `acemath-rl-nemotron-7b` | | available |
| Allen Institute for AI | `olmo-3-7b-instruct`, `olmo-3.1-32b-instruct` | `olmo-3.1-32b` is track 3 only | available |
| Hugging Face | `smollm3-3b` | | available |
| OpenAI Whisper (ASR) | `whisper-tiny`, `whisper-base`, `whisper-small`, `whisper-medium`, `whisper-large-v3-turbo` | task `automatic-speech-recognition` | available (ASR) |
| NVIDIA streaming ASR | `nemotron-speech-streaming-en-0.6b` | task `automatic-speech-recognition` | available (ASR) |

### Table C: what track 2 has that track 3 does not

| Variant class | Suffix | Execution provider | Track 2 | Track 3 | Source |
|---|---|---|---|---|---|
| Qualcomm NPU | `-qnn-npu` | `QNNExecutionProvider` | yes (Snapdragon X Elite / X Plus, driver 30.0.140.0+) | **no**, catalog-sync paginates CPU and GPU only | [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli), [catalog concept](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog) |
| AMD NPU | `-vitis-npu` | `VitisAIExecutionProvider` | yes (Adrenalin 25.6.3 to 25.9.1) | **no** | as above |
| Intel NPU and GPU | (per model) | `OpenVINOExecutionProvider` | yes (Intel TigerLake+/AlderLake+/ArrowLake+) | **no** | as above |
| Generic GPU (WebGPU/Dawn) | `-generic-gpu` | `WebGpuExecutionProvider` | yes, the GPU fallback, cross-platform | **no** | as above |
| NVIDIA TensorRT RTX | (per model) | `NvTensorRTRTXExecutionProvider` | yes (RTX 30 series+) | **no** | as above |

The specific NPU model list is UNKNOWN (unknown 2): it is not enumerable from documentation, and Microsoft's own guidance is to run `foundry model list --filter device=NPU` on the target hardware.

---

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | **Per-model licence for 169 of the 170 catalog entries.** Carried from SPIKE-08 unknown 4 and SPIKE-18 unknown 6, now narrowed rather than closed. | The catalog metadata carries a `license` field on both tracks, but the published snapshot has no licence column and Learn publishes only the `Phi-4-mini-instruct` value (MIT). | Track 2: `foundry model info <model> --license`. Track 3: read `.license` from the `foundry-local-catalog` ConfigMap with the published `kubectl` plus `jq` recipe. Both are read-only and need no deployment on track 2, only an installed CLI. **Do not back-fill from upstream model cards:** the `publisher` field reads `Microsoft` on all ONNX rows, so the artifact is a Microsoft ONNX build and the licence question is about that build. |
| 2 | **The exact track 2 catalog, especially the NPU and generic-GPU variants.** | `aka.ms/FL_Models` publishes the Azure Local operator's ConfigMap, not the device catalog. The device browser at `foundrylocal.ai/models` is client-rendered and returns no rows to a plain fetch. | Run `foundry model list`, then `--filter device=NPU`, `--filter provider=QNNExecutionProvider`, `--filter provider=VitisAIExecutionProvider`, and `--filter provider=WebGpuExecutionProvider` on real hardware. Note the last three need matching silicon to be meaningful. On the GPU-less Server host from SPIKE-18, `foundry model list --filter device=!GPU` is the useful call. Requires the owner-authorized install SPIKE-18 recommendation 5 already scopes. |
| 3 | **On-disk size and RAM for all but three entries.** | The published snapshot carries no size column; the field exists in the metadata but is not tabulated anywhere. | Track 3: the published ConfigMap query already emits ALIAS, DEVICE, SIZE, MODEL_ID. Track 2: `foundry model info <model>`, or `GET /foundry/list` which returns `fileSizeMb`. Neither is a research question. |
| 4 | **RAM required to actually run a given model on CPU.** | No first-party per-model RAM figure exists for the ONNX CPU path on either track. Only GPU memory for five vLLM models, and node-level minimums for track 3. | Measure. This is the same measurement SPIKE-18 unknown 2 and SPIKE-19 unknown 7 already scope, and one run produces the RAM number and the tokens-per-second number together. |
| 5 | **Quantization of the ONNX entries.** | Encoded in the alias on the vLLM half (`-fp8`, `-bf16`, `-nvfp4`) and published nowhere for the ONNX half. | Inspect `genai_config.json` in a downloaded model's cache directory, or read `modelSettings.parameters` from `GET /foundry/list`. |
| 6 | **Whether the operator's `/v1/chat/completions` accepts image content parts for the four vision entries.** | The models are vision-language by identity, but the catalog `task` field says `chat-completion` for all four and no Foundry Local page documents image input on either track. | Deploy `pixtral-12b-2409` or a `nemotron-nano-12b-v2-vl-*` entry on a GPU node pool with `runtime: vllm` and post an OpenAI-format message with an `image_url` content part. Needs a GPU node pool, so it is gated behind ADR-0014's GPU increment. |
| 7 | **Whether any model retirement or deprecation policy exists for this catalog.** | No Foundry Local page in either doc set states one, and `whats-new` records feature releases only. Meanwhile a current Microsoft page lists `llama3.2:1b`, `llama3.2:3b`, and `llama3.1:8b` as available, none of which is in the 2026-07-28 snapshot. | Ask Microsoft through the preview onboarding channel, and in the meantime treat the absence as the answer: pin versions, snapshot-date the catalog page, and diff the snapshot rather than waiting for a notice. |
| 8 | **Whether the vLLM half is available on a disconnected Azure Local cluster.** | The disconnected expansion pack is documented as bundling the networking stack, Istio, CRDs, and the EPP image; nothing states which catalog entries reach the local `edgeartifacts` registry. | Read the disconnected preparation guide's expansion pack manifest at design time, or ask during preview onboarding. Only matters if the disconnected path is in scope. |
| 9 | **Which embedding models Agentic Retrieval's knowledge layer uses.** | They are components of that extension, not catalog entries, and are not named in the pages reviewed. | Read the Agentic Retrieval architecture and requirements pages at design time. Not required for a chat-only reviewer increment. |
| 10 | **Whether the `{acceleration}-{device}` variant suffix is a guaranteed convention or merely an observed pattern.** | No first-party page states it as a rule. It holds on all 70 ONNX catalog IDs and matches Olive's `--device` and `--provider` dimensions, but the compile guidance lets a BYO model take any name. | Ask Microsoft, or treat it as an observed pattern: parse the suffix for catalog entries only, and carry compute and execution provider as explicit registry fields rather than deriving them from the name. The second option is cheaper and removes the dependency, so prefer it in ADR-0018. |

Unknowns 1, 2, 3, and 5 all close from the same owner-authorized track 2 install that SPIKE-18 already scopes, plus one `kubectl` call once a track 3 cluster exists. Unknowns 4 and 6 need real hardware. Unknowns 7, 8, and 9 are questions for Microsoft, not measurements. Unknown 10 is designed away rather than answered, by carrying compute and execution provider as registry fields.

---

## Recommendation

1. **Amend ADR-0017 decision 5's rationale, keep its outcome.** The sentence "Tracks 2 and 3 draw from the same Foundry Local catalog and differ in execution provider and deployment mechanics, not in model identity" is refuted: the identity sets differ by 100 entries in one direction and by an entire class of NPU and generic-GPU variants in the other. Replace it with the true reason one page still works: the two per-track columns the same decision already specified are exactly the mechanism that expresses divergence, and a split would duplicate 35 shared rows across two files, which decision 2 of the same ADR forbids elsewhere. Per ADR-0017 decision 10's own principle, amend by annotation rather than by silent edit.

2. **Structure `docs/reference/model-catalog-foundry-local.md` in three sections, not one flat table.** Shared ONNX core (Table A, 35 aliases, both tracks), track-3-only vLLM roster (Table B, 100 entries, GPU only), and track-2-only variant classes (Table C, NPU and generic-GPU). A single flat table hides the finding that makes the page worth having.

3. **Put a snapshot date and the regenerating query at the top of the page, and treat it as mandatory.** There is no deprecation policy for this catalog (Q7), and Microsoft's own pages already name models the catalog no longer carries. A dated snapshot plus `kubectl get cm foundry-local-catalog ...` and `foundry model list` is the only honest way to publish it. This is a stronger requirement than the cloud catalog page carries, and the reason should be stated on the page.

4. **Leave the licence column `UNKNOWN` rather than filling it from upstream model cards, and say why on the page.** Only `Phi-4-mini-instruct` has a first-party licence value. The `publisher` field says `Microsoft` on all 70 ONNX rows, so what is being licensed is Microsoft's ONNX build. Add the execution-provider licence table from Q2 as a separate block, because those terms are fully documented, they bind independently of the model, and one of them (QNN) cannot be read without downloading an unrelated SDK. That is a real finding for anyone considering track 2 on Snapdragon hardware.

5. **Record in the registry that version pinning is per variant, not per alias.** `qwen3-4b` is `:3` on CPU and `:2` on GPU; `phi-3-mini-4k` is `:3` and `:2`. ADR-0018's schema work should therefore carry the version on the variant, not on the model. Default to an explicit pin, never `latest`, because catalog-sync runs every six hours by default and there is no retirement notice to warn you.

6. **Close SPIKE-09 unknown 1 and SPIKE-19 unknown 1 as answered, with a condition.** A vision-capable local model exists (`pixtral-12b-2409` and three `nemotron-nano-12b-v2-vl-*` quantizations), on track 3 only, vLLM only, GPU only. Record this as an amendment to ADR-0014: its CPU-first first increment stands, and the on-premises image-grading reviewer specifically re-imposes the GPU gate ADR-0014 relaxed. Whether the endpoint accepts image input remains unknown 6 and is the one test that would settle it.

7. **Close SPIKE-08 unknown 4 and SPIKE-18 unknown 6 as narrowed, not resolved.** The command, the field name, and the execution-provider licences are all now confirmed first-party. The per-model values are one command away on either track. Fold that command into the track 2 install test SPIKE-18 recommendation 5 already scopes, so the licence read costs nothing extra.

8. **Record on the targets hub that the Foundry Local catalog is materially larger than SPIKE-08 and SPIKE-09 concluded, and still contains nothing this repo's generation backbone needs.** Both prior spikes described the catalog from a representative-sample table of about a dozen models; it is 170 entries including a 675B Mistral, a 120B Nemotron, `gpt-oss-120b`, four vision-language models, and eight ASR models. That materially strengthens the on-premises reviewer case on track 3. It changes nothing about image generation, video, or text to speech, which remain absent by task type, confirmed against the full catalog rather than a sample.

## Verdict: one shared catalog page, with the ADR's rationale corrected

Stated plainly, because the tasking asks the question that gates a decision:

**Do not split into three catalogs.** The shared ONNX core is 35 aliases and 70 entries with identical IDs and versions on both tracks, and duplicating it across two files to express a divergence that two table columns already express would trade one maintained page for two drifting ones.

**Do correct the premise in the record.** ADR-0017 decision 5 says the split becomes three "if SPIKE-22 finds the device SDK and the Azure Local operator catalogs materially diverge." They do diverge materially. The conditional was written on the assumption that divergence implies a split, and that assumption does not hold here, because the divergence is asymmetric and expressible: track 3 is a superset in model identity, track 2 is a superset in variant class, and both facts fit in the `Track 2` and `Track 3` cells. Leaving the ADR's stated premise standing when the research refutes it would be exactly the silent staleness ADR-0017 was written to stop.

**The one thing this spike cannot deliver is a complete track 2 column.** The Azure Local catalog is published as a dated snapshot; the device catalog is not published in any fetchable form. Every `yes` in the track 2 column of Table A is grounded in the shared `foundry-local` source name plus, for a dozen rows, a direct mention in the device docs. That is a defensible basis for a catalog page, and it is not the same as an observed `foundry model list`. The page should say so, and unknown 2 should stay open until the owner-authorized install runs.

---

## Sources

First-party Microsoft Learn unless noted. Retrieved 2026-07-30.

- Model catalog and sourcing in Foundry Local on Azure Local (catalog-sync behaviour and per-source device pagination, dedup key, ConfigMap query recipes, BYO resolution, the representative catalog table, three model reference forms, image-selection matrix, runtimes, and the full Phi-4-mini three-entry JSON with sizes and the MIT licence): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog>
- Foundry Local model catalog snapshot, the target of `aka.ms/FL_Models` (Microsoft-published, Azure-Samples organization; snapshot date 2026-07-28; the 170 entries, aliases, display names, publisher, task, framework, compute, execution provider, and model IDs enumerated in Tables A and B): <https://github.com/Azure-Samples/foundry-local-model-catalog/blob/main/MODEL_CATALOG.md>
- Generative small language models in Foundry Local on Azure Local (SLM definition and parameter range, the five-model context-length and GPU-memory table, pointer to the full catalog): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-models>
- vLLM runtime model reference for Foundry Local (per-model GPU generation requirements, recommended utilization, context length, required GPU memory, and A10 throughput benchmarks for Phi-3.5-mini, Phi-4-mini-instruct, Phi-4-mini-reasoning, Mistral-7B-Instruct-v0.2, gpt-oss-20b): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-models>
- ModelDeployment and operator configuration reference for Foundry Local (full spec field table with required flags and defaults, `model.catalog.version` default `latest`, resource defaults, `vllm.modelCacheStorageGi` and the `magistral` note, EPP defaults, endpoint exposure, Model CRD being BYO only, operator image and catalog configuration): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator>
- Inference runtimes in Foundry Local on Azure Local (runtime inferred from the catalog framework field, vLLM GPU-only): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes>
- Inference operator and model lifecycle in Foundry Local on Azure Local (CRDs, lazy registration, endpoints, predictive workloads): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-operator>
- What's new in Foundry Local on Azure Local (extension versions 2606 and 2605, feature history, no model additions or retirements recorded): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/whats-new>
- Foundry Local CLI reference (model commands, alias versus model ID selection, model list ordering and filtering, the device / provider / task / alias filter keys and their legal values, negation and wildcards, built-in and plugin execution providers with their licence terms and hardware requirements, `foundry model info --license`): <https://learn.microsoft.com/azure/foundry-local/reference/reference-cli>
- Foundry Local REST API reference (the two inference endpoints and the absence of embeddings, image generation, and speech synthesis; chat message `content` documented as a string; the `ep` override values; `GET /foundry/list` field list including `fileSizeMb`, `license`, `licenseDescription`, `supportsToolCalling`; the `azureml://registries/azureml/models/.../versions/N` download URI and the requirement to supply the version suffix): <https://learn.microsoft.com/azure/foundry-local/reference/reference-rest>
- Foundry Local architecture overview (Foundry Catalog as a cloud-hosted registry, hardware-optimized variants for CPU, GPU, and NPU, version-aware updates, the execution provider and device table, quantized-model support, model lifecycle): <https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture>
- Use the Foundry Local CLI (preview) (catalog browsing, `--filter device=`, alias-based automatic variant selection, cache management): <https://learn.microsoft.com/azure/foundry-local/how-to/how-to-use-foundry-local-cli>
- Get started with Foundry Local (Windows AI) (the `phi-3.5-mini` 2.53 GB download figure, common aliases, alias-based hardware variant selection naming QNN NPU and CUDA, the pointer to foundrylocal.ai/models): <https://learn.microsoft.com/windows/ai/foundry-local/get-started>
- Compile Hugging Face models and run on Foundry Local (Olive `--device cpu|gpu|npu` and `--provider`, the `precision` values `fp16` / `fp32` / `int4` / `int8`, and the free-form `inference_model.json` `Name` field that leaves BYO model naming unconstrained): <https://learn.microsoft.com/azure/foundry-local/how-to/how-to-compile-hugging-face-models>
- Best practices and troubleshooting guide for Foundry Local CLI (preview) (read the per-model licence before use, encrypt caches, slow CPU inference guidance): <https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice>
- What is Foundry Local? (catalog scope stated as chat completions plus audio transcription, curated-catalog rationale, no Azure subscription): <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>
- Choose your language model for Agentic Retrieval in Foundry Local (Agentic Retrieval ships no models, the CPU and GPU model lists including the `llama3.x` entries absent from the current catalog, the older `:1` / `:2` / `:3` version suffixes, gpt-oss-20b recommendation and vLLM requirement for tool calling): <https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/prepare-language-model>
- What you need for Agentic Retrieval in Foundry Local (gpt-oss-20b requiring its own GPU): <https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements>
- Model retirement schedule, Microsoft Foundry (the hosted-catalog lifecycle this catalog has no equivalent of): <https://learn.microsoft.com/azure/foundry/concepts/model-lifecycle-retirement>
- Foundry Models lifecycle and support policy (legacy, deprecated, and retired states with minimum durations, and the 12-month GA availability commitment): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirements>
- Foundry Local models browser, named by the Windows quickstart as the full device catalog. Returns "0 models found" to a plain fetch because the listing is client-rendered, which is why unknown 2 stays open: <https://www.foundrylocal.ai/models>

Local, this repo: `docs/research/SPIKE-08-foundry-local-on-device.md` (unknown 4), `docs/research/SPIKE-09-azure-local-foundry.md` (unknown 1), `docs/research/SPIKE-18-foundry-local-windows-server.md` (unknown 6), `docs/research/SPIKE-19-foundry-local-azure-local-deployment.md` (unknown 1), `docs/adr/ADR-0017-deployment-target-documentation-structure.md` (decision 5, the premise under test), `docs/reference/model-catalog.md` (the status vocabulary and prose-catalog style this feeds).
