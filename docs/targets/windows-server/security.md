# Security and identity: Foundry Local

::: info Scope
This is the security and identity page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
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
- **The endpoint has no authentication of any kind.** It listens locally and
  anyone who can reach it can call it. There is therefore no caller identity to
  log, which is why "who called the endpoint" is unanswerable on this target
  ([SPIKE-31](../../research/SPIKE-31-cross-track-feature-parity)).
- **No content filter or responsible-AI guardrail is documented for this target.**
  Nothing [ADR-0007](../../adr/ADR-0007-content-safety-and-responsible-ai) relies
  on travels here. If content safety is required, it must be built in the
  application layer.

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [ADR-0013](../../adr/ADR-0013-foundry-local-windows-server-install), the governing decision **(Status: Proposed, awaiting approval)**
- [SPIKE-23](../../research/SPIKE-23-foundry-local-install-artifacts-and-run-command), the Foundry Local install-artifacts spike
