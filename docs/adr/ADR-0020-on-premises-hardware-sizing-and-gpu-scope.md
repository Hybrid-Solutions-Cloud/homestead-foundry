# ADR-0020: On-premises hardware sizing, and how to state a requirement Microsoft does not publish

- Status: Proposed
- Date: 2026-07-30

## Context

[SPIKE-25](../research/SPIKE-25-local-track-hardware-sizing) returned a result
this repository has to decide how to handle rather than simply record:
**Microsoft publishes no universal CPU, RAM, disk, video-memory, or NPU minimum
for Foundry Local.** A Windows AI WinML tutorial names an OS build, a .NET SDK,
and a DirectX 12 GPU for that sample path. The cross-platform SDK supports CPU
fallback, so tutorial prerequisites must not be presented as a product-wide
hardware floor.

It also refuted a claim this repository had already published.
[SPIKE-18](../research/SPIKE-18-foundry-local-windows-server) stated that core
count rather than RAM is the binding CPU constraint. That is not supported by any
first-party statement, and Microsoft's own troubleshooting guidance points the
other way. It happened to be true of the specific 64 GB host SPIKE-18 measured.

The problem this creates is practical. A deployer asks "what hardware do I need."
Answering "Microsoft does not say" is accurate and useless. Answering with a
number invents a requirement. This ADR settles which of those failure modes is
acceptable and how to avoid both.

## Decision

1. **This repository publishes no invented minimum.** Where Microsoft is silent,
   the documentation says so explicitly and names what it is silent about. A
   fabricated "8 GB RAM minimum" would be indistinguishable, to a reader, from a
   sourced one.

2. **Every hardware number this repository publishes carries its provenance
   inline**, as one of exactly three kinds:
   - **Published**, with a first-party link.
   - **Transferred**, from a named adjacent first-party source, with the source
     and the reason the transfer is defensible.
   - **Observed**, from a specific measurement, naming the host it was measured
     on.

   A number without one of these three labels is a defect.

3. **SPIKE-18's "core count, not RAM" claim is downgraded from a rule to a single
   observation**, and every page repeating it is corrected. It stands as: on one
   64 GB host, core count bound before RAM did. It does not generalize.

4. **The working sizing guidance for Foundry Local is the model file size plus
   headroom, not a fixed host specification.** The one fully-published entry,
   `Phi-4-mini-instruct-generic-cpu`, is 4.8 GB on CPU. Guidance is expressed
   relative to that: disk for the model cache, RAM comfortably above the model
   size, and CPU cores as a throughput lever rather than a feasibility gate.
   This is transferred guidance and is labelled as such.

5. **GPU is not required on either on-premises target for the first increment**,
   carrying forward [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers)'s
   amendment of [ADR-0009](./ADR-0009-azure-local-reviewer-track). CPU-backed
   deployments are a documented first-class path.

6. **On Azure Local Foundry, GPU support is gated by Azure Local release number,
   and that is an environment question rather than a research one.** Microsoft
   publishes which release added each NVIDIA model in a single table. The
   deployer checks their release against that table. A public guide may include
   a dated, sourced snapshot, but it must direct the reader to the live table
   before procurement.

7. **AKS Arc node-size labels are not treated as Azure public-cloud VM SKUs.**
   Microsoft uses labels such as `Standard_D8s_v3` and `Standard_NC8_A2` for
   local worker VM profiles. Hardware guidance leads with the actual vCPU, RAM,
   GPU, storage, and node-count quantities and identifies the label only as a
   deployment reference backed by customer-owned Azure Local hardware.

8. **The GPU memory figures that are published are recorded, and the rest are
   not estimated.** Five vLLM entries publish GPU memory, up to 14.793 GB for
   `gpt-oss-20b` with Blackwell CC 10.0+ recommended. The other 95 do not, and
   this repository leaves them `UNKNOWN`.

9. **Closing the sizing question requires a measurement, and the measurement is
   gated.** It needs an owner-authorized install on a disposable build VM, never
   on a working host. Until that happens the sizing guidance stays labelled
   transferred.

## Consequences

A deployer gets an honest answer with its confidence attached, which is more
useful than a confident wrong one and is the only answer the evidence supports.

The three-way provenance label becomes a standing requirement on any future
hardware claim in this repository, including in the design docs. That is
deliberate: it is cheap to apply while writing and expensive to retrofit, as this
ADR is currently demonstrating.

Correcting SPIKE-18's claim means a published research spike now has a finding
this repository disagrees with. The spike is not rewritten, because it is a dated
record; the correction lives here and on the pages that repeated it.

Sizing stays formally open. Anyone reading the target pages will see transferred
rather than published guidance, and that visible weakness is the point.

## Alternatives considered

**Publish a recommended minimum anyway, marked as a recommendation.** Rejected.
Readers do not reliably distinguish a recommendation from a requirement, and this
repository would be the origin of a number that has no source. It is exactly the
failure the public-readiness audit was meant to prevent.

**Say only "Microsoft publishes no minimum" and stop.** Rejected as unhelpful.
The model file size is published for the entry that matters, and reasoning from it
is defensible as long as the reasoning is shown.

**Run the install test now to close the question.** Not available. It requires
hardware that does not exist yet and owner authorization, and it must never run
on the platform host.

**Present cloud-style AKS Arc profile labels as the hardware requirement.**
Rejected. The labels are useful deployment inputs, but they hide the physical
vCPU, memory, storage, GPU, and failure-capacity calculation that the customer
must supply on Azure Local.

## Sources

- [SPIKE-25](../research/SPIKE-25-local-track-hardware-sizing), the absence of published minimums and the refutation of SPIKE-18's claim.
- [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), the published sizes and GPU memory figures.
- [ADR-0014](./ADR-0014-foundry-local-azure-local-deployment-layers), the CPU-first amendment.
