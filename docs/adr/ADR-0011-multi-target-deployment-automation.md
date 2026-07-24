# ADR-0011: Multi-target Foundry deployment automation

- Status: Proposed
- Date: 2026-07-23
- Revised 2026-07-23: identity pass (managed identity over service principal). Adds a "Deployment principal and runtime identity" subsection so each track's deploy-time and runtime credentials are managed-identity-first, per ADR-0005 as the governing identity ADR.

This ADR locks the deployment-automation approach for each of the three targets
the owner directed this methodology to cover (owner directive, 2026-07-23): the
Azure cloud Foundry stack (already built), a single Windows Server running
Foundry Local on-device, and cluster-scale Foundry Local on Azure Local. One
target is already proven and is documented here rather than re-decided; the other
two are decided here for the first time, grounded in
`docs/research/SPIKE-08-foundry-local-on-device.md` and
`docs/research/SPIKE-09-azure-local-foundry.md`, and every claim about Azure Arc,
Foundry Local, Azure Local, and Bicep is cited to a Microsoft first-party source
in the References section.

This ADR authorizes **no deployment**. It records how each track is automated and
under what preconditions, gated the same way every other decision in this backlog
is: spike, then ADR, then design, then a gated deploy.

## Context

The initiative's automation began as a single-target concern: reproduce the cloud
Azure AI Foundry (AIServices) stack with Bicep. The owner has since directed that
the methodology cover three deployment targets, because "Foundry" is not one
product but a family that spans a hosted cloud service, an on-device runtime, and
a Kubernetes-native on-premises stack, and a credible open-source deployment
methodology has to speak to all three. The forces this decision must reconcile:

- **The three targets are genuinely different control planes, not one mechanism
  scaled up and down.** Track 1 provisions Azure resources declaratively. Track 2
  installs and configures software inside a single server's guest OS. Track 3
  provisions Azure-projected Kubernetes resources on Arc-connected on-prem
  hardware. A single automation form does not fit all three, and pretending it
  does would produce a worse result than choosing the right form per track.
- **The workloads on tracks 2 and 3 are not the cloud model catalog.** Both
  spikes establish that Foundry Local (on-device and on Azure Local) serves
  open-weight chat, reasoning, and speech-to-text (Whisper) models through an
  OpenAI-compatible API, with no image-generation and no text-to-speech engine.
  None of this repo's proprietary generation roster (MAI-Image-2.5, the FLUX
  family, MAI-Voice-2, Sora) or hosted-reasoning roster (`gpt-5.6-terra`,
  `grok-4-1-fast-reasoning`) runs on either on-prem target. Tracks 2 and 3 are
  therefore about automating a **local open-weight reviewer / RAG capability**,
  not rehosting the generation backbone. This ADR is about the automation form;
  the model decision for the on-prem targets lives in ADR-0009.
- **The methodology's promise is one governed discipline across all three.** The
  repo's whole framing is CAF naming plus a five-pillar WAF review for every
  Azure design, plus this repo's hard rules (no secrets in git, owner-gated
  writes, wipe-and-redeploy safety). Whatever automation form each track uses, it
  has to sit inside that one governance story, or the methodology fragments.
- **Preview risk is already an accepted posture.** The owner accepted
  preview-no-SLA risk for the cloud MAI models. The Arc run-command feature,
  Foundry Local, and Foundry Local on Azure Local are all in preview, so the same
  accepted-risk posture carries forward rather than being re-litigated here.

### Track 1 as the proven baseline (documented, not re-decided)

Track 1 already exists as `infra/main.bicep`, `infra/types.bicep`, the five
modules under `infra/modules/`, and `infra/params/example.bicepparam`. It is the
reference shape the other two tracks are measured against. Its load-bearing
properties:

- **Subscription-scope, single resource group, wipe-and-redeploy safe.**
  `main.bicep` sets `targetScope = 'subscription'` and contains every created
  resource in one resource group pinned to one `location` parameter, so
  `az group delete` is the whole teardown and a redeploy lands entirely back in
  one region with no orphans. The two deliberate exceptions are the Entra
  security groups (identity objects, not ARM resources) and the pre-existing
  platform Key Vault (reused by name, never created or deleted).
