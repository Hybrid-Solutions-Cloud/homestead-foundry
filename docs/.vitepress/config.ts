import { defineConfig } from "vitepress";

// VitePress rewrites site-root paths for you in page content and in
// themeConfig.logo, but NOT inside `head` entries: whatever string you put in a
// head href is emitted verbatim. On the project Pages site the page therefore
// asked for /favicon.svg while the file was served at /homestead-foundry/favicon.svg,
// so the browser tab fell back to the default globe. Any head href must be
// prefixed with BASE by hand.
const BASE = process.env.GITHUB_PAGES_BASE ?? "/";

// One shared tree for the whole "Build" journey, assigned to both /design/ and
// /implementation/ so a reader who crosses from a design doc into the runbook
// keeps the same sidebar instead of the tree changing under them. The two
// directories stay where they are; only the navigation is unified.
const BUILD_SIDEBAR = [
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
  {
    text: "Observability design",
    collapsed: true,
    items: [
      { text: "Foundry observability", link: "/design/observability-architecture" },
      { text: "Platform observability consumption", link: "/design/platform-observability-consumption" },
    ],
  },
  {
    text: "Deploy it",
    items: [
      { text: "Deployment guide", link: "/guide/deployment" },
      { text: "Implementation guide", link: "/implementation/implementation-guide" },
      { text: "As-built record", link: "/implementation/as-built" },
    ],
  },
  {
    text: "Observability implementation",
    collapsed: true,
    items: [
      { text: "Foundry observability implementation", link: "/implementation/foundry-observability" },
      { text: "Foundry observability operations", link: "/implementation/foundry-observability-operations" },
      { text: "Foundry observability parameters", link: "/implementation/foundry-observability-parameters" },
    ],
  },
  {
    text: "Then use it",
    items: [
      { text: "Using your deployment", link: "/guide/using-your-deployment" },
      { text: "Connect your tools", link: "/guide/connect-your-tools" },
      { text: "Building agents", link: "/guide/building-agents" },
    ],
  },
];

