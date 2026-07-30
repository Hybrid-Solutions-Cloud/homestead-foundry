# ADR-0024: On-premises lifecycle, upgrade, drift, and teardown

- Status: Proposed
- Date: 2026-07-30

## Context

[SPIKE-29](../research/SPIKE-29-local-track-lifecycle-and-upgrade) found the
lifecycle story for both on-premises targets is thinner than the install story,
in ways that affect what the Phase P automation must do:

- **Foundry Local has no documented update path for the MSIX install mechanism
  [ADR-0013](./ADR-0013-foundry-local-windows-server-install) selected**, no
  model version pinning at all (the CLI's "model ID" is a hardware variant, not a
  version), and **Arc run command cannot detect state, only run an action.**
- **Azure Local Foundry has documented install ordering and no documented upgrade
  ordering**, while the one upgrade certain to happen underneath it, an AKS Arc
  Kubernetes upgrade, is a rolling **node replacement** that necessarily restarts
  `istiod` -- the exact event Microsoft's own install warning calls flaky.
- **No preview-to-GA migration path is published**, in-place migration is not
  promised, and **a breaking change has already landed inside the preview**:
  three deprecated `ModelDeployment` endpoint fields plus an nginx-to-Gateway-API
  annotation migration table.
- **Teardown leaves residue on both targets**, and on Azure Local Foundry some of
  it is left behind by design.

## Decision

1. **Idempotence is a contract the automation provides, not a property inherited
   from the tooling.** ADR-0013's four check-before-act stages stand. Because Arc
   run command cannot read state, every stage must determine its own precondition
   at runtime and report `already-present`, `changed`, or `failed`.

2. **Azure Machine Configuration is named as the drift mechanism ADR-0013 is
   missing**, for Foundry Local. Run command governs an action; machine
   configuration is the only Arc surface that audits resulting state. It is not
   built in the first increment, but it is recorded as the intended answer so
   drift detection is not left as a blank.

3. **Model versions cannot be pinned on Foundry Local, and the automation must
   not pretend otherwise.** The on-disk model cache is the unit of state, a
   re-pull is the update mechanism, and which build you receive is not under the
   deployer's control. Any reproducibility claim is scoped to "the variant", not
   "the version".

4. **Upgrade ordering on Azure Local Foundry is treated as unsafe until proven
   otherwise.** Install ordering is published and upgrade ordering is not, and
   the known-flaky event is guaranteed to occur during a routine cluster upgrade.
   The automation therefore performs upgrades as an explicit, ordered, gated
   sequence rather than allowing them to happen incidentally.

5. **An AKS Arc cluster upgrade is a planned event with a documented
   pre-check and post-check, not background maintenance.** It replaces nodes and
   restarts `istiod`. Treating it as routine is how the flaky path gets hit.

6. **No in-place preview-to-GA migration is assumed.** The working assumption is
   redeploy, and the deployment is designed to be reconstructible from source so
   that redeploying is cheap. The already-delivered in-preview breaking change is
   treated as representative of how GA will behave, because it is the only
   evidence available.

7. **Deprecated `ModelDeployment` endpoint fields are not used**, and the Gateway
   API is targeted directly rather than nginx annotations. Building on a surface
   Microsoft has already published a migration away from is a self-inflicted
   upgrade.

8. **Teardown deletes the ARM resource, and this is a correctness requirement
   rather than tidiness.** [ADR-0021](./ADR-0021-on-premises-cost-governance)
   established that billing continues for 31 days after disconnection unless the
   resource is deleted. An uninstall that stops the service and leaves the
   resource is a defect.

9. **Residue is documented per target rather than assumed away.** On Azure Local
   Foundry some residue is intentional. The teardown documentation lists what
   remains and whether removing it is safe.

10. **Backup scope is the exceptions, not the whole system.** Almost everything is
    rebuildable from source and from the catalog. The exceptions are the
    **certificate material** and the **disconnected-operations artifacts**, and
    those are the backup scope.

11. **CRD upgrades are unaddressed by Microsoft and there is no compatibility
    matrix, only version floors.** The automation pins to known-good floors and
    treats a CRD upgrade as a gated change.

## Consequences

Both targets get a lifecycle position that is defensible on the evidence, and the
Phase P automation has a definite list of behaviours to implement: runtime
precondition checks, an ordered gated upgrade, and a teardown that deletes the
ARM resource.

The redeploy-rather-than-migrate assumption sets an expectation with an adopter
early. If Microsoft later publishes an in-place path, this ADR is superseded and
nothing was lost by having assumed the harder case.

Naming machine configuration without building it leaves a known, deliberate gap.
It is better than the current situation, which is an unnamed gap.

The upgrade-ordering position makes cluster upgrades more ceremonious than
operators may expect. That is the intended trade: the alternative is discovering
the flaky path during an unattended maintenance window.

## Alternatives considered

**Assume MSIX servicing handles Foundry Local updates.** Rejected. No update path
is documented for it, and assuming a mechanism exists because it usually does is
the kind of unsourced claim this repository treats as a defect.

**Let AKS Arc upgrades proceed as routine maintenance.** Rejected. The upgrade is
documented as a rolling node replacement and the resulting `istiod` restart is the
exact event Microsoft warns about.

**Wait for the GA migration path before deciding.** Rejected. There is no
published GA date, and the in-preview breaking change is evidence available now.

**Treat teardown as an operational nicety.** Rejected on cost evidence. The
31-day billing tail makes it a control.

## Sources

- [SPIKE-29](../research/SPIKE-29-local-track-lifecycle-and-upgrade), every finding above.
- [ADR-0013](./ADR-0013-foundry-local-windows-server-install), the install contract and its missing drift mechanism.
- [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers), the three-layer deployment.
- [ADR-0021](./ADR-0021-on-premises-cost-governance), the 31-day billing tail that makes teardown a control.
- [ADR-0023](./ADR-0023-azure-local-foundry-networking-and-tls), the Gateway API and certificate-material positions.