- **One location threaded through every module.** There is no per-module region
  drift: the single `location` value flows into the resource group, the
  AIServices account, its model deployments, and the project. A registry entry
  that names a different region is surfaced as the `regionMismatchedRegistryIds`
  output rather than silently absorbed.
- **CAF naming enforced by construction, not by a pattern.** Bicep has no regex
  or `@pattern` decorator, so the CAF shape
  `abbrev-workload-env-region-instance` is enforced by making each segment its
  own length-constrained parameter and composing the names in code (`main.bicep`
  `names` variable), which fixes segment order and delimiters more strictly than
  a single pattern would. A separate naming-lint step covers the character-class
  check.
- **Registry-driven model deployments.** The set of model deployments is the
  filtered contents of the model registry (`status == 'deployed'` and not in
  `skipDeploymentModelIds`), resolved to deploy-time name and version through the
  `modelCatalog` map, so which endpoints exist is data, not hand-edited resource
  blocks. Deployments are created serially (`@batchSize(1)`) because parallel
  creates on one account fail.
- **Least-privilege, keyless-where-possible governance.** Two Entra security
  groups get data-plane roles on the account scope (`rbac.bicep`), secrets are
  referenced by name only and never read or written by the template
  (`keyvault-secret-refs.bicep`), and a resource-group-scoped Cost Management
  budget with notify-only alerts enforces the spend guardrail (`budget.bicep`).

Track 1 is the worked proof that a declarative, subscription-scoped, single-RG,
registry-driven Bicep stack is the right automation form when the target is
Azure resources. That conclusion is not reopened. It is the yardstick.

### Track 2 forces (Windows Server Foundry Local, on-device / single server)

- **The unit of work is in-guest install and configuration, not resource
  provisioning.** SPIKE-08 establishes that Foundry Local is a device-side
  runtime installed with `winget install Microsoft.FoundryLocal`, that runs
  open-weight chat and Whisper models on ONNX Runtime with no Azure subscription
  required, and that provisions nothing in Azure (no resource group, no CAF
  resource, no Entra RBAC surface for the device SDK itself). Automating this
  track means running an install, pulling models into the on-disk cache, and
  configuring the local service on one server, all inside the guest OS.
- **Windows Server support and CPU throughput are open questions.** SPIKE-08
  logs as UNKNOWN whether the device SDK is supported on Windows Server (docs say
  "Windows" and name Windows 11 24H2 build 26100 as the client minimum), and
  notes the WinML accelerated path needs real GPU hardware, so a GPU-less server
  would fall back to slow CPU inference. These are carried forward, not resolved
  here.
- **Bare install has no governance plane.** A plain scripted install run at the
  console or over an ad hoc remote session leaves no Azure-side record of who ran
  what, no RBAC gate on execution, no inventory, and typically needs inbound RDP
  or SSH exposure. That is the opposite of this repo's CAF/WAF discipline.
- **Azure Arc supplies a governance plane over a non-Azure server.** An
  Arc-enabled server is an Azure resource (`Microsoft.HybridCompute/machines`).
  Arc brings two mechanisms directly relevant to automating an in-guest install:
  the **Run command** (`az connectedmachine run-command`, PowerShell on Windows,
  shell on Linux, also REST), which runs a script in the guest and returns its
  output, gated by Azure RBAC
  (`Microsoft.HybridCompute/machines/runCommands/write` is the Azure Connected
  Machine Resource Administrator role; read is Reader), and needs no inbound RDP
  or open ports; and **SSH access to Arc-enabled servers** (`az ssh arc`), which
  tunnels SSH through Azure with no public IP and no open ports, supports Windows
  and Linux, and can authenticate with Microsoft Entra. Windows Server 2025 ships
  OpenSSH by default. Both are the same "reach the box through Azure, governed by
  Azure RBAC, no inbound exposure" pattern, and both are in preview.
- **The Arc run-command is also an ARM/Bicep resource.** The run-command is not
  only a CLI verb: `Microsoft.HybridCompute/machines/runCommands` is a full
  ARM/Bicep resource type (current API `2025-06-01`, deployed at resource-group
  scope), whose `properties` carries the script content. So a thin declarative
  form of this track is technically possible: author the install script as a
  `runCommands` resource in Bicep and let it compose into a deployment graph with
  what-if, the same authoring model as track 1.

