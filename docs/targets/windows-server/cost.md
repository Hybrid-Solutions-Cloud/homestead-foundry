# Cost: Foundry Local

::: info Scope
This is the cost page for **Foundry Local**,
one of the three targets in [ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation).
Compare all three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
Nothing on this target has been deployed from this repository, and no automation
exists for it yet. Everything below is drawn from accepted decisions and
first-party research. Treat it as a design, not an as-built record.
:::

## What is decided today

- No Azure spend for the runtime itself. Arc run command carries no charge, although scripts stored in Azure do.
- Cost is the hardware you already own, plus its power and its existing Windows Server licence.
- There is no Azure resource to apply a budget to, so ADR-0006's resource-group budget has nothing to attach to here.

## The research and decisions behind this page

These were open when this page was first written. **They are now written and linked below.** Where a finding contradicted an earlier claim on this page, the page has been corrected and says so inline.

- [SPIKE-26](../../research/SPIKE-26-local-track-cost-model), the local-track cost spike
- [ADR-0021](../../adr/ADR-0021-on-premises-cost-governance), the local-track cost governance ADR **(Status: Proposed, awaiting approval)**
