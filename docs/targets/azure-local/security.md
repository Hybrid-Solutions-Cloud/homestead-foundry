# Security and identity: Azure Local Foundry

::: info Scope
This is the security and identity page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- **The endpoint has two authentication modes and both are mandatory:** an Entra
  ID token, or an API key. Full Azure RBAC, policy, and cost visibility through
  Arc apply **on the Entra path only. The API-key path bypasses Azure RBAC**, so
  issuing a key gives up the governance that distinguishes this target from
  Foundry Local. Earlier revisions said there was no API key at all; that was
  wrong ([SPIKE-31](../../research/SPIKE-31-cross-track-feature-parity)).
- **No content filter or responsible-AI guardrail is documented for this target.**
  Nothing [ADR-0007](../../adr/ADR-0007-content-safety-and-responsible-ai) relies
  on travels here. If content safety is required, it must be built in the
  application layer.
- This target requires no exception to ADR-0005.
- **TLS: self-signed is the default and mandatory mechanism for internal
  traffic.** cert-manager mints a self-signed cluster root CA on first deployment
  and every model sidecar chains to it. A real certificate-authority certificate
  is needed **only** for the external LoadBalancer Gateway, and only when
  off-cluster clients cannot be made to trust the cluster CA. The two
  cert-managers do not coexist. Earlier revisions had this backwards
  ([SPIKE-28](../../research/SPIKE-28-azure-local-networking-storage-certificates)).

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [SPIKE-28](../../research/SPIKE-28-azure-local-networking-storage-certificates), the Azure Local Foundry networking, storage, and certificates spike
- [ADR-0023](../../adr/ADR-0023-azure-local-foundry-networking-and-tls), the Azure Local Foundry networking ADR **(Status: Proposed, awaiting approval)**
