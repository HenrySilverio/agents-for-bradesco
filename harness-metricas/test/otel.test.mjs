import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agregarConversas, lerOtel, mediaMetrica, normalizarSpan, registrosDaLinha } from '../lib/otel.mjs';

const kv = (k, v) => ({ key: k, value: typeof v === 'number' ? { intValue: String(v) } : { stringValue: String(v) } });
const spanOtlp = (attrs, extra = {}) => ({ traceId: 'tr1', spanId: 's1', startTimeUnixNano: '1780000000000000000', endTimeUnixNano: '1780000005000000000', attributes: attrs, ...extra });

test('aceita OTLP/JSON e formato achatado', () => {
  const linhaOtlp = { resourceSpans: [{ resource: { attributes: [kv('service.name', 'copilot-chat')] }, scopeSpans: [{ spans: [spanOtlp([kv('gen_ai.operation.name', 'chat'), kv('gen_ai.usage.input_tokens', 100)], { name: 'chat x' })] }] }] };
  const [r1] = [...registrosDaLinha(linhaOtlp)];
  assert.equal(r1.span.op, 'chat');
  assert.equal(r1.span.attrs['gen_ai.usage.input_tokens'], 100);
  assert.equal(r1.span.inicio, 1780000000000);

  const achatado = { name: 'chat y', traceId: 'tr2', id: 's2', timestamp: 1780000000000000, duration: 3000000, attributes: { 'gen_ai.operation.name': 'chat', 'gen_ai.usage.output_tokens': 42 } };
  const [r2] = [...registrosDaLinha(achatado)];
  assert.equal(r2.span.attrs['gen_ai.usage.output_tokens'], 42);
  assert.equal(r2.span.inicio, 1780000000000);
  assert.equal(r2.span.fim - r2.span.inicio, 3000);
});

test('detecta se input_tokens já inclui cache', () => {
  const spans = [
    normalizarSpan({ name: 'chat', traceId: 't', spanId: 'a', startTimeUnixNano: '1', attributes: [kv('gen_ai.operation.name', 'chat'), kv('gen_ai.conversation.id', 'c1'), kv('gen_ai.response.model', 'claude-haiku-4.5'), kv('gen_ai.usage.input_tokens', 1000), kv('gen_ai.usage.output_tokens', 100), kv('gen_ai.usage.cache_read.input_tokens', 800), kv('gen_ai.usage.cache_creation.input_tokens', 50)] }),
  ];
  const incluso = agregarConversas(spans, { inputIncluiCache: 'auto' });
  assert.equal(incluso.inputIncluiCache, true);
  assert.equal(incluso.conversas[0].modelos['claude-haiku-4.5'].entrada_nova, 150);

  const excluso = agregarConversas([
    normalizarSpan({ name: 'chat', traceId: 't', spanId: 'b', startTimeUnixNano: '1', attributes: [kv('gen_ai.operation.name', 'chat'), kv('gen_ai.conversation.id', 'c2'), kv('gen_ai.response.model', 'm'), kv('gen_ai.usage.input_tokens', 200), kv('gen_ai.usage.output_tokens', 10), kv('gen_ai.usage.cache_read.input_tokens', 900), kv('gen_ai.usage.cache_creation.input_tokens', 0)] }),
  ], { inputIncluiCache: 'auto' });
  assert.equal(excluso.inputIncluiCache, false);
  assert.equal(excluso.conversas[0].modelos.m.entrada_nova, 200);
});

test('subagente herda a conversa da raiz do trace e não conta token duas vezes', () => {
  const attrsPai = [kv('gen_ai.operation.name', 'invoke_agent'), kv('gen_ai.conversation.id', 'conv-A'), kv('gen_ai.agent.name', 'copilot'), kv('gen_ai.usage.input_tokens', 5000), kv('gen_ai.usage.output_tokens', 500)];
  const spans = [
    normalizarSpan({ name: 'invoke_agent copilot', traceId: 'T', spanId: 'raiz', startTimeUnixNano: '1', attributes: attrsPai }),
    normalizarSpan({ name: 'execute_tool runSubagent', traceId: 'T', spanId: 'ferr', parentSpanId: 'raiz', startTimeUnixNano: '2', attributes: [kv('gen_ai.operation.name', 'execute_tool'), kv('gen_ai.tool.name', 'runSubagent')] }),
    normalizarSpan({ name: 'invoke_agent Explore', traceId: 'T', spanId: 'sub', parentSpanId: 'ferr', startTimeUnixNano: '3', attributes: [kv('gen_ai.operation.name', 'invoke_agent'), kv('gen_ai.agent.name', 'Explore'), kv('gen_ai.usage.input_tokens', 900), kv('gen_ai.usage.output_tokens', 90)] }),
  ];
  const { conversas } = agregarConversas(spans, { inputIncluiCache: false });
  assert.equal(conversas.length, 1);
  assert.equal(conversas[0].id, 'conv-A');
  assert.deepEqual(conversas[0].agentes.sort(), ['Explore', 'copilot']);
  const total = Object.values(conversas[0].modelos).reduce((a, m) => a + m.entrada_nova, 0);
  assert.equal(total, 5000, 'subagente não pode somar em cima do invoke_agent raiz');
});

test('spans repetidos entre arquivo ativo e histórico são deduplicados', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hm-otel-'));
  const linha = JSON.stringify({ resourceSpans: [{ scopeSpans: [{ spans: [spanOtlp([kv('gen_ai.operation.name', 'chat'), kv('gen_ai.conversation.id', 'c'), kv('gen_ai.usage.input_tokens', 10), kv('gen_ai.usage.output_tokens', 1)], { name: 'chat' })] }] }] });
  writeFileSync(join(dir, 'a.jsonl'), `${linha}\n`);
  writeFileSync(join(dir, 'b.jsonl'), `${linha}\n`);
  const r = await lerOtel([join(dir, 'a.jsonl'), join(dir, 'b.jsonl')]);
  assert.equal(r.spans.length, 1);
  assert.equal(r.duplicados, 1);
});

test('decisão de hook é normalizada a partir do atributo configurado', () => {
  const spans = [normalizarSpan({ name: 'execute_hook PreToolUse', traceId: 't', spanId: 'h', startTimeUnixNano: '1', attributes: [kv('gen_ai.operation.name', 'execute_hook'), kv('gen_ai.conversation.id', 'c'), kv('copilot_chat.hook.decision', 'DENY'), kv('copilot_chat.hook.name', 'guard-invariants')] })];
  const { conversas } = agregarConversas(spans, { atributosDecisao: ['copilot_chat.hook.decision'], atributosNomeHook: ['copilot_chat.hook.name'] });
  assert.deepEqual(conversas[0].hooks[0].decisao, 'deny');
  assert.equal(conversas[0].hooks[0].nome, 'guard-invariants');
});

test('média de histograma cumulativo usa o último snapshot da série', () => {
  const pontos = [
    { soma: 10, contagem: 20, cumulativo: true, serie: 'a' },
    { soma: 30, contagem: 40, cumulativo: true, serie: 'a' },
  ];
  assert.equal(mediaMetrica(pontos), 0.75);
});
