targetScope = 'subscription'

param name string
@minValue(1)
param amountUsd int
param startDate string
param actionGroupResourceId string
param contactEmails string[]
param actualAlertThresholds object

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
      actualLow: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: actualAlertThresholds.low
        thresholdType: 'Actual'
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: contactEmails
      }
      actualMedium: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: actualAlertThresholds.medium
        thresholdType: 'Actual'
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: contactEmails
      }
      actualHigh: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: actualAlertThresholds.high
        thresholdType: 'Actual'
        contactGroups: [
          actionGroupResourceId
        ]
        contactEmails: contactEmails
      }
    }
  }
}

output id string = budget.id
