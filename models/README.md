# Model registry

`registry.schema.json` is the JSON Schema every registry file validates
against. `registry.example.json` is a brand-neutral example populated with
placeholder entries, one per `kind` (image, voice, video, reasoning) and one
per `status` (deployed, planned, rejected), so it demonstrates the full
shape without hardcoding this repo's own private deployment names.

Design rationale, the full field reference, and the consumption contract a
consuming repo follows to resolve an `id` to a usable endpoint all live in
`pmo/MODEL-REGISTRY-DESIGN.md` - read that first if you are integrating
against this registry or extending the schema.

A real, populated registry with this repo's actual deployment names is not
yet published here (see `MODEL-REGISTRY-DESIGN.md`'s "Files" section for
why the exact location is still open, pending the repo's public-flip
decision).
