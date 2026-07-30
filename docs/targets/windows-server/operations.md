# Operations: Foundry Local

::: info Scope
This is the operations page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Re-running the install must exit zero having changed nothing, reporting `already-present`, `changed`, or `failed` per stage.
- Run-command output is truncated to the last 4 KB, which bounds what a remote operator can see.
- Any observability must be metadata-only and opt-in. Prompts and content are never captured.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) marks the corresponding cells `UNKNOWN` rather than guessing.

- **SPIKE-27**, the local-track observability spike
- **SPIKE-29**, the local-track lifecycle and upgrade spike
- **ADR-0022**, the local-track observability boundaries ADR
- **ADR-0024**, the local-track lifecycle ADR
