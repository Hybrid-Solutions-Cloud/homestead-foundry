# SPIKE-01: MAI-Image-2.5 image model

Role: foundry-researcher (Opus). Status: research spike complete. No Azure resources created, no spend, no images generated.
Date: 2026-07-11
Scope: independent, first-party verification of the MAI-Image-2.5 image model for illustrated scene art (style matching against existing hand-drawn illustration). Grounds every claim in a Microsoft source, cited inline. Anything Microsoft has not published is marked UNKNOWN.

This spike is written generically so its findings and methodology apply to any Azure AI Foundry image-model build in this repo (`<initiative>`), for any consuming brand (`<brand>`). The concrete first build it was originally run for (real catalog figures, environment, and art style) is preserved in the marked "Worked example" section at the end. Everything above that section is model-general.

Grounding documents read first: `ai/plans/source/mai-image-2-5-art-match.md` and `ai/verification/environment-readiness.md`. This spike confirms, corrects, and deepens those two.

---

## Q1. Model family, versions, and lifecycle

**Question.** Confirm the current deployable MAI-Image-2.5 version and its lifecycle. The environment check saw version `2026-06-02` with an inference deprecation date of `2026-09-01`. What is the version-churn story, how do we avoid hardcoding a version that expires soon, and how do 2.5 vs 2.5-Flash vs 2e compare for illustrated scene-art use?

**Findings.**

- The MAI image family and current deployable versions, all in Preview:

  | Model | Version | Type |
  |---|---|---|
  | `MAI-Image-2.5-Flash` (Preview) | `2026-06-02` | Text-to-image and image-to-image edits |
  | `MAI-Image-2.5` (Preview) | `2026-06-02` | Text-to-image and image-to-image edits |
  | `MAI-Image-2e` (Preview) | `2026-04-09` | Text-to-image only |
  | `MAI-Image-2` (Preview) | `2026-02-20` | Text-to-image only |

  Source: [Deploy and use MAI image models in Microsoft Foundry (preview)](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai). Version `2026-06-02` for MAI-Image-2.5 is confirmed current and matches the CLI catalog entry the environment check found.

- **Lifecycle stages** (Preview, GA, Legacy, Deprecated, Retired). Preview means "Weights, runtime, and API schema might change. Not guaranteed to become GA." You can create and run new deployments in Preview. A Retired model returns `410 Gone` on every inference request. Source: [Microsoft Foundry Models lifecycle and support policy](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirements).

- **Model-level retirement schedule (this is the version-churn story).** The published schedule lists, under Foundry Models sold by Azure > Microsoft:
  - `MAI-Image-2` `2026-02-20`, Preview, retirement `2026-08-15`, replacement `MAI-Image-2.5`.
  - `MAI-Image-2e` `2026-04-09`, Preview, retirement `2026-08-15`, replacement `MAI-Image-2.5-Flash`.
  - **`MAI-Image-2.5` and `MAI-Image-2.5-Flash` are NOT in the retirement schedule at all**, i.e. no published retirement date. They are the current models the older two are being replaced by.

  Source: [Model retirement schedule](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule).

- **Reconciling the `2026-09-01` date the environment check saw.** That date came from the CLI per-version model metadata (`inference` deprecation) for MAI-Image-2.5 version `2026-06-02`, not from the published retirement schedule (which does not list 2.5 for retirement). The most consistent reading: it is a version-level signal (a Preview model periodically ships a newer dated version that supersedes the prior date-stamped one), not a model-level retirement. The exact authority and meaning of that CLI field for MAI is not documented, so treat it as a prompt to re-check the current version at deploy time rather than as a hard model end-of-life. (See UNKNOWN below.)

- **2.5 vs 2.5-Flash vs 2e for illustrated scene art, style matching:**
  - `MAI-Image-2.5`: highest quality; supports both generations and image-to-image edits. Best fit for an art-match pilot.
  - `MAI-Image-2.5-Flash`: same two capabilities (generations plus edits), positioned as "faster" and lower cost; same request parameters. Best fit for cheaper high-volume backfill if 2.5 wins the pilot.
  - `MAI-Image-2e`: text-to-image ONLY (no edits), sold as high-volume and efficient, but it is scheduled to retire `2026-08-15` and is explicitly replaced by 2.5-Flash. It is therefore NOT a viable cost-saving fallback for future bulk runs. This sharpens the source plan, which flagged only the "no edits" gap; 2e is also on its way out.

  Sources: capability descriptions in [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) and [Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure); retirement dates as above.

