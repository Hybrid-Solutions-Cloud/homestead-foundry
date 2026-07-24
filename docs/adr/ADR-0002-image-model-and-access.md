# ADR-0002: Image model selection and access for Azure AI Foundry builds

- Status: Proposed
- Date: 2026-07-11
- Decider: repo owner

## Context

An Azure AI Foundry build in this repo needs new scene art plus a repeatable path to future art that matches an existing hand-illustrated house style. This ADR captures a reusable methodology for selecting and accessing a first-party image model on Azure AI Foundry for that kind of style-matching workload. A research spike (SPIKE-01, `docs/research/SPIKE-01-image-model.md`) independently verified the MAI image family, its lifecycle, cost mechanics, style-matching capabilities, canvas constraints, and rate limits against first-party Microsoft sources. The environment readiness check (`ai/verification/environment-readiness.md`) confirmed the selected model is live in the target subscription.

The forces this decision must reconcile generalize to any Azure AI Foundry image-model selection:

- **Lifecycle churn.** Preview image models churn versions and retire on published schedules. In the verified MAI family, MAI-Image-2 (version 2026-02-20) and MAI-Image-2e (version 2026-04-09) both retire on 2026-08-15, while MAI-Image-2.5 and MAI-Image-2.5-Flash carry no published retirement date and are the models the older two are being replaced by. Separately, the CLI per-version metadata lists an `inference` date of 2026-09-01 for MAI-Image-2.5 version 2026-06-02; SPIKE-01 reads this as a Preview version-churn signal (a newer dated version supersedes the current one), not a model end-of-life, and its exact authority is not documented.
- **Confirmed availability.** A model is only selectable once it is confirmed present in the live catalog of the target subscription and region. MAI-Image-2.5 is present in the live East US model catalog in the primary subscription, lifecycle Preview, version 2026-06-02, deployable as Global Standard, at Tier 5 (10 RPM), per the environment readiness check.
- **A thin API surface constrains style matching.** The complete documented request parameter set for these models is only `model`, `prompt`, `image` (edits only), `width`, and `height`. There is no seed, no mask, no negative prompt, no candidate-count (`n`), and no dedicated style-reference input or style-strength control. Style matching therefore has exactly two viable arms: prompt engineering on the generations endpoint, and the edits endpoint used as a pseudo style reference.
- **Canvas cap.** Both dimensions must be at least 768 pixels and `width` times `height` must not exceed 1,048,576 pixels. Existing source assets authored above that ceiling cannot be reproduced at their exact dimensions and must be re-standardized to a compliant canvas (see the Worked example for the specific numbers).
- **The single largest cost unknown.** Tokens consumed per generated image are not published by Microsoft for any MAI image model, so per-image and whole-catalog cost cannot be asserted from documentation.

## Decision

Adopt **MAI-Image-2.5** (Preview), deployed as **Global Standard** on the shared AIServices resource in East US (the same resource that serves the narration model per ADR-0003). The selection method behind that choice is reusable:

1. **Version pinned at deploy and re-checked, never hardcoded.** At deploy time, re-query `az cognitiveservices model list --location <region>` and deploy the then-current model version (MAI-Image-2.5 version 2026-06-02 at time of writing). Because the model is Preview, re-verify (and redeploy if a newer dated version has appeared) around and after the CLI inference date (2026-09-01 here). Do not deploy a model that retires within the planning horizon: MAI-Image-2 and MAI-Image-2e both retire 2026-08-15 and neither supports the edits endpoint the style-reference arm needs.
2. **Style matching by prompt engineering plus edits-as-pseudo-style-reference.** Arm one: feed the build's existing self-contained prompts (style vocabulary plus subject tokens) verbatim to the generations endpoint. Arm two: pass an existing illustration as the `image` on the edits endpoint and prompt to keep the style while changing the scene. Because the API exposes only `model`, `prompt`, `image`, `width`, and `height`, there are no seeds, masks, negative prompts, or style-reference inputs, so outputs are not reproducible and candidate selection is a human review step.
3. **Standardize the scene-art canvas on 1248x832** (a clean 3:2 at 1,038,336 pixels, comfortably under the cap). Accept that existing source assets above the cap cannot be reproduced at their exact dimensions (see Worked example); re-standardizing to a compliant canvas is the correct trade.
4. **Consider a Flash-tier variant for bulk backfill** to control cost, but only after the primary model wins the style pilot. MAI-Image-2.5-Flash exposes the same two endpoints and the same parameters and shares the same RPM ceiling as 2.5, so it buys lower per-token cost, not throughput.
5. **Treat tokens-per-image as UNKNOWN and measure it in the smoke test.** Make the first two pilot calls a cost probe: inspect the live generations JSON response for a `usage` or token field, and if absent, divide a Cost Management output-token meter delta by a fixed micro-batch (for example 20 images at 1248x832). Set a Cost Management budget alert on the resource group before any batch spend, and read the live per-token rates in the Foundry portal rather than relying on any unverified figure.

