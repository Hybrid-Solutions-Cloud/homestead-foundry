using '../main.bicep'

// Public, fictitious example only. Copy this file to an ignored private overlay
// and replace every example value before a what-if or deployment.
param workload = 'example'
param environment = 'dev'
param regionCode = 'eus'
param instance = '01'
param location = 'eastus'
param ownerAlias = 'example-owner'
param project = 'example-foundry'
param costCenter = 'example-cost-center'
param lifecycle = 'permanent'
param expiresOn = ''
param managedBy = 'bicep'

param operationsEmails = [
  'operations@example.invalid'
]
param actionGroupShortName = 'fdry-alerts'
param actionGroupLocation = 'global'

param monthlyBudgetUsd = 100
param budgetName = 'budget-example-credit-sub-01'
param budgetStartDate = '2026-01-01'
param budgetEndDate = '2036-01-01T00:00:00Z'
param budgetActualAlertThresholds = {
  low: 10
  medium: 25
  high: 50
}
param enableBudgetForecastNotifications = false
param budgetForecastAlertThresholds = {
  low: 10
  medium: 25
  high: 50
}

param logAnalyticsSkuName = 'PerGB2018'
param azureMonitorWorkspacePublicNetworkAccess = 'Enabled'
param logAnalyticsRetentionInDays = 30
param logAnalyticsDailyQuotaGb = 1
param deployGrafanaDashboardShell = true
param deployGrafanaDashboardDefinitionPreview = false
param grafanaDashboardDefinitionName = 'definition'
param grafanaDashboardDefinitionSerializedData = ''

param alertRuleLocation = 'global'
param enableActivityLogAlerts = false
param activityLogAlertDefinitions = []
param enableMetricAlerts = false
param metricAlertDefinitions = []
param enableAlertProcessingRules = false
param alertProcessingRuleDefinitions = []

param enableFoundryDiagnosticSetting = false
param foundryDiagnosticSetting = {}
param enableApplicationInsights = false
param applicationInsightsConfiguration = {}
param enableAvailabilityTests = false
param availabilityTestDefinitions = []
param enableScheduledQueryAlerts = false
param scheduledQueryAlertDefinitions = []
