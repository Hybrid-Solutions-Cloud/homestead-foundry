import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Homestead Foundry",
  description: "A knowledge and automation center for building on Azure AI Foundry.",
  // GitHub Pages serves a project site under /<repo-name>/, a custom domain serves it at the root.
  base: process.env.GITHUB_PAGES_BASE ?? "/",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/adr-index" },
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
      "/reference/": [
        {
          text: "Reference",
          items: [{ text: "ADR index", link: "/reference/adr-index" }],
        },
      ],
    },
    socialLinks: [],
    search: { provider: "local" },
  },
});
