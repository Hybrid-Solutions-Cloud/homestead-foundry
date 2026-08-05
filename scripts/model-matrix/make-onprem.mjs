// The two on-premises rosters, transcribed from this repository's own reference
// pages, which were themselves produced by SPIKE-22 from the catalog snapshot
// dated 2026-07-28. Written as code rather than hand-keyed JSON so the shared
// core is expressed once and cannot drift between the two targets.

import fs from 'node:fs';
const OUT = process.argv[2];

const FL = 'foundry-local';
const ALF = 'azure-local-foundry';

const models = [];
const add = (alias, o) => models.push({ alias, ...o });

// ---- Section 1: the ONNX roster. 35 aliases, present on BOTH targets. ----
// Every one carries a -generic-cpu and a -cuda-gpu build under the same base
// name. This is the shared core the two on-premises targets have in common.
const ONNX = [
  ['phi-4-mini', 'Microsoft', 'chat', 'MIT', '4.8 GB CPU, 3.6 GB GPU'],
  ['phi-4-mini-reasoning', 'Microsoft', 'reasoning', 'UNKNOWN', null],
  ['phi-4', 'Microsoft', 'chat', 'UNKNOWN', null],
  ['phi-3.5-mini', 'Microsoft', 'chat', 'UNKNOWN', '2.53 GB device download'],
  ['phi-3-mini-4k', 'Microsoft', 'chat', 'UNKNOWN', '3.8B params'],
  ['phi-3-mini-128k', 'Microsoft', 'chat', 'UNKNOWN', '3.8B params'],
  ['gpt-oss-20b', 'OpenAI (open weight)', 'chat', 'UNKNOWN', null],
  ['qwen3-0.6b', 'Alibaba', 'chat', 'UNKNOWN', null],
  ['qwen3-1.7b', 'Alibaba', 'chat', 'UNKNOWN', null],
  ['qwen3-4b', 'Alibaba', 'chat', 'UNKNOWN', 'CPU/GPU version skew'],
  ['qwen3-8b', 'Alibaba', 'chat', 'UNKNOWN', null],
  ['qwen3-14b', 'Alibaba', 'chat', 'UNKNOWN', null],
  ['qwen3.5-2b-text', 'Alibaba', 'chat', 'UNKNOWN', null],
  ['qwen2.5-0.5b', 'Alibaba', 'chat', 'UNKNOWN', '0.5B params'],
  ['qwen2.5-1.5b', 'Alibaba', 'chat', 'UNKNOWN', '1.5B params'],
  ['qwen2.5-7b', 'Alibaba', 'chat', 'UNKNOWN', null],
  ['qwen2.5-14b', 'Alibaba', 'chat', 'UNKNOWN', null],
  ['qwen2.5-coder-0.5b', 'Alibaba', 'code', 'UNKNOWN', null],
  ['qwen2.5-coder-1.5b', 'Alibaba', 'code', 'UNKNOWN', null],
  ['qwen2.5-coder-7b', 'Alibaba', 'code', 'UNKNOWN', null],
  ['qwen2.5-coder-14b', 'Alibaba', 'code', 'UNKNOWN', null],
  ['deepseek-r1-7b', 'DeepSeek', 'reasoning', 'UNKNOWN', 'distilled onto Qwen'],
  ['deepseek-r1-14b', 'DeepSeek', 'reasoning', 'UNKNOWN', 'distilled onto Qwen'],
  ['mistral-7b-v0.2', 'Mistral AI', 'chat', 'UNKNOWN', '15.64 GB GPU memory on vLLM'],
  ['mistral-nemo-12b-instruct', 'Mistral AI and NVIDIA', 'chat', 'UNKNOWN', null],
  ['olmo-3-7b-instruct', 'Allen Institute for AI', 'chat', 'UNKNOWN', null],
  ['smollm3-3b', 'Hugging Face', 'chat', 'UNKNOWN', '3B params'],
  ['whisper-tiny', 'OpenAI', 'speech-to-text', 'UNKNOWN', null],
  ['whisper-base', 'OpenAI', 'speech-to-text', 'UNKNOWN', null],
  ['whisper-small', 'OpenAI', 'speech-to-text', 'UNKNOWN', null],
  ['whisper-medium', 'OpenAI', 'speech-to-text', 'UNKNOWN', null],
  ['whisper-large-v3-turbo', 'OpenAI', 'speech-to-text', 'UNKNOWN', null],
  ['nemotron-speech-streaming-en-0.6b', 'NVIDIA', 'speech-to-text', 'UNKNOWN', '0.6B params, streaming'],
  ['nemotron-speech-streaming-es-0.6b', 'NVIDIA', 'speech-to-text', 'UNKNOWN', '0.6B params, streaming'],
  ['nemotron-3.5-asr-streaming-0.6b', 'NVIDIA', 'speech-to-text', 'UNKNOWN', '0.6B params, streaming'],
];
for (const [alias, origin, modality, licence, note] of ONNX) {
  add(alias, { origin, modality, licence, note, targets: [FL, ALF], runtimes: ['onnx-genai (CPU or GPU)'] });
}

