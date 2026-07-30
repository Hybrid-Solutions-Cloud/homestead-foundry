# Architecture: Windows Server (track 2)

::: info Scope
This is the architecture page for **Foundry Local on Windows Server**,
track 2 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- One Windows Server, Arc-enabled as a hard prerequisite, running the Foundry Local service in the guest OS.
- Arc governs installing and configuring the host. It does not govern the running inference service.
- The install is a single idempotent unit of four check-before-act stages: install, model cache, service configuration, validate. The on-disk model cache is the unit of state, not a flag file.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- [ADR-0013](../../adr/ADR-0013-foundry-local-windows-server-install), ADR-0013
- **SPIKE-25**, the hardware sizing spike
