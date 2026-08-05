---
pageClass: matrix-page
aside: false
---

# Model availability matrix

Every model, every region, side by side. **233 models across 42 regions**, where
the two on-premises targets are treated as regions because that is how an
operator meets them: a place a model either runs or does not.

Filter it, search it, sort it. Click any row for that model's per-region detail:
which deployment types it offers where, the capacity ceiling each one carries,
its versions, and its retirement date.

::: tip How to read the colours
A coloured cell means the model is offered in that region. **The colour is the
configuration profile**, so a row painted one colour is identical everywhere it
exists, and a row painted many colours differs by region. A faint dot means
**not available**. Sort by `Profiles` to bring the most region-variable models to
the top.
:::

::: tip Column order, and going full screen
Columns run **Foundry Local and Azure Local Foundry first, then the US regions,
then everything else alphabetically.** A brand-coloured rule marks where the
international block begins. Forty-two columns do not fit a documentation page, so
use **Full screen** to work the table against the whole window; `Esc` closes it.
:::

<ModelMatrix />

## What the matrix shows, in one paragraph

Region changes what you can **buy**, not what the model **is**. Across 3,103
model-and-region pairs, no model's context window or maximum output token count
differed between regions. What differs constantly is the set of deployment types:
56 of 134 cloud models present a different purchasing shape depending on where
you deploy, and `gpt-4.1-mini` has seventeen distinct configurations across the 34
regions carrying it. The research behind every number is
[SPIKE-32](../research/SPIKE-32-model-region-availability-matrix).

## Where do I still have capacity?

The matrix carries **real subscription quota**, not just the catalog's product
maximum, because the product maximum is the same everywhere and answers nothing.
Set **Colour by remaining quota** and the whole grid turns into a headroom map:
green where capacity is left, red where every deployment type is at its limit,
grey where there is no reading.

- The **Free in** column counts the regions with unused quota. Sort on it.
- **No free capacity anywhere** filters to the models that are genuinely stuck.
- Expanding a row lists every region and deployment type with **used, limit and
  free**, and names where the most headroom is.

::: danger Two numbers, a thousandfold apart. Do not confuse them
The catalog publishes `capacity.maximum` per deployment type, which is the
largest value **the deployment type will accept**. It is not what your
subscription may allocate, and the expanded row labels it accordingly.

Measured in East US on 2026-08-05: `DeepSeek-V4-Pro` publishes a catalog maximum
of **1,000,000** on `GlobalStandard`, against a subscription quota of **1,000**,
of which **1,000 was already consumed**. The deployment was throttled at 100% of
its real ceiling while the catalog advertised a figure a thousand times larger.
:::

::: warning GlobalStandard quota is one subscription-wide pool, so changing region will not help
This is the single most useful thing measured here, and it is not obvious.

On a subscription with **exactly one account, in East US**, `DeepSeek-V4-Pro`
reported **1,000 of 1,000 consumed in all 33 regions that offer it.** There are no
deployments in the other 32. `GlobalStandard` quota is therefore a **single
subscription-wide allocation**, reported identically everywhere, not a per-region
grant. Redeploying the same model in another region gains nothing.

**A different deployment type carries a separate allocation.** The same model held
**0 of 1,000 on `DataZoneStandard`** in nine US regions, entirely unused.
`DeepSeek-V4-Flash` showed the same shape: 250 of 250 consumed on `GlobalStandard`
everywhere, against 0 of 250 free on `DataZoneStandard` in sixteen regions.

So when a model is throttled, **change deployment type before you change region,
and before you ask Microsoft for an increase.**
:::

## Five things worth knowing before you pick a region

**North Europe carries 28 models. Sweden Central carries 132.** Both are
first-tier Azure regions. Foundry catalog breadth does not follow general Azure
region tiering, so a region chosen on general grounds needs checking against this
matrix specifically.

**Being listed in a region is not the same as being deployable there on your
terms.** Sixty-four model-and-region pairs offer **no pay-as-you-go capacity at
all** - only provisioned or batch, which needs a reservation. Filter on *Only
models with a provisioned-only region* to see them.

**Data residency shrinks the list sharply.** `GlobalStandard` routes globally.
The deployment type that keeps processing in-region is plain `Standard`, and only
14 models offer it anywhere. Filter the deployment type to `Standard` to see the
real set.

**Four models run on all three targets**: `Phi-4`, `Phi-4-mini-instruct`,
`Phi-4-mini-reasoning`, and `gpt-oss-20b`. If portability across cloud, cluster,
and device matters, that is the whole option set. Filter target to *Cloud and
on-premises*.

**82 of 134 cloud models retire within twelve months**, and only 6 name a
replacement. Retirement, not availability, is the dominant lifecycle risk.

## What this page is not

It is **not** a substitute for asking your own subscription. Model availability
is gated by subscription, registration, and in some cases an approval your tenant
may or may not hold. **Everything here was read from one subscription on
2026-08-05.** Another tenant querying the same region can get a different answer.

```bash
az cognitiveservices model list --location <region> -o table
```

That command is the authority. This page is a dated, generated snapshot of what
it returned, published because a comparison across 40 regions is not something
anyone will assemble by hand at the moment they need it.

Note also that **only 9 of 134 cloud models publish a context window** through the
catalog API. Where the matrix reads `not published` for context or maximum
output, the value is genuinely absent from the catalog, not zero. Those are
different claims and the page keeps them apart rather than filling the gap with a
number that looks authoritative.

## Regenerating it

The dataset is generated, not maintained. Three scripts in
[`scripts/model-matrix/`](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/tree/main/scripts/model-matrix),
and nothing needs more than Reader:

```powershell
./scripts/model-matrix/pull-regions.ps1 -Out ./.cache/models
./scripts/model-matrix/pull-quota.ps1   -Out ./.cache/quota
node ./scripts/model-matrix/make-onprem.mjs ./.cache/onprem.json
node ./scripts/model-matrix/build-matrix.mjs ./.cache/models ./.cache/onprem.json ./docs/public/data/model-matrix.json <today> ./.cache/quota
```

The quota argument is optional. Leave it off and the matrix still renders
availability and configuration; the quota column, the colour-by-quota mode and
the per-region headroom tables simply do not appear. **Run it against your own
subscription and the quota shown becomes yours**, which is the only way those
numbers mean anything.

The cloud half is a live read. The on-premises half is still a transcription of
the [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog) catalog snapshot
dated 2026-07-28, so it carries that date's accuracy, not today's.

## See also

- [SPIKE-32](../research/SPIKE-32-model-region-availability-matrix), the research and every finding in full.
- [Available models: Azure AI Foundry](./model-availability-azure-cloud), the cloud target in prose.
- [Available models: Foundry Local](./model-availability-foundry-local), the device roster with what each family is for.
- [Available models: Azure Local Foundry](./model-availability-azure-local-foundry), the cluster roster including the vLLM entries.
- [Model catalog](./model-catalog), what this project chose and why, which is a different question.
- [Model behaviour and limits](../guide/model-behaviour-and-limits), what changes once you host a model yourself.
