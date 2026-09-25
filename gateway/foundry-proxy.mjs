// OpenAI-compatible gateway with explicit deployment routing and metadata-only telemetry.
import http from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { UsageObserver, emitTelemetry } from './telemetry.mjs';

const host = process.env.FOUNDRY_PROXY_HOST || (process.env.WEBSITE_SITE_NAME ? '0.0.0.0' : '127.0.0.1');
const port = Number(process.env.PORT || process.env.FOUNDRY_PROXY_PORT || 8787);
const token = process.env.FOUNDRY_GATEWAY_TOKEN || '';
if (!token && !['localhost', '127.0.0.1'].includes(host)) throw new Error('A hosted gateway requires FOUNDRY_GATEWAY_TOKEN');
const routing = JSON.parse(readFileSync(process.env.FOUNDRY_ROUTING_PATH || new URL('./routing.json', import.meta.url), 'utf8'));
const maxBytes = Number(process.env.FOUNDRY_MAX_REQUEST_BYTES || 32 * 1024 * 1024);
const timeoutMs = Number(process.env.FOUNDRY_TIMEOUT_MS || 600000);

function authenticated(req) {
  if (!token) return true;
  const presented = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.headers['api-key'] || '');
  const a = Buffer.from(presented), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function fail(res, status, code) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { code, message: code.replaceAll('_', ' ') } }));
}
export function resolveRoute(url, body) {
  let path = url, backend = routing.defaultBackend;
  for (const [prefix, target] of Object.entries(routing.prefixes || {}).sort((a, b) => b[0].length - a[0].length)) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      return { path: path.slice(prefix.length) || '/', backend: target };
    }
  }
  const deployment = body?.model;
  if (deployment && routing.models[deployment]) backend = routing.models[deployment].backend;
  return { path, backend };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && ['/', '/health', '/robots933456.txt'].includes(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return;
  }
  const observer = new UsageObserver();
  const correlationId = randomUUID();
  const meta = { correlationId, generation: routing.generation, method: req.method,
    consumer: /^mcp-(local|remote)$/.test(String(req.headers['x-foundry-consumer'])) ? req.headers['x-foundry-consumer'] : 'api',
    requestedModel: 'unknown', status: 500, retries: 0 };
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(new Error('timeout')), timeoutMs);
  let completed = false;
  res.on('close', () => { if (!completed) { meta.cancelled = true; aborter.abort(new Error('client_closed')); } });
  try {
    if (!authenticated(req)) { meta.status = 401; fail(res, 401, 'unauthorized'); return; }
    if (req.method === 'GET' && req.url.split('?')[0] === '/v1/models') {
      meta.status = 200;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: Object.keys(routing.models).map(id => ({ id, object: 'model', owned_by: 'foundry' })) }));
      return;
    }
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > maxBytes) { meta.status = 413; fail(res, 413, 'request_too_large'); return; }
      chunks.push(chunk);
    }
    let payload = Buffer.concat(chunks), body;
    const jsonInput = String(req.headers['content-type'] || '').includes('application/json');
    if (jsonInput && payload.length) {
      try { body = JSON.parse(payload.toString('utf8')); }
      catch { meta.status = 400; fail(res, 400, 'invalid_json'); return; }
    }
    const route = resolveRoute(req.url, body);
    const backend = routing.backends[route.backend];
    if (!backend) { meta.status = 503; fail(res, 503, 'backend_not_configured'); return; }
    const key = process.env[backend.keyEnv];
    if (!key || key.startsWith('@Microsoft.KeyVault')) { meta.status = 503; fail(res, 503, 'backend_credential_unavailable'); return; }
    // Route is configuration-owned; request paths never choose a host.
    const safePath = route.path.startsWith('/') ? route.path : '/' + route.path;
    const parsedPath = new URL(safePath, 'http://local');
    if (!/^\/(v1|deployments)(\/|$)/.test(parsedPath.pathname)) { meta.status = 404; fail(res, 404, 'unsupported_route'); return; }
    meta.backend = route.backend;
    meta.region = backend.region;
    meta.backendGeneration = backend.generation;
    meta.api = parsedPath.pathname.replace(/\/videos\/[^/]+/, '/videos/{id}').replace(/\/deployments\/[^/]+/, '/deployments/{model}');
    meta.requestedModel = typeof body?.model === 'string' ? body.model.slice(0, 100) : parsedPath.pathname.match(/\/deployments\/([^/]+)/)?.[1] || 'unknown';
    meta.requestedTier = body?.service_tier || 'default';
    meta.requestedOutputTokens = body?.max_output_tokens ?? body?.max_completion_tokens ?? body?.max_tokens;
    const wantStream = body?.stream === true;
    meta.streaming = wantStream;
    const send = () => fetch(backend.endpoint.replace(/\/$/, '') + safePath, {
      method: req.method,
      headers: { Authorization: `Bearer ${key}`, 'api-key': key, 'x-ms-client-request-id': correlationId,
        ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
        ...(req.headers.accept ? { Accept: req.headers.accept } : {}) },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : payload,
      signal: aborter.signal,
    });
    let upstream = await send();
    const stripped = [];
    for (let attempt = 0; body && upstream.status === 400 && attempt < 6; attempt++) {
      let error;
      try { error = (await upstream.clone().json()).error; } catch { break; }
      const p = error?.param;
      // Never drop model, messages, tools, output limits, or security-related fields.
      if (!['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'logprobs', 'top_logprobs'].includes(p)
        || !Object.hasOwn(body, p)
        || !(/unsupported|not supported|unrecognized/i.test(error?.message || '') || ['unsupported_value', 'unsupported_parameter'].includes(error?.code))) break;
      await upstream.body?.cancel();
      delete body[p]; stripped.push(p); meta.retries++;
      payload = Buffer.from(JSON.stringify(body)); upstream = await send();
    }
    meta.status = upstream.status;
    meta.backendHeadersMs = observer.now() - observer.started;
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const headers = { 'Content-Type': contentType, 'X-Request-Id': correlationId, 'X-Foundry-Backend': route.backend };
    for (const name of ['retry-after', 'x-ratelimit-remaining-tokens', 'x-ratelimit-remaining-requests']) {
      if (upstream.headers.has(name)) headers[name] = upstream.headers.get(name);
    }
    if (stripped.length) headers['X-Foundry-Proxy-Stripped'] = stripped.join(',');
    res.writeHead(upstream.status, headers);
    if (!upstream.body) { res.end(); return; }
    const sse = contentType.includes('text/event-stream');
    const inspectJson = !sse && contentType.includes('json');
    const responseChunks = []; let responseBytes = 0;
    for await (const chunk of upstream.body) {
      if (sse) observer.chunk(chunk);
      else if (inspectJson && responseBytes <= 4 * 1024 * 1024) { responseChunks.push(Buffer.from(chunk)); responseBytes += chunk.length; }
      if (!res.write(chunk)) await once(res, 'drain', { signal: aborter.signal });
    }
    if (inspectJson && responseBytes <= 4 * 1024 * 1024) {
      try { observer.json(JSON.parse(Buffer.concat(responseChunks).toString('utf8'))); } catch { /* No body capture. */ }
    }
    if (sse && !observer.terminal) meta.streamInterrupted = true;
    res.end();
  } catch (error) {
    meta.errorCode = aborter.signal.aborted ? (meta.cancelled ? 'client_cancelled' : 'timeout') : 'gateway_error';
    meta.status = aborter.signal.aborted ? 504 : 502;
    fail(res, meta.status, meta.errorCode);
  } finally {
    completed = true;
    clearTimeout(timer);
    emitTelemetry({ ...meta, ...observer.result() });
  }
});
server.requestTimeout = timeoutMs;
server.listen(port, host, () => console.log(JSON.stringify({ event: 'GatewayStarted', generation: routing.generation })));
