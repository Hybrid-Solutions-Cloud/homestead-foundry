// OpenAI-compatible gateway with explicit deployment routing, per-model parameter
// profiles, bounded upstream retries with a fallback chain, per-deployment
// concurrency limits, streaming keep-alive and metadata-only telemetry.
//
// Routing file (FOUNDRY_ROUTING_PATH, placeholders in routing.example.json):
//   backends  name -> { endpoint, keyEnv, region?, generation? }
//   models    deployment -> { backend }
//   prefixes  path prefix -> backend (regional or generational paths win over models)
//   profiles  optional. deployment -> profile, with "*" merged under every deployment.
//             dropParams             removed from the body before the first upstream call
//             defaultReasoningEffort injected when the body has no reasoning_effort or reasoning object
//             maxReasoningEffort     a higher requested effort is clamped down to this value
//             tokenLimitParam        max_tokens / max_completion_tokens is renamed to this name
//             fallback               ordered deployments (must exist in models) tried after retries
//             maxConcurrency         per-deployment in-flight limit for this deployment
//           Profiles apply to chat/completions, completions and responses paths only.
//           With no profiles object the body is forwarded as received.
//
// Request lifecycle: auth -> parse -> route -> profile -> concurrency slot ->
// upstream (strip-on-400, retry 429/502/503/504, fallback chain) -> pipe -> telemetry.
//
// Strip-on-400: when the upstream rejects a sampling or bookkeeping parameter the
// gateway removes it and resends, at most 6 times. The rejected name is read from
// error.param or, when absent, from the message ("does not support parameter X",
// "Unrecognized request argument supplied: X"). Only STRIPPABLE names are ever
// removed; model, messages, input, tools, tool_choice, stream, response_format,
// token limits and security fields never are. Content-filter 400s are returned as is.
//
// Retries: 429 and 502/503/504 are retried before any byte reaches the client,
// honouring retry-after-ms, then retry-after, otherwise exponential backoff with
// jitter. At most 3 retries per target and a total budget of FOUNDRY_RETRY_BUDGET_MS.
// When retries are exhausted and the profile lists fallbacks, body.model is rewritten
// to the next fallback (switching backend to match) once per fallback, and the
// response carries X-Foundry-Fallback. The concurrency slot stays keyed to the
// originally requested deployment for the life of the request.
//
// Streaming keep-alive: for body.stream === true, when no upstream byte has arrived
// after FOUNDRY_KEEPALIVE_MS the gateway commits 200 text/event-stream and writes
// ": keep-alive" comment lines until the upstream answers. Trade-off: once committed
// the HTTP status can no longer change, so an upstream error after that point is
// delivered as a single `data: {"error":{...}}` event followed by end of stream.
// Non-streaming responses are never padded.
//
// Per-request header x-foundry-reasoning-effort (low|medium|high|xhigh|max) overrides
// the body's reasoning_effort, is still subject to maxReasoningEffort, and is never
// forwarded (only Content-Type and Accept are forwarded from the client).
//
// Environment: FOUNDRY_GATEWAY_TOKEN, FOUNDRY_ROUTING_PATH, FOUNDRY_TIMEOUT_MS (600000),
// FOUNDRY_MAX_REQUEST_BYTES (32 MiB), FOUNDRY_RETRY_BUDGET_MS (60000),
// FOUNDRY_RETRY_BASE_MS (500), FOUNDRY_MAX_CONCURRENCY_PER_MODEL (8),
// FOUNDRY_QUEUE_TIMEOUT_MS (30000), FOUNDRY_KEEPALIVE_MS (15000, 0 disables).
import http from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { UsageObserver, emitTelemetry } from './telemetry.mjs';

