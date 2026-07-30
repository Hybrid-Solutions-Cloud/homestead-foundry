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
- Practical ceiling is roughly a 5 GB quantized 4B-class model. Core count, not RAM, is the binding constraint.
- ONNX Runtime supports CPU, CUDA GPU, AMD Vitis NPU, and Qualcomm QNN NPU execution providers.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-22**, the Foundry Local model catalog spike
- **ADR-0019**, the per-target model roster ADR
