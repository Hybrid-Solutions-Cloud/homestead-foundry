# Architecture: Foundry Local

::: info Scope
This is the architecture page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- One Windows Server, Arc-enabled as a hard prerequisite, running the Foundry Local service in the guest OS.
- Arc governs installing and configuring the host. It does not govern the running inference service.
- The install is a single idempotent unit of four check-before-act stages: install, model cache, service configuration, validate. The on-disk model cache is the unit of state, not a flag file.

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [ADR-0013](../../adr/ADR-0013-foundry-local-windows-server-install), the governing decision **(Status: Proposed, awaiting approval)**
- [SPIKE-25](../../research/SPIKE-25-local-track-hardware-sizing), the hardware sizing spike