### Track 3 forces (Azure Local Foundry, cluster-scale on-prem, Arc-connected)

- **The mechanism is a Kubernetes-native Arc extension, and it is Azure
  resources.** SPIKE-09 establishes that the first-party path is "Foundry Local
  on Azure Local" (public preview, by request), an Azure Arc extension
  (extensionType `Microsoft.Foundry`) installed on an AKS cluster enabled by
  Azure Arc, exposing OpenAI-compatible inference on ONNX-GenAI (CPU or GPU) and
  vLLM (GPU only) engines. The extension is deployable through the Azure portal,
  the Azure CLI (`az k8s-extension`), or Helm.
- **Those Azure-projected pieces are declaratively provisionable.** The AKS Arc
  cluster and the cluster extension both surface as Azure resources, and the
  extension resource type `Microsoft.KubernetesConfiguration/extensions` is a
  Bicep-expressible ARM resource (an Azure Verified Module exists for it). So the
  same declarative Bicep form that proved out for track 1 applies to track 3's
  Azure-side objects: the resource group, the AKS Arc cluster and its node pools,
  and the Foundry extension instance.
- **There is a real ARM/Kubernetes boundary.** The models themselves are
  Kubernetes custom resources: the Foundry inference operator reconciles `Model`
  and `ModelDeployment` CRDs inside the cluster (SPIKE-09), and preview onboarding
  documents Helm and `kubectl` for the model-deployment step. So Bicep covers the
  Azure-projected surface (RG, cluster, extension) but the in-cluster model
  intent is applied through Kubernetes-native tooling, not ARM. This boundary is
  a fact to design around, not a defect.
- **GPU and governance constraints are inherited from SPIKE-09 and ADR-0009.**
  AKS Arc GPU support is Linux node pools only, via Discrete Device Assignment
  (DDA) passthrough (no GPU partitioning, so no GPU live migration and lower
  density), from a release-gated card matrix; the cluster control plane and
  system node pool must use a non-GPU size and the GPU node pool is added after.
  Governance carries over because the whole thing is Arc-managed: Entra ID token
  auth or API keys, Azure RBAC, Azure Policy, Azure Monitor, and Cost Management
  all reach the on-prem endpoint. ADR-0009 already decided the on-prem
  reviewer / RAG **model** and gated it on three preconditions; track 3 is the
  deployment-automation counterpart to that model decision.

## Decision

**Adopt a per-target automation form: declarative Bicep for the two Azure and
Azure-projected targets (tracks 1 and 3), and Arc-governed imperative automation
for the in-guest install of the single-server target (track 2). All three tracks
sit inside one CAF/WAF governance story, and none is authorized to deploy from
this ADR.**

### Track 1: Bicep (proven, documented, unchanged)

The cloud Azure AI Foundry stack stays on the existing subscription-scoped,
single-resource-group, registry-driven Bicep in `infra/`, with one `location`
threaded through every module, CAF naming enforced by per-segment constrained
parameters, and the least-privilege RBAC, secret-name-only, and budget-guardrail
modules already in place. This track is documented as the baseline the others are
measured against; it is not re-decided.

### Track 2: Arc-enabled hard prerequisite, plus Arc run-command / PS-over-SSH imperative automation (option a)

1. **Arc-enablement is a hard prerequisite.** The Windows Server that hosts
   Foundry Local must be onboarded as an Azure Arc-enabled server
   (`Microsoft.HybridCompute/machines`) before any automation runs. This is the
   single change that gives an off-Azure server an Azure governance plane:
   RBAC-gated remote execution, an audit trail, Azure Policy and Machine
   inventory, and consistent identity, all without opening inbound RDP or SSH.
2. **The install, model-pull, and service configuration are driven imperatively
   through the Azure Arc run-command**, with Arc SSH (`az ssh arc`, or PowerShell
   remoting over the Arc SSH tunnel) as the interactive and fallback path. The
   run-command carries the PowerShell that runs `winget install
   Microsoft.FoundryLocal`, pulls the selected open-weight model into the local
   cache, and configures and validates the local service, returning its output to
   Azure. Neither path requires a public IP or an open inbound port.
