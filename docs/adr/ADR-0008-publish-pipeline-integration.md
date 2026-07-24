# ADR-0008: Publish-pipeline integration for Foundry voice and image generation

- Status: Accepted (owner approved 2026-07-24)
- Date: 2026-07-11

This ADR records a general, reusable methodology for integrating an Azure AI
Foundry build (neural voice plus image generation) with an external,
publish-time asset pipeline owned by a separate consumer repo. It was first
proven on a real build serving two publishing brands; the concrete detail from
that build is preserved under a single anonymized **Worked example** callout so
the decision reads as reusable while the historical lessons stay intact.

Throughout, "the consumer repo" is the repo that owns the publish pipeline and
the rendered site, "the publish pipeline" is its set of publish-time Node tools
(`tts.mjs` for synthesis, `stitch.mjs` for ffmpeg stitching, `publish.mjs` for
the manifest and upload step), and `<brand>` stands in for a single brand served
by that pipeline. A build can serve more than one `<brand>` from more than one
consumer repo.

## Context

SPIKE-06 (`docs/research/SPIKE-06-pipeline-integration.md`) inspected the live
publish pipelines and the site image locations of the first real consumers, so
the design could be scoped against real code rather than the plans'
descriptions. SPIKE-04 (`docs/research/SPIKE-04-identity-security.md`) grounds the
auth, secret-handling, and provenance points.

The forces this decision must reconcile:

- **Pre-render is the only viable architecture.** Audio and cover art are
  pre-rendered at publish time by Node tools and uploaded to object storage
  under immutable content-hashed keys; the edge worker and browser never
  synthesize and never hold a key. Long content exceeds the per-request audio
  duration cap, and an edge runtime cannot run the ffmpeg or ffprobe the
  stitcher needs, so on-demand synthesis is ruled out.
- **Drifted copies of the publish tool must be reconciled first.** When a
  build serves more than one consumer repo, each repo typically carries its own
  copy of `publish.mjs`, and those copies drift in both directions: one copy
  gains a feature the other lacks, and vice versa. Reconciliation is a two-way
  merge, not a one-way port, and it must land before any Foundry feature work.
- **There is usually no image tooling today.** Scene art is commonly produced
  manually with the original generator unrecorded, may be hotlinked to a
  marketing origin rather than stored in object storage, and the prompt library
  often lives in a separate studio/resources repo, not the site repo.
- **Canvas.** Foundry image generation has a default landscape size chosen to
  fit the pixel cap (ADR-0002).

## Decision

Adopt **publish-time pre-render (Option A)** for both modalities, with the
reconciliation as an explicit first step.

1. **Reconcile the drifted publish-tool copies first**, in a standalone two-way
   commit in each consumer repo, before any Foundry work: merge each copy's
   unique features into the other so the files converge. This is step one and
   blocks the rest.
2. **Voice variants, additive to the manifest.** Add an optional variants array
   to each content entry so older app builds ignore it and the existing narrator
   fields keep their meaning; read-along and old clients stay untouched. Keep the
   manifest schema version unchanged (an additive optional field does not warrant
   a bump). Synthesize each listen voice once behind a `--voices <all|slug[,slug]|none>`
   flag (default `none`), keyed by a voice-aware variant hash so backfill only
   renders missing or stale variants. Upload variants to immutable,
   content-hashed object-storage keys. Add a spend ledger plus a
   `--<budget>-usd` hard stop mirroring the pipeline's existing character-count
   stop. The only synthesis-tool change is adding the provider's SSML style
   namespace and an express-as wrapper for the styled voice; the per-call key and
   region options bag already exists.
3. **A new image tool in the consumer (site) repo.** Add an image tool
   (`tools/<foundry>-image.mjs`) that calls the generations and edits endpoints
   (Entra-preferred auth per SPIKE-04, the ADR-0002 canvas default), writes the
   rendered files into the site's public image directories, paces to the tier
   RPM, and reads real token counts off the first responses to replace the
   estimated per-image cost.
4. **Read prompts from the separate studio/resources repo**, not the site repo,
   keyed by scene, and genericize any trademarked terms per ADR-0007.
5. **A committed provenance index.** Write a `provenance.json` under the site's
   public tree mapping each image path to a record (generator, modelVersion,
   endpoint, promptHash, promptRef, width, height, sourceImage, createdAt, tool),
   plus an optional provenance echo in content frontmatter for any asset that is
   itself a frontmatter field (for example a cover). Body-referenced assets live
   in the index only.

<!-- safety-scan-worked-example:start -->

