<script setup lang="ts">
import MermaidDiagram from "./MermaidDiagram.vue";

const diagram = `
flowchart TD
  start([Start here]) --> prereqs[Read the deployment prerequisites\\nAzure subscription, Azure CLI, existing Key Vault, Node.js]
  prereqs --> region[Choose one Azure region\\nCheck the live model catalog for that region]
  region --> roster[Copy models/registry.starter.json\\nCreate your own registry file]
  roster --> choose[Keep only the models you need\\nMark candidates as deployed, planned, or rejected]
  choose --> catalog[Generate a model catalog from your subscription\\nThis resolves current names and versions]
  catalog --> available{Every deployed model\\navailable in that region?}
  available -- No --> revise[Revise the registry, change status to planned,\\nor choose a different region]
  revise --> catalog
  available -- Yes --> access[Create image-users and speech-users\\nEntra security groups]
  access --> params[Copy and complete the private Bicep parameters\\nNames, group IDs, Key Vault, budget, alert email]
  params --> build[Compile the Bicep]
  build --> preview[Run what-if and inspect every change]
  preview --> safe{Only expected\\nchanges?}
  safe -- No --> correct[Correct the parameters, registry, or infrastructure]
  correct --> preview
  safe -- Yes --> deploy[Human-approved deployment\\nCreate account, project, model deployments, RBAC, and budget]
  deploy --> verify[Verify deployment state and make one real\\nimage, reasoning, and speech smoke-test call]
  verify --> works{Did the smoke test\\nwork?}
  works -- No --> troubleshoot[Use endpoint, authentication, model-name,\\nand role-assignment troubleshooting]
  troubleshoot --> verify
  works -- Yes --> ready([Your Foundry environment is ready])

  ready --> direct[Call models directly\\ncurl, PowerShell, Python, JavaScript, or C#]
  ready --> tools[Connect an existing tool\\nVS Code, Continue, Cursor, Cline, Roo, or a web UI]
  ready --> agents[Build agents\\nFoundry Agent Service or your own runtime]
  direct --> operate[Observe usage and cost\\nKeep capacity low while learning]
  tools --> operate
  agents --> operate

  click prereqs "./deployment#before-you-start" "Read prerequisites"
  click roster "./model-registry" "Configure the model registry"
  click catalog "./deployment#3-generate-the-model-catalog" "Generate the live model catalog"
  click params "./deployment#4-fill-in-your-parameters" "Configure Bicep parameters"
  click preview "./deployment#5-preview-then-deploy" "Preview the deployment"
  click verify "./deployment#6-verify" "Verify the deployment"
  click troubleshoot "./using-your-deployment#troubleshooting" "Troubleshoot a call"
  click direct "./using-your-deployment" "Make direct model calls"
  click tools "./connect-your-tools" "Connect your tools"
  click agents "./building-agents" "Build agents"

  classDef decision fill:#fff3cd,stroke:#a87900,color:#312000
  classDef success fill:#d1e7dd,stroke:#146c43,color:#0a3622
  class available,safe,works decision
  class ready success
`.trim();
</script>

<template>
  <MermaidDiagram :code="diagram" />
</template>
