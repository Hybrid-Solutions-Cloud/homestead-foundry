# SPIKE-26: The cost model for the two local deployment tracks, and where a spend cap can actually be enforced

Role: foundry-researcher (Opus). Status: research spike complete. **Read-only.** No Azure resources created, read, or modified. No `az` command run. No Cost Management query issued against any subscription. No software installed. No model API called. Every figure below comes from a public, unauthenticated, first-party Microsoft pricing surface.
Date: 2026-07-30
Scope: the money and the guardrails for **track 2 (Foundry Local on Windows Server)** and **track 3 (Foundry Local on Azure Local)**, the two deployment tracks ADR-0011 named alongside the cloud track. This is the local-track parallel to SPIKE-05, which did the same job for the cloud track. It closes SPIKE-19 UNKNOWN #3 and SPIKE-09 UNKNOWN #2 (the exact Azure Local per-physical-core price), fills the cost gap both local-track spikes left open, and answers the governance question that ADR-0021 has to decide: what replaces ADR-0006's resource-group budget when there is no Azure resource to cap. This spike authorizes no deployment and no spend.

Grounding read first: `SPIKE-05` (the cloud cost and governance spike this parallels), `SPIKE-09` (which recorded a preliminary per-core figure from a secondary source), `SPIKE-18` (track 2), `SPIKE-19` (track 3, whose UNKNOWN #3 this closes), `ADR-0006` (the cost-governance decision whose three layers are under test here), and `docs/design/cost-and-governance.md` (the design that instantiates ADR-0006). This spike verifies and corrects against first-party sources; it does not restate those documents.

**Headline, three parts.**

1. **The per-core figures are resolved from a first-party source, not inferred.** Azure Local L1 is **0.33 USD per physical core per day**, L2 is **0.667**, and disconnected operations (L3) is **1.67**, all USD, all from the Microsoft retail prices API on 2026-07-30. At 30 days that is about **9.90 / 20.01 / 50.10 USD per physical core per month**. Azure Hybrid Benefit is published as a distinct meter rated at **0.00 USD**, so the waiver is total, not partial.
2. **Neither local track has any inference charge at all**, and track 2 has no Azure charge whatsoever for the runtime. The entire Azure-visible spend on track 2 is optional Arc management add-ons that a deployer chooses to switch on.
3. **The governance answer, stated plainly: ADR-0006's real cap cannot exist on either local track, and on track 3 it is not needed.** ADR-0006's layer 1 (the synchronous pre-spend pipeline guard) presupposes a metered call to refuse. Track 2 has no meter. Track 3 has a fee that does not move with usage. What both tracks actually need is not a cap but a **forecast plus a drift detector plus a decommission control**, and track 3 has two genuine, documented ways to bleed money that no budget cap addresses.

**A methodology finding worth carrying forward on its own.** SPIKE-01, SPIKE-05, and SPIKE-09 all failed to confirm a price because `azure.microsoft.com/pricing/details/...` is a client-rendered widget that returns `$-` placeholders to any non-browser fetch. It did so again this session for Azure Local L1 and L2, for Defender for Servers, and for Azure Monitor. **The Microsoft retail prices API at `https://prices.azure.com/api/retail/prices` is a first-party, public, unauthenticated, JSON pricing surface that renders every one of those figures.** It is the correct tool for this repo's price verification and it should replace the widget-scraping approach in every future spike. It resolved four figures this session that three prior spikes could not.

---

## Question

Nine questions, four on track 2, four on track 3, and one that spans both and matters most:

1. Track 2: what does the Foundry Local runtime itself cost? Is there any per-token, per-model, or licensing charge?
2. Track 2: what does Azure Arc for servers cost, separating the free control-plane surface from the billable add-ons, and what does "scripts you store in Azure incur billing charges" actually mean in money?
3. Track 2: what is the honest total cost of ownership for a server you already own? What is genuinely zero and what merely feels zero?
4. Track 3: what is the exact Azure Local per-physical-core host fee, from a first-party source rather than an inference? (SPIKE-19 UNKNOWN #3, SPIKE-09 UNKNOWN #2)
5. Track 3: what is the Windows Server guest add-on per core, and how exactly does Azure Hybrid Benefit reduce or waive it?
6. Track 3: does the `Microsoft.Foundry` extension, the AKS Arc cluster, or the Arc connection carry any charge beyond the host fee? Is there a per-token inference charge?
7. Track 3: what does the disconnected operations appliance cost?
8. **Where can a hard spend cap actually be enforced on each local track, and what can ADR-0006's approach not reach?**
9. A worked break-even: at what monthly token volume does a fixed per-core Azure Local fee beat the cloud's metered pricing for an equivalent text workload?

---

## Findings

### Q1. The track 2 runtime is free, and Microsoft now says something new and important about running it on a server

**Free, first-party and unambiguous.** "There are no per-token costs and no backend infrastructure to maintain," and, in the FAQ, "Is an Azure subscription required? **No.** Foundry Local runs entirely on local hardware. No Azure subscription is required." Source: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local), retrieved 2026-07-30. The CLI reference's "Azure RBAC: Not applicable (runs locally)" (SPIKE-18 Q6) says the same thing from the access-control side.

**Corroborated by the absence of a meter.** A filter for any product whose name contains `Foundry Local` against the Microsoft retail prices API returns an **empty result set**: count 0, no items. Source: `https://prices.azure.com/api/retail/prices?$filter=contains(productName, 'Foundry Local')`, retrieved 2026-07-30. There is no Foundry Local meter in the Azure retail catalogue, so there is nothing that could bill for it. Absence of a meter is weaker evidence than a positive statement, but combined with the explicit "no per-token costs" it settles the question for the runtime.

**What is not free: the models, individually.** SPIKE-18 UNKNOWN #6 (per-model licence terms permitting this repo's intended use) is unchanged and stays open. The runtime being free says nothing about a given model's licence, which is per model and checked with `foundry model info <model> --license`.

**New since SPIKE-18, and it belongs in ADR-0013's consequences.** The FAQ now carries a question SPIKE-18 could not have seen, and the answer is a direct first-party comment on track 2's premise:

> **Can Foundry Local run on a server?**
> Foundry Local is optimized for hardware-constrained devices where a single user accesses the model at a time. **While you can technically install and run it on server hardware, it isn't designed as a server inference stack.** ... Foundry Local doesn't provide these capabilities [concurrent request queuing, continuous batching, efficient GPU sharing]. ... If you need to serve models to multiple concurrent users, use a dedicated server inference framework. Use Foundry Local when the model runs on the end user's own device.

Source: same page, retrieved 2026-07-30. This is still not a support statement, so **SPIKE-18 UNKNOWN #1 does not close** on it. But it moves the answer from "Microsoft is silent" to "Microsoft says it will technically run and is not designed for this," which is a materially different starting position for ADR-0013 and materially sharpens the cost question: a runtime that does not do concurrent request queuing or continuous batching cannot amortize a server's cores across users, so track 2's cost-per-useful-token is worse than its zero price tag suggests. The cost model and the concurrency limitation are the same finding viewed twice.

### Q2. Arc: the surface track 2 uses is free, the surface track 2 does not need is not, and the storage charge is real but numerically trivial

**Free, and it is exactly the surface ADR-0011 and ADR-0013 depend on.** The Azure Arc core control plane pricing page lists these at no cost:

- **Inventory:** "Tag your resources, organize them into resource groups, subscriptions, and management groups, and query at scale"
- **Management:** "Administrate your servers anywhere using **SSH Arc, Run Command, and Custom Script Extension**"
- **VM self-service:** lifecycle and power-cycle operations

Source: [Azure Arc pricing, core control plane](https://azure.microsoft.com/en-us/pricing/details/azure-arc/core-control-plane/), retrieved 2026-07-30. Both mechanisms track 2's automation is built on, the Arc run command and the Arc SSH fallback, are on the free list. So is the Arc-enabled server resource itself and its inventory, tagging, and RBAC.

**Billable, per Arc-enabled server, and all optional.** The same page and the retail prices API, both retrieved 2026-07-30:

| Add-on | Published rate | Source and retrieval |
|---|---|---|
| Azure Update Manager (Arc-enabled servers) | **5 USD per server per month** | Arc core control plane pricing page, rendered |
| Azure Policy guest configuration | **6 USD per server per month, or 0.009 USD per server per hour** | Arc core control plane pricing page, rendered |
| Microsoft Defender for Servers Plan 1 | **0.00672 USD per node per hour** (about 4.91 USD per 730-hour month) | Retail prices API, `contains(productName, 'Defender for Servers')`, SKU `Standard P1 Node` |
| Microsoft Defender for Servers Plan 2 | **0.02 USD per node per hour** (about 14.60 USD per 730-hour month) | Retail prices API, same query, SKU `Standard P2 Node` |
| Azure Monitor, Basic Logs ingestion | **0.50 USD per GB** | Retail prices API, `serviceName eq 'Azure Monitor'`, East US |
| Azure Monitor, Auxiliary Logs ingestion | **0.05 USD per GB** | Retail prices API, same query |
| Azure Monitor, Analytics Logs ingestion (pay as you go) | **UNKNOWN as a figure.** The pricing page renders `$- per GB`; the retail query for SKU `Analytics Logs` in East US returned an empty result set | See unknowns table |
| Windows Server pay as you go via Arc, if you do **not** own a licence | **0.046 USD per core per hour** (about 33.58 USD per core per 730-hour month). The `Azure Management License` SKU on the same product is **0.00 USD** | Retail prices API, `contains(productName, 'Windows Server')`, product `Az Arc Pay As You Go Windows Server` |

Two points of substance for ADR-0021. First, the Defender for Servers figures did **not** render on `azure.microsoft.com/pricing/details/defender-for-cloud/` (it returned `$-` for both plans this session) but did render from the retail API, which is the methodology point above in miniature. Second, the Analytics Logs per-GB rate is the one figure this spike could not retrieve, and it is the one that matters most for a runaway, because log ingestion is the only Arc add-on whose cost is **volume-driven rather than per-server flat**. Every other row is a fixed monthly charge per server that cannot surprise anyone. That asymmetry is load-bearing for question 8.

**The stored-scripts charge, confirmed and quantified.** SPIKE-18 quoted it; it is still there verbatim: "While the Run command on Azure Arc-enabled servers is **free to use**, scripts you store in Azure incur billing charges." Source: [Run command on Azure Arc-enabled servers (preview)](https://learn.microsoft.com/azure/azure-arc/servers/run-command), retrieved 2026-07-30.

What that means in money: the run command's blob-adjacent features (`scriptUri` for a staged script, `outputBlobUri` and `errorBlobUri` for output beyond the 4 KB Instance View limit) read and write Azure Storage blobs, so ordinary blob rates apply. Block blob Hot LRS data stored in East US is **0.0208 USD per GB per month** (retail prices API, `serviceName eq 'Storage'`, `meterName eq 'Hot LRS Data Stored'`, East US, first pricing tier, retrieved 2026-07-30). A staged install script of, say, 10 KB costs on the order of **0.0000002 USD per month**. Even staging the Foundry Local MSIX and its `VcLibs.appx` dependency, on the order of a few hundred megabytes, is fractions of a cent per month plus a handful of transaction charges.

**So the honest statement for ADR-0013 and ADR-0021 is: the stored-scripts charge is real, first-party, and financially irrelevant.** The cost of the blob path is not the money. It is the managed-identity exception SPIKE-18 recommendation 2 already identified, because Arc run command "doesn't currently support authenticating blobs by using managed identities" and therefore forces a short-lived SAS URI, which is a secret. Anyone who reads the billing sentence as a reason to avoid the blob path has read the wrong risk. Avoid it, if at all, for the identity reason.

### Q3. Track 2 TCO on a server you already own: what is genuinely zero, and what merely feels zero

The tasking asks for this stated honestly, so here it is in two columns rather than one comfortable number.

**Genuinely zero (no additional cash leaves the building):**

| Item | Why it is genuinely zero |
|---|---|
| The Foundry Local runtime | "There are no per-token costs"; no meter exists in the Azure retail catalogue (Q1) |
| Inference itself | No per-token, per-request, or per-character charge on any surface. Nothing to meter |
| The Arc control plane surface track 2 uses | Inventory, tagging, RBAC, Run Command, SSH Arc, Custom Script Extension are all on the published no-cost list (Q2) |
| The Windows Server licence, if already owned | Already paid. The Arc pay-as-you-go alternative at 0.046 USD per core per hour is the price of *not* owning one, and it is the correct number to quote to anyone who says "the licence is free"; it is not free, it is sunk |
| Azure subscription requirement | None. Foundry Local "runs entirely on local hardware" |
| Staged run-command scripts | Not literally zero, but 0.0208 USD per GB per month makes it zero to two decimal places (Q2) |

**Merely feels zero (a real cost that no invoice line will ever show you):**

| Item | Why it is not zero, and how to price it |
|---|---|
| Hardware amortization | The server has a replacement date. An AI workload consumes some of its remaining useful life and some of its expansion headroom. Price it as (acquisition cost / expected service life in months) x (the fraction of the machine this workload occupies). Both inputs are deployer-supplied; this spike invents neither |
| Power and cooling | A continuous draw, not a burst. Price it as (average additional draw in watts / 1000) x 730 hours x local tariff in USD per kWh, then add the site's cooling multiplier. **No figure is given here because neither the draw nor the tariff is knowable from documentation**, and this repo's rules forbid guessing a number. Note that CPU-only inference pins cores for the duration of every prompt, so the draw during a batch is close to the machine's ceiling, not its idle |
| Opportunity cost of the cores | The binding one. SPIKE-18 measured 8 logical cores and 64 GB on the candidate host and concluded core count, not memory, is the throughput constraint. Anything else that host does competes directly with inference, and Q1's new FAQ answer says Foundry Local does no request queuing or continuous batching, so it will not share gracefully |
| Disk | Multi-GB per cached model (about 4.8 GB for `Phi-4-mini-instruct-generic-cpu`). Cheap on a machine with hundreds of GB free, not free on one that is not |
| Operator time | The largest hidden cost and the one this repo's own research already documents: the MSIX provisioning path rather than `winget`, a documented common post-install "service connection failed" needing `foundry service restart`, model-cache management, and patching. Price it at whatever an hour of the operator's time is worth, times a realistic monthly figure |
| Support position | Microsoft states the product "isn't designed as a server inference stack" (Q1). A production dependency on it carries an unpriced support risk. That is a risk, not a cost, but it belongs in the same honest column |

**Net on Q3: track 2's Azure bill can genuinely be 0.00 USD per month, and its true cost is not zero.** Both halves of that sentence should appear in ADR-0021, because the first half is what makes track 2 attractive and the second half is what stops "it is free" from becoming the reason to choose it.

### Q4. The Azure Local per-core fee, resolved: 0.33, 0.667, and 1.67 USD per physical core per day

This closes SPIKE-19 UNKNOWN #3 and SPIKE-09 UNKNOWN #2.

**What did not work, stated first so the finding is reproducible.** `https://azure.microsoft.com/en-us/pricing/details/azure-local/` was retrieved twice on 2026-07-30 and rendered its host service fee cells as placeholders both times: Azure Local (L1) `$-/physical core/month`, Azure Local (L2) `$-/physical core/month`, Azure Local (L3) `Contact your account representative`. The legacy URL `azure.microsoft.com/en-us/pricing/details/azure-stack/hci/` behaved identically. **So the figure SPIKE-09 recorded (roughly 10 USD per core per month, from a Microsoft Q&A answer and the GitHub Enterprise Local billing page rather than a pricing table) could not be confirmed from the pricing page then and cannot be now.**

**What did work.** The Microsoft retail prices API, which is first party, public, and unauthenticated:

`https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Azure Local'`, retrieved **2026-07-30**, `currencyCode` USD, `customerEntityType` Retail:

| productName | skuName | meterName | unitOfMeasure | retailPrice (USD) | armRegionName |
|---|---|---|---|---|---|
| Azure Local | Standard | Standard Monthly Service Fee | 1/Day | **0.33** | Global |
| Azure Local | L2 - Standard | L2 - Standard Monthly Service Fee | 1/Day | **0.667** | Global |
| Azure Local | L2 - Standard Partner | L2 - Standard Partner Monthly Service Fee | 1/Day | 0.667 | Global |
| Azure Local | L2 - OEM License Step-up | L2 - OEM License Step-up Monthly Service Fee | 1/Day | 0.667 | Global |
| Azure Local | L2 - Standard Trial | L2 - Standard Trial Trial Fee | 1/Day | 0.667 | Global |
| Azure Local | Azure Benefit | Azure Benefit Monthly Service Fee | 1/Day | **0.0** | Global |
| Azure Local | OEM License | OEM License Monthly Service Fee | 1/Day | **0.0** | Global |
| Azure Local | Standard | Standard Trial Fee | 1/Day | **0.0** | Global |
| Azure Local with disconnected operations | Standard | Standard Core | 1/Day | **1.67** | Global |
| Azure Local with disconnected operations | Standard Trial | Standard Trial Core | 1/Day | 0.0 | Global |
| Azure Local with disconnected operations | Standard Partner | Standard Partner Core | 1/Day | 0.0 | Global |

The legacy `serviceName eq 'Azure Stack HCI'` query (same API, same retrieval date) returns a mirror set: `Standard Monthly Service Fee` at 0.33 USD per day, `Standard Trial Fee` at 0.0, `Azure Hybrid Benefit Monthly Service Fee` at 0.0, and `Azure Stack HCI - OEM bundle Monthly Service Fee` at 0.0. Two service names, one rate card, which is the expected shape for a product mid-rename.

**Converting the daily meter to a monthly figure.** The unit is `1/Day` and the meter is per physical core, so the monthly charge depends on the number of days in the month. The tier definitions come from [Azure Local billing and payment](https://learn.microsoft.com/azure/azure-local/concepts/billing) (retrieved 2026-07-30): L1 is hyperconverged with local storage up to 16 nodes; L2 is disaggregated, external storage (SAN), or multi-rack; L3 is disconnected operations with a locally hosted control plane.

| Tier | USD per physical core per day | 30-day month | Average month (30.44 days) | 31-day month |
|---|---|---|---|---|
| L1 (hyperconverged, local storage) | 0.33 | 9.90 | 10.04 | 10.23 |
| L2 (disaggregated, SAN, or multi-rack) | 0.667 | 20.01 | 20.30 | 20.68 |
| L3 (disconnected operations) | 1.67 | 50.10 | 50.80 | 51.77 |
| Azure Hybrid Benefit (`Azure Benefit` SKU) | 0.00 | 0.00 | 0.00 | 0.00 |
| Trial (L1 and disconnected, 60 days from registration) | 0.00 | 0.00 | 0.00 | 0.00 |

**Verdict on SPIKE-09's remembered figure: it was right, and it is now sourced.** "Roughly 10 USD per core per month" is what 0.33 USD per core per day produces. The improvement is not the number, it is that the number now has a first-party origin and a retrieval date, so it can be re-checked rather than re-remembered.

**Four caveats that belong in ADR-0021 rather than a footnote.**

- **The daily meter is the published fact; the round monthly list price is an inference.** Do not write "10.00 USD per core per month" into an ADR as if Microsoft published it. Write "0.33 USD per physical core per day, retrieved 2026-07-30, about 9.90 to 10.23 USD per core per month depending on month length."
- **The `L2 - Standard Trial` meter is rated 0.667, not 0.0**, unlike the L1 and disconnected trial meters. Whether that is a catalogue artefact or means L2 deployments genuinely have no free trial is not something the retail API can tell you. Recorded as an unknown below.
- **L3 has a public rate even though the pricing page says "Contact your account representative."** The page routes you to a seller; the catalogue publishes 1.67 USD per core per day. Treat the catalogue rate as the list rate and the rep conversation as where agreement-specific terms land, not as where the number is invented.
- **The charge is on physical cores present, not on VMs or vCPUs, with no minimum and no maximum.** "You still pay based on the number of physical cores that are present in the system." Source: [Azure Local billing and payment](https://learn.microsoft.com/azure/azure-local/concepts/billing). This is what makes the fee a fixed cost rather than a usage cost, and it is the fact that breaks ADR-0006.

### Q5. The Windows Server guest add-on is 23.3 USD per physical core per month, and Azure Hybrid Benefit waives it and the host fee together, on L1 only

**The figure rendered.** Unlike the host service fee cells, the Windows Server row on the Azure Local pricing page renders a real number in both fetches this session: **"Windows Server subscription: $23.3/physical core/month."** Source: [Azure Local pricing](https://azure.microsoft.com/en-us/pricing/details/azure-local/), retrieved 2026-07-30. This confirms SPIKE-09's recorded roughly 23.30 USD from a rendered first-party page rather than from a Q&A answer.

It applies only if you run Windows Server guests. [Azure Local billing and payment](https://learn.microsoft.com/azure/azure-local/concepts/billing) puts it this way: "Azure Local doesn't require a traditional on-premises software license, although guest virtual machines (VMs) might require individual operating system licensing."

**Scale check, because the ratio is the surprising part.** On a 16-physical-core L1 node running Windows Server guests, the guest add-on at 23.3 USD per core per month is about **372.80 USD per month**, against a host fee of about **158.40 USD per month**. The guest licensing is roughly **2.35 times** the platform fee. Anyone sizing track 3 from the host fee alone will be out by more than a factor of three.

**Directly relevant to track 3 as scoped:** SPIKE-19 established that Foundry Local's GPU node pools are Linux-only and that the first increment is a CPU Linux worker pool at `Standard_D8s_v3` or better. **A track 3 increment that runs only Linux AKS Arc nodes does not trigger the Windows Server guest add-on at all.** That is a real design lever, and it should be recorded as one: keeping the Foundry Local workload on Linux guests keeps the largest line item off the bill.

**Azure Hybrid Benefit, exactly as published.** The Azure Local pricing page states that AHB is available for **L1 deployments** with Windows Server Datacenter and **active Software Assurance**, allowing core licences to be exchanged so as to waive **both** the host service fee and the Windows Server subscription charges, and that it is **not available for L2 and L3** (retrieved 2026-07-30).

The retail catalogue corroborates the mechanism rather than describing it: AHB is not a discount percentage applied to the Standard meter, it is **a separate SKU with its own meter rated at 0.00 USD** (`Azure Local / Azure Benefit / Azure Benefit Monthly Service Fee`, 1/Day, 0.0 USD, and its legacy twin `Azure Stack HCI - Software Assurance / Azure Hybrid Benefit Monthly Service Fee`, 1/Day, 0.0 USD). Retrieved 2026-07-30. An eligible system moves to the zero-rated meter; it does not get a reduced Standard rate.

**The consequence for ADR-0021 is sharp.** With AHB in force on an L1 system, **track 3's Azure host fee is 0.00 USD per month**, and every break-even calculation in Q9 collapses. Whether AHB entitlement exists is therefore not a finance footnote, it is the single largest determinant of track 3's cost, and it is a question about licence entitlements the deployer holds, which no research can answer. It is in the unknowns table.

### Q6. Nothing above the host fee: no extension charge, no AKS Arc charge, no Arc connection charge, and no per-token inference charge

Taken in order.

- **The Arc connection itself is free.** Inventory, tagging, resource-group and subscription organisation, and RBAC are on the Arc core control plane no-cost list (Q2). An Arc-connected cluster costs nothing to be connected.
- **AKS enabled by Azure Arc is included.** The Azure Local pricing page lists it under add-on workloads as "**Included with Azure Local, 2402 release and later**" (retrieved 2026-07-30). The retail catalogue agrees from the other direction: `serviceName eq 'Azure Arc-enabled AKS'` returns twelve items, all of them `Service Fee/Core` or `Trial Fee/Core` at unit `1/Day` and **retailPrice 0.0 USD**, across `AKS on Windows Server` and `AKS on VMware`. There is no `AKS on Azure Local` product in the catalogue, which is consistent with it being folded into the Azure Local meter rather than billed separately. Retrieved 2026-07-30.
- **The `Microsoft.Foundry` cluster extension has no meter.** `contains(productName, 'Foundry Local')` returns an empty result set (Q1), and no page in the Foundry Local on Azure Local documentation set states a price, a meter name, or a consumption unit.
- **There is no per-token inference charge.** Inference runs on cores you already pay the host fee for. No page in the product's documentation names a token, request, or character meter, and no such meter exists in the retail catalogue. This is the structural inverse of the cloud track, where SPIKE-01 and SPIKE-05 confirm token-metered image billing and per-character voice billing.

**The one honest caveat, and it is not a small one.** SPIKE-09 cited the GitHub Enterprise Local billing page for the statement that **AI services are billed separately from the Azure Local host charge**. That sentence and the current absence of a Foundry Local meter are not in conflict today, because the product is public preview by request and preview features frequently ship unmetered. They may well be in conflict at general availability. **So the correct claim is: there is no inference charge during preview, evidenced by the absence of any meter, and whether one appears at GA is unknown and is a preview risk, not a settled fact.** ADR-0021 should record it as a preview risk in the same register as SPIKE-19 UNKNOWN #2 (preview-to-GA timeline and SLA) rather than assert that on-prem inference is permanently free.

### Q7. Disconnected operations is not a separately priced appliance, it is a higher per-core rate, plus three non-monetary gates

**The money.** There is no separate appliance SKU, no per-appliance fee, and no hardware charge from Microsoft. Disconnected operations is **a different billing tier applied to the whole system**: `Azure Local with disconnected operations / Standard / Standard Core`, unit `1/Day`, **1.67 USD** per physical core (retail prices API, retrieved 2026-07-30). That is about **5.06 times the L1 rate**, or roughly 50.10 USD per physical core per 30-day month. A trial meter exists at 0.0.

**What that rate is actually buying** is a local control plane: [Disconnected operations for Azure Local overview](https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-overview) (retrieved 2026-07-30) describes a locally hosted Azure portal, ARM, RBAC, system-assigned managed identity, Arc-enabled servers, Azure Local VMs, AKS enabled by Arc (preview), Azure Container Registry, Azure Key Vault, and Azure Policy, all running on-premises.

**The three costs that are not on any rate card, and which are the real barrier:**

1. **Dedicated hardware for the control plane.** "To run Azure Local with disconnected operations, it's essential to plan for extra capacity for the virtual appliance. The minimum hardware requirements to deploy and operate Azure Local in a disconnected environment are higher because you need to host a local control plane." And: "You must bring your own Azure Local hardware and **deploy a dedicated management cluster**." Supported hardware is narrowed to **Premier Solutions for Azure Local**. Source: same page. So the appliance is free as software and expensive as a dedicated management cluster whose physical cores are themselves billable at the 1.67 rate.
2. **An eligible agreement. "The Microsoft online subscription program (MOSA) isn't eligible."** Source: same page. This is a hard procurement gate, not a price.
3. **An active support plan, Standard or higher**, with Microsoft or through a partner. Source: same page. That is a recurring cost this spike does not price.

Access is gated by a qualification form with a stated response window of 10 business days, and approval is not guaranteed.

**Net on Q7: for this repo, disconnected operations is out of scope on cost and on eligibility, and it should be recorded as such rather than left as an open option.** It multiplies the per-core rate by about five, requires a second dedicated cluster, requires an agreement type and a paid support plan, and buys sovereignty this initiative has not stated a need for. SPIKE-19 correctly noted the disconnected path exists and changes the install mechanism; the cost finding is that it changes the economics far more.

### Q8. Where a hard spend cap can actually be enforced. This is the ADR-0021 question

First, restate precisely what ADR-0006 decided, because the failure is specific and not general:

| ADR-0006 layer | Mechanism | What it presupposes |
|---|---|---|
| 1. Real cap (synchronous, pre-spend) | A pipeline budget-guard flag and per-month ledger, evaluated client-side **before each metered call** | That there **is** a metered call, and that its cost is knowable before it is made |
| 2. Backstop (reactive, notify-only) | A resource-group-scoped Azure budget with actual and forecast alerts | That the spend lands on an **Azure resource inside a resource group** |
| 3. Invoice stop | The Azure subscription spending limit, kept ON | Only that there is an Azure subscription |

Now test each layer against each track.

#### Track 2: layer 1 is meaningless, layer 2 reaches only the add-ons, layer 3 survives

| Layer | Status on track 2 | Why |
|---|---|---|
| 1. Pipeline guard | **Cannot exist, and would be pointless if it did** | There is no metered call to refuse. The marginal cost of one more token on track 2 is exactly zero. A guard that refuses a free call protects nothing. This is not a gap to fill, it is a layer that has no referent |
| 2. RG budget | **Reaches a real but small and entirely optional surface** | The Arc-enabled server **is** an Azure resource (`Microsoft.HybridCompute/machines`) in a resource group, so an RG-scoped budget works mechanically. What it can see is the Q2 add-on list and nothing else: Update Manager, guest configuration, Defender, Log Analytics ingestion, blob storage, and Arc pay-as-you-go Windows Server if used. It cannot see the runtime, the models, the inference, the electricity, or the hardware, because none of those is an Azure meter |
| 3. Spending limit | **Survives unchanged** | Subscription-level, indifferent to what the workload is |

**What ADR-0006 cannot reach on track 2, stated plainly:** everything that actually costs anything. The Foundry Local runtime has no Azure resource, no meter, no RBAC surface ("Azure RBAC: Not applicable"), no Entra authentication on its local endpoint, and no Azure Monitor presence. SPIKE-18 Q6 put it correctly and this spike confirms it from the cost side: **Arc governs the act of installing and configuring, not the running inference service.** A budget over track 2 governs the management overhead, not the workload.

**Proposed replacement for track 2, offered for ADR-0021 to decide, not decided here.** Three parts, none of which is a dollar cap:

1. **An enablement decision list, not a budget.** Because every Azure charge on track 2 is an opt-in add-on with a published per-server flat rate, the effective control is a documented decision, per add-on, to switch it on or leave it off, with the monthly cost of the chosen set written down. Five add-ons at published rates is an arithmetic problem, not a governance problem. The only volume-driven item is Log Analytics ingestion, so if it is enabled it deserves a separate ingestion cap or a data-collection rule that limits what is collected.
2. **A capacity guardrail in place of a spend guardrail.** Track 2's scarce resource is CPU time and wall clock, not money. The analogue of ADR-0006's pre-spend ledger is a pre-run capacity check: a documented allow list of models permitted on the host (so a 20B model is not pulled onto an 8-core box by accident), a bound on concurrent inference (Microsoft states the runtime does no request queuing or continuous batching, so concurrency must be bounded outside it), and a wall-clock timeout per call. These refuse work before it starts, which is the property ADR-0006 valued in layer 1, applied to the resource that is genuinely constrained.
3. **A small RG budget as an anomaly detector.** Set it at the arithmetic total of the enabled add-ons plus headroom. Its job is not to cap. Its job is to fire if something was enabled that nobody decided to enable, or if log ingestion runs away. That is a legitimate and narrow use of a notify-only mechanism.

#### Track 3: layer 1 is meaningless for a different reason, layer 2 is useful but for a different job, layer 3 survives

| Layer | Status on track 3 | Why |
|---|---|---|
| 1. Pipeline guard | **Cannot exist, and is not needed** | The host fee is per physical core per day and, per the billing documentation, does not vary with the number of VMs or vCPUs. There is no per-call cost to refuse. Refusing an inference call saves 0.00 USD |
| 2. RG budget | **Works mechanically, and its useful job is not capping** | The Azure Local instance is an Azure resource in a resource group, so RG budgets, tags, and Cost Analysis all apply exactly as ADR-0006 describes. But the amount it would guard is deterministic in advance: cores x rate x days. A budget alert on a fixed fee tells you only what you could have calculated. Its real value is detecting the two drift modes below |
| 3. Spending limit | **Survives unchanged, and matters more here than on track 2** | Track 3 is the only local track that generates a continuous Azure charge, so the invoice-side stop is genuinely load-bearing |

**Track 3 has two documented ways to bleed money, and no spend cap addresses either.** These are the actual governance findings:

1. **Silent tier escalation.** "Billing is updated **automatically** when you add or remove external storage, so charges always reflect the capabilities currently in use," and after the applicable trials "billing automatically switches to Azure Local (L2)." Source: [Azure Local billing and payment](https://learn.microsoft.com/azure/azure-local/concepts/billing), retrieved 2026-07-30. Adding external storage or moving to a multi-rack topology **roughly doubles the per-core rate**, from 0.33 to 0.667 USD per core per day, with no purchase order, no approval step, and no confirmation dialog. An infrastructure change silently reprices the platform. **This is exactly the case a rear-view budget alert is good at**, which is a pleasant irony: ADR-0006's weakest layer is track 3's most useful one, but only if the budget is set to the L1 forecast rather than to a round number, so that an L2 transition actually breaches it.
2. **Billing for a decommissioned system.** "If you shut down or decommission your system **without deleting the Azure Local resource in Azure, billing continues** until the Azure Local resource in Azure is disconnected for more than 31 days. To avoid unexpected charges, delete the Azure Local resource in Azure when you decide to decommission the cluster." Source: same page. Powering off the hardware does not stop the meter. No budget, no spending limit, and no policy prevents this; only a lifecycle step does.

**Proposed replacement for track 3, offered for ADR-0021 to decide, not decided here.** Also three parts:

1. **A committed forecast in place of a cap.** Because the fee is deterministic, the design should state it as arithmetic, not as a ceiling: `physical cores x tier daily rate x days in month`, plus `Windows-guest physical cores x 23.3` if any Windows guests exist, or `0.00` if Azure Hybrid Benefit applies on an L1 system. The forecast is checkable by anyone, is stable month to month, and needs no measurement. The true cap is the **core count**, and it is set at procurement, not at runtime. That is worth saying in one sentence in the ADR: **on track 3, the spend decision is made when hardware is bought, not when a model is called.**
2. **A budget whose job is drift detection, set to the forecast plus a small margin.** Roughly 110 percent of the L1 forecast, so that an L2 transition (about a doubling) breaches it immediately and unmistakably, while ordinary month-length variation (9.90 to 10.23 USD per core) does not. Actual-cost thresholds only. A forecast alert on a flat fee adds nothing.
3. **A decommission control as a first-class governance item, not a runbook footnote.** An explicit, owned step that deletes the Azure Local ARM resource on decommission, plus a periodic check that no Azure Local resource exists for a system that is no longer running. This is the only control that addresses the 31-day continued-billing behaviour, and it is not a financial control at all, which is precisely why ADR-0006's framing misses it.

#### The one-paragraph answer ADR-0021 needs

**ADR-0006's three layers assume two things that no local track provides together: usage-metered spend, and an Azure resource that meters it.** Track 2 provides neither, so its layer 1 has no referent and its layer 2 sees only optional management add-ons. Track 3 provides the resource but not the usage metering, so its layer 1 has no referent and its layer 2 changes job from backstop to drift detector. **Layer 3, the subscription spending limit, is the only one of the three that transfers unchanged to both tracks**, because it is scoped to the subscription rather than to a workload. The replacement is therefore not a different cap. It is a different control type per track: **a capacity guardrail plus an add-on enablement decision on track 2, and a committed forecast plus a drift detector plus a decommission control on track 3.** ADR-0021 should say that ADR-0006 remains correct and unamended for the cloud track, and is scoped to it, rather than trying to stretch it across all three.

### Q9. Worked break-even: illustration only, not a quote

**Labelled clearly: this is an illustration constructed from retrieved list rates. It is not a quote, not an offer, and not a prediction of any deployment's cost.**

**Assumptions, every one stated:**

| # | Assumption | Basis |
|---|---|---|
| A1 | The workload is text-only reviewer inference, the same model class on both sides: locally `Phi-4-mini-instruct-generic-cpu` on the `onnx-genai` CPU runtime (SPIKE-19 Q3), in the cloud `Phi-4-Mini` on Foundry Models | Makes the comparison like-for-like rather than comparing a small local model to a frontier cloud model |
| A2 | Cloud rate, `Phi-4-Mini-Input`: **0.000075 USD per 1K tokens = 0.075 USD per 1M tokens** | Retail prices API, `contains(meterName, 'Phi-4') and armRegionName eq 'eastus'`, serviceName `Foundry Models`, retrieved 2026-07-30 |
| A3 | Cloud rate, `Phi-4-Mini-Output`: **0.0003 USD per 1K tokens = 0.30 USD per 1M tokens** | Same query and date |
| A4 | Token mix **70 percent input, 30 percent output**. A reviewer reads a long artefact and writes a short verdict | Assumed, not measured. This is the softest assumption in the calculation and it is a design choice, not a fact |
| A5 | Blended cloud rate = (0.7 x 0.075) + (0.3 x 0.30) = 0.0525 + 0.09 = **0.1425 USD per 1M tokens** | Arithmetic from A2, A3, A4 |
| A6 | Local fixed cost = one Azure Local **L1** node with **16 physical cores**, 30-day month, **no** Azure Hybrid Benefit: 16 x 0.33 x 30 = **158.40 USD per month** | Q4 rate, retrieved 2026-07-30. Core count assumed for illustration |
| A7 | Linux-only AKS Arc worker nodes, so **no** Windows Server guest add-on | Q5, and SPIKE-19's Linux-only GPU and CPU worker pools |
| A8 | Excluded from both sides: hardware capex, power, cooling, floor space, operator time, GPU, network, any commitment or agreement discount, and the cloud side's zero fixed cost | Stated so the result is not mistaken for a full TCO |

**The arithmetic:**

Break-even monthly token volume = (local fixed monthly cost) / (blended cloud rate per 1M tokens), expressed in millions of tokens.

= 158.40 / 0.1425 = **1,111.6 million tokens, about 1.11 billion tokens per month.**

**The sanity check that makes the number mean something.** 1.11 billion tokens per month, spread evenly across a 30-day month, is 1,111,600,000 / (30 x 86,400) = **about 429 tokens per second, sustained, twenty-four hours a day, every day.** Both SPIKE-18 (UNKNOWN #2) and SPIKE-19 (UNKNOWN #7) record CPU-only throughput for a roughly 5 GB quantized model as unmeasured and unpublished, so this spike does not claim a tokens-per-second figure. What it can say is that 429 tokens per second sustained continuously from CPU-backed ONNX inference on a small worker pool is not a plausible target, which means **the break-even volume is not reachable by track 3's CPU-only first increment.**

**The same arithmetic across four cases:**

| Case | Local fixed cost per 30-day month | Blended cloud rate per 1M tokens | Break-even volume | Sustained rate implied |
|---|---|---|---|---|
| 16 cores, L1, no AHB, cloud `Phi-4-Mini` | 158.40 USD | 0.1425 USD | about 1.11 billion tokens per month | about 429 tokens per second |
| 16 cores, L1, no AHB, cloud `Phi-4` (input 0.125, output 0.50 per 1M) | 158.40 USD | 0.2375 USD | about 667 million tokens per month | about 257 tokens per second |
| 32 cores (two 16-core nodes), L1, no AHB, cloud `Phi-4-Mini` | 316.80 USD | 0.1425 USD | about 2.22 billion tokens per month | about 858 tokens per second |
| **Any core count, L1, with Azure Hybrid Benefit** | **0.00 USD** | any | **zero tokens** | not applicable |

The `Phi-4` rates in row 2 are from the same retrieved query as A2 and A3 (`Phi-4-Input` 0.000125 USD per 1K, `Phi-4-Output` 0.0005 USD per 1K).

**Three readings, in order of importance:**

1. **With Azure Hybrid Benefit, the comparison is over before it starts.** The host fee moves to a 0.00-rated meter (Q5), so the Azure charge is zero at any volume and the local track wins on Azure cost immediately. Everything then turns on hardware, power, and operator time, which are exactly the costs Q3 says feel zero and are not. **The single most decision-relevant question in this entire spike is whether AHB entitlement exists**, and it is a licensing question, not a research one.
2. **Without AHB, and if the hardware is bought for this workload, break-even is unreachable at any volume this initiative will generate.** SPIKE-05's cloud rollup put the whole first proven build's steady state at a few dollars per month against a cap in the tens of dollars. A billion tokens per month is several orders of magnitude beyond that.
3. **Break-even is the wrong frame if the cluster exists anyway, and this is the point that should survive into ADR-0021.** The host fee buys the whole system, not the AI workload. If the physical cores are already being paid for because the cluster runs other things, the **marginal** Azure cost of adding a Foundry Local extension and a `ModelDeployment` is **0.00 USD**, because the extension has no meter, AKS Arc is included, and inference is not metered (Q6). Break-even analysis only applies if you would buy Azure Local **for** the AI workload. If you would not, do not compute it, and do not let a break-even number that assumes you would drive the decision. SPIKE-09 reached the same conclusion qualitatively ("it depends almost entirely on hardware already owned"); this spike supplies the arithmetic that shows how lopsided the dependence is.

---

## Cost summary table for both tracks

Every figure retrieved 2026-07-30. Ranges reflect month length where the underlying meter is daily.

| Line item | Track 2 (Windows Server) | Track 3 (Azure Local) |
|---|---|---|
| Foundry Local runtime | 0.00 USD | 0.00 USD (no meter) |
| Inference (per token, request, or character) | 0.00 USD | 0.00 USD during preview; GA behaviour unknown |
| Platform or host fee | None | L1 0.33, L2 0.667, L3 1.67 USD per physical core per day (about 9.90 / 20.01 / 50.10 per 30-day month); 0.00 with AHB on L1 |
| Kubernetes | Not applicable | AKS enabled by Azure Arc included with Azure Local 2402 and later; all Arc-enabled AKS meters rated 0.00 USD |
| `Microsoft.Foundry` cluster extension | Not applicable | No meter exists |
| Arc connection, inventory, tags, RBAC | 0.00 USD | 0.00 USD |
| Arc Run Command and SSH Arc | 0.00 USD ("free to use") | Not the primary mechanism |
| Windows Server guest licensing | Already owned (sunk), or 0.046 USD per core per hour via Arc pay as you go if not | 23.3 USD per physical core per month if Windows guests run; 0.00 with AHB on L1; not triggered by a Linux-only worker pool |
| Azure Update Manager | 5 USD per server per month, optional | Optional |
| Azure Policy guest configuration | 6 USD per server per month, or 0.009 per server per hour, optional | Optional |
| Defender for Servers P1 / P2 | 0.00672 / 0.02 USD per node per hour, optional | Optional |
| Log Analytics ingestion | Basic 0.50, Auxiliary 0.05 USD per GB; **Analytics tier UNKNOWN**; first 5 GB per month per billing account free in the Analytics tier | Same |
| Blob storage for staged run-command scripts and logs | 0.0208 USD per GB per month (Hot LRS, East US); financially negligible | Not applicable |
| Disconnected operations | Not applicable | 1.67 USD per physical core per day, plus a dedicated management cluster, an eligible agreement (MOSA excluded), and a Standard-or-higher support plan |
| Hardware, power, cooling, operator time | Real, deployer-supplied, invisible to Azure | Real, deployer-supplied, invisible to Azure |

---

## What is still UNKNOWN

| # | Unknown | Why it is not resolvable from documentation | What resolves it |
|---|---|---|---|
| 1 | **Whether Azure Hybrid Benefit entitlement exists for the target system.** This is the highest-leverage unknown in the spike: with it, track 3's Azure host fee is 0.00 USD and every break-even in Q9 collapses to zero. | It depends on Windows Server Datacenter licences with **active Software Assurance** held by the deployer, and on the system being L1. It is an entitlement question, not a pricing question. | Check the licence entitlements and SA status held by the organisation, and confirm the deployment is L1 (hyperconverged, local storage, no SAN, no multi-rack). Deployer input; no research can supply it. |
| 2 | **The Azure Monitor Analytics Logs pay-as-you-go per-GB ingestion rate.** The only volume-driven, and therefore the only runaway-capable, Arc add-on. | The pricing page renders `$- per GB`; the retail query for SKU `Analytics Logs` in East US returned an empty result set, so the meter is named differently in the catalogue. | Re-query the retail prices API with the correct SKU or meter name (try `contains(meterName, 'Data Ingestion')` without a SKU filter and read the full item list), or read the rate in the Azure pricing calculator. Read-only, resolvable now. |
| 3 | **Whether the `L2 - Standard Trial` meter rated at 0.667 rather than 0.0 means L2 deployments genuinely have no free trial.** The L1 and disconnected trial meters are both 0.0; only the L2 trial meter carries the full rate. | The retail catalogue publishes rates, not policy. The billing documentation describes a 60-day trial for new SAN-only L2 deployments, which reads as inconsistent with a fully rated trial meter. | Ask an account representative, or observe the actual meter on a real L2 registration. Not blocking for any CPU-only L1 increment. |
| 4 | **Whether the `Microsoft.Foundry` extension or its inference remains unmetered at general availability.** | The product is public preview by request. The GitHub Enterprise Local billing page states AI services are billed separately from the Azure Local host charge, which does not contradict a preview with no meter but may foreshadow a GA meter. | Re-query `contains(productName, 'Foundry Local')` against the retail prices API at GA, and re-read the Azure Local pricing page's add-on workloads table. Carry as a preview risk until then. |
| 5 | **Per-model licence terms for the models each track would actually run.** Carried unchanged from SPIKE-18 UNKNOWN #6. The runtime being free says nothing about the models. | Licences are per model and not summarized centrally. | `foundry model info <model> --license` on track 2; read the catalogue entry's licence field on track 3. |
| 6 | **Power draw and the deployer's electricity tariff**, and therefore the real running cost of both tracks. | Neither is discoverable from any Microsoft source, and this repo's rules forbid inventing a number. | Measure the host's draw under sustained inference load with a metered PDU or the server's own power telemetry, then apply the site's actual tariff. The formula is in Q3; only the two inputs are missing. |
| 7 | **Hardware amortization for the specific machines in scope.** | Acquisition cost and expected service life are deployer facts. | Deployer input at design time. Q3 gives the formula. |
| 8 | **Real CPU-only throughput in tokens per second for a roughly 5 GB quantized model**, which is what converts Q9's break-even from an arithmetic result into a statement about whether any volume is achievable. | No CPU latency or throughput table is published for either product. Carried from SPIKE-18 UNKNOWN #2 and SPIKE-19 UNKNOWN #7. | The same single measurement closes it for both tracks: time a fixed reviewer-sized prompt and record tokens per second. Track 2's needs one authorized install test; track 3's needs a cluster. |
| 9 | **Whether Change Tracking and Inventory on Arc-enabled servers carries a charge beyond its Log Analytics ingestion.** | Not verified first-party this session. The Arc pricing page enumerates billable add-ons but this spike did not confirm Change Tracking's specific billing mechanism. | Read the Change Tracking and Inventory documentation's pricing section and the Arc core control plane pricing page's full add-on table. Read-only, resolvable now, and immaterial if the add-on is simply left off. |

---

## Recommendation

1. **Write ADR-0021 to scope ADR-0006 to the cloud track rather than to amend it.** ADR-0006 is correct where it applies and its three layers are internally sound. The error would be stretching it. State in one line that ADR-0006 governs usage-metered Azure spend on the cloud track, and that the local tracks need a different control type because they have no metered call to refuse. Nothing in ADR-0006 needs to change; its scope statement does.

2. **For track 2, replace the spend cap with an add-on enablement decision plus a capacity guardrail.** Track 2's Azure bill can genuinely be 0.00 USD per month, and every non-zero line is an opt-in add-on at a published per-server flat rate (Q2). So the control is a written decision per add-on with the arithmetic total recorded, not a budget. The thing that actually needs a synchronous pre-flight refusal is capacity, not money: a model allow list, a concurrency bound (necessary because Microsoft states the runtime does no request queuing or continuous batching), and a per-call wall-clock timeout. Add a small RG budget over the Arc machines' resource group set to the enabled-add-on total, and give it the honest job title of anomaly detector.

3. **For track 3, replace the cap with a committed forecast, a drift detector, and a decommission control.** The forecast is deterministic arithmetic: `physical cores x tier daily rate x days`, plus the Windows guest add-on only if Windows guests exist, or zero if AHB applies on L1. Set the budget to about 110 percent of the L1 forecast with actual-cost thresholds only, so that a silent L1-to-L2 transition (about a doubling, triggered automatically by adding external storage or moving to multi-rack) breaches it unmistakably while month-length variation does not. Make deleting the Azure Local ARM resource on decommission an owned governance step, because billing continues for 31 days after disconnection otherwise and no financial control prevents it.

4. **Record the resolved per-core figures with their unit, source, and retrieval date, and resist rounding them into a monthly list price.** Write "0.33 USD per physical core per day (Microsoft retail prices API, retrieved 2026-07-30), about 9.90 to 10.23 USD per core per month depending on month length," not "10 USD per core per month." The daily meter is the published fact. SPIKE-19 UNKNOWN #3 and SPIKE-09 UNKNOWN #2 can both be marked closed against this spike.

5. **Adopt the Microsoft retail prices API as this repo's standard price-verification surface, and say so somewhere durable.** Three prior spikes recorded an unconfirmed rate card because the Azure pricing pages are client-rendered widgets that return `$-` to any non-browser fetch. `https://prices.azure.com/api/retail/prices` is first-party, public, unauthenticated, returns JSON, and resolved four figures this session that those spikes could not. It is also read-only and touches no subscription, so it satisfies this repo's Azure gate without any confirmation. **SPIKE-05 UNKNOWN #2 (the image rate card unconfirmed from a rendered first-party page) is very likely resolvable the same way and should be retried**, which would close a standing gate on the cloud track's spend authorization.

6. **Keep track 3's first increment on Linux-only worker nodes, and record that as a cost decision as well as an architecture one.** The Windows Server guest add-on at 23.3 USD per physical core per month is about 2.35 times the L1 host fee on a 16-core node. SPIKE-19 already scoped the first increment to a Linux CPU worker pool for technical reasons; that choice also keeps the single largest potential line item off the bill entirely, and the ADR should say so rather than let a later reader reintroduce Windows guests without seeing the price.

7. **Rule disconnected operations out on cost and eligibility, explicitly, rather than leaving it open.** It is about five times the L1 per-core rate, requires a second dedicated management cluster on Premier Solutions hardware whose own cores are billable, requires an agreement type that excludes the Microsoft online subscription program, and requires a paid Standard-or-higher support plan. SPIKE-19 correctly documented it as a third deployment path; this spike's contribution is that its economics put it out of scope for this initiative, and an explicit exclusion is cheaper than repeatedly re-evaluating it.

8. **Carry the "no inference meter" finding as a preview risk, not as a permanent property.** During preview there is no Foundry Local meter in the Azure retail catalogue and no documented per-token charge, which is strong evidence for today. It is not a commitment about general availability, and the GitHub Enterprise Local billing page's statement that AI services are billed separately from the host charge is a real reason to re-check at GA. One re-query of the retail API closes it.

9. **Do not let the Q9 break-even drive the track 3 decision, and say why in the ADR.** The arithmetic is included because the tasking asked for it and because it is a useful sanity check, but its honest conclusion is that break-even is the wrong frame. If the Azure Local system exists for other reasons, the marginal Azure cost of adding Foundry Local is 0.00 USD and the break-even question never arises. If it does not exist, the volume required to justify buying it for this workload alone (on the order of a billion tokens per month at small-model rates) is several orders of magnitude beyond anything this initiative generates. The reason to run track 3 is data residency, sovereignty, latency, or reuse of hardware already justified, and the ADR should say that in place of a cost argument rather than alongside one.

**Net:** both local tracks are cheap in Azure terms and neither is free in real terms, the exact per-core figures are now sourced rather than remembered, and ADR-0006's central mechanism (a synchronous pre-spend guard on a metered call) has no referent on either track. The replacement is not a smaller cap. It is a forecast, a drift detector, a decommission control, and a capacity guardrail, distributed differently across the two tracks because their cost structures differ from each other almost as much as they differ from the cloud.

---

## Sources

All first-party Microsoft. Every page and API query in this list was retrieved on **2026-07-30** during this session unless stated otherwise. No authenticated call was made and no subscription was queried.

**Pricing surfaces (retrieved 2026-07-30):**

- Microsoft retail prices API, `serviceName eq 'Azure Local'` (L1 0.33, L2 0.667, disconnected operations 1.67, Azure Benefit 0.0, OEM License 0.0, trial meters, all unit `1/Day`, USD, Global and US Gov): <https://prices.azure.com/api/retail/prices>
- Microsoft retail prices API, `serviceName eq 'Azure Stack HCI'` (legacy mirror of the same rate card; Azure Hybrid Benefit Monthly Service Fee 0.0)
- Microsoft retail prices API, `serviceName eq 'Azure Arc-enabled AKS'` (all Service Fee/Core and Trial Fee/Core meters rated 0.0 USD)
- Microsoft retail prices API, `contains(productName, 'Foundry Local')` (empty result set: no meter exists)
- Microsoft retail prices API, `contains(productName, 'Windows Server') and armRegionName eq 'Global'` (`Az Arc Pay As You Go Windows Server`, 1 Core License, 0.046 USD per hour; Azure Management License 0.0)
- Microsoft retail prices API, `contains(productName, 'Defender for Servers')` (Standard P1 Node 0.00672 USD per hour, Standard P2 Node 0.02 USD per hour)
- Microsoft retail prices API, `serviceName eq 'Azure Monitor' and armRegionName eq 'eastus' and contains(meterName, 'Data Ingestion')` (Basic Logs 0.50 USD per GB, Auxiliary Logs 0.05 USD per GB)
- Microsoft retail prices API, `serviceName eq 'Storage' and armRegionName eq 'eastus' and meterName eq 'Hot LRS Data Stored'` (Block Blob Hot LRS 0.0208 USD per GB per month, first tier)
- Microsoft retail prices API, `contains(meterName, 'Phi-4') and armRegionName eq 'eastus'` (serviceName `Foundry Models`: Phi-4-Mini-Input 0.000075, Phi-4-Mini-Output 0.0003, Phi-4-Input 0.000125, Phi-4-Output 0.0005, all USD per 1K tokens)
- Azure Local pricing (Windows Server subscription 23.3 USD per physical core per month, rendered; AKS enabled by Azure Arc included with 2402 and later; Azure Hybrid Benefit terms, L1 only; 60-day free trial; **host service fee cells rendered as `$-` placeholders**): <https://azure.microsoft.com/en-us/pricing/details/azure-local/>
- Azure Arc pricing, core control plane (free inventory, management including SSH Arc and Run Command and Custom Script Extension, and VM self-service; Azure Update Manager 5 USD per server per month; Azure Policy guest configuration 6 USD per server per month or 0.009 per server per hour; Defender and Monitor figures rendered as `$-`): <https://azure.microsoft.com/en-us/pricing/details/azure-arc/core-control-plane/>
- Azure Monitor pricing (first 5 GB per month per billing account free in the Analytics Logs tier; **per-GB figures rendered as `$-` placeholders**): <https://azure.microsoft.com/en-us/pricing/details/monitor/>
- Microsoft Defender for Cloud pricing (**both Defender for Servers plan figures rendered as `$-` placeholders**): <https://azure.microsoft.com/en-us/pricing/details/defender-for-cloud/>
- Azure Stack HCI legacy pricing URL (**same `$-` placeholder behaviour**): <https://azure.microsoft.com/en-us/pricing/details/azure-stack/hci/>

**Documentation (retrieved 2026-07-30):**

- Azure Local billing and payment (flat rate per physical processor core, independent of VM and vCPU count; L1, L2, and L3 tier definitions; automatic tier switch when external storage is added; 60-day and 30-day trials; the 31-day continued-billing behaviour after decommission without deleting the ARM resource; guest VM OS licensing note; 30-day connection requirement): <https://learn.microsoft.com/azure/azure-local/concepts/billing>
- Disconnected operations for Azure Local overview (dedicated management cluster and higher minimum hardware, Premier Solutions requirement, MOSA ineligibility, Standard-or-higher support plan requirement, supported services list, qualification form and 10-business-day response): <https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-overview>
- What is Foundry Local? ("There are no per-token costs and no backend infrastructure to maintain"; "Is an Azure subscription required? No"; the new "Can Foundry Local run on a server?" answer stating it is not designed as a server inference stack and does no request queuing, continuous batching, or GPU sharing): <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>
- Run command on Azure Arc-enabled servers (preview) ("free to use, scripts you store in Azure incur billing charges"; no managed-identity support for blob authentication; `scriptUri`, `outputBlobUri`, and `errorBlobUri` SAS requirements; the 4 KB Instance View limit; RBAC split; agent block list): <https://learn.microsoft.com/azure/azure-arc/servers/run-command>

**Sibling documents in this repo (read as grounding, not re-verified here):**

- `docs/research/SPIKE-05-cost-governance.md` (the cloud cost and governance model this parallels; the budget-is-notify-only fact; the pipeline hard stop; tag scheme; EA-only credit alerts; the client-rendered pricing widget problem this spike solves)
- `docs/research/SPIKE-09-azure-local-foundry.md` (the original Azure Local assessment; UNKNOWN #2, the exact per-core price, closed by Q4 here; the AI-services-billed-separately caveat carried into Q6)
- `docs/research/SPIKE-18-foundry-local-windows-server.md` (track 2 mechanics; the measured host profile; the winget MSIX finding; the managed-identity blob exception; "Arc governs installation, not the inference service")
- `docs/research/SPIKE-19-foundry-local-azure-local-deployment.md` (track 3 mechanics; UNKNOWN #3, the exact per-core price, closed by Q4 here; CPU-backed deployments as first class; Linux-only worker pools; the three-layer deployment shape)
- `docs/adr/ADR-0006-cost-governance.md` (the three-layer enforcement model tested against both local tracks in Q8)
- `docs/design/cost-and-governance.md` (the design that instantiates ADR-0006, and the layer table Q8 re-tests)
