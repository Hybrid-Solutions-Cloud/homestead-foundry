# ADR-0022: On-premises observability boundaries, and admitting ADR-0016 cannot be met

- Status: Proposed
- Date: 2026-07-30

## Context

[ADR-0016](./ADR-0016-foundry-model-usage-observability) makes native Foundry
metrics the mechanism for model-usage observability: request counts, latency, and
token counts, per deployment.
[SPIKE-27](../research/SPIKE-27-local-track-observability) established that
**neither on-premises target can meet that bar, and they fail it differently:**

- **Foundry Local emits no metric of any kind.** No request count, no tokens, no
  latency, no error rate. `Microsoft.HybridCompute` additionally has no platform
  metrics at all, so even host CPU and memory require the Azure Monitor Agent, a
  data collection rule, and per-GB ingestion. The endpoint has no authentication,
  so there is not even a caller identity to record.
- **Azure Local Foundry has a large, free infrastructure telemetry surface**,
  more than sixty standard Azure Local metrics at no extra cost, **and no
  documented Azure Monitor or Prometheus metric for a `ModelDeployment`.** The
  cluster is well instrumented; the thing serving the model is not.

This ADR decides what to build given that, rather than leaving the gap implicit.

## Decision

1. **ADR-0016 is declared unattainable on both on-premises targets, in writing,
   on the pages a reader will actually reach.** Not "partially supported" and not
   "pending further research". The research is done and the answer is no.

2. **Neither on-premises target may claim model-usage observability**, and the
   model-usage row of the observability design is recorded as empty for both.
   [SPIKE-27](../research/SPIKE-27-local-track-observability) Q9's per-signal gap
   list is the canonical statement and is linked rather than paraphrased.

3. **Foundry Local's observability scope is the host and the deployment action,
   and nothing else.** Arc supplies the machine resource, the activity log, and
   the run-command instance view. That is the entire Azure surface, and it
   confirms [ADR-0013](./ADR-0013-foundry-local-windows-server-install)
   decision 10 rather than extending it.

4. **The Azure Monitor Agent is not deployed by default on Foundry Local.** It
   bills per GB, it cannot see inference no matter how it is configured, and its
   only contribution is basic host health. It becomes a documented opt-in for an
   operator who wants host telemetry and accepts the ingestion cost.

5. **Azure Local Foundry takes the free infrastructure metrics and stops there.**
   The sixty-plus standard metrics cost nothing and are enabled. Container
   insights and managed Prometheus are supported and both bill on volume, so they
   stay deferred, consistent with
   [ADR-0015](./ADR-0015-cost-first-observability-boundaries)'s activation-gate
   pattern: a data-producing feature is off until the owner approves it.

6. **Alerting on either on-premises target is scoped to infrastructure and to
   deployment actions. Neither target can alert on a model**, and no alert rule
   may be written that implies otherwise.

7. **The only usable health signal on Foundry Local is `foundry service status`,
   executed locally or through a run command, and it cannot be turned into an
   Azure availability test**, because the inference port is assigned dynamically
   at each service start so there is no stable probe target.

8. **Prompt and content capture stays prohibited on both targets**, metadata-only
   and opt-in, unchanged from
   [SPIKE-21](../research/SPIKE-21-solution-observability)'s position.

9. **Closing any of this needs a running install, not more reading.** The gaps
   are documentation-complete: Microsoft does not publish these metrics, and no
   further desk research will change that. What could change it is a vendor
   release, so the gap list is dated.

## Consequences

An adopter comparing the three targets sees that on-premises inference is a
telemetry blind spot, before they commit hardware to it. That is the single most
useful thing this ADR does.

It also means the observability design has a permanent asymmetry: one target with
full model-usage metrics and two with none. Anywhere the design implies uniform
coverage, it is wrong, and this ADR is the reason.

Declining to deploy the Azure Monitor Agent by default means Foundry Local hosts
have no Azure-visible health at all out of the box. That is a real operational
cost, accepted because the alternative is per-GB billing for data that still
would not answer the question anyone is asking.

The dynamic port finding means an availability test is not merely unbuilt but
unbuildable as things stand, which is worth knowing before someone tries.

## Alternatives considered

**Deploy the Azure Monitor Agent everywhere for parity.** Rejected. It bills per
GB and cannot see inference under any configuration, so it buys host metrics at a
recurring cost while leaving the actual gap untouched.

**Build a custom metrics exporter and push to Azure Monitor.** Rejected for now,
not on principle. It is the only path that could close the gap, but it means
authoring and operating a bespoke agent on a target that has no deployment yet.
It is revisited when an on-premises deployment exists and the gap is felt.

**Enable managed Prometheus on Azure Local Foundry immediately.** Rejected. It
bills on volume and there is no `ModelDeployment` metric for it to scrape, so it
would cost money to collect infrastructure data twice.

**Say nothing and let the empty cells speak.** Rejected. Silence reads as "not
yet researched" when the truth is "researched, and absent". Those are different
claims and the difference matters to someone choosing a target.

## Sources

- [SPIKE-27](../research/SPIKE-27-local-track-observability), the per-signal gap list for both targets, the `Microsoft.HybridCompute` finding, and the missing `ModelDeployment` metric.
- [ADR-0016](./ADR-0016-foundry-model-usage-observability), the bar this cannot meet.
- [ADR-0015](./ADR-0015-cost-first-observability-boundaries), the activation-gate pattern reused here.
- [ADR-0013](./ADR-0013-foundry-local-windows-server-install) decision 10, confirmed rather than extended.