// ---- Section 2: the vLLM roster. GPU only, Azure Local Foundry ONLY. ----
// vLLM is a GPU-only container runtime with no device-SDK equivalent, so none of
// these run on Foundry Local. Aliases that also appear above gain a second
// runtime on the cluster target rather than a second row.
const VLLM = [
  // [alias, origin, modality, note]
  ['phi-4', 'Microsoft', 'chat', null],
  ['phi-4-reasoning', 'Microsoft', 'reasoning', 'no ONNX entry, cluster-exclusive'],
  ['phi-4-mini-instruct', 'Microsoft', 'chat', '93,520 context, 7.806 GB GPU, Ampere CC 8.0+'],
  ['phi-4-mini-reasoning', 'Microsoft', 'reasoning', '93,520 context, 7.806 GB GPU, Ampere CC 8.0+'],
  ['phi-3.5-mini-instruct', 'Microsoft', 'chat', '29,472 context, 8.428 GB GPU, Ampere CC 8.0+'],
  ['gpt-oss-20b', 'OpenAI (open weight)', 'chat', 'recommended for Agentic Retrieval; 96,784 context, 14.793 GB GPU, BLACKWELL CC 10.0+, requires its own GPU'],
  ['gpt-oss-120b', 'OpenAI (open weight)', 'chat', 'cluster-exclusive'],
  ['deepseek-r1-distill-qwen-1.5b', 'DeepSeek', 'reasoning', null],
  ['deepseek-r1-distill-qwen-7b', 'DeepSeek', 'reasoning', null],
  ['deepseek-r1-distill-qwen-14b', 'DeepSeek', 'reasoning', null],
  ['deepseek-v3-0324', 'DeepSeek', 'chat', 'cluster-exclusive, very large'],
  ['deepseek-v3.1', 'DeepSeek', 'chat', 'cluster-exclusive, very large'],
  ['deepseek-v3.2', 'DeepSeek', 'chat', 'cluster-exclusive, very large'],
  ['deepseek-v3.2-speciale', 'DeepSeek', 'chat', 'cluster-exclusive, very large'],
  ['qwen2.5-0.5b-instruct', 'Alibaba', 'chat', null],
  ['qwen2.5-1.5b-instruct', 'Alibaba', 'chat', null],
  ['qwen2.5-7b-instruct', 'Alibaba', 'chat', null],
  ['qwen2.5-14b-instruct', 'Alibaba', 'chat', null],
  ['qwen2.5-coder-0.5b-instruct', 'Alibaba', 'code', null],
  ['qwen2.5-coder-1.5b-instruct', 'Alibaba', 'code', null],
  ['qwen2.5-coder-7b-instruct', 'Alibaba', 'code', null],
  ['qwen2.5-coder-14b-instruct', 'Alibaba', 'code', null],
  ['qwen3-0.6b', 'Alibaba', 'chat', null],
  ['qwen3-1.7b', 'Alibaba', 'chat', null],
  ['qwen3-8b', 'Alibaba', 'chat', null],
  ['qwen3-14b', 'Alibaba', 'chat', null],
  ['qwen3-32b', 'Alibaba', 'chat', 'cluster-exclusive'],
  ['mistral-7b-instruct-v0.2', 'Mistral AI', 'chat', '29,328 context, 15.64 GB GPU, Ampere CC 8.0+'],
  ['mistral-7b-instruct-v0.3', 'Mistral AI', 'chat', null],
  ['mistral-nemo-instruct-2407', 'Mistral AI', 'chat', null],
  ['mistral-nemo-instruct-fp8-2407', 'Mistral AI', 'chat', 'fp8 quantized'],
  ['mistral-small-24b-instruct-2501', 'Mistral AI', 'chat', null],
  ['mistral-small-3.1-24b-instruct-2503', 'Mistral AI', 'chat', null],
  ['mistral-small-3.2-24b-instruct-2506', 'Mistral AI', 'chat', null],
  ['mistral-small-4-119b-2603', 'Mistral AI', 'chat', null],
  ['mistral-small-4-119b-2603-nvfp4', 'Mistral AI', 'chat', 'nvfp4 quantized'],
  ['mistral-large-3-675b-instruct-2512', 'Mistral AI', 'chat', 'largest entry in the catalog'],
  ['mixtral-8x7b-instruct-v0.1', 'Mistral AI', 'chat', 'mixture of experts'],
  ['mixtral-8x22b-instruct-v0.1', 'Mistral AI', 'chat', 'mixture of experts'],
  ['magistral-small-2506', 'Mistral AI', 'reasoning', 'exceeds the 100 GiB vllm.modelCacheStorageGi default'],
  ['magistral-small-2507', 'Mistral AI', 'reasoning', 'exceeds the 100 GiB vllm.modelCacheStorageGi default'],
  ['magistral-small-2509', 'Mistral AI', 'reasoning', 'exceeds the 100 GiB vllm.modelCacheStorageGi default'],
  ['devstral-small-2505', 'Mistral AI', 'code', 'agentic coding'],
  ['devstral-small-2507', 'Mistral AI', 'code', 'agentic coding'],
  ['mathstral-7b-v0.1', 'Mistral AI', 'reasoning', 'mathematics'],
  ['ministral-3-3b-instruct-2512', 'Mistral AI', 'chat', null],
  ['ministral-3-8b-instruct-2512', 'Mistral AI', 'chat', null],
  ['ministral-3-14b-reasoning-2512', 'Mistral AI', 'reasoning', null],
  ['pixtral-12b-2409', 'Mistral AI', 'vision', 'VISION INPUT, on-premises exclusive'],
  ['nemotron-nano-12b-v2-vl-bf16', 'NVIDIA', 'vision', 'VISION INPUT, on-premises exclusive'],
  ['nemotron-nano-12b-v2-vl-fp8', 'NVIDIA', 'vision', 'VISION INPUT, on-premises exclusive'],
  ['nemotron-nano-12b-v2-vl-nvfp4-qad', 'NVIDIA', 'vision', 'VISION INPUT, on-premises exclusive'],
  ['nemotron-3-nano-omni-30b-a3b-reasoning-bf16', 'NVIDIA', 'reasoning', 'multi-modal by name, capability surface not documented'],
  ['nemotron-3-nano-omni-30b-a3b-reasoning-fp8', 'NVIDIA', 'reasoning', 'multi-modal by name, capability surface not documented'],
  ['nemotron-3-nano-omni-30b-a3b-reasoning-nvfp4', 'NVIDIA', 'reasoning', 'multi-modal by name, capability surface not documented'],
  ['nemotron-nano-9b-v2', 'NVIDIA', 'chat', null],
  ['nemotron-nano-9b-v2-fp8', 'NVIDIA', 'chat', 'fp8 quantized'],
  ['nemotron-nano-9b-v2-nvfp4', 'NVIDIA', 'chat', 'nvfp4 quantized'],
  ['nemotron-nano-9b-v2-japanese', 'NVIDIA', 'chat', 'Japanese'],
  ['nemotron-nano-12b-v2', 'NVIDIA', 'chat', null],
  ['nemotron-3-nano-4b-bf16', 'NVIDIA', 'chat', null],
  ['nemotron-3-nano-4b-fp8', 'NVIDIA', 'chat', 'fp8 quantized'],
  ['nemotron-3-nano-30b-a3b-bf16', 'NVIDIA', 'chat', null],
  ['nemotron-3-nano-30b-a3b-nvfp4', 'NVIDIA', 'chat', 'nvfp4 quantized'],
  ['nemotron-3-super-120b-a12b-bf16', 'NVIDIA', 'chat', null],
  ['nemotron-3-super-120b-a12b-fp8', 'NVIDIA', 'chat', 'fp8 quantized'],
  ['nemotron-3-super-120b-a12b-nvfp4', 'NVIDIA', 'chat', 'nvfp4 quantized'],
  ['nemotron-4-mini-hindi-4b-instruct', 'NVIDIA', 'chat', 'Hindi'],
  ['opencodereasoning-nemotron-7b', 'NVIDIA', 'code', null],
  ['opencodereasoning-nemotron-14b', 'NVIDIA', 'code', null],
  ['opencodereasoning-nemotron-32b', 'NVIDIA', 'code', null],
  ['opencodereasoning-nemotron-32b-ioi', 'NVIDIA', 'code', 'competitive programming'],
  ['opencodereasoning-nemotron-1.1-7b', 'NVIDIA', 'code', null],
  ['opencodereasoning-nemotron-1.1-14b', 'NVIDIA', 'code', null],
  ['opencodereasoning-nemotron-1.1-32b', 'NVIDIA', 'code', null],
  ['nemotron-terminal-8b', 'NVIDIA', 'code', 'terminal and tool use'],
  ['nemotron-terminal-14b', 'NVIDIA', 'code', 'terminal and tool use'],
  ['nemotron-terminal-32b', 'NVIDIA', 'code', 'terminal and tool use'],
  ['openmath-nemotron-1.5b', 'NVIDIA', 'reasoning', 'mathematics'],
  ['openmath-nemotron-7b', 'NVIDIA', 'reasoning', 'mathematics'],
  ['openmath-nemotron-14b', 'NVIDIA', 'reasoning', 'mathematics'],
  ['openmath-nemotron-14b-kaggle', 'NVIDIA', 'reasoning', 'mathematics'],
  ['openmath-nemotron-32b', 'NVIDIA', 'reasoning', 'mathematics'],
  ['openreasoning-nemotron-1.5b', 'NVIDIA', 'reasoning', null],
  ['openreasoning-nemotron-7b', 'NVIDIA', 'reasoning', null],
  ['openreasoning-nemotron-14b', 'NVIDIA', 'reasoning', null],
  ['openreasoning-nemotron-32b', 'NVIDIA', 'reasoning', null],
  ['acereason-nemotron-7b', 'NVIDIA', 'reasoning', null],
  ['acereason-nemotron-14b', 'NVIDIA', 'reasoning', null],
  ['acereason-nemotron-1.1-7b', 'NVIDIA', 'reasoning', null],
  ['acemath-rl-nemotron-7b', 'NVIDIA', 'reasoning', 'mathematics'],
  ['olmo-3-7b-instruct', 'Allen Institute for AI', 'chat', null],
  ['olmo-3.1-32b-instruct', 'Allen Institute for AI', 'chat', 'cluster-exclusive'],
  ['smollm3-3b', 'Hugging Face', 'chat', null],
  ['whisper-tiny', 'OpenAI', 'speech-to-text', null],
  ['whisper-base', 'OpenAI', 'speech-to-text', null],
  ['whisper-small', 'OpenAI', 'speech-to-text', null],
  ['whisper-medium', 'OpenAI', 'speech-to-text', null],
  ['whisper-large-v3-turbo', 'OpenAI', 'speech-to-text', null],
  ['nemotron-speech-streaming-en-0.6b', 'NVIDIA', 'speech-to-text', 'streaming'],
];
for (const [alias, origin, modality, note] of VLLM) {
  add(alias, { origin, modality, licence: 'UNKNOWN', note, targets: [ALF], runtimes: ['vllm (GPU only)'] });
}

