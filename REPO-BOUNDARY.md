# Repository boundary

This file states what this repository is for, what must never be added to it,
and where to look instead. It exists because content tooling was added here
once already and had to be moved out.

## What this is

**The Azure AI Foundry framework.** Bicep modules, architecture decision
records, research spikes, the phase method, and the agent roster that does the
deploying.

- Visibility: **public**
- Consumers: anyone standing up a Foundry estate, plus this owner's own instance

## What must never go here

| Do not add | Because | Where it belongs |
|---|---|---|
| **Content, or tooling that builds content** | This is infrastructure. A content tool that lives inside an infrastructure framework is coupled to one cloud forever. | `project42dev/orchard` |
| **Anything specific to Project 42** | Project 42 is one consumer of a Foundry, not a reason this repository exists. | The Project 42 repositories |
| **A specific tenant, subscription, resource group, or vault value** | Public repository, and a deployer needs to supply their own. | Parameters, and the deployer's own secret store |
| **Secrets of any kind** | Public repository. | The tenant key vault |
| **A CI workflow** | Owner directive. This repository has no CI and is not to acquire any. | Nowhere |

## What lives here but is instance-specific

Nothing should. One owner's deployed model set, capacities, and chosen models
live in the **instance** repository, `my-homestead-foundry`, not in this
framework.

## Looking for something else?

| Looking for | It lives in |
|---|---|
| **The content discovery, scoring, and authoring tooling** | **`project42dev/orchard`** |
| The content itself, and the content model | `project42dev/project42-platform` |
| One owner's Foundry instance and its model registry | `my-homestead-foundry` |

The discovery tooling (`discover-content-opportunities.mjs`,
`merge-opportunity-proposals.mjs`, `score-opportunities.mjs`, their tests, and
`content/`) was moved to Orchard. It is not coming back.

## The rule in one line

**This repository describes how to build a Foundry. It never describes what to
do with one.**
