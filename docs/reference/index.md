# Reference

The living catalogs. These are the pages that change most often, because they
record what is on the table today rather than a decision made once.

| Reference | Covers |
|---|---|
| [Model catalog (Azure cloud)](./model-catalog) | Every model the Azure cloud target has deployed, evaluated, or rejected, with the reasoning behind each row. Image, voice, video, and reasoning. |

## Why the model catalogs are split

The Azure cloud target and the two on-premises targets run close to disjoint
rosters. Nothing in the cloud catalog runs on Foundry Local: no image generation,
no text to speech, no video, and no proprietary frontier reasoning models. A
single table with a per-target column would read as three noes on every row.

A second catalog covering the Foundry Local roster shared by the Windows Server
and Azure Local targets is pending SPIKE-22 and
[ADR-0019](../targets/), per
[ADR-0017](../adr/ADR-0017-deployment-target-documentation-structure) decision 5.
Until it exists, what each target can run is summarized in the
[deployment targets comparison](../targets/#_2-models-and-modalities).

The machine-readable counterpart to both is the
[model registry](../guide/model-registry).
