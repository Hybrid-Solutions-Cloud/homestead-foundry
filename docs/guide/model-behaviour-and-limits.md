# Model behaviour and limits: what changes when you host it yourself

A model you deploy is **not the same product** as the vendor's hosted API of the
same name. The weights are the same. Almost nothing else is.

This page is the difference, and every claim on it was **measured against a live
deployment**, not read from documentation. Where something is inferred rather
than observed, it says so.

## First, the three ways people reach a model

Most confusion here comes from comparing things that are not comparable. There
are three distinct arrangements, and only the last one is yours:

| | **A subscription product** | **A vendor API key** | **A deployment you own** |
|---|---|---|---|
| Examples | a chat product, a coding assistant seat | calling a vendor endpoint directly | a model deployed into your own Foundry account |
| **What you buy** | a seat, per person per month | tokens, from the vendor | tokens, through your own cloud account |
| **Who sets the parameters** | **the product does, and you cannot see them** | you do | you do |
| **Who owns the rate limit** | the vendor, pooled and undisclosed | the vendor, per key | **you**, per model, and you can raise it |
| **Content filtering** | the vendor's, fixed | the vendor's, fixed | **yours, and you configure it** |
| **Model version** | changes under you, without notice | changes on the vendor's schedule | **you pin it; it changes when you say** |
| **Retirement** | the vendor decides | the vendor decides | you keep serving until you migrate |
| **Where the data goes** | the vendor's estate | the vendor's estate | **your subscription, your region, your tenant** |
| **What you can see** | almost nothing | request-level errors | **metrics, logs, spend, per deployment** |
| **Features around the model** | **a great deal**, and it is the product | none, you build them | none, you build them |

### The trade, stated plainly

**A subscription gives you the surrounding product.** Agent mode, file context,
tool calling, an editor integration that already works. That is most of the value
and none of it is the model.

**Your own deployment gives you the model and the controls.** Choice of vendor
family, a rate limit you can raise, a content policy you can set, a version that
does not move under you, data that stays in your tenant, and per-request
visibility. It gives you **none** of the product.

**So "I have my own models, why do I still need the assistant" has an answer**:
you are buying two different things. The assistant is the harness. Your
deployment is the engine. Pointing the harness at your engine is what these pages
are about, and it works, but the harness keeps its own opinions about how to
drive, which is the source of most of the failures below.

### What this means in practice

- **Cost stops being fixed.** A seat is predictable per person; a deployment
  bills per token consumed, so an agent left running against a large repository
  can spend more in an hour than a person does in a month of chat.
- **You inherit operations.** Nobody else is watching your quota, your content
  policy, or your spend. The failures on this page are ones a subscription would
  have absorbed silently on your behalf.
- **You gain a real audit trail.** Every call appears in your account's metrics
  and can be attributed. On a subscription, you cannot prove what happened.
- **Multi-vendor becomes possible.** One endpoint, several vendor families,
  swapped per job. No subscription offers that, and it is the strongest argument
  for owning the deployment.

---

## The four axes that change

| | Vendor-hosted API | A deployment you own |
|---|---|---|
| **Throughput** | the vendor's pooled limits, shared with everyone | **your quota, per minute, per model**, and yours to raise |
| **Content safety** | fixed by the vendor | **yours to configure, and the default blocks coding work** |
| **Parameters** | whatever the vendor's docs say | **per model, and not always what the vendor documents** |
| **Identity** | one model id | a **deployment name** you chose, which is not the model id |

Each of these produces a failure with an error message that does not name its own
cause. That is what this page is really for.

---

## 1. Parameters differ per model, not per vendor

**The failure:**

```
Unsupported value: 'temperature' does not support 0.1 with this model.
Only the default (1) value is supported.
```

**Reasoning models reject a custom temperature.** They do internal chain-of-thought
that depends on sampling at their trained temperature, so the provider rejects any
other value outright rather than degrading quietly.

Measured across one account's 14 chat deployments, 2026-08-04:

| Result | Deployments |
|---|---|
| **Rejects a custom temperature** | the three `gpt-5-6-*` reasoning deployments |
| **Accepts `temperature: 0.1`** | all five Grok variants, DeepSeek Flash, Kimi, Llama, Mistral |

