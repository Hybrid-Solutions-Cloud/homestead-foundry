# Getting started

Homestead Foundry (`Hybrid-Solutions-Cloud/homestead-foundry`) documents and automates building on **Azure AI Foundry**. This site is a published mirror of the repository's `ai/` and `models/` content, meant to be read on its own without needing repo access.

## What is here

- **[Methodology](./methodology)** - how a build moves through this repo's phase-gated process: research spike, then Architecture Decision Record, then design doc, then diagram, then implementation, then review.
- **[Model registry](./model-registry)** - the schema this repo uses to track which models are deployed, planned, or rejected, and why, so a consuming project can resolve a model id to a usable endpoint without hardcoding a deployment name.
- **[Deployment](./deployment)** - how the Bicep automation stands up (and tears down) the actual Azure resources.
- **[Architecture](../architecture/architecture-overview)** - the full Well-Architected design docs (topology and CAF naming, identity, reliability, performance, cost, pipeline integration) rendered on this site.
- **[ADRs](../adr/)** - every locked architecture decision, rendered in full, each tracing back to the research spike that justified it.
- **[Research spikes](../research/)** - the grounded research behind every decision.
- **[Implementation](../implementation/implementation-guide)** - the deployment runbook and as-built record.

## Who this is for

Anyone evaluating or building an Azure AI Foundry project who wants a worked, production-proven example to learn from or fork pieces of, rather than starting from a blank page. Every ADR and design doc states its methodology generically first, then shows the real deployed instance as a closing "Worked example" section as proof it holds up outside the abstract.

## What is automated here

This repo's own build process is itself driven by a roster of specialized Claude Code agents (research, architecture, diagramming, review, environment verification, and Bicep implementation), each scoped to one phase of the methodology. See `AGENTS.md` in the repository root for the full roster if you have repo access; the methodology guide above explains what each phase produces without assuming you do.

## Current status

As of the last publish of this site, the research spikes, ADRs, and design docs are complete, the model registry schema is in place, and the parameterized Bicep is authored and validated (not yet deployed). See the [roadmap](../roadmap) page for the current status.