3. **Why imperative and not declarative Bicep over `Microsoft.HybridCompute`
   (option b is rejected as the primary form).** The substance of this track is
   stateful, in-guest work: installing a package, downloading multi-GB model
   files, and configuring a Windows service. A `runCommands` resource in Bicep
   would wrap that work in an opaque script blob and report only that "a script
   ran," not that "Foundry Local is installed and at version X." Bicep gives no
   real idempotency or drift detection over what happens inside the guest, so the
   declarative benefit is largely illusory here, whereas the run-command's own
   execution state, exit code, and captured output are the honest success signal.
   The run-command being an ARM/Bicep resource is still useful and is **not
   forbidden**: where it helps graph consistency, the run-command may be authored
   as a `Microsoft.HybridCompute/machines/runCommands` resource so it composes
   into a deployment with what-if, but that is a packaging choice layered on the
   imperative decision, not a switch to a declarative model.
4. **Governance and secrets.** Execution is gated by Azure RBAC (grant Azure
   Connected Machine Resource Administrator only to the operator identity that
   runs the install; Reader for status). Any sensitive input to the script is
   passed through the run-command protected-parameter mechanism, never inlined in
   committed script text, consistent with this repo's no-secrets-in-git rule. The
   device SDK itself uses no Azure key and no Key Vault secret (SPIKE-08), so the
   only secret surface is any protected parameter the install script needs.
5. **CAF naming and scope.** The Arc machine is a pre-existing Arc registration
   in a CAF-named resource group (example only, not a provisioning instruction:
   an Arc server registered into `rg-foundryedge-prod-eus-01`), and the
   run-command resource takes a stable, descriptive name (for example
   `install-foundrylocal`). The device runtime provisions nothing else in Azure,
   so there is no account, deployment, or budget resource to name for this track.
6. **WAF pillars drive the choice.** Operational Excellence: a governed,
   repeatable, auditable remote-execution path with captured output beats an ad
   hoc console install. Security: RBAC-gated execution with no inbound RDP or open
   ports, and secrets passed as protected parameters, is a materially better
   posture than an open management port. Reliability and Cost and Performance
   collapse to device-level concerns (is the service running, is the model
   cached, is the CPU-only throughput tolerable) rather than Azure-plane ones, per
   SPIKE-08.

### Track 3: Bicep, Arc-connected to the Azure Local cluster (option: declarative)

1. **The Azure-projected surface is provisioned with Bicep, following track 1's
   pattern.** A subscription-scoped, single-resource-group, wipe-and-redeploy-safe
   Bicep stack provisions: the resource group; the AKS cluster enabled by Azure
   Arc (control plane plus a non-GPU system node pool, plus a GPU-enabled Linux
   user node pool using DDA passthrough when a GPU workload is in scope); and the
   Foundry Local extension as a `Microsoft.KubernetesConfiguration/extensions`
   resource with extensionType `Microsoft.Foundry`. One `location` is threaded
   through, and CAF naming is enforced by per-segment constrained parameters, the
   same construction track 1 uses.
2. **The ARM/Kubernetes boundary is explicit.** Bicep owns the Azure-projected
   resources up to and including the extension install. The in-cluster model
   intent (the `Model` and `ModelDeployment` custom resources the Foundry operator
   reconciles) is applied through Kubernetes-native tooling (`kubectl` or the
   extension's own configuration, with Helm used where preview onboarding
   requires it), not through ARM. The automation therefore has two composable
   layers: a Bicep layer for Azure resources and a Kubernetes layer for model
   deployments, and the design doc must own where the seam sits.
3. **It stays registry-driven where it can.** The reviewer / RAG model or models
   that ADR-0009 selects become the `ModelDeployment` entries for this track,
   mirroring track 1's registry-driven model deployments: which models the cluster
   serves is data, applied through the Kubernetes layer, not hand-edited resource
   blocks.
