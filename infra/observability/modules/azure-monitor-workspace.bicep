param name string
param location string
param tags object

// Azure Monitor Workspace stores managed Prometheus data. Creation alone does
// not begin collection. This package deliberately creates no data collection
// rule or Kubernetes extension.
resource workspace 'Microsoft.Monitor/accounts@2023-04-03' = {
  name: name
  location: location
  tags: tags
  properties: {}
}

output id string = workspace.id
