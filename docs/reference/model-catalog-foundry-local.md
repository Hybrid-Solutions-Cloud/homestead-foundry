# Available models: the two on-premises targets

::: warning This page was split in two
It used to cover both on-premises targets in one place, and that made the two
rosters harder to tell apart rather than easier. **They are two catalogs, not
one.** Each now has its own page:

- **[Available models: Foundry Local](./model-availability-foundry-local)** - the
  runtime that ships inside your own application. ONNX only, plus NPU and
  alternate-accelerator variants no cluster ever sees.
- **[Available models: Azure Local Foundry](./model-availability-azure-local-foundry)** - the Arc-enabled Kubernetes extension. The same ONNX core, plus a 100-entry
  vLLM roster that cannot run on a device.

The third target has always had its own page:
**[Available models: Azure AI Foundry](./model-availability-azure-cloud)**.
:::

## Why they had to be separated

The rosters **diverge in both directions**, which a single merged table
consistently understated:

| | Foundry Local | Azure Local Foundry |
|---|---|---|
| Shared ONNX core | 35 aliases | 35 aliases |
| vLLM roster (100 entries) | **no** | yes |
| NPU and alternate-accelerator variants | yes | **no** |
| Vision input | **no** | yes |
| Azure subscription required | no | yes |
| Shape | a ~20 MB library inside your app | an Arc-enabled Kubernetes extension |

Only the middle is common: 35 aliases out of 170 total entries. A reader who
wants to know what one target can run should not have to filter out the other
target's rows to find out.

This corrected the premise of
[ADR-0017](../adr/ADR-0017-deployment-target-documentation-structure) decision 5,
which assumed the two differed only in execution provider and deployment
mechanics.

## See also

- [Deployment targets](../targets/) compares all three side by side.
- [SPIKE-22](../research/SPIKE-22-foundry-local-model-catalog), the research behind both pages.
- [Model catalog](./model-catalog), what this project chose and runs.
