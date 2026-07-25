# ADR-0013: Track 2 install mechanism, identity exception, and governance scope for Foundry Local on Windows Server

- Status: Proposed
- Date: 2026-07-25

This ADR resolves the two unknowns that left track 2 of ADR-0011 stalled, corrects the install mechanism ADR-0011 selected, and states plainly what Azure Arc does and does not govern for an on-device Foundry Local runtime. It is grounded entirely in `docs/research/SPIKE-18-foundry-local-windows-server.md`; where that spike logged an UNKNOWN, this ADR carries it forward rather than resolving it.

This ADR authorizes **no deployment** and **no spend**. It authorizes **one owner-gated software install test** on hardware this project already owns, described in the Decision, and nothing else. It records how track 2 is automated and under what preconditions, gated the same way every other decision in this backlog is: spike, then ADR, then design, then a gated deploy.

It supersedes ADR-0011's track 2 decision 2 on the specific install command, and amends ADR-0005 with one narrow, documented exception. Everything else in ADR-0011's track 2 decision stands unchanged.

## Context

ADR-0011 decided track 2's automation form in 2026-07 and authorized no build. It has sat unbuilt since, nominally gated on the two unknowns SPIKE-08 recorded: whether Foundry Local is supported on Windows Server, and whether CPU-only throughput on a GPU-less host is tolerable. Neither was ever tested. SPIKE-18 was written to resolve them, and in doing so it found a third problem that had nothing to do with either gate.

The forces this decision must reconcile, all from SPIKE-18:

1. **The install command ADR-0011 named cannot produce a machine-wide install.** Foundry Local ships on Windows as an MSIX package, and Microsoft documents that `winget install Microsoft.FoundryLocal --scope machine` fails with "The current system configuration doesn't support the installation of this package," because winget blocks MSIX machine-scope installs. ADR-0011 track 2 decision 2 specifies that exact command as the payload the Arc run-command carries. Microsoft's documented workaround is a different mechanism entirely: `Add-AppxProvisionedPackage -Online` against a downloaded `.msix` and its `VcLibs.appx` dependency.

2. **An Arc run-command executes non-interactively with no logged-on user.** A per-user MSIX install in that context is either meaningless (installed into a service account profile) or requires `RunAsUser` and `RunAsPassword`, which needs a real password and the Secondary Logon service. Machine-wide provisioning avoids both problems.

3. **Arc run-command does not support managed identity for blob access.** Microsoft states it plainly. Any use of `scriptUri`, `outputBlobUri`, or `errorBlobUri` requires a shared access signature (SAS) URI instead. ADR-0005 is this repo's governing identity ADR and says managed identity first. This is a documented product gap, not an architecture choice, so it needs an explicit recorded exception rather than a silent contradiction.

4. **Instance View output is capped at 4 KB.** A model pull that prints progress will exceed it, and the only documented way to capture more is the blob path, which re-triggers force 3.

5. **Windows Server support remains unstated by Microsoft**, and the product is positioned for end-user devices, with Microsoft routing enterprise-scale server inference to Foundry Local on Azure Local (track 3) instead. But nothing in the CLI's own prerequisites blocks a GPU-less Windows Server host, and the configuration in question is already available to this project in two places: the platform VM (Windows Server 2025 Datacenter Azure Edition build 26100, no GPU passthrough, .NET 9.0.316, winget v1.29.280, 8 logical cores, 63.9 GB RAM), and a dedicated Windows Server 2025 build VM under nested virtualization, also GPU-less. No hardware purchase is needed to answer the question.

6. **A governing build-environment policy constrains where a test like this may run.** The operator's platform standards rank build runners by cost and isolation, reserve Windows build hosts for genuinely Windows-only work, and treat a general-purpose platform host as a host *for* build targets rather than a build target itself. An earlier draft of this ADR proposed running the install test directly on the platform host, which that policy does not permit. Deployers adopting this methodology should expect an equivalent constraint in any governed environment.

