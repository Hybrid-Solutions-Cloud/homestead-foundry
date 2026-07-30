# Security and identity: Windows Server (track 2)

::: info Scope
This is the security and identity page for **Foundry Local on Windows Server**,
track 2 of [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Runtime identity is the Arc system-assigned managed identity. User-assigned managed identity is not supported on Arc machines.
- Run-command execution is gated by Azure RBAC: `runCommands/write` needs Azure Connected Machine Resource Administrator, `runCommands/read` needs Reader.
- No inbound ports are opened. The Arc agent dials out.
- One scoped, time-boxed exception to ADR-0005: Arc run command cannot authenticate to blob storage with a managed identity, so a shared access signature of 24 hours or less is permitted for the optional blob staging path. The default path uses no blob and has no secret surface.
- The running inference endpoint has no Azure RBAC, no Entra authentication, no Key Vault path, no budget, and no Azure Monitor.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- [ADR-0013](../../adr/ADR-0013-foundry-local-windows-server-install), ADR-0013
- **SPIKE-23**, the track 2 install-artifacts spike