const host = process.env.FOUNDRY_PROXY_HOST || (process.env.WEBSITE_SITE_NAME ? '0.0.0.0' : '127.0.0.1');
const port = Number(process.env.PORT || process.env.FOUNDRY_PROXY_PORT || 8787);
const token = process.env.FOUNDRY_GATEWAY_TOKEN || '';
if (!token && !['localhost', '127.0.0.1'].includes(host)) throw new Error('A hosted gateway requires FOUNDRY_GATEWAY_TOKEN');
const routing = JSON.parse(readFileSync(process.env.FOUNDRY_ROUTING_PATH || new URL('./routing.json', import.meta.url), 'utf8'));
const maxBytes = Number(process.env.FOUNDRY_MAX_REQUEST_BYTES || 32 * 1024 * 1024);
const timeoutMs = Number(process.env.FOUNDRY_TIMEOUT_MS || 600000);
const retryBudgetMs = Number(process.env.FOUNDRY_RETRY_BUDGET_MS || 60000);
const retryBaseMs = Number(process.env.FOUNDRY_RETRY_BASE_MS || 500);
const maxRetries = 3;
const defaultConcurrency = Number(process.env.FOUNDRY_MAX_CONCURRENCY_PER_MODEL || 8);
const queueTimeoutMs = Number(process.env.FOUNDRY_QUEUE_TIMEOUT_MS || 30000);
const keepAliveMs = Number(process.env.FOUNDRY_KEEPALIVE_MS ?? 15000);

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const STRIPPABLE = new Set(['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'logprobs', 'top_logprobs',
  'stop', 'seed', 'n', 'logit_bias', 'user']);
const PROFILE_PATHS = /\/(chat\/completions|completions|responses)$/;
const RETRYABLE = new Set([429, 502, 503, 504]);
const NO_RETRY_400 = /content_filter|responsibleaipolicyviolation/i;
const PARAM_REJECTED = /unsupported|not support|unrecognized|unknown/i;
const PARAM_CODES = ['unsupported_value', 'unsupported_parameter', 'unrecognized_request_argument', 'decode_bad_request'];

class GatewayError extends Error {
  constructor(status, code, headers = {}) { super(code); this.status = status; this.code = code; this.headers = headers; }
}

