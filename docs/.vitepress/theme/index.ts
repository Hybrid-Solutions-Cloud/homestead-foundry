// The site had no custom theme until the model matrix needed an interactive
// component. This extends the stock VitePress theme rather than replacing it:
// every existing page renders exactly as before, and one global component is
// added for the pages that use it.
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import ModelMatrix from "./components/ModelMatrix.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ModelMatrix", ModelMatrix);
  },
} satisfies Theme;
