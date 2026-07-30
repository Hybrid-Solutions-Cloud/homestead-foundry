# Azure Local Foundry

::: info Scope
**Foundry Local on Azure Local**, running at cluster scale on an Arc-connected
AKS Arc cluster on your own hardware. One of the three targets in
[ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation). Compare all
three targets on the [Deployment targets hub](../).
:::

::: warning This target has not been built yet
No deployment exists for this target and no automation is written. The pages in
this section are drawn from [SPIKE-09](../../research/SPIKE-09-azure-local-foundry),
[SPIKE-19](../../research/SPIKE-19-foundry-local-azure-local-deployment),
[ADR-0009](../../adr/ADR-0009-azure-local-reviewer-track), and
[ADR-0014](../../adr/ADR-0014-foundry-local-azure-local-deployment-layers).
Treat them as a design.
:::

This is the target for a **governed on-premises endpoint**: data stays in your
building, and the endpoint still behaves like a real Azure service. Entra ID
token authentication, full RBAC and policy and cost visibility through Arc,
node-level redundancy, and concurrent multi-user serving as the design point.

## Read this before choosing it

Four things cost more than they first appear:

- **Public preview, access by request.** No SLA and no published GA date.
- **Two of its three deployment layers are Kubernetes and Helm**, and the
  ordering between them is load-bearing rather than incidental. Installing Istio
  before the Gateway API custom resource definitions forces an `istiod` restart
  and is reported as flaky.
- **It bills whether or not you infer.** The Azure Local host fee is per physical
  core per month. This is the exact inverse of the cloud target's economics.
- **There is a hardware floor.** `Standard_A4_v2` is explicitly ruled out.
  `Standard_D8s_v3` or better is the recommendation for a CPU workload.

A GPU is not among them. [ADR-0014](../../adr/ADR-0014-foundry-local-azure-local-deployment-layers)
decision 3 amended ADR-0009's blanket GPU precondition to a per-workload one, so
the first increment is deliberately CPU-only. GPU is still needed for larger
models and for Agentic Retrieval, and there it is NVIDIA-only via discrete device
assignment. AMD is unsupported.

## What it runs

The Foundry Local catalog, deployed as `ModelDeployment` custom resources, on
either the ONNX-GenAI or the vLLM engine. **No image generation, no text to
speech, no video.** The first increment is a CPU-only text reviewer in the
`Phi-4-mini-instruct-generic-cpu` class.

## The three layers

| Layer | Owns | Expressed in |
|---|---|---|
| Prerequisite | Gateway API CRDs, Inference Extension CRDs, Istio | `kubectl` and Helm. Not ARM. |
| Platform | `Microsoft.CertManagement` and `Microsoft.Foundry` cluster extensions | ARM, so Bicep |
| Intent | `ModelDeployment` custom resources | `kubectl`. Not ARM. |

Bicep owns the middle layer only. An ordering wrapper owns the sequence, and
ADR-0014 calls that wrapper a first-class deliverable rather than glue.

## Section contents

| Topic | Summary |
|---|---|
| [Architecture](./architecture) | Three layers, Bicep owns the middle one, Istio as a Gateway API provider only |
| [Models](./models) | Foundry Local catalog via `ModelDeployment`, explicit resources always |
| [Features](./features) | Concurrent serving, Agentic Retrieval, disconnected operation |
| [Deployment](./deployment) | Ordered install across three layers, preview access required |
| [Consumption](./consumption) | Two mandatory auth modes, Entra ID token or API key. The API-key path bypasses Azure RBAC. |
| [Cost](./cost) | Fixed, per physical core per month, regardless of usage |
| [Security](./security) | Full Azure governance via Arc, no exception to ADR-0005 needed |
| [Operations](./operations) | Drift detection split three ways, sixty-plus free infrastructure metrics |

## What stands between this and a real deployment

A preview access request, which is free and reversible and should be submitted
now, and an AKS Arc cluster to deploy onto. Whether that cluster can be expressed
in Bicep at all is itself an open question, because every current first-party
example uses `az aksarc`.
