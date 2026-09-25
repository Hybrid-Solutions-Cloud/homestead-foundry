// Compile a portable Grafana definition from private resource configuration.
import { readFileSync, writeFileSync } from 'node:fs';
const [configPath, outputPath] = process.argv.slice(2);
if (!configPath || !outputPath) throw new Error('Usage: node Build-OperationsDashboard.mjs config.json output.json');
const c = JSON.parse(readFileSync(configPath, 'utf8'));
const base = JSON.parse(readFileSync(new URL('../infra/observability/dashboards/foundry-model-usage.dashboard.json', import.meta.url), 'utf8'));
const datasource = { type: 'grafana-azure-monitor-datasource', uid: '${ds}' };
let nextId = 1, y = 0;
const panels = [];
function row(title) { panels.push({ id: nextId++, type: 'row', title, collapsed: false, gridPos: { x: 0, y: y++, w: 24, h: 1 }, panels: [] }); }
function logPanel(title, query, type = 'table', unit = 'short', description = '', dashboardTime = true) {
  panels.push({ id: nextId++, title, description, type, datasource,
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
row('Health and usage across all Foundry resources');
for (const id of [1, 2, 3, 4, 5, 6]) {
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
  p.description = 'Native metrics include both generations and both regions. The generation/model dropdowns apply to the detailed gateway telemetry panels below.';
  panels.push(p);
}
row('Inventory and migration');
const inventory = c.models.map(m => [m.deployment, m.backend, m.targetRegion, m.state, m.capacity].map((s, i) => i === 4 ? Number(s) : JSON.stringify(s)).join(',')).join(',\n');
logPanel('Deployment inventory and remaining migration work', `datatable(Model:string,ActiveBackend:string,TargetRegion:string,MigrationState:string,CapacityUnits:long)[${inventory}]`, 'table', 'short', 'Generated from verified deployment results; capacity units are model-specific, not directly comparable.');
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
row('Model Router, Priority and MCP');
logPanel('Auto selected-model distribution', requests + '\n| where Model == "model-router"\n| summarize Requests=count(), Input=sum(tolong(Measurements.inputTokens)), Output=sum(tolong(Measurements.outputTokens)), P95Ms=percentile(Duration,95) by Selected', 'table', 'short', 'Selected model comes from the provider response, never from a model self-description.');
logPanel('Requested versus served service tier', requests + '\n| summarize Requests=count(), P95Ms=percentile(Duration,95) by Model, Requested=tostring(Properties.requestedTier), Served=tostring(Properties.servedTier)');
logPanel('MCP and direct API calls', requests + '\n| summarize Requests=count(), Failures=countif(Status>=400), P95Ms=percentile(Duration,95) by Consumer, Model');
logPanel('MCP server lifecycle and Foundry call logs', `ContainerAppConsoleLogs_CL\n| where $__timeFilter(TimeGenerated)\n| where ContainerAppName_s == '${c.mcpAppName}'\n| where Log_s contains 'FoundryMcpCall'\n| extend Call=parse_json(Log_s)\n| project TimeGenerated, Model=tostring(Call.deployment), Selected=tostring(Call.selectedModel), DurationMs=todouble(Call.durationMs), Status=toint(Call.status), RequestId=tostring(Call.requestId)`);
row('Media and document operations');
logPanel('Non-chat API traffic and duration', requests + '\n| where tostring(Properties.api) !contains "chat/completions" and tostring(Properties.api) !contains "responses"\n| summarize Requests=count(), Failures=countif(Status>=400), P95Ms=percentile(Duration,95) by Api=tostring(Properties.api), Model', 'table', 'short', 'Job creation and polling are API operations. Provider job completion and media-unit counts require provider fields; request duration is not job duration.');
row('Actual costs and monitoring reliability');
const costs = `FoundryProductCost_CL
| summarize arg_max(TimeGenerated,*) by SourceScope
| mv-expand Row=CostQueryRows
| extend Names=CostQueryColumns
| mv-apply Column=Names on (summarize Columns=make_list(tostring(Column.name)))
| extend Cost=todouble(Row[array_index_of(Columns,'Cost')]), Currency=tostring(Row[array_index_of(Columns,'Currency')]), Resource=tostring(Row[array_index_of(Columns,'ResourceId')]), Meter=tostring(Row[array_index_of(Columns,'Meter')]), UsageDateText=tostring(Row[array_index_of(Columns,'UsageDate')])
| extend UsageDate=todatetime(strcat(substring(UsageDateText,0,4),'-',substring(UsageDateText,4,2),'-',substring(UsageDateText,6,2)))`;
logPanel('Actual product cost by resource and meter', costs + '\n| summarize Today=sumif(Cost,UsageDate>=startofday(now())), Last7Days=sumif(Cost,UsageDate>=startofday(now()-6d)), MonthToDate=sum(Cost) by Resource,Meter,Currency\n| order by MonthToDate desc', 'table', 'currencyUSD', 'Cost Management actual cost across old/new product and monitoring resource groups. Billed data is delayed. Meter names are preserved; no invented deployment attribution.', false);
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
const dashboard={ title:'Homestead Foundry operations', description:'Old/new environment coverage. Request metadata only; no prompt or response capture. Detailed timing is available on the instrumented gateway.', schemaVersion:41, version:1, refresh:'1m', timezone:'browser', time:{from:'now-24h',to:'now'}, editable:true, panels,
  templating:{list:[base.templating.list[0],variable('generation',['01','02']),variable('model',c.models.map(m=>m.deployment))]}, tags:['foundry','operations','migration','cost'] };
writeFileSync(outputPath,JSON.stringify(dashboard,null,2)+'\n');
console.log(`Generated ${panels.length} dashboard panels/rows.`);
