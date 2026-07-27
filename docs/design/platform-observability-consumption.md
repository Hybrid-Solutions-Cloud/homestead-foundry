# Platform observability consumption contract

## Decision

The complete, reusable tenant observability package is owned by the Platform
repository at `D:/git/platform/observability`. Homestead Foundry is a consumer. It
does not own a second generic observability implementation and it does not send
private deployment values upstream.

## What Homestead owns

- Foundry-specific operating questions, supported Azure Monitor metric definitions,
  and alert rationale.
- Selected Foundry diagnostic categories after data classification, retention, RBAC,
  sampling, and cost approval.
- Foundry dashboard panels and links to Foundry response runbooks.
- The public integration documentation and a configuration example without private
  recipients, subscription scope, resource identifiers, or financial values.

## What Platform owns

- The standalone subscription-scope Bicep composition and generic modules.
- Tenant FinOps, inventory, tag governance, Activity Log, Azure health, alert
  routing, dashboard shell, query library, and hybrid extension patterns.
- Public parameter contract, architecture, implementation guide, operations model,
  and Plan, Provision, Configure, Validate pipeline template.

## Private overlay rule

The private Homestead repository holds recipient addresses, actual scopes, deployment
parameter values, approved thresholds, resource identifiers, and any private
destination. It can pull new public package changes into its public core submodule or
copy an approved Platform release, but it never pushes private changes to either
public repository.

## Consumption sequence

1. Improve generic capability in Platform first.
2. Add only Foundry-specific configuration or documentation in Homestead public.
3. Copy approved configuration to the private Homestead overlay.
4. Run what-if, receive explicit approval, deploy through the private overlay, and
   record the as-built result.

The currently deployed Homestead foundation remains separate from the core Foundry
template. It is intentionally small and does not imply that diagnostic, tracing,
Prometheus, health-model, or dashboard-definition features are enabled.
