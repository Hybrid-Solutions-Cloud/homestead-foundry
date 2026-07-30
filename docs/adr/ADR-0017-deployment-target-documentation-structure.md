# ADR-0017: Deployment-target documentation and repository structure

- Status: Accepted (owner approved 2026-07-30)
- Date: 2026-07-30

This ADR decides how this repository presents its three deployment targets in
documentation and on disk. It authorizes **no deployment and no spend**. It is a
structural decision only: where per-target content lives, what moves, what does
not, and what mechanism keeps the result from going stale.

The three targets are the tracks ADR-0011 named:

| Track | Slug | Product |
|---|---|---|
| 1 | `azure-cloud` | Azure AI Foundry (AIServices) in Azure |
| 2 | `windows-server` | Foundry Local on Windows Server, Arc-enabled |
| 3 | `azure-local` | Foundry Local on Azure Local, Arc-connected AKS Arc |

## Context

Every published page in this repository documents track 1, and no page says so.
The site's Guide, Architecture, Models, and Implementation sections read as
universal and are cloud-only in fact. An audit on 2026-07-30 found:

- **Tracks 2 and 3 exist only as research and decisions.** Four spikes (SPIKE-08,
  SPIKE-09, SPIKE-18, SPIKE-19) and four ADRs (ADR-0009, ADR-0011, ADR-0013,
  ADR-0014). No architecture doc, no model list, no feature list, no deployment
  guide, no operations guide, and no automation for either.
- **`infra/` is entirely track 1.** No Arc, no `Microsoft.HybridCompute`, no
  `runCommands`, no `Microsoft.Kubernetes`, no AKS Arc.
- **The model story is materially different per track and is documented nowhere a
  reader will find it.** `docs/reference/model-catalog.md` carries 48 rows of
  hosted Azure catalog models. Tracks 2 and 3 run a disjoint open-weight roster
  with no image generation and no text to speech, a fact recorded only inside
  SPIKE-08 question 2 and SPIKE-09 question 2.
- **The one three-way comparison in the repository is stale in place.** ADR-0011's
  "three tracks at a glance" table compares automation form, IaC surface,
  governance plane, and gate, and nothing about models, features, cost, or
  consumption. ADR-0013 decision 10 and ADR-0014 decision 1 amend it in prose and
  never edit it, so a reader landing on the table gets the pre-amendment picture.
- **Four ADRs are unreachable by navigation.** `docs/.vitepress/config.ts` stops
  the ADR sidebar at ADR-0012, so ADR-0013 and ADR-0014, the two records that
  define the current state of tracks 2 and 3, cannot be reached from the sidebar.
- **Published counts are wrong.** `docs/index.md` asserts seventeen spikes and
  twelve ADRs; `docs/roadmap.md` asserts nineteen and fourteen. There are 21 and 16.

The forces this decision has to reconcile:

- **Track 1 content is proven, deployed, tested, and heavily cross-referenced.**
  24 files outside `node_modules` reference `docs/design/`, `docs/guide/`, or
  `docs/implementation/` paths as strings, including four agent definitions under
  `.claude/agents/`, `AGENTS.md`, `REPO_INTENT.md`, `CHANGELOG.md`, the
  `infra/main.bicep` header comment, `infra/README.md`, and
  `scripts/check-docs-currency.mjs`, which hardcodes doc paths for its checks.
- **The site hides link breakage.** `docs/.vitepress/config.ts` sets
  `ignoreDeadLinks: true`, so a restructure can break internal links and still
  produce a green build. That turns any mechanical move into an unbounded audit.
- **The site is live.** `cleanUrls: true` plus a deployed GitHub Pages site means
  every current URL, `/design/architecture-overview` among them, is externally
  linkable today.
- **Symmetry has real value to a reader.** A comparison across three targets is
  only readable if the three columns land somewhere, and "read the spikes" is not
  an answer for a methodology repository whose whole claim is that it documents
  the thing properly.

## Decision

### 1. Add a `docs/targets/` tree; do not move track 1 content

Per-target content gets a new top-level documentation section. Existing track 1
pages stay exactly where they are.

```
docs/targets/
  index.md            the comparison hub
  choosing.md         long-form "when to choose which"
  azure-cloud/        9 thin pages: scope statement plus a link map
  windows-server/     9 pages, new content
  azure-local/        9 pages, new content
```

Nine filenames per target, identical across all three so the hub's columns line
up: `index`, `architecture`, `models`, `features`, `deployment`, `consumption`,
`cost`, `security`, `operations`.