function authenticated(req) {
  if (!token) return true;
  const presented = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.headers['api-key'] || '');
  const a = Buffer.from(presented), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function fail(res, status, code, headers = {}, sse = false) {
  if (res.headersSent) {
    // After a keep-alive commit the only channel left is an SSE error event.
    if (sse && !res.writableEnded && !res.destroyed) { res.end(`data: ${JSON.stringify({ error: { code, message: code.replaceAll('_', ' '), status } })}\n\n`); return; }
    res.destroy(); return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
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
export function profileFor(deployment) {
  const profiles = routing.profiles;
  if (!profiles || typeof profiles !== 'object') return null;
  const merged = { ...(profiles['*'] || {}), ...((deployment && profiles[deployment]) || {}) };
  return Object.keys(merged).length ? merged : null;
}
const snake = name => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
export function rejectedParam(error) {
  if (typeof error?.param === 'string' && error.param) return snake(error.param);
  const message = typeof error?.message === 'string' ? error.message : '';
  const match = message.match(/does not support (?:the )?parameter[:\s`'"]*([A-Za-z][A-Za-z0-9_]*)/i)
    || message.match(/unrecognized request arguments? supplied[:\s`'"]*([A-Za-z][A-Za-z0-9_]*)/i)
    || message.match(/(?:unsupported|unrecognized|unknown|extra) (?:parameter|argument|field|key)[:\s`'"]*([A-Za-z][A-Za-z0-9_]*)/i)
    || message.match(/[`'"]([A-Za-z][A-Za-z0-9_]*)[`'"] is not (?:supported|a valid|recognized)/i);
  return match ? snake(match[1]) : undefined;
}
// Mutates body per the profile. Returns true when the payload must be re-serialized.
export function applyProfile(body, profile, headerEffort, meta, stripped) {
  let changed = false;
  if (EFFORTS.includes(headerEffort)) { meta.requestedReasoningEffort = body.reasoning_effort ?? body.reasoning?.effort; body.reasoning_effort = headerEffort; changed = true; }
  for (const name of Array.isArray(profile.dropParams) ? profile.dropParams : []) {
    if (typeof name === 'string' && Object.hasOwn(body, name)) { delete body[name]; stripped.push(name); changed = true; }
  }
  if (typeof profile.tokenLimitParam === 'string') {
    for (const name of ['max_tokens', 'max_completion_tokens']) {
      if (name === profile.tokenLimitParam || !Object.hasOwn(body, name)) continue;
      if (!Object.hasOwn(body, profile.tokenLimitParam)) body[profile.tokenLimitParam] = body[name];
      delete body[name]; changed = true;
    }
  }
  const hasEffort = body.reasoning_effort !== undefined || (body.reasoning !== null && typeof body.reasoning === 'object');
  if (!hasEffort && EFFORTS.includes(profile.defaultReasoningEffort)) {
    body.reasoning_effort = profile.defaultReasoningEffort; meta.injectedReasoningEffort = profile.defaultReasoningEffort; changed = true;
  }
  const cap = EFFORTS.indexOf(profile.maxReasoningEffort);
  if (cap >= 0) {
    for (const [holder, key] of [[body, 'reasoning_effort'], [body.reasoning, 'effort']]) {
      if (!holder || typeof holder !== 'object' || EFFORTS.indexOf(holder[key]) <= cap) continue;
      meta.requestedReasoningEffort ??= holder[key]; holder[key] = EFFORTS[cap]; meta.clampedReasoningEffort = EFFORTS[cap]; changed = true;
    }
  }
  return changed;
}

// Per-deployment semaphore. Waiters leave on grant, queue timeout or abort.
const slots = new Map();
function acquireSlot(key, limit, signal) {
  const slot = slots.get(key) || slots.set(key, { active: 0, waiters: [] }).get(key);
  if (slot.active < limit) { slot.active++; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const waiter = {};
    const leave = () => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); const i = slot.waiters.indexOf(waiter); if (i >= 0) slot.waiters.splice(i, 1); };
    const onAbort = () => { leave(); reject(signal.reason); };
    const timer = setTimeout(() => { leave(); reject(new GatewayError(429, 'gateway_queue_timeout', { 'Retry-After': String(Math.max(1, Math.ceil(queueTimeoutMs / 6000))) })); }, queueTimeoutMs);
    waiter.grant = () => { leave(); slot.active++; resolve(); };
    signal.addEventListener('abort', onAbort, { once: true });
    slot.waiters.push(waiter);
  });
}
function releaseSlot(key) {
  const slot = slots.get(key);
  if (!slot) return;
  slot.active--;
  slot.waiters.shift()?.grant();
  if (!slot.active && !slot.waiters.length) slots.delete(key);
}
function retryDelay(upstream, attempt) {
  if (upstream.headers.has('retry-after-ms')) {
    const ms = Number(upstream.headers.get('retry-after-ms'));
    if (Number.isFinite(ms) && ms >= 0) return ms;
  }
  const after = upstream.headers.get('retry-after');
  if (after) {
    const seconds = Number(after);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const at = Date.parse(after);
    if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  }
  return Math.min(retryBaseMs * 2 ** attempt, 10000) * (0.5 + Math.random());
}
const credentialFor = backend => {
  const key = backend && process.env[backend.keyEnv];
  return key && !key.startsWith('@Microsoft.KeyVault') ? key : undefined;
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && ['/', '/health', '/robots933456.txt'].includes(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return;
  }
  const observer = new UsageObserver();
  const correlationId = randomUUID();
  const meta = { correlationId, generation: routing.generation, method: req.method,
    consumer: /^mcp-(local|remote)$/.test(String(req.headers['x-foundry-consumer'])) ? req.headers['x-foundry-consumer'] : 'api',
    requestedModel: 'unknown', status: 500, retries: 0, upstreamRetries: 0, retries429: 0, keepAlivesSent: 0 };
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(new Error('timeout')), timeoutMs);
  let completed = false, slotKey = null, keepAliveTimer = null, committed = false;
  const stripped = [];
  const stopKeepAlive = () => { if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; } };
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
    let backendName = route.backend, backend = routing.backends[backendName];
    if (!backend) { meta.status = 503; fail(res, 503, 'backend_not_configured'); return; }
    let key = credentialFor(backend);
    if (!key) { meta.status = 503; fail(res, 503, 'backend_credential_unavailable'); return; }
    // Route is configuration-owned; request paths never choose a host.
    const safePath = route.path.startsWith('/') ? route.path : '/' + route.path;
    const parsedPath = new URL(safePath, 'http://local');
    if (!/^\/(v1|deployments)(\/|$)/.test(parsedPath.pathname)) { meta.status = 404; fail(res, 404, 'unsupported_route'); return; }
    meta.backend = backendName;
    meta.region = backend.region;
    meta.backendGeneration = backend.generation;
    meta.api = parsedPath.pathname.replace(/\/videos\/[^/]+/, '/videos/{id}').replace(/\/deployments\/[^/]+/, '/deployments/{model}');
    meta.requestedModel = typeof body?.model === 'string' ? body.model.slice(0, 100) : parsedPath.pathname.match(/\/deployments\/([^/]+)/)?.[1] || 'unknown';
    const deployment = meta.requestedModel === 'unknown' ? null : meta.requestedModel;
    const jsonObject = body && typeof body === 'object' && !Array.isArray(body);
    const profile = profileFor(deployment);
    if (jsonObject && profile && PROFILE_PATHS.test(parsedPath.pathname)) {
      const headerEffort = String(req.headers['x-foundry-reasoning-effort'] || '').trim().toLowerCase();
      if (applyProfile(body, profile, headerEffort, meta, stripped)) payload = Buffer.from(JSON.stringify(body));
    }
    meta.requestedTier = body?.service_tier || 'default';
    meta.requestedOutputTokens = body?.max_output_tokens ?? body?.max_completion_tokens ?? body?.max_tokens;
    if (body?.reasoning_effort !== undefined) meta.reasoningEffort = String(body.reasoning_effort).slice(0, 20);
    const wantStream = body?.stream === true;
    meta.streaming = wantStream;
    if (deployment) {
      const limit = Number(profile?.maxConcurrency) > 0 ? Number(profile.maxConcurrency) : defaultConcurrency;
      const queuedAt = observer.now();
      try { await acquireSlot(deployment, limit, aborter.signal); slotKey = deployment; }
      finally { meta.queuedMs = Math.round(observer.now() - queuedAt); }
    }
    const send = () => fetch(backend.endpoint.replace(/\/$/, '') + safePath, {
      method: req.method,
      headers: { Authorization: `Bearer ${key}`, 'api-key': key, 'x-ms-client-request-id': correlationId,
        ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
        ...(req.headers.accept ? { Accept: req.headers.accept } : {}) },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : payload,
      signal: aborter.signal,
    });
    if (wantStream && keepAliveMs > 0) {
      keepAliveTimer = setInterval(() => {
        if (res.destroyed || res.writableEnded) { stopKeepAlive(); return; }
        if (!committed) {
          committed = true;
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no',
            'X-Request-Id': correlationId, 'X-Foundry-Backend': backendName, 'X-Foundry-Keep-Alive': '1' });
        }
        res.write(': keep-alive\n\n'); meta.keepAlivesSent++;
      }, keepAliveMs);
    }
    const fallbacks = (Array.isArray(profile?.fallback) ? profile.fallback : [])
      .filter(name => typeof name === 'string' && routing.models[name] && name !== body?.model);
    const usedFallbacks = [];
    const deadline = observer.started + retryBudgetMs;
    let upstream, targetRetries = 0;
    for (;;) {
      upstream = await send();
      for (let attempt = 0; jsonObject && upstream.status === 400 && attempt < 6; attempt++) {
        let error;
        try { error = (await upstream.clone().json()).error; } catch { break; }
        if (NO_RETRY_400.test([error?.code, error?.type, error?.innererror?.code].join(' '))) break;
        const p = rejectedParam(error);
        // Only known sampling or bookkeeping parameters are ever removed.
        if (!p || !STRIPPABLE.has(p) || !Object.hasOwn(body, p)
          || !(PARAM_REJECTED.test(error?.message || '') || PARAM_CODES.includes(error?.code))) break;
        await upstream.body?.cancel();
        delete body[p]; stripped.push(p); meta.retries++;
        payload = Buffer.from(JSON.stringify(body)); upstream = await send();
      }
      if (!RETRYABLE.has(upstream.status)) break;
      const delay = retryDelay(upstream, targetRetries);
      if (targetRetries < maxRetries && observer.now() + delay <= deadline) {
        await upstream.body?.cancel();
        targetRetries++; meta.upstreamRetries++; if (upstream.status === 429) meta.retries429++;
        await sleep(delay, undefined, { signal: aborter.signal });
        continue;
      }
      let switched = false;
      while (fallbacks.length && jsonObject && typeof body.model === 'string') {
        const next = fallbacks.shift();
        const nextBackendName = routing.models[next].backend, nextBackend = routing.backends[nextBackendName], nextKey = credentialFor(nextBackend);
        if (!nextKey) continue;
        await upstream.body?.cancel();
        body.model = next; payload = Buffer.from(JSON.stringify(body));
        backendName = nextBackendName; backend = nextBackend; key = nextKey;
        usedFallbacks.push(next); meta.fallbackTo = usedFallbacks.join(',');
        meta.backend = backendName; meta.region = backend.region; meta.backendGeneration = backend.generation;
        targetRetries = 0; switched = true; break;
      }
      if (!switched) break;
    }
    stopKeepAlive();
    meta.status = upstream.status;
    meta.backendHeadersMs = observer.now() - observer.started;
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const headers = { 'Content-Type': contentType, 'X-Request-Id': correlationId, 'X-Foundry-Backend': backendName };
    for (const name of ['retry-after', 'x-ratelimit-remaining-tokens', 'x-ratelimit-remaining-requests']) {
      if (upstream.headers.has(name)) headers[name] = upstream.headers.get(name);
    }
    if (stripped.length) headers['X-Foundry-Proxy-Stripped'] = stripped.join(',');
    if (usedFallbacks.length) headers['X-Foundry-Fallback'] = usedFallbacks.join(',');
    const sse = contentType.includes('text/event-stream');
    if (committed) {
      // Status and headers already went out with the keep-alive; translate non-SSE outcomes into events.
      if (upstream.status < 200 || upstream.status >= 300 || !sse) {
        let parsed;
        try { parsed = await upstream.json(); } catch { parsed = undefined; }
        if (parsed && typeof parsed === 'object') observer.json(parsed);
        if (upstream.status >= 200 && upstream.status < 300) { res.end((parsed === undefined ? '' : `data: ${JSON.stringify(parsed)}\n\n`) + 'data: [DONE]\n\n'); return; }
        const error = parsed?.error && typeof parsed.error === 'object' ? parsed.error : {};
        res.end(`data: ${JSON.stringify({ error: { ...error, code: error.code || error.type || 'upstream_error',
          message: error.message || `upstream status ${upstream.status}`, status: upstream.status } })}\n\n`);
        return;
      }
    } else {
      res.writeHead(upstream.status, headers);
    }
    if (!upstream.body) { res.end(); return; }
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
    stopKeepAlive();
    if (error instanceof GatewayError) {
      meta.status = error.status; meta.errorCode = error.code;
      fail(res, error.status, error.code, error.headers, committed);
    } else {
      meta.errorCode = aborter.signal.aborted ? (meta.cancelled ? 'client_cancelled' : 'timeout') : 'gateway_error';
      meta.status = aborter.signal.aborted ? 504 : 502;
      fail(res, meta.status, meta.errorCode, {}, committed);
    }
  } finally {
    completed = true;
    clearTimeout(timer);
    stopKeepAlive();
    if (slotKey) releaseSlot(slotKey);
    if (stripped.length) meta.strippedParams = stripped;
    emitTelemetry({ ...meta, ...observer.result() });
  }
});
server.requestTimeout = timeoutMs;
server.listen(port, host, () => console.log(JSON.stringify({ event: 'GatewayStarted', generation: routing.generation })));
