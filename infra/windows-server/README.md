# infra/windows-server/

Automation for the **Foundry Local** deployment target: Foundry Local running on
a single Windows Server you own, Arc-enabled for governance of the host.

> [!IMPORTANT]
> **Nothing here has ever been executed.** No Foundry Local host exists in this
> project. These scripts are written from
> [ADR-0013](../../docs/adr/ADR-0013-foundry-local-windows-server-install.md),
> [ADR-0024](../../docs/adr/ADR-0024-on-premises-lifecycle-and-upgrade.md), and
> [SPIKE-23](../../docs/research/SPIKE-23-foundry-local-install-artifacts-and-run-command.md),
> and are unproven. The first run must be an owner-authorized test on a
> **disposable build VM, never on a working host.**

## Why this is imperative and not Bicep

Foundry Local is not an Azure resource. There is nothing for ARM to create, so
there is no declarative surface to target. Arc governs the *host*, and the
mechanism for doing something to a host is Azure Arc **run command**, which
executes a script. That is a deliberate consequence of the product shape, not a
shortcut. [ADR-0011](../../docs/adr/ADR-0011-multi-target-deployment-automation.md)
decided the form and ADR-0013 settled the mechanics.

The most important consequence, from
[SPIKE-29](../../docs/research/SPIKE-29-local-track-lifecycle-and-upgrade.md):
**Arc run command cannot read state, only run an action.** So idempotence is a
contract these scripts provide, not a property inherited from the tooling. Every
stage determines its own precondition at runtime.

## Layout

| File | What it does |
|---|---|
| `install-foundry-local.ps1` | The four check-before-act stages of ADR-0013 decision 3, run on the target host through Arc run command. |
| `uninstall-foundry-local.ps1` | Teardown. Removes the provisioned package and, optionally, the model cache. |
| `invoke-install.ps1` | The operator-side wrapper. Submits the install script via `az connectedmachine run-command` and interprets the instance view. |

## The install contract

Each stage reports `already-present`, `changed`, or `failed`, and the script
exits zero when a re-run changed nothing. The unit of state is the **on-disk
model cache**, which is why a re-run is cheap and a rebuild is not.

Stages, in order:

1. **Prerequisites.** Windows build, .NET SDK, and disk space for the model cache.
2. **Install.** Machine-wide MSIX provisioning via `Add-AppxProvisionedPackage -Online`.
3. **Service.** Confirm the service starts and responds.
4. **Model.** Pull the first-increment model into the cache.

## Two traps that will bite

**`winget` does not work for this.** Microsoft documents it as blocked for
machine-scope MSIX installs. ADR-0011 originally specified `winget` and
[SPIKE-18](../../docs/research/SPIKE-18-foundry-local-windows-server.md) found it
broken; ADR-0013 supersedes that part.

**A provisioned MSIX may never register on a headless server nobody logs into.**
Provisioning stages the package for user registration at next sign-in. On a
server that no one signs into, that moment may never arrive. This is the single
biggest unproven risk in this directory, it is recorded in SPIKE-23, and it is
the thing the first install test exists to answer.

## Identity and secrets

Runtime identity is the Arc **system-assigned** managed identity. User-assigned
is not supported on Arc machines.

The default path uses **no blob and therefore has no secret surface at all**.
SPIKE-23 found blob staging is not required, which shrinks
[ADR-0005](../../docs/adr/ADR-0005-identity-and-secrets.md)'s exception to the
optional path only: run command cannot authenticate to blob storage with a
managed identity, so a SAS of 24 hours or less is permitted **only** if an
operator chooses blob staging for output capture.

Run-command output is truncated to the **last 4 KB** in the instance view. A
multi-GB model pull failing mid-run is exactly the case where that truncation
hurts.

## What this target cannot do

Stated here because the scripts cannot compensate for it, per
[ADR-0022](../../docs/adr/ADR-0022-on-premises-observability-boundaries.md):

- The inference endpoint has **no authentication, no Azure RBAC, no Entra, no
  Key Vault, no budget, and no Azure Monitor.**
- The product emits **no metric of any kind.** No request count, no tokens, no
  latency.
- **No content filter is documented.** A workload moved here from Azure AI
  Foundry loses every control [ADR-0007](../../docs/adr/ADR-0007-content-safety-and-responsible-ai.md)
  relies on.

## Conventions

PowerShell 7 or later, with `#Requires -Version 7.0`,
`Set-StrictMode -Version Latest`, and `$ErrorActionPreference = 'Stop'` at the
top of every script.

## Status

Written, unexecuted, and blocked on an owner-authorized install test against a
disposable build VM.
