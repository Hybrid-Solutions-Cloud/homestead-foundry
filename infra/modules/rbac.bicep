// Two-security-group, least-privilege data-plane RBAC on the account scope
// (ADR-0005 as amended by the as-built: group-assigned, not direct-assigned).
// Deliberately not granted, per ADR-0005: Contributor to the pipeline
// identity, generic Owner or Contributor for the Speech data plane, and
// Cognitive Services Speech Contributor.
param accountName string

param imageUsersGroupObjectId string
param speechUsersGroupObjectId string

// Built-in role definition ids, verified against Microsoft Learn 2026-07-23.
var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var cognitiveServicesSpeechUserRoleId = 'f2dc8367-1007-4938-bd23-fe263f013447'

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: accountName
}

// principalType Group skips the Graph principal lookup that hit an Entra
// replication delay (PrincipalNotFound) on the Phase 8 manual deploy.
resource imageUsers 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, cognitiveServicesUserRoleId, imageUsersGroupObjectId)
  scope: account
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalId: imageUsersGroupObjectId
    principalType: 'Group'
  }
}

resource speechUsers 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, cognitiveServicesSpeechUserRoleId, speechUsersGroupObjectId)
  scope: account
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesSpeechUserRoleId)
    principalId: speechUsersGroupObjectId
    principalType: 'Group'
  }
}

output imageUsersRoleAssignmentId string = imageUsers.id
output speechUsersRoleAssignmentId string = speechUsers.id