Moving track 1 into a `docs/targets/azure-cloud/` subtree was considered and
rejected. It buys symmetry and nothing else, at the cost of 24 string references
across agent definitions, scripts, Bicep headers, and prose, plus every live URL,
with `ignoreDeadLinks: true` guaranteeing that whatever is missed fails silently.
Filename prefixing inside the existing flat directories was also rejected: three
targets across eight topics is 24 new pages in four already-crowded directories,
it cannot produce a per-target sidebar without brittle prefix matching, and it
gives the hub no natural home.

### 2. `azure-cloud/*` pages are thin by rule, never duplicates

Each of the nine `docs/targets/azure-cloud/` pages is a scope statement, a short
orientation, and a link table into the canonical track 1 document. They exist so
the hub has three symmetric columns to point at. They must never restate
canonical content, because two copies of a fact is exactly the drift this
repository already builds tooling to prevent.

### 3. Existing track 1 pages carry an explicit scope banner

One shared VitePress `::: info` block at the top of the 10 pages under
`docs/design/`, the 5 under `docs/implementation/`,
`docs/reference/model-catalog.md`, and `docs/guide/deployment.md`. It states that
the page's scope is the Azure cloud target, track 1 of ADR-0011, and links to the
deployment-targets hub. A page that silently describes one of three targets is a
defect, not a formatting preference.

### 4. The reader sees "targets"; the record keeps "track N"

URLs and navigation use `targets` and the three slugs. ADR-0011's track numbering
stays the internal identifier so every decision remains traceable. The hub
reconciles the two vocabularies in exactly one mapping table, the one at the top
of this ADR. No other page invents a third name.

### 5. Two model catalogs, not one and not three

`docs/reference/model-catalog.md` stays at its URL, gains the scope banner, and
is retitled to name the Azure cloud catalog explicitly. A second catalog,
`docs/reference/model-catalog-foundry-local.md`, carries the Foundry Local
roster with per-track columns:

`Model | Provider | Variant and execution provider | Track 2 (Windows Server) | Track 3 (Azure Local) | Size and RAM | License | Status | Source`

A `Track` column on the single existing catalog was rejected because the rosters
are disjoint. SPIKE-08 and SPIKE-09 both record zero overlap, so the column would
read `1 / no / no` on every current row and `no / 2,3 / 2,3` on every new one.
That is two tables wearing one hat, and it would break the existing per-modality
section structure.

Three catalogs was also rejected. Tracks 2 and 3 draw from the same Foundry Local
catalog and differ in execution provider and deployment mechanics, not in model
identity. This premise is explicitly a finding to confirm in SPIKE-22 before the
second catalog is authored; if SPIKE-22 finds the device SDK and the Azure Local
operator catalogs materially diverge, the split becomes three at that point and
this decision is amended, not worked around.

`docs/reference/index.md` is added as a reference hub, with a `/reference/`
sidebar group.

### 6. `infra/` gains two sibling subtrees; the cloud stack stays at the root

```
infra/
  main.bicep, types.bicep, modules/, params/, observability/   track 1, unmoved
  README.md                                                    gains a track table
  windows-server/                                              track 2
  azure-local/                                                 track 3
```

`infra/azure-local/` mirrors ADR-0014 decision 1's three-layer table one to one
(`prereq/`, `platform/`, `intent/`, plus the ordering wrapper ADR-0014 calls a
first-class deliverable), so a reader who has read the ADR can navigate the tree
without a map.

`infra/tracks/{1,2,3}/` and `infra/{cloud,windows-server,azure-local}/` were both
rejected: each forces the track 1 move that decision 1 rejects, and buys nothing
a table at the top of `infra/README.md` does not buy. A top-level `automation/`
directory was rejected because track 3 is genuinely part Bicep and belongs under
`infra/` regardless, and because `scripts/` is already the home for repository
tooling and should stay that.

Per the HCS scope rules, every script in these two subtrees is PowerShell 7 or
later with `#Requires -Version 7.0`, `Set-StrictMode -Version Latest`, and
`$ErrorActionPreference = 'Stop'`.

### 7. The registry stays one schema with an optional target discriminator

ADR-0014 decision 6 already directs that track 3 manifests be generated from the
same registry that drives track 1. This ADR confirms the structural half of that:
one schema, one shape, a per-target roster file. The schema change itself, the
field names, and the conditional-requirement rules are a published consumer
contract and get their own record, ADR-0018, gated on SPIKE-22.

Two constraints are recorded here because they bind any implementation:
`models/registry.schema.json` sets `"additionalProperties": false`, so no field
can be added without a schema edit; and `infra/types.bicep` declares a closed
`registryEntry` type that `infra/main.bicep` loads via `loadJsonContent`, so the
schema and the Bicep type must change in the same commit or the build breaks.

### 8. The hub's cells are sourced or explicitly unknown

