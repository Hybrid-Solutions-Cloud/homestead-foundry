# Homestead Foundry

**The open-source knowledge and automation center for Azure AI Foundry.**

> **Status: Active.** This repository is actively maintained for as long as its creator, Kristopher Turner, has the time to keep building it. Everything documented and deployed here is real - the models, the automation, the deployment patterns - it's what Kristopher Turner and Hybrid Solutions Cloud actually use, not a demo or a reference-only example.

## Is this what you're looking for?

You've come across Azure AI Foundry and you want to actually *do* something with it - deploy a model, stand up a Foundry resource the right way, or understand how the pieces fit together instead of piecing it together from scattered docs. Homestead Foundry is built to get you there: learn what Azure AI Foundry is, install and configure it, and deploy exactly the piece you need, no more.

## What Homestead Foundry is

- **A knowledge center.** Documentation that explains Azure AI Foundry itself - what it is, how to install and configure it, and how to work with the models it hosts (image, voice, video, reasoning/review) - written for someone new to it, not just for the person who built this.
- **An automation center.** Infrastructure-as-code (Bicep) and a roster of AI agents (see [`AGENTS.md`](AGENTS.md)) that do the research, design, deployment, and verification work for you - point them at your own Azure tenant and they follow the same disciplined, reviewed process this repo runs on itself.
- **A model catalog.** One place that tracks which AI models are available, deployed, and recommended for which kind of work, so you're choosing from a known-good list instead of guessing.
- **Modular by design.** Take the whole thing, or take just the one piece you need - a single model, a single Bicep module, a single agent - and drop it into your own project.

## Proof it holds up

<!-- safety-scan-worked-example:start -->

Homestead Foundry runs a real, published production deployment - the Azure AI Foundry backbone generating scene art and voice narration for two live brands, Gunner the Lab and Holdfast Press. That's not a demo; it's the system this whole platform is being generalized from, and it keeps running here as the platform grows around it.

<!-- safety-scan-worked-example:end -->

## Status

This repo is private while it's being generalized and scrubbed of anything owner-specific. Once that's done, it opens up as the knowledge and automation center described above. Track progress in the private planning workspace - vision, decisions, roadmap, and backlog of what's left.
