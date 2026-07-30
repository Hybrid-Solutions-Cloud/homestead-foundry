# Reference

The living catalogs. These are the pages that change most often, because they
record what is on the table today rather than a decision made once.

## Two different questions

Before you pick a page: this section answers **two** questions, and confusing
them will mislead you.

| Reference | Answers | Covers |
|---|---|---|
| [Model catalog](./model-catalog) | What did **this project** choose? | Every model this methodology has deployed, evaluated, or rejected on the Azure AI Foundry target, with the reasoning behind each row. Curated, roughly 38 rows. |
| [Available models: Azure AI Foundry](./model-availability-azure-cloud) | What **can** I deploy on the cloud? | How to query your own subscription and region, plus a dated snapshot for scale. Not a copied catalog, and the page explains why. |
| [Available models: Foundry Local and Azure Local Foundry](./model-catalog-foundry-local) | What **can** I deploy on premises? | The full roster for both on-premises targets: 170 entries in two diverging halves, from [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog). |

**The catalog is a shortlist, not a menu.** A model absent from it is not
unavailable; it is unevaluated, or it was evaluated and rejected with a row
saying so. The reasoning is in
[chosen versus available](../guide/model-selection#chosen-versus-available).

## Why the lists are split by target

The Azure AI Foundry target and the two on-premises targets run close to disjoint
rosters. Nothing in the cloud catalog runs on Foundry Local: no image generation,
no text to speech, no video, and no proprietary frontier reasoning models. A
single table with a per-target column would read as three noes on every row.

The two on-premises targets share one page, with a column each, per
[ADR-0017](../adr/ADR-0017-deployment-target-documentation-structure) decision 5.
They are **not** the same roster: SPIKE-22 found they diverge in model identity
in both directions, and the two columns are what expresses that.

## Why only the on-premises lists are complete

The on-premises catalogs are bounded and enumerable, so they are listed in full.
Azure's cloud catalog is neither: it is large and changes continuously, so a
hand-maintained copy here would be stale within days and would breach this
repository's own
[documentation currency rule](../guide/methodology#keeping-documentation-honest).
The cloud page gives you the query instead.

Automating the refresh of all of these, from live catalogs rather than by hand,
is tracked as a feature request rather than left as a recurring chore.

## Machine-readable counterpart

The machine-readable counterpart to all of the above is the
[model registry](../guide/model-registry), which a consuming project resolves at
runtime. These pages are the prose record a human reads to understand the why.
