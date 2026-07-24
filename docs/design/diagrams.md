# Homestead Foundry diagrams (Lucid)

The living diagrams are authored and maintained in Lucid, in the folder
**Microsoft AI Foundry** (folder id `445735630`, under My Documents). This file
is the repo index; it links to each diagram and says what it shows. Update the
Lucid document to change a diagram, then keep this table in step.

- Source of truth: the seven design docs in `docs/design/` (architecture-overview,
  resource-topology-and-caf-naming, identity-and-security, cost-and-governance,
  reliability-and-operations, performance-efficiency, pipeline-integration-design),
  grounded in the ADRs in `docs/adr/`.
- Conventions: rectangle = service or actor, cylinder = storage, diamond = decision.
  Every connector is labelled with what flows across it. Consistent colour legend:
  blue = external brand or actor, purple = pipeline tool, orange = Azure account or
  service, yellow = model or decision, green = safety control or consumer, steel =
  storage, red = cost stop or hard block.
- Names are canonical throughout: `rg-<workload>-<env>-<region>-01`, `aif-<workload>-<env>-<region>-01`,
  deployment `mai-image-25`, `budget-<workload>-<env>-<region>-01`, reused platform Key Vault.
  No secrets, subscription IDs, or tenant GUIDs appear in any diagram.
- QA: every diagram was exported to PNG and visually checked. No text runs into other
  text and no box covers another box. See the QA note at the foot of this file.

## Diagrams

Links below are view-only Lucid document links with no invitation token embedded.
If a link returns "request access," ask the owner to share it directly rather than
re-adding a token to this file (see Access, below).

| # | Diagram | What it shows | Lucid |
| --- | --- | --- | --- |
| 1 | Solution context | Both brands and the prompt library through the publish pipeline to the shared AIServices account and its two models, out to R2 and the marketing origin, consumed by the reader apps and marketing sites. | [Open in Lucid](https://lucid.app/lucidchart/2abf4f78-7c18-43d0-a400-05114660f781/edit) |
| 2 | Azure resource topology and CAF naming | The tenant, subscription, and resource-group scope chain with canonical CAF names: the `ais` account hosting `mai-image-25`, the Speech surface, and the project; the RG budget and tags; the reused platform Key Vault; the untouched legacy narrator Speech account. | [Open in Lucid](https://lucid.app/lucidchart/fd59f748-549d-49d1-834e-419d0b071726/edit) |
| 3 | Identity and auth flow | The keyless Entra path for the image REST calls versus the vault-sourced key path for Speech, plus the least-privilege RBAC roles on the account scope. | [Open in Lucid](https://lucid.app/lucidchart/40472240-cdad-4b1c-b622-87efd9514107/edit) |
| 4 | Image generation sequence | `mai-image.mjs` from prompt read and hygiene through the budget guard, the Entra token, paced generations/edits calls with 429 retry, the PNG, provenance, and the two destinations. | [Open in Lucid](https://lucid.app/lucidchart/b57e348a-9426-4f05-81db-8d9153648ca1/edit) |
| 5 | Voice variant generation sequence | `publish.mjs` plus `tts.mjs` from markdown blocks through the `maiLedger` guard, per-block MAI-Voice-2 synthesis (Ethan via `mstts:express-as`), the ffmpeg stitch, the immutable R2 variant, and the manifest-last upload to the app. | [Open in Lucid](https://lucid.app/lucidchart/5184f172-b6e7-4582-a3d2-bc8ea152fd57/edit) |
| 6 | End-to-end asset pipeline | Publish-time pre-render of both modalities, the additive `audioVariants` manifest, and hotlinked scene art versus content-hashed R2 covers reaching the offline-first reader app. | [Open in Lucid](https://lucid.app/lucidchart/f005e1ca-f428-4c46-b5b7-246bf541b8e8/edit) |
| 7 | Cost and governance flow | The three enforcement layers: the synchronous `maiLedger` hard stop, the notify-only budget backstop, and the spending-limit invoice stop. | [Open in Lucid](https://lucid.app/lucidchart/d68dd85e-b7fb-4c4c-be66-97f9602392ab/edit) |
| 8 | Content-safety and responsible-AI flow | Prompt genericization and hand-drawn framing gates, generation inside default guardrails with content-filter handling, provenance recording, retention minimization, and parent disclosure. | [Open in Lucid](https://lucid.app/lucidchart/e767e2ab-663e-48c3-92d2-e2db8a99d0b6/edit) |
| 9 | Tenant selection and fallback decision | Whether the MVP subscription is viable for East US, else the `azlz` fallback gated on the three read-only pre-checks, with the `eastus2` Allowed-locations policy as a hard block. | [Open in Lucid](https://lucid.app/lucidchart/67b4c590-123c-4dd5-b10f-d089128f9e18/edit) |
| 10 | Deployment runbook | Owner-gated provisioning in dependency order: resource group, `ais` account, `mai-image-25` deployment, roles, Key Vault secret, budget, then verify and hold. | [Open in Lucid](https://lucid.app/lucidchart/6e98d8ae-69e7-4cbf-8e8a-c57ee3bda19e/edit) |
| 11 | Data and state model | The manifest `audioVariants` schema, the brand-state variant and `maiLedger` records, the image ledger, `provenance.json`, and the immutable R2 key layout. | [Open in Lucid](https://lucid.app/lucidchart/de44a0ce-3258-4190-9c02-cf8bb48d2583/edit) |

## Access

Share links are view-only and restricted to the Lucid account. Open them while
signed in as the owner. Change the role or scope in Lucid if wider sharing is needed.
Invitation tokens are deliberately not embedded in this file (Phase B hardening,
2026-07-21) - anyone with an `invitationId` query string could otherwise gain the
access level of that invitation without being the intended recipient.

## QA note

All 11 diagrams were exported and visually verified: no text overlaps other text,
no box covers another box, connectors do not pass through boxes, and every label
sits inside its shape or clear of adjacent shapes. None require a second pass. One
minor cosmetic point on diagram 11 (the ERD): the foreign-key lines from
`ChapterVariantState` and `MaiLedger` to `BrandState` are auto-routed and take a
long path around the lower-right, but they do not cross or cover any entity table.
