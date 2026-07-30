# Deployment: Azure Local Foundry

::: info Scope
This is the deployment page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Public preview, access by request. No SLA and no published GA date.
- Eighteen supported regions, East US among them, so this target needs no new region decision.
- Ordered install: Gateway API CRDs, then Inference Extension CRDs, then Istio via Helm, then the `Microsoft.CertManagement` extension, then the `Microsoft.Foundry` extension, then `ModelDeployment` custom resources.
- The ordering is load-bearing. Reversing it forces an `istiod` restart and is reported as flaky. The gate between the prerequisite and platform layers is `kubectl get gatewayclass istio` reporting Accepted.
- The gate is a preview access request, which is free and reversible and should be submitted now, plus one read-only `what-if` test. No automation is written yet.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) carries the sourced answers for this target, including the
findings that corrected earlier claims on this page.

- [ADR-0014](../../adr/ADR-0014-foundry-local-azure-local-deployment-layers), ADR-0014
- **SPIKE-30**, the AKS Arc Bicep feasibility spike
