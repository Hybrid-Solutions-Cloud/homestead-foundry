// Compile a portable Grafana definition from private resource configuration.
import { readFileSync, writeFileSync } from 'node:fs';
const [configPath, outputPath] = process.argv.slice(2);
if (!configPath || !outputPath) throw new Error('Usage: node Build-OperationsDashboard.mjs config.json output.json');
const c = JSON.parse(readFileSync(configPath, 'utf8'));
const base = JSON.parse(readFileSync(new URL('../infra/observability/dashboards/foundry-model-usage.dashboard.json', import.meta.url), 'utf8'));
const datasource = { type: 'grafana-azure-monitor-datasource', uid: '${ds}' };
let nextId = 1, y = 0;
// Panels added after the first release take ids from 200 so existing panel links stay stable.
let addedId = 200, adding = false;
const takeId = () => adding ? addedId++ : nextId++;
function added(build) { adding = true; try { build(); } finally { adding = false; } }
const panels = [];
function row(title) { panels.push({ id: takeId(), type: 'row', title, collapsed: false, gridPos: { x: 0, y: y++, w: 24, h: 1 }, panels: [] }); }
function logPanel(title, query, type = 'table', unit = 'short', description = '', dashboardTime = true) {
  panels.push({ id: takeId(), title, description, type, datasource,
    gridPos: { x: 0, y, w: 24, h: 8 },
    fieldConfig: { defaults: { unit }, overrides: [] },
    options: { legend: { showLegend: true, displayMode: 'table', placement: 'bottom' }, tooltip: { mode: 'multi' } },
    targets: [{ refId: 'A', datasource, queryType: 'Azure Log Analytics', subscription: c.subscriptionId,
      azureLogAnalytics: { query, resultFormat: type === 'timeseries' ? 'time_series' : 'table', resources: [c.workspaceId], dashboardTime } }],
  }); y += 8;
}
const requests = `AppEvents
| where Name == 'FoundryGatewayRequest'
| where $__timeFilter(TimeGenerated)
| extend Model=tostring(Properties.requestedModel), Selected=tostring(Properties.selectedModel), Backend=tostring(Properties.backend), Generation=tostring(Properties.backendGeneration), Consumer=tostring(Properties.consumer), Status=toint(Measurements.status), Duration=todouble(Measurements.durationMs), FirstToken=todouble(Measurements.firstTokenMs), Finish=tostring(Properties.finishReason)
| where Generation matches regex '\${generation:regex}' and Model matches regex '\${model:regex}'`;
// Native platform metrics for one metric across the configured accounts.
function metricPanel(title, metricName, { aggregation = 'Total', dimensions = [], alias, unit = 'short', description = '', accounts = c.accounts } = {}) {
  panels.push({ id: takeId(), title, description, type: 'timeseries', datasource,
    gridPos: { x: 0, y, w: 24, h: 8 },
    fieldConfig: { defaults: { unit }, overrides: [] },
    options: { legend: { showLegend: true, displayMode: 'table', placement: 'bottom', calcs: [aggregation === 'Average' ? 'mean' : 'sum'] }, tooltip: { mode: 'multi', sort: 'desc' } },
    targets: accounts.map((a, i) => ({ refId: `M${i}`, datasource, queryType: 'Azure Monitor', subscription: c.subscriptionId, alias: `${a.region}: ${alias}`,
      azureMonitor: { aggregation, allowedTimeGrainsMs: [], metricName, metricNamespace: 'Microsoft.CognitiveServices/accounts', region: a.region, timeGrain: 'auto', top: '50',
        dimensionFilters: dimensions.map(d => ({ dimension: d.name, filters: d.values || ['*'], operator: 'eq' })),
        resources: [{ metricNamespace: 'Microsoft.CognitiveServices/accounts', region: a.region, resourceGroup: a.resourceGroup, resourceName: a.name, subscription: c.subscriptionId }] } })),
  }); y += 8;
}
// A table that is absent from the workspace must leave a panel empty, not broken.
const optionalTable = (schema, ...tables) => `union isfuzzy=true (datatable(${schema})[]), ${tables.join(', ')}`;
// Deployment-to-group and deployment-to-capacity lookups come from private configuration, never from model self-description.
const defaultGroup = c.defaultProviderGroup || 'Azure direct';
const providerGroups = Object.fromEntries(c.models.filter(m => m.providerGroup).map(m => [m.deployment, m.providerGroup]));
const capacities = Object.fromEntries(c.models.filter(m => Number.isFinite(m.capacity) && m.chat !== false).map(m => [m.deployment, m.capacity]));
const lookups = `let providerOf = dynamic(${JSON.stringify(providerGroups)});\nlet capacityOf = dynamic(${JSON.stringify(capacities)});\n`;
const byProvider = lookups + requests + `\n| extend Provider=coalesce(tostring(providerOf[Model]), 'Unclassified')`;
const availability = optionalTable('TimeGenerated:datetime, Name:string, Success:bool, DurationMs:real, Location:string', 'AppAvailabilityResults');
added(() => {
  row('Gateway health at a glance');
  logPanel('Gateway availability test, last hour', availability + '\n| where TimeGenerated > ago(1h)\n| summarize AvailabilityPercent=round(100.0*countif(Success)/count(),1)', 'stat', 'percent', 'Synthetic probe of the gateway health endpoint from outside the deployment. Empty until an availability test is deployed. It proves the gateway process answers, not that every model behind it does.', false);
  logPanel('Gateway request success rate', requests + '\n| summarize SuccessPercent=round(100.0*countif(Status < 500 and tostring(Properties.streamInterrupted) != "true")/count(),1)', 'stat', 'percent', 'Share of real requests in the selected window that did not end in a server error, timeout or interrupted stream. Caller errors (4xx) are not counted as gateway failures.');
  logPanel('Minutes since the last gateway request', 'AppEvents\n| where Name == "FoundryGatewayRequest" and TimeGenerated > ago(7d)\n| summarize LastSeen=max(TimeGenerated)\n| project MinutesSinceLastRequest=datetime_diff("minute", now(), LastSeen)', 'stat', 'm', 'A quiet period is normal overnight. Read this with the availability test: no requests and a failing test means the gateway is down; no requests and a passing test means nobody is calling.', false);
  logPanel('Gateway availability test results', availability + '\n| where $__timeFilter(TimeGenerated)\n| summarize AvailabilityPercent=100.0*countif(Success)/count() by bin(TimeGenerated,15m), Location', 'timeseries', 'percent', 'Empty until an availability test is deployed.');
  logPanel('Cancelled, timed-out and interrupted requests', requests + '\n| extend Outcome=case(tostring(Properties.cancelled)=="true","client_cancelled",tostring(Properties.errorCode)=="timeout","timeout",tostring(Properties.streamInterrupted)=="true","stream_interrupted",Status>=500,"server_error","")\n| where isnotempty(Outcome)\n| summarize Requests=count() by bin(TimeGenerated,15m), Outcome', 'timeseries', 'short', 'A client that gives up before a long reasoning call finishes shows as client_cancelled, not as a model error.');
  logPanel('Retries, fallbacks, queueing and request shaping', requests + '\n| summarize Requests=count(), Retried=countif(tolong(Measurements.retries) > 0), Retries=sum(tolong(Measurements.retries)), FellBack=countif(isnotempty(tostring(Properties.fallbackTo))), FallbackTargets=make_set(tostring(Properties.fallbackTo), 5), QueuedP95Ms=percentile(todouble(Measurements.queuedMs),95), ParamsStripped=countif(isnotempty(tostring(Properties.strippedParams))), EffortInjected=countif(isnotempty(tostring(Properties.injectedReasoningEffort))), EffortClamped=countif(isnotempty(tostring(Properties.clampedReasoningEffort))) by Model\n| order by Retries desc, FellBack desc', 'table', 'short', 'What the gateway did on behalf of the caller. Rising retries or fallbacks on one deployment mean it is under rate-limit or reliability pressure even when callers still see success.');
  logPanel('Consumer coverage', 'AppEvents\n| where Name == "FoundryGatewayRequest" and TimeGenerated > ago(30d)\n| summarize LastSeen=max(TimeGenerated), Requests30d=count(), Requests24h=countif(TimeGenerated > ago(24h)) by Consumer=tostring(Properties.consumer)\n| extend HoursSinceLastSeen=datetime_diff("hour", now(), LastSeen)', 'table', 'short', 'One row per caller label. A label you expect (for example direct editor traffic) that is missing here is traffic the gateway cannot see.', false);
});
row('Health and usage across all Foundry resources');
for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const p = structuredClone(base.panels.find(x => x.id === id));
  p.id = nextId++; p.gridPos = { x: 0, y, w: 24, h: 8 }; y += 8;
  const original = p.targets;
  p.targets = c.accounts.flatMap((a, i) => original.map((t, j) => {
    const target = structuredClone(t); target.refId = `${i}-${j}`;
    target.alias = `${a.generation}/${a.region}: {{modeldeploymentname}}`;
    target.subscription = c.subscriptionId;
    target.azureMonitor.region = a.region; target.azureMonitor.top = '100';
    target.azureMonitor.resources = [{ metricNamespace: 'Microsoft.CognitiveServices/accounts', region: a.region,
      resourceGroup: a.resourceGroup, resourceName: a.name, subscription: c.subscriptionId }];
    return target;
  }));
  p.description = 'Native metrics include configured active accounts and regions. The generation/model dropdowns apply to the detailed gateway telemetry panels below.';
  if (id === 9) p.title = `Model inventory: request volume by deployment (${c.models.length} deployments)`;
  if (id === 10) { p.title = 'HTTP 400 requests by deployment'; p.description = 'All HTTP 400 responses. These include invalid requests and are not all guardrail blocks. See the provider-code panel for identified guardrail events.'; p.targets.forEach(t=>t.alias=t.alias.replace('Blocked:','HTTP 400:')); }
  panels.push(p);
}
nextId += 2; // Retired rollout heading/table IDs remain reserved for stable panel links.
logPanel('Traffic by backend and generation', requests + '\n| summarize Requests=count(), Failures=countif(Status >= 500), P95Ms=percentile(Duration,95) by Backend, Generation, Model');
row('Response timing, token use and completion reasons');
logPanel('First-token latency p50 and p95', requests + '\n| where isnotnull(FirstToken)\n| summarize P50=percentile(FirstToken,50), P95=percentile(FirstToken,95) by bin(TimeGenerated,5m), Model', 'timeseries', 'ms', 'Streaming requests only. Measures the first content/reasoning/tool-output delta, not the first network byte.');
logPanel('End-to-end latency p50 and p95', requests + '\n| summarize P50=percentile(Duration,50), P95=percentile(Duration,95) by bin(TimeGenerated,5m), Model', 'timeseries', 'ms');
logPanel('Generation speed', requests + '\n| extend TPS=todouble(Measurements.outputTokensPerSecond)\n| where isnotnull(TPS)\n| summarize MedianTPS=percentile(TPS,50), SlowTPS=percentile(TPS,5) by bin(TimeGenerated,5m), Model', 'timeseries', 'short', 'Requires streamed output plus provider-reported output usage. Missing measurements remain unavailable. Reasoning-inclusive usage can affect this estimate.');
logPanel('Input, output, cached and reasoning tokens', requests + '\n| summarize Input=sum(tolong(Measurements.inputTokens)), Output=sum(tolong(Measurements.outputTokens)), Cached=sum(tolong(Measurements.cachedTokens)), Reasoning=sum(tolong(Measurements.reasoningTokens)), Requests=count(), RequestsWithUsage=countif(isnotnull(Measurements.inputTokens)), RequestsWithCacheData=countif(isnotnull(Measurements.cachedTokens)), RequestsWithReasoningData=countif(isnotnull(Measurements.reasoningTokens)) by Model', 'table', 'short', 'Coverage columns distinguish missing fields from reported zero. Cached and reasoning tokens are subsets; do not add them to input/output totals.');
logPanel('Completion and stop reasons', requests + '\n| extend Reason=case(isnotempty(Finish),Finish,tostring(Properties.cancelled)=="true","client_cancelled",isnotempty(tostring(Properties.errorCode)),tostring(Properties.errorCode),"not_reported")\n| summarize Requests=count() by Model, Reason');
logPanel('Errors, timeouts, interrupted streams and guardrail blocks', requests + '\n| where Status >= 400 or tostring(Properties.streamInterrupted)=="true" or tostring(Properties.cancelled)=="true"\n| summarize Requests=count() by Model, Status, ErrorCode=tostring(Properties.errorCode), GuardrailBlocked=tostring(Properties.guardrailBlocked), Interrupted=tostring(Properties.streamInterrupted)');
logPanel('Output-limit and context-limit events', requests + '\n| where Finish in ("length","max_output_tokens") or tostring(Properties.errorCode) contains "context"\n| project TimeGenerated, Model, Finish, Error=tostring(Properties.errorCode), RequestedOutput=tolong(Measurements.requestedOutputTokens), Input=tolong(Measurements.inputTokens), Output=tolong(Measurements.outputTokens)');
logPanel('Per-minute observed load', requests + '\n| summarize Requests=count(), Tokens=sum(tolong(Measurements.totalTokens)), Throttles=countif(Status==429), Retries=sum(tolong(Measurements.retries)) by bin(TimeGenerated,1m), Model', 'timeseries', 'short', 'Observed gateway traffic is not Azure admission-control token estimation. Compare with deployment allocations and native throttling metrics.');
added(() => {
  logPanel('Rate-limit pressure by deployment', lookups + requests + '\n| summarize Tokens=sum(tolong(Measurements.totalTokens)), Reqs=count(), Throttled=countif(Status==429), Reasoning=sum(tolong(Measurements.reasoningTokens)), Output=sum(tolong(Measurements.outputTokens)) by bin(TimeGenerated,1m), Model\n| summarize PeakTokensPerMinute=max(Tokens), PeakRequestsPerMinute=max(Reqs), Requests=sum(Reqs), Throttled=sum(Throttled), Reasoning=sum(Reasoning), Output=sum(Output) by Model\n| extend AllocatedTokensPerMinute=tolong(capacityOf[Model])*1000\n| extend PeakPercentOfAllocation=round(100.0*PeakTokensPerMinute/AllocatedTokensPerMinute,1), ReasoningPercentOfOutput=round(100.0*Reasoning/Output,1)\n| project Model, Requests, Throttled, PeakTokensPerMinute, AllocatedTokensPerMinute, PeakPercentOfAllocation, PeakRequestsPerMinute, ReasoningPercentOfOutput\n| order by Throttled desc, PeakPercentOfAllocation desc', 'table', 'short', 'Observed completed-token peaks against the configured allocation. The service admits requests on its own estimate, so throttling can start below 100 percent. Deployments that share a quota pool compete for one allowance; read them together.');
});
row('Model Router, Priority and MCP');
added(() => {
  const router = c.routerDeployment || 'model-router';
  const routerAccounts = c.accounts.filter(a => !c.routerRegions || c.routerRegions.includes(a.region));
  const routed = [{ name: 'ModelDeploymentName', values: [router] }, { name: 'ModelName' }];
  metricPanel('Model Router requests by underlying model', 'ModelRouterRequests', { dimensions: routed, alias: '{{modelname}}', accounts: routerAccounts, description: 'Native platform metric, so it includes router traffic that bypasses the gateway.' });
  metricPanel('Model Router fallbacks by underlying model', 'ModelRouterFallbackCount', { dimensions: routed, alias: 'fallback: {{modelname}}', accounts: routerAccounts, description: 'Requests the router had to move to an alternative model.' });
  metricPanel('Model Router routing-decision latency', 'ModelRouterLatency', { aggregation: 'Average', dimensions: [{ name: 'ModelDeploymentName', values: [router] }, { name: 'RouterMode' }], alias: '{{routermode}}', unit: 'ms', accounts: routerAccounts, description: 'Time the router spends choosing a model, before the chosen model starts work.' });
  metricPanel('Model Router input tokens by underlying model', 'ModelRouterInputTokens', { dimensions: routed, alias: 'input: {{modelname}}', accounts: routerAccounts });
  metricPanel('Model Router output tokens by underlying model', 'ModelRouterOutputTokens', { dimensions: routed, alias: 'output: {{modelname}}', accounts: routerAccounts });
  logPanel('Model Router health through the gateway', requests + '\n| where Model == "' + router + '"\n| summarize Requests=count(), Errors=countif(Status>=400), P95Ms=percentile(Duration,95) by bin(TimeGenerated,15m)', 'timeseries', 'short', 'Requests, errors and latency for router calls that pass through the gateway.');
});
logPanel('Auto selected-model distribution', requests + '\n| where Model == "model-router"\n| summarize Requests=count(), Input=sum(tolong(Measurements.inputTokens)), Output=sum(tolong(Measurements.outputTokens)), P95Ms=percentile(Duration,95) by Selected', 'table', 'short', 'Selected model comes from the provider response, never from a model self-description.');
logPanel('Requested versus served service tier', requests + '\n| summarize Requests=count(), P95Ms=percentile(Duration,95) by Model, Requested=tostring(Properties.requestedTier), Served=tostring(Properties.servedTier)');
logPanel('MCP and direct API calls', requests + '\n| summarize Requests=count(), Failures=countif(Status>=400), P95Ms=percentile(Duration,95) by Consumer, Model');
logPanel('Caller / consumer breakdown (gateway)', requests + '\n| summarize Requests=count(), Input=sum(tolong(Measurements.inputTokens)), Output=sum(tolong(Measurements.outputTokens)) by Consumer, Model', 'table', 'short', 'Consumer is the gateway API/MCP label, not an authenticated individual user identity.');
logPanel('MCP server Foundry call logs', `workspace('${c.mcpWorkspaceId || c.workspaceId}').ContainerAppConsoleLogs_CL\n| where $__timeFilter(TimeGenerated)\n| where ContainerAppName_s == '${c.mcpAppName}'\n| where Log_s contains 'FoundryMcpCall'\n| extend Call=parse_json(Log_s)\n| project TimeGenerated, Model=tostring(Call.deployment), Selected=tostring(Call.selectedModel), DurationMs=todouble(Call.durationMs), Status=toint(Call.status), RequestId=tostring(Call.requestId)`);
added(() => {
  row('Model providers: Azure direct and partner-hosted');
  logPanel('Usage by provider group', byProvider + '\n| summarize Requests=count(), Failures=countif(Status>=400), Throttled=countif(Status==429), Input=sum(tolong(Measurements.inputTokens)), Output=sum(tolong(Measurements.outputTokens)), Reasoning=sum(tolong(Measurements.reasoningTokens)), P95Ms=percentile(Duration,95), Deployments=dcount(Model) by Provider\n| order by Requests desc', 'table', 'short', 'Provider group is assigned per deployment in private configuration. Unclassified means a deployment is missing from that configuration.');
  logPanel('Requests by provider group', byProvider + '\n| summarize Requests=count() by bin(TimeGenerated,15m), Provider', 'timeseries');
  logPanel('Tokens by provider group', byProvider + '\n| summarize Tokens=sum(tolong(Measurements.totalTokens)) by bin(TimeGenerated,15m), Provider', 'timeseries');
  const partner = c.models.filter(m => m.providerGroup && m.providerGroup !== defaultGroup);
  if (partner.length) {
    logPanel('Partner-hosted deployments in detail', byProvider + '\n| where Provider != "' + defaultGroup + '" and Provider != "Unclassified"\n| summarize Requests=count(), Failures=countif(Status>=400), Throttled=countif(Status==429), Input=sum(tolong(Measurements.inputTokens)), Output=sum(tolong(Measurements.outputTokens)), Reasoning=sum(tolong(Measurements.reasoningTokens)), P50Ms=percentile(Duration,50), P95Ms=percentile(Duration,95), LastUsed=max(TimeGenerated) by Provider, Model\n| order by Requests desc', 'table', 'short', 'Per-deployment view of models served by a partner runtime inside the Foundry account.');
    const names = partner.map(m => m.deployment);
    metricPanel('Partner-hosted requests (native metric)', 'ModelRequests', { dimensions: [{ name: 'ModelDeploymentName', values: names }], alias: '{{modeldeploymentname}}', description: 'Counts every call the platform received for these deployments, including calls that bypass the gateway.' });
    metricPanel('Partner-hosted tokens (native metric)', 'TotalTokens', { dimensions: [{ name: 'ModelDeploymentName', values: names }], alias: '{{modeldeploymentname}}' });
    metricPanel('Partner-hosted throttles (native metric)', 'ModelRequests', { dimensions: [{ name: 'ModelDeploymentName', values: names }, { name: 'StatusCode', values: ['429'] }], alias: 'throttled: {{modeldeploymentname}}', description: 'Partner-hosted deployments can share one quota pool, so a throttle on one may be caused by load on another.' });
  }
  row('Foundry MCP Server and control-plane changes');
  const mcpApp = c.foundryMcpAppId || 'fcdfa2de-b65b-4b54-9a1c-81c8a18282d9'; // Published application id of the hosted Foundry MCP Server.
  const activity = optionalTable('TimeGenerated:datetime, ResourceProviderValue:string, CategoryValue:string, OperationNameValue:string, ActivityStatusValue:string, Caller:string, Claims:string', 'AzureActivity') + '\n| where $__timeFilter(TimeGenerated)\n| where CategoryValue =~ "Administrative" and ResourceProviderValue =~ "MICROSOFT.COGNITIVESERVICES"\n| where ActivityStatusValue in~ ("Success","Failure")\n| where OperationNameValue endswith "/WRITE" or OperationNameValue endswith "/DELETE" or OperationNameValue endswith "/ACTION"\n| extend ClientAppId=tostring(parse_json(Claims).appid)\n| extend Client=iff(ClientAppId == "' + mcpApp + '", "Foundry MCP Server", "Other client")';
  logPanel('Foundry resource changes by client', activity + '\n| project TimeGenerated, Client, Operation=OperationNameValue, Status=ActivityStatusValue, Resource=tostring(split(tostring(column_ifexists("_ResourceId","")),"/providers/")[1]), Caller, ClientAppId\n| order by TimeGenerated desc', 'table', 'short', 'Creates, updates, deletes and actions on Foundry resources from the Azure Activity Log. Requires the subscription Activity Log to be exported to this workspace. Read-only MCP tools leave no Activity Log record.');
  logPanel('Foundry resource changes over time', activity + '\n| summarize Changes=count() by bin(TimeGenerated,1h), Client', 'timeseries');
  logPanel('Foundry MCP Server sign-ins', optionalTable('TimeGenerated:datetime, AppId:string, ResourceIdentity:string, ResultType:string, AppDisplayName:string', 'SigninLogs', 'AADNonInteractiveUserSignInLogs') + '\n| where $__timeFilter(TimeGenerated)\n| where AppId == "' + mcpApp + '" or ResourceIdentity == "' + mcpApp + '"\n| summarize SignIns=count(), Failures=countif(ResultType != "0"), LastSeen=max(TimeGenerated) by ClientApp=AppDisplayName', 'table', 'short', 'Token requests for the hosted Foundry MCP Server, by the client that asked. Requires Microsoft Entra sign-in logs to be exported to this workspace; empty otherwise. The service is Microsoft-hosted and publishes no per-tool telemetry to the customer.');
  const retiring = c.models.filter(m => m.retirementDate);
  if (retiring.length) {
    row('Model lifecycle');
    logPanel('Retirement countdown', 'datatable(Deployment:string, Retires:datetime, Successor:string)[' + retiring.map(m => `"${m.deployment}", datetime(${m.retirementDate}), "${m.successor || ''}"`).join(', ') + ']\n| extend DaysLeft=datetime_diff("day", Retires, now())\n| order by DaysLeft asc', 'table', 'short', 'Dates are copied from private configuration when the dashboard is generated. Regenerate after any change to the registry.', false);
  }
});
row('Media and document operations');
logPanel('Non-chat API traffic and duration', requests + '\n| where tostring(Properties.api) !contains "chat/completions" and tostring(Properties.api) !contains "responses"\n| summarize Requests=count(), Failures=countif(Status>=400), P95Ms=percentile(Duration,95) by Api=tostring(Properties.api), Model', 'table', 'short', 'Job creation and polling are API operations. Provider job completion and media-unit counts require provider fields; request duration is not job duration.');
row('Actual costs and monitoring reliability');
const costs = `union isfuzzy=true (FoundryProductCost_CL | summarize arg_max(TimeGenerated,*) by SourceScope), (FoundryModelCost_CL | top 1 by TimeGenerated desc | extend SourceScope='retired-environment-snapshot')
| mv-expand Row=CostQueryRows
| extend Names=CostQueryColumns
| mv-apply Column=Names on (summarize Columns=make_list(tostring(Column.name)))
| extend Cost=todouble(Row[array_index_of(Columns,'Cost')]), Currency=tostring(Row[array_index_of(Columns,'Currency')]), Resource=iff(array_index_of(Columns,'ResourceId')<0,'Retired Foundry (historical snapshot)',tostring(Row[array_index_of(Columns,'ResourceId')])), Meter=tostring(Row[array_index_of(Columns,'Meter')]), UsageDateText=tostring(Row[array_index_of(Columns,'UsageDate')])
| extend UsageDate=todatetime(strcat(substring(UsageDateText,0,4),'-',substring(UsageDateText,4,2),'-',substring(UsageDateText,6,2)))`;
for (const [title, condition] of [['Actual cost today','UsageDate>=startofday(now())'],['Actual cost, last 7 days','UsageDate>=startofday(now()-6d)'],['Actual cost, month to date','UsageDate>=startofmonth(now())']]) {
  logPanel(title, costs + `\n| summarize Cost=sumif(Cost,${condition}) by Currency`, 'stat', 'currencyUSD', 'Includes configured product and shared-platform groups. Billing data is delayed.', false);
}
logPanel('Billed usage and actual cost by model meter', costs + '\n| extend BilledUsage=todouble(Row[array_index_of(Columns,"UsageQuantity")])\n| extend TokenScale=case(Meter contains "1M Tokens",1000000.0,Meter contains "1K Tokens",1000.0,real(null))\n| extend BilledTokens=BilledUsage*TokenScale\n| summarize TodayCost=sumif(Cost,UsageDate>=startofday(now())), Last7DaysCost=sumif(Cost,UsageDate>=startofday(now()-6d)), MonthCost=sumif(Cost,UsageDate>=startofmonth(now())), MonthBilledUsage=sumif(BilledUsage,UsageDate>=startofmonth(now())), MonthBilledTokens=sumif(BilledTokens,UsageDate>=startofmonth(now())), TokenUnitKnown=countif(isnotnull(TokenScale)) by Resource,Meter,Currency\n| order by MonthCost desc', 'table', 'short', 'Billing meters identify the billed model/product. Token conversion only uses explicit 1M/1K token meter units; TokenUnitKnown distinguishes unavailable conversion from zero. Non-token media/service quantities are not labeled tokens.', false);
if ((c.providerMeterPatterns || []).length) added(() => {
  const cases = c.providerMeterPatterns.map(p => `Meter matches regex "${p.pattern}", "${p.group}"`).join(', ');
  logPanel('Month-to-date actual cost by provider group', costs + '\n| where UsageDate>=startofmonth(now())\n| extend Provider=case(' + cases + ', "' + defaultGroup + '")\n| summarize Cost=sum(Cost) by Provider, Currency\n| order by Cost desc', 'barchart', 'currencyUSD', 'Grouped by billing-meter name patterns from private configuration. Verify the patterns against real meter names before relying on the split.', false);
});
logPanel('Daily actual cost by model meter', costs + '\n| summarize Cost=sum(Cost) by UsageDate,Meter,Currency\n| order by UsageDate asc', 'timeseries', 'currencyUSD', 'Billing-meter attribution, not a guessed deployment mapping.', false);
logPanel('Month-to-date actual cost by model meter', costs + '\n| where UsageDate>=startofmonth(now())\n| summarize Cost=sum(Cost) by Meter,Currency\n| order by Cost desc', 'barchart', 'currencyUSD', 'Billing-meter attribution, not a guessed deployment mapping.', false);
logPanel('Actual product and shared-platform cost by resource and meter', costs + '\n| summarize Today=sumif(Cost,UsageDate>=startofday(now())), Last7Days=sumif(Cost,UsageDate>=startofday(now()-6d)), MonthToDate=sumif(Cost,UsageDate>=startofmonth(now())) by Resource,Meter,Currency\n| order by MonthToDate desc', 'table', 'currencyUSD', 'Billed data is delayed. Shared monitoring/MCP groups include costs for other consumers. Resource and meter names are preserved; no invented deployment attribution.', false);
logPanel('Daily actual product cost', costs + '\n| summarize Cost=sum(Cost) by UsageDate,Currency,Resource\n| order by UsageDate asc', 'timeseries', 'currencyUSD', '', false);
logPanel('Cost collector freshness', 'FoundryProductCost_CL\n| summarize LastSnapshot=max(TimeGenerated) by SourceScope\n| extend AgeHours=datetime_diff("minute",now(),LastSnapshot)/60.0', 'table', 'short', 'Snapshots refresh every four hours; billing data has additional delay.', false);
logPanel('Gateway telemetry freshness and field coverage', 'AppEvents\n| where Name=="FoundryGatewayRequest"\n| summarize LastSeen=max(TimeGenerated),Requests=count(),Streaming=countif(tostring(Properties.streaming)=="true"),WithUsage=countif(isnotnull(Measurements.inputTokens)),WithFirstToken=countif(isnotnull(Measurements.firstTokenMs)) by AppRoleName', 'table', 'short', '', false);
logPanel('Log ingestion by table', 'Usage\n| where $__timeFilter(TimeGenerated)\n| where IsBillable==true\n| summarize IngestedMB=sum(Quantity) by DataType', 'table', 'decmbytes');
logPanel('Workspace ingestion interruptions', 'Operation\n| where $__timeFilter(TimeGenerated)\n| where OperationCategory == "Data Collection Status"\n| project TimeGenerated, OperationStatus, Detail', 'table');
row('Gateway infrastructure');
for (const id of [13,14,15,16]) {
  const p=structuredClone(base.panels.find(x=>x.id===id)); p.id=nextId++;p.gridPos={x:0,y,w:24,h:8};y+=8;
  const original=p.targets;
  p.targets=c.gateways.flatMap((g,i)=>original.map((t,j)=>{
    const v=structuredClone(t);v.refId=`${i}-${j}`;v.alias=`${g.generation}: ${t.alias}`;v.subscription=c.subscriptionId;
    v.azureMonitor.region=g.region;v.azureMonitor.resources=[{metricNamespace:'Microsoft.Web/sites',region:g.region,resourceGroup:g.resourceGroup,resourceName:g.name,subscription:c.subscriptionId}];return v;
  }));panels.push(p);
}
const variable = (name, values) => ({ name, type:'custom', query:values.join(','), multi:true, includeAll:true, allValue:'.*', current:{text:'All',value:'$__all'}, options:[] });
// Keep charts readable without making every panel occupy a full screen row.
const wideTables = new Set([
  'Input, output, cached and reasoning tokens',
  'Billed usage and actual cost by model meter',
  'Actual product and shared-platform cost by resource and meter',
  'MCP server Foundry call logs',
  'Retries, fallbacks, queueing and request shaping',
  'Rate-limit pressure by deployment',
  'Usage by provider group',
  'Partner-hosted deployments in detail',
  'Foundry resource changes by client',
]);
const layout = [];
let layoutY = 0, section = [];
function flushSection() {
  const rank = p => p.type === 'stat' ? 0 : ['timeseries','barchart'].includes(p.type) ? 1 : wideTables.has(p.title) ? 3 : 2;
  section.sort((a,b) => rank(a)-rank(b));
  let x = 0, height = 0;
  for (const p of section) {
    const w = p.type === 'stat' ? 8 : wideTables.has(p.title) ? 24 : 12;
    const h = p.type === 'stat' ? 5 : wideTables.has(p.title) ? 10 : 8;
    if (x + w > 24) { layoutY += height; x = 0; height = 0; }
    p.gridPos = { x, y: layoutY, w, h };
    layout.push(p); x += w; height = Math.max(height,h);
    if (x === 24) { layoutY += height; x = 0; height = 0; }
  }
  if (x) layoutY += height;
  section = [];
}
for (const p of panels) {
  if (p.type !== 'row') { section.push(p); continue; }
  flushSection(); p.gridPos = { x:0, y:layoutY++, w:24, h:1 }; layout.push(p);
}
flushSection();
panels.splice(0,panels.length,...layout);
const dashboard={ title:'Homestead Foundry operations', description:'Active environment coverage. Request metadata only; no prompt or response capture. Detailed timing is available on the instrumented gateway.', schemaVersion:41, version:1, refresh:'1m', timezone:'browser', time:{from:'now-24h',to:'now'}, editable:true, panels,
  templating:{list:[base.templating.list[0],variable('generation',[...new Set(c.accounts.map(a=>a.generation))]),variable('model',c.models.map(m=>m.deployment))]}, tags:['foundry','operations','cost'] };
writeFileSync(outputPath,JSON.stringify(dashboard,null,2)+'\n');
console.log(`Generated ${panels.length} dashboard panels/rows.`);
