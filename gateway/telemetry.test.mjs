import test from 'node:test';
import assert from 'node:assert/strict';
import { UsageObserver } from './telemetry.mjs';

test('fragmented UTF-8 SSE preserves timing, selected model, usage and stop reason', () => {
  let time = 0;
  const o = new UsageObserver(() => time);
  const event = 'data: ' + JSON.stringify({ model: 'selected', choices: [{ delta: { content: 'héllo' } }] }) + '\n\n';
  const b = Buffer.from(event); time = 100;
  o.chunk(b.subarray(0, 36)); o.chunk(b.subarray(36));
  time = 300; o.chunk(Buffer.from('data: {"choices":[{"delta":{"content":"world"}}]}\n\n'));
  o.chunk(Buffer.from('data: {"choices":[{"finish_reason":"length"}],"usage":{"prompt_tokens":20,"completion_tokens":11,"completion_tokens_details":{"reasoning_tokens":3},"prompt_tokens_details":{"cached_tokens":5}}}\n\ndata: [DONE]\n\n'));
  const r = o.result();
  assert.equal(r.firstTokenMs, 100); assert.equal(r.lastTokenMs, 300);
  assert.equal(r.outputTokensPerSecond, 50); assert.equal(r.finishReason, 'length');
  assert.equal(r.selectedModel, 'selected'); assert.equal(r.cachedTokens, 5); assert.equal(r.reasoningTokens, 3);
  assert.equal(o.terminal, true); assert.equal(JSON.stringify(r).includes('héllo'), false);
});
test('missing usage and non-streaming first-token timing remain missing', () => {
  const o = new UsageObserver(); o.json({ choices: [{ message: { content: 'private text' }, finish_reason: 'stop' }] });
  assert.equal(o.result().firstTokenMs, undefined); assert.equal(o.result().outputTokens, undefined);
});
test('a generic HTTP 400 is not classified as a guardrail block', () => {
  const o = new UsageObserver(); o.json({ error: { code: 'invalid_request_error' } });
  assert.equal(o.result().guardrailBlocked, false);
  o.json({ error: { code: 'content_filter' } }); assert.equal(o.result().guardrailBlocked, true);
});
test('Responses API usage and incomplete reason are parsed', () => {
  const o = new UsageObserver(); o.json({ type: 'response.incomplete', response: {
    model: 'router-selected', status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
    usage: { input_tokens: 10, output_tokens: 30, total_tokens: 40 }, service_tier: 'priority' } });
  assert.equal(o.result().finishReason, 'max_output_tokens'); assert.equal(o.result().totalTokens, 40);
  assert.equal(o.result().servedTier, 'priority'); assert.equal(o.terminal, true);
});