**This is not a vendor split.** Grok's reasoning variants accepted it; the OpenAI
reasoning models did not. **You cannot infer it from the family name.** Test it:

```powershell
$b = @{ model='<deployment-name>'; temperature=0.1; messages=@(@{role='user';content='hi'}) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "$base/chat/completions" -Headers @{Authorization="Bearer $key"} -ContentType 'application/json' -Body $b
```

A 400 naming `temperature` means that deployment is reasoning-only.

### The client makes this worse

A model can work perfectly over `curl` and be **unusable through an editor**,
because the client hardcodes parameters you cannot reach. GitHub Copilot Chat
sends `temperature: 0.1` and its custom-endpoint configuration has **no field to
change it** - seven properties, none for temperature.

::: warning Correction: switching to the Responses API is not the fix
An earlier version of this page said the Responses API "does not take temperature
the same way" and that reasoning models work through it. **That is wrong, and it
was published.** Measured against a live deployment, `gpt-5-6-sol` returns the
identical 400 on both surfaces:

| Request | `/chat/completions` | `/responses` |
|---|---|---|
| no temperature | 200 | 200 |
| `temperature: 1` | 200 | 200 |
| **`temperature: 0.1`** | **400** | **400** |

The restriction belongs to the **model**, not the endpoint. Routing reasoning
models through `apiType: "responses"` does help in practice, but only because
that client path happens not to send temperature. That is **the client's
behaviour, not a property of the API**, so it can change on any extension update
and it fixes nothing for any other tool.
:::

**There is no fix on the Azure side, and this is worth being precise about.** A
deployment has no setting that permits or forbids a temperature, so redeploying
the model, or recreating the deployment "without locking parameters", changes
nothing. The value is chosen by the client and rejected by the model. **The only
place to intervene is between them.**

### The durable fix: a shim that drops what the endpoint refuses

Put a small local proxy between the editor and the endpoint. Forward every
request untouched; **only if the endpoint answers 400 with `unsupported_value`
and names a `param`, drop that parameter and retry once.**

That inversion matters. A proxy carrying a list of which models reject which
parameters is wrong the day a new model ships. Letting the endpoint decide keeps
working for parameters and models that do not exist yet, and it leaves alone the
models that accept temperature rather than degrading them to a default.

A 400 arrives before any response body streams, so the retry costs one round trip
and never truncates a stream. **Stream the body straight through**: an agentic
chat client uses server-sent events, and a proxy that buffers turns a live token
stream into a long pause followed by a wall of text.

A working implementation is about 120 lines with no dependencies. It also lets
the API key stay server-side, so it stops living in the editor's synced
credential store.

**Verify a model against the client you will actually use, not just with curl.**
Tested one way, a model looks fine; tested the other, it never worked.

---

## 2. Capacity is a per-minute budget, and it is small

**The failure:**

```
{"code":"RateLimitReached","message":"Your requests to <model> ... have exceeded rate limit."}
```

**Capacity is thousands of tokens per minute (TPM)**, not per day. It refills
every minute. There is also a requests-per-minute ceiling derived from it.

**An agentic client attaches full file context on every turn**, so a single
message can exhaust a modest allocation. A deployment sized for batch content
work is not sized for a person typing in a chat box.

Two things this makes concrete:

**Quota ceilings differ enormously per model.** On one account in one region:
DeepSeek-V4-Pro capped at **1000** with no headroom left after raising it;
each gpt-5.6 deployment could go to **10,000**. Same account, same region, 10x
apart. Check before you design around a model:

```bash
az cognitiveservices usage list -l <region> --query "[?contains(name.value,'<model>')].{name:name.value, used:currentValue, limit:limit}" -o table
```

::: warning Do not read the catalog's maximum as your quota
The model catalog publishes a `capacity.maximum` per deployment type, and it is
**the largest value the deployment type accepts**, not what you may allocate.
`DeepSeek-V4-Pro` publishes **1,000,000** while the same subscription's quota for
it in East US is **1,000**. Only the second number throttles you. The catalog
gives you the bucket name to ask with, such as
`AIServices.GlobalStandard.DeepSeek-V4-Pro`.

