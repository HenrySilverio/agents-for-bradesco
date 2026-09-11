// Leitura do exportador OpenTelemetry em arquivo do Copilot Chat (COPILOT_OTEL_FILE_EXPORTER_PATH).
// O formato da linha não é garantido pela documentação, então o parser aceita:
//   - OTLP/JSON (resourceSpans → scopeSpans → spans, atributos como [{key, value:{stringValue…}}])
//   - span achatado ({name, attributes:{…}, traceId, startTime|timestamp, endTime|duration})
//   - métricas OTLP (resourceMetrics) para sobrevivência de edição
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { globParaRegex } from './config.mjs';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function valorOtlp(v) {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
  if ('stringValue' in v) return v.stringValue;
  if ('intValue' in v) return Number(v.intValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('boolValue' in v) return v.boolValue;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(valorOtlp);
  if ('kvlistValue' in v) return kv(v.kvlistValue?.values);
  return v;
}

export function kv(attrs) {
  if (!attrs) return {};
  if (Array.isArray(attrs)) {
    const o = {};
    for (const a of attrs) if (a && a.key != null) o[a.key] = valorOtlp(a.value);
    return o;
  }
  return typeof attrs === 'object' ? { ...attrs } : {};
}

// Converte epoch em ns/µs/ms/s (número, string ou [s, ns]) para ms. Devolve [ms, fatorParaMs].
function tempo(v) {
  if (v == null) return [null, 1];
  if (Array.isArray(v) && v.length === 2) return [num(v[0]) * 1000 + num(v[1]) / 1e6, 1e-6];
  if (typeof v === 'string' && !/^\d+$/.test(v)) {
    const d = Date.parse(v);
    return [Number.isNaN(d) ? null : d, 1];
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return [null, 1];
  if (n > 1e17) return [n / 1e6, 1e-6];
  if (n > 1e14) return [n / 1e3, 1e-3];
  if (n > 1e11) return [n, 1];
  return [n * 1000, 1000];
}

export function normalizarSpan(sp, resAttrs = {}) {
  const attrs = kv(sp.attributes);
  const nome = String(sp.name ?? sp.spanName ?? '');
  const [inicio, fator] = tempo(sp.startTimeUnixNano ?? sp.startTime ?? sp.timestamp ?? sp.start_time);
  let [fim] = tempo(sp.endTimeUnixNano ?? sp.endTime ?? sp.end_time);
  if (fim == null && inicio != null && sp.duration != null) {
    fim = Array.isArray(sp.duration) ? inicio + tempo(sp.duration)[0] : inicio + num(sp.duration) * fator;
  }
  const status = sp.status?.code;
  return {
    nome,
    op: String(attrs['gen_ai.operation.name'] || nome.split(' ')[0] || ''),
    traceId: sp.traceId ?? sp.spanContext?.traceId ?? sp.context?.trace_id ?? null,
    spanId: sp.spanId ?? sp.id ?? sp.spanContext?.spanId ?? sp.context?.span_id ?? null,
    parentId: sp.parentSpanId || sp.parentId || sp.parentSpanContext?.spanId || sp.parent_id || null,
    inicio,
    fim: fim ?? inicio,
    attrs,
    resAttrs,
    erro: attrs['error.type'] || (status === 2 || status === 'STATUS_CODE_ERROR' ? 'status' : null),
  };
}

function pontosMetrica(m) {
  const pontos = [];
  const bloco = m.histogram || m.sum || m.gauge || m.exponentialHistogram;
  if (!bloco) return pontos;
  const t = bloco.aggregationTemporality;
  const cumulativo = t === 2 || t === 'AGGREGATION_TEMPORALITY_CUMULATIVE';
  for (const dp of bloco.dataPoints || []) {
    const attrs = kv(dp.attributes);
    const serie = `${JSON.stringify(attrs)}|${dp.startTimeUnixNano ?? ''}`;
    if (m.histogram || m.exponentialHistogram) pontos.push({ soma: num(dp.sum), contagem: num(dp.count), cumulativo, serie });
    else pontos.push({ soma: num(dp.asDouble ?? dp.asInt ?? dp.value), contagem: 1, cumulativo, serie });
  }
  return pontos;
}

export function* registrosDaLinha(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { for (const x of obj) yield* registrosDaLinha(x); return; }
  if (Array.isArray(obj.resourceSpans)) {
    for (const rs of obj.resourceSpans) {
      const resAttrs = kv(rs.resource?.attributes);
      for (const ss of rs.scopeSpans || rs.instrumentationLibrarySpans || []) {
        for (const sp of ss.spans || []) yield { tipo: 'span', span: normalizarSpan(sp, resAttrs) };
      }
    }
    return;
  }
  if (Array.isArray(obj.resourceMetrics)) {
    for (const rm of obj.resourceMetrics) {
      for (const sm of rm.scopeMetrics || []) {
        for (const m of sm.metrics || []) yield { tipo: 'metrica', nome: m.name, pontos: pontosMetrica(m) };
      }
    }
    return;
  }
  const pareceSpan = (obj.name || obj.spanName) && obj.attributes
    && (obj.traceId || obj.spanContext || obj.startTime || obj.startTimeUnixNano || obj.timestamp || obj.spanId || obj.id);
  if (pareceSpan) { yield { tipo: 'span', span: normalizarSpan(obj, kv(obj.resource?.attributes)) }; return; }
  if (obj.metricName || (obj.name && obj.value != null)) {
    yield { tipo: 'metrica', nome: obj.metricName || obj.name, pontos: [{ soma: num(obj.value), contagem: 1, cumulativo: false, serie: '' }] };
  }
}

export function arquivosOtel(dadosDir, padroes) {
  const achados = [];
  for (const padrao of padroes || []) {
    const abs = join(dadosDir, padrao);
    if (!padrao.includes('*')) { if (existsSync(abs)) achados.push(abs); continue; }
    const dir = dirname(abs);
    if (!existsSync(dir)) continue;
    const rx = globParaRegex(abs.slice(dir.length + 1));
    for (const f of readdirSync(dir)) if (rx.test(f)) achados.push(join(dir, f));
  }
  return [...new Set(achados)].sort();
}

export async function lerOtel(arquivos) {
  const spans = [];
  const vistos = new Set();
  const metricas = new Map();
  let linhas = 0;
  let invalidas = 0;
  let duplicados = 0;
  for (const arq of arquivos) {
    const rl = createInterface({ input: createReadStream(arq, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const linha of rl) {
      if (!linha.trim()) continue;
      linhas++;
      let obj;
      try { obj = JSON.parse(linha); } catch { invalidas++; continue; }
      for (const r of registrosDaLinha(obj)) {
        if (r.tipo === 'span') {
          // Cópias de segurança do arquivo (hm guardar-otel) não podem contar em dobro.
          const chave = r.span.traceId && r.span.spanId ? `${r.span.traceId}:${r.span.spanId}` : null;
          if (chave && vistos.has(chave)) { duplicados++; continue; }
          if (chave) vistos.add(chave);
          spans.push(r.span);
        } else if (r.nome) { if (!metricas.has(r.nome)) metricas.set(r.nome, []); metricas.get(r.nome).push(...r.pontos); }
      }
    }
  }
  return { spans, metricas, linhas, invalidas, duplicados, arquivos };
}

// Média de um histograma (sobrevivência de edição etc.), respeitando temporalidade cumulativa.
export function mediaMetrica(pontos) {
  if (!pontos?.length) return null;
  const porSerie = new Map();
  let soma = 0;
  let contagem = 0;
  for (const p of pontos) {
    if (p.cumulativo) {
      const atual = porSerie.get(p.serie);
      if (!atual || p.contagem >= atual.contagem) porSerie.set(p.serie, p);
    } else { soma += p.soma; contagem += p.contagem; }
  }
  for (const p of porSerie.values()) { soma += p.soma; contagem += p.contagem; }
  return contagem > 0 ? soma / contagem : null;
}

function uso(s) {
  const a = s.attrs;
  const inp = a['gen_ai.usage.input_tokens'];
  const out = a['gen_ai.usage.output_tokens'];
  if (inp == null && out == null) return null;
  return {
    inp: num(inp),
    out: num(out),
    cr: num(a['gen_ai.usage.cache_read.input_tokens'] ?? a['gen_ai.usage.cache_read_input_tokens']),
    cw: num(a['gen_ai.usage.cache_creation.input_tokens'] ?? a['gen_ai.usage.cache_creation_input_tokens']),
  };
}

const primeiro = (attrs, chaves) => { for (const k of chaves || []) if (attrs[k] != null) return attrs[k]; return null; };

function normalizarDecisao(v) {
  if (v == null) return null;
  const s = String(v).toLowerCase();
  if (/deny|denied|block/.test(s)) return 'deny';
  if (/ask|confirm/.test(s)) return 'ask';
  if (/allow|approve/.test(s)) return 'allow';
  return s.slice(0, 20);
}

// Agrupa spans por conversa. Spans de subagente herdam a conversa da raiz do trace.
export function agregarConversas(spans, { inputIncluiCache = 'auto', atributosDecisao = [], atributosNomeHook = [] } = {}) {
  const porSpanId = new Map(spans.filter((s) => s.spanId).map((s) => [s.spanId, s]));
  const convDoTrace = new Map();
  for (const s of spans) {
    const c = s.attrs['gen_ai.conversation.id'];
    if (!c || !s.traceId) continue;
    const raiz = !s.parentId || !porSpanId.has(s.parentId);
    if (raiz || !convDoTrace.has(s.traceId)) convDoTrace.set(s.traceId, String(c));
  }
  const conv = (s) => (s.traceId && convDoTrace.get(s.traceId)) || (s.attrs['gen_ai.conversation.id'] ? String(s.attrs['gen_ai.conversation.id']) : null);

  let incluiCache = inputIncluiCache;
  if (incluiCache === 'auto') {
    incluiCache = !spans.some((s) => { const u = uso(s); return u && u.cr + u.cw > u.inp; });
  }

  const temAncestralInvoke = (s) => {
    let p = s.parentId ? porSpanId.get(s.parentId) : null;
    for (let i = 0; p && i < 50; i++) {
      if (p.op === 'invoke_agent') return true;
      p = p.parentId ? porSpanId.get(p.parentId) : null;
    }
    return false;
  };

  const comUsoChat = new Set();
  for (const s of spans) { const cid = conv(s); if (cid && s.op === 'chat' && uso(s)) comUsoChat.add(cid); }

  const conversas = new Map();
  for (const s of spans) {
    const cid = conv(s);
    if (!cid) continue;
    if (!conversas.has(cid)) {
      conversas.set(cid, {
        id: cid, inicio: Infinity, fim: -Infinity, modelos: {}, agentes: new Set(), ferramentas: {},
        hooks: [], chamadas: 0, turnos: 0, ttft_ms: [], erros: 0, marcos: [], fonte_tokens: null,
      });
    }
    const c = conversas.get(cid);
    if (s.inicio != null) { c.inicio = Math.min(c.inicio, s.inicio); if (c.marcos.length < 5000) c.marcos.push(s.inicio); }
    if (s.fim != null) { c.fim = Math.max(c.fim, s.fim); if (c.marcos.length < 5000) c.marcos.push(s.fim); }
    const agente = s.attrs['gen_ai.agent.name'];
    if (agente) c.agentes.add(String(agente));
    if (s.op === 'invoke_agent' && !temAncestralInvoke(s)) c.turnos += num(s.attrs['copilot_chat.turn_count']);
    if (s.op === 'execute_tool') {
      const n = String(s.attrs['gen_ai.tool.name'] || s.nome.replace(/^execute_tool\s*/, '') || 'ferramenta');
      c.ferramentas[n] = (c.ferramentas[n] || 0) + 1;
    }
    if (s.op === 'execute_hook' || s.nome.startsWith('execute_hook')) {
      c.hooks.push({
        nome: String(primeiro(s.attrs, atributosNomeHook) || s.nome.replace(/^execute_hook\s*/, '') || 'hook'),
        decisao: normalizarDecisao(primeiro(s.attrs, atributosDecisao)),
        t: s.inicio,
      });
    }
    if (s.erro) c.erros++;
    if (s.op === 'chat') {
      c.chamadas++;
      const tt = num(s.attrs['copilot_chat.time_to_first_token']);
      if (tt > 0) c.ttft_ms.push(tt);
    }
    const u = uso(s);
    const contar = u && (s.op === 'chat' || (s.op === 'invoke_agent' && !comUsoChat.has(cid) && !temAncestralInvoke(s)));
    if (contar) {
      const modelo = String(s.attrs['gen_ai.response.model'] || s.attrs['gen_ai.request.model'] || 'desconhecido');
      const m = (c.modelos[modelo] ||= { entrada_nova: 0, cache_leitura: 0, cache_escrita: 0, saida: 0, chamadas: 0 });
      m.entrada_nova += incluiCache ? Math.max(0, u.inp - u.cr - u.cw) : u.inp;
      m.cache_leitura += u.cr;
      m.cache_escrita += u.cw;
      m.saida += u.out;
      m.chamadas++;
      c.fonte_tokens = s.op;
    }
  }
  const lista = [...conversas.values()].map((c) => ({ ...c, agentes: [...c.agentes] }));
  return { conversas: lista, inputIncluiCache: incluiCache };
}

export function inventarioAtributos(spans) {
  const inv = {};
  for (const s of spans) {
    const k = s.op || s.nome || '?';
    const e = (inv[k] ||= { spans: 0, atributos: {} });
    e.spans++;
    for (const a of Object.keys(s.attrs)) e.atributos[a] = (e.atributos[a] || 0) + 1;
  }
  return inv;
}
