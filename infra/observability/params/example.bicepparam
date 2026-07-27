using '../main.bicep'

// Example only. Copy to a private *.local.bicepparam file and replace every
// placeholder before running what-if or deployment.
param workload = 'exampleai'
param env = 'prod'
param regionToken = 'eus'
param instance = '01'
param location = 'eastus'
param ownerAlias = 'REPLACE-owner-alias'
param project = 'REPLACE-project-name'
param costCenter = 'REPLACE-cost-center'
param lifecycle = 'permanent'
param operationsEmails = [
  'REPLACE-operations-email@example.invalid'
]
param actionGroupShortName = 'foundry-obs'
param monthlyCreditBudgetUsd = 1000
param budgetActualAlertThresholds = {
  low: 10
  medium: 25
  high: 50
}
param logAnalyticsRetentionInDays = 30
param logAnalyticsDailyQuotaGb = 1
param deployGrafanaDashboardShell = true
