# Layer 1: Gateway API and Istio

The prerequisites that sit **underneath** the ARM extension and cannot be
expressed in ARM. This is the reason
[ADR-0014](../../../docs/adr/ADR-0014-foundry-local-azure-local-deployment-layers.md)
has three layers instead of one.

## Order is load-bearing

**Gateway API CRDs first. Istio second.**

Reversing this restarts `istiod` against missing CRDs, and Microsoft's own
install documentation reports that outcome as flaky. `../deploy.ps1` applies the
CRDs, waits for `condition=Established`, and only then proceeds. It refuses to
continue to Istio if the wait fails.

The same restart happens **by design** during an AKS Arc cluster upgrade, which
is a rolling node replacement. That is why
[ADR-0024](../../../docs/adr/ADR-0024-on-premises-lifecycle-and-upgrade.md)
decision 5 makes a cluster upgrade a planned, gated event with pre-checks and
post-checks rather than background maintenance.

## Files

| File | What it is |
|---|---|
| `gateway-api-crds.yaml` | Pointer to the pinned upstream Gateway API CRD release. Not vendored. |

## Istio is not scripted here, deliberately

The chart, its version, and its values are an environment decision. ADR-0024
decision 11 requires pinning to a known-good floor rather than taking latest,
because **Microsoft publishes no compatibility matrix for this stack, only
version floors**. Scripting a `helm install` with an unpinned chart would
manufacture the exact upgrade hazard that ADR the warns about.

`../deploy.ps1` marks this step explicitly rather than silently skipping it.

## Ingress is the Gateway API, not nginx

Microsoft has already published an nginx-to-Gateway-API annotation migration
table **inside the preview**. Anything built against ingress annotations is
built against a surface with a published migration away from it.
