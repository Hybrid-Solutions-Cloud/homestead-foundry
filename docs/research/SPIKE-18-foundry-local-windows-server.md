# SPIKE-18: Foundry Local on Windows Server, and whether the Arc run-command can actually install it

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, **no software installed**, no model API called. First-party documentation review plus read-only inspection of the local host.
Date: 2026-07-25
Scope: resolve the two unknowns SPIKE-08 left open for the Windows Server Foundry Local track (track 2 of ADR-0011), and verify that the install mechanism ADR-0011 selected actually works. Every factual claim is grounded in a first-party (Microsoft Learn) source, cited inline, or in a read-only measurement of this repo's own host, labelled as such. Anything Microsoft has not published is marked UNKNOWN with the test that would resolve it. This spike feeds ADR-0013; it authorizes no deployment and no spend.

Grounding read first: `SPIKE-08` (the on-device assessment that opened these unknowns), `ADR-0011` (which decided the track 2 automation form), `ADR-0005` (the governing identity ADR, managed identity first), and `ADR-0009` for the adjacent on-prem reviewer framing. This spike verifies and corrects against Microsoft Learn; it does not restate those documents.

---

## Question

Six questions, five of them carried forward from SPIKE-08 and ADR-0011, one of them new and decisive:

1. Is Foundry Local supported on Windows Server, specifically Windows Server 2025 build 26100? (SPIKE-08 UNKNOWN #1)
2. **New, and the crux: does `winget install Microsoft.FoundryLocal` actually work in the execution context an Arc run-command provides?** ADR-0011 track 2 decision 2 names that exact command as the install step.
3. What throughput should a GPU-less host expect on CPU-only inference? (SPIKE-08 UNKNOWN #2)
4. What are the Arc run-command's real mechanics, limits, and identity model, measured against this repo's managed-identity-first stance?
5. Does the Arc SSH fallback path hold up as ADR-0011 assumed?
6. What does track 2 actually govern, and what should ADR-0013 decide?

---

## Findings

### Q1. Windows Server support is still not stated first-party, but the gap is now narrower and testable

Microsoft's platform answer has not changed since SPIKE-08. The Foundry Local FAQ still says only that "Foundry Local supports Windows, macOS (Apple silicon), and Linux." Source: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions). The Windows quickstart still names a client prerequisite and no server edition: "Windows 11, version 24H2 (build 26100) or later," ".NET 9.0 SDK or later," and "A DirectX 12-capable GPU (integrated or discrete). The `WinML` package uses hardware acceleration and requires real GPU hardware; virtual machines without GPU passthrough are not supported." Source: [Get started with Foundry Local (Windows AI)](https://learn.microsoft.com/windows/ai/foundry-local/get-started).

Two things are worth separating, because SPIKE-08 partly conflated them:

- **The product framing is client-oriented, not server-oriented.** Foundry Local is described as "an end-to-end local AI solution for shipping applications that run entirely on the user's device" and is positioned for embedding AI "in client applications on end-user devices." Microsoft explicitly directs enterprise-scale, server-side, multi-user inference to the other product: "If you need enterprise-scale AI inference on your own infrastructure with Kubernetes-native operations and Azure Arc management, see Foundry Local on Azure Local." Source: [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local). That is a **positioning** statement, not a support boundary, but it is the clearest signal Microsoft gives, and it points track 2 users toward track 3 for anything resembling a shared service.
- **The CLI's own prerequisites are markedly softer than the Windows AI quickstart's.** The CLI reference lists only "a terminal," "internet access for first-time downloads," "Azure RBAC: Not applicable (runs locally)," and admin rights to install. It does **not** require a GPU and does not name a Windows edition. Source: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). The GPU requirement in the Windows AI quickstart attaches specifically to the `WinML` NuGet package and its hardware acceleration, not to the CLI or the service.

Net on Q1: **still UNKNOWN as a support statement, but the CLI path has no documented blocker for a GPU-less Windows Server host.** This remains resolvable only empirically, which is what the recommendation proposes.

**Measured, read-only, on this repo's own host this session** (no install performed, no state changed):

| Property | Measured value | Bearing on the question |
|---|---|---|
| OS | Windows Server 2025 Datacenter Azure Edition, build **26100** | Same build number as the documented Windows 11 24H2 client minimum |
| GPU | `Microsoft Hyper-V Video`, `Microsoft Remote Display Adapter` | Synthetic display adapters only. No GPU passthrough, so the `WinML` accelerated path is out per its own documented requirement |
| .NET SDK | 9.0.316 | Satisfies the ".NET 9.0 SDK or later" prerequisite |
| winget | v1.29.280, present | The package manager the documented install uses **is** available on this Server SKU |
| Logical cores / RAM | 8 / 63.9 GB | Ample RAM for a quantized small model; core count is the throughput constraint, not memory |
| Free disk | ~800 GB on C, ~811 GB on D | No cache-size constraint for several models |
| `foundry` on PATH | Not present | Nothing is installed; this spike changed no state |

The build number equivalence is suggestive and nothing more. Microsoft has not stated that build 26100 on Server carries the same support as build 26100 on Client, and a shared build number is not a support statement.

### Q2. The install command ADR-0011 selected is documented by Microsoft to fail for a machine-wide install

This is the substantive finding of the spike, and it contradicts ADR-0011 as written.

Foundry Local ships on Windows as an **MSIX package**. Microsoft's own troubleshooting guide documents the failure mode directly:

> `winget install Microsoft.FoundryLocal --scope machine` fails with "The current system configuration doesn't support the installation of this package." Cause: **Winget blocks MSIX machine-scope installs.**

Source: [Best practices and troubleshooting guide for Foundry Local CLI (preview)](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice#troubleshooting).

The documented workaround is not a winget flag. It is a different mechanism entirely:

> Download the `.msix` and its dependency package. Run PowerShell as Administrator. Run the following command to install Foundry Local for all users:
> ```powershell
> Add-AppxProvisionedPackage -Online -PackagePath .\FoundryLocal.msix `
>   -DependencyPackagePath .\VcLibs.appx -SkipLicense
> ```

Source: same page, "Installation issues."

Why this matters for track 2 specifically, and not merely as a footnote:

1. **ADR-0011 track 2 decision 2 names the wrong command.** It states the run-command "carries the PowerShell that runs `winget install Microsoft.FoundryLocal`." Run under an Arc run-command, that is a machine-context, non-interactive, no-logged-on-user execution. A bare `winget install` in that context installs per-user for whichever account the script runs as, if it succeeds at all; the `--scope machine` form that would make it a real server install is documented to fail. ADR-0013 has to replace this step.
2. **MSIX plus per-user semantics is a poor fit for a headless server in general.** An MSIX app installed into a service account's profile is not a machine-wide service in any operational sense. `Add-AppxProvisionedPackage -Online` provisions the package so it installs for all users, which is the correct shape for a server, and it works from a SYSTEM or administrator context without an interactive session.
3. **The workaround needs artifacts, not just a package name.** It requires the `.msix` and a `VcLibs.appx` dependency to be present on disk. Under a run-command that means either fetching them in-script from a first-party location, or staging them via the run-command's `scriptUri` or a storage blob. That is a materially more complex install step than "run winget," and it drags in the blob-authentication constraint in Q4.

Microsoft does publish a direct installer as an alternative to the package managers: "Alternatively, download the installer from the [foundry-samples GitHub repository](https://aka.ms/foundry-local-installer)." Source: [Foundry Local CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli). Whether that installer is machine-scope and silent-capable is not documented on that page and is carried as an UNKNOWN below.

One further operational note from the same troubleshooting page: after install, a service connection error such as `Request to local service failed` is common enough that Microsoft's standing advice is `foundry service restart`. Any automated install step should therefore treat "installed" and "service reachable" as two separate checks, and should run `foundry service status` (which "prints whether the Foundry Local service is running and includes its local endpoint") rather than inferring health from the installer's exit code. Sources: [troubleshooting guide](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice#troubleshooting), [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli).

### Q3. CPU-only throughput: still no published numbers, but the model sizing is now concrete

Microsoft publishes no CPU latency or throughput table for the device SDK, so SPIKE-08's UNKNOWN #2 cannot be closed from documentation. What is now documented is the shape of the problem:

- Microsoft names CPU-only large-model inference as a known cause of poor performance, and its own remedy is hardware, not tuning: issue "Slow inference," cause "CPU-only model with a large parameter count," solution "Use GPU-optimized model variants when available." Source: [troubleshooting guide](https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice#troubleshooting). On a host with no GPU, that remedy is unavailable, which means the only lever is choosing a smaller model.
- Concrete CPU variant sizing is published on the Azure Local side of the product family and is a reasonable proxy for the device catalog, since both draw on the same `foundry-local` ONNX source: `Phi-4-mini-instruct-generic-cpu` is roughly **4.8 GB** and uses `CPUExecutionProvider`, versus roughly 3.6 GB for the CUDA GPU variant. Source: [Model catalog and sourcing in Foundry Local](https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog#image-selection).
- The device CLI exposes hardware filtering directly, so a CPU-only host can enumerate what it can actually run: `foundry model list --filter device=GPU` implies the symmetric CPU filter, and aliases such as `phi-4-mini` let Foundry Local "automatically select the best variant for your hardware." Sources: [Use the Foundry Local CLI (preview)](https://learn.microsoft.com/azure/foundry-local/how-to/how-to-use-foundry-local-cli), [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli).

Practical read for this repo's 8-core, 64 GB, GPU-less host: a roughly 5 GB quantized 4B-class model such as `phi-4-mini` is the realistic ceiling for interactive use, and the 7B-to-20B reviewer models SPIKE-08 floated (`gpt-oss-20b`, `phi-4-reasoning`, DeepSeek R1 distills) should be assumed too slow for a synchronous publish-time step until measured. RAM is not the binding constraint here; core count is. This stays UNKNOWN as a number and is resolvable only by measurement.

### Q4. Arc run-command mechanics, and two real conflicts with this repo's stated posture

The mechanism ADR-0011 chose is sound in outline and better documented than the ADR implies, but it carries three constraints the ADR does not record and one that conflicts with ADR-0005.

**Confirmed as ADR-0011 assumed:**

- **No extra extension, and no inbound ports.** Run command "is built in to the Connected Machine agent (starting with version 1.33)" and needs no additional VM extension. It lets you "remotely and securely execute scripts or commands on virtual machines (VMs) connected to Azure Arc, without requiring a direct connection through Remote Desktop Protocol or SSH." Source: [Run command on Azure Arc-enabled servers (preview)](https://learn.microsoft.com/azure/azure-arc/servers/run-command).
- **RBAC is exactly the split ADR-0011 named.** Running a command needs `Microsoft.HybridCompute/machines/runCommands/write`, carried by **Azure Connected Machine Resource Administrator** and higher; listing or reading results needs `Microsoft.HybridCompute/machines/runCommands/read`, carried by **Reader** and higher. Source: [Run command, Limit access](https://learn.microsoft.com/azure/azure-arc/servers/run-command#limit-access-to-run-command-preview).
- **Protected parameters exist for secrets.** `-ProtectedParameter` passes sensitive inputs such as passwords or keys to the script without inlining them. Source: [Run command, Use the Run command](https://learn.microsoft.com/azure/azure-arc/servers/run-command#use-the-run-command).
- **Honest success signalling.** Instance View returns `InstanceViewExecutionState` (whether the script succeeded), `ProvisioningState` (whether the platform could trigger it at all), exit code, stdout, and stderr, and "a nonzero exit code indicates an unsuccessful execution." Source: same page. This vindicates ADR-0011's argument that the run-command's own execution state is a better success signal than a Bicep `runCommands` resource reporting only that a script ran.
- **It is free.** "While the Run command on Azure Arc-enabled servers is free to use, scripts you store in Azure incur billing charges." Source: [Run command](https://learn.microsoft.com/azure/azure-arc/servers/run-command).

**Not recorded in ADR-0011, and consequential:**

1. **Managed identity does not cover the blob path. This conflicts with ADR-0005.** Microsoft states plainly: "Run command on Azure Arc-enabled servers doesn't currently support authenticating blobs by using managed identities." Source: [Run command](https://learn.microsoft.com/azure/azure-arc/servers/run-command). Every blob-adjacent feature therefore needs a SAS URI instead of a managed identity: `scriptUri` for a staged script, and `outputBlobUri` / `errorBlobUri` for full output capture. Those SAS URIs "must provide read access" (script) or "read, append, create, and write access" (output and error, which must be AppendBlob type), with a 24-hour expiry suggested. Source: [Run command, Use the Run command](https://learn.microsoft.com/azure/azure-arc/servers/run-command#use-the-run-command). This is a documented product gap, not a design choice this repo can architect around: if track 2 stages the MSIX artifacts or captures full logs via blobs, it must handle a short-lived SAS token, which is a secret, and ADR-0005's managed-identity-first rule cannot be satisfied for that specific hop. ADR-0013 must state this exception explicitly rather than let ADR-0005 be silently violated.
2. **Output is truncated to 4 KB unless blobs are used.** "The output and error fields in `instanceView` are limited to the last 4 KB." Source: [Run command, Azure CLI](https://learn.microsoft.com/azure/azure-arc/servers/run-command#use-the-run-command). A model pull that prints progress will blow past that, so a meaningful install log requires the blob path, which re-triggers constraint 1. The alternative is to keep the script deliberately terse and emit only a compact structured result.
3. **Running as a specific user needs a password, and a service.** `-RunAsUser` / `-RunAsPassword` exist, but require that "on a Windows machine, make sure 'Secondary Logon' is running," and that the user has access to the machine and to the resources the script touches. Source: [Run command, Use the Run command](https://learn.microsoft.com/azure/azure-arc/servers/run-command#use-the-run-command). This matters because of Q2: if a per-user MSIX install were chosen, it would need a real user context and therefore a password, which is exactly the secret-bearing pattern ADR-0005 pushes away from. Using `Add-AppxProvisionedPackage -Online` from the default machine context avoids `RunAsUser` altogether, which is a second, independent reason to prefer it.
4. **Preview, and not in the portal.** Run command on Arc-enabled servers is in public preview, and "isn't currently available in the Azure portal," so CLI, PowerShell (`Az.ConnectedMachine`), or REST are the only surfaces. The REST examples use api-version `2024-11-10-preview`. Sources: [Run command](https://learn.microsoft.com/azure/azure-arc/servers/run-command), [Run command, REST API](https://learn.microsoft.com/azure/azure-arc/servers/run-command#use-the-run-command).
5. **It can be blocked at the agent.** An operator can disable the mechanism locally with `azcmagent config set extensions.blocklist "microsoft.cplat.core/runcommandhandlerwindows"`. Source: [Run command, Limit access](https://learn.microsoft.com/azure/azure-arc/servers/run-command#limit-access-to-run-command-preview). Worth knowing as a failure mode when a run-command never triggers.

### Q5. Arc SSH as the fallback path holds up

ADR-0011's fallback is intact but has a one-time subscription-level prerequisite it does not mention: the `Microsoft.HybridConnectivity` resource provider must be registered (`az provider register -n Microsoft.HybridConnectivity`, "a one-time operation that needs to be performed on each subscription," taking 2 to 5 minutes), and a default connectivity endpoint must exist per Arc server, though "it should complete automatically at first connection." Source: [SSH access to Azure Arc-enabled servers](https://learn.microsoft.com/azure/azure-arc/servers/ssh-arc-overview#enable-ssh-access-to-arc-enabled-servers). No inbound port is required, consistent with the run-command path.

### Q6. What track 2 actually governs, and the shape of the recommendation

SPIKE-08's conclusion that the CAF and WAF governance methodology does not transfer to the device runtime is confirmed and, if anything, understated. The device product's own CLI reference states "Azure RBAC: Not applicable (runs locally)" and no Azure subscription is required at all. Source: [CLI reference](https://learn.microsoft.com/azure/foundry-local/reference/reference-cli), [What is Foundry Local?](https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local#frequently-asked-questions).

So the honest scope of track 2's governance story is narrow and worth stating plainly: **Arc governs the act of installing and configuring, not the running inference service.** Once installed, the local endpoint has no Azure RBAC, no Entra authentication, no Key Vault integration, no budget, and no Azure Monitor surface. Track 2 buys a governed, audited, RBAC-gated, portless remote-execution path to a host, plus Azure Policy and machine inventory over that host. It does not buy a governed AI endpoint. Anyone reading ADR-0011's three-track table could reasonably infer more parity between tracks than exists, and ADR-0013 should say so directly.

---

## What is still UNKNOWN

| # | Unknown | Why it is not in the docs | What resolves it |
|---|---|---|---|
| 1 | **Is Foundry Local supported, or merely functional, on Windows Server 2025 build 26100?** | Docs say "Windows" generically and name Windows 11 24H2 (build 26100) as the client prerequisite. No Windows Server statement either way, and the product is positioned for end-user devices. | Install via `Add-AppxProvisionedPackage -Online` on the Server host in a throwaway test, then run `foundry service status` and one `phi-4-mini` chat call. A clean success or an explicit unsupported-OS error settles functionality. It does not settle *supportability*, which needs a Microsoft support statement. Requires owner authorization to install software. |
| 2 | **CPU-only throughput for a ~5 GB quantized model on 8 cores.** | No CPU latency or throughput table is published for the device SDK. | Measure: time a fixed reviewer prompt against `phi-4-mini` on CPU and record tokens per second and wall-clock. Judge against the intended use (interactive versus batch). |
| 3 | **Is the direct installer at `aka.ms/foundry-local-installer` machine-scope and silent-capable?** | The CLI reference names it as an alternative but documents no flags, scope, or silent-install switch. | Inspect the installer from the foundry-samples GitHub repository for its type and supported switches before choosing it over `Add-AppxProvisionedPackage`. |
| 4 | **Do the `.msix` and `VcLibs.appx` artifacts have a stable, first-party, directly fetchable URL?** | The troubleshooting page says "download the `.msix` and its dependency package" without naming a canonical URL. | Resolve at implementation time; if no stable first-party URL exists, the artifacts must be staged (which pulls in the SAS constraint in Q4) or the direct installer used instead. |
| 5 | **Does `Add-AppxProvisionedPackage -Online` succeed under an Arc run-command's non-interactive machine context on Server 2025?** | Neither the Foundry Local docs nor the Arc run-command docs address MSIX provisioning under run-command specifically. | Test the two steps independently: first the provisioning command in an elevated local session, then the same command wrapped in a run-command against an Arc-enabled test host. |
| 6 | **Whether Foundry Local's per-model licenses permit this repo's intended use.** | Per-model, not summarized centrally. Carried unchanged from SPIKE-08. | `foundry model info <model> --license` at evaluation time. |

Unknowns 1, 2, and 5 all resolve from the same short install test. Unknowns 3 and 4 are read-only and resolvable now without installing anything.

---

## Recommendation

1. **Write ADR-0013 to correct ADR-0011's track 2 install step, not to re-decide the track.** ADR-0011's core choice stands and the research supports it: Arc-enablement as a hard prerequisite, imperative in-guest automation over the Arc run-command, Arc SSH as fallback, RBAC-gated execution, no inbound ports. What must change is the specific install mechanism. Replace `winget install Microsoft.FoundryLocal` with `Add-AppxProvisionedPackage -Online` against a staged `.msix` plus its `VcLibs.appx` dependency, because Microsoft documents that winget blocks MSIX machine-scope installs and the winget path cannot produce a machine-wide install on a headless server.

2. **Record the managed-identity exception explicitly in ADR-0013.** Arc run-command does not support managed-identity authentication for blobs. Any use of `scriptUri`, `outputBlobUri`, or `errorBlobUri` requires a short-lived SAS URI. ADR-0005 is the governing identity ADR and says managed identity first; this is a documented product gap, so ADR-0013 must name it as a scoped, time-boxed exception with the mitigations (24-hour SAS expiry, least-privilege blob permissions, no SAS in committed text, revisit at GA) rather than leaving a silent contradiction between the two ADRs.

3. **Design the install script to be terse and to emit a compact structured result, so the 4 KB Instance View limit is sufficient and the blob path stays optional.** If full logs are needed, treat that as a deliberate opt-in that accepts the SAS exception above. Validate with `foundry service status` and one inference call, not with the installer's exit code, because a post-install service connection error is a documented common case.

4. **Resolve unknowns 3 and 4 now, before any install.** Both are read-only: inspect the direct installer's type and switches, and establish whether a stable first-party artifact URL exists for the `.msix` and its dependency. The answer determines whether the install step needs blob staging at all, which in turn determines whether recommendation 2's exception is even required. This is cheap and it may remove the only identity conflict in the track.

5. **Then run one throwaway install test on this repo's existing Windows Server 2025 host to close unknowns 1, 2, and 5 together.** The host is already the exact configuration in question: Server 2025 Datacenter Azure Edition build 26100, GPU-less, .NET 9 present, winget present, 8 cores, 64 GB RAM. Scope the test to: provision the MSIX for all users, `foundry service status`, pull `phi-4-mini`, time one fixed prompt, record tokens per second, then uninstall. **This needs the owner's explicit authorization, because it installs software, which this repo's rules gate.** It does not need any Azure resource, any spend, or any Arc onboarding, so it is the cheapest possible way to retire three unknowns at once.

6. **Set expectations honestly about what track 2 governs, in both ADR-0013 and the roadmap.** Arc governs installation and host management. It does not govern the inference endpoint, which has no Azure RBAC, no Entra authentication, no Key Vault integration, and no budget. If a governed on-prem AI endpoint is the actual requirement, the answer is track 3, and Microsoft's own documentation routes enterprise-scale server inference there. Track 2 is worth building as a genuine single-host capability and as a proof of the Arc automation pattern, not as a governance-equivalent sibling of tracks 1 and 3.

7. **Do not defer track 2 on the GPU question.** SPIKE-08 tied a future local-reviewer decision to a GPU-capable host existing. That framing should not block this track. A GPU-less host can run a roughly 5 GB quantized model today; what it cannot do is run the 7B-to-20B frontier-substitute reviewers at interactive speed. Those are separate decisions, and conflating them is what left this track stalled.

Net: ADR-0011 picked the right automation form for track 2 and the wrong install command. The track is not blocked by anything external. Three of its six unknowns close with one authorized install test on hardware this project already owns, and two more close with reading that needs no authorization at all.

---

## Sources

All first-party Microsoft Learn unless noted. Retrieved 2026-07-25.

- What is Foundry Local? (product framing, platform FAQ, no-subscription statement): <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>
- Get started with Foundry Local (Windows AI) (client prerequisites, GPU and WinML requirement, per-package guidance): <https://learn.microsoft.com/windows/ai/foundry-local/get-started>
- Foundry Local CLI reference (install commands, prerequisites, "Azure RBAC: Not applicable," direct installer alternative, `foundry service status`): <https://learn.microsoft.com/azure/foundry-local/reference/reference-cli>
- Use the Foundry Local CLI (preview) (catalog browsing, hardware filters, aliases): <https://learn.microsoft.com/azure/foundry-local/how-to/how-to-use-foundry-local-cli>
- Best practices and troubleshooting guide for Foundry Local CLI (preview) (the winget MSIX machine-scope block, the `Add-AppxProvisionedPackage` workaround, slow-CPU-inference guidance, service restart): <https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice>
- Model catalog and sourcing in Foundry Local (CPU variant sizing and execution providers): <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog>
- Run command on Azure Arc-enabled servers (preview) (agent version, no inbound ports, RBAC split, protected parameters, Instance View fields, 4 KB output limit, SAS requirements, the managed-identity blob gap, RunAsUser, preview and no-portal status, agent blocklist): <https://learn.microsoft.com/azure/azure-arc/servers/run-command>
- Cloud-native scripting and task automation with Arc-enabled servers (positioning of Run Command for fleet automation): <https://learn.microsoft.com/azure/azure-arc/servers/cloud-native/scripting-task-automation>
- SSH access to Azure Arc-enabled servers (HybridConnectivity provider registration, default endpoint): <https://learn.microsoft.com/azure/azure-arc/servers/ssh-arc-overview>

Local host measurements in Q1 were taken read-only on this repo's own Windows Server 2025 host on 2026-07-25 via `Get-CimInstance` and `Get-Command`. No software was installed and no state was changed.
