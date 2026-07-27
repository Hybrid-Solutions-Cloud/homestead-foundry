targetScope = 'subscription'

param name string
param amountUsd int
param startDate string
param actionGroupResourceId string
param contactEmails string[]
param actualAlertThresholds object
param enableForecastNotifications bool
param forecastAlertThresholds object

var actualNotifications = {
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

var forecastNotifications = !enableForecastNotifications ? {} : {
  forecastLow: {
    enabled: true
    operator: 'GreaterThanOrEqualTo'
    threshold: forecastAlertThresholds.low
    thresholdType: 'Forecasted'
    contactGroups: [
      actionGroupResourceId
    ]
    contactEmails: contactEmails
  }
  forecastMedium: {
    enabled: true
    operator: 'GreaterThanOrEqualTo'
    threshold: forecastAlertThresholds.medium
    thresholdType: 'Forecasted'
    contactGroups: [
      actionGroupResourceId
    ]
    contactEmails: contactEmails
  }
  forecastHigh: {
    enabled: true
    operator: 'GreaterThanOrEqualTo'
    threshold: forecastAlertThresholds.high
    thresholdType: 'Forecasted'
    contactGroups: [
      actionGroupResourceId
    ]
    contactEmails: contactEmails
  }
}

resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: name
  properties: {
    category: 'Cost'
    amount: amountUsd
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: union(actualNotifications, forecastNotifications)
  }
}

output id string = budget.id
