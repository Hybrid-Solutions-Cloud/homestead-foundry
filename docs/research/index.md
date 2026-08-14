# Research spikes

Every research spike behind the architecture decisions, in order. Each grounds its findings in a first-party Microsoft Learn source or a named vendor's own documentation, and each traces forward to one or more ADRs.

| Spike | Topic |
|---|---|
| [SPIKE-01](./SPIKE-01-image-model) | MAI-Image-2.5 image model |
| [SPIKE-02](./SPIKE-02-voice-model) | MAI-Voice-2 text-to-speech model |
| [SPIKE-03](./SPIKE-03-tenant-readiness) | Tenant and subscription readiness |
| [SPIKE-04](./SPIKE-04-identity-security) | Identity, secrets, security, and responsible AI |
| [SPIKE-05](./SPIKE-05-cost-governance) | Cost model and governance |
| [SPIKE-06](./SPIKE-06-pipeline-integration) | Publish-pipeline integration |
| [SPIKE-07](./SPIKE-07-speech-models) | Speech models beyond MAI and native Azure (word-sync and lip-sync) |
| [SPIKE-08](./SPIKE-08-foundry-local-on-device) | Foundry Local (on-device inferencing) |
| [SPIKE-09](./SPIKE-09-azure-local-foundry) | AI Foundry model workloads on Azure Local (Arc-connected, cluster-scale) |
| [SPIKE-10](./SPIKE-10-latest-gpt-model) | Latest available in-tenant GPT model |
| [SPIKE-11](./SPIKE-11-newer-grok-model) | A newer Grok than grok-4-1-fast-reasoning |
| [SPIKE-12](./SPIKE-12-image-video-alternatives) | Broader image, animation, and video generation alternatives |
| [SPIKE-13](./SPIKE-13-tenant-wide-tts-survey) | Tenant-wide voice/TTS survey |
| [SPIKE-14](./SPIKE-14-tenant-region-survey) | Tenant-wide model and region survey |
| [SPIKE-15](./SPIKE-15-niche-reviewer-models) | Niche and emerging reviewer models for code and document review |
| [SPIKE-16](./SPIKE-16-virtual-trainer-avatar) | Photorealistic virtual-trainer avatar |
| [SPIKE-17](./SPIKE-17-agent-mcp-gateway-governance) | Governing agent MCP tools with an APIM AI gateway |
| [SPIKE-18](./SPIKE-18-foundry-local-windows-server) | Foundry Local on Windows Server, and whether the Arc run-command can install it (track 2) |
| [SPIKE-19](./SPIKE-19-foundry-local-azure-local-deployment) | Where the ARM and Kubernetes seam sits for Foundry Local on Azure Local (track 3) |
| [SPIKE-20](./SPIKE-20-cost-first-observability) | Cost-first Azure Monitor, Foundry, Grafana, and hybrid observability |
| [SPIKE-21](./SPIKE-21-solution-observability) | Solution observability for Azure AI Foundry |
| [SPIKE-22](./SPIKE-22-foundry-local-model-catalog) | The Foundry Local model catalog, and whether tracks 2 and 3 draw from one catalog or two |
| [SPIKE-23](./SPIKE-23-foundry-local-install-artifacts-and-run-command) | Foundry Local install artifacts, and the real mechanics of Azure Arc run command |
| [SPIKE-25](./SPIKE-25-local-track-hardware-sizing) | Hardware sizing and capacity planning for the two local Foundry tracks |
| [SPIKE-26](./SPIKE-26-local-track-cost-model) | The cost model for the two local tracks, and where a spend cap can actually be enforced |
| [SPIKE-27](./SPIKE-27-local-track-observability) | What Azure can and cannot see for the local deployment tracks |
| [SPIKE-28](./SPIKE-28-azure-local-networking-storage-certificates) | Networking, ingress, TLS, and storage for Foundry Local on Azure Local |
| [SPIKE-29](./SPIKE-29-local-track-lifecycle-and-upgrade) | Lifecycle, upgrade, and drift for the two Foundry Local tracks |
| [SPIKE-31](./SPIKE-31-cross-track-feature-parity) | Cross-track capability and feature parity across the three deployment targets |
| [SPIKE-32](./SPIKE-32-model-region-availability-matrix) | Every model against every region, and what actually differs between them |
| [SPIKE-33](./SPIKE-33-code-document-model-comparison) | Code and documentation candidates, token limits, billed rates, API differences, and the controlled comparison gate |
