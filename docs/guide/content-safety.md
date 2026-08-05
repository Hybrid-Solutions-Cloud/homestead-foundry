# Content safety, and why the default policy blocks a code assistant

Every model deployment carries a content-safety policy, called an RAI policy.
Azure applies `Microsoft.DefaultV2` unless you say otherwise, and this
methodology keeps that default deliberately: a reconcile of an existing account
should preserve its content-safety policy rather than strip it (ADR-0007).

**That default is right for an image pipeline and wrong for a code assistant.**
This page explains why, and what to do instead.

## What DefaultV2 actually contains

Read the policy on your own account rather than trusting this table, because
Azure changes the managed policies:

```bash
az rest --method get --url "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/raiPolicies?api-version=2024-10-01"
```

Measured on one account, 2026-08-04:

| Filter | Source | Blocking | Threshold |
|---|---|---|---|
| Hate, Sexual, Violence, Selfharm | Prompt | yes | Medium |
| Hate, Sexual, Violence, Selfharm | Completion | yes | Medium |
| **Jailbreak** | Prompt | **yes** | - |
| **Protected Material Text** | Completion | **yes** | - |
| Protected Material Code | Completion | no (annotate) | - |

## The two that break an editor integration

**Protected Material Text, blocking.** The filter compares model output against
known text and blocks a match. Ask for anything idiomatic and the response can
be destroyed rather than returned.

**Jailbreak detection on the prompt, blocking.** This fires on text that looks
like injected instructions. **An agentic editor client attaches whole files on
every turn**, and source files are full of imperative language, configuration
and prompt-like strings. The user is not attacking the model; their repository
simply reads like an attack to a classifier.

The failure surfaces as an opaque client error with no category:

```
Reason: Response got filtered.: Error: Response got filtered.
```

Nothing in that message says which filter fired, which is why this costs people
hours. **Protected Material Code is already annotate-only in DefaultV2**, so the
obvious suspect is not the culprit.

## A third problem: ordinary profanity

Profanity is not its own category, but the **Hate** filter at `Medium` on the
**prompt** side can trip on aggressive language. A frustrated developer swearing
at their tools is not hate speech, and having the model refuse mid-task makes it
worse. Raising the **prompt-side** threshold to `High` lets ordinary swearing
through while genuinely harmful content still blocks.

Leave the **completion** side at `Medium`. That governs what the model says
back, which is a different question from what a user is allowed to type.

## The fix: a per-deployment policy

Create a policy that changes only what needs changing, and leave the four harm
categories in place:

```jsonc
{
  "properties": {
    "mode": "Blocking",
    "basePolicyName": "Microsoft.DefaultV2",
    "contentFilters": [
      // Harm categories stay. Prompt side at High so profanity is not a refusal;
      // completion side stays at Medium, governing what the model says back.
      { "name": "Hate",     "source": "Prompt",     "enabled": true, "blocking": true, "severityThreshold": "High" },
      { "name": "Hate",     "source": "Completion", "enabled": true, "blocking": true, "severityThreshold": "Medium" },
      // ... Sexual, Violence, Selfharm identically ...

      // The two that break an editor. Still DETECTED and annotated, not blocked.
      { "name": "Jailbreak",               "source": "Prompt",     "enabled": true, "blocking": false },
      { "name": "Protected Material Text", "source": "Completion", "enabled": true, "blocking": false },
      { "name": "Protected Material Code", "source": "Completion", "enabled": true, "blocking": false }
    ]
  }
}
```

`enabled: true, blocking: false` means **annotate, do not block**. The detection
still runs and still reports; the response survives. This is a narrower change
than disabling the filter, and it keeps the signal.

Create it, then attach it per deployment:

```bash
az rest --method put --url ".../raiPolicies/<policy-name>?api-version=2024-10-01" --body @policy.json

az rest --method patch --url ".../deployments/<deployment>?api-version=2024-10-01" \
  --headers "Content-Type=application/json" \
  --body '{"properties":{"raiPolicyName":"<policy-name>"}}'
```

## Declare it in the registry, not by hand

A model registry entry takes an optional `raiPolicy`, which wins over the
stack-wide `raiPolicyName` parameter:

```json
{
  "id": "your-chat-model",
  "deploymentName": "your-chat-model",
  "kind": "reasoning",
  "capacity": 1000,
  "raiPolicy": "your-code-assistant-policy"
}
```

Omit it and the entry inherits the stack default, which is what you want for
image, voice and embedding deployments. **This is the same design as `capacity`,
and for the same reason: one stack-wide value is wrong the moment two model
kinds have different needs.**

## Apply it to chat models only

| Model kind | Policy |
|---|---|
| Chat and reasoning | the custom policy |
| Image generation | leave on the Azure default |
| Text to speech | leave on the Azure default |
| Embeddings | leave on the Azure default |

An embedding model returns vectors and an image model returns an image; neither
is going to trip a text-completion filter. Changing their policy is churn with
no benefit, and it widens the blast radius of a content-safety decision for no
reason.

## What this is not

**This is not turning content safety off.** The four harm categories still block
on both sides. Jailbreak and protected-material detection still run and still
annotate. What changes is that a detection stops destroying a response, and
prompt-side harm thresholds stop treating frustration as hate speech.

**Decide this deliberately and record it.** A relaxed content-safety policy is a
governance decision, not a configuration detail. Put it in the change log with
the reason, so the next person reads a decision rather than finding a mystery.
