# Methodology

Every capability this repo adds to an Azure AI Foundry build moves through the same seven-stage, phase-gated pipeline. No stage starts before the one before it has landed, and each stage is owned by a specific role in the agent roster.

1. **Research spike** (`docs/research/SPIKE-NN-*.md`). Answers a specific question - which model, which region, which identity pattern - grounding every factual claim in a first-party Microsoft Learn source or a named vendor's own documentation. Anything unverifiable is marked UNKNOWN rather than guessed. A spike's recommendation is either "adopt, here is why" or an evidence-backed "not yet, here is why not" - both are acceptable outcomes.
2. **Architecture Decision Record** (`docs/adr/ADR-NNNN-*.md`). Turns a spike's recommendation into a locked decision: Context, Decision, Consequences, Alternatives considered, Sources. An ADR traces back to the spike(s) that justify it and records who decided and when, so the reasoning survives long after the moment it was made.
3. **Design doc** (`docs/design/*.md`). Describes the whole solution end to end in text, built only from what the ADRs already decided - where an ADR is silent, the design doc calls out the gap rather than filling it in silently. Each design doc maps its choices back to the Well-Architected Framework's five pillars (Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency).
4. **Diagram** (Lucid, indexed in `docs/design/diagrams.md`). Visualizes what the design docs already decided; no diagram is drawn before its source design doc exists.
5. **Implementation guide and Bicep** (`docs/implementation/`, `infra/`). Turns the design into parameterized infrastructure-as-code. Every resource-creating step is gated behind explicit confirmation before anything runs against a real subscription.
6. **Gated deploy.** Azure writes never happen automatically. A human confirms every resource-creating call in the moment, regardless of what a plan or roadmap says.
7. **Verification.** A read-only smoke test confirms the deployed resources actually work as designed before the phase is considered closed.

## Why the order matters

Skipping a stage (writing Bicep before the ADR that should justify its shape, for example) is exactly how undocumented, unreviewable infrastructure accumulates. Enforcing the order means every resource name, every model choice, and every cost control this repo has ever shipped has a paper trail back to the evidence that justified it.

## CAF and WAF, enforced not just documented

Cloud Adoption Framework naming and Well-Architected Framework pillar coverage are not a checklist filled in after the fact. A CAF-naming-lint check runs in CI against every design doc and ADR; a WAF-pillar mapping is required content in every design doc; and the safety scan that gates every commit blocks on malformed resource names in addition to blocking on leaked identity, brand, and secret content.

## Genericized by design

Every research spike, ADR, and design doc in this repo states its methodology generically first - so the same pattern applies to any Azure AI Foundry build, not just the one this repo was first built for - then closes with a "Worked example" section showing the real, deployed instance as proof the pattern holds up in production. The two are kept structurally separate: read the main body for the reusable pattern, read the worked example for concrete evidence it works.
