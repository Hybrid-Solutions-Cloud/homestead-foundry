# Foundry observability operations guide

## Daily and weekly review

| Cadence | Review | Evidence | Action |
|---|---|---|---|
| Daily | Budget actual, forecast, anomaly, and workspace quota | Cost Management and alert history | Investigate source before raising any quota or threshold |
| Daily | Failed deployment, delete, Azure incident, or resource health event | Activity Log and active alerts | Establish impact, assign the Foundry owner, and follow the linked runbook |
| Weekly | Foundry inventory, ownership, lifecycle, and expiry | Resource Graph query library | Correct metadata, extend approved lifecycle, or schedule retirement |
| Weekly | Model requests, availability, latency, errors, throttling, and token trend | Foundry dashboard and supported metrics | Compare with an agreed workload baseline before changing an alert |
| Monthly | Diagnostic volume, retention, sampling, and operational value | Workspace usage and Cost Management | Keep, reduce, or remove paid collection |

## Alert policy

Every enabled alert needs a named owner, severity, action group, suppression approach,
and runbook. Use low-noise scopes and sustained windows. Do not page on latency, token
use, or preview project metrics until a workload baseline and response action exist.

For planned maintenance, use an approved alert-processing rule with a narrow scope and
time bound. Restore monitoring immediately after the maintenance window and review any
suppressed alert history.

## Diagnostic approval record

Before enabling Foundry diagnostics, Application Insights, availability tests, or a
scheduled query alert, record:

1. The exact operational question and source category.
2. Data classification, including whether prompt, response, tool, or personal content
   could be present.
3. Reader and writer RBAC, retention, sampling, and access review.
4. Daily-volume estimate, expected query or test frequency, monthly cost owner, and
   review date.
5. Alert severity, action group, runbook, and removal condition.

If any item is unknown, leave the optional module disabled.

## Foundry-specific response order

1. Check Azure Service Health and Resource Health for regional or service impact.
2. Check Activity Log for deployment, configuration, identity, or network changes.
3. Check supported Foundry metrics for request rate, availability, latency, error,
   throttling, token, or image-generation evidence.
4. Use approved diagnostics or Application Insights only if they were enabled and the
   data classification permits access.
5. Capture the outcome in the workload incident or operations record, then tune the
   metric threshold or runbook through source control if appropriate.
