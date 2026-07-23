# SPIKE-08: Foundry Local (on-device inferencing)

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no software installed, no model API called. Documentation and first-party source review only.
Date: 2026-07-22
Scope: independent, first-party assessment of Microsoft's **Foundry Local** on-device inferencing runtime as a possible deployment target alongside the cloud Azure AI Foundry (AIServices) path this repo already runs. Grounds every factual claim in a Microsoft source, cited inline. Anything Microsoft has not published is marked UNKNOWN with the test that would resolve it.

Grounding documents read first: the model roster (current and planned model roster), `ai/research/SPIKE-01-image-model.md`, and `ai/research/SPIKE-02-voice-model.md`. This spike does not restate the cloud plans; it evaluates a distinct runtime.

A note on naming: two different Microsoft products share the "Foundry Local" name. This spike is about **Foundry Local**, the device-side SDK and runtime (Windows, macOS, Linux, no Azure subscription). A separate product, **Foundry Local on Azure Local**, is an Arc-enabled Kubernetes inference stack for on-premises servers with an Entra identity and governance story. Where the distinction matters it is called out explicitly, because they answer the CAF/WAF question very differently.

---

## Question

Six questions from the tasking, answered against Microsoft Learn:

1. What Foundry Local actually is: official name, supported OS (Windows Server specifically), install method, and whether any Azure subscription is required.
2. Model catalog fit: which roster models (MAI-Image-2.5, the FLUX family, MAI-Voice-2, `gpt-5.6-terra`, `grok-4-1-fast-reasoning`, Sora) have a Foundry Local build.
3. Hardware and runtime requirements, and whether Windows Server changes anything.
4. Integration surface: local endpoint shape, SDK languages, fit against a `tools/*.mjs` publish pipeline.
5. Cost and licensing: what is genuinely free vs gated.
6. Where this fits the CAF/WAF-governed cloud methodology already built here.

---

## Findings

### Q1. What Foundry Local is, supported OS, install, subscription

