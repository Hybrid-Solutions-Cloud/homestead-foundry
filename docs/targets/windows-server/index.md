# Windows Server (track 2)

::: info Scope
**Foundry Local** running on a single Windows Server that you own, Arc-enabled
for governance of the host. Track 2 of
[ADR-0011](../../adr/ADR-0011-multi-target-deployment-automation). Compare all
three targets on the [Deployment targets hub](../).
:::

::: warning Researched and decided, not deployed
No deployment exists for this target and no automation is written. The pages in
this section are drawn from [SPIKE-08](../../research/SPIKE-08-foundry-local-on-device),
[SPIKE-18](../../research/SPIKE-18-foundry-local-windows-server), and
[ADR-0013](../../adr/ADR-0013-foundry-local-windows-server-install). Treat them
as a design.
:::

One server, one service, one inference endpoint. This is the smallest of the
three targets and the fastest to stand up, and it is the one whose limits are
easiest to misread.

## Read this before choosing it

Arc governs the act of installing and configuring the host. **It does not govern
the running inference service.** That endpoint has no Azure RBAC, no Entra
authentication, no Key Vault path, no budget, and no Azure Monitor.
[ADR-0013](../../adr/ADR-0013-foundry-local-windows-server-install) decision 10
states this in terms and amends ADR-0011's three-track table, which over-stated
it.

That makes this target right for a developer workstation, a single-purpose
appliance, a lab, or a workload whose security boundary is the machine itself. It
makes it wrong for a shared service that several people or systems call. If you
need a governed on-premises endpoint, the target you want is
[Azure Local](../azure-local/).

## What it runs

The Foundry Local catalog only. **No image generation, no text to speech, no
video.** The committed first increment is CPU-only, in the
`Phi-4-mini-instruct-generic-cpu` class at roughly 4.8 GB. Whisper speech to text
is available.

## Section contents

| Topic | Summary |
|---|---|
| [Architecture](./architecture) | Arc-enabled host, four-stage idempotent install, model cache as the unit of state |
| [Models](./models) | Foundry Local catalog, CPU-first, roughly a 5 GB quantized 4B-class ceiling |
| [Features](./features) | OpenAI-compatible local API, `foundry` CLI, SDKs, fully disconnected operation |
| [Deployment](./deployment) | Arc run command, machine-wide MSIX provisioning, not `winget` |
| [Consumption](./consumption) | Local OpenAI-compatible endpoint, unauthenticated |
| [Cost](./cost) | No Azure spend for the runtime; the cost is hardware you already own |
| [Security](./security) | Arc system-assigned managed identity, one scoped exception to ADR-0005 |
| [Operations](./operations) | Idempotent re-run contract, metadata-only observability |

## What stands between this and a real deployment

Two read-only questions, then one owner-authorized install test on a dedicated
disposable Windows Server build VM. That single test closes three open unknowns
at once, including the largest: whether Windows Server is supported at all, as
opposed to the Windows 11 build the quickstart names.
