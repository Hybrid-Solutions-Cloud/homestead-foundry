# MAI-Image-2.5 art-match research and pilot plan

Status: research complete, pilot NOT started. No Azure resources created, no spend, no images generated.
Date: 2026-07-11
Scope: research and plan only. Every claim below is cited; anything Microsoft has not documented is marked UNKNOWN.

This plan evaluates whether Microsoft's MAI-Image-2.5 first-party image model can match an existing hand-drawn illustration style closely enough to (re)generate scene art for an `<initiative>`'s `<brand>` catalog, and captures the provisioning, cost, and risk detail for doing so on Azure AI Foundry. The methodology is written to apply to any Azure AI Foundry image-model build in this repo: an existing body of stylized art, a set of self-contained prompts, and a need to regenerate or extend that art on Foundry-hosted models. The concrete build this plan was first written for and applied to is preserved in the Worked example appendix at the end.

---

## 1. What the model is

**MAI-Image-2.5 exists by that exact name.** It is a Microsoft AI (MAI) first-party image model, in **preview**, sold as part of "Microsoft Foundry Models sold by Azure" and deployed through a Microsoft Foundry (Azure AI Foundry) resource. The current MAI image family:

| Model | Version | Capabilities |
|---|---|---|
| MAI-Image-2.5 (Preview) | 2026-06-02 | Text-to-image generation AND image-to-image edits |
| MAI-Image-2.5-Flash (Preview) | 2026-06-02 | Text-to-image generation AND image-to-image edits (faster, cheaper) |
| MAI-Image-2e (Preview) | 2026-04-09 | Text-to-image only (high volume, up to 22% faster and 4x more efficient than MAI-Image-2) |
| MAI-Image-2 (Preview) | 2026-02-20 | Text-to-image only |

Source: [Deploy and use MAI image models in Microsoft Foundry (preview)](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai)

