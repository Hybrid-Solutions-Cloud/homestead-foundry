# infra/azure-local/

Automation for the **Azure Local Foundry** deployment target: Foundry Local at
cluster scale on an Arc-connected AKS Arc cluster running on Azure Local
hardware.

> [!IMPORTANT]
> **Nothing here has ever been executed.** No AKS Arc cluster exists in this
> project, and Azure Local Foundry is a **public preview with access by request,
> no SLA, and no published GA date.** These files are written from
> [ADR-0014](../../docs/adr/ADR-0014-foundry-local-azure-local-deployment-layers.md),
> [ADR-0023](../../docs/adr/ADR-0023-azure-local-foundry-networking-and-tls.md),
> [ADR-0024](../../docs/adr/ADR-0024-on-premises-lifecycle-and-upgrade.md), and
> SPIKE-19, 28, and 29. They are unproven.

## Why three layers

ADR-0014 decision 1. Mandatory Gateway API and Istio prerequisites sit
*underneath* the ARM extension and cannot be expressed in ARM, and the model
intent sits *above* it as Kubernetes custom resources. ARM owns only the middle.

| Layer | Owner | What it does |
|---|---|---|
| `prereq/` | `kubectl` and Helm | Gateway API CRDs, then Istio. Ordering here is load-bearing. |
| `platform/` | **Bicep** | The two cluster extensions: `Microsoft.CertManagement` and `Microsoft.Foundry`. |
| `intent/` | `kubectl` | `ModelDeployment` custom resources. |

`deploy.ps1` is the ordering wrapper. **ADR-0014 calls it a first-class
deliverable, not glue**, because the ordering is the part that breaks.

## The consequence people miss

`az deployment group what-if` sees **only the middle layer**. Drift detection is
split three ways and there is no single command that shows you the state of this
deployment. Anyone expecting `what-if` to cover it will be wrong about two thirds
of the stack.

## TLS: the opposite of what SPIKE-19 said

**Self-signed is the default and mandatory mechanism for all internal traffic.**
cert-manager mints a self-signed cluster root CA on first deployment and every
model sidecar presents a certificate chained to it. You cannot substitute a
corporate CA for internal traffic; it is not a supported configuration.

A real certificate-authority certificate is required at **exactly one boundary,
the external Gateway**, and only when off-cluster clients cannot be made to trust
the cluster CA. SPIKE-19 had this backwards and
[ADR-0023](../../docs/adr/ADR-0023-azure-local-foundry-networking-and-tls.md)
reverses it. **No certificate procurement is needed to stand up a working
internal deployment.**

## Prerequisites, including one Microsoft documents nowhere

1. An Azure Local instance and an AKS Arc cluster.
2. **Preview access granted.** Access is by request and has lead time.
3. **A working LoadBalancer implementation, if you want external exposure.** AKS
   Arc does not have one by default. This appears in no Foundry Local document;
   SPIKE-28 found it. `exposure: external` without one does not work.
4. **No community cert-manager on the cluster.** The two cert-managers do not
   coexist and Microsoft says so explicitly. A pre-existing one is a blocking
   conflict to resolve before install.

`deploy.ps1` checks 3 and 4 before touching anything.

## Default posture: internal

External exposure is opt-in. Defaulting to internal keeps the first increment
achievable and keeps an inference endpoint off the network until someone decides
otherwise (ADR-0023 decision 6).

## Upgrades are a planned, gated event

Microsoft documents install ordering and documents **nothing** about upgrade
ordering. Meanwhile the one upgrade certain to happen underneath this stack, an
AKS Arc Kubernetes upgrade, is a rolling **node replacement** that necessarily
restarts `istiod`, the exact event Microsoft's own install warning calls flaky.

So upgrades run as an explicit ordered sequence with pre-checks and post-checks,
never as background maintenance (ADR-0024 decisions 4 and 5).

## Teardown deletes the ARM resource, and that is a cost control

**Billing continues for 31 days after disconnection unless the ARM resource is
deleted** (ADR-0021). A teardown that stops the workload and leaves the resource
costs real money for a month. It is a correctness requirement, not tidiness.

Teardown also leaves residue, some of it **by design**. `teardown.ps1` reports
what remains.

## What to back up

Almost everything is rebuildable from source and from the catalog. The exceptions,
and therefore the backup scope, are the **certificate material** and the
**disconnected-operations artifacts** (ADR-0024 decision 10).

## What this target cannot do

- **No documented Azure Monitor or Prometheus metric for a `ModelDeployment`.**
  Rich infrastructure telemetry, and nothing for the thing serving the model. No
  request count, no latency, no token count (ADR-0022).
- **No content filter of any kind is documented** (ADR-0007 does not travel here).
- The endpoint has two mandatory auth modes, and **the API-key path bypasses
  Azure RBAC.** Only the Entra path gives you the governance this target is
  chosen for.

## Conventions

Bicep for the platform layer only. PowerShell 7 or later for the wrapper, with
`#Requires -Version 7.0`, `Set-StrictMode -Version Latest`, and
`$ErrorActionPreference = 'Stop'`.

Deprecated `ModelDeployment` endpoint fields are not used, and ingress targets
the **Gateway API**, not nginx annotations: Microsoft has already published the
migration away from those inside the preview (ADR-0024 decision 7).

## Status

Written, unexecuted, and blocked on preview access plus an AKS Arc cluster.