4. **It composes with ADR-0009, not competes with it.** ADR-0009 decides the
   on-prem reviewer / RAG model (an open-weight substitute for the planned cloud
   pair) and gates it on three preconditions: GPU-validated Azure Local hardware
   with a supported NVIDIA card present; an AKS Arc cluster with a GPU-enabled
   Linux user node pool using DDA passthrough; and preview access approval for the
   Foundry Local Arc extension. Track 3 is the **how it is deployed** counterpart
   to ADR-0009's **which model** decision, and it inherits those same three gates
   unchanged. If any gate is unmet, track 3 does not run.
5. **CAF naming and governance.** Resources follow this repo's CAF pattern
   `resource-type-abbreviation-workload-env-region-instance` (example only, not a
   provisioning instruction, and matching ADR-0009: an AKS Arc cluster
   `aks-foundryrev-demo-eus-01` in resource group `rg-foundryrev-demo-eus-01`,
   with the Foundry extension instance named for example `foundry`). Governance
   uses Entra ID token auth or API keys, Azure RBAC, Azure Policy, Azure Monitor,
   and Cost Management, all of which reach the Arc-managed endpoint. Any extension
   API key, if used, is a Key Vault secret referenced by name only, never
   committed (and SPIKE-09 carries the open question of a documented Key Vault
   path for the extension's own secrets).
6. **WAF pillars drive the choice.** Because the target is Azure-projected
   resources with real idempotency and drift detection, declarative Bicep is the
   right form (Operational Excellence), the Arc-managed control plane preserves
   the full governance model (Security, Cost Optimization), and the fixed-cost
   per-core economics reward the steady, sovereign reviewer workload this track is
   scoped to (Cost Optimization), all consistent with SPIKE-09.

### The three tracks at a glance

| Track | Target | Automation form | IaC / control surface | Governance plane | Gate |
|---|---|---|---|---|---|
| 1 | Azure cloud Foundry (AIServices) | Declarative | Bicep, subscription scope, single RG (`infra/`) | Full Azure (RBAC, Policy, Monitor, Cost, Key Vault by name) | Owner-gated deploy (proven) |
| 2 | Windows Server Foundry Local (on-device) | Imperative | Arc run-command / Arc SSH; optional `runCommands` Bicep packaging | Azure Arc over a non-Azure server (RBAC-gated execution, audit, no inbound ports) | Arc-enablement prereq; SPIKE-08 UNKNOWNs (Windows Server support, CPU throughput) |
| 3 | Azure Local Foundry (cluster-scale, Arc) | Declarative (plus a Kubernetes layer) | Bicep for RG + AKS Arc + `Microsoft.Foundry` extension; `kubectl`/Helm for `ModelDeployment` CRDs | Full Azure via Arc (RBAC, Policy, Monitor, Cost, Entra token auth) | ADR-0009's three preconditions, inherited unchanged |

### Deployment principal and runtime identity (managed identity over service principal)

ADR-0005 is the governing identity ADR for this initiative; this subsection applies
its managed-identity-first stance to each track's deployment automation. The CAF/WAF
rule is that managed identity is the default and stored credentials are avoided, so a
service principal (app registration) is used only where a managed identity genuinely
cannot reach. Two distinct identities matter per track: the **deploy-time principal**
that runs the automation, and the **runtime identity** the deployed workload uses to
reach Azure resources such as Key Vault.

1. **Track 1 (Azure cloud Bicep).** The deploy-time principal is a **user-assigned
   managed identity with a GitHub Actions OIDC federated identity credential** when the
   deploy runs from CI, so no stored service-principal secret exists; the `az login`
   user token when it runs from a developer workstation; or the compute's managed
   identity if the deploy is ever run from Azure compute. User-assigned managed identity
   is Microsoft's recommended type and supports federated identity credentials for
   GitHub OIDC directly, which is what makes the keyless CI path a managed identity
   rather than an app-registration service principal. The deployed account's own runtime
   identity is the system-assigned managed identity the Bicep already sets on the
   AIServices account and project (`infra/modules/foundry-account.bicep`), and the
   data-plane roles are group-assigned (`infra/modules/rbac.bicep`) to members that are
   themselves managed identities per ADR-0005.
2. **Tracks 2 and 3 (Arc-enabled Windows Server, and Azure Local).** The operator or
   automation that **invokes** the Arc run-command / Arc SSH (track 2) or deploys the
   AKS Arc cluster and the `Microsoft.Foundry` extension (track 3) authenticates as a
   **user-assigned managed identity via GitHub Actions OIDC federation** from CI, or as
   the `az login` user from a workstation; no stored service-principal secret is used
   for the deploy. The **in-guest / on-cluster runtime identity** that reaches Azure
   resources (Key Vault for any secret, Storage, and so on) is the Arc-enabled machine's
   **system-assigned managed identity**, issued through the Arc HIMDS endpoint. This is a
   hard platform constraint, not a preference: Azure Arc-enabled servers support
   **system-assigned managed identity only, and user-assigned managed identity is not
   supported on Arc machines**, so least-privilege scoping is done by assigning Azure
   RBAC roles to that system-assigned identity. The one accepted service-principal use is
   **Arc onboarding** (the Azure Connected Machine onboarding principal used to register
   the box), which is a separate, documented one-time enrollment concern and is not the
   runtime identity. For track 3, any Foundry extension API key remains a Key Vault
   secret referenced by name only (the documented Key Vault path for the extension's own
   secrets is still an open item in SPIKE-09 and ADR-0009), and the cluster reaches that
   vault with the Arc system-assigned managed identity.
3. **Net.** No track stores a service-principal secret for its runtime or its deploy.
   Managed identity covers the runtime identity on every target and the deploy-time
   principal on every target except a workstation-run deploy (which uses the `az login`
   user token, still not a service principal). A service principal remains only for Arc
   onboarding and as a last-resort fallback where a managed identity cannot reach, both
   consistent with ADR-0005.

## Consequences

**Positive.**
- One governed methodology now spans all three targets without forcing a single
  automation form where it does not fit: declarative Bicep where the target is
  Azure or Azure-projected resources (tracks 1 and 3), Arc-governed imperative
  execution where the target is in-guest software on one server (track 2).
- Every track keeps the CAF/WAF discipline and this repo's hard rules: CAF naming,
  secrets by name only, RBAC-gated or owner-gated writes, and no deployment
  authorized from a decision record.
- Track 2's Arc-enablement requirement turns an ungoverned console install into a
  RBAC-gated, auditable, no-inbound-port operation, a strictly better security and
  operational posture, at the cost of one prerequisite.
- Track 3 reuses track 1's proven subscription-scope, single-RG, one-location,
  registry-driven shape, so the cloud methodology transfers to Azure Local with
  little new invention, and it slots cleanly behind ADR-0009's model decision and
  gates.

**Negative / trade-offs.**
- The methodology now maintains two automation styles (declarative Bicep and
  imperative Arc scripts), which is more surface area than a single style, and
  contributors must know which applies to which target.
- Track 2's imperative automation has weaker idempotency guarantees than
  declarative IaC by nature: the run-command reports execution state, not desired
  state, so re-running is the operator's responsibility and the install script
  must be written to be safely re-runnable.
- Track 3 has a real ARM/Kubernetes seam: Bicep does not reach the `Model` and
  `ModelDeployment` CRDs, so the full deployment is two layers, and drift in the
  Kubernetes layer is not visible to Azure what-if.
- All three of the on-prem-relevant mechanisms (Arc run-command, Arc SSH, Foundry
  Local, Foundry Local on Azure Local) are in preview with no SLA, so tracks 2 and
  3 rely on the owner's already-accepted preview-risk posture.

**Not yet decided (UNKNOWNs carried forward).**
- **Track 2 feasibility.** Whether Foundry Local is supported and performant on
  Windows Server (specifically build 26100) and whether CPU-only throughput on a
  GPU-less host is tolerable for a reviewer step are both UNKNOWN, per SPIKE-08.
  Resolve with a throwaway install test on an Arc-enabled server before any
  pipeline wiring, gated on owner authorization to install software.
- **Track 3 preconditions and boundary.** The three ADR-0009 gates (GPU-validated
  hardware, DDA Linux node pool, preview access) and the open questions SPIKE-09
  logged (vision-capable local reviewer model, exact per-core price, a documented
  Key Vault path for the extension's secrets, GPU SKU / matrix GA in the owner's
  build) all carry forward and must be resolved at design time.
- **Where the Kubernetes seam sits for track 3** (Bicep versus `kubectl` / Helm
  for the `ModelDeployment` step) is a design-doc decision, not settled here.

**Follow-ups.**
- If track 2 is pursued, resolve the SPIKE-08 UNKNOWNs with a gated throwaway
  install, then write the design doc and a separately gated deployment.
- If track 3 is pursued, confirm ADR-0009's three gates and the SPIKE-09 open
  items against the owner's live Azure Local environment, then write the design
  doc that owns the ARM/Kubernetes seam and the registry-to-`ModelDeployment`
  mapping.
- Keep track 1 the yardstick: as tracks 2 and 3 gain design docs, reconcile their
  CAF naming, one-location, and wipe-and-redeploy expectations against the
  `infra/` baseline.

## Alternatives considered

- **One automation form for all three targets (Bicep everywhere, including track
  2 over `Microsoft.HybridCompute/machines/runCommands`).** Rejected as the
  primary form for track 2. The run-command is a Bicep-expressible resource, so
  this is technically possible, but for an in-guest install, model-pull, and
  service-config it wraps stateful imperative work in an opaque script blob and
  reports only that a script ran, giving false idempotency. Declarative Bicep is
  kept where the target is genuinely Azure or Azure-projected resources (tracks 1
  and 3), and the run-command's Bicep form is permitted only as optional graph
  packaging on top of the imperative track-2 decision.
- **Track 2 as a plain scripted install with no Arc requirement (option c).**
  Rejected. It loses every Azure-side governance benefit: no RBAC gate on
  execution, no audit trail, no inventory or Policy, and it typically needs
  inbound RDP or SSH exposure or physical console access. That directly
  contradicts this repo's CAF/WAF discipline and the goal of one governed
  methodology across all three targets. Arc-enablement is the cheap prerequisite
  that buys all of that back.
- **Track 3 driven purely imperatively (`az k8s-extension` scripts, no Bicep).**
  Rejected as the primary form. The AKS Arc cluster and the Foundry extension are
  Azure resources with real declarative idempotency and drift detection, and the
  `Microsoft.KubernetesConfiguration/extensions` type is Bicep-expressible, so the
  proven track-1 declarative pattern applies and is preferred. Imperative tooling
  is retained only for the Kubernetes-native `ModelDeployment` layer that ARM does
  not reach.
- **Rehost the generation backbone on track 2 or track 3.** Rejected, closed by
  both spikes: neither on-prem target has an image-generation or text-to-speech
  engine, and every generation and hosted-reasoning model on the roster is
  proprietary hosted, not open weights. The cloud track 1 stays the backbone; the
  on-prem tracks host a substitute open-weight reviewer / RAG capability only, per
  ADR-0009.
- **Authorize a preview enrollment or a deployment from this ADR.** Rejected.
  This repo's discipline is spike, then ADR, then design, then a gated deploy.
  This ADR records the automation form and the gates only; it provisions nothing.

## References

All Microsoft first-party sources reviewed 2026-07-23 unless the underlying spike
notes an earlier date. In-repo sources are cited by path.

- `docs/research/SPIKE-08-foundry-local-on-device.md` (Foundry Local as a
  device-side runtime, `winget install Microsoft.FoundryLocal`, chat plus Whisper
  only, no Azure subscription and no CAF/RBAC surface for the device SDK, Windows
  Server support and CPU throughput UNKNOWNs)
- `docs/research/SPIKE-09-azure-local-foundry.md` (Foundry Local on Azure Local as
  an Arc extension on AKS Arc, OpenAI-compatible ONNX-GenAI and vLLM engines,
  open-weight text and predictive only, DDA-only Linux GPU node pools, per-core
  cost, Arc-managed governance, preview by request, carried UNKNOWNs)
- `docs/adr/ADR-0009-azure-local-reviewer-track.md` (the on-prem reviewer / RAG
  model decision and its three preconditions that track 3 inherits)
- `docs/adr/ADR-0010-flux-image-model-adoption.md` (ADR house style matched here;
  the cloud generation roster this ADR does not move on-prem)
- `docs/adr/ADR-0005-identity-and-secrets.md` (the governing identity ADR: managed
  identity over service principal, `DefaultAzureCredential`, least-privilege data-plane
  RBAC, secret names only; this ADR's deployment-identity subsection applies that stance
  per track)
- `infra/main.bicep`, `infra/types.bicep`, `infra/modules/resource-group.bicep`,
  `infra/modules/foundry-account.bicep`, `infra/modules/rbac.bicep`,
  `infra/modules/keyvault-secret-refs.bicep`, `infra/modules/budget.bicep`,
  `infra/params/example.bicepparam` (track 1 as-built: subscription scope, single
  RG, one location, CAF-by-construction, registry-driven deployments, two-group
  RBAC, secret-names-only, RG budget)
- Run command on Azure Arc-enabled servers (Azure CLI / PowerShell / REST,
  Windows and Linux, non-Azure environments, RBAC:
  `Microsoft.HybridCompute/machines/runCommands/write` is Azure Connected Machine
  Resource Administrator, read is Reader; protected parameters; preview):
  <https://learn.microsoft.com/azure/azure-arc/servers/run-command>
- `az connectedmachine run-command` CLI reference (create, list, show, delete,
  wait; preview): <https://learn.microsoft.com/cli/azure/connectedmachine/run-command>
- Microsoft.HybridCompute machines/runCommands (Bicep resource definition,
  deployed at resource-group scope; GA API version 2025-06-01):
  <https://learn.microsoft.com/azure/templates/microsoft.hybridcompute/machines/runcommands>
- SSH access to Azure Arc-enabled servers (`az ssh arc`, no public IP or open
  ports, HybridConnectivity resource provider, Windows Server 2025 ships OpenSSH
  by default, Entra authentication):
  <https://learn.microsoft.com/azure/azure-arc/servers/ssh-arc-overview>
- Deploy and manage an Azure Arc-enabled Kubernetes cluster extension:
  <https://learn.microsoft.com/azure/azure-arc/kubernetes/extensions>
- Microsoft.KubernetesConfiguration extensions (Bicep resource definition; AVM
  module for the extension type):
  <https://learn.microsoft.com/azure/templates/microsoft.kubernetesconfiguration/extensions>
- Deploy Foundry Local as an Azure Arc extension (extensionType via portal / CLI
  `az k8s-extension` / Helm, Kubernetes 1.29+, Istio Gateway API, preview by
  request, GPU prerequisites):
  <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/deploy-foundry-local-arc-extension>
- What is Foundry Local on Azure Local? (Arc extension `Microsoft.Foundry`,
  `Model` and `ModelDeployment` custom resources, OpenAI-compatible API, supported
  workloads, preview by request):
  <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/overview>
- What is managed identities for Azure resources? (user-assigned is the recommended
  managed identity type; system-assigned versus user-assigned differences):
  <https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview>
- Configure a federated identity credential on a user-assigned managed identity
  (GitHub Actions OIDC onto a user-assigned managed identity, keyless CI deploy with no
  stored service-principal secret):
  <https://learn.microsoft.com/entra/workload-id/workload-identity-federation-create-trust-user-assigned-managed-identity>
- Access Azure resources by using managed identity on Azure Arc-enabled servers (the
  in-guest runtime identity is system-assigned; user-assigned is not supported on Arc;
  token via the HIMDS endpoint):
  <https://learn.microsoft.com/azure/azure-arc/servers/managed-identity-authentication>
- Identity and access management for Azure Arc-enabled servers (system-assigned managed
  identity, least-privilege Azure RBAC on Arc machines):
  <https://learn.microsoft.com/azure/cloud-adoption-framework/scenarios/hybrid/arc-enabled-servers/eslz-identity-and-access-management>
- Connect hybrid machines to Azure at scale using a service principal (the separate,
  accepted Arc onboarding-principal use, distinct from the runtime managed identity):
  <https://learn.microsoft.com/azure/azure-arc/servers/onboard-service-principal>