Every cell in every comparison table on `docs/targets/index.md` carries a fact
with a first-party source link, or reads `UNKNOWN (SPIKE-nn)`. No blank cells and
no hedged prose. This is the same discipline every spike in this repository
already follows, and it is what stops the hub becoming the next stale artifact,
which is precisely what happened to ADR-0011's table.

### 9. The staleness that motivated this ADR is fixed by tooling, not by a pass

`scripts/check-docs-currency.mjs` exists because, in its own words,
"documentation goes stale quietly ... Nothing caught any of it, because nothing
was looking." Two checks are added in the same spirit, before the new content is
authored rather than after:

- **Counts.** Count `docs/research/SPIKE-*.md` and `docs/adr/ADR-*.md` on disk and
  fail if `docs/index.md` or `docs/roadmap.md` asserts a different number. This is
  the exact defect found in both files today.
- **Reachability.** Fail if any spike or ADR file is missing from the
  `docs/.vitepress/config.ts` sidebar, or from `docs/adr/index.md` or
  `docs/research/index.md`. This is the exact defect that left ADR-0013 through
  ADR-0016 unreachable, and it would otherwise recur once per document across the
  research program this restructure opens.

Doing this first is the point. Ten spikes and eight ADRs are queued behind this
ADR, and an unchecked index is a defect per document rather than one defect.

### 10. ADR-0011's table is annotated, not rewritten

An ADR is a historical record. The "three tracks at a glance" table keeps its
cells and gains an amendments block immediately above it, naming each superseding
decision, in the same style ADR-0010 is marked superseded. Silently correcting a
decided record would destroy the traceability the whole ADR practice exists for.

### 11. `ignoreDeadLinks` is a known hazard and is triaged once

The restructure is run at least once with `ignoreDeadLinks` disabled and the
resulting failures triaged, rather than trusting a green build. Narrowing the
setting to an explicit allowlist is the preferred end state.

## Consequences

- A reader can answer "what runs where, with which models, at what cost, under
  what governance, and how do I deploy it" for all three targets from one hub,
  which is not possible today at any price.
- Track 1's proven, deployed, tested content is untouched, so nothing that
  currently works can regress as a side effect of a documentation change. Its
  URLs stay valid.
- The repository carries a documented asymmetry for a while: track 1 pages are
  as-built records, tracks 2 and 3 pages are researched designs with no
  deployment behind them. The scope banner and the hub's status row make that
  explicit rather than letting a reader assume parity.
- 27 new pages plus two hub pages is real authoring work, and the thin
  `azure-cloud/*` pages add nine files that carry no new facts. That is the price
  of a readable three-way comparison and it is accepted deliberately.
- The two new currency checks will fail the moment a spike or ADR lands without
  an index and sidebar entry. That is the intent. It makes the index update part
  of authoring rather than a later sweep.
- `docs/targets/` becomes the natural home for future targets. Nothing in this
  structure assumes there will only ever be three.

## Alternatives considered

- **Move track 1 into a symmetric subtree.** Rejected in decision 1. Highest
  symmetry, highest breakage, and the breakage is silent.
- **Add per-track sections inside each existing document.** Rejected in decision
  1. Mixes built with unbuilt content inside pages that are currently as-built
  records, and produces no comparison hub.
- **Write the comparison hub only and defer the per-target page sets.** Rejected
  by the owner on 2026-07-30, who directed the full program: research, decisions,
  architecture, models, features, then implementation and operations guides, then
  automation scaffolding.
- **Defer everything until tracks 2 and 3 are actually deployed.** Rejected. The
  gate sequence in this repository is spike, ADR, design, gated deploy. Design
  precedes deployment by design, and both tracks are stalled at the ADR step
  precisely because nothing carried them forward.

## Sources

- `docs/adr/ADR-0011-multi-target-deployment-automation.md`, the three-track
  charter and the table this ADR annotates.
- `docs/adr/ADR-0013-foundry-local-windows-server-install.md` decision 10, which
  states that ADR-0011's three-track table is amended by it.
- `docs/adr/ADR-0014-foundry-local-azure-local-deployment-layers.md` decisions 1
  and 6, the three-layer model and the shared-registry direction.
- `docs/research/SPIKE-08-foundry-local-on-device.md` question 2 and
  `docs/research/SPIKE-09-azure-local-foundry.md` question 2, the disjoint-roster
  finding behind the two-catalog split.
- `scripts/check-docs-currency.mjs`, whose header states the failure mode this
  ADR's decision 9 extends.
- HCS scope rules via the governance MCP: PowerShell 7 or later for all scripts,
  Markdown only for documentation, draw.io for diagrams.
