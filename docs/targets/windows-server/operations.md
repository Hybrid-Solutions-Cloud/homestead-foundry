# Operations: Foundry Local

::: info Scope
This is the operations page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Re-running the install must exit zero having changed nothing, reporting `already-present`, `changed`, or `failed` per stage.
- Run-command output is truncated to the last 4 KB, which bounds what a remote operator can see.
- Any observability must be metadata-only and opt-in. Prompts and content are never captured.
- **The product emits no metric of any kind.** No request count, no tokens, no
  latency, no error rate. `Microsoft.HybridCompute` has no platform metrics
  either, so even host CPU and memory require the Azure Monitor Agent, a data
  collection rule, and per-GB ingestion. **The entire model-usage row of the
  observability design is empty on this target, and
  [ADR-0016](../../adr/ADR-0016-foundry-model-usage-observability) cannot be met
  here** ([SPIKE-27](../../research/SPIKE-27-local-track-observability) Q9).
- **Arc run command cannot detect state, only run an action.** Machine
  configuration is the drift mechanism ADR-0013 is missing
  ([SPIKE-29](../../research/SPIKE-29-local-track-lifecycle-and-upgrade)).
- **No documented update path exists for the MSIX install mechanism**, and models
  have no version pinning: the CLI's "model ID" is a hardware variant, not a
  version.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) carries the sourced answers for this target, including the
findings that corrected earlier claims on this page.

- **SPIKE-27**, the local-track observability spike
- **SPIKE-29**, the local-track lifecycle and upgrade spike
- **ADR-0022**, the local-track observability boundaries ADR
- **ADR-0024**, the local-track lifecycle ADR
