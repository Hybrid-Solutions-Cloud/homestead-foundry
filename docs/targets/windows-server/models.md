# Models: Foundry Local

::: info Scope
This is the models page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- The Foundry Local catalog only. None of this repository's cloud roster runs here: no image generation, no text to speech, no video.
- The committed first increment is CPU-only, in the `Phi-4-mini-instruct-generic-cpu` class, roughly 4.8 GB, on `CPUExecutionProvider`.
- **Microsoft publishes no CPU, RAM, or disk minimum for Foundry Local on Windows
  at all.** The prerequisites name an OS build, a .NET SDK, and a GPU, and
  nothing else. Any number below is transferred from an adjacent source and
  labelled as such ([SPIKE-25](../../research/SPIKE-25-local-track-hardware-sizing)).
- A practical ceiling of roughly a 5 GB quantized 4B-class model was measured on
  one 64 GB host. **Treat that as a single observation, not a rule.** SPIKE-18's
  "core count, not RAM" claim is not supported by any first-party statement, and
  Microsoft's own troubleshooting guidance points the other way.
- ONNX Runtime supports CPU, CUDA GPU, AMD Vitis NPU, Qualcomm QNN NPU, Intel
  OpenVINO, WebGPU, and TensorRT RTX execution providers. The NPU and generic-GPU
  variants are **exclusive to this target**; Azure Local Foundry never syncs them.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) carries the sourced answers for this target, including the
findings that corrected earlier claims on this page.

- **SPIKE-22**, the Foundry Local model catalog spike
- **ADR-0019**, the per-target model roster ADR
