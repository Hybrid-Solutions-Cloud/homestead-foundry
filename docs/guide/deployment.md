# Deployment

**Status: authored, not yet deployed.** This page describes the approach locked in the Architecture Decision Records (see `docs/adr/`, especially ADR-0004 on topology and region). The parameterized `infra/` Bicep exists and validates (`az bicep build` and `what-if`), but no live deployment has been run from it. Check the [roadmap](../roadmap) page for the current status before assuming any of this is deployed today.

## Planned shape

- `infra/main.bicep` plus modules for: the resource group, the AIServices/Foundry account, model deployments (driven by the [model registry](./model-registry) rather than hardcoded per model), identity and RBAC, Key Vault secret references, and the cost budget.
- A single `location` parameter threaded through every module - no per-module region drift. Every resource this repo's first proven build stood up landed in one Azure region, and the Bicep is required to preserve that discipline rather than let future modules spread across regions by accident.
- A CAF-pattern constraint on the resource-base-name parameter, enforced at `az bicep build` time so a malformed name fails before anything is deployed, not after.
- A placeholder parameter file (`infra/params/example.bicepparam`) with no real values, so the shape of a deployment is visible without exposing any project's actual configuration.

## Full wipe and redeploy, by design

The Bicep is required to support a complete teardown and rebuild, not just incremental updates: `az deployment group delete` followed by a fresh deploy must leave no orphaned resources and require no manual reconciliation to land cleanly back in the same region. This is validated with an `az deployment ... what-if` pass that simulates the full cycle before any live deployment is attempted.

## Gated, always

Every resource-creating Azure call requires explicit, in-the-moment confirmation from a human operator, regardless of what any plan or roadmap says. This repository's automation validates (`az bicep build`, `what-if`) freely; it does not deploy freely.

## Where to track progress

The [roadmap](../roadmap) page tracks the status of this work. This page will be expanded once a live deployment has been run, with the placeholder language above replaced by what was actually built.
