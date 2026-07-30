# Model selection

How a model gets into this project, how it gets rejected, and why the catalog
you are reading is shorter than the list of models you could deploy.

This page is the single home for the model-selection methodology. The
[seven-stage process](./methodology) covers how any capability moves from
research to deployment; this page covers the narrower question of how a *model*
is chosen. The per-modality decisions it produces live in
[ADR-0002](../adr/ADR-0002-image-model-and-access) for image models and
[ADR-0003](../adr/ADR-0003-voice-model-and-voice-set) for voice, which remain
the authoritative records.

## Chosen versus available

This is the distinction that causes the most confusion, so it comes first.

This repository publishes **two different kinds of model list**, and mistaking
one for the other will mislead you:

| | What it answers | Where it lives | How complete |
|---|---|---|---|
| **The catalog** | What has *this project* chosen, considered, or rejected, and why? | [Model catalog](../reference/model-catalog) | Curated. Roughly 38 rows. |
| **The availability references** | What *can* be deployed on a given target? | [Azure AI Foundry](../reference/model-availability-azure-cloud), [Foundry Local and Azure Local Foundry](../reference/model-catalog-foundry-local) | As complete as the target allows |

**The catalog is a shortlist, not a menu.** It records the decisions one
methodology reached for one workload. It began as the model set this project
originally needed, and it has grown by evaluation since. A model absent from it
is not unavailable; it is unevaluated, or it was evaluated and rejected, in
which case there is a row saying so.

That matters for a reader adopting this methodology rather than this project:
**you should expect your catalog to differ from this one.** The methodology
transfers. The roster does not.

The availability references are the other half, and they are not symmetrical
across the three targets, for a reason worth stating plainly:

- **Foundry Local and Azure Local Foundry** have bounded, enumerable catalogs, so
  those are listed **in full**.
- **Azure AI Foundry** does not. Its catalog is large and changes continuously,
  and a hand-maintained copy would be stale within days. That page gives you the
  command to ask your own subscription, plus a dated snapshot for scale.

## Status vocabulary

Every catalog row carries one of four statuses. The registry
(`models/registry.schema.json`) uses a deliberately narrower enum, and the
mapping is fixed:

| Status | Meaning | Registry mapping |
|---|---|---|
| `deployed` | Live on a Foundry resource and callable. | `status: deployed` |
| `available` | In the catalog and deployable in-region with no blocker, but not adopted. A candidate held for a future comparison or backfill. | `status: planned` |
| `evaluated` | Researched against this methodology and passed over for the current workload. Not a hard reject: region, an access gate, or style bias made it wrong *for now*. Revisit if the constraint changes. | `status: planned` or omitted |
| `rejected` | Ruled out, and kept on the record so the decision is not re-researched later. | `status: rejected` |

**Never delete a `rejected` row.** The entire point of recording a rejection is
that the next person does not re-litigate it. A catalog with only the winners in
it has thrown away most of its value.

The catalog splits the middle of the registry enum into `available` and
`evaluated` because the difference matters to a human ("nothing is stopping us"
versus "we looked and said not yet") and does not matter to a deployment.

## How a model enters the catalog

**Adding a model is a catalog row plus a registry entry, not a new ADR.**

This is deliberate, and it is the rule that keeps the decision record from
drowning. The selection methodology lives in one place per modality. Each new
candidate is evaluated against that existing methodology and the outcome is
recorded as a catalog row. No new decision was made, so no new ADR is written.

A model earns its own ADR **only** when adopting it changes something the
methodology cannot already express. In practice that means:

- it requires a new region,
- it requires a new Azure resource or a new resource kind,
- it changes the access-governance posture (a gated model, a new approval path),
- or it changes a cost control.

The worked example is FLUX. It was originally captured as its own record,
ADR-0010, and that turned out to be the wrong shape: it was a model choice, not a
new decision. It has since been folded back into the general image-selection ADR
plus catalog rows, and ADR-0010 is marked superseded. A future image model does
not need an ADR to be added.

## What an evaluation has to produce

A model does not get a status until someone can answer these. Anything
unverifiable is marked `UNKNOWN` rather than guessed, which is the same standard
the [research spikes](../research/) hold themselves to.

1. **Which target can run it.** The three rosters are close to disjoint. Nothing
   in the cloud catalog runs on either on-premises target, and vice versa.
2. **Region and availability**, for the cloud target, confirmed against the
   subscription rather than the marketing page.
3. **What it costs**, and against which billing unit. Per token and per image
   are different shapes, and the two on-premises targets have no metered call at
   all.
4. **What governs it.** Content filtering, RBAC, and key handling are not
   uniform across targets. On the cloud target a default content-safety policy
   applies per deployment ([ADR-0007](../adr/ADR-0007-content-safety-and-responsible-ai));
   **neither on-premises target documents any content filter at all**, which is
   a governance loss a reader moving a workload off the cloud must know about.
5. **Why it beats the incumbent**, or why it does not. "Newer" is not a reason.
   A row that cannot say what it improves gets `evaluated`, not `available`.
6. **A first-party source** for every factual claim.

## Where each piece lives

| Question | Page |
|---|---|
| How is a model chosen? | This page |
| What did this project choose? | [Model catalog](../reference/model-catalog) |
| What can I deploy on the cloud? | [Available models: Azure AI Foundry](../reference/model-availability-azure-cloud) |
| What can I deploy on premises? | [Available models: Foundry Local and Azure Local Foundry](../reference/model-catalog-foundry-local) |
| How do image models get chosen specifically? | [ADR-0002](../adr/ADR-0002-image-model-and-access) |
| How do voice models get chosen specifically? | [ADR-0003](../adr/ADR-0003-voice-model-and-voice-set) |
| How does a model become deployed infrastructure? | [Model registry](./model-registry) |
| How does the whole process work? | [Methodology](./methodology) |
