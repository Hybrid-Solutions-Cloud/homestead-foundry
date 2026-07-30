# ADR-0021: On-premises cost governance, when there is nothing metered to govern

- Status: Proposed
- Date: 2026-07-30

## Context

[ADR-0006](./ADR-0006-cost-governance) built spend control in layers, the first
of which is a budget with alert thresholds bound to metered consumption.
[SPIKE-26](../research/SPIKE-26-local-track-cost-model) found that **layer 1 has
no referent on either on-premises target**:

- **Foundry Local** has no metered call, no Azure resource, and no meter. Spend
  for the runtime is genuinely zero, so there is nothing for a budget rule to
  bind to.
- **Azure Local Foundry** does bill, but the fee is set by physical core count
  and **does not move with usage**. A budget alert on it would fire on the same
  fixed amount every month, or never.

So ADR-0006's mechanism cannot be ported. Something else has to carry the intent.

SPIKE-26 also closed the rates and found one control that genuinely matters:
**billing continues for 31 days after disconnection unless the ARM resource is
deleted.**

Method note: the rates came from `https://prices.azure.com/api/retail/prices`,
not from the pricing pages, which return `$-` placeholders to any non-browser
fetch. Three earlier spikes gave up on prices for that reason.

## Decision

1. **The published rates, retrieved 2026-07-30, are the basis for all
   on-premises cost documentation:**

   | Item | Rate |
   |---|---|
   | Azure Local L1 | 0.33 USD per physical core per day |
   | Azure Local L2 | 0.667 USD per physical core per day |
   | Disconnected operations | 1.67 USD per physical core per day |
   | Windows Server guest add-on | 23.30 USD per physical core per month |

2. **Azure Hybrid Benefit is documented as a separate SKU rated 0.00, not as a
   discount.** It waives the host fee and the guest subscription together and
   applies to **L1 only**. Describing it as a percentage discount would be wrong
   and would produce wrong estimates.

3. **ADR-0006 layer 1 is declared not applicable on both on-premises targets**,
   explicitly rather than by silence. A reader who knows ADR-0006 must be told
   its first layer does not travel, or they will assume a budget is protecting
   them when nothing is.

4. **The subscription spending limit is the only ADR-0006 control that
   transfers.** It is retained and is the backstop for both targets.

5. **The real cost control on Azure Local Foundry is core count at
   registration**, decided once, up front, and recorded. Cost scales with cores
   registered and with nothing else, so the sizing decision *is* the cost
   decision. Over-registering cores is the failure mode, not over-calling the
   endpoint.

6. **A decommission control is mandatory, not hygiene.** Because billing
   continues 31 days past disconnection unless the ARM resource is deleted,
   teardown must delete the resource and must be a documented, tested step in the
   Phase P automation rather than an assumed consequence of switching hardware
   off.

7. **A notification budget is still created for Azure Local Foundry**, not to cap
   usage but to catch the two things that actually change the bill: a change in
   registered core count, and a resource that should have been deleted and was
   not. Its threshold is set from expected cores times rate, so any movement is
   by definition unexpected.

8. **Foundry Local gets no Azure cost artifact at all**, because there is no
   Azure resource to attach one to. Its cost documentation states plainly that
   runtime spend is zero, that the cost is hardware and electricity, and that
   there is consequently **no usage accounting either**: zero spend and zero
   visibility are the same fact.

9. **Every rate published in this repository carries its retrieval date and its
   source**, and the retail prices API is the sourcing mechanism for future
   price work. The pricing web pages are not usable for verification.

## Consequences

The cost story becomes honest in both directions: a reader learns that Foundry
Local is free to run *and* that they will have no consumption telemetry, and that
Azure Local Foundry is predictable *and* that predictability comes from the fee
being insensitive to whether the hardware does any work.

Shifting the control from "cap the spend" to "decide the core count, then delete
the resource when done" is a different governance shape from ADR-0006, and
anywhere the two are compared this ADR is the reason.

The 31-day billing tail turns teardown into a correctness requirement for the
Phase P automation. An uninstall script that stops the service and leaves the ARM
resource is a defect that costs real money for a month.

Rates will drift. They are dated, and the retrieval mechanism is recorded, so
refreshing them is a known operation rather than a research exercise.

## Alternatives considered

**Port ADR-0006's budget mechanism unchanged.** Rejected on evidence. It would
create an Azure budget that cannot bind on one target and cannot move on the
other, giving the appearance of a control where none exists. That is worse than
no budget.

**Publish no on-premises cost guidance until a deployment exists.** Rejected. The
rates are sourced and the structural findings, especially the 31-day tail, are
exactly what a reader needs *before* deploying, not after.

**Treat Azure Hybrid Benefit as a discount percentage.** Rejected as factually
wrong. It is a distinct SKU rated at zero.

**Rely on the pricing pages for verification.** Rejected. They render `$-` to any
non-browser fetch, which is what caused three earlier spikes to record prices as
unconfirmed.

## Sources

- [SPIKE-26](../research/SPIKE-26-local-track-cost-model), the rates, the Hybrid Benefit SKU finding, the layer 1 gap, and the 31-day billing tail.
- [ADR-0006](./ADR-0006-cost-governance), the layered spend control this amends for the on-premises targets.
- The Microsoft retail prices API, `https://prices.azure.com/api/retail/prices`, retrieved 2026-07-30.
