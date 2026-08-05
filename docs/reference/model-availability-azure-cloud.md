# Available models: Azure AI Foundry

::: info Scope: Azure AI Foundry
This page describes the **Azure AI Foundry** target, the hosted-cloud target of
[ADR-0011](../adr/ADR-0011-multi-target-deployment-automation). Foundry Local and
Azure Local Foundry differ from it in models, features, identity, cost, and
operations. Compare all three on [Deployment targets](../targets/).
:::

This page answers "what **can** I deploy on Azure AI Foundry." It is the
companion to the [model catalog](./model-catalog), which answers the different
question "what has **this project** chosen, and why." If you are unsure which
one you want, read [chosen versus available](../guide/model-selection#chosen-versus-available)
first.

## This page does not list every model, on purpose

Azure's model catalog is large and it changes continuously. A hand-maintained
copy of it in a repository would be wrong within days, and this repository
treats a published page that asserts something no longer true as a defect rather
than as bookkeeping (see [methodology](../guide/methodology#keeping-documentation-honest)).
Copying the catalog here would manufacture exactly that defect.

So this page gives you three things instead: the command that answers the
question for **your** subscription and region, a dated snapshot for scale, and a
pointer to Microsoft's own catalog, which is always the authority.

The two on-premises targets are different, and they get full lists, because
their catalogs are bounded and enumerable. See
[Available models: Foundry Local and Azure Local Foundry](./model-catalog-foundry-local).

::: tip There is now a generated comparison, and it does not contradict this
The reasoning above is about a **hand-maintained** copy, which would be wrong
within days. The [model availability matrix](./model-matrix) is **generated** from
a live read of every region and carries the command that regenerates it, so it
fails differently: it goes out of date visibly, on a stated snapshot date, rather
than quietly. Use it to compare regions; use the commands below to answer for
your own subscription today.
:::

## Ask your own subscription

Two questions, two commands. Both are read-only.

**What can be deployed in a region?** This is the one to run when you are
choosing a region or checking whether a model has reached you yet.

```bash
az cognitiveservices model list --location eastus -o table
```

Narrow it to a publisher, since the full result is long:

```bash
az cognitiveservices model list --location eastus \
  --query "[?model.format=='Microsoft'].{name:model.name, version:model.version, kind:kind}" \
  -o table
```

**What can this account deploy?** Run this against a Foundry account you already
have. It reflects that account's kind, region, and enabled features, so it is
narrower and more accurate than the region query.

```bash
az cognitiveservices account list-models \
  --name <your-foundry-account> \
  --resource-group <your-resource-group> \
  -o table
```

Both commands need only reader access. Neither creates or changes anything.

## Snapshot: East US, retrieved 2026-07-30

A point-in-time count, recorded for scale rather than as a list to rely on. It
was produced by the first command above, in the region this repository deployed
into. **Re-run the command rather than trusting these numbers.**

`az cognitiveservices model list --location eastus` returned **258 entries**
across **12 publishers**:

| Publisher (`model.format`) | Entries |
|---|---|
| OpenAI | 92 |
| Meta | 38 |
| Microsoft | 30 |
| Mistral AI | 20 |
| xAI | 18 |
| Cohere | 18 |
| DeepSeek | 16 |
| Anthropic | 8 |
| MoonshotAI | 6 |
| Black Forest Labs | 6 |
| OpenAI-OSS | 4 |
| Alibaba | 2 |

By account kind: 129 `AIServices`, 78 `MaaS`, 46 `OpenAI`, 5 `MAI`.

An entry is a model *version*, not a distinct model, so the count of distinct
model names is lower. One model with four published versions is four entries.

Set against that, [this project's catalog](./model-catalog) records roughly
**38 rows**, of which 9 are deployed. That gap is the point of this page: the
catalog is a curated shortlist reflecting one methodology's decisions, not a
menu of what Azure offers.

## Microsoft's catalog is the authority

- [Explore the model catalog in Azure AI Foundry portal](https://learn.microsoft.com/azure/ai-foundry/how-to/model-catalog-overview)
- [Model availability by region](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/models)
- [`az cognitiveservices model list`](https://learn.microsoft.com/cli/azure/cognitiveservices/model)
- [`az cognitiveservices account list-models`](https://learn.microsoft.com/cli/azure/cognitiveservices/account)

## Keeping this current

The snapshot above is hand-run and dated, which makes it the weakest content on
this page. Generating it from a live subscription, and generating the same for
the two local targets, is tracked as a feature request rather than left as a
recurring manual chore: see
[issue #15, auto-refresh the model availability catalogs](https://github.com/Hybrid-Solutions-Cloud/homestead-foundry/issues/15).

## See also

- [Model availability matrix](./model-matrix), the generated per-region comparison, including which regions offer no pay-as-you-go capacity.
- [Model catalog](./model-catalog), what this project chose and why.
- [Model selection](../guide/model-selection), the methodology behind the choosing.
- [Available models: Foundry Local and Azure Local Foundry](./model-catalog-foundry-local), the two bounded on-premises catalogs.
- [Deployment targets: models and modalities](../targets/#_2-models-and-modalities), the three-way comparison.