- **Official product and description.** Foundry Local is "an end-to-end local AI solution for shipping applications that run entirely on the user's device." It provides an SDK (C#, JavaScript, Rust, Python), a curated catalog of optimized models, and automatic hardware acceleration, built on [ONNX Runtime](https://onnxruntime.ai/). The runtime adds about 20 MB to an application package. Source: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local).
- **No Azure subscription required, runs offline.** "Foundry Local runs entirely on local hardware. No Azure subscription is required." Once a model is downloaded and cached, inference runs entirely on-device with no cloud dependency; the only network use is the initial model and execution-provider download and optional catalog metadata refreshes (which fall back to the cached catalog when offline). Source: [What is Foundry Local?, FAQ](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions), [Windows AI FAQ, does Foundry Local work offline](https://learn.microsoft.com/windows/ai/faq#does-foundry-local-work-offline).
- **Supported platforms, as published: "Windows, macOS (Apple silicon), and Linux."** Source: [What is Foundry Local?, FAQ](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions). The Windows quickstart lists its own prerequisites: "Windows 11, version 24H2 (build 26100) or later," ".NET 9.0 SDK or later," and "A DirectX 12-capable GPU (integrated or discrete). The WinML package uses hardware acceleration and requires real GPU hardware; virtual machines without GPU passthrough are not supported." Source: [Get started with Foundry Local (Windows AI)](https://learn.microsoft.com/windows/ai/foundry-local/get-started).
- **Windows Server is not named either way.** No first-party page in this review states that Foundry Local is supported, or unsupported, on Windows Server specifically. The generic "Windows" claim and the quickstart's "Windows 11 24H2 (build 26100)" wording do not resolve it. This repo's own host is Windows Server 2025 Datacenter Azure Edition, build 26100 (same build number as the named client minimum), but that is not a documented support statement. Treated as UNKNOWN below.
- **Install method.** Windows: `winget install Microsoft.FoundryLocal`. macOS: `brew tap microsoft/foundrylocal` then `brew install foundrylocal`. An installer is also downloadable from the [foundry-local installer link](https://aka.ms/foundry-local-installer). Admin rights are required to install. The CLI is in **public preview**. Sources: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli), [Use the Foundry Local CLI (preview)](https://learn.microsoft.com/azure/foundry-local/how-to/how-to-use-foundry-local-cli).
- **Three consumption modes.** (1) In-process SDK (the core product): the app loads a native library (`.dll` on Windows) and calls it directly, no HTTP. (2) Optional OpenAI-compatible REST server for HTTP clients and tools like LangChain or Open WebUI. (3) CLI for exploration and cache management. Source: [Foundry Local architecture overview](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture).

### Q2. Model catalog fit for this repo's roster

The single most load-bearing fact: **the Foundry Local curated catalog covers chat completions and audio transcription only.** "The catalog covers chat completions (for example, GPT OSS, Qwen, DeepSeek, Mistral, and Phi) and audio transcription (for example, Whisper)." Source: [What is Foundry Local?, Features](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#features). The REST API exposes exactly two inference endpoints, `POST /v1/chat/completions` and `POST /v1/audio/transcriptions` (Whisper, speech-to-text). Source: [Foundry Local REST API Reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest).

There is **no image-generation endpoint and no text-to-speech (synthesis) endpoint** documented for Foundry Local. Whisper is transcription (audio in, text out), the opposite direction from MAI-Voice-2. The catalog is deliberately curated and skews to small open-weight language models; Microsoft states it "doesn't support every available model" by design. Source: [What is Foundry Local?, FAQ](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions).

Per-model verdict for this repo's roster (the model roster):

| Roster model | Modality | Runs on Foundry Local today | Source |
|---|---|---|---|
| MAI-Image-2.5 | image generation | **Does not.** No image-generation endpoint or catalog category. | [Features](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#features), [REST API](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest) |
| FLUX.2-pro | image generation | **Does not.** Same reason; not a Microsoft-published open-weight ONNX catalog model. | as above |
| FLUX.1-Kontext-pro | image generation | **Does not.** | as above |
| FLUX-1.1-pro | image generation | **Does not.** | as above |
| MAI-Voice-2 | text-to-speech synthesis | **Does not.** Catalog audio is Whisper transcription (STT), not synthesis (TTS). | [Features](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#features), [REST API audio/transcriptions](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest) |
| gpt-5.6-terra | reasoning / vision (hosted, proprietary) | **Does not.** Foundry Local carries the open-weight `gpt-oss-20b`, not OpenAI's hosted GPT-5.x line. | [Model catalog](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog) |
| grok-4-1-fast-reasoning | reasoning / vision (hosted, proprietary) | **Does not.** xAI proprietary; not in the curated open-weight catalog. | [Features](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#features) |
| Sora / Sora 2 | video generation | **Does not.** No video generation in Foundry Local. | [Features](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#features) |

**Net: none of the eight roster models runs on Foundry Local today.** Say it plainly: the overlap is zero for the generative image, voice, and video work, which is the core of this repo.

The one adjacent-fit area is the **reasoning / reviewer LLM role** (currently `gpt-5.6-terra` and `grok-4-1-fast-reasoning`, both PLANNED and GATED). Those two exact models are not available, but Foundry Local's catalog does carry comparable **local open-weight reasoning models** that could fill a "second eyes" reviewer role without a cloud call: `gpt-oss-20b` (OpenAI open-weight), DeepSeek R1 Distill Qwen 7B/14B, Qwen2.5 14B Instruct, and the Phi-4 family, all ONNX-runtime catalog entries. Source: [Model catalog and sourcing in Foundry Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog). Whether any of these matches the review quality of the planned frontier reviewer pair is not something the docs can answer; it is a quality question, not a compatibility one, and it would be a deliberately different (weaker, but local and free) tool rather than a drop-in. See Recommendation.

### Q3. Hardware and runtime requirements

- **Execution-provider matrix (device SDK).** Foundry Local abstracts hardware and picks the best execution provider automatically. Published matrix:

  | Execution provider | Device | Platform |
  |---|---|---|
  | NVIDIA CUDA | GPU | Windows, Linux |
  | WebGPU (via Dawn) | GPU | Windows, Linux, macOS |
  | AMD Vitis | NPU | Windows |
  | Qualcomm (QNN) | NPU | Windows |
  | Intel OpenVINO | GPU | Windows |
  | CPU | CPU | Windows, Linux, macOS |

  "The CPU execution provider is always available as a fallback. If no GPU or NPU is detected, Foundry Local runs inference on the CPU automatically." Source: [Foundry Local architecture overview, Hardware abstraction](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture#hardware-abstraction).
- **The Windows WinML package needs real GPU hardware.** The Windows quickstart is explicit: the WinML package "requires real GPU hardware; virtual machines without GPU passthrough are not supported." The cross-platform `Microsoft.AI.Foundry.Local` package "omits the Windows-specific hardware acceleration," i.e. it can fall back to CPU. Sources: [Get started with Foundry Local (Windows AI)](https://learn.microsoft.com/windows/ai/foundry-local/get-started), [Get started, create a project](https://learn.microsoft.com/windows/ai/foundry-local/get-started#create-a-project).
- **Implication for this repo's Azure VM host.** This repo's environment is an Azure VM (Windows Server 2025 Datacenter Azure Edition) with no stated GPU. On such a host: the WinML accelerated path is unsupported (no GPU passthrough), and the only route would be the cross-platform CPU package running quantized models on CPU. CPU-only inference of a 7B-to-20B model is functional but slow, and Microsoft positions Foundry Local for "hardware-constrained devices where a single user accesses the model at a time," not server workloads (see Q6). Whether the CPU package even installs and runs on Windows Server is UNKNOWN (Q1).
- **Server-class sizing is documented only for the other product.** The "1 x NVIDIA GPU, >= 24 GB VRAM, 32 GB RAM" sizing for GPT-OSS-20B is from **Foundry Local on Azure Local** (the Kubernetes product), not the device SDK. Source: [Agentic Retrieval requirements](https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements#minimum-vm-hardware-requirements). Do not read that number as a device-SDK requirement; the device SDK has no published minimum-VRAM table, but its models are quantized specifically to run on consumer hardware including CPU fallback.
- **Windows-specific NPU note.** For an Intel NPU, the Intel NPU driver must be installed; for Qualcomm NPU, the Qualcomm driver. Not relevant to a GPU-less server, listed for completeness. Source: [Foundry Local CLI reference, prerequisites](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli).

### Q4. Integration surface

- **Local endpoint shape.** The optional server is OpenAI-compatible on a dynamic localhost port. `GET /openai/status` returns the binding, e.g. `{"Endpoints":["http://localhost:5272"], ...}`. Inference endpoints are `POST /v1/chat/completions` (OpenAI Chat Completions compatible) and `POST /v1/audio/transcriptions` (OpenAI audio transcription compatible, Whisper). Microsoft is explicit: "never hardcode the port," discover it via `manager.endpoint` (JS) or `config.Web.Urls` (C#). Source: [Foundry Local REST API Reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest).
- **SDK languages.** C# (`Microsoft.AI.Foundry.Local` NuGet), JavaScript (`foundry-local-sdk` npm), Python (`foundry-local-sdk` PyPI), Rust (`foundry-local-sdk` crate). On Windows the accelerated variants are `Microsoft.AI.Foundry.Local.WinML` (NuGet) and `foundry-local-sdk-winml` (npm/PyPI). Sources: [Architecture, Core API](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture#foundry-local-core-api), [Integrate inference SDKs](https://learn.microsoft.com/azure/foundry-local/how-to/how-to-integrate-with-inference-sdks).
- **Fit against a `tools/*.mjs` pipeline.** There is a JavaScript SDK, and the endpoint is OpenAI-compatible, so a Node pipeline step could talk to it exactly like any OpenAI-compatible base URL (the same pattern the docs show for Ollama, LM Studio, and vLLM). But the architecture is a **local always-on service or an in-process runtime**, not a stateless per-invocation cloud call: the service must be started (`foundry service status` / `startService()`), the model loaded into memory, and the (potentially multi-GB) model file cached on first use. That is a different operational shape from the current pipeline's invoke-per-run cloud REST calls, and it only matters at all for a **chat/reasoning** step, since there is no image or TTS endpoint to wire in (Q2). Sources: [REST API](https://learn.microsoft.com/azure/foundry-local/reference/reference-rest), [Architecture, optional REST API](https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture).

### Q5. Cost and licensing

- **No per-token cost, no backend, no subscription.** "There are no per-token costs and no backend infrastructure to maintain," and no Azure subscription is required; you pay only for the local hardware and its electricity. Sources: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local), [FAQ, Is an Azure subscription required?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions).
- **Per-model licenses still apply.** Each catalog model carries its own license terms; Microsoft directs you to `foundry model info <model> --license` to read them before use, and to encrypt disks caching sensitive fine-tuning data. Source: [Best practices and troubleshooting guide (preview)](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice). This is the only "gate," and it is a license-acceptance gate, not a billing one.
- **Preview status.** The Foundry Local CLI is in public preview: "Features, approaches, and processes can change or have limited capabilities, before General Availability." Source: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). Same preview-risk posture the owner already accepted for the cloud MAI models applies here.

### Q6. Fit with the CAF/WAF-governed cloud methodology

Foundry Local (the device SDK) sits **outside** the Azure control plane this repo's ADRs assume, so several governance layers simply do not apply, and forcing them would be wrong:

- **No Azure resource group, no CAF resource naming.** Nothing is provisioned in Azure; there is no `rg-...`, no AIServices resource, no deployment object to name. CAF naming conventions have no target here. Source: [FAQ, no Azure subscription](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions).
- **No cost-governance surface.** There is no token meter, no Cost Management line, no budget alert to set, because there is no billed usage. The cost story collapses to one-time hardware and local compute. The `$100/month` cap and budget-guard machinery from the voice/image ADRs do not map onto it.
- **No Entra identity / RBAC.** The CLI reference states plainly: "Azure RBAC: Not applicable (runs locally)." There is no managed identity, no key vault secret, no Entra app registration for the device SDK. Source: [Foundry Local CLI reference, prerequisites](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli).
- **What WAF pillars still apply, reframed.** Security shifts from cloud identity to device posture: run only on compliant devices, encrypt caches holding sensitive model data ([best practices](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice)). Reliability shifts to "is the local service running and the model cached." Cost optimization becomes trivially "free after hardware." Operational excellence and performance efficiency become local-service and hardware-acceleration concerns, not Azure ones.
- **The governance story exists only in the sibling product.** If a CAF/WAF-shaped local deployment were ever wanted (resource group equivalent, Entra ID auth, budgeting, RBAC), that is **Foundry Local on Azure Local**, the Arc-enabled Kubernetes product, which does support "API keys, Microsoft Entra ID authentication, and TLS-enabled gateway API patterns" and runs on GPU-backed cluster nodes, in preview by request. Source: [What is Foundry Local on Azure Local?](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview). It is a materially heavier build (Kubernetes, Arc, GPU nodes) than the device SDK and is out of scope for a single-repo media pipeline unless the initiative grows an on-prem cluster.

---

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | **Is the device SDK supported (or functional) on Windows Server, specifically Windows Server 2025 build 26100?** | Docs say "Windows" generically and name "Windows 11 24H2 (build 26100)" as the client minimum; no Windows Server statement either way. | Install the cross-platform (non-WinML) package on the Server host in a throwaway test and run `foundry service status` plus one `phi-4-mini` chat call. A clean success or an explicit unsupported-OS error settles it. Do not install until the owner authorizes software installation. |
| 2 | **CPU-only inference throughput on a GPU-less Azure VM for a 7B-to-20B reviewer model.** | The device SDK publishes no CPU latency/throughput table; the documented A10 GPU numbers are for the vLLM/Azure Local product. | Measure empirically after install: time a fixed reviewer prompt on `gpt-oss-20b` or `phi-4-reasoning` on CPU and judge whether latency is tolerable for a publish-time review step. |
| 3 | **Whether any local catalog reasoning model is good enough to substitute for the planned frontier reviewer pair.** | A quality question, not a compatibility one; docs cannot answer it. | A/B a local model (e.g. `gpt-oss-20b`) against `gpt-5.6-terra`/`grok-4-1-fast-reasoning` outputs on real review tasks once the cloud reviewers are deployed. |
| 4 | **Exact per-model license terms for any candidate reviewer model.** | Per-model, not summarized in one place. | `foundry model info <model> --license` at evaluation time. |

None of these blocks the recommendation below, because the recommendation does not depend on adopting Foundry Local now.

---

## Recommendation

1. **Do not open a Foundry Local track for the core media roster. The model overlap is zero.** Foundry Local generates no images, synthesizes no speech, and generates no video; its catalog is chat-completion and Whisper transcription only. MAI-Image-2.5, the three FLUX models, MAI-Voice-2, and Sora have no Foundry Local build and none is plausible near-term. The entire generative backbone of this repo stays on the cloud Azure AI Foundry path. No ADR is warranted for the image/voice/video work.
2. **Do not write a Foundry Local adoption ADR yet.** Per the tasking's own acceptance criterion, "no, the overlap is too thin to justify it yet" is the correct outcome. This spike is the record; it does not need a decision record behind it.
3. **Keep one narrow watch item: a local reviewer LLM as a future, optional, cost-free second-opinion arm.** The reviewer role (`gpt-5.6-terra`, `grok-4-1-fast-reasoning`) is the only place Foundry Local has any adjacency, via comparable local open-weight models (`gpt-oss-20b`, Phi-4-reasoning, DeepSeek R1 distill). This is worth revisiting only after the cloud reviewer pair is deployed and only if (a) a GPU-capable host exists, since the current Azure VM has no GPU and CPU-only large-model inference is slow, and (b) Windows Server support is confirmed (UNKNOWN #1). If both hold, a small spike-then-ADR could evaluate a local model as a free pre-filter before spending on the frontier reviewers. Until then it is a note, not a plan.
4. **If a local track is ever pursued, follow the same gate as every other model here: spike -> ADR -> design -> deploy gate.** And resolve UNKNOWN #1 (Windows Server support) and UNKNOWN #2 (CPU throughput) with a throwaway install test before any pipeline code, exactly as SPIKE-01/02 handled their unknowns. Note also that the CAF/WAF governance methodology does not transfer to the device SDK (no resource group, no Entra, no budget); if governance is a hard requirement, the relevant product is Foundry Local on Azure Local, a much larger Kubernetes/Arc build that is out of scope for this repo today.

Net: Foundry Local is a real, free, offline, OpenAI-compatible on-device runtime, but it is a language-model and speech-transcription tool, not an image/voice/video generation stack. It does not fit this repo's current roster. Record the finding, keep a single optional watch item for a local reviewer LLM, and take no deployment action.

---

## Sources

All first-party (Microsoft Learn), reviewed 2026-07-22:

- What is Foundry Local? (definition, platforms Windows/macOS/Linux, no Azure subscription, offline, features list of chat + Whisper, curated-catalog rationale, "can Foundry Local run on a server?"): <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>
- Foundry Local architecture overview (ONNX Runtime, Core API native library, hardware-abstraction execution-provider matrix, WinML on Windows, optional REST API, Foundry Catalog): <https://learn.microsoft.com/azure/foundry-local/concepts/foundry-local-architecture>
- Get started with Foundry Local (Windows AI) (Windows 11 24H2 build 26100 prerequisite, .NET 9, DirectX 12 GPU, WinML needs real GPU / no VM without passthrough, winget install, cross-platform vs WinML package): <https://learn.microsoft.com/windows/ai/foundry-local/get-started>
- Foundry Local CLI reference (winget/brew install, preview status, "Azure RBAC: Not applicable (runs locally)", NPU driver notes): <https://learn.microsoft.com/azure/foundry-local/reference/reference-cli>
- Use the Foundry Local CLI (preview) (browse catalog, filter by device/task/provider): <https://learn.microsoft.com/azure/foundry-local/how-to/how-to-use-foundry-local-cli>
- Foundry Local REST API Reference (only two inference endpoints: /v1/chat/completions and /v1/audio/transcriptions Whisper; dynamic localhost port; /openai/status): <https://learn.microsoft.com/azure/foundry-local/reference/reference-rest>
- Integrate inference SDKs with Foundry Local (C#/JS/Python/Rust packages, Windows WinML vs cross-platform packages, OpenAI-compatible): <https://learn.microsoft.com/azure/foundry-local/how-to/how-to-integrate-with-inference-sdks>
- Best practices and troubleshooting guide for Foundry Local CLI (preview) (per-model license via `foundry model info --license`, encrypt caches, CPU-heavy slow inference guidance): <https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice>
- Windows AI FAQ (offline behavior, hardware auto-selection, catalog scope): <https://learn.microsoft.com/windows/ai/faq>
- Model catalog and sourcing in Foundry Local (representative catalog: Phi-4, Mistral, DeepSeek R1 distill, Qwen2.5, gpt-oss-20b, Whisper; all chat/reasoning/transcription): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog>
- What is Foundry Local on Azure Local? (the separate Arc/Kubernetes product with Entra ID, API keys, TLS gateway, GPU nodes, preview by request): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview>
- Agentic Retrieval in Foundry Local, requirements (GPT-OSS-20B server sizing: 1x NVIDIA GPU >= 24 GB VRAM; note this is the Azure Local product, not the device SDK): <https://learn.microsoft.com/azure/azure-arc/agents-tools-foundry-local/requirements>
- Local, this repo: the model roster (roster: MAI-Image-2.5, FLUX.2-pro, FLUX.1-Kontext-pro, FLUX-1.1-pro, MAI-Voice-2, gpt-5.6-terra, grok-4-1-fast-reasoning, Sora); `ai/research/SPIKE-01-image-model.md`; `ai/research/SPIKE-02-voice-model.md`
