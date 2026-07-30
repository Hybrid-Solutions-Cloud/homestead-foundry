# Diagram set (Lucid)

::: info Scope: Azure cloud (track 1)
This page describes the **Azure cloud** target, track 1 of
[ADR-0011](../adr/ADR-0011-multi-target-deployment-automation). Foundry Local on
Windows Server and Foundry Local on Azure Local differ from it in models,
features, identity, cost, and operations. Compare all three on
[Deployment targets](../targets/).
:::


This file is the diagram index for the design set: the eleven diagrams that
together visualize the architecture, and what each one is meant to show. It is
written so you can reproduce the same set for your own deployment rather than
depend on someone else's documents.

The reference diagrams are authored and maintained in Lucid. They live in the
maintainer's own Lucid account and are not publicly shareable, so no links are
published here. The table below is the specification: it tells you what to draw.
The `foundry-diagrammer` and `foundry-diagram-qa` agents in
[`AGENTS.md`](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/blob/main/AGENTS.md) author and verify this set automatically through
the Lucid MCP if you want to generate your own.

- Source of truth: the seven design docs in `docs/design/` (architecture-overview,
  resource-topology-and-caf-naming, identity-and-security, cost-and-governance,
  reliability-and-operations, performance-efficiency, pipeline-integration-design),
  grounded in the ADRs in `docs/adr/`.
- Conventions: rectangle = service or actor, cylinder = storage, diamond = decision.
  Every connector is labelled with what flows across it. Consistent colour legend:
  blue = external consumer or actor, purple = pipeline tool, orange = Azure account or
  service, yellow = model or decision, green = safety control or consumer, steel =
  storage, red = cost stop or hard block.
- Names are canonical throughout: `rg-<workload>-<env>-<region>-01`,
  `aif-<workload>-<env>-<region>-01`, `budget-<workload>-<env>-<region>-01`,
  model deployments named from the model registry, and a reused platform Key Vault.
  No secrets, subscription IDs, or tenant GUIDs appear in any diagram.
- QA: every diagram is exported to PNG and visually checked. No text runs into other
  text and no box covers another box. See the QA note at the foot of this file.

## The eleven diagrams

| # | Diagram | What it shows |
| --- | --- | --- |
| 1 | Solution context | The consuming applications and the prompt library, through the publish pipeline, to the shared Foundry account and its model deployments, out to object storage and the web origin, consumed by the downstream apps and sites. |
| 2 | Azure resource topology and CAF naming | The tenant, subscription, and resource-group scope chain with canonical CAF names: the `aif-` Foundry account hosting its model deployments, the Speech surface, and the project; the resource-group budget and tags; the reused platform Key Vault. |
| 3 | Identity and auth flow | The keyless Entra path for the image REST calls versus the vault-sourced key path for Speech, plus the least-privilege RBAC roles on the account scope. |
| 4 | Image generation sequence | The image client from prompt read and hygiene, through the budget guard, the Entra token, paced generate and edit calls with 429 retry, to the returned image, its provenance record, and its destinations. |
| 5 | Voice generation sequence | The publish path and the text-to-speech client, from source text blocks through the spend guard, per-block synthesis with an expressive speaking style, audio stitching, the immutable stored variant, and the manifest-last upload. |
| 6 | End-to-end asset pipeline | Publish-time pre-render of both modalities, the additive audio-variant manifest, and hotlinked art versus content-hashed stored covers reaching an offline-first client. |
| 7 | Cost and governance flow | The three enforcement layers: the synchronous spend-ledger hard stop, the notify-only budget backstop, and the subscription spending-limit invoice stop. |
| 8 | Content-safety and responsible-AI flow | Prompt genericization and style gates, generation inside default guardrails with content-filter handling, provenance recording, retention minimization, and end-user disclosure. |
| 9 | Tenant selection and fallback decision | Whether the primary subscription is viable for the target region, else the fallback subscription gated on three read-only pre-checks, with an Allowed-locations policy as a hard block. |
| 10 | Deployment runbook | Gated provisioning in dependency order: resource group, Foundry account, model deployments, roles, Key Vault secret, budget, then verify and hold. |
| 11 | Data and state model | The audio-variant manifest schema, the per-workload state and spend-ledger records, the image ledger, the provenance record, and the immutable object-storage key layout. |

## Reproducing this set

1. Read the seven design docs and the ADRs they cite.
2. Point `foundry-diagrammer` at them and ask for the eleven diagrams above, in
   your own Lucid folder.
3. Run `foundry-diagram-qa` over the result. It exports every diagram to PNG and
   checks for overlapping boxes, colliding or overflowing text, and connectors
   crossing shapes, then drives fixes until the layout is clean.
4. Keep this table in step with whatever you change.

If you do publish your own diagram links, share view-only links and do not embed
invitation tokens: anyone holding an `invitationId` query string gains that
invitation's access level whether or not they were the intended recipient.

## QA note

All 11 diagrams were exported and visually verified: no text overlaps other text,
no box covers another box, connectors do not pass through boxes, and every label
sits inside its shape or clear of adjacent shapes. None require a second pass. One
minor cosmetic point on diagram 11 (the ERD): two of the foreign-key lines are
auto-routed and take a long path around the lower-right, but they do not cross or
cover any entity table.
