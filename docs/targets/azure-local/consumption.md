# Consumption: Azure Local Foundry

::: info Scope
This is the consumption page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- **Two authentication modes, and both are mandatory:** an Entra ID token, or an
  API key. Earlier revisions of this page said there was no API key at all; that
  was wrong. It matters because **the API-key path bypasses Azure RBAC**, so
  choosing it gives up the governance that makes this target attractive
  ([SPIKE-31](../../research/SPIKE-31-cross-track-feature-parity)).
- Ingress is via the Gateway API. **Self-signed is the default and mandatory
  mechanism for all internal traffic:** cert-manager mints a self-signed cluster
  root CA on first deployment and every model sidecar presents a certificate
  chained to it. A real certificate-authority certificate is required **only**
  for the external LoadBalancer Gateway, and only when off-cluster clients cannot
  be made to trust the cluster CA. Earlier revisions had this backwards
  ([SPIKE-28](../../research/SPIKE-28-azure-local-networking-storage-certificates)).
- `exposure: external` additionally needs a working LoadBalancer implementation,
  which an AKS Arc cluster does not have by default.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) carries the sourced answers for this target, including the
findings that corrected earlier claims on this page.

- **SPIKE-28**, the Azure Local Foundry networking, storage, and certificates spike
- **SPIKE-31**, the cross-track feature parity spike
