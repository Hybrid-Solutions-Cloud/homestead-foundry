# Choosing a deployment target

The [comparison tables](./) are the grid. This page is the reasoning, for the
decision you actually have to make.

## Start with modality, because it decides for you

Most target selections are over before any other criterion is considered, and the
deciding factor is what you need the model to produce.

If you need **image generation** or **text to speech**, the choice is Azure cloud
and there is nothing to weigh. Foundry Local does neither, on either on-premises
target. This is not a maturity gap that will close on a schedule you can plan
around; the Foundry Local catalog is an open-weight text and transcription
catalog, and the image and speech models in this repository's roster
(the MAI-Image family, the FLUX family, MAI-Voice-2, the Azure neural voices) are
hosted services with no local form.

If you need **frontier reasoning quality**, the answer is the same. The
proprietary hosted models are hosted-only. The best a local target offers is an
open-weight model sized to your hardware, which on a CPU-only Windows Server is
realistically a quantized 4B-class model.

If you need **text and chat at ordinary quality**, all three targets are real
options, and the rest of this page applies.

## Then decide whether the data can leave the building

This is the second gate and it is usually a policy answer rather than a technical
one. If inference data cannot leave your premises, Azure cloud is out and the
choice is between the two local targets. If it can, Azure cloud is almost always
the shortest path to a working system, because there is no hardware, no
prerequisite layer, and no preview access request between you and a first call.

Note that "on premises" and "governed" are not the same thing, and the difference
between the two local targets is exactly that.

## Windows Server against Azure Local: the honest split

These two are often presented as the same capability at two sizes. They are not.

**Foundry Local on Windows Server is a single-host capability.** One server, one
service, no authentication on the endpoint, no Azure RBAC over it, no Entra
identity, no Key Vault, no budget, and no Azure Monitor. Arc governs the act of
installing and configuring the host. It does not govern the running inference
service. [ADR-0013](../adr/ADR-0013-foundry-local-windows-server-install.md) says
this in terms, and it is the single most important thing to understand before
choosing this target: it is a genuine capability and a proof of the Arc
automation pattern, and it is not a governance-equivalent sibling of the other
two.

That makes it right for a developer workstation, a single-purpose appliance, a
lab, or a workload whose security boundary is the machine itself. It makes it
wrong for a shared service that several people or systems call.

**Foundry Local on Azure Local is a governed cluster service.** Entra ID token
authentication, no API key to leak, full Azure RBAC and policy and cost
visibility through Arc, node-level redundancy, and concurrent multi-user serving
as the design point. It is what you choose when you need an on-premises endpoint
that behaves like a real service.

The price of that is real:

- **It is public preview, by request.** No SLA. No published GA date.
- **You need Kubernetes.** Two of its three deployment layers are `kubectl` and
  Helm, and the ordering between them is load-bearing rather than incidental.
  Installing Istio before the Gateway API custom resource definitions forces an
  `istiod` restart and is reported as flaky.
- **It costs money whether or not you infer.** The Azure Local host fee is per
  physical core per month. A cluster sitting idle still bills. This is the exact
  inverse of the cloud target's economics.
- **There is a hardware floor.** `Standard_A4_v2` is explicitly ruled out.
  `Standard_D8s_v3` or better is the recommendation for a CPU workload.

## The cost inversion is the argument people get wrong

Azure cloud is variable cost: near zero at rest, and it scales with what you use.
Azure Local is fixed cost: it bills per physical core per month regardless of
utilization. Windows Server Foundry Local is close to free, because the hardware
is already yours and the Arc run command that installs it carries no charge.

The consequence is that the comparison flips depending on volume. A low-volume or
bursty workload is cheapest in the cloud and the fixed on-premises fee is dead
weight. A high, steady, predictable volume is where a fixed per-core fee starts
to beat metered tokens. Do not choose Azure Local for cost reasons without an
actual volume estimate, and note that this repository does not yet have the exact
per-core figure; that is open research (SPIKE-26).

There is one cost trap worth naming: Azure cloud's variable cost is the only one
of the three that can be capped by a governance rule. A resource-group budget
with alert thresholds is real and is deployed
([ADR-0006](../adr/ADR-0006-cost-governance.md)). On the local targets there is
no Azure resource to cap, and the ceiling is the hardware.

## GPUs are no longer the gate they were

Earlier research in this repository treated a GPU as a precondition for the
on-premises tracks. That is no longer accurate and
[ADR-0014](../adr/ADR-0014-foundry-local-azure-local-deployment-layers.md)
amended it: CPU-backed deployments are a first-class documented path on both
local targets, and the first increment on each is deliberately CPU-only.

GPU is still what you need for the larger models and for Agentic Retrieval on
Azure Local, and on that target it is NVIDIA-only via discrete device assignment.
AMD is unsupported. But "we have no GPUs" is no longer a reason to rule out
either local target for text inference.

## What is still unknown, and why that should affect your decision

This repository does not have a measured throughput number for CPU inference on
either local target. Microsoft publishes none, and the two open questions
(SPIKE-18 unknown 2 and SPIKE-19 unknown 7) cover the same model class on
different hosting, so they are worth comparing once both are answered.

Support for Windows Server specifically, as opposed to Windows 11, is also still
an open question rather than a documented statement. The Foundry Local
quickstart names Windows 11 24H2; the CLI's own prerequisites are considerably
softer and name no edition at all. That is resolved by one install test, not by
more reading.

If you are choosing a target today for a workload with a hard latency
requirement, that gap matters, and the honest recommendation is to run the test
on your own hardware before committing rather than to trust an estimate.

## The short version

- Images, speech, or frontier reasoning: **Azure cloud**, no further analysis needed.
- Data cannot leave the building, and you need a governed shared endpoint:
  **Azure Local**, accepting preview status, Kubernetes, and a fixed per-core fee.
- Data cannot leave the building, and it is one machine or one workload:
  **Windows Server**, accepting that the endpoint is unauthenticated and ungoverned.
- Everything else: **Azure cloud**, because it is the shortest path to a working
  system and the only one of the three that this repository has actually deployed
  and proven end to end.