> **Worked example (anonymized first proven build).** A shared Foundry backbone
> served two publishing brands, Brand A and Brand B, each with its own consumer
> repo and publish pipeline.
>
> *As-found (SPIKE-06).* Chapters exceeded the 10-minute-per-request audio cap;
> the edge-worker runtime could not run ffmpeg or ffprobe, and object storage was
> the platform's bucket service. The two `publish.mjs` copies had drifted both
> ways: Brand B's had the voice-aware audio hash and the `--force` flag; Brand
> A's had the `timeframe` manifest field but ran the older, non-voice-aware code.
> Brand A is the 42-story catalog and the bulk of the MAI voice backfill, so it
> had published without the voice-aware hash. Scene art was produced manually
> (generator unrecorded), hotlinked to Brand A's marketing origin inside the
> chapter JSON (only covers were copied into the bucket), and prompts lived in a
> separate studio prompt repo (`Illustration_Prompts_All_Stories.md`,
> `Branding_Illustration_Prompts.md`, `Character_Bible.md`); the site repo had no
> `resources/` directory. MAI image generation requires 1248x832 as the default
> landscape size to fit the 1,048,576-pixel cap (ADR-0002).
>
> *Applied.* (1) Port Brand B's voice-aware audio hash and `--force` flag into
> Brand A, and port Brand A's `timeframe` manifest field into Brand B. (2) Add an
> `audioVariants` array to each chapter entry (schemaVersion stays 1); the
> existing `audio`, `timings`, `hasAudio`, and `audioDurationMs` fields keep
> meaning the narrator track. Key variants by `variantHash`; upload to bucket keys
> `books/<bookId>/audio/<chapterId>.<slug>.<variantHash>.mp3`. Add a `maiLedger`
> plus a `--mai-budget-usd` hard stop mirroring the existing 450,000-character F0
> stop (owner default 100 USD per month once the Azure credit resets, uncapped
> until then). The `tts.mjs` change is adding the `mstts` namespace and an
> `mstts:express-as` wrapper for the styled voice (Ethan's excited style). (3) The
> reader-app repo gains `tools/mai-image.mjs`, 1248x832 default, writing PNGs into
> `public/images/stories/` (or `covers/`). (4) Read prompts from the studio prompt
> repo, genericizing trademarked terms per ADR-0007. (5) Write the reader-app
> repo's `public/images/provenance.json`, plus an optional `artProvenance` echo in
> story frontmatter for the cover (the one asset that is a frontmatter field);
> scene art stays in the index only because it is body-referenced. Outright
> backfill (the rejected Option C alternative) would have cost about 10 USD per
> voice.

<!-- safety-scan-worked-example:end -->

## Consequences

**Positive.**
- Preserves the four pipeline invariants: ffmpeg stitching on the publish
  machine, offline-first apps, no runtime key, and a publish-time budget guard.
- The additive manifest field means no migration and no impact on old clients;
  read-along and the narrator track are untouched.
- Regenerated hotlinked scene art goes live on the next site deploy with no
  republish, while changed covers re-upload automatically on the next publish
  run.
- The committed provenance index closes the unknown-generator gap permanently
  and satisfies the ADR-0007 transparency ask at the data layer.

**Negative.**
- The reconciliation commit is prerequisite work that must land before any
  feature work.
- Image tooling is net-new code (the image tool and the provenance index).
- Per-image cost stays an estimate until the first metered runs read real token
  counts.
- Back-catalog voice backfill costs synthesis time and money up front, and a new
  voice added later means a full re-render for that voice.
- Drifting copies of the publish tool remain the root cause; deduplicating them
  into a shared package is deferred.

**Follow-ups.**
- Land the reconciliation commit in each consumer repo, then layer the
  `--voices` variant synthesis and the image tool on top.
- Read real tokens-per-image off the first image responses and update the cost
  model.
- Decide later whether to deduplicate the publish-tool copies into a shared
  package rather than keep them as drifting copies.

## Alternatives considered

- **Option B, on-demand synthesis via an edge-worker proxy with cache.**
  Rejected: long content exceeds the per-request duration cap, edge workers
  cannot run ffmpeg or ffprobe to stitch, the Speech key becomes a runtime
  secret, and per-request cost is unbounded.
- **Option C, hybrid pre-render plus on-demand back catalog.** Rejected: it
  inherits Option B's worker-stitching and runtime-key problems for a catalog
  that is cheap to backfill outright, and adds a second code path to maintain.
- **A one-way port of one repo's `publish.mjs` onto the other.** Rejected: the
  drift is two-way, so each copy carries a feature the other lacks.
- **Placing the image tool in a pipeline/synthesis repo.** Rejected: the output
  images, the content markdown, and the covers all live in the site repo.
- **Reading prompts from the site repo.** Rejected: the site repo has no
  `resources/` directory; the prompt library lives in the separate
  studio/resources repo.
- **Storing hotlinked scene art in object storage like covers.** Rejected: scene
  art is hotlinked to the marketing origin by design, and only covers are copied
  into object storage.
- **Bumping the manifest schema version for the variants array.** Rejected: an
  additive optional field keeps the schema version unchanged and leaves old
  clients working.

## Sources

- `docs/research/SPIKE-06-pipeline-integration.md` (pipeline as-is, the two-way `publish.mjs` drift, image tooling absence, prompt and image locations, variant keys, additive manifest, provenance scheme, per-repo file list)
- `docs/research/SPIKE-04-identity-security.md` (Entra-preferred auth, secret names in the platform Key Vault, provenance and trademark handling)
- `ai/plans/source/ai-voice-mai-voice-2.md` (Option A rationale, `--voices` and ledger design, owner-locked 100 USD/month cap)
- `ai/plans/source/mai-image-2-5-art-match.md` (image tooling and provenance points)
- Deploy and use MAI image models in Microsoft Foundry (preview) (generations and edits endpoints, parameters, canvas cap): <https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai>
- What is MAI-Voice (preview)? (same Speech SDK and SSML `<voice>` path, `mstts:express-as` styles): <https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices>