7. **That policy's stated rationale is a caution this track should hear.** It prefers isolated local virtualization over cloud run-command for build workloads because Azure VM run-command carries a hard execution timeout, permits only one execution at a time, can deadlock its extension, and offers no shell escape hatch when a command hangs. Arc run-command is a different service and this ADR does not assume those limits transfer verbatim, but the failure shapes are close enough to matter for a step that pulls multi-GB model files.

8. **Arc governs the install, not the endpoint.** Foundry Local's own CLI reference states "Azure RBAC: Not applicable (runs locally)" and no Azure subscription is required. Once installed, the local inference endpoint has no Azure RBAC, no Entra authentication, no Key Vault integration, no budget, and no Azure Monitor surface. ADR-0011's three-track table invites a reader to assume more governance parity between tracks than exists.

9. **The GPU question was conflated with the support question and froze the track.** SPIKE-08 tied any future local-reviewer work to a GPU-capable host existing. That coupling is what kept a cheap, read-only-plus-one-install-test question unanswered for weeks.

## Decision

### 1. Machine-wide MSIX provisioning replaces `winget install`

The install step is `Add-AppxProvisionedPackage -Online`, run from the Arc run-command's default machine context against a staged `.msix` and its `VcLibs.appx` dependency, with `-SkipLicense`. `winget install Microsoft.FoundryLocal` is rejected as the automated install mechanism for this track, because the machine-scope form is documented to fail and the per-user form does not produce a server install. This supersedes ADR-0011 track 2 decision 2 on this point only.

`winget` remains acceptable for interactive, human-driven installs on a workstation, which is the context Microsoft documents it for. It is not the automation path.

