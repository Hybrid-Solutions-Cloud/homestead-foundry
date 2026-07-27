param name string
param location string
param kind string
param applicationType string
param logAnalyticsWorkspaceResourceId string
param retentionInDays int
param samplingPercentage int
param disableLocalAuth bool
param publicNetworkAccessForIngestion string
param publicNetworkAccessForQuery string
param tags object

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: name
  location: location
  kind: kind
  tags: tags
  properties: {
    Application_Type: applicationType
    WorkspaceResourceId: logAnalyticsWorkspaceResourceId
    RetentionInDays: retentionInDays
    SamplingPercentage: samplingPercentage
    DisableLocalAuth: disableLocalAuth
    publicNetworkAccessForIngestion: publicNetworkAccessForIngestion
    publicNetworkAccessForQuery: publicNetworkAccessForQuery
  }
}

output id string = applicationInsights.id
