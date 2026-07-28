import DefaultTheme from "vitepress/theme";
import MermaidDiagram from "./components/MermaidDiagram.vue";
import OnboardingMap from "./components/OnboardingMap.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("MermaidDiagram", MermaidDiagram);
    app.component("OnboardingMap", OnboardingMap);
  },
};
