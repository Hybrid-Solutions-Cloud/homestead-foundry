# Deployment: Windows Server (track 2)

::: info Scope
This is the deployment page for **Foundry Local on Windows Server**,
track 2 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Imperative automation over Azure Arc run command, with Arc SSH as the documented fallback. Declarative Bicep was considered and rejected as the primary form.
- The install step is `Add-AppxProvisionedPackage -Online`, not `winget install`, which Microsoft documents as blocked for MSIX machine-scope installs.
- Arc run command needs `Microsoft.HybridConnectivity` registered once, and a Connected Machine agent at version 1.33 or later.
- Success is proven by `foundry service status` plus one real inference call, never by an installer exit code.
- The gate is two read-only resolutions, then one owner-authorized install test on a dedicated disposable Windows Server build VM. No automation is written yet.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- [ADR-0013](../../adr/ADR-0013-foundry-local-windows-server-install), ADR-0013
- **SPIKE-23**, the track 2 install-artifacts spike
- **SPIKE-24**, the track 2 install test