**Quota is granted per deployment type**, so a model exhausted on
`GlobalStandard` can still hold untouched `DataZoneStandard` capacity. Check
every SKU before concluding a model is out of room. See the
[model availability matrix](../reference/model-matrix) for which deployment types
each model offers, per region.
:::

**Capacity is not a cost control.** On `GlobalStandard` you bill per token
consumed either way, so a throttled deployment **spends the same and delivers
less**: the client hits `429` on its second call and either stalls or retries the
same work. Size capacity to what the deployment actually has to serve. On a
provisioned SKU the arithmetic is different, because there you pay per
provisioned unit per hour.

---

## 3. Content safety is yours, and the default blocks coding work

**The failure:**

```
Reason: Response got filtered.
```

**That message names no category.** Nothing in it tells you which filter fired,
which is why this costs hours.

`Microsoft.DefaultV2`, measured on one account:

| Filter | Source | Blocking |
|---|---|---|
| Hate, Sexual, Violence, Selfharm | prompt and completion | yes, at Medium |
| **Jailbreak** | prompt | **yes** |
| **Protected Material Text** | completion | **yes** |
| Protected Material Code | completion | no, annotate only |

**The obvious suspect is innocent.** Protected Material *Code* is already
annotate-only. The two that break an editor integration are:

**Jailbreak detection on the prompt.** It fires on text that looks like injected
instructions. An agentic client attaches whole source files, and source is full
of imperative language, configuration and prompt-like strings. **The user is not
attacking the model; their repository reads like an attack to a classifier.**

**Protected Material Text on the completion.** Model output matching known text
is blocked rather than returned.

### A third case: ordinary profanity

Profanity is not its own category, but **Hate at `Medium` on the prompt side** can
trip on aggressive language. Someone swearing at their tools is not producing hate
speech, and a refusal mid-task makes the frustration worse.

**Raise the prompt-side threshold to `High`; leave the completion side at
`Medium`.** What a user may type and what the model may say back are different
questions.

### The fix

A custom policy that changes only what needs changing:

- Four harm categories: **still blocking**. Prompt side at `High`, completion at `Medium`.
- Jailbreak and Protected Material Text: `enabled: true, blocking: false` - **annotate, do not block.** Detection still runs and still reports; the response survives.

Apply it to **chat deployments only**. Image, voice and embedding deployments
cannot trip a text-completion filter, and widening a content-safety change earns
nothing.

**Record the decision.** A relaxed content-safety policy is governance, not
configuration. Put it in the change log with its reason, so the next person finds
a decision rather than a mystery.

---

## 4. The deployment name is not the model id

You choose the deployment name. The vendor's model id is a different string.

```
404 DeploymentNotFound
```

means a client sent the vendor id where the deployment name belonged. This is the
single most common first-call failure. **Every client field asking for a "model"
wants the deployment name.**

This is also an opportunity: a deployment-name convention that carries your
organisation's prefix makes your models unmistakable in a client's picker
alongside vendor-hosted ones. **But renaming a deployment changes the real
identifier for every consumer**, including your model registry and anything
mapping jobs to models. Decide it before you deploy, not after.

---

## What to do before trusting a deployment

1. **Call it directly** and get a 200. If that fails, no client will work.
2. **Test the parameters your client sends**, especially temperature.
3. **Check the quota ceiling**, not just the current allocation.
4. **Read the content-safety policy** attached to the deployment.
5. **Call it through the client you will actually use.** Steps 1 to 4 can all pass
   while the integration is unusable.

**A capability read from documentation is a claim. Exercised against the API it is
a fact.** Every number on this page came from step 1 through 5 against a live
account, and several contradicted what the documentation implied.

## See also

- [Connect your tools](./connect-your-tools) - the configuration itself, per client.
- [Content safety](./content-safety) - the policy JSON and how to attach it.
- [Model selection](./model-selection) - choosing what to deploy in the first place.
- [Cost and governance](../design/cost-and-governance) - why the budget alerts rather than stops.