The direct installer at `aka.ms/foundry-local-installer` is a permitted alternative **if and only if** it is confirmed to be machine-scope and silent-capable (SPIKE-18 UNKNOWN #3). That confirmation is read-only and must happen before implementation, not during it.

### 2. `RunAsUser` is not used

Track 2's automation runs in the run-command's default machine context. `RunAsUser` and `RunAsPassword` are rejected because they require a password, which is a secret this design does not otherwise need, and because they depend on the Secondary Logon service being available. Machine-wide provisioning makes them unnecessary.

### 3. Arc-enablement, the run-command, and Arc SSH stand as ADR-0011 decided

Unchanged and reaffirmed: Arc-enablement of the host is a hard prerequisite; the install, model pull, and service configuration are driven imperatively through the Arc run-command; Arc SSH is the interactive and fallback path; neither path requires a public IP or an open inbound port; execution is gated by Azure RBAC, with `Microsoft.HybridCompute/machines/runCommands/write` (Azure Connected Machine Resource Administrator) to run and `.../read` (Reader) to inspect; sensitive script inputs use the protected-parameter mechanism; and packaging the run-command as a `Microsoft.HybridCompute/machines/runCommands` Bicep resource is permitted but not required.

Two prerequisites ADR-0011 omitted are added: the Arc SSH fallback requires the `Microsoft.HybridConnectivity` resource provider registered once per subscription, and the run-command requires Connected Machine agent version 1.33 or later. Run command on Arc-enabled servers is in public preview and is not available in the Azure portal, so CLI, `Az.ConnectedMachine`, or REST are the only surfaces.

### 4. A scoped, time-boxed exception to ADR-0005 for blob access

Where track 2 uses `scriptUri`, `outputBlobUri`, or `errorBlobUri`, it authenticates with a SAS URI, not a managed identity, because the product does not support managed identity for that hop. This is an explicit exception to ADR-0005's managed-identity-first rule, scoped to this one mechanism on this one track, with these mandatory mitigations:

- SAS expiry of 24 hours or less, matching Microsoft's own guidance.
- Least-privilege permissions: read only for a script blob; read, append, create, and write for output and error AppendBlobs, which is the documented minimum.
- No SAS URI in any committed file. Generated at run time and passed as a protected parameter.
- Revisited when Run command on Arc-enabled servers reaches GA, or sooner if managed-identity blob support ships.

ADR-0005 remains the governing identity ADR. This is the only exception to it on this track.

### 5. The install script stays terse, and the blob path is opt-in

The run-command payload emits a compact structured result (a single JSON object with install state, service state, resolved version, and a pass or fail per check) so that the 4 KB Instance View limit is sufficient for normal operation. Full log capture via output and error blobs is a deliberate opt-in for troubleshooting, and invoking it accepts the exception in decision 4. Default operation therefore has **no** secret surface at all, which is the point of keeping the script terse.

### 6. Success is proven by service state and one inference call, never by an installer exit code

Validation is `foundry service status`, which reports whether the service is running and prints its local endpoint, followed by one inference call against a pulled model. A post-install `Request to local service failed` condition is common enough that Microsoft's standing advice is `foundry service restart`, so "the installer returned 0" is not evidence the runtime works. This matches this repo's existing rule that a file existing is not evidence it does its job.

### 7. GPU capability is decoupled from this track

Track 2 targets CPU-only inference of a quantized small model in the `phi-4-mini` class (roughly 4.8 GB, `CPUExecutionProvider`) as its first and only committed increment. The `WinML` accelerated path is out of scope on this host by its own documented requirement, since virtual machines without GPU passthrough are unsupported. Whether a 7B-to-20B frontier-substitute reviewer is viable is a **separate** decision, deferred, and it does not gate this track. SPIKE-08's coupling of the two is explicitly undone here.

### 8. Track 2's governance scope is stated honestly

Azure Arc governs the act of installing, configuring, and managing the host: RBAC-gated remote execution, an audit trail, captured output, Azure Policy, and machine inventory, with no inbound ports. Arc does **not** govern the running inference endpoint. The endpoint has no Azure RBAC, no Entra authentication, no Key Vault integration, no budget, and no Azure Monitor surface, and Foundry Local requires no Azure subscription to run.

Consequently track 2 is positioned as a genuine single-host capability and a proof of the Arc automation pattern, **not** as a governance-equivalent sibling of tracks 1 and 3. If a governed on-prem AI endpoint is the requirement, the answer is track 3, and Microsoft's own documentation routes enterprise-scale server inference there. ADR-0011's three-track table is amended by this paragraph.

### 9. The gate: two read-only resolutions, then one authorized install test

In order:

1. **Read-only, no authorization needed, do first.** Resolve SPIKE-18 UNKNOWN #3 (is the direct installer machine-scope and silent-capable) and UNKNOWN #4 (is there a stable first-party URL for the `.msix` and `VcLibs.appx`). The answers determine whether blob staging is needed at all, and therefore whether decision 4's exception is even required. If a stable first-party URL exists, track 2 may have no secret surface and no ADR-0005 exception in practice.
2. **Owner-gated, one time, on a dedicated disposable Windows build VM.** One throwaway install test scoped to: provision the MSIX for all users, `foundry service status`, pull `phi-4-mini`, time one fixed prompt, record tokens per second and wall-clock, then uninstall. This closes UNKNOWN #1 (does it work on Server 2025), UNKNOWN #2 (CPU throughput), and UNKNOWN #5 (does provisioning work under a non-interactive machine context) together. It requires no Azure resource, no spend, and no Arc onboarding.

**The test does not run on the machine that hosts other work.** Deployers operating this methodology inside a governed environment should expect a build-environment policy that ranks runners by cost and isolation, reserves Windows hosts for genuinely Windows-only work, and treats a general-purpose workstation or platform host as a host for build targets rather than a build target itself. Foundry Local's install is genuinely Windows-only (Appx provisioning plus a Windows service), so it belongs on a dedicated Windows Server 2025 build VM, and a disposable one is the right choice on the merits: a throwaway install leaves no MSIX package, Windows service, or multi-GB model cache behind on a shared machine. Where such a VM is powered off when idle, the test should be driven by a wrapper that records the original power state, starts the VM, waits for remote management to answer, runs the script, and restores the original state.

Two honest caveats follow from testing on a smaller dedicated VM:

- **A build VM is typically provisioned smaller than a platform host.** A tokens-per-second figure measured on fewer cores is a *floor*, not a prediction for the production target. That is acceptable for a go or no-go on UNKNOWN #2, because a result fast enough on the smaller host is certainly fast enough on the larger one. A result that is too slow does not by itself condemn the approach, and justifies one re-measurement on a VM sized to the real target before any verdict.
- **A nested-virtualization build VM is GPU-less**, so the GPU-less premise this track depends on holds unchanged and the `WinML` accelerated path remains correctly out of scope.

If the dedicated build VM is unavailable, an ephemeral Windows Server 2025 VM deployed for the test and deleted afterward is the correct fallback. That is also the right choice when the throughput number must be measured on hardware matching the production target.

This repo's own governing build-environment rules, including the specific build hosts, live in the operator's private platform standards and are deliberately not reproduced here.

**This install test requires the owner's explicit authorization, because this repo gates software installation.** That is the only gate remaining on track 2. It is not blocked by hardware, by cost, by preview access, or by any external dependency.

Anything beyond those two steps (Arc onboarding a target host, authoring the production run-command, a pipeline) is a later increment and is not authorized here.

### 10. CAF naming and scope, unchanged

The Arc machine is a pre-existing Arc registration in a CAF-named resource group following this repo's `<resource-type-abbreviation>-<workload>-<env>-<region>-<instance>` pattern, and the run-command resource takes a stable descriptive name such as `install-foundrylocal`. The device runtime provisions nothing else in Azure, so there is no account, deployment, or budget resource to name for this track.

## Consequences

**Positive**

- The track is unblocked. Its remaining work is one authorized install test plus two read-only lookups, all on hardware and documentation already available.
- The install actually works. Following ADR-0011 literally would have produced a run-command that failed on its first line, or silently installed into a service account profile, which is arguably worse.
- Default operation has no secret surface. Keeping the script terse and the blob path opt-in means the common case needs no SAS token and no protected parameter.
- The identity contradiction is recorded rather than hidden. A reader comparing ADR-0005 and track 2 will find the exception, its scope, its mitigations, and its review trigger.
- Expectations are honest. Nobody reading the three-track table will now assume track 2 delivers a governed AI endpoint.
- The GPU question no longer blocks anything. A CPU-only increment is committed and testable now.

**Negative, and accepted**

- The install step is more complex than "run winget." It needs two artifacts on disk, which may need staging, which may need a SAS token.
- Provisioning an MSIX under a non-interactive run-command context is not documented by Microsoft either way (UNKNOWN #5). It is plausible and it is cheap to test, but it is not yet proven. If it fails, the fallback is Arc SSH with an interactive elevated session, which is a weaker automation story and would need recording as an amendment.
- Track 2 depends on two preview features at once: Run command on Arc-enabled servers, and the Foundry Local CLI. Neither carries an SLA. Accepted for a single-host, non-production capability; it would not be accepted for a production dependency.
- Windows Server supportability stays unresolved even if the install test passes. A working install proves function, not a Microsoft support statement. Track 2 therefore carries permanent "functional, not formally supported" risk unless Microsoft publishes a Server statement.
- The 4 KB output cap means the default install path returns a compact result rather than a full log, so first-failure diagnosis may need a second, blob-enabled run.
- Testing on a smaller dedicated build VM rather than the platform host means the throughput number is a floor, not a prediction for the real target. A slow result may need one re-measurement on a VM sized to the production host before it can be treated as a verdict on the approach.
- Driving the test through a build-VM wrapper adds power-management and remote-management-readiness steps to what would otherwise be a single local command, and it needs vault access for the build VM's credentials. This is the correct cost of following the governing policy, not incidental overhead.

**Neutral**

- `winget` is not banned, just not used for automation. Interactive workstation installs are unaffected.
- Packaging the run-command in Bicep remains optional, exactly as ADR-0011 left it.

## Alternatives considered

1. **Run the install test directly on the platform host.** Rejected, and it was this ADR's own earlier draft. The operator's governing build-environment policy does not treat a platform host as a build target and reserves Windows-only work for a dedicated Windows build VM. Beyond compliance, the reasoning applies squarely here: a throwaway install of an MSIX package, a Windows service, and a multi-GB model cache does not belong on the machine that hosts every other workstream. A disposable build VM is the correct target.

1. **Keep `winget install Microsoft.FoundryLocal`, as ADR-0011 specified.** Rejected: Microsoft documents that the machine-scope form fails, and the per-user form does not yield a machine-wide install on a headless server. This is not a preference, it is a documented product constraint.
2. **`winget install` with `RunAsUser` to give it a real user context.** Rejected: introduces a password where none is otherwise needed, depends on the Secondary Logon service, and still produces a per-user install scoped to a service account. Strictly worse than machine-wide provisioning on both security and operational grounds.
3. **Declarative Bicep over `Microsoft.HybridCompute/machines/runCommands` as the primary form.** Rejected again, for ADR-0011's original reason, now better supported: the run-command's own Instance View returns execution state, exit code, stdout, and stderr, and a nonzero exit code indicates failure. That is a more honest success signal than a Bicep resource reporting that a script ran. Bicep packaging remains permitted for graph consistency.
4. **Skip track 2 and route everything to track 3.** Rejected for now, though it is the direction Microsoft's own positioning points. Track 2 is cheap, proves the Arc automation pattern that has value independent of Foundry Local, and needs no cluster and no preview access. Revisit if the install test fails or if the single-host capability proves to have no real use.
5. **Wait for a Microsoft statement on Windows Server support before testing.** Rejected: it has not appeared in the months since SPIKE-08, there is no reason to expect it, and waiting is exactly what stalled this track. An empirical answer on the actual target host is available for the cost of one authorized install.
6. **Defer the whole track until a GPU-capable host exists, per SPIKE-08's framing.** Rejected: it conflates a throughput question with a compatibility question. A GPU-less host can run a roughly 5 GB quantized model, and that is a legitimate increment.

## Sources

Every claim traces to `docs/research/SPIKE-18-foundry-local-windows-server.md`, which cites its first-party Microsoft Learn sources inline. The load-bearing ones:

- Best practices and troubleshooting guide for Foundry Local CLI (preview), for the winget MSIX machine-scope block and the `Add-AppxProvisionedPackage` workaround: <https://learn.microsoft.com/azure/foundry-local/reference/reference-best-practice>
- Foundry Local CLI reference, for install commands, prerequisites, "Azure RBAC: Not applicable," the direct installer, and `foundry service status`: <https://learn.microsoft.com/azure/foundry-local/reference/reference-cli>
- Get started with Foundry Local (Windows AI), for the client prerequisites and the GPU passthrough requirement on the WinML package: <https://learn.microsoft.com/windows/ai/foundry-local/get-started>
- What is Foundry Local?, for the platform FAQ, the no-subscription statement, and Microsoft's routing of enterprise-scale inference to Azure Local: <https://learn.microsoft.com/azure/foundry-local/what-is-foundry-local>
- Run command on Azure Arc-enabled servers (preview), for the agent version floor, the RBAC split, protected parameters, Instance View fields, the 4 KB cap, SAS requirements, the managed-identity blob gap, `RunAsUser`, and preview status: <https://learn.microsoft.com/azure/azure-arc/servers/run-command>
- SSH access to Azure Arc-enabled servers, for the `Microsoft.HybridConnectivity` registration prerequisite: <https://learn.microsoft.com/azure/azure-arc/servers/ssh-arc-overview>
- Model catalog and sourcing in Foundry Local, for CPU variant sizing and execution providers: <https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog>

The build-environment constraints in Context forces 6 and 7 and in decision 9 come from the operator's private platform standards, consulted 2026-07-25 via the governance MCP that governs this repo. The specific build hosts, addresses, resource groups, and vault secret names are deliberately not reproduced in this public record; only the rule and its rationale are.

Platform VM measurements cited in Context force 5 were taken read-only on 2026-07-25. No software was installed.

Related records: `ADR-0011` (multi-target deployment automation, whose track 2 decision 2 this supersedes on the install command and whose three-track governance table this amends), `ADR-0005` (governing identity ADR, amended with the scoped exception in decision 4), `SPIKE-08` (the original on-device assessment, whose GPU coupling decision 7 undoes), `ADR-0014` and `SPIKE-19` (the track 3 counterparts).
