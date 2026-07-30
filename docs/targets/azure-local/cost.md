# Cost: Azure Local Foundry

::: info Scope
This is the cost page for **Azure Local Foundry**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- Fixed cost, billed **per physical core of the Azure Local host per day**,
  whether or not you infer.
- **The rates are confirmed** from the Microsoft retail prices API, retrieved
  2026-07-30 ([SPIKE-26](../../research/SPIKE-26-local-track-cost-model)):

  | Tier | USD per physical core per day | Approx. per 30-day month |
  |---|---|---|
  | L1 | 0.33 | 9.90 |
  | L2 | 0.667 | 20.01 |
  | Disconnected operations | 1.67 | 50.10 |

- The Windows Server guest add-on is **23.30 USD per physical core per month**.
- **Azure Hybrid Benefit is not a discount.** It is a separate SKU rated 0.00
  that waives the host fee and the guest subscription together, and it applies to
  **L1 only**.
- There is no per-token inference charge.
- **[ADR-0006](../../adr/ADR-0006-cost-governance)'s layer 1 spend guard has no
  referent here.** The fee is set by core count and does not move with usage, so
  there is no metered call for a budget rule to bind. Only the subscription
  spending limit transfers.
- **Billing continues for 31 days after disconnection unless the ARM resource is
  deleted**, so a decommission step is a real cost control, not hygiene.

## What is still open

This page is filled out as the research and decisions below land. Until then, the
[comparison hub](../) carries the sourced answers for this target, including the
findings that corrected earlier claims on this page.

- **SPIKE-26**, the local-track cost spike
- **ADR-0021**, the local-track cost governance ADR
