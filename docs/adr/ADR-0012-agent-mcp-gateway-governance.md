# ADR-0012: Agent MCP tool governance via an APIM AI gateway (gated to the agent phase)

- Status: Proposed
- Date: 2026-07-24

This ADR records the decision to adopt the Microsoft Foundry "Govern MCP tools by
using an AI gateway (preview)" feature as the governance control for Foundry Agent
Model Context Protocol (MCP) tools, GATED to a future agent phase: provision the
Azure API Management (APIM) AI gateway and route agent MCP tools through it only
once the platform actually runs Foundry Agents that call MCP tools, and provision
nothing now. It is grounded entirely in
`docs/research/SPIKE-17-agent-mcp-gateway-governance.md`; where that spike logged an
UNKNOWN, this ADR carries it forward rather than resolving it.

This ADR authorizes **no deployment** and **no spend**. It records that the control
is the right one and under what precondition it is adopted, gated the same way every
other decision in this backlog is: spike, then ADR, then design, then a gated
deploy.

## Context

SPIKE-17 (`docs/research/SPIKE-17-agent-mcp-gateway-governance.md`) independently
verified, against Microsoft first-party sources, what the Foundry Agent MCP tool AI
gateway does, what it requires, what it costs and constrains, and whether it applies
to this repo's current deployment. The forces this decision must reconcile, all from
SPIKE-17:

- **The feature governs agent-to-tool MCP traffic, and nothing else.** It routes the
  MCP traffic that Foundry AGENTS make to their TOOLS through an APIM AI gateway,
  giving one governed entry point for authentication, rate limiting, IP filtering,
  and gateway-traffic audit, without changing the MCP servers or the agent code. It
  is not a content-safety filter on generated media, and it does not front direct
  REST/SDK calls to model deployments unless the same APIM gateway is separately
  configured for the model layer.
- **The live build has no agents and no agent MCP tools.** The proven deployment is
  the `aif-<workload>-<env>-<region>-01` AIServices (Foundry) account hosting the
  model deployments (image, voice, and reasoning) plus a Foundry project, reached
  DIRECTLY over REST/SDK by the publish pipeline (ADR-0005, ADR-0008). There are
  currently NO Foundry Agents and NO MCP tools wired into any agent, so the feature
  has an empty workload today: there is nothing for it to route.
- **Adopting it now means a standing, paid dependency for zero routed calls.**
  Governance is enabled at the Foundry-resource level and requires an APIM instance
  connected to the resource. The Foundry-portal path provisions a Basic v2 APIM SKU
  by default; production or higher throughput is steered to Standard v2 or Premium
  v2. APIM v2 tiers bill on an hourly gateway-unit basis, so the instance costs money
  whenever it exists, and deleting the gateway is a deliberate two-step teardown
  (remove from the Foundry resource, then delete the APIM instance) that disabling a
  project alone does not accomplish. Standing this up now would govern zero tool
  calls at a real monthly cost.
- **It is a genuine WAF Security and Operational Excellence gain in an agent phase.**
  When reasoning or reviewer LLMs are orchestrated as Foundry Agents that call MCP
  tools, the gateway gives one place to enforce Entra or key authentication, throttle
  by key, restrict source IPs, and audit gateway traffic, without touching the MCP
  servers or agent code. That is exactly the CAF/WAF discipline this repo applies to
  every Azure design, and it is where the standing APIM cost finally pays for
  something.
- **The repo runs its own MCP server.** This repo is governed by the HCS Governance
  MCP (`.mcp.json`). If a future agent phase orchestrates reviewer LLMs as Foundry
  Agents that call that MCP server (or other MCP tools), this feature is the
  first-party way to put a governed entry point in front of that traffic.
- **Preview risk is already an accepted posture.** The feature is in preview with no
  published GA date. The owner has already accepted preview-no-SLA risk for the cloud
  MAI models and the Arc and Azure Local tracks (ADR-0009, ADR-0011), so the same
  accepted-risk posture carries forward rather than being re-litigated here.
- **Real, documented limitations bound what it can be relied on for.** MCP tools only
  (not SharePoint, OpenAPI, managed-OAuth, or code-first MCP tools); routing applied
  only at tool-creation time (existing tools are not retrofitted); APIM policies
  authored only in the Azure portal, not the Foundry portal; and the gateway does not
  log tool traces (only gateway traffic). These are inherited from SPIKE-17 and shape
  the consequences below.

## Decision

**Adopt the APIM AI gateway as the governance control for Foundry Agent MCP tools,
GATED to the agent phase. Provision the gateway and route agent MCP tools through it
only once the platform actually runs Foundry Agents that call MCP tools. Do NOT
provision APIM now, because there are no agents and no agent MCP tools to govern and
APIM is a standing cost. This ADR provisions nothing and authorizes no spend.**

1. **No gateway now.** The current model-deployment backbone is reached by direct
   REST/SDK and has no Foundry Agents and no agent-attached MCP tools, so no APIM AI
   gateway is provisioned. This is closed by SPIKE-17's finding that the feature has
   an empty workload on the current deployment.
