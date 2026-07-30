import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Homestead Foundry",
  description: "A knowledge and automation center for building on Azure AI Foundry.",
  // GitHub Pages serves a project site under /<repo-name>/, a custom domain serves it at the root.
  base: process.env.GITHUB_PAGES_BASE ?? "/",
  cleanUrls: true,
  // Dead links now fail the build. This was `true` while the canonical
  // architecture content was being moved under docs/, which meant a broken
  // internal link produced a green build and nobody found out. The ten links it
  // was hiding all pointed at real repository files that are not site pages
  // (AGENTS.md, ai/verification/, ai/plans/source/, a .drawio source); those are
  // now absolute repository links. Link to a page by relative path, or to a
  // repository file by its GitHub URL. See ADR-0017.
  ignoreDeadLinks: false,
  // The mark is a hexagon, the shape Azure uses for a resource, holding a forge
  // flame. Hand-authored SVG in docs/public/. There is no raster fallback yet:
  // producing .ico and apple-touch-icon.png needs a rasterizer, and installing
  // one is owner-gated. Modern browsers use the SVG icon.
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#0B4A8F" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Homestead Foundry" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "A knowledge and automation center for Azure AI Foundry, across all three deployment targets.",
      },
    ],
  ],
  themeConfig: {
    logo: { src: "/logo.svg", alt: "Homestead Foundry" },
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Architecture", link: "/design/architecture-overview" },
      { text: "Deployment targets", link: "/targets/" },
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
        {
          text: "Using what you deployed",
          items: [
            { text: "Using your deployment", link: "/guide/using-your-deployment" },
            { text: "Connect your tools", link: "/guide/connect-your-tools" },
            { text: "Building agents", link: "/guide/building-agents" },
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
            { text: "Foundry observability", link: "/design/observability-architecture" },
            { text: "Platform observability consumption", link: "/design/platform-observability-consumption" },
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
            { text: "ADR-0013 Track 2 install, identity, governance scope", link: "/adr/ADR-0013-foundry-local-windows-server-install" },
            { text: "ADR-0014 Track 3 deployment layers and auth", link: "/adr/ADR-0014-foundry-local-azure-local-deployment-layers" },
            { text: "ADR-0015 Cost-first observability boundaries", link: "/adr/ADR-0015-cost-first-observability-boundaries" },
            { text: "ADR-0016 Foundry model-usage observability", link: "/adr/ADR-0016-foundry-model-usage-observability" },
            { text: "ADR-0017 Deployment-target docs and repo structure", link: "/adr/ADR-0017-deployment-target-documentation-structure" },
          ],
        },
      ],
      "/targets/": [
        {
          text: "Overview",
          items: [
            { text: "Compare the three targets", link: "/targets/" },
            { text: "Choosing a target", link: "/targets/choosing" },
          ],
        },
        {
          text: "Azure cloud (track 1)",
          items: [
            { text: "Overview", link: "/targets/azure-cloud/" },
            { text: "Architecture", link: "/targets/azure-cloud/architecture" },
            { text: "Models", link: "/targets/azure-cloud/models" },
            { text: "Features", link: "/targets/azure-cloud/features" },
            { text: "Deployment", link: "/targets/azure-cloud/deployment" },
            { text: "Consumption", link: "/targets/azure-cloud/consumption" },
            { text: "Cost", link: "/targets/azure-cloud/cost" },
            { text: "Security", link: "/targets/azure-cloud/security" },
            { text: "Operations", link: "/targets/azure-cloud/operations" },
          ],
        },
        {
          text: "Windows Server (track 2)",
          items: [
            { text: "Overview", link: "/targets/windows-server/" },
            { text: "Architecture", link: "/targets/windows-server/architecture" },
            { text: "Models", link: "/targets/windows-server/models" },
            { text: "Features", link: "/targets/windows-server/features" },
            { text: "Deployment", link: "/targets/windows-server/deployment" },
            { text: "Consumption", link: "/targets/windows-server/consumption" },
            { text: "Cost", link: "/targets/windows-server/cost" },
            { text: "Security", link: "/targets/windows-server/security" },
            { text: "Operations", link: "/targets/windows-server/operations" },
          ],
        },
        {
          text: "Azure Local (track 3)",
          items: [
            { text: "Overview", link: "/targets/azure-local/" },
            { text: "Architecture", link: "/targets/azure-local/architecture" },
            { text: "Models", link: "/targets/azure-local/models" },
            { text: "Features", link: "/targets/azure-local/features" },
            { text: "Deployment", link: "/targets/azure-local/deployment" },
            { text: "Consumption", link: "/targets/azure-local/consumption" },
            { text: "Cost", link: "/targets/azure-local/cost" },
            { text: "Security", link: "/targets/azure-local/security" },
            { text: "Operations", link: "/targets/azure-local/operations" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Reference index", link: "/reference/" },
            { text: "Model catalog (Azure cloud)", link: "/reference/model-catalog" },
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
            { text: "SPIKE-18 Foundry Local on Windows Server", link: "/research/SPIKE-18-foundry-local-windows-server" },
            { text: "SPIKE-19 Foundry Local on Azure Local", link: "/research/SPIKE-19-foundry-local-azure-local-deployment" },
            { text: "SPIKE-20 Cost-first observability", link: "/research/SPIKE-20-cost-first-observability" },
            { text: "SPIKE-21 Solution observability", link: "/research/SPIKE-21-solution-observability" },
          ],
        },
      ],
      "/implementation/": [
        {
          text: "Implementation",
          items: [
            { text: "Implementation guide", link: "/implementation/implementation-guide" },
            { text: "Foundry observability implementation", link: "/implementation/foundry-observability" },
            { text: "Foundry observability operations", link: "/implementation/foundry-observability-operations" },
            { text: "Foundry observability parameters", link: "/implementation/foundry-observability-parameters" },
            { text: "As-built record", link: "/implementation/as-built" },
          ],
        },
      ],
    },
    socialLinks: [],
    search: { provider: "local" },
  },
});
