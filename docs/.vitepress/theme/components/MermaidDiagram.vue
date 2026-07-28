<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";

const props = defineProps<{ code: string }>();
const container = ref<HTMLElement>();

onMounted(async () => {
  const mermaid = (await import("mermaid")).default;
  const id = `mermaid-${crypto.randomUUID()}`;

  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    flowchart: { useMaxWidth: true, htmlLabels: true },
  });

  const { svg, bindFunctions } = await mermaid.render(id, props.code);
  await nextTick();

  if (container.value) {
    container.value.innerHTML = svg;
    bindFunctions?.(container.value);
  }
});
</script>

<template>
  <div ref="container" class="mermaid-diagram" aria-label="Process diagram" />
</template>

<style scoped>
.mermaid-diagram {
  overflow-x: auto;
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.mermaid-diagram :deep(svg) {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
</style>
