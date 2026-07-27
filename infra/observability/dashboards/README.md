# Foundry dashboard definitions

Use the native Azure Monitor dashboard with Grafana resource created by this package.
It is not Azure Managed Grafana. Dashboard-definition deployment is an explicit preview
switch and must use source-controlled JSON with no credentials, private URLs, prompts,
responses, or personal data.

The first Foundry dashboard should contain only these operational views:

1. Subscription budget progress and a link to Cost Management for actual and forecast cost.
2. Foundry account and project inventory, owner, project, lifecycle, and expiry.
3. Foundry platform metrics supported by the deployed account and model deployment:
   requests, availability, latency, errors, throttling, tokens, generated images, and
   safety signals where applicable.
4. Foundry deployment failures, selected Azure service and resource health events, and
   active alert state.
5. Approved diagnostic and trace drill-down only after the data-collection gate is met.

Cost Management is not a native Grafana data source. Keep billing investigation and
scheduled cost reporting in Cost Management rather than attempting to reproduce it in
the dashboard.