export default defineConfig({
  title: "Homestead Foundry",
  description: "A knowledge and automation center for building on Azure AI Foundry.",
  // GitHub Pages serves a project site under /<repo-name>/, a custom domain serves it at the root.
  base: BASE,
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
  // one is owner-gated. Chrome, Edge, Firefox, and Safari all render the SVG
  // icon; only pre-2019 browsers need the .ico.
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${BASE}favicon.svg` }],
    // Same mark again as the generic fallback, so a browser that ignores the
    // typed SVG link still has something to request other than /favicon.ico at
    // the server root, which on a project Pages site is not this site.
    ["link", { rel: "alternate icon", href: `${BASE}favicon.svg` }],
    ["link", { rel: "apple-touch-icon", href: `${BASE}favicon.svg` }],
    ["link", { rel: "mask-icon", href: `${BASE}favicon.svg`, color: "#0B4A8F" }],
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
    // Five dropdowns, grouped by what a reader came to do rather than by
    // document type. The previous nav had nine flat items mixing four different
    // kinds of thing (audience content, evidence, project meta, and reference),
    // which meant one reader journey was split across three menus.
    //
    // This is deliberately a nav-and-sidebar-only structure: no directory is
    // moved and no URL changes. Moving content is forbidden by ADR-0017
    // decision 1, and a dozen non-docs files hardcode `docs/design`,
    // `docs/guide`, and `docs/implementation` as strings. The cost of that
    // constraint is two labels that do not match their path ("Design" lives at
    // /design/ but is reached under Build; Reference pages live at /reference/).
    // That is the cheaper trade.
    nav: [
      {
        text: "Start",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Methodology", link: "/guide/methodology" },
          { text: "Model selection", link: "/guide/model-selection" },
          { text: "Model registry", link: "/guide/model-registry" },
        ],
      },
      {
        text: "Deployment targets",
        items: [
          { text: "Compare the three", link: "/targets/" },
          { text: "Choosing a target", link: "/targets/choosing" },
          { text: "Azure AI Foundry", link: "/targets/azure-cloud/" },
          { text: "Foundry Local", link: "/targets/windows-server/" },
          { text: "Azure Local Foundry", link: "/targets/azure-local/" },
        ],
      },
      {
        text: "Build",
        items: [
          {
            text: "Design",
            items: [
              { text: "Architecture overview", link: "/design/architecture-overview" },
              { text: "Resource topology and CAF naming", link: "/design/resource-topology-and-caf-naming" },
              { text: "Identity and security", link: "/design/identity-and-security" },
              { text: "Cost and governance", link: "/design/cost-and-governance" },
            ],
          },
          {
            text: "Deploy",
            items: [
              { text: "Deployment guide", link: "/guide/deployment" },
              { text: "Implementation guide", link: "/implementation/implementation-guide" },
              { text: "As-built record", link: "/implementation/as-built" },
            ],
          },
          {
            text: "Use what you deployed",
            items: [
              { text: "Using your deployment", link: "/guide/using-your-deployment" },
              { text: "Connect your tools", link: "/guide/connect-your-tools" },
              { text: "Building agents", link: "/guide/building-agents" },
            ],
          },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Reference index", link: "/reference/" },
          { text: "Model catalog (what this project chose)", link: "/reference/model-catalog" },
          { text: "Available: Azure AI Foundry", link: "/reference/model-availability-azure-cloud" },
          { text: "Available: Foundry Local and Azure Local Foundry", link: "/reference/model-catalog-foundry-local" },
          { text: "Diagrams", link: "/design/diagrams" },
        ],
      },
      {
        text: "Decision record",
        items: [
          {
            text: "Evidence",
            items: [
              { text: "Architecture Decision Records", link: "/adr/" },
              { text: "Research spikes", link: "/research/" },
            ],
          },
          {
            text: "Project",
            items: [
              { text: "Roadmap", link: "/roadmap" },
              { text: "Changelog", link: "/changelog" },
            ],
          },
        ],
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Start here",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Methodology", link: "/guide/methodology" },
            { text: "Model selection", link: "/guide/model-selection" },
            { text: "Model registry", link: "/guide/model-registry" },
          ],
        },
        {
          text: "Deploy it",
          items: [
            { text: "Deployment guide", link: "/guide/deployment" },
            { text: "Implementation guide", link: "/implementation/implementation-guide" },
          ],
        },
        {
          text: "Then use it",
          items: [
            { text: "Using your deployment", link: "/guide/using-your-deployment" },
            { text: "Connect your tools", link: "/guide/connect-your-tools" },
            { text: "Building agents", link: "/guide/building-agents" },
          ],
        },
      ],
      "/design/": BUILD_SIDEBAR,
      "/adr/": [
        {
          text: "Architecture Decision Records",
          items: [{ text: "ADR index", link: "/adr/" }],
        },
        // Grouped by status, because a flat list gave a superseded record and the
        // one governing current work identical visual weight. Statuses are read
        // from each ADR's own Status line; move an entry here when that changes.
        {
          text: "Accepted",
          items: [
            { text: "ADR-0001 Target tenant and region", link: "/adr/ADR-0001-target-tenant" },
            { text: "ADR-0002 Image-model selection methodology", link: "/adr/ADR-0002-image-model-and-access" },
            { text: "ADR-0003 Voice-model selection methodology", link: "/adr/ADR-0003-voice-model-and-voice-set" },
            { text: "ADR-0004 Foundry topology and region", link: "/adr/ADR-0004-foundry-topology-and-region" },
            { text: "ADR-0005 Identity and secrets", link: "/adr/ADR-0005-identity-and-secrets" },
            { text: "ADR-0006 Cost governance", link: "/adr/ADR-0006-cost-governance" },
            { text: "ADR-0007 Content safety and responsible AI", link: "/adr/ADR-0007-content-safety-and-responsible-ai" },
            { text: "ADR-0008 Publish-pipeline integration", link: "/adr/ADR-0008-publish-pipeline-integration" },
            { text: "ADR-0009 Azure Local reviewer track", link: "/adr/ADR-0009-azure-local-reviewer-track" },
            { text: "ADR-0011 Multi-target deployment automation", link: "/adr/ADR-0011-multi-target-deployment-automation" },
            { text: "ADR-0016 Foundry model-usage observability", link: "/adr/ADR-0016-foundry-model-usage-observability" },
            { text: "ADR-0017 Deployment-target docs and repo structure", link: "/adr/ADR-0017-deployment-target-documentation-structure" },
          ],
        },
        {
          text: "Proposed (not yet approved)",
          items: [
            { text: "ADR-0012 Agent MCP gateway governance", link: "/adr/ADR-0012-agent-mcp-gateway-governance" },
            { text: "ADR-0013 Foundry Local install, identity, governance scope", link: "/adr/ADR-0013-foundry-local-windows-server-install" },
            { text: "ADR-0014 Azure Local Foundry deployment layers and auth", link: "/adr/ADR-0014-foundry-local-azure-local-deployment-layers" },
            { text: "ADR-0015 Cost-first observability boundaries", link: "/adr/ADR-0015-cost-first-observability-boundaries" },
            { text: "ADR-0018 Model registry schema v2", link: "/adr/ADR-0018-model-registry-schema-v2" },
            { text: "ADR-0019 On-premises model rosters", link: "/adr/ADR-0019-on-premises-model-rosters" },
            { text: "ADR-0020 Hardware sizing and GPU scope", link: "/adr/ADR-0020-on-premises-hardware-sizing-and-gpu-scope" },
            { text: "ADR-0021 On-premises cost governance", link: "/adr/ADR-0021-on-premises-cost-governance" },
            { text: "ADR-0022 On-premises observability boundaries", link: "/adr/ADR-0022-on-premises-observability-boundaries" },
            { text: "ADR-0023 Azure Local Foundry networking and TLS", link: "/adr/ADR-0023-azure-local-foundry-networking-and-tls" },
            { text: "ADR-0024 On-premises lifecycle and upgrade", link: "/adr/ADR-0024-on-premises-lifecycle-and-upgrade" },
          ],
        },
        {
          text: "Superseded",
          collapsed: true,
          items: [
            { text: "ADR-0010 FLUX adoption", link: "/adr/ADR-0010-flux-image-model-adoption" },
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
          text: "Azure AI Foundry",
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
          text: "Foundry Local",
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
          text: "Azure Local Foundry",
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
          ],
        },
        {
          text: "What this project chose",
          items: [
            { text: "Model catalog", link: "/reference/model-catalog" },
          ],
        },
        {
          text: "What is available",
          items: [
            { text: "Azure AI Foundry", link: "/reference/model-availability-azure-cloud" },
            { text: "Foundry Local and Azure Local Foundry", link: "/reference/model-catalog-foundry-local" },
          ],
        },
      ],
      // Grouped by subject rather than listed by number. Twenty-nine spikes in
      // one flat list is unscannable: nobody reads SPIKE-01 through SPIKE-31
      // hunting for the cost one. Numbering is preserved in every label so a
      // citation from an ADR still resolves. Groups are collapsed by default
      // except the index, so the section opens as five headings, not a wall.
      //
      // Note the gaps: SPIKE-24 and SPIKE-30 are not written yet. That is
      // deliberate, not an omission. See the roadmap.
      "/research/": [
        {
          text: "Research spikes",
          items: [{ text: "Spike index", link: "/research/" }],
        },
        {
          text: "Models and modalities",
          collapsed: true,
          items: [
            { text: "SPIKE-01 Image model (MAI-Image-2.5)", link: "/research/SPIKE-01-image-model" },
            { text: "SPIKE-02 Voice model (MAI-Voice-2)", link: "/research/SPIKE-02-voice-model" },
            { text: "SPIKE-07 Speech models (word/lip-sync)", link: "/research/SPIKE-07-speech-models" },
            { text: "SPIKE-10 Latest in-tenant GPT model", link: "/research/SPIKE-10-latest-gpt-model" },
            { text: "SPIKE-11 Newer Grok model", link: "/research/SPIKE-11-newer-grok-model" },
            { text: "SPIKE-12 Image/animation/video alternatives", link: "/research/SPIKE-12-image-video-alternatives" },
            { text: "SPIKE-13 Tenant-wide TTS survey", link: "/research/SPIKE-13-tenant-wide-tts-survey" },
            { text: "SPIKE-15 Niche reviewer models", link: "/research/SPIKE-15-niche-reviewer-models" },
            { text: "SPIKE-16 Virtual-trainer avatar", link: "/research/SPIKE-16-virtual-trainer-avatar" },
          ],
        },
        {
          text: "Environment, identity, and integration",
          collapsed: true,
          items: [
            { text: "SPIKE-03 Tenant and subscription readiness", link: "/research/SPIKE-03-tenant-readiness" },
            { text: "SPIKE-04 Identity, secrets, security", link: "/research/SPIKE-04-identity-security" },
            { text: "SPIKE-06 Publish-pipeline integration", link: "/research/SPIKE-06-pipeline-integration" },
            { text: "SPIKE-14 Tenant model and region survey", link: "/research/SPIKE-14-tenant-region-survey" },
            { text: "SPIKE-17 Agent MCP gateway governance", link: "/research/SPIKE-17-agent-mcp-gateway-governance" },
          ],
        },
        {
          text: "Cost and governance",
          collapsed: true,
          items: [
            { text: "SPIKE-05 Cost model and governance", link: "/research/SPIKE-05-cost-governance" },
            { text: "SPIKE-26 On-premises cost model", link: "/research/SPIKE-26-local-track-cost-model" },
          ],
        },
        {
          text: "On-premises targets",
          collapsed: true,
          items: [
            { text: "SPIKE-08 Foundry Local (on-device)", link: "/research/SPIKE-08-foundry-local-on-device" },
            { text: "SPIKE-09 AI Foundry on Azure Local", link: "/research/SPIKE-09-azure-local-foundry" },
            { text: "SPIKE-18 Foundry Local on Windows Server", link: "/research/SPIKE-18-foundry-local-windows-server" },
            { text: "SPIKE-19 Foundry Local on Azure Local", link: "/research/SPIKE-19-foundry-local-azure-local-deployment" },
            { text: "SPIKE-22 Foundry Local model catalog", link: "/research/SPIKE-22-foundry-local-model-catalog" },
            { text: "SPIKE-23 Install artifacts and Arc run command", link: "/research/SPIKE-23-foundry-local-install-artifacts-and-run-command" },
            { text: "SPIKE-25 Hardware sizing", link: "/research/SPIKE-25-local-track-hardware-sizing" },
            { text: "SPIKE-28 Azure Local networking, TLS, storage", link: "/research/SPIKE-28-azure-local-networking-storage-certificates" },
            { text: "SPIKE-29 Lifecycle and upgrade", link: "/research/SPIKE-29-local-track-lifecycle-and-upgrade" },
            { text: "SPIKE-31 Cross-target feature parity", link: "/research/SPIKE-31-cross-track-feature-parity" },
          ],
        },
        {
          text: "Observability",
          collapsed: true,
          items: [
            { text: "SPIKE-20 Cost-first observability", link: "/research/SPIKE-20-cost-first-observability" },
            { text: "SPIKE-21 Solution observability", link: "/research/SPIKE-21-solution-observability" },
            { text: "SPIKE-27 On-premises observability", link: "/research/SPIKE-27-local-track-observability" },
          ],
        },
      ],
      "/implementation/": BUILD_SIDEBAR,
    },
    socialLinks: [],
    search: { provider: "local" },
  },
});