## Q2. Cost mechanics (the single biggest cost unknown)

**Question.** Token-metered pricing (text input, image input, image output per 1M tokens for 2.5 and Flash). Is tokens-per-generated-image documented anywhere? If not, how do we measure it empirically?

**Findings.**

- **Billing model is first-party confirmed.** Foundry Models are billed for inputs and outputs to the APIs, typically in tokens, billed per 1,000 tokens, with the rate varying per model. There is no charge for the resource itself or for the deployment; you pay only for tokens used. Prices are visible before you deploy a model, and billed usage appears in Microsoft Cost Management + Billing (not in the Foundry portal). A subscription spending limit can be set in Cost Management. Sources: [Foundry Models FAQ](https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq), [Plan and manage costs for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/manage-costs).

- **The specific per-token rates for MAI-Image-2.5 and 2.5-Flash could NOT be verified from a rendered first-party source during this spike.** The live [Foundry Models pricing, Microsoft models page](https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/) rendered a Microsoft table that listed only `MAI-Image-2` and `MAI-Image-2-Efficient` (both retiring `2026-08-15`), with unpopulated values, and did NOT contain the 2.5 family at fetch time (the page is a client-rendered pricing widget). The source plan `mai-image-2-5-art-match.md` cites, for this same page, `$5 / $8 / $47` per 1M tokens (text input / image input / image output) for MAI-Image-2.5 and `$1.75 / $1.75 / $33` for Flash. An independent web search returned the same 2.5 figures but conflicting Flash image-output figures ($33 in one place, $19.50 in another) and is not a first-party source. Net: the billing mechanism is confirmed; the exact numbers are UNCONFIRMED and must be read live in the Foundry portal at deploy time. This spike will not assert a number it could not verify.

- **Tokens per generated image: UNKNOWN, not published anywhere Microsoft-first-party.** The output for a generation is always one PNG, and image workloads are metered in tokens, but Microsoft does not publish a tokens-per-image figure for any MAI image model. The documented generations response sample returns only `data[].b64_json` (the image bytes); the how-to article's sample response does not show a token-usage field. Source: [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai).

- **How to measure it empirically (first pilot task).**
  1. Inspect the full JSON response body of a real generations call for any `usage` or token field (the doc sample omits it, but the live API may return more than the doc shows). If present, that is the direct answer.
  2. If absent, run a fixed micro-batch of N generations at one known size (for example 20 images at 1248x832), then read the delta on the MAI-Image-2.5 output-token meter in Cost Management and divide by N. Repeat at a second size (for example 768x768) to learn whether output tokens scale with pixel count.
  3. Record text-input tokens for the prompts too (prompts in this workload are long; context limit is 32,000 tokens per the docs, so even 400 to 600 token prompts are a rounding error against image-output cost).
  This converts the biggest cost unknown into two real numbers (tokens per image, and cost per image) before any bulk run.

## Q3. Capabilities for style matching

**Question.** Generations vs edits endpoints, image-to-image, style reference, masks/inpainting, identity/character consistency, seeds, negative prompts, candidates per call, style-strength control.

**Findings.**

- **Two endpoints.** Generations `POST /mai/v1/images/generations` (JSON body, text-to-image). Edits `POST /mai/v1/images/edits` (multipart form data, one input JPEG or PNG plus a prompt, image-to-image). MAI-Image-2.5 and 2.5-Flash support both; MAI-Image-2e and 2 support generations only. Source: [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai).

- **Documented request parameters are ONLY** `model`, `prompt` (max 32,000 tokens), `image` (edits only, one image), `width`, `height` (generations only). Source: same page, Request parameters table.

- **What that parameter list rules out (all NOT documented / NOT supported today):**
  - No `seed` parameter (no reproducibility control).
  - No negative-prompt parameter.
  - No `n` / candidate-count parameter. Output is "One image" per call; multiple candidates require multiple calls.
  - No mask parameter. Inpainting is described as an edit *behavior* driven by the prompt, but there is no documented way to supply a mask to constrain the edited region.
  - No dedicated style-reference input (no "generate a new scene in the style of this attached image" mode) and no style-strength control.
  Source: capability text and parameter table in [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) and [Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure).

