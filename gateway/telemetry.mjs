// Request metadata only. Never record prompts, completions, headers or raw errors.
export class UsageObserver {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.started = now();
    this.buffer = '';
    this.decoder = new TextDecoder();
    this.data = {};
    this.terminal = false;
  }
  json(value) {
    const response = value.response || value;
    if (response.model) this.data.selectedModel = response.model;
    if (response.service_tier) this.data.servedTier = response.service_tier;
    const usage = response.usage;
    if (usage) {
      const fields = {
        inputTokens: usage.input_tokens ?? usage.prompt_tokens,
        outputTokens: usage.output_tokens ?? usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cachedTokens: usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens,
        reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? usage.completion_tokens_details?.reasoning_tokens,
      };
      for (const [key, val] of Object.entries(fields)) if (typeof val === 'number') this.data[key] = val;
    }
    const choices = response.choices || [];
    const hasOutput = choices.some(c => c.delta?.content || c.delta?.reasoning_content || c.delta?.tool_calls)
      || /response\.(output_text|reasoning.*|function_call_arguments)\.delta/.test(value.type || '');
    if (hasOutput) {
      const at = this.now() - this.started;
      this.data.firstTokenMs ??= at;
      this.data.lastTokenMs = at;
    }
    const finish = choices.find(c => c.finish_reason)?.finish_reason;
    if (finish) { this.data.finishReason = finish; this.terminal = true; }
    if (response.status === 'completed' || value.type === 'response.completed') {
      this.data.finishReason = 'completed'; this.terminal = true;
    }
    if (response.status === 'incomplete' || value.type === 'response.incomplete') {
      this.data.finishReason = response.incomplete_details?.reason || 'incomplete'; this.terminal = true;
    }
    if (value.type === 'response.failed') { this.data.finishReason = 'failed'; this.terminal = true; }
    const error = response.error || value.error;
    if (error) {
      this.data.errorCode = String(error.code || error.type || 'upstream_error').slice(0, 80);
      this.data.guardrailBlocked = /content_filter|responsibleai|content_policy/i.test(this.data.errorCode)
        || error.innererror?.code === 'ResponsibleAIPolicyViolation';
    }
  }
  chunk(bytes) {
    this.buffer += this.decoder.decode(bytes, { stream: true });
    let boundary;
    while ((boundary = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, boundary).trimEnd();
      this.buffer = this.buffer.slice(boundary + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') { this.terminal = true; continue; }
      try { this.json(JSON.parse(payload)); } catch { /* Non-JSON events carry no usage. */ }
    }
    if (this.buffer.length > 1024 * 1024) this.buffer = '';
  }
  result() {
    const result = { ...this.data, durationMs: this.now() - this.started };
    if (result.lastTokenMs > result.firstTokenMs && result.outputTokens > 1) {
      result.outputTokensPerSecond = (result.outputTokens - 1) * 1000 / (result.lastTokenMs - result.firstTokenMs);
    }
    return result;
  }
}

export function emitTelemetry(properties) {
  const event = { event: 'FoundryGatewayRequest', time: new Date().toISOString(), ...properties };
  console.log(JSON.stringify(event));
  const connection = Object.fromEntries((process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || '')
    .split(';').filter(Boolean).map(s => [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)]));
  if (!connection.InstrumentationKey) return;
  const measurements = {}, dimensions = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value == null) continue;
    if (typeof value === 'number') measurements[key] = value;
    else dimensions[key] = String(value);
  }
  const envelope = {
    name: 'Microsoft.ApplicationInsights.Event', time: event.time, iKey: connection.InstrumentationKey,
    tags: { 'ai.cloud.role': process.env.WEBSITE_SITE_NAME || 'foundry-gateway' },
    data: { baseType: 'EventData', baseData: { ver: 2, name: event.event, properties: dimensions, measurements } },
  };
  fetch(`${(connection.IngestionEndpoint || 'https://dc.services.visualstudio.com/').replace(/\/$/, '')}/v2/track`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope),
    signal: AbortSignal.timeout(5000),
  }).then(r => { if (!r.ok) console.error(JSON.stringify({ event: 'TelemetryDeliveryFailure', status: r.status })); })
    .catch(() => console.error(JSON.stringify({ event: 'TelemetryDeliveryFailure' })));
}