// The published GPU requirements. These five are the ONLY entries Microsoft
// publishes hard figures for, and gpt-oss-20b is two GPU generations ahead of
// the other four.
const GPU = {
  'phi-3.5-mini-instruct': { ctx: 29472, gpu: 'Ampere (CC 8.0)+', mem: '8.428 GB', util: 0.85 },
  'phi-4-mini-instruct': { ctx: 93520, gpu: 'Ampere (CC 8.0)+', mem: '7.806 GB', util: 0.85 },
  'phi-4-mini-reasoning': { ctx: 93520, gpu: 'Ampere (CC 8.0)+', mem: '7.806 GB', util: 0.85 },
  'mistral-7b-instruct-v0.2': { ctx: 29328, gpu: 'Ampere (CC 8.0)+', mem: '15.64 GB', util: 0.85 },
  'gpt-oss-20b': { ctx: 96784, gpu: 'Blackwell (CC 10.0)+', mem: '14.793 GB', util: 0.8 },
};
for (const m of models) {
  if (GPU[m.alias]) { m.gpu = GPU[m.alias]; m.ctx = GPU[m.alias].ctx; }
}

// Alternate-accelerator variant classes, exclusive to Foundry Local. Azure Local
// Foundry's catalog sync paginates CPU and GPU only, so every class below is
// absent from the cluster target.
const accelerators = [
  { suffix: '-qnn-npu', provider: 'QNNExecutionProvider', hardware: 'Qualcomm Snapdragon X Elite / X Plus, driver 30.0.140.0+' },
  { suffix: '-vitis-npu', provider: 'VitisAIExecutionProvider', hardware: 'AMD NPU, Adrenalin 25.6.3 to 25.9.1' },
  { suffix: '(per model)', provider: 'OpenVINOExecutionProvider', hardware: 'Intel NPU and GPU, TigerLake+ / AlderLake+ / ArrowLake+' },
  { suffix: '-generic-gpu', provider: 'WebGpuExecutionProvider', hardware: 'cross-platform GPU fallback (WebGPU/Dawn)' },
  { suffix: '(per model)', provider: 'NvTensorRTRTXExecutionProvider', hardware: 'NVIDIA TensorRT RTX, RTX 30 series and newer' },
];

fs.writeFileSync(OUT, JSON.stringify({ models, accelerators }, null, 1));
const fl = models.filter((m) => m.targets.includes(FL)).length;
const alf = models.filter((m) => m.targets.includes(ALF)).length;
console.log(`on-prem rows: ${models.length}  foundry-local: ${fl}  azure-local-foundry: ${alf}`);