- **Documented edit capabilities (edits endpoint):** "object removal, replacement, attribute changes, inpainting, text updates, and artifact cleanup while preserving composition and layout." Source: [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai).

- **Identity and character consistency: a marketing/benchmark claim, not an API guarantee.** Microsoft states MAI-Image-2.5 "preserves facial identity across edits, maintaining recognizable likeness even through changes in pose, expression or viewpoint," ranks No. 3 for text-to-image and No. 2 for image editing on Arena, and shows its largest gains over MAI-Image-2 in Text Rendering (+107) and Cartoon, Anime & Fantasy (+90). These are relevant to a stylized, illustrated look, but they are leaderboard and marketing statements, not documented API behavior. Source: [Introducing MAI-Image-2.5](https://microsoft.ai/news/introducing-mai-image-2-5/).

- **Implication for style matching.** With no style-reference input, no seed, no negative prompt, and no mask, the two viable paths are exactly as the source plan proposed: (1) prompt engineering on the generations endpoint (embed the existing style vocabulary and character tokens in every prompt), and (2) the edits endpoint used as a pseudo style-transfer (pass an existing illustration as `image`, prompt to keep the style and change the scene). Path 2 is documented as edit-in-place behavior, so using it to compose a substantially different scene is unproven and is the main thing the pilot must test. Lack of seeds also means outputs are not reproducible, so candidate selection is inherently a human review step.

## Q4. Canvas constraints

**Question.** Confirm the minimum dimension (768) and the maximum width times height (1,048,576) constraints. A build's existing or legacy assets may target a canvas that exceeds the cap. Confirm the limits and recommend valid sizes near a target aspect ratio (near 3:2 for many illustrated-book layouts).

**Findings.**

- **Confirmed constraints.** Both `width` and `height` must be at least 768 pixels each, and `width` x `height` must not exceed 1,048,576 pixels (equivalent to 1024x1024). Either dimension can exceed 1024 as long as the product stays within the cap (the docs give 768x1365 as a valid example). Output is always PNG. Violating these returns `400 Bad Request`. Sources: [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai), [Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure).

- **A legacy target canvas can exceed the cap.** When an existing asset's dimensions put `width` x `height` over 1,048,576 pixels, MAI cannot reproduce that exact canvas; the build must pick the nearest valid size. A concrete measured case is in the Worked example section below.

- **Recommended valid near-3:2 sizes** (all verified by arithmetic against the cap; all are exactly 3:2 unless noted, and both dimensions are at least 768):

  | Size | Pixels | Under cap? | Ratio | Note |
  |---|---|---|---|---|
  | 1254x836 | 1,048,344 | Yes (by 232 px) | 1.500 | Largest exact-3:2 size that fits |
  | 1248x832 | 1,038,336 | Yes | 1.500 | Recommended default; clean 3:2 |
  | 1152x768 | 884,736 | Yes | 1.500 | Smaller 3:2 option (lower cost per image) |
  | 1264x848 | 1,071,872 | No | 1.491 | Example over-cap legacy canvas; cannot be used (see Worked example) |

  Recommendation: standardize on **1248x832** for scene art. It is a clean 3:2, sits comfortably under the cap, and the visual difference from a near-3:2 legacy canvas such as 1264x848 is about 1 to 2 percent scale, imperceptible at display size. An exact drop-in replacement at 1264x848 is impossible because it exceeds the cap.

## Q5. Rate limits and tiers

**Question.** The environment check found Tier 5 (10 RPM) in the target subscription. Confirm the tier ladder and how to request higher throughput for bulk backfill.

**Findings.**

- **Confirmed tier ladder** (Global Standard, Requests Per Minute):

  | Tier | 2.5-Flash | 2.5 | 2e | 2 |
  |---|---|---|---|---|
  | 0 (Free) | 0 | 0 | 0 | 0 |
  | 1 | 2 | 2 | 18 | 9 |
  | 2 | 4 | 4 | 30 | 15 |
  | 3 | 6 | 6 | 60 | 30 |
  | 4 | 8 | 8 | 90 | 45 |
  | 5 | 10 | 10 | 120 | 60 |
  | 6 | 12 | 12 | 180 | 90 |

  Source: [Deploy and use MAI image models, API quotas and limits](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai#api-quotas-and-limits).

- **The environment check is consistent with this ladder.** The target subscription's observed 10 RPM for MAI-Image-2.5 and 2.5-Flash equals Tier 5. That is materially better than a fallback tenant candidate at 2 RPM (Tier 1).

- **Throughput ceiling matters for backfill.** Even at Tier 6, MAI-Image-2.5 and 2.5-Flash cap at 12 RPM. Flash has the SAME RPM as 2.5 (it buys latency and cost, not throughput). A whole-catalog backfill of several hundred scenes at 2 candidates each translates to well under two hours of API time at Tier 5 to 6, spread into per-title batches (worked figures for the first build are below). Only MAI-Image-2e offered high RPM (up to 180), and it is being retired and has no edits, so it is not an option.

- **Requesting more throughput.** Submit the quota increase request form at [aka.ms/oai/stuquotarequest](https://aka.ms/oai/stuquotarequest). Requests are processed in order received, with priority to customers actively using existing quota. Practically: distribute calls evenly (RPM limits are enforced over short sub-minute windows, so bursts trigger `429`), add retry-with-backoff, and if higher parallelism is ever needed, spread across deployments/regions. Sources: [MAI image quotas and limits](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai#api-quotas-and-limits), [Manage quota, distribute traffic evenly](https://learn.microsoft.com/azure/foundry/openai/how-to/quota).

## Q6. Responsible AI for images of minors

**Question.** Does the Azure OpenAI rule that blocks photorealistic images of minors apply to MAI-Image-2.5? Hand-drawn art is a safer category. What RAI policies govern MAI image generation, and what should we watch for with children in every scene?

**Findings.**

- **The "photorealistic minors" rule is documented for Azure OpenAI image models, NOT for MAI.** On the Azure OpenAI image generation page: "Photorealistic images of minors are blocked by default. Customers can request access to this model capability. Enterprise-tier customers are automatically approved." That page governs Azure OpenAI models (DALL-E, GPT-image), which are a different service from MAI. Source: [Azure OpenAI image generation models, Responsible AI and image generation](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#responsible-ai-and-image-generation).

- **The MAI image models RAI section does not mention minors at all.** It states that MAI image models apply data filtering and content classifiers at the system level, and names the common risk areas as violent or gory content, sexual content or nudity, depictions of public figures, and replication of trademarked or protected material. It advises configuring additional content safety, complying with Microsoft's terms and copyright law, disclosing AI-generated content, and avoiding harmful content. There is no MAI-specific "minors blocked by default" statement and no documented request-access path for it. Source: [Deploy and use MAI image models, Responsible AI considerations](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai#responsible-ai-considerations).

- **Hand-drawn art is the safer category.** Even under the Azure OpenAI rule, the restriction targets *photorealistic* minors. Hand-drawn storybook illustration is not photorealistic. Whether MAI enforces any equivalent minors restriction is not documented (see UNKNOWN).

- **What to watch for, children in every scene.**
  - Keep "hand-drawn storybook illustration" (or the build's target style wording) in every prompt, both to hold the style and to stay clearly in the non-photorealistic lane.
  - Expect occasional content-filter refusals and log them; the how-to page says no generative model is immune to adversarial prompts and to add scenario-specific mitigations.
  - Genericize trademarked brand references in character tokens: replace a named-brand garment or prop with a generic descriptive equivalent (describe it by material, cut, and markings rather than by brand). Trademark replication is a named MAI risk area, so this keeps the look without the risk. A concrete substitution used in the first build is in the Worked example section.
  - There is no documented content-safety severity configuration surface specific to the MAI image endpoint (the docs say "configure content safety" only in general terms). Verify at pilot time what filtering controls, if any, are exposed for MAI. There is also no dedicated MAI-Image transparency note published (only an Azure OpenAI transparency note and an Image Analysis transparency note, neither of which covers MAI image generation).

## Q7. Provenance and watermarking

**Question.** Any C2PA or watermark on MAI outputs, and what provenance should we record?

**Findings.**

- **C2PA Content Credentials are documented for Azure OpenAI images, NOT stated for MAI.** All AI-generated images from Azure OpenAI (DALL-E and GPT-image-1) automatically include Content Credentials, a C2PA manifest cryptographically signed by a certificate tracing back to Azure OpenAI, with fields `description` = "AI Generated Image", `softwareAgent` = "Azure OpenAI DALL-E" or "Azure OpenAI ImageGen", and `when` = timestamp, verifiable at contentcredentials.org/verify. This is scoped to Azure OpenAI. Source: [Content Credentials](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/content-credentials).

- **The MAI image how-to page says nothing about C2PA, Content Credentials, or watermarking.** Whether MAI-Image-2.5 outputs carry any C2PA manifest or invisible watermark is UNKNOWN and must be checked empirically (see UNKNOWN). Source: absence in [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai).

- **Provenance to record regardless of what MAI embeds** (this is the durable fix for the "original generator unknown" problem the source plan flagged). For every generated image, write a sidecar record or frontmatter with: generator service (`Azure Microsoft Foundry MAI image`), endpoint used (`/mai/v1/images/generations` or `/edits`), deployment name, model and version (for example `MAI-Image-2.5` `2026-06-02`), UTC timestamp, the exact prompt text, a prompt hash (sha256 of the prompt), the width and height, the source image reference for edits, and a flag that the image is AI-generated. Seed is not available today, so record "seed: none (not supported)". This makes "which model made this art, from what prompt" answerable forever and supports the transparency disclosure the RAI guidance asks for.

---

## What is still UNKNOWN

1. **Exact per-token prices for MAI-Image-2.5 and 2.5-Flash.** Not verifiable from a rendered first-party pricing page during this spike (the page did not show the 2.5 family and did not populate values; secondary sources conflict on Flash image-output rate). Resolve by reading the price shown in the Foundry portal at deploy time, or the Azure pricing page once its Microsoft table lists the 2.5 family.
2. **Tokens per generated image.** Unpublished for all MAI image models. Resolve empirically: inspect the live JSON response for a usage field, else divide a Cost Management output-token meter delta by a fixed-size micro-batch (method in Q2). This is the single largest cost unknown and blocks any accurate per-image or whole-catalog cost figure.
3. **Meaning and authority of the CLI `2026-09-01` inference date for MAI-Image-2.5 `2026-06-02`.** It is not in the published retirement schedule (which does not list 2.5 for retirement). Likely version-level churn for a Preview model, but Microsoft has not documented what that CLI field commits to. Resolve by re-querying `az cognitiveservices model list --location eastus` at deploy time and after `2026-09-01`.
4. **Whether any minors restriction is enforced on MAI image models.** No MAI-specific policy is published; the photorealistic-minors rule is documented only for Azure OpenAI. Resolve at pilot time by observing filter behavior on illustrated, child-present prompts.
5. **Whether MAI outputs carry C2PA Content Credentials or any watermark.** Documented only for Azure OpenAI. Resolve empirically by inspecting a generated PNG at contentcredentials.org/verify, with the CAI/c2patool, and by reading PNG metadata chunks.
6. **Style-match quality on the specific target illustrated style.** The Cartoon/Anime/Fantasy strength is an Arena and marketing claim, not a demonstration on any one style. Only the pilot resolves this.
7. **What content-safety configuration surface (if any) exists for the MAI image endpoint.** The docs say "configure content safety" without naming a control plane for MAI image. Resolve at pilot time.

## Recommendation

1. **Proceed with the pilot on MAI-Image-2.5** (version confirmed current, `2026-06-02`, Preview) in whatever subscription and region the environment check has cleared, ideally one at Tier 5 (10 RPM) or better. Do not deploy MAI-Image-2e (retiring `2026-08-15`, no edits) and treat MAI-Image-2.5-Flash as the future cheaper-backfill arm only after 2.5 wins the style test.
2. **Do not hardcode the version.** At deploy time, re-query the model catalog and deploy the then-current MAI-Image-2.5 version; because it is Preview, plan to re-verify (and possibly redeploy) when a newer dated version appears, and specifically re-check around and after `2026-09-01`.
3. **Make the first two pilot calls a cost probe.** Read tokens-per-image from the live response and/or Cost Management before any batch, and set a Cost Management budget alert on the resource group before spend starts. Do not rely on the unverified per-token rates; read them live in the portal first.
4. **Standardize scene art on 1248x832** (clean 3:2, under the 1,048,576 cap), or the nearest valid size to the build's target canvas. Accept that any legacy canvas over the cap cannot be reproduced exactly.
5. **Style matching: prompt-engineering arm first, edits-as-pseudo-style-reference arm second.** There is no style-reference, seed, negative-prompt, or mask parameter, so bake the style vocabulary and character tokens into every prompt and treat candidate selection as a human review step.
6. **RAI: keep every prompt explicitly hand-drawn/illustrated, genericize trademarked brands, and log any refusals.** Non-photorealistic art is the safer category, but no MAI-specific minors policy is published, so watch filter behavior on child-present scenes during the pilot.
7. **Record a provenance sidecar for every image** (generator, endpoint, deployment, model, version, timestamp, prompt, prompt hash, size, seed=none), independent of whether MAI embeds C2PA. Separately, verify empirically whether MAI outputs carry Content Credentials.

## Sources

- Deploy and use MAI image models in Microsoft Foundry (preview): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Foundry Models sold by Azure (capability table, canvas rule, 768x1365 example): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Microsoft Foundry Models lifecycle and support policy (Preview/GA/Deprecated/Retired, 410 Gone): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirements>
- Model retirement schedule (MAI-Image-2 and 2e retiring 2026-08-15; 2.5 not scheduled): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule>
- Foundry Models FAQ (token billing, no resource/deployment cost, spending limit): <https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq>
- Plan and manage costs for Microsoft Foundry (token metering, Cost Management): <https://learn.microsoft.com/azure/foundry/concepts/manage-costs>
- Foundry Models pricing, Microsoft models (values did not render for the 2.5 family at fetch time): <https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/>
- Manage Azure OpenAI quota (even distribution, 429 on bursts): <https://learn.microsoft.com/azure/foundry/openai/how-to/quota>
- Azure OpenAI image generation models, Responsible AI (photorealistic minors blocked by default, Azure OpenAI only): <https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e#responsible-ai-and-image-generation>
- Content Credentials (C2PA, Azure OpenAI images only): <https://learn.microsoft.com/azure/ai-foundry/openai/concepts/content-credentials>
- Introducing MAI-Image-2.5 (Arena ranks, identity consistency, +90 Cartoon/Anime/Fantasy): <https://microsoft.ai/news/introducing-mai-image-2-5/>

---

&lt;!-- safety-scan-worked-example:start -->
## Worked example: Brand A / Brand B

This section carries the real, concrete application this spike's recommendation was first run against: the Azure AI Foundry media backbone serving the Brand A and Brand B reader apps, a sensitive-audience catalog. Everything above is model-general; the figures below are specific to that first build.

**Environment (Q5).** The environment check cleared the MVP credit subscription (a Tier-5 / MVP-tier subscription) in East US, which sits at Tier 5 (10 RPM) for both MAI-Image-2.5 and 2.5-Flash. The alternative candidate, the Azure Local fallback tenant, was only at Tier 1 (2 RPM), so the MVP credit subscription was preferred.

**Catalog and throughput (Q5).** The source plan's whole-catalog estimate is roughly 340 scenes at 2 candidates each (about 680 calls). At 10 RPM that is about 68 minutes of API time; at 12 RPM about 57 minutes, spread into per-story batches.

**Canvas (Q4).** The existing covers are 1264x848 = 1,071,872 pixels, which is 23,296 pixels over the 1,048,576 cap, so MAI cannot reproduce that exact canvas. This was independently verified by reading the PNG header of a cover image in Brand A's reader-app repo (1264x848, 1,071,872 px). The build standardized on 1248x832 (clean 3:2, under the cap); the exact 1264x848 original cannot be a drop-in replacement.

**Art style (Q3, Q6).** The target look is a stylized graphite / colored-pencil, hand-drawn storybook illustration (graphite crosshatch). Every prompt keeps that style wording to hold the look and to stay clearly in the non-photorealistic lane for scenes with children present.

**Trademark genericization (Q6).** A character wore a named apparel brand's overalls. To avoid trademark replication (a named MAI risk area), the character token was rewritten as "denim bib overalls with a red rectangular chest patch," which keeps the look without the brand reference.

**Pricing figures applied (Q2).** The source plan `mai-image-2-5-art-match.md` carried, for this build, `$5 / $8 / $47` per 1M tokens (text input / image input / image output) for MAI-Image-2.5 and `$1.75 / $1.75 / $33` for Flash. These remain UNVERIFIED against a rendered first-party page and must be read live in the Foundry portal at deploy time.

Worked-example source (local, independently verified): a cover image in Brand A's reader-app repo, PNG header = 1264x848 (1,071,872 px), over the cap.
&lt;!-- safety-scan-worked-example:end -->