2. **The gate is the agent phase.** The gateway is adopted when, and only when, this
   platform enters a phase in which reasoning or reviewer LLMs (for example the
   planned `gpt-5.6-terra` / `grok-4-1-fast-reasoning` pair, or the code and document
   reviewers surveyed in SPIKE-15 such as `Kimi-K2.7-Code` and `DeepSeek-V4-Pro`) are
   orchestrated as Foundry Agents that call MCP tools, including this repo's own HCS
   Governance MCP. Until then it stays a recorded, gated decision, not a deployment.
3. **When adopted, authentication is Microsoft Entra (managed identity) first, per
   ADR-0005.** For gateway-eligible MCP servers, prefer the Entra agent-identity or
   project-managed-identity path to keep the platform keyless with built-in token
   rotation. Fall back to key-based auth stored in a Foundry project connection (never
   in git, values only in the vault or the connection store) only where an MCP server
   cannot do Entra. Managed-OAuth tools are not gateway-eligible and are excluded by
   design; a custom MCP server such as this repo's own uses Entra managed identity or
   custom OAuth with its own app-registration audience, not managed-OAuth passthrough
   of a Microsoft token.
4. **When adopted, the gateway governs tool ACCESS, not generated-content safety.**
   ADR-0007's model-layer guardrails remain the controlling decision for
   children's-content and sensitive-audience safety. The gateway complements that by
   constraining which tools an agent can reach and by auditing gateway traffic, but it
   does not filter model output and is not a substitute for the content-safety
   posture.
5. **CAF / WAF discipline applies, unchanged.** The APIM instance and its connection
   follow this repo's CAF naming pattern
   `<resource-type-abbreviation>-<workload>-<env>-<region>-<instance>` (example only,
   not a provisioning instruction: an APIM AI gateway `apim-foundryagent-prod-eus-01`
   connected to the `aif-<workload>-<env>-<region>-01` Foundry resource in the same
   tenant and subscription), pass a five-pillar WAF review, and get a registry or
   parameter entry once the agent-phase deployment automation exists. The role to
   manage the policies is API Management Service Contributor (or Owner) on the APIM
   instance, granted least-privilege to the operator identity; enabling the gateway in
   the Foundry portal needs a Foundry Account Owner or Foundry Owner role on the
   Foundry resource. Any MCP server key remains a secret referenced by name only,
   stored in the project connection or the platform Key Vault, never committed.
6. **Standard gate, no live deploy from this ADR.** If pursued, a follow-up design doc
   and a separately gated deployment are required. This ADR is a decision record only;
   it authorizes no provisioning, no preview enrollment, and no spend.

## Consequences

**Positive.**
- Records a real, first-party-verified governance control for the agent phase (one
  governed entry point for auth, rate limiting, IP filtering, and gateway-traffic
  audit) without paying for a standing APIM instance to govern zero tool calls today.
- Keeps the CAF / WAF governance model intact: when adopted, the gateway is the WAF
  Security and Operational Excellence control for agent-to-tool MCP traffic, on a
  managed-identity-first footing consistent with ADR-0005.
- Puts a governed entry point in front of this repo's own HCS Governance MCP if it is
  ever wired to an agent, so the repo's own MCP usage inherits the same discipline.
- Leaves content safety exactly where ADR-0007 placed it, avoiding the trap of
  treating a tool-access gateway as a content-safety control.

**Negative / trade-offs.**
- When adopted, the APIM AI gateway is a standing, paid dependency (Basic v2 by
  default, Standard v2 or Premium v2 for production) billed whenever it exists, and it
  must be deliberately torn down to stop the charge.
- Preview churn: the feature is preview with no GA date, so any production reliance
  waits on GA or an explicit accepted-preview-risk decision at adoption time.
- It governs MCP tools only. SharePoint, OpenAPI, managed-OAuth, and code-first MCP
  tools are out of scope, so an agent phase that uses those tool types needs a
  different or additional control.
- Routing is applied only at tool-creation time and policies are authored only in the
  Azure portal (a second control surface and skill set), and the gateway does not log
  tool traces (only gateway traffic), so tool-level audit still depends on the MCP
  server's own logs.

**Not yet decided (UNKNOWNs carried from SPIKE-17).**
- **Preview-to-GA timeline and SLA.** No GA date is published for MCP tool governance
  via AI gateway.
- **Exact free-tier limits and v2 SKU cost.** The Foundry doc names a free tier and a
  Basic v2 default but does not enumerate limits or price; confirm against the live
  APIM pricing page and the Azure pricing calculator, and confirm credit coverage in
  Cost Management on the target subscription, at agent-phase design time.
- **Tool-authoring path.** Whether the future agents use portal-created MCP tools at
  all (code-first MCP tools are out of scope for gateway routing) is a design-time
  decision; if tools are created code-first or use managed OAuth, the gateway does not
  apply and an alternative control is needed.
