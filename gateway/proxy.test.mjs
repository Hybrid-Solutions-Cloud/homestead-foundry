import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const proxyPath = new URL('./foundry-proxy.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

async function startBackend(t) {
  const requests = [];
  const state = { handler: null };
  const server = http.createServer(async (req, res) => {
    const parts = []; for await (const b of req) parts.push(b);
    const text = Buffer.concat(parts).toString();
    const body = text && req.headers['content-type']?.includes('json') ? JSON.parse(text) : undefined;
    const entry = { path: req.url, body, text, key: req.headers['api-key'], headers: req.headers };
    requests.push(entry);
    res.setHeader('Content-Type', 'application/json');
    if (state.handler && await state.handler(req, res, body, entry) === true) return;
    if (body?.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.end('data: {"model":"chosen","choices":[{"delta":{"content":"ok"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\ndata: [DONE]\n\n'); return;
    }
    res.end(JSON.stringify({ model: 'chosen', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); });
  return { requests, state, endpoint: `http://127.0.0.1:${server.address().port}/openai` };
}

async function startGateway(t, routing, env = {}) {
  const reservation = http.createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(r => reservation.close(r));
  const dir = await mkdtemp(join(tmpdir(), 'gateway-test-'));
  const routingPath = join(dir, 'routing.json');
  await writeFile(routingPath, JSON.stringify(routing));
  const proc = spawn(process.execPath, [proxyPath], { env: { ...process.env, FOUNDRY_PROXY_HOST: '127.0.0.1', PORT: String(port),
    FOUNDRY_GATEWAY_TOKEN: 'test-token', FOUNDRY_ROUTING_PATH: routingPath, TEST_OLD: 'old-test-key', TEST_NEW: 'new-test-key',
    APPLICATIONINSIGHTS_CONNECTION_STRING: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; proc.stdout.on('data', b => { logs += b; }); proc.stderr.on('data', b => { logs += b; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch { /* starting */ } await sleep(50); }
  t.after(async () => { proc.kill(); await once(proc, 'exit'); await rm(dir, { recursive: true, force: true }); });
  const events = () => logs.split('\n').filter(l => l.includes('FoundryGatewayRequest')).map(l => JSON.parse(l));
  return { base, logs: () => logs, events, headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' } };
}

test('gateway enforces auth and preserves model routing, retry limits, streams and regional paths', async (t) => {
  const { requests, state, endpoint } = await startBackend(t);
  state.handler = (req, res, body) => {
    if (body?.temperature !== undefined) { res.writeHead(400); res.end(JSON.stringify({ error: { param: 'temperature', code: 'unsupported_parameter' } })); return true; }
  };
  const { base, logs, headers } = await startGateway(t, { generation: 'test', defaultBackend: 'old',
    backends: { old: { endpoint, keyEnv: 'TEST_OLD' }, new: { endpoint, keyEnv: 'TEST_NEW' } },
    prefixes: { '/new/eus2': 'new', '/eus2': 'old' }, models: { 'model-router': { backend: 'new' } } });
  assert.equal((await fetch(base + '/v1/models')).status, 401);
  assert.equal(requests.length, 0);
  const response = await fetch(base + '/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: 'model-router', messages: [{ role: 'user', content: 'private-test-text' }], temperature: 0.1, max_completion_tokens: 32, stream: true }) });
  assert.equal(response.status, 200); assert.equal(response.headers.get('x-foundry-backend'), 'new');
  assert.match(await response.text(), /\[DONE\]/);
  assert.equal(requests.length, 2); assert.equal(requests[1].key, 'new-test-key');
  assert.equal(requests[1].body.temperature, undefined); assert.equal(requests[1].body.max_completion_tokens, 32);
  // No profiles object: the body is forwarded byte for byte, nothing injected, nothing renamed.
  const raw = JSON.stringify({ model: 'model-router', messages: [{ role: 'user', content: 'private-test-text' }], stop: ['x'], max_tokens: 5, presence_penalty: 0.2 });
  const plain = await fetch(base + '/v1/chat/completions', { method: 'POST', headers, body: raw });
  assert.equal(plain.status, 200); await plain.text();
  assert.equal(requests.at(-1).text, raw);
  const poll = await fetch(base + '/new/eus2/v1/videos/test-job', { headers });
  assert.equal(poll.status, 200); await poll.text();
  assert.equal(requests.at(-1).path, '/openai/v1/videos/test-job'); assert.equal(requests.at(-1).key, 'new-test-key');
  const form = new FormData(); form.set('model', 'whisper'); form.set('file', new Blob(['test-audio']), 'test.wav');
  const upload = await fetch(base + '/eus2/deployments/whisper/audio/transcriptions?api-version=test', { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: form });
  assert.equal(upload.status, 200); await upload.text();
  assert.equal(requests.at(-1).key, 'old-test-key'); assert.match(requests.at(-1).text, /test-audio/);
  assert.equal(logs().includes('private-test-text'), false); assert.equal(logs().includes('new-test-key'), false);
});

test('gateway v2 profiles, strip-on-400, retries, fallback, concurrency and keep-alive', async (t) => {
  const { requests, state, endpoint } = await startBackend(t);
  const scenarioOf = body => body?.messages?.[0]?.content || '';
  const grok400 = (res, name) => { res.writeHead(400); res.end(JSON.stringify({ error: { type: 'Bad Request', code: 'decode_bad_request',
    message: JSON.stringify({ code: 'invalid-argument', error: `Model test-model does not support parameter ${name}.` }) } })); return true; };
  state.handler = async (req, res, body) => {
    const scenario = scenarioOf(body);
    if (scenario === 'grok-rejects') {
      if (body.stop !== undefined) return grok400(res, 'stop');
      if (body.presence_penalty !== undefined) return grok400(res, 'presencePenalty');
      return false;
    }
    if (scenario === 'content-filter') {
      res.writeHead(400); res.end(JSON.stringify({ error: { code: 'content_filter', param: 'temperature', message: 'unsupported prompt' } })); return true;
    }
    if (scenario === 'never-strip') {
      res.writeHead(400); res.end(JSON.stringify({ error: { code: 'unsupported_parameter', param: 'tools', message: 'tools is not supported' } })); return true;
    }
    if (scenario === '429-then-ok') {
      const earlier = requests.filter(r => scenarioOf(r.body) === scenario).length;
      if (earlier === 1) { res.writeHead(429, { 'retry-after-ms': '20', 'retry-after': '30' }); res.end(JSON.stringify({ error: { code: 'pd_decode_pushback' } })); return true; }
      return false;
    }
    if (scenario === 'fallback') {
      if (body.model !== 'fast-like') { res.writeHead(503); res.end(JSON.stringify({ error: { code: 'overloaded' } })); return true; }
      return false;
    }
    if (scenario === 'slow') { await sleep(600); return false; }
    if (scenario === 'slow-stream') { await sleep(350); return false; }
    if (scenario === 'slow-error') { await sleep(250); res.writeHead(400); res.end(JSON.stringify({ error: { code: 'content_filter', message: 'blocked' } })); return true; }
    return false;
  };
  const { base, headers, events } = await startGateway(t, {
    generation: 'test', defaultBackend: 'old',
    backends: { old: { endpoint, keyEnv: 'TEST_OLD', region: 'r1' }, new: { endpoint, keyEnv: 'TEST_NEW', region: 'r2' } },
    models: { 'grok-like': { backend: 'old' }, 'think-like': { backend: 'old' }, 'fast-like': { backend: 'new' }, plain: { backend: 'old' }, single: { backend: 'old' } },
    profiles: {
      '*': { dropParams: ['thinking'] },
      'grok-like': { defaultReasoningEffort: 'medium', maxReasoningEffort: 'high', tokenLimitParam: 'max_completion_tokens', fallback: ['think-like', 'fast-like', 'missing-model'] },
      single: { maxConcurrency: 1 },
    },
  }, { FOUNDRY_RETRY_BASE_MS: '5', FOUNDRY_RETRY_BUDGET_MS: '3000', FOUNDRY_KEEPALIVE_MS: '100', FOUNDRY_QUEUE_TIMEOUT_MS: '300' });
  const post = (body, extra = {}) => fetch(base + '/v1/chat/completions', { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const forModel = model => requests.filter(r => r.body?.model === model);

  await t.test('strips stop and presencePenalty from Grok-style 400 messages', async () => {
    const r = await post({ model: 'plain', messages: [{ role: 'user', content: 'grok-rejects' }], stop: ['x'], presence_penalty: 0.5, max_tokens: 10 });
    assert.equal(r.status, 200); await r.text();
    assert.equal(r.headers.get('x-foundry-proxy-stripped'), 'stop,presence_penalty');
    const mine = requests.filter(r => scenarioOf(r.body) === 'grok-rejects');
    assert.equal(mine.length, 3);
    assert.equal(mine[2].body.stop, undefined); assert.equal(mine[2].body.presence_penalty, undefined); assert.equal(mine[2].body.max_tokens, 10);
  });

  await t.test('content_filter 400 is returned unchanged without a retry', async () => {
    const r = await post({ model: 'plain', messages: [{ role: 'user', content: 'content-filter' }], temperature: 0.3 });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error.code, 'content_filter');
    assert.equal(requests.filter(r => scenarioOf(r.body) === 'content-filter').length, 1);
  });

  await t.test('a rejected non-strippable field such as tools is never removed', async () => {
    const r = await post({ model: 'plain', messages: [{ role: 'user', content: 'never-strip' }], tools: [] });
    assert.equal(r.status, 400); await r.text();
    assert.equal(requests.filter(r => scenarioOf(r.body) === 'never-strip').length, 1);
  });

  await t.test('429 with retry-after-ms is retried and then succeeds', async () => {
    const started = Date.now();
    const r = await post({ model: 'plain', messages: [{ role: 'user', content: '429-then-ok' }] });
    assert.equal(r.status, 200); await r.text();
    assert.equal(requests.filter(r => scenarioOf(r.body) === '429-then-ok').length, 2);
    assert.ok(Date.now() - started < 1000, 'retry-after-ms (20) was honoured rather than retry-after (30 s)');
  });

  await t.test('fallback chain switches deployment and backend after retries are exhausted', async () => {
    const r = await post({ model: 'grok-like', messages: [{ role: 'user', content: 'fallback' }] });
    assert.equal(r.status, 200); await r.text();
    assert.equal(r.headers.get('x-foundry-fallback'), 'think-like,fast-like');
    assert.equal(r.headers.get('x-foundry-backend'), 'new');
    const mine = requests.filter(r => scenarioOf(r.body) === 'fallback');
    assert.equal(mine.filter(r => r.body.model === 'grok-like').length, 4);
    assert.equal(mine.filter(r => r.body.model === 'think-like').length, 4);
    assert.equal(mine.filter(r => r.body.model === 'fast-like').length, 1);
    assert.equal(mine.at(-1).key, 'new-test-key');
  });

  await t.test('reasoning effort is injected, clamped and overridable by header', async () => {
    let r = await post({ model: 'grok-like', messages: [{ role: 'user', content: 'effort' }], max_tokens: 50 });
    assert.equal(r.status, 200); await r.text();
    let sent = forModel('grok-like').at(-1).body;
    assert.equal(sent.reasoning_effort, 'medium'); assert.equal(sent.max_completion_tokens, 50); assert.equal(sent.max_tokens, undefined);
    r = await post({ model: 'grok-like', messages: [{ role: 'user', content: 'effort' }], reasoning_effort: 'xhigh' });
    assert.equal(r.status, 200); await r.text();
    assert.equal(forModel('grok-like').at(-1).body.reasoning_effort, 'high');
    r = await post({ model: 'grok-like', messages: [{ role: 'user', content: 'effort' }], reasoning_effort: 'high' }, { 'x-foundry-reasoning-effort': 'low' });
    assert.equal(r.status, 200); await r.text();
    sent = forModel('grok-like').at(-1);
    assert.equal(sent.body.reasoning_effort, 'low'); assert.equal(sent.headers['x-foundry-reasoning-effort'], undefined);
    r = await post({ model: 'grok-like', messages: [{ role: 'user', content: 'effort' }] }, { 'x-foundry-reasoning-effort': 'max' });
    assert.equal(r.status, 200); await r.text();
    assert.equal(forModel('grok-like').at(-1).body.reasoning_effort, 'high');
    r = await post({ model: 'grok-like', messages: [{ role: 'user', content: 'effort' }], reasoning: { effort: 'low' } });
    assert.equal(r.status, 200); await r.text();
    sent = forModel('grok-like').at(-1).body;
    assert.equal(sent.reasoning_effort, undefined); assert.equal(sent.reasoning.effort, 'low');
    r = await post({ model: 'think-like', messages: [{ role: 'user', content: 'effort' }], thinking: { type: 'enabled' } });
    assert.equal(r.status, 200); await r.text();
    assert.equal(r.headers.get('x-foundry-proxy-stripped'), 'thinking');
    assert.equal(forModel('think-like').at(-1).body.thinking, undefined);
  });

  await t.test('per-deployment concurrency queue times out with 429 and retry-after', async () => {
    const first = post({ model: 'single', messages: [{ role: 'user', content: 'slow' }] });
    await sleep(80);
    const second = await post({ model: 'single', messages: [{ role: 'user', content: 'slow' }] });
    assert.equal(second.status, 429); assert.ok(second.headers.get('retry-after'));
    assert.equal((await second.json()).error.code, 'gateway_queue_timeout');
    const r = await first; assert.equal(r.status, 200); await r.text();
    const third = await post({ model: 'single', messages: [{ role: 'user', content: 'ok' }] });
    assert.equal(third.status, 200); await third.text();
  });

  await t.test('streaming keep-alive comments precede the upstream stream', async () => {
    const r = await post({ model: 'plain', messages: [{ role: 'user', content: 'slow-stream' }], stream: true });
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/event-stream/);
    assert.equal(r.headers.get('x-accel-buffering'), 'no'); assert.equal(r.headers.get('x-foundry-keep-alive'), '1');
    const text = await r.text();
    assert.ok((text.match(/: keep-alive\n\n/g) || []).length >= 2, text);
    assert.match(text, /\[DONE\]/);
  });

  await t.test('an upstream error after keep-alive becomes a single SSE error event', async () => {
    const r = await post({ model: 'plain', messages: [{ role: 'user', content: 'slow-error' }], stream: true });
    assert.equal(r.status, 200);
    const text = await r.text();
    assert.match(text, /: keep-alive\n\n/);
    const events = text.split('\n\n').filter(e => e.startsWith('data:'));
    assert.equal(events.length, 1);
    const event = JSON.parse(events[0].slice(5));
    assert.equal(event.error.code, 'content_filter'); assert.equal(event.error.status, 400);
  });

  await t.test('non-streaming slow errors are never padded', async () => {
    const r = await post({ model: 'plain', messages: [{ role: 'user', content: 'slow-error' }] });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error.code, 'content_filter');
  });

  await t.test('telemetry carries the new metadata fields without prompts', async () => {
    await sleep(100);
    const all = events();
    const fallback = all.find(e => e.fallbackTo);
    assert.equal(fallback.fallbackTo, 'think-like,fast-like'); assert.equal(fallback.upstreamRetries, 6); assert.equal(fallback.requestedModel, 'grok-like');
    assert.equal(all.find(e => e.retries429 === 1).upstreamRetries, 1);
    assert.equal(all.find(e => e.injectedReasoningEffort).injectedReasoningEffort, 'medium');
    const clamped = all.find(e => e.clampedReasoningEffort);
    assert.equal(clamped.clampedReasoningEffort, 'high'); assert.equal(clamped.requestedReasoningEffort, 'xhigh');
    assert.equal(all.find(e => e.strippedParams === 'stop,presence_penalty').retries, 2);
    assert.ok(all.find(e => e.errorCode === 'gateway_queue_timeout'));
    assert.ok(all.find(e => e.keepAlivesSent >= 2));
    assert.ok(all.every(e => typeof e.queuedMs === 'number'));
    const text = JSON.stringify(all);
    for (const leak of ['grok-rejects', 'slow-error', 'old-test-key', 'new-test-key', 'test-token']) assert.equal(text.includes(leak), false, leak);
  });
});