Positioning: Microsoft reports MAI-Image-2.5 debuted at #3 on the Arena.ai text-to-image leaderboard and #2 on image editing, with a +90 ELO gain on "cartoon, anime, and fantasy" styles over MAI-Image-2. Stylized illustration is an explicitly claimed strength, which is directly relevant to hand-drawn graphite and colored-pencil styles like the one in the Worked example.
Source: [microsoft.ai: MAI-Image-2.5 launches at No. 2 for image editing on Arena](https://microsoft.ai/news/introducing-mai-image-2-5/)

## 2. How it is accessed

- **Not serverless-by-default and not an Azure OpenAI deployment.** It is a Foundry model deployment on a Microsoft Foundry (AI Services) resource: **Global Standard** deployment type, model format `Microsoft`.
- **Supported regions (Global Standard):** West Central US, East US, West US, West Europe, Sweden Central, South India, UAE North.
- **Roles:** Cognitive Services Contributor on the Foundry resource to deploy.
- **Endpoints** (Microsoft-managed, on your resource):
  - Generations: `https://<resource-name>.services.ai.azure.com/mai/v1/images/generations` (JSON body)
  - Edits: `https://<resource-name>.services.ai.azure.com/mai/v1/images/edits` (multipart form data)
- **Auth:** Entra ID bearer token (scope `https://cognitiveservices.azure.com/.default`) or resource API key.
- **Request parameters (the complete documented set):** `model` (deployment name), `prompt` (max context 32,000 tokens, so very long prompts are fine), `image` (edits only, one JPEG or PNG), `width` and `height` (generations only; each must be at least 768; width x height must not exceed 1,048,576 pixels). Output is always one PNG.
- **Rate limits:** at the default paid tier (Tier 1), MAI-Image-2.5 and 2.5-Flash are limited to **2 requests per minute** (up to 12 RPM at Tier 6; MAI-Image-2e goes 18 to 180 RPM). Fine for a pilot, slow for bulk regeneration.

Source for all of the above: [Deploy and use MAI image models in Microsoft Foundry (preview)](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai) and [Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure)

## 3. Can it match an existing art style?

### What is documented

- **Image-to-image IS supported** (MAI-Image-2.5 and 2.5-Flash only) via the edits endpoint: one input image plus a text prompt. Documented edit capabilities: "object removal, replacement, attribute changes, inpainting, text updates, and artifact cleanup while preserving composition and layout."
  Source: [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai)
- Microsoft's launch material claims "identity and character consistency across stylization, pose, and layout" and says the model "preserves recognizable faces (plus hair, clothing, full-body identity) across stylization, pose, and layout changes," plus full-frame restyling (anime, color grading, film grain).
  Sources: [Foundry Labs: MAI-Image-2.5](https://labs.ai.azure.com/innovations/mai-image-2-5/), [microsoft.ai announcement](https://microsoft.ai/news/introducing-mai-image-2-5/)

### What is NOT documented (UNKNOWN)

- A dedicated **style-reference mode** ("generate a brand-new scene in the style of this attached image") is not a documented API feature. The edits API is framed as editing the supplied image, not as a style adapter for fresh compositions.
- No documented support for: multiple reference images per call, masks, seeds, negative prompts, an `n` (multiple candidates) parameter, or a style strength parameter. The documented parameter list is only `model`, `prompt`, `image`, `width`, `height`.
- Tokens consumed per generated image (needed for exact per-image cost) are not published.

### Verdict

Two viable paths to style match, in order of confidence:

1. **Prompt engineering (high confidence).** The original art was produced from fully self-contained prompts that embed the art style and character descriptions in every prompt (see section 4, and the Worked example for the concrete style vocabulary). That style vocabulary (graphite crosshatch and colored-pencil hand-drawn illustration) is exactly the kind of stylized illustration MAI-Image-2.5 claims a +90 ELO gain on. Feed the original prompts verbatim to the generations endpoint and compare.
2. **Edits endpoint as a pseudo style reference (medium confidence, pilot hypothesis).** Pass an existing illustration as the `image` and prompt for a content change while keeping the style ("keep this exact graphite pencil style, crosshatching, and character designs; replace the scene with ..."). The documented "consistency across stylization" and "preserve composition" behavior suggests this can work for near-neighbor scenes, but generating a substantially different composition this way is undocumented. The pilot tests it cheaply.

## 4. Local recon methodology (recover the original art's formula)

Before generating anything, inspect the existing art repo read-only to recover four things the pilot depends on:

- **The original generator, if identifiable.** Check the prompt and resource files, any copyright or credits doc, and PNG metadata text chunks. The original tool is often deliberately generator-agnostic and unrecorded, so treat "original generator" as likely UNKNOWN and plan around prompt discipline rather than a tool-specific feature.
- **The prompt formula (usually the real asset).** Typically a set of fully self-contained prompts: an art-style prefix, then verbatim "character token" blocks (recurring characters, vehicles, settings), then the per-scene description, then fixed quality tags. Consistency comes from prompt discipline, not a tool-specific style feature, so it transfers to any generator including MAI.
- **The art-style vocabulary** used in story or scene frontmatter, so each style value maps to a promptable description.
- **The existing canvas sizes**, checked against MAI's 1,048,576 pixel cap so you can pick the nearest valid dimensions. If existing art exceeds the cap, exact-dimension drop-in replacement is impossible.

The concrete recon results for the first build (files, sizes, style values, and what the generator turned out to be) are in the Worked example.

## 5. Pilot: regenerate a few known scenes, side by side

Goal: a cheap, decisive answer to "does MAI-Image-2.5 match the existing style well enough to make the new scene art."

Pick about three scenes that already have known-good art and known prompts, then run two arms.

**Test matrix (about 12 images, up to 20 calls with retries):**

| Arm | Endpoint | Input | Per scene |
|---|---|---|---|
| A: prompt only | `/mai/v1/images/generations` | Original prompt verbatim, width 1248, height 832 | 2 candidates |
| B: style reference | `/mai/v1/images/edits` | Existing scene PNG + "keep this exact art style ... replace the scene with [next scene's description]" | 2 candidates |

**Evaluation (side by side with the existing art):** stroke and texture character, paper texture, tonal range, character fidelity against the character tokens, composition quality, and any content-filter refusals. Produce one comparison contact sheet for the owner to review on their device, then a go or no-go for regenerating the rest of the batch.

**Execution notes:** the pilot script belongs in the consumer site repo (PowerShell 7 per the operator's scripting standard; the edits call uses multipart form). At 2 RPM the whole pilot is about 10 minutes of API time. If Arm A wins, MAI-Image-2e is NOT a fallback for cost saving on future bulk runs without retesting, because 2e has no edits support and is a different model lineage.

**Pilot cost: under 5 USD, cap at 10 USD** (math in section 7).

The concrete scenes chosen for the first build are listed in the Worked example.

## 6. Provisioning steps (documented only, nothing executed)

Per repo rules, creating any Azure resource requires explicit owner confirmation first.

1. **Resource:** one Microsoft Foundry (AI Services) resource + project. Strongly consider sharing the resource planned for MAI voice (see `docs/plans/ai-voice-mai-voice-2.md`); one Foundry resource can host both the voice and image deployments if the chosen region supports both. Suggested region: **East US** (in the MAI image list; verify voice overlap before co-locating).
2. **Deploy the model** (Cognitive Services Contributor role required):

   ```
   az cognitiveservices account deployment create `
     --name <ACCOUNT_NAME> `
     --resource-group <RESOURCE_GROUP> `
     --deployment-name mai-image-25 `
     --model-name "MAI-Image-2.5" `
     --model-format Microsoft `
     --model-version 2026-06-02 `
     --sku-name GlobalStandard `
     --sku-capacity 1
   ```

   Source: [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai). Per the [Foundry Models FAQ](https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq), there is no cost for the resource or the deployment itself; billing is per token used.
3. **Key handling (repo hard rules):** prefer **Entra ID auth** (DefaultAzureCredential, scope `https://cognitiveservices.azure.com/.default`) so no key exists at all. If a key is needed for scripts: store it in the tenant Key Vault (placeholder `<key-vault>`, suggested secret name `<initiative>-foundry-mai-image-key`), load into the session from Key Vault or a gitignored `.dev.vars`, and never commit it anywhere.
4. **After the pilot:** if no-go, delete the deployment (tidiness; it carries no idle charge per the FAQ above).

## 7. Costs

Pricing is token-metered, not per image. Published rates (verify in the Foundry portal at deployment time; the pricing page is the canonical source):

| Meter | MAI-Image-2.5 | MAI-Image-2.5-Flash |
|---|---|---|
| Text input | 5 USD / 1M tokens | 1.75 USD / 1M tokens |
| Image input | 8 USD / 1M tokens | 1.75 USD / 1M tokens |
| Image output | 47 USD / 1M tokens | 33 USD / 1M tokens |

Source: [Foundry Models pricing, Microsoft models](https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/) (rates as summarized 2026-07; page was intermittently unreachable during research, confirm before deploying).

**Tokens per generated image: UNKNOWN (not published).** Working assumption for estimates: comparable token-metered image models meter roughly 1,000 to 4,200 output tokens per ~1 MP image, giving:

| Item | Estimate |
|---|---|
| One 1248x832 image, MAI-Image-2.5 | ~0.05 to 0.20 USD |
| One image, MAI-Image-2.5-Flash | ~0.03 to 0.14 USD |
| Prompt input (400 to 600 tokens, the long self-contained prompts) | under 0.01 USD |
| Edit-arm input image (~1 MP at 8 USD/M) | ~0.01 to 0.03 USD |
| **Pilot (12 to 20 images, MAI-Image-2.5)** | **~1 to 4 USD, cap 10 USD** |

Batch totals scale linearly with scene count; the first build's concrete catalog figures are in the Worked example.

First pilot task: read the actual token counts off the first responses and the Cost Management meters, then replace this assumption with real numbers.

## 8. Risks and unknowns

- **Preview model, no SLA.** Versions, limits, and pricing can change; the whole family is (Preview).
- **Tokens per image undocumented**, so per-image cost above is an estimate until the first metered runs.
- **Style match quality is unproven.** "Stylized illustration" strength is claimed by Microsoft marketing and Arena rankings, not demonstrated on graphite crosshatch children's-book art. That is what the pilot is for.
- **Children in every scene.** The MAI docs carry only general responsible AI guidance (system-level content classifiers; risk areas include violence, sexual content, public figures, trademarks). Whether the Azure OpenAI rule that "photorealistic images of minors are blocked by default" also applies to MAI models is **UNKNOWN** (that rule is documented for Azure OpenAI image models with a request-access exception). The art in scope here is explicitly hand-drawn illustration, not photorealistic, which is the safer category, but expect the occasional filter refusal and keep the "hand-drawn storybook illustration" framing in every prompt. Sources: [MAI responsible AI considerations](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai), [Azure OpenAI image generation, minors note](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e)
- **Trademark in the prompts.** If a character token specifies a real trademarked brand (see the Worked example for the concrete case), trademark replication is a named risk area for the content system. Genericizing it to a described generic equivalent removes the risk without changing the look.
- **Canvas size mismatch.** If the existing art exceeds MAI's cap (as in the Worked example), exact-dimension drop-in replacement is impossible; pick the nearest valid 3:2 size.
- **2 RPM at Tier 1** makes bulk regeneration slow (about 3 hours for a few hundred images); fine for per-batch runs, and a quota increase can be requested.
- **Original generator may be unknown.** If the pilot fails, identifying the original tool (browser history, account exports from the original creation window) remains the best path to a perfect match.

## 9. Decisions for the owner

1. **Approve the pilot?** Requires one Foundry resource + one model deployment (confirm-before-create) and a spend cap of 10 USD.
2. **Region and resource sharing:** co-locate with the planned MAI voice resource (one resource, two deployments) or keep separate?
3. **Model tier for the pilot:** MAI-Image-2.5 (max quality) recommended; add a Flash arm only if 2.5 wins and cost matters at scale.
4. **Auth mode:** Entra ID (no stored secret, recommended) or API key in the tenant Key Vault.
5. **Genericize any trademarked branding** in the character tokens before generating (see the Worked example).
6. **Provenance going forward:** record the generator, model version, and prompt hash for every future image (frontmatter or a sidecar file), so "which AI made this art" is never unknown again.

## 10. Sources

- Deploy and use MAI image models in Microsoft Foundry (preview): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Foundry Models sold by Azure (capability table): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Foundry Models pricing, Microsoft models: <https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/>
- microsoft.ai announcement (Arena ranks, stylization, character consistency): <https://microsoft.ai/news/introducing-mai-image-2-5/>
- Foundry Labs, MAI-Image-2.5 (control with preservation claims): <https://labs.ai.azure.com/innovations/mai-image-2-5/>
- Foundry Models FAQ (billing model, no resource/deployment cost): <https://learn.microsoft.com/azure/foundry-classic/foundry-models/faq>
- Plan and manage costs for Microsoft Foundry: <https://learn.microsoft.com/azure/foundry/concepts/manage-costs>
- Azure OpenAI image generation, responsible AI and minors policy (adjacent precedent, not MAI-specific): <https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e>

<!-- safety-scan-worked-example:start -->
## Worked example: Gunner the Lab / Holdfast Press

This is the concrete build the plan above was written for and applied to. It carries the real task, brand, resource names, and catalog figures that the generic sections abstract away.

**Task:** G11 (new Story #1 scene art for gunnerthelab.com, and future stories), serving the Gunner the Lab / Holdfast Press StoryReader brands.

### Recon findings (the original Gunner art)

Files inspected read-only in `d:/git/gunnerthelab/gunnerthelab.github.io`:

- **`resources/Illustration_Prompts_All_Stories.md` (128 KB) does NOT name the original AI service.** It is deliberately generator-agnostic: it says "AI generators," "if the tool supports image references," and "negative prompts (if supported)." The owner's original tool is therefore **UNKNOWN and not recorded anywhere in the repo** (also checked `resources/copyright.md`, which mentions Midjourney and DALL-E only as generic legal examples, and no PNG metadata text chunks exist in the sampled files).
- **The prompt formula is the real asset.** Every scene prompt is self-contained: art-style prefix, then verbatim "character token" blocks (Gunner, Tiger, Bear, Dad, Mom by era, the three boys by era, the truck, the settings), then the scene, then fixed quality tags ("storybook illustration, children's book quality, detailed professional illustration, hand-drawn, 3:2 landscape"). Consistency was achieved by prompt discipline, not by any tool-specific style feature. This transfers to any generator, including MAI.
- **Style vocabulary in story frontmatter (`src/content/stories/*.md`, `artStyle`):** exactly two values, `"graphite"` (Beginning, East Texas, Heart stories, #41) and `"colored-pencil"` (Big Moves onward, Virginia, Adventure). The full graphite vocabulary is "graphite pencil illustration, crosshatched, softly shaded black and white, pencil on paper texture" and the colored-pencil vocabulary is "colored pencil illustration, warm hand-drawn textured style, visible pencil strokes."
- **Sampled art files:** `public/images/covers/story-01.png` (2,913 KB, 1264x848 px), `covers/story-02.png` (2,921 KB, 1264x848), `illustrations/illus-family-farmhouse-porch.png` (2,452 KB, 1024x1024). Story #1 already has 8 scene PNGs under `public/images/stories/` (committed 2026-04-11); G11 exists because the story text was rewritten and several scenes no longer match.
- **Size note:** 1264x848 = 1,071,872 pixels, which slightly EXCEEDS MAI's 1,048,576 pixel cap, so MAI cannot reproduce the existing canvas size exactly. Nearest valid 3:2 sizes: **1248x832** (1,038,336 px) or 1152x768. Also incidental evidence the originals were not generated by an MAI model at that size.

### Pilot scenes chosen

Original prompts used verbatim from `resources/Illustration_Prompts_All_Stories.md`, Story 1 section:

1. `story-01-scene-01-the-orchard` (Dad and the three boys, apple orchard)
2. `story-01-scene-02-the-tipping-point` (Dad alone in the truck at night)
3. `story-01-scene-03-the-patio` (Dad and Mom on the Phoenix patio)

Evaluation against the character tokens included Dad's beard, hat, overalls; the boys' ages; and NOT-orange Tiger where applicable.

### Concrete cost figures

| Item | Estimate |
|---|---|
| Full Story #1 (8 scenes x 2 candidates) | ~1 to 4 USD |
| Whole catalog someday (~170 scenes x 2 candidates) | ~17 to 70 USD (2.5) or ~10 to 48 USD (Flash) |

### Concrete risk specifics

- **Trademark:** the character tokens specify "Dickies brand overalls" with a red logo patch. Genericizing to "denim bib overalls with brass buttons and a red rectangular chest patch" removes the risk without changing the look.
- **Canvas:** existing art is 1264x848 = 1,071,872 px, which exceeds MAI's cap; nearest valid 3:2 is 1248x832 or 1152x768.
- **Bulk timing:** about 3 hours for 340 images at 2 RPM.

### Concrete resource and secret names

- Key Vault: **kv-hcs-vault-01**; suggested secret name `gunner-foundry-mai-image-key`.

### Local sources

- `d:/git/gunnerthelab/gunnerthelab.github.io/resources/Illustration_Prompts_All_Stories.md`, `src/content/stories/*.md` frontmatter, `public/images/covers/` and `public/images/stories/`
<!-- safety-scan-worked-example:end -->
