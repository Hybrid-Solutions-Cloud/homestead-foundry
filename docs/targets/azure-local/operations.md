# Operations: Azure Local Foundry

::: info Scope
This is the operations page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Drift detection is split three ways, because `what-if` sees only the middle of the three layers.
- More than sixty standard Azure Local infrastructure metrics are available at no extra cost.
- Managed Prometheus is deliberately deferred until a Prometheus-capable workload exists.
- Upgrade ordering carries the same load-bearing constraint as the install, and
  **only the install half is documented.** An AKS Arc upgrade is a rolling node
  replacement that necessarily restarts `istiod`, which is the exact event
  Microsoft's own install warning calls flaky
  ([SPIKE-29](../../research/SPIKE-29-local-track-lifecycle-and-upgrade)).
- **No Azure Monitor or Prometheus metric is documented for a `ModelDeployment`.**
  The infrastructure is richly instrumented and the model serving on it is not:
  no request count, no latency, no token count. Neither on-premises target can
  alert on a model, and
  [ADR-0016](../../adr/ADR-0016-foundry-model-usage-observability) cannot be met
  here ([SPIKE-27](../../research/SPIKE-27-local-track-observability) Q6).
- **No preview-to-GA migration path is published** and in-place migration is not
  promised. A breaking change has already landed inside the preview: three
  deprecated `ModelDeployment` endpoint fields plus an nginx-to-Gateway-API
  annotation migration table.
- Teardown leaves residue, some of it by design. Certificate material and
  disconnected-operations artifacts are the parts that are not simply rebuildable.

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [SPIKE-27](../../research/SPIKE-27-local-track-observability), the local-track observability spike
- [SPIKE-29](../../research/SPIKE-29-local-track-lifecycle-and-upgrade), the local-track lifecycle and upgrade spike
- [ADR-0022](../../adr/ADR-0022-on-premises-observability-boundaries), the local-track observability boundaries ADR **(Status: Proposed, awaiting approval)**
- [ADR-0024](../../adr/ADR-0024-on-premises-lifecycle-and-upgrade), the local-track lifecycle ADR **(Status: Proposed, awaiting approval)**
