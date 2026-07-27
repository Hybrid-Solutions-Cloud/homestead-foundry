targetScope = 'subscription'

param name string
@minValue(1)
param amountUsd int
param startDate string
param actionGroupResourceId string
param contactEmail string

// Cost Management budgets alert on a roughly daily evaluation cadence. They do
// not prevent spend and are intentionally separate from the core RG budget.
resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: name
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
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: [
          contactEmail
        ]
      }
      actual75Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 75
        thresholdType: 'Actual'
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: [
          contactEmail
        ]
      }
      actual90Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 90
        thresholdType: 'Actual'
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: [
          contactEmail
        ]
      }
      actual100Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: [
          contactEmail
        ]
      }
      forecast100Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: [
          contactEmail
        ]
      }
    }
  }
}

output id string = budget.id
