import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Homestead Foundry",
  description: "A knowledge and automation center for building on Azure AI Foundry.",
  // GitHub Pages serves a project site under /<repo-name>/, a custom domain serves it at the root.
  base: process.env.GITHUB_PAGES_BASE ?? "/",
  cleanUrls: true,
  // Don't fail the build on any stray relative link inside the canonical
  // architecture content that now lives under docs/.
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Architecture", link: "/design/architecture-overview" },
      { text: "ADRs", link: "/adr/" },
      { text: "Research", link: "/research/" },
      { text: "Models", link: "/reference/model-catalog" },
      { text: "Implementation", link: "/implementation/implementation-guide" },
      { text: "Roadmap", link: "/roadmap" },
      { text: "Changelog", link: "/changelog" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Methodology", link: "/guide/methodology" },
            { text: "Model registry", link: "/guide/model-registry" },
            { text: "Deployment", link: "/guide/deployment" },
          ],
        },
      ],
      "/design/": [
        {
          text: "Design (Well-Architected)",
          items: [
            { text: "Architecture overview", link: "/design/architecture-overview" },
            { text: "Resource topology and CAF naming", link: "/design/resource-topology-and-caf-naming" },
            { text: "Identity and security", link: "/design/identity-and-security" },
            { text: "Reliability and operations", link: "/design/reliability-and-operations" },
            { text: "Performance efficiency", link: "/design/performance-efficiency" },
            { text: "Cost and governance", link: "/design/cost-and-governance" },
            { text: "Publish-pipeline integration", link: "/design/pipeline-integration-design" },
            { text: "Diagrams (Lucid index)", link: "/design/diagrams" },
          ],
        },
      ],
      "/adr/": [
        {
          text: "Architecture Decision Records",
          items: [
            { text: "ADR index", link: "/adr/" },
            { text: "ADR-0001 Target tenant and region", link: "/adr/ADR-0001-target-tenant" },
            { text: "ADR-0002 Image-model selection methodology", link: "/adr/ADR-0002-image-model-and-access" },
            { text: "ADR-0003 Voice-model selection methodology", link: "/adr/ADR-0003-voice-model-and-voice-set" },
            { text: "ADR-0004 Foundry topology and region", link: "/adr/ADR-0004-foundry-topology-and-region" },
            { text: "ADR-0005 Identity and secrets", link: "/adr/ADR-0005-identity-and-secrets" },
            { text: "ADR-0006 Cost governance", link: "/adr/ADR-0006-cost-governance" },
            { text: "ADR-0007 Content safety and responsible AI", link: "/adr/ADR-0007-content-safety-and-responsible-ai" },
            { text: "ADR-0008 Publish-pipeline integration", link: "/adr/ADR-0008-publish-pipeline-integration" },
            { text: "ADR-0009 Azure Local reviewer track", link: "/adr/ADR-0009-azure-local-reviewer-track" },
            { text: "ADR-0010 FLUX adoption (superseded)", link: "/adr/ADR-0010-flux-image-model-adoption" },
            { text: "ADR-0011 Multi-target deployment automation", link: "/adr/ADR-0011-multi-target-deployment-automation" },
            { text: "ADR-0012 Agent MCP gateway governance", link: "/adr/ADR-0012-agent-mcp-gateway-governance" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Model catalog", link: "/reference/model-catalog" },
          ],
        },
      ],
      "/research/": [
        {
          text: "Research spikes",
          items: [
            { text: "Spike index", link: "/research/" },
            { text: "SPIKE-01 Image model (MAI-Image-2.5)", link: "/research/SPIKE-01-image-model" },
            { text: "SPIKE-02 Voice model (MAI-Voice-2)", link: "/research/SPIKE-02-voice-model" },
            { text: "SPIKE-03 Tenant and subscription readiness", link: "/research/SPIKE-03-tenant-readiness" },
            { text: "SPIKE-04 Identity, secrets, security", link: "/research/SPIKE-04-identity-security" },
            { text: "SPIKE-05 Cost model and governance", link: "/research/SPIKE-05-cost-governance" },
            { text: "SPIKE-06 Publish-pipeline integration", link: "/research/SPIKE-06-pipeline-integration" },
            { text: "SPIKE-07 Speech models (word/lip-sync)", link: "/research/SPIKE-07-speech-models" },
            { text: "SPIKE-08 Foundry Local (on-device)", link: "/research/SPIKE-08-foundry-local-on-device" },
            { text: "SPIKE-09 AI Foundry on Azure Local", link: "/research/SPIKE-09-azure-local-foundry" },
            { text: "SPIKE-10 Latest in-tenant GPT model", link: "/research/SPIKE-10-latest-gpt-model" },
            { text: "SPIKE-11 Newer Grok model", link: "/research/SPIKE-11-newer-grok-model" },
            { text: "SPIKE-12 Image/animation/video alternatives", link: "/research/SPIKE-12-image-video-alternatives" },
            { text: "SPIKE-13 Tenant-wide TTS survey", link: "/research/SPIKE-13-tenant-wide-tts-survey" },
            { text: "SPIKE-14 Tenant model and region survey", link: "/research/SPIKE-14-tenant-region-survey" },
            { text: "SPIKE-15 Niche reviewer models", link: "/research/SPIKE-15-niche-reviewer-models" },
            { text: "SPIKE-16 Virtual-trainer avatar", link: "/research/SPIKE-16-virtual-trainer-avatar" },
            { text: "SPIKE-17 Agent MCP gateway governance", link: "/research/SPIKE-17-agent-mcp-gateway-governance" },
          ],
        },
      ],
      "/implementation/": [
        {
          text: "Implementation",
          items: [
            { text: "Implementation guide", link: "/implementation/implementation-guide" },
            { text: "As-built record", link: "/implementation/as-built" },
          ],
        },
      ],
    },
    socialLinks: [],
    search: { provider: "local" },
  },
});