## Consequences

**Positive.**
- Deploys a current, non-retiring model that offers both endpoints, so both style-match arms are available.
- The 1248x832 canvas fits the pixel cap and yields a cleaner 3:2 than typical above-cap originals.
- Tier 5 (10 RPM) in the primary subscription gives materially more headroom than the fallback tenant's Tier 1 (2 RPM).
- Cost and provenance become knowable after the smoke test rather than guessed.

**Negative.**
- Preview status means no SLA and periodic version churn; the deployment must be re-verified around the CLI inference date (2026-09-01 here).
- Exact drop-in replacement of existing above-cap source assets at their original dimensions is impossible (see Worked example).
- No seed means non-reproducible output and mandatory human candidate review; multiple candidates require multiple calls.
- Per-image cost is unknown until measured, and style-match quality on the target hand-illustrated style is unproven until the pilot runs.

**Follow-ups.**
- Run the two-call cost probe before any batch, and record real tokens-per-image and cost-per-image.
- Re-query the model catalog at deploy time and again at and after the inference date.
- If the primary model wins the pilot and cost matters at scale, evaluate the Flash-tier variant for the backfill arm.
- Request a quota increase (aka.ms/oai/stuquotarequest) only if backfill throughput becomes a constraint; even Tier 6 caps 2.5 at 12 RPM.

## Alternatives considered

- **A retiring model version (MAI-Image-2e or MAI-Image-2).** Rejected: both retire 2026-08-15, and neither supports the edits endpoint, so the pseudo style-reference arm would be impossible. MAI-Image-2e also has no successor path for this use beyond 2.5-Flash.
- **The Flash-tier variant as the primary pilot model.** Rejected for the style test: 2.5 is the highest-quality arm and the style match is the decisive question. Flash is retained as the future cheaper-backfill option after quality is proven.
- **Reproducing an existing above-cap source canvas.** Rejected: pixel counts over the 1,048,576 cap return 400 Bad Request (see Worked example for the specific asset).
- **Waiting for a style-reference or seed feature.** Rejected: neither is on the documented surface, and prompt engineering plus the edits endpoint is the available path today.
- **Hardcoding a single model version.** Rejected: the model is Preview and the CLI inference date signals a re-check; the deploy step re-queries the catalog instead.

&lt;!-- safety-scan-worked-example:start -->
## Worked example: the first proven build

This ADR was first written and decided for this repo's first proven build, which serves two publishing brands, Brand A and Brand B, through their reader apps. The concrete instantiation of the methodology above:

- **Trigger.** An early feature needed new scene art for Brand A's reader app plus a repeatable path to future story art matching the existing hand-drawn graphite and colored-pencil illustration style (graphite crosshatch storybook art).
- **Target subscription.** MAI-Image-2.5 was confirmed live in the East US catalog of the primary subscription (the MVP credit subscription, a Tier-5 / MVP-tier subscription), lifecycle Preview, version 2026-06-02, Global Standard, Tier 5 (10 RPM).
- **Canvas.** The existing covers are 1264x848, which is 1,071,872 pixels, 23,296 pixels over the 1,048,576 cap, so they cannot be reproduced at their exact dimensions. The scene-art canvas was standardized on 1248x832 (1,038,336 pixels, a clean 3:2), about a 1 to 2 percent scale difference from the originals (whose ratio is 1.491, not 1.500).
- **Style prompts.** The build's existing self-contained prompts (style vocabulary plus character tokens) were fed verbatim to the generations endpoint as arm one; an existing illustration was passed as the edits `image` input as arm two.
- **Shared resource.** The model deploys onto the same AIServices resource that serves MAI-Voice-2 (ADR-0003).
&lt;!-- safety-scan-worked-example:end -->

## Sources

- `docs/research/SPIKE-01-image-model.md` (model family and lifecycle, cost mechanics, style-matching capabilities, canvas math, rate-limit ladder, RAI and provenance)
- `ai/verification/environment-readiness.md` (MAI-Image-2.5 confirmed in the live East US catalog, Global Standard, Tier 5, primary subscription)
- `ai/plans/source/mai-image-2-5-art-match.md` (art-match plan and pilot scope)
- Deploy and use MAI image models in Microsoft Foundry (preview): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- Foundry Models sold by Azure (capability table, canvas rule): <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure>
- Model retirement schedule (MAI-Image-2 and 2e retire 2026-08-15; 2.5 not scheduled): <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule>
- Microsoft Foundry Models lifecycle and support policy: <https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirements>
- Introducing MAI-Image-2.5 (Arena ranks, stylization gains): <https://microsoft.ai/news/introducing-mai-image-2-5/>