- **HCS Governance MCP server auth.** Whether this repo's own MCP server supports one
  of the four gateway-eligible auth methods (managed identity, key, custom OAuth, or
  unauthenticated) in the shape the gateway requires must be confirmed before wiring
  it to an agent behind the gateway.

**Follow-ups.**
- If and when the agent phase begins, write the design doc that provisions the APIM AI
  gateway (CAF-named, managed-identity-first), resolves the cost and free-tier UNKNOWN,
  settles the tool-authoring path, and confirms the HCS Governance MCP server's auth
  method, then a separately gated deployment.
- Revisit at GA to convert the accepted-preview-risk posture into a steady-state
  reliance decision.

## Alternatives considered

- **Adopt the AI gateway now (option a).** Rejected. The current deployment is a
  direct-REST model-deployment backbone with no Foundry Agents and no agent-attached
  MCP tools, so the gateway would govern zero tool calls while incurring a standing,
  paid APIM cost and a deliberate teardown obligation. Provisioning a governance
  control for a workload that does not exist yet is cost with no benefit.
- **Adopt the AI gateway gated to the agent phase (option b).** CHOSEN. It records the
  right first-party control and its managed-identity-first, CAF/WAF footing, without
  paying for it before there is agent MCP traffic to govern, and it composes cleanly
  behind the agent phase the reviewer models (SPIKE-15, the roster pair) point toward.
- **Reject the AI gateway outright (option c).** Rejected. The feature is a genuine,
  first-party WAF Security and Operational Excellence control for exactly the
  agent-to-tool MCP traffic a future agent phase will produce, including in front of
  this repo's own HCS Governance MCP, so rejecting it would leave a real governance gap
  in that phase. The correct answer is to gate, not to reject.
- **Treat the gateway as the content-safety control for the sensitive audience.**
  Rejected. The MCP tool gateway governs tool access (auth, throttle, IP, audit), not
  generated-content safety; ADR-0007's model-layer guardrails remain the controlling
  safety decision, and conflating the two would weaken both.
- **Authorize a preview enrollment or a deployment from this ADR.** Rejected. This
  repo's discipline is spike, then ADR, then design, then a gated deploy. This ADR
  records the decision and its gate only; it provisions nothing and authorizes no
  spend.

## Sources

- `docs/research/SPIKE-17-agent-mcp-gateway-governance.md` (the feature and the exact
  surface it governs, the APIM prerequisite and resource-level enablement, the four
  eligible MCP auth methods, the cost and complexity, the preview limitations, the
  applicability verdict, and all four carried UNKNOWNs; this ADR adds no facts beyond
  it)
- `docs/adr/ADR-0005-identity-and-secrets.md` (the governing identity ADR: managed
  identity over service principal, secrets by name only; this ADR's Entra-first MCP
  auth stance applies it)
- `docs/adr/ADR-0007-content-safety-and-responsible-ai.md` (the model-layer safety
  posture that remains controlling for children's content; the gateway does not
  replace it)
- `docs/adr/ADR-0008-publish-pipeline-integration.md` (the direct-REST publish
  pipeline that reaches the model deployments today, with no agents in the loop)
- `docs/adr/ADR-0009-azure-local-reviewer-track.md` and
  `docs/adr/ADR-0011-multi-target-deployment-automation.md` (the reviewer and
  multi-target tracks the agent phase draws on, and the accepted preview-risk posture
  matched here; ADR house style matched here)
- `docs/research/SPIKE-15-niche-reviewer-models.md` (the reviewer-model candidates
  that would front an agent phase this gateway then governs)
- the model roster (the planned reasoning and reviewer LLMs `gpt-5.6-terra` and
  `grok-4-1-fast-reasoning`)
- `.mcp.json` (this repo's own HCS Governance MCP server, a candidate tool behind the
  gateway in an agent phase)
- Govern MCP tools by using an AI gateway (preview): the feature, the APIM dependency,
  the four eligible auth methods, and the limitations:
  <https://learn.microsoft.com/azure/foundry/agents/how-to/tools/governance>
- Configure AI Gateway in your Foundry resources (resource-level enablement, Basic v2
  default SKU, existing-instance and role requirements, the standing-cost and teardown
  behavior):
  <https://learn.microsoft.com/azure/foundry/configuration/enable-ai-api-management-gateway-portal>
- Set up authentication for Model Context Protocol (MCP) tools (Entra managed identity,
  key-based, OAuth passthrough, unauthenticated; the untrusted-audience block on
  managed-OAuth Microsoft tokens):
  <https://learn.microsoft.com/azure/foundry/agents/how-to/mcp-authentication>
- Use role-based access control in Azure API Management (API Management Service
  Contributor / Owner):
  <https://learn.microsoft.com/azure/api-management/api-management-role-based-access-control>
- Azure API Management pricing (the standing-cost basis and free-tier eligibility to
  confirm at design time): <https://azure.microsoft.com/pricing/details/api-management/>
