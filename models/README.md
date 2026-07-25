# Model registry

`registry.schema.json` is the JSON Schema every registry file validates
against.

Two registry files ship with this repo:

- **`registry.starter.json` - start here.** A real, working roster of 26 models
  drawn from this repo's own research spikes and ADRs: image, voice, reasoning,
  and video entries covering all three statuses, every one with a `sourceRef`
  pointing at the document that justifies it. Copy it, delete the models you do
  not want, adjust `region`, and deploy. This is the file to point
  `infra/main.bicep` at for a first real deployment.
- **`registry.example.json` - shape reference only.** A minimal example with
  placeholder entries, one per `kind` (image, voice, video, reasoning) and one
  per `status` (deployed, planned, rejected). It demonstrates the full field
  shape and nothing else; it is not deployable as written.

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
