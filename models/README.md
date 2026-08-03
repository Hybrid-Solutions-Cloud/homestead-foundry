# Model registry

`registry.schema.json` is the JSON Schema every registry file validates
against.

Two registry files ship with this repo:

- **`registry.starter.json` - start here.** A real, working roster of 28 models
  drawn from this repo's own research spikes and ADRs: image, voice, reasoning,
  embedding, and video entries covering all three statuses, every one with a
  `sourceRef` pointing at the document that justifies it. Copy it, delete the
  models you do not want, adjust `region` and `capacity`, and deploy. This is the
  file to point `infra/main.bicep` at for a first real deployment.
- **`registry.example.json` - shape reference only.** A minimal example with
  placeholder entries, one per `kind` (image, voice, video, reasoning, text,
  speech-to-text, embedding) and at least one per `status` (deployed, planned,
  rejected). It demonstrates the full field shape and nothing else; it is not
  deployable as written.

Model availability, versions, and regions change. Before deploying, confirm each
entry against your own subscription with `az cognitiveservices account
list-models` rather than trusting the starter file's regions verbatim.

Design rationale, the full field reference, and the consumption contract a
consuming repo follows to resolve an `id` to a usable endpoint all live in
the model registry design notes - read that first if you are integrating
against this registry or extending the schema.

A real, populated registry with this repo's actual deployment names is not
yet published here (see `MODEL-REGISTRY-DESIGN.md`'s "Files" section for
why the exact location is still open, pending the repo's public-flip
decision).

## Set `capacity` on every deployed entry

`capacity` is optional in the schema so an older registry file keeps validating,
and it is not optional in practice. An entry that omits it inherits the
stack-wide `modelDeploymentCapacity` fallback, which defaults to 1, and capacity
1 measures at roughly one request per minute. That is a throughput floor, not a
cost control: `GlobalStandard` bills per token consumed, so raising capacity
raises the rate ceiling rather than creating spend. Cost control is the budget
and its alerts, plus a cap in the caller.

Capacity units are not comparable between models, which is why the number is
per entry. After `what-if`, read the `inheritedCapacityRegistryIds` output: every
id listed there is deploying at the fallback.

The voice entries in both files carry no `capacity` on purpose. A voice model
reached through the Speech endpoint by SSML voice name produces no deployment
resource at all, so capacity never applies to it; list its id in
`skipDeploymentModelIds` instead.
