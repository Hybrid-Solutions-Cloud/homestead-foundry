// Resource-group-scoped Cost Management budget (ADR-0006): notify-only
// backstop, actual alerts at 50/75/90/100 percent plus a 100 percent forecast
// alert, emailed straight to the owner (contactEmails, no action group, per
// the as-built). A synchronous spend cap belongs in the pipeline ledger, not
// here. Scoped to the RG, so a teardown of the RG removes it; no orphan.
param budgetName string

@minValue(1)
param amountUsd int

@minLength(1)
param contactEmails string[]

@description('First of a month, yyyy-MM-01. End date is omitted so Azure applies its default rolling window.')
param startDate string

resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: amountUsd
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: {
      actual50Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      actual75Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 75
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      actual90Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 90
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      actual100Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      forecast100Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
      }
    }
  }
}

output id string = budget.id
