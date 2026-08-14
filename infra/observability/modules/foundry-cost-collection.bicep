@description('Name of the existing Log Analytics workspace that stores Foundry cost snapshots.')
param logAnalyticsWorkspaceName string

@description('Azure region shared by the workspace, data collection rule, and workflow.')
param location string

@description('Tags applied to the cost collection resources.')
param tags object

@description('Subscription that contains the monitored Foundry resource group.')
param targetSubscriptionId string

@description('Resource group used as the Cost Management query scope.')
param targetResourceGroupName string

@minValue(1)
@maxValue(24)
@description('Collection interval in hours. Cost Management data normally lags by several hours.')
param collectionIntervalHours int = 4

@minValue(30)
@description('Retention period for compact cost snapshots in Log Analytics.')
param retentionInDays int = 30

@description('CAF-derived name for the cost snapshot Logic App.')
param workflowName string

@description('CAF-derived name for the direct-ingestion data collection rule.')
param dataCollectionRuleName string

var tableName = 'FoundryModelCost_CL'
var streamName = 'Custom-FoundryModelCost_CL'
var destinationName = 'foundryCostWorkspace'
var monitoringMetricsPublisherRoleId = '3913510d-42f4-4e42-8a64-420c390055eb'
var costQueryScope = 'subscriptions/${targetSubscriptionId}/resourceGroups/${targetResourceGroupName}'

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource costTable 'Microsoft.OperationalInsights/workspaces/tables@2023-09-01' = {
  parent: workspace
  name: tableName
  properties: {
    plan: 'Analytics'
    retentionInDays: retentionInDays
    totalRetentionInDays: retentionInDays
    schema: {
      name: tableName
      columns: [
        {
          name: 'TimeGenerated'
          type: 'datetime'
        }
        {
          name: 'PeriodStart'
          type: 'datetime'
        }
        {
          name: 'PeriodEnd'
          type: 'datetime'
        }
        {
          name: 'CostQueryColumns'
          type: 'dynamic'
        }
        {
          name: 'CostQueryRows'
          type: 'dynamic'
        }
      ]
    }
  }
}

resource costDataCollectionRule 'Microsoft.Insights/dataCollectionRules@2024-03-11' = {
  name: dataCollectionRuleName
  location: location
  kind: 'Direct'
  tags: tags
  properties: {
    description: 'Receives compact Cost Management ActualCost snapshots for the Foundry model dashboard.'
    streamDeclarations: {
      '${streamName}': {
        columns: [
          {
            name: 'TimeGenerated'
            type: 'datetime'
          }
          {
            name: 'PeriodStart'
            type: 'datetime'
          }
          {
            name: 'PeriodEnd'
            type: 'datetime'
          }
          {
            name: 'CostQueryColumns'
            type: 'dynamic'
          }
          {
            name: 'CostQueryRows'
            type: 'dynamic'
          }
        ]
      }
    }
    destinations: {
      logAnalytics: [
        {
          name: destinationName
          workspaceResourceId: workspace.id
        }
      ]
    }
    dataFlows: [
      {
        streams: [
          streamName
        ]
        destinations: [
          destinationName
        ]
        transformKql: 'source'
        outputStream: streamName
      }
    ]
  }
  dependsOn: [
    costTable
  ]
}

resource costCollectionWorkflow 'Microsoft.Logic/workflows@2019-05-01' = {
  name: workflowName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      triggers: {
        Every_collection_interval: {
          type: 'Recurrence'
          recurrence: {
            frequency: 'Hour'
            interval: collectionIntervalHours
          }
        }
      }
      actions: {
        Query_Foundry_model_cost: {
          type: 'Http'
          inputs: {
            authentication: {
              type: 'ManagedServiceIdentity'
              audience: environment().resourceManager
            }
            method: 'POST'
            uri: '${environment().resourceManager}${costQueryScope}/providers/Microsoft.CostManagement/query?api-version=2025-03-01'
            headers: {
              'Content-Type': 'application/json'
            }
            body: {
              type: 'ActualCost'
              timeframe: 'Custom'
              timePeriod: {
                from: '@{formatDateTime(utcNow(),\'yyyy-MM-01T00:00:00Z\')}'
                to: '@{utcNow()}'
              }
              dataset: {
                granularity: 'Daily'
                aggregation: {
                  cost: {
                    name: 'Cost'
                    function: 'Sum'
                  }
                  usage: {
                    name: 'UsageQuantity'
                    function: 'Sum'
                  }
                }
                filter: {
                  dimensions: {
                    name: 'ServiceName'
                    operator: 'In'
                    values: [
                      'Foundry Models'
                    ]
                  }
                }
                grouping: [
                  {
                    type: 'Dimension'
                    name: 'Meter'
                  }
                ]
              }
            }
            retryPolicy: {
              type: 'exponential'
              count: 4
              interval: 'PT30S'
              minimumInterval: 'PT30S'
              maximumInterval: 'PT5M'
            }
          }
        }
        Ingest_cost_snapshot: {
          type: 'Http'
          runAfter: {
            Query_Foundry_model_cost: [
              'Succeeded'
            ]
          }
          inputs: {
            authentication: {
              type: 'ManagedServiceIdentity'
              audience: 'https://monitor.azure.com'
            }
            method: 'POST'
            uri: '${costDataCollectionRule.properties.endpoints.logsIngestion}/dataCollectionRules/${costDataCollectionRule.properties.immutableId}/streams/${streamName}?api-version=2023-01-01'
            headers: {
              'Content-Type': 'application/json'
            }
            body: [
              {
                TimeGenerated: '@{utcNow()}'
                PeriodStart: '@{formatDateTime(utcNow(),\'yyyy-MM-01T00:00:00Z\')}'
                PeriodEnd: '@{utcNow()}'
                CostQueryColumns: '@body(\'Query_Foundry_model_cost\')?[\'properties\']?[\'columns\']'
                CostQueryRows: '@body(\'Query_Foundry_model_cost\')?[\'properties\']?[\'rows\']'
              }
            ]
            retryPolicy: {
              type: 'exponential'
              count: 4
              interval: 'PT30S'
              minimumInterval: 'PT30S'
              maximumInterval: 'PT5M'
            }
          }
        }
      }
      outputs: {}
    }
    parameters: {}
  }
}

resource ingestionPublisherRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(costDataCollectionRule.id, monitoringMetricsPublisherRoleId, costCollectionWorkflow.id)
  scope: costDataCollectionRule
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', monitoringMetricsPublisherRoleId)
    principalId: costCollectionWorkflow.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output workflowPrincipalId string = costCollectionWorkflow.identity.principalId
output workflowResourceId string = costCollectionWorkflow.id
output dataCollectionRuleId string = costDataCollectionRule.id
output logAnalyticsTableName string = tableName
