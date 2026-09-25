targetScope = 'subscription'
param name string
param amount int
param resourceGroups array
param recipients array
param startDate string
param actionGroupId string
resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: name
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: { startDate: startDate }
    filter: { dimensions: { name: 'ResourceGroupName', operator: 'In', values: resourceGroups } }
    notifications: {
      actual50: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 50, thresholdType: 'Actual', contactEmails: recipients, contactGroups: [actionGroupId] }
      actual75: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 75, thresholdType: 'Actual', contactEmails: recipients, contactGroups: [actionGroupId] }
      actual90: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 90, thresholdType: 'Actual', contactEmails: recipients, contactGroups: [actionGroupId] }
      actual100: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, thresholdType: 'Actual', contactEmails: recipients, contactGroups: [actionGroupId] }
      forecast100: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, thresholdType: 'Forecasted', contactEmails: recipients, contactGroups: [actionGroupId] }
    }
  }
}
