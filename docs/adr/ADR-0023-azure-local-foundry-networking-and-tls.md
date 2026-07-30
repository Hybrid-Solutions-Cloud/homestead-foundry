# ADR-0023: Azure Local Foundry networking, ingress, and TLS

- Status: Proposed
- Date: 2026-07-30

## Context

[SPIKE-19](../research/SPIKE-19-foundry-local-azure-local-deployment) recorded
that a real certificate-authority certificate is required for Azure Local
Foundry and that self-signed is not accepted.
[SPIKE-28](../research/SPIKE-28-azure-local-networking-storage-certificates)
found **that is backwards**, and the correction changes what has to be built:

- **Self-signed is the default and mandatory mechanism for all internal
  traffic.** cert-manager mints a self-signed cluster root CA on first
  deployment, and every model sidecar presents a certificate chained to it.
- **A real CA certificate is needed only for the external LoadBalancer Gateway**,
  and only when off-cluster clients cannot be made to trust the cluster CA.

SPIKE-28 also closed SPIKE-19's open question about cert-manager coexistence, and
surfaced a prerequisite that appears in no Foundry Local document:
**`exposure: external` requires a working LoadBalancer implementation, which an
AKS Arc cluster does not have by default.**

## Decision

1. **SPIKE-19's TLS position is reversed, and the reversal is stated on every
   page that carried it.** A correction that lives only in a new ADR leaves the
   wrong claim in the reader's path.

2. **The internal trust model is the cluster's own self-signed root CA, and it is
   not replaceable.** It is minted on first deployment and every sidecar chains
   to it. Attempting to substitute a corporate CA for internal traffic is not a
   supported configuration and must not be designed for.

3. **A real CA certificate is required at exactly one boundary: the external
   Gateway**, and only when off-cluster clients cannot be made to trust the
   cluster CA. Distributing the cluster CA to a known, small set of clients is a
   legitimate alternative and is the cheaper path when the client population is
   controlled.

4. **The two cert-managers do not coexist, and Microsoft says so explicitly.**
   The deployment uses the `Microsoft.CertManagement` cluster extension. A
   pre-existing community cert-manager on the cluster is a blocking conflict to
   resolve before install, not a compatible alternative.

5. **A LoadBalancer implementation is a hard prerequisite for external
   exposure**, and it is listed alongside the AKS Arc cluster and preview access
   rather than buried. AKS Arc does not provide one by default. An install that
   sets `exposure: external` on a cluster without one will not work, and this is
   documented in no Foundry Local page.

6. **The default posture is internal exposure.** External exposure is opt-in and
   pulls in both the LoadBalancer prerequisite and the external-certificate
   decision. Defaulting to internal keeps the first increment achievable and
   keeps the endpoint off the network until someone decides otherwise.

7. **Ingress is the Gateway API, not nginx.** Microsoft has already published an
   nginx-to-Gateway-API annotation migration table inside the preview, so any
   design written against ingress annotations is designing against a deprecated
   surface.

8. **cert-manager's supported region list and Foundry Local's are different
   lists.** Both include East US, so
   [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers)'s region
   selection is unaffected. Recorded because the intersection, not either list
   alone, is what constrains a future region change.

9. **Certificate material is one of the few things on this target that is not
   simply rebuildable**, so it is named explicitly in the backup scope alongside
   the disconnected-operations artifacts.

## Consequences

The build gets simpler and cheaper than SPIKE-19 implied. No certificate
procurement is required to stand up a working internal deployment, which removes
what looked like a hard external dependency from the critical path.

The LoadBalancer prerequisite moves in the opposite direction: it adds a cluster
capability that has to exist before external exposure can work, and because
Microsoft documents it nowhere, an operator would otherwise hit it as a confusing
runtime failure.

Defaulting to internal exposure means the first deployment is not reachable from
outside the cluster. That is intended, and turning it on is a deliberate step
with its own prerequisites.

The cert-manager conflict is a pre-install check that the Phase P automation must
perform, not a runtime concern.

## Alternatives considered

**Keep SPIKE-19's position and require a real CA certificate.** Rejected on
evidence. It would impose a procurement step that the product does not require
and cannot use for internal traffic.

**Default to external exposure so the endpoint is immediately usable.** Rejected.
It requires a LoadBalancer the cluster does not have, forces the external
certificate decision immediately, and publishes an inference endpoint before
anyone has decided it should be reachable.

**Use the community cert-manager already common on Kubernetes clusters.**
Rejected. Microsoft states the two do not coexist, and the extension is the
supported path.

**Design ingress against nginx annotations.** Rejected. Microsoft has published
the migration away from them inside the preview.

## Sources

- [SPIKE-28](../research/SPIKE-28-azure-local-networking-storage-certificates), the TLS reversal, the cert-manager coexistence answer, the LoadBalancer prerequisite, and the region-list difference.
- [SPIKE-19](../research/SPIKE-19-foundry-local-azure-local-deployment), the superseded TLS position.
- [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers), the three-layer deployment and region selection this builds on.
