<script setup lang="ts">
import MermaidDiagram from "./MermaidDiagram.vue";

const diagram = `flowchart TB
  start([1. Start here]) --> prereqs[2. Confirm prerequisites]

  subgraph plan[Plan the environment]
    direction LR
    prereqs --> region[3. Choose one region]
    region --> registry[4. Create your registry]
    registry --> catalog[5. Resolve the live catalog]
    catalog --> modelsReady{Every deployed model available?}
    modelsReady -- No --> adjust[Adjust the roster or region]
    adjust --> catalog
  end

  subgraph build[Build and prove it]
    direction LR
    modelsReady -- Yes --> access[6. Create Entra access groups]
    access --> parameters[7. Complete private parameters]
    parameters --> preview[8. Build and run what-if]
    preview --> expected{Only expected changes?}
    expected -- No --> correct[Correct the configuration]
    correct --> preview
    expected -- Yes --> deploy[9. Approve and deploy]
    deploy --> smoke[10. Smoke test image, reasoning, and speech]
    smoke --> works{All three paths work?}
    works -- No --> fix[Use the troubleshooting guide]
    fix --> smoke
  end

  works -- Yes --> ready([Your Foundry environment is ready])

  subgraph use[Choose what to do next]
    direction LR
    ready --> api[Make direct model calls]
    ready --> tools[Connect editors and tools]
    ready --> agents[Build an agent]
  end

  click prereqs "./deployment#before-you-start" "Read prerequisites"
  click registry "./model-registry" "Configure the model registry"
  click catalog "./deployment#3-generate-the-model-catalog" "Generate the live model catalog"
  click parameters "./deployment#4-fill-in-your-parameters" "Configure Bicep parameters"
  click preview "./deployment#5-preview-then-deploy" "Preview the deployment"
  click smoke "./deployment#6-verify" "Verify the deployment"
  click fix "./using-your-deployment#troubleshooting" "Troubleshoot a call"
  click api "./using-your-deployment" "Make direct model calls"
  click tools "./connect-your-tools" "Connect your tools"
  click agents "./building-agents" "Build agents"

  classDef decision fill:#fff3cd,stroke:#a87900,color:#312000
  classDef complete fill:#d1e7dd,stroke:#146c43,color:#0a3622
  class modelsReady,expected,works decision
  class ready complete`;
</script>

<template>
  <MermaidDiagram :code="diagram" />
</template>
