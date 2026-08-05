# Foundry dashboard definitions

Use the native Azure Monitor dashboard with Grafana resource created by this package.
It is not Azure Managed Grafana. Dashboard-definition deployment is an explicit preview
switch and must use source-controlled JSON with no credentials, private URLs, prompts,
responses, or personal data.

Azure Monitor dashboard definitions have one supported child-resource name: `default`.
The public Bicep contract enforces that literal value. The versioned JSON file remains
the source-controlled definition; a descriptive dashboard definition resource name is
not supported by the Azure API.

`foundry-model-usage.dashboard.json` is the initial core definition. It is intentionally
generic: `__SUBSCRIPTION_ID__`, `__FOUNDRY_RESOURCE_GROUP__`,
`__FOUNDRY_RESOURCE_NAME__`, and `__LOCATION__` are placeholders that a private overlay
must replace at deployment time. Do not replace them in this public file. The definition
uses native `Microsoft.CognitiveServices/accounts` metrics, so it does not create a
diagnostic setting or send metric data to Log Analytics.

It answers model-use questions by deployment and time range:

1. Which deployment was used: metric dimension `ModelDeploymentName`.
2. When it was used: the selected dashboard time window.
3. How much it was used: request and input, output, and total token trends.
4. Whether service behavior was affected: availability, HTTP 429 throttles, and 5xx
   server errors.
5. Directional cost estimation: token-based input/output cost by deployment and
   aggregate token consumption.
6. Content safety: HTTP 400 blocks by deployment (RAI content filtering).
7. Model inventory: request volume across all 22 deployed models.
8. Caller/consumer breakdown: requires `AzureOpenAIRequestUsage` diagnostic category
   enabled in the private overlay.

Token use is a leading consumption signal, not a billed-currency calculation. Use Cost
Management for actual and forecast charges. The cost estimation panels use Grafana's
`currencyUSD` unit for directional trending only.

The first Foundry dashboard should contain only these operational views:

1. Subscription budget progress and a link to Cost Management for actual and forecast cost.
2. Foundry account and project inventory, owner, project, lifecycle, and expiry.
3. Foundry platform metrics supported by the deployed account and model deployment:
   requests, availability, latency, errors, throttling, tokens, generated images, and
   safety signals where applicable.
4. Foundry deployment failures, selected Azure service and resource health events, and
   active alert state.
5. Approved diagnostic and trace drill-down only after the data-collection gate is met.
6. Directional cost estimation panels (token-based, not billed currency).
7. Content safety / RAI block monitoring.
8. Caller identity tracking via Usage diagnostics (requires `AzureOpenAIRequestUsage`
   enabled in the private overlay).

Cost Management is not a native Grafana data source. Keep billing investigation and
scheduled cost reporting in Cost Management rather than attempting to reproduce it in
the dashboard.
