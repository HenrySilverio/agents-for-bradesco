// Projeção: eventos brutos + OTel + estimativas + config → dados.json.
// Função pura sobre arquivos: rodar duas vezes com a mesma entrada dá o mesmo resultado.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSAO_COLETOR, compilarToolkits, globParaRegex } from './config.mjs';
import { agregarConversas, arquivosOtel, lerOtel, mediaMetrica } from './otel.mjs';

// ───────────────────────── utilitários ─────────────────────────
export const arred = (n, casas = 1) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** casas) / 10 ** casas);
const soma = (xs, f = (x) => x) => xs.reduce((a, x) => a + (Number(f(x)) || 0), 0);

export function lerJsonl(arquivo) {
  if (!existsSync(arquivo)) return [];
  const out = [];
  for (const l of readFileSync(arquivo, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* linha corrompida é ignorada */ }
  }
  return out;
}

function percentil(valores, p) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}

export function dataLocal(ms) {
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function inicioSemana(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

class UniaoBusca {
  constructor() { this.pai = new Map(); }
  achar(x) {
    if (!this.pai.has(x)) this.pai.set(x, x);
    let r = x;
    while (this.pai.get(r) !== r) r = this.pai.get(r);
    let c = x;
    while (this.pai.get(c) !== r) { const n = this.pai.get(c); this.pai.set(c, r); c = n; }
    return r;
  }
  unir(a, b) { const ra = this.achar(a); const rb = this.achar(b); if (ra !== rb) this.pai.set(rb, ra); }
  tem(x) { return this.pai.has(x); }
}

// ───────────────────────── preço ─────────────────────────
const cachePreco = new Map();
export function acharPreco(modelo, precos) {
  const k = `${modelo}`;
  if (cachePreco.has(k)) return cachePreco.get(k);
  const p = precos.modelos.find((m) => new RegExp(m.padrao, 'i').test(modelo)) || null;
  cachePreco.set(k, p);
  return p;
}

const usdDe = (t, p) => (
  t.entrada_nova * p.entrada
  + t.cache_leitura * (p.cache_leitura ?? p.entrada)
  + t.cache_escrita * (p.cache_escrita ?? p.entrada)
  + t.saida * p.saida
) / 1e6;

export function precificar(porModelo, precos, refId) {
  const ref = precos.modelos.find((m) => m.id === refId) || null;
  let usd = 0;
  let usdRef = 0;
  const semPreco = [];
  const detalhe = {};
  for (const [modelo, t] of Object.entries(porModelo || {})) {
    const p = acharPreco(modelo, precos);
    if (!p) { semPreco.push(modelo); detalhe[modelo] = { ...t, preco_id: null, usd: null }; continue; }
    const u = usdDe(t, p);
    usd += u;
    if (ref) usdRef += usdDe(t, ref);
    detalhe[modelo] = { ...t, preco_id: p.id, usd: u };
  }
  return {
    usd,
    creditos: usd / precos.credito_usd,
    economia_roteamento_usd: ref ? usdRef - usd : null,
    sem_preco: semPreco,
    por_modelo: detalhe,
  };
}

// ───────────────────────── sessões ─────────────────────────
export function carregarEventos(dados) {
  const dir = join(dados, 'eventos');
  const mapa = new Map();
  if (!existsSync(dir)) return mapa;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue;
    const evs = lerJsonl(join(dir, f)).filter((e) => e && e.ev && e.t);
    if (!evs.length) continue;
    evs.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    mapa.set(evs[0].sid || f.replace(/\.jsonl$/, ''), evs);
  }
  return mapa;
}

function sessaoVazia(id, origem) {
  return {
    id, origem, repo: null, comandos: [], toolkit: null, etapa: null, deteccao: null,
    tickets_prompt: [], estimativas_prompt: [], prompts: 0,
    ferramentas: { total: 0, por_categoria: {}, interrompidas: 0 },
    terminal: {}, terminal_interrompidas: {},
    arquivos_editados: [], arquivos_criados: [], contrato_editados: [],
    sondas: [], subagentes: 0, compactacoes: 0,
    git: { branch_inicio: null, head_inicio: null, branch_fim: null, head_fim: null, diff: null },
    primeira_edicao_codigo: null, sid_fallback: false,
    conversas: [], correlacao: null, agentes_otel: [], hooks_otel: [],
    llm: { chamadas: 0, turnos: 0, ttft_ms_p50: null, erros: 0 },
    tokens_por_modelo: {}, tokens: null,
    _tempos: [], _marcosOtel: [], _nomesFerramenta: new Set(), _pathsVistos: new Set(), _ttft: [], _hookMs: [],
  };
}

export function projetarSessao(sid, eventos, ctx) {
  const { comp, reNaoCodigo } = ctx;
  const s = sessaoVazia(sid, 'hook');
  const pendentes = new Map();
  const editados = new Set();
  const criados = new Set();
  const contrato = new Set();
  for (const e of eventos) {
    const ms = Date.parse(e.t);
    if (Number.isFinite(ms)) s._tempos.push(ms);
    if (e.hook_ms != null) s._hookMs.push(e.hook_ms);
    if (e.sid_origem === 'fallback') s.sid_fallback = true;
    switch (e.ev) {
      case 'SessionStart':
        s.repo ??= e.repo ?? null;
        if (!s.git.head_inicio && !s.git.branch_inicio) { s.git.branch_inicio = e.git?.branch ?? null; s.git.head_inicio = e.git?.head ?? null; }
        break;
      case 'UserPromptSubmit':
        s.prompts++;
        if (e.cmd) s.comandos.push(e.cmd);
        for (const t of e.tickets || []) if (!s.tickets_prompt.includes(t)) s.tickets_prompt.push(t);
        if (e.estimativa_h != null && Number.isFinite(e.estimativa_h)) s.estimativas_prompt.push({ t: e.t, horas: e.estimativa_h, tickets: e.tickets || [] });
        break;
      case 'PreToolUse': {
        s.ferramentas.total++;
        s.ferramentas.por_categoria[e.cat] = (s.ferramentas.por_categoria[e.cat] || 0) + 1;
        if (e.tool) s._nomesFerramenta.add(e.tool);
        if (e.id) pendentes.set(e.id, e);
        for (const p of e.paths || []) s._pathsVistos.add(p);
        if (e.cat === 'edicao') {
          for (const p of e.paths || []) {
            if (p.startsWith('~ext/')) continue;
            editados.add(p);
            if (comp.contrato.test(p)) contrato.add(p);
            if (!reNaoCodigo.test(p) && (s.primeira_edicao_codigo == null || ms < s.primeira_edicao_codigo)) s.primeira_edicao_codigo = ms;
          }
          for (const p of e.novos || []) criados.add(p);
        }
        break;
      }
      case 'PostToolUse':
        if (e.id) pendentes.delete(e.id);
        if (e.term) {
          const r = (s.terminal[e.term] ||= { execucoes: 0, falhas: 0, sucessos: 0, desconhecidos: 0 });
          r.execucoes++;
          if (e.res === 'falha') r.falhas++;
          else if (e.res === 'sucesso') r.sucessos++;
          else r.desconhecidos++;
        }
        for (const sd of e.sondas || []) s.sondas.push({ ...sd, t: ms });
        break;
      case 'PreCompact': s.compactacoes++; break;
      case 'SubagentStart': s.subagentes++; break;
      case 'Stop':
        s.git.branch_fim = e.git?.branch ?? s.git.branch_fim;
        s.git.head_fim = e.git?.head ?? s.git.head_fim;
        if (e.git?.diff) s.git.diff = e.git.diff;
        break;
      default: break;
    }
  }
  s.ferramentas.interrompidas = pendentes.size;
  for (const p of pendentes.values()) if (p.term) s.terminal_interrompidas[p.term] = (s.terminal_interrompidas[p.term] || 0) + 1;
  s.arquivos_editados = [...editados];
  s.arquivos_criados = [...criados];
  s.contrato_editados = [...contrato];
  s._tempos.sort((a, b) => a - b);
  return s;
}

function anexarConversa(s, c, tipo) {
  const ordem = { id: 0, janela: 1, ambigua: 2 };
  s.conversas.push(c.id);
  s.correlacao = s.correlacao == null || ordem[tipo] > ordem[s.correlacao] ? tipo : s.correlacao;
  for (const [modelo, t] of Object.entries(c.modelos)) {
    const m = (s.tokens_por_modelo[modelo] ||= { entrada_nova: 0, cache_leitura: 0, cache_escrita: 0, saida: 0, chamadas: 0 });
    for (const k of Object.keys(m)) m[k] += t[k] || 0;
  }
  s._marcosOtel.push(...c.marcos);
  for (const a of c.agentes) if (!s.agentes_otel.includes(a)) s.agentes_otel.push(a);
  s.hooks_otel.push(...c.hooks);
  s.llm.chamadas += c.chamadas;
  s.llm.turnos += c.turnos;
  s.llm.erros += c.erros;
  s._ttft.push(...c.ttft_ms);
  for (const n of Object.keys(c.ferramentas)) s._nomesFerramenta.add(n);
}

export function correlacionar(sessoes, conversas, janelaMin) {
  const porId = new Map(sessoes.map((s) => [s.id, s]));
  const tol = janelaMin * 60000;
  const stats = { id: 0, janela: 0, ambigua: 0, orfas: 0 };
  const restantes = [];
  for (const c of conversas) {
    const s = porId.get(c.id) || porId.get(String(c.id).replace(/[^\w.-]/g, '_').slice(0, 120));
    if (s) { anexarConversa(s, c, 'id'); s._direta = true; stats.id++; } else restantes.push(c);
  }
  const orfas = [];
  for (const c of restantes) {
    const candidatos = [];
    for (const s of sessoes) {
      if (s._direta || !s._tempos.length) continue;
      const ini = s._tempos[0] - tol;
      const fim = s._tempos[s._tempos.length - 1] + tol;
      const sobreposicao = Math.min(fim, c.fim) - Math.max(ini, c.inicio);
      if (sobreposicao < 0) continue;
      // IoU em vez de sobreposição bruta: um chat curto não é engolido por uma sessão longa em paralelo.
      const uniao = Math.max(fim, c.fim) - Math.min(ini, c.inicio);
      candidatos.push([uniao > 0 ? sobreposicao / uniao : 1, s]);
    }
    if (!candidatos.length) { orfas.push(c); stats.orfas++; continue; }
    candidatos.sort((a, b) => b[0] - a[0]);
    const tipo = candidatos.length > 1 ? 'ambigua' : 'janela';
    anexarConversa(candidatos[0][1], c, tipo);
    stats[tipo]++;
  }
  return { stats, orfas };
}

function sessaoDeConversaOrfa(c) {
  const s = sessaoVazia(`otel-${String(c.id).replace(/[^\w.-]/g, '_').slice(0, 100)}`, 'otel');
  anexarConversa(s, c, 'id');
  s.correlacao = 'sem_hook';
  return s;
}

function detectarToolkit(s, ctx) {
  const { comp, tk } = ctx;
  for (const c of s.comandos) {
    const k = comp.comandosConhecidos.get(c.toLowerCase());
    if (k) return { ...k, deteccao: 'comando' };
  }
  for (const a of s.agentes_otel) {
    for (const [id, def] of Object.entries(tk.toolkits)) {
      const etapa = def.agentes?.[a] ?? def.agentes?.[a.toLowerCase()];
      if (etapa) return { toolkit: id, etapa, deteccao: 'agente' };
    }
  }
  const paths = [...s._pathsVistos];
  for (const [id, def] of Object.entries(tk.toolkits)) {
    for (const [fonte, etapa] of Object.entries(def.arquivos_gatilho || {})) {
      const rx = new RegExp(fonte, 'i');
      if (paths.some((p) => rx.test(p))) return { toolkit: id, etapa, deteccao: 'arquivo' };
    }
  }
  const nomes = [...s._nomesFerramenta];
  for (const [id, def] of Object.entries(tk.toolkits)) {
    for (const [fonte, etapa] of Object.entries(def.ferramentas_gatilho || {})) {
      const rx = new RegExp(fonte, 'i');
      if (nomes.some((n) => rx.test(n))) return { toolkit: id, etapa, deteccao: 'ferramenta' };
    }
  }
  return { toolkit: null, etapa: null, deteccao: null };
}

function finalizarSessao(s, ctx) {
  const { parametros, precos } = ctx;
  const tempos = [...s._tempos, ...s._marcosOtel].filter(Number.isFinite).sort((a, b) => a - b);
  s.inicio = tempos.length ? tempos[0] : null;
  s.fim = tempos.length ? tempos[tempos.length - 1] : null;
  const limiar = parametros.limiar_ociosidade_min * 60000;
  let ativo = 0;
  for (let i = 1; i < tempos.length; i++) { const gap = tempos[i] - tempos[i - 1]; if (gap <= limiar) ativo += gap; }
  s.duracao_bruta_min = s.inicio != null ? (s.fim - s.inicio) / 60000 : 0;
  s.duracao_ativa_min = ativo / 60000;
  Object.assign(s, detectarToolkit(s, ctx));
  s.llm.ttft_ms_p50 = percentil(s._ttft, 50);
  const modelos = Object.values(s.tokens_por_modelo);
  s.tokens = modelos.length ? {
    entrada_nova: soma(modelos, (m) => m.entrada_nova),
    cache_leitura: soma(modelos, (m) => m.cache_leitura),
    cache_escrita: soma(modelos, (m) => m.cache_escrita),
    saida: soma(modelos, (m) => m.saida),
  } : null;
  if (s.tokens) s.tokens.total = s.tokens.entrada_nova + s.tokens.cache_leitura + s.tokens.cache_escrita + s.tokens.saida;
  s.custo = precificar(s.tokens_por_modelo, precos, parametros.modelo_referencia_roteamento);
  s.hook_ms = s._hookMs;
  return s;
}

// ───────────────────────── atividades ─────────────────────────
function criarContextoChaves(parametros, tk, vinculos) {
  const reTicketTotal = new RegExp(`^(?:${parametros.ticket_regex})$`);
  const reTicketParcial = new RegExp(parametros.ticket_regex);
  const branchesIgnoradas = (parametros.branches_ignoradas || []).map(globParaRegex);
  const sondasPorId = new Map(tk.sondas.map((s) => [s.id, s]));
  const normalizarChave = (valor) => {
    const v = String(valor ?? '').trim();
    if (!v) return null;
    if (/^(ticket|sdd|briefing|branch|atividade):/.test(v)) return v;
    if (reTicketTotal.test(v)) return `ticket:${v}`;
    return `atividade:${v}`;
  };
  const chaveBranch = (b) => (!b || branchesIgnoradas.some((rx) => rx.test(b)) ? null : `branch:${b}`);
  const chavesDaSessao = (s) => {
    const manual = vinculos.sessoes?.[s.id];
    if (manual) return [normalizarChave(manual)];
    const chaves = new Set();
    for (const sd of s.sondas) {
      const def = sondasPorId.get(sd.id);
      for (const [campo, ns] of Object.entries(def?.chaves || {})) {
        const v = sd.campos?.[campo];
        if (!v) continue;
        chaves.add(ns === 'branch' ? chaveBranch(v) : `${ns}:${v}`);
      }
    }
    if (s.tickets_prompt[0]) chaves.add(`ticket:${s.tickets_prompt[0]}`);
    for (const b of [s.git.branch_inicio, s.git.branch_fim]) {
      const k = chaveBranch(b);
      if (!k) continue;
      chaves.add(k);
      const t = b.match(reTicketParcial);
      if (t) chaves.add(`ticket:${t[0]}`);
    }
    chaves.delete(null);
    return [...chaves];
  };
  return { normalizarChave, chavesDaSessao, sondasPorId };
}

const PRIORIDADE_ROTULO = ['ticket', 'sdd', 'briefing', 'atividade', 'branch'];

function rotuloAtividade(chaves, contagem) {
  for (const ns of PRIORIDADE_ROTULO) {
    const doTipo = chaves.filter((c) => c.startsWith(`${ns}:`));
    if (!doTipo.length) continue;
    doTipo.sort((a, b) => (contagem.get(b) || 0) - (contagem.get(a) || 0) || a.localeCompare(b));
    return { rotulo: doTipo[0].slice(ns.length + 1), tipo: ns, multiplos: ns === 'ticket' && doTipo.length > 1 };
  }
  return { rotulo: '?', tipo: null, multiplos: false };
}

function ultimaSondaPorPath(sessoes, id, somenteEdicao = false) {
  const mapa = new Map();
  for (const s of sessoes) {
    for (const sd of s.sondas) {
      if (sd.id !== id || (somenteEdicao && sd.op !== 'edicao')) continue;
      const atual = mapa.get(sd.path);
      if (!atual || sd.t >= atual.t) mapa.set(sd.path, sd);
    }
  }
  return [...mapa.values()];
}

// Última leitura do campo em cada arquivo: uma sonda posterior que não mediu o campo
// (ex.: leitura sem contagem) não pode zerar o valor já medido.
function somaUltimoValor(sessoes, id, campo, somenteEdicao = false) {
  const mapa = new Map();
  for (const s of sessoes) {
    for (const sd of s.sondas) {
      if (sd.id !== id || (somenteEdicao && sd.op !== 'edicao')) continue;
      const v = sd.campos?.[campo];
      if (v == null) continue;
      const atual = mapa.get(sd.path);
      if (!atual || sd.t >= atual.t) mapa.set(sd.path, { t: sd.t, v: Number(v) || 0 });
    }
  }
  return [...mapa.values()].reduce((a, x) => a + x.v, 0);
}

function contarUnidades(sessoes, tk) {
  const qtd = {};
  for (const [unidade, regra] of Object.entries(tk.unidades || {})) {
    const doToolkit = regra.toolkit ? sessoes.filter((s) => s.toolkit === regra.toolkit) : sessoes;
    if (regra.tipo === 'sonda_max') {
      let max = 0;
      for (const s of doToolkit) for (const sd of s.sondas) if (sd.id === regra.sonda) max = Math.max(max, Number(sd.campos?.[regra.campo]) || 0);
      qtd[unidade] = max;
    } else if (regra.tipo === 'sonda_distintos') {
      const vals = new Set();
      for (const s of doToolkit) for (const sd of s.sondas) {
        if (sd.id !== regra.sonda || (regra.somente_edicao && sd.op !== 'edicao')) continue;
        if (sd.campos?.[regra.campo]) vals.add(sd.campos[regra.campo]);
      }
      qtd[unidade] = vals.size;
    } else if (regra.tipo === 'arquivos_criados') {
      const rx = new RegExp(regra.caminho);
      const ex = regra.excluir ? new RegExp(regra.excluir) : null;
      const vals = new Set();
      for (const s of doToolkit) for (const p of s.arquivos_criados) if (rx.test(p) && !(ex && ex.test(p))) vals.add(p);
      qtd[unidade] = vals.size;
    }
  }
  return qtd;
}

function projetarAtividade(id, rotuloInfo, chaves, sessoes, estimativas, conclusoesManuais, ctx) {
  const { parametros, tk, calibracao, guardrailsPorSessao } = ctx;
  const ordenadas = [...sessoes].sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0));
  const alertas = [];
  const fluxo = [];
  for (const s of ordenadas) {
    if (!s.toolkit) continue;
    const passo = `${s.toolkit}.${s.etapa}`;
    if (fluxo[fluxo.length - 1] !== passo) fluxo.push(passo);
  }
  const inicio = Math.min(...ordenadas.map((s) => s.inicio ?? Infinity));
  const fim = Math.max(...ordenadas.map((s) => s.fim ?? -Infinity));
  const conclusaoFluxo = ordenadas.find((s) => (parametros.conclusao || []).some((c) => c.toolkit === s.toolkit && c.etapa === s.etapa));
  const conclusaoManual = conclusoesManuais.find((c) => chaves.includes(c.chave));
  const concluida = Boolean(conclusaoFluxo || conclusaoManual);
  const execucoes = ordenadas.map((s) => s.primeira_edicao_codigo).filter((x) => x != null);
  const inicioExecucao = execucoes.length ? Math.min(...execucoes) : null;

  const ativoMin = soma(ordenadas, (s) => s.duracao_ativa_min);
  const comIaH = (ativoMin / 60) * (1 + parametros.sobrecarga_humana_fora_sessao_pct / 100);

  // estimativas
  const antes = estimativas.filter((e) => inicioExecucao == null || e.t < inicioExecucao).sort((a, b) => a.t - b.t);
  const depois = estimativas.filter((e) => inicioExecucao != null && e.t >= inicioExecucao).sort((a, b) => a.t - b.t);
  const cega = antes.length ? antes[antes.length - 1] : null;
  const naoCega = !cega && depois.length ? depois[depois.length - 1] : null;
  if (naoCega) alertas.push('estimativa_nao_cega');
  if (!cega && !naoCega) alertas.push('sem_estimativa');

  const qtd = contarUnidades(ordenadas, tk);
  const detalheParam = [];
  let parametrica = 0;
  for (const [unidade, n] of Object.entries(qtd)) {
    const valor = calibracao.unidades?.[unidade]?.horas;
    if (!n || valor == null) continue;
    detalheParam.push({ unidade, rotulo: calibracao.unidades[unidade].rotulo, quantidade: n, horas_unidade: valor, subtotal_h: n * valor });
    parametrica += n * valor;
  }
  const paramH = parametrica > 0 ? parametrica : null;
  const cegaH = cega?.horas ?? null;

  let referencia = null;
  let fonteRef = null;
  const estrategia = parametros.estrategia_referencia;
  if (estrategia === 'cega') { referencia = cegaH; fonteRef = cegaH != null ? 'cega' : null; }
  else if (estrategia === 'parametrica') { referencia = paramH; fonteRef = paramH != null ? 'parametrica' : null; }
  else {
    const cands = [['cega', cegaH], ['parametrica', paramH]].filter(([, v]) => v != null && v > 0);
    if (cands.length) { cands.sort((a, b) => a[1] - b[1]); [fonteRef, referencia] = cands[0]; }
    if (cands.length === 1) alertas.push('fonte_unica');
  }
  let divergencia = null;
  if (cegaH && paramH) {
    divergencia = (Math.abs(cegaH - paramH) / Math.max(cegaH, paramH)) * 100;
    if (divergencia > parametros.divergencia_alerta_pct) alertas.push('divergencia');
  }

  const ganho = concluida && referencia != null && comIaH > 0
    ? { horas_economizadas: referencia - comIaH, fator: referencia / comIaH }
    : null;
  if (!concluida) alertas.push('nao_concluida');

  // custo e tokens
  const porModelo = {};
  for (const s of ordenadas) for (const [m, t] of Object.entries(s.tokens_por_modelo)) {
    const acc = (porModelo[m] ||= { entrada_nova: 0, cache_leitura: 0, cache_escrita: 0, saida: 0, chamadas: 0 });
    for (const k of Object.keys(acc)) acc[k] += t[k] || 0;
  }
  const custo = precificar(porModelo, ctx.precos, parametros.modelo_referencia_roteamento);
  if (ordenadas.some((s) => !s.tokens)) alertas.push('sessao_sem_tokens');
  if (custo.sem_preco.length) alertas.push('modelo_sem_preco');
  if (ordenadas.some((s) => s.correlacao === 'ambigua')) alertas.push('correlacao_ambigua');
  if (ordenadas.some((s) => s.sid_fallback)) alertas.push('sid_fallback');
  if (rotuloInfo.multiplos) alertas.push('multiplos_tickets');

  // qualidade
  const vereditos = ultimaSondaPorPath(ordenadas, 'sdd.veredito', true)
    .filter((v) => v.campos?.veredito)
    .map((v) => ({ eixo: v.campos.eixo || 'geral', commit: v.campos.commit || null, veredito: v.campos.veredito, t: v.t }))
    .sort((a, b) => a.t - b.t);
  const primeiroPorEixo = new Map();
  for (const v of vereditos) if (!primeiroPorEixo.has(v.eixo)) primeiroPorEixo.set(v.eixo, v.veredito);
  const aprovadaPrimeira = primeiroPorEixo.size ? [...primeiroPorEixo.values()].every((v) => v === 'APROVADO') : null;
  const reprovacoes = vereditos.filter((v) => v.veredito === 'REPROVADO').length;
  const term = (classe, campo) => soma(ordenadas, (s) => s.terminal[classe]?.[campo]);
  const lacunas = somaUltimoValor(ordenadas, 'discovery.briefing', 'nao_respondido');
  const liquidElementos = somaUltimoValor(ordenadas, 'd2c.template', 'liquid_elementos', true);
  const declaracoesCss = somaUltimoValor(ordenadas, 'd2c.estilo', 'declaracoes_css', true);

  // segurança
  const guard = { deny: 0, ask: 0, por_regra: {} };
  const registrarGuard = (regra, decisao) => {
    if (decisao !== 'deny' && decisao !== 'ask') return;
    guard[decisao]++;
    const r = (guard.por_regra[regra] ||= { deny: 0, ask: 0 });
    r[decisao]++;
  };
  for (const s of ordenadas) {
    for (const h of s.hooks_otel) registrarGuard(h.nome, h.decisao);
    for (const g of guardrailsPorSessao.get(s.id) || []) registrarGuard(g.regra, g.decisao);
  }
  const editadosDistintos = new Set(ordenadas.flatMap((s) => s.arquivos_editados));
  const contratoDistintos = new Set(ordenadas.flatMap((s) => s.contrato_editados));

  return {
    id,
    rotulo: rotuloInfo.rotulo,
    tipo_chave: rotuloInfo.tipo,
    chaves,
    repos: [...new Set(ordenadas.map((s) => s.repo).filter(Boolean))],
    fluxo,
    sessoes: ordenadas.map((s) => s.id),
    inicio: Number.isFinite(inicio) ? inicio : null,
    fim: Number.isFinite(fim) ? fim : null,
    lead_time_dias: Number.isFinite(inicio) && Number.isFinite(fim) ? arred((fim - inicio) / 86400000, 1) : null,
    concluida,
    conclusao_origem: conclusaoFluxo ? 'fluxo' : conclusaoManual ? 'manual' : null,
    inicio_execucao: inicioExecucao,
    tempo: { ativo_min: arred(ativoMin, 1), com_ia_h: arred(comIaH, 2) },
    estimativa: {
      cega_h: cegaH,
      cega_registrada_em: cega ? new Date(cega.t).toISOString() : null,
      cega_origem: cega?.origem ?? null,
      nao_cega_h: naoCega?.horas ?? null,
      parametrica_h: paramH != null ? arred(paramH, 2) : null,
      parametrica_detalhe: detalheParam,
      referencia_h: referencia != null ? arred(referencia, 2) : null,
      referencia_fonte: fonteRef,
      divergencia_pct: arred(divergencia, 0),
    },
    ganho: ganho ? { horas_economizadas: arred(ganho.horas_economizadas, 2), fator: arred(ganho.fator, 2) } : null,
    custo: { usd: arred(custo.usd, 4), creditos: arred(custo.creditos, 1), economia_roteamento_usd: arred(custo.economia_roteamento_usd, 4) },
    tokens: {
      entrada_nova: soma(Object.values(porModelo), (m) => m.entrada_nova),
      cache_leitura: soma(Object.values(porModelo), (m) => m.cache_leitura),
      cache_escrita: soma(Object.values(porModelo), (m) => m.cache_escrita),
      saida: soma(Object.values(porModelo), (m) => m.saida),
    },
    qualidade: {
      vereditos,
      aprovada_primeira: aprovadaPrimeira,
      reprovacoes,
      validador: { execucoes: term('validador_sdd', 'execucoes'), falhas: term('validador_sdd', 'falhas') },
      testes: { execucoes: term('teste', 'execucoes'), falhas: term('teste', 'falhas') },
      lint: { execucoes: term('lint', 'execucoes'), falhas: term('lint', 'falhas') },
      lacunas_explicitadas: lacunas,
      unidades: qtd,
      d2c: { liquid_elementos: liquidElementos, declaracoes_css: declaracoesCss },
    },
    seguranca: {
      guardrails: guard,
      git_escrita_executada: term('git_escrita', 'execucoes'),
      git_escrita_interrompida: soma(ordenadas, (s) => s.terminal_interrompidas?.git_escrita),
      contrato_editados: contratoDistintos.size,
      ferramentas_interrompidas: soma(ordenadas, (s) => s.ferramentas.interrompidas),
    },
    arquivos_editados: editadosDistintos.size,
    alertas: [...new Set(alertas)],
    sessoes_detalhe: ordenadas.map(resumoSessao),
  };
}

function resumoSessao(s) {
  const modelos = Object.keys(s.tokens_por_modelo);
  return {
    id: s.id,
    origem: s.origem,
    passo: s.toolkit ? `${s.toolkit}.${s.etapa}` : 'livre',
    inicio: s.inicio,
    ativo_min: arred(s.duracao_ativa_min, 1),
    usd: arred(s.custo.usd, 4),
    tokens: s.tokens?.total ?? null,
    modelos,
    correlacao: s.correlacao,
  };
}

// ───────────────────────── agregados ─────────────────────────
function rotuloPasso(passo, tk) {
  if (passo === 'livre') return 'Sem toolkit (chat livre)';
  const [id, etapa] = passo.split('.');
  return `${tk.toolkits[id]?.rotulo ?? id} · ${etapa}`;
}

function ordemPasso(passo, tk) {
  if (passo === 'livre') return 9999;
  const [id, etapa] = passo.split('.');
  const i = tk.ordem_fluxo.indexOf(id);
  const j = tk.toolkits[id]?.etapas?.indexOf(etapa) ?? 99;
  return (i < 0 ? 50 : i) * 100 + (j < 0 ? 99 : j);
}

function agregarEtapas(sessoes, tk) {
  const grupos = new Map();
  for (const s of sessoes) {
    const passo = s.toolkit ? `${s.toolkit}.${s.etapa}` : 'livre';
    if (!grupos.has(passo)) grupos.set(passo, []);
    grupos.get(passo).push(s);
  }
  return [...grupos.entries()]
    .sort((a, b) => ordemPasso(a[0], tk) - ordemPasso(b[0], tk))
    .map(([passo, ss]) => {
      const entrada = soma(ss, (s) => s.tokens?.entrada_nova) + soma(ss, (s) => s.tokens?.cache_leitura) + soma(ss, (s) => s.tokens?.cache_escrita);
      const usd = soma(ss, (s) => s.custo.usd);
      return {
        passo,
        rotulo: rotuloPasso(passo, tk),
        toolkit: passo === 'livre' ? null : passo.split('.')[0],
        sessoes: ss.length,
        ativo_min: arred(soma(ss, (s) => s.duracao_ativa_min), 1),
        usd: arred(usd, 4),
        usd_medio_sessao: arred(usd / ss.length, 4),
        tokens: soma(ss, (s) => s.tokens?.total),
        cache_pct: entrada ? arred((soma(ss, (s) => s.tokens?.cache_leitura) / entrada) * 100, 1) : null,
        prompts: soma(ss, (s) => s.prompts),
        ferramentas: soma(ss, (s) => s.ferramentas.total),
        compactacoes: soma(ss, (s) => s.compactacoes),
        subagentes: soma(ss, (s) => s.subagentes),
        sem_tokens: ss.filter((s) => !s.tokens).length,
        modelos: [...new Set(ss.flatMap((s) => Object.values(s.custo.por_modelo).map((m) => m.preco_id).filter(Boolean)))],
      };
    });
}

function agregarModelos(sessoes, precos) {
  const mapa = new Map();
  for (const s of sessoes) {
    for (const [modelo, d] of Object.entries(s.custo.por_modelo)) {
      const chave = d.preco_id || modelo;
      const acc = mapa.get(chave) || { modelo: chave, com_preco: Boolean(d.preco_id), entrada_nova: 0, cache_leitura: 0, cache_escrita: 0, saida: 0, chamadas: 0, usd: 0 };
      for (const k of ['entrada_nova', 'cache_leitura', 'cache_escrita', 'saida', 'chamadas']) acc[k] += d[k] || 0;
      acc.usd += d.usd || 0;
      mapa.set(chave, acc);
    }
  }
  const total = soma([...mapa.values()], (m) => m.usd);
  return [...mapa.values()]
    .map((m) => ({ ...m, usd: arred(m.usd, 4), pct_usd: total ? arred((m.usd / total) * 100, 1) : 0 }))
    .sort((a, b) => b.usd - a.usd);
}

function metodologia(cfg, cobertura) {
  const { parametros: p, precos, calibracao } = cfg;
  return [
    { metrica: 'Tempo ativo em sessão', tipo: 'Medido', fonte: 'Carimbos de tempo dos hooks + início/fim dos spans OTel', premissa: `Intervalo acima de ${p.limiar_ociosidade_min} min entre eventos não conta` },
    { metrica: 'Tempo com IA', tipo: 'Derivado', fonte: 'Tempo ativo × (1 + sobrecarga)', premissa: `Sobrecarga humana fora da sessão: ${p.sobrecarga_humana_fora_sessao_pct}%` },
    { metrica: 'Horas sem IA — estimativa cega', tipo: 'Estimado', fonte: 'Dev registra antes da primeira edição de código (hm estimar ou estimativa-sem-ia: no prompt)', premissa: 'Registrada depois do início da execução → marcada como não cega e fora do KPI' },
    { metrica: 'Horas sem IA — tabela paramétrica', tipo: 'Estimado', fonte: 'Unidades observadas nos artefatos × calibracao.json', premissa: `Tabela ${calibracao.versao}, calibrada por ${calibracao.calibrado_por}${calibracao.calibrado_em ? ` em ${calibracao.calibrado_em}` : ''}` },
    { metrica: 'Horas economizadas', tipo: 'Estimado', fonte: 'Referência − tempo com IA, só atividades concluídas', premissa: `Estratégia '${p.estrategia_referencia}'${p.estrategia_referencia === 'minimo' ? ' (menor valor entre cega e paramétrica)' : ''}; reconhecida na data de conclusão` },
    { metrica: 'Tokens', tipo: 'Medido', fonte: 'OTel gen_ai.usage.* dos spans chat', premissa: `input_tokens ${cobertura.input_inclui_cache ? 'inclui' : 'não inclui'} cache (detecção ${p.otel.input_inclui_cache})` },
    { metrica: 'Custo de consumo', tipo: 'Derivado', fonte: `Tokens × ${precos.fonte}`, premissa: `Valor de lista consultado em ${precos.consultado_em}; 1 crédito = US$ ${precos.credito_usd}; não é desembolso (Business inclui créditos por usuário)` },
    { metrica: 'Economia do roteamento de modelos', tipo: 'Estimado', fonte: `Mesmos tokens precificados em ${p.modelo_referencia_roteamento}`, premissa: 'Ignora que outro modelo geraria outra quantidade de tokens' },
    { metrica: 'Guard-rails', tipo: 'Medido', fonte: 'Spans execute_hook (OTel), contrato file-drop dos hooks de guarda, saída do validador SDD', premissa: 'Conta decisões deny/ask, falhas de portão e git de escrita interrompido. Se o span execute_hook já trouxer a decisão, desligue o file-drop para não contar duas vezes' },
    { metrica: 'Vereditos de revisão', tipo: 'Medido', fonte: 'revisao/<eixo>-<commit>.md lido no momento em que é gravado', premissa: 'Aprovada na 1ª = primeiro veredito de cada eixo é APROVADO' },
    { metrica: 'Lacunas explicitadas', tipo: 'Medido', fonte: 'Marcadores [NÃO RESPONDIDO] na última versão de cada briefing', premissa: 'Lacuna escrita em vez de requisito inventado' },
    { metrica: 'Aderência ao Liquid', tipo: 'Derivado', fonte: 'Elementos brad-* nos templates e declarações CSS nos estilos gerados', premissa: 'Proxy: menos CSS custom por componente = mais uso do design system' },
    { metrica: 'Violação de invariante', tipo: 'Medido', fonte: 'Comando git de escrita executado pelo agente', premissa: 'Invariante do SDD: nenhuma etapa escreve Git' },
  ];
}

export async function projetar(cfg, { de = null, ate = null, demo = false, agora = Date.now() } = {}) {
  const { dados, parametros, toolkits: tk, precos, calibracao } = cfg;
  const comp = compilarToolkits(tk, parametros);
  const vinculosArq = join(dados, 'vinculos.json');
  const vinculos = existsSync(vinculosArq) ? JSON.parse(readFileSync(vinculosArq, 'utf8')) : { sessoes: {}, ignorar: [] };
  const ignorar = new Set(vinculos.ignorar || []);
  const ctxBase = {
    comp, tk, parametros, precos, calibracao,
    reNaoCodigo: new RegExp(parametros.caminhos_nao_codigo),
  };

  // 1. sessões do hook
  const eventos = carregarEventos(dados);
  let sessoes = [...eventos.entries()].filter(([sid]) => !ignorar.has(sid)).map(([sid, evs]) => projetarSessao(sid, evs, ctxBase));

  // 2. OTel
  const arquivos = arquivosOtel(dados, parametros.otel?.arquivos);
  const otel = await lerOtel(arquivos);
  const { conversas, inputIncluiCache } = agregarConversas(otel.spans, {
    inputIncluiCache: parametros.otel?.input_inclui_cache ?? 'auto',
    atributosDecisao: tk.otel?.atributos_decisao_hook,
    atributosNomeHook: tk.otel?.atributos_nome_hook,
  });
  const { stats: correlacao, orfas } = correlacionar(sessoes, conversas, parametros.janela_correlacao_otel_min);
  sessoes.push(...orfas.map(sessaoDeConversaOrfa).filter((s) => !ignorar.has(s.id)));
  sessoes = sessoes.map((s) => finalizarSessao(s, ctxBase)).filter((s) => s.inicio != null);

  // 3. guard-rails via contrato file-drop
  const guardrails = lerJsonl(join(dados, 'guardrails.jsonl')).filter((g) => g && g.regra && g.decisao);
  const guardrailsPorSessao = new Map();
  for (const g of guardrails) {
    if (!g.sid) continue;
    const sid = String(g.sid).replace(/[^\w.-]/g, '_');
    if (!guardrailsPorSessao.has(sid)) guardrailsPorSessao.set(sid, []);
    guardrailsPorSessao.get(sid).push(g);
  }

  // 4. atividades (união de chaves que coocorrem numa sessão)
  const chavesCtx = criarContextoChaves(parametros, tk, vinculos);
  const uf = new UniaoBusca();
  const chavesPorSessao = new Map();
  const contagemChave = new Map();
  for (const s of sessoes) {
    const ch = chavesCtx.chavesDaSessao(s);
    chavesPorSessao.set(s.id, ch);
    for (const k of ch) { uf.achar(k); contagemChave.set(k, (contagemChave.get(k) || 0) + 1); }
    for (let i = 1; i < ch.length; i++) uf.unir(ch[0], ch[i]);
  }
  const sessoesPorRaiz = new Map();
  const semAtividade = [];
  for (const s of sessoes) {
    const ch = chavesPorSessao.get(s.id);
    if (!ch.length) { semAtividade.push(s); continue; }
    const raiz = uf.achar(ch[0]);
    if (!sessoesPorRaiz.has(raiz)) sessoesPorRaiz.set(raiz, []);
    sessoesPorRaiz.get(raiz).push(s);
  }
  const chavesPorRaiz = new Map();
  for (const k of uf.pai.keys()) {
    const r = uf.achar(k);
    if (!chavesPorRaiz.has(r)) chavesPorRaiz.set(r, []);
    chavesPorRaiz.get(r).push(k);
  }

  // 5. estimativas e conclusões manuais
  const raizDaSessao = new Map();
  for (const [raiz, ss] of sessoesPorRaiz) for (const s of ss) raizDaSessao.set(s.id, raiz);
  const estimativasPorRaiz = new Map();
  const estimativasSemAtividade = [];
  const brutas = [
    ...lerJsonl(join(dados, 'estimativas.jsonl')).map((e) => ({ t: Date.parse(e.t), horas: Number(e.horas), chave: chavesCtx.normalizarChave(e.atividade), origem: 'cli', rotulo: e.atividade })),
    ...sessoes.flatMap((s) => s.estimativas_prompt.map((ep) => ({ t: Date.parse(ep.t), horas: ep.horas, chave: ep.tickets[0] ? `ticket:${ep.tickets[0]}` : null, sessao: s.id, origem: 'prompt', rotulo: ep.tickets[0] || s.id }))),
  ].filter((e) => Number.isFinite(e.t) && Number.isFinite(e.horas) && e.horas > 0);
  for (const e of brutas) {
    let raiz = e.chave && uf.tem(e.chave) ? uf.achar(e.chave) : null;
    if (!raiz && e.sessao) raiz = raizDaSessao.get(e.sessao) ?? null;
    if (!raiz || !sessoesPorRaiz.has(raiz)) { estimativasSemAtividade.push({ atividade: e.rotulo, horas: e.horas, t: new Date(e.t).toISOString() }); continue; }
    if (!estimativasPorRaiz.has(raiz)) estimativasPorRaiz.set(raiz, []);
    estimativasPorRaiz.get(raiz).push(e);
  }
  const conclusoes = lerJsonl(join(dados, 'conclusoes.jsonl')).map((c) => ({ chave: chavesCtx.normalizarChave(c.atividade), t: Date.parse(c.t) }));

  const ctxAtividade = { ...ctxBase, guardrailsPorSessao };
  let atividades = [...sessoesPorRaiz.entries()].map(([raiz, ss]) => {
    const chaves = (chavesPorRaiz.get(raiz) || []).sort();
    const info = rotuloAtividade(chaves, contagemChave);
    return projetarAtividade(raiz, info, chaves, ss, estimativasPorRaiz.get(raiz) || [], conclusoes, ctxAtividade);
  });

  // 6. período: sessões pelo início; atividades pela data de conclusão (ou última sessão)
  const dentro = (ms) => {
    if (ms == null) return false;
    const d = dataLocal(ms);
    return (!de || d >= de) && (!ate || d <= ate);
  };
  const sessoesPeriodo = sessoes.filter((s) => dentro(s.inicio));
  atividades = atividades.filter((a) => dentro(a.fim)).sort((a, b) => (b.fim ?? 0) - (a.fim ?? 0));
  const semAtividadePeriodo = semAtividade.filter((s) => dentro(s.inicio));

  // 7. agregados
  const concluidas = atividades.filter((a) => a.concluida);
  const comGanho = concluidas.filter((a) => a.ganho);
  const horasRef = soma(comGanho, (a) => a.estimativa.referencia_h);
  const horasComIa = soma(comGanho, (a) => a.tempo.com_ia_h);
  const custoUsd = soma(sessoesPeriodo, (s) => s.custo.usd);
  const entradaTotal = soma(sessoesPeriodo, (s) => (s.tokens ? s.tokens.entrada_nova + s.tokens.cache_leitura + s.tokens.cache_escrita : 0));
  const cacheLeitura = soma(sessoesPeriodo, (s) => s.tokens?.cache_leitura);

  const somaTerm = (classe, campo) => soma(sessoesPeriodo, (s) => s.terminal[classe]?.[campo]);
  const regras = new Map();
  const registrarRegra = (rotulo, fonte, decisao) => {
    if (decisao !== 'deny' && decisao !== 'ask') return;
    const r = regras.get(rotulo) || { rotulo, fonte, deny: 0, ask: 0 };
    r[decisao]++;
    regras.set(rotulo, r);
  };
  for (const s of sessoesPeriodo) for (const h of s.hooks_otel) registrarRegra(h.nome, 'otel', h.decisao);
  for (const g of guardrails) {
    const t = Date.parse(g.t);
    if (dentro(t)) registrarRegra(g.regra, 'arquivo', g.decisao);
  }
  const porRegra = [...regras.values()].sort((a, b) => b.deny + b.ask - (a.deny + a.ask));
  const denyTotal = soma(porRegra, (r) => r.deny);
  const askTotal = soma(porRegra, (r) => r.ask);
  const validadorFalhas = somaTerm('validador_sdd', 'falhas');
  const gitInterrompido = soma(sessoesPeriodo, (s) => s.terminal_interrompidas?.git_escrita);
  const gitExecutado = somaTerm('git_escrita', 'execucoes');
  const lacunas = soma(atividades, (a) => a.qualidade.lacunas_explicitadas);

  const barreiras = [
    ...porRegra.flatMap((r) => [
      r.deny ? { rotulo: `${r.rotulo} — bloqueio`, valor: r.deny, grupo: 'Hook de guarda' } : null,
      r.ask ? { rotulo: `${r.rotulo} — confirmação exigida`, valor: r.ask, grupo: 'Hook de guarda' } : null,
    ]).filter(Boolean),
    validadorFalhas ? { rotulo: 'Portão do validador SDD reprovou', valor: validadorFalhas, grupo: 'Validador' } : null,
    gitInterrompido ? { rotulo: 'Git de escrita interrompido', valor: gitInterrompido, grupo: 'Invariante' } : null,
  ].filter(Boolean).sort((a, b) => b.valor - a.valor);

  const comRevisao = atividades.filter((a) => a.qualidade.aprovada_primeira != null);
  const aprovadasPrimeira = comRevisao.filter((a) => a.qualidade.aprovada_primeira).length;
  const d2cSessoes = sessoesPeriodo.filter((s) => s.toolkit === 'design-to-code-liquid');
  const d2cComponentes = soma(atividades, (a) => (a.qualidade.unidades['d2c.componente'] || 0) + (a.qualidade.unidades['d2c.pagina'] || 0));
  const d2cLiquid = soma(atividades, (a) => a.qualidade.d2c.liquid_elementos);
  const d2cCss = soma(atividades, (a) => a.qualidade.d2c.declaracoes_css);

  // semanas
  const semanas = new Map();
  for (const a of comGanho) {
    const k = inicioSemana(a.fim);
    const acc = semanas.get(k) || { inicio: dataLocal(k), horas_economizadas: 0, atividades: 0 };
    acc.horas_economizadas += a.ganho.horas_economizadas;
    acc.atividades++;
    semanas.set(k, acc);
  }
  const chavesSemana = [...semanas.keys()].sort((a, b) => a - b);
  const porSemana = [];
  if (chavesSemana.length) {
    for (let k = chavesSemana[0]; k <= chavesSemana[chavesSemana.length - 1]; k = inicioSemana(k + 8 * 86400000)) {
      const s = semanas.get(k) || { inicio: dataLocal(k), horas_economizadas: 0, atividades: 0 };
      porSemana.push({ ...s, horas_economizadas: arred(s.horas_economizadas, 1) });
    }
  }

  const hookMs = sessoesPeriodo.flatMap((s) => s.hook_ms || []);
  const modelosSemPreco = [...new Set(sessoesPeriodo.flatMap((s) => s.custo.sem_preco))];
  const cobertura = {
    sessoes_total: sessoesPeriodo.length,
    sessoes_hook: sessoesPeriodo.filter((s) => s.origem === 'hook').length,
    sessoes_so_otel: sessoesPeriodo.filter((s) => s.origem === 'otel').length,
    sessoes_com_tokens_pct: sessoesPeriodo.length ? arred((sessoesPeriodo.filter((s) => s.tokens).length / sessoesPeriodo.length) * 100, 0) : null,
    sessoes_com_atividade_pct: sessoesPeriodo.length ? arred(((sessoesPeriodo.length - semAtividadePeriodo.length) / sessoesPeriodo.length) * 100, 0) : null,
    atividades_total: atividades.length,
    atividades_concluidas: concluidas.length,
    concluidas_com_ganho: comGanho.length,
    concluidas_com_estimativa_cega_pct: concluidas.length ? arred((concluidas.filter((a) => a.estimativa.cega_h != null).length / concluidas.length) * 100, 0) : null,
    correlacao,
    otel_disponivel: otel.spans.length > 0,
    otel_linhas: otel.linhas,
    otel_linhas_invalidas: otel.invalidas,
    input_inclui_cache: inputIncluiCache,
    hook_ms_p50: percentil(hookMs, 50),
    hook_ms_p95: percentil(hookMs, 95),
    modelos_sem_preco: modelosSemPreco,
    sessoes_sid_fallback: sessoesPeriodo.filter((s) => s.sid_fallback).length,
  };

  const survNoRevert = mediaMetrica(otel.metricas.get('copilot_chat.edit.survival.no_revert'));
  const survFourGram = mediaMetrica(otel.metricas.get('copilot_chat.edit.survival.four_gram'));
  const cot = parametros.moeda || {};
  const brlValido = cot.cotacao_usd_brl && cot.cotacao_data && cot.cotacao_fonte;

  const etapas = agregarEtapas(sessoesPeriodo, tk);
  const datas = sessoesPeriodo.map((s) => s.inicio);

  return {
    schema: 'harness-metricas/dados@1',
    gerado_em: new Date(agora).toISOString(),
    versao_coletor: VERSAO_COLETOR,
    demo,
    periodo: {
      de: de || (datas.length ? dataLocal(Math.min(...datas)) : null),
      ate: ate || (datas.length ? dataLocal(Math.max(...datas)) : null),
      filtro: Boolean(de || ate),
    },
    repos: [...new Set(sessoesPeriodo.map((s) => s.repo).filter(Boolean))].sort(),
    parametros: {
      limiar_ociosidade_min: parametros.limiar_ociosidade_min,
      sobrecarga_humana_fora_sessao_pct: parametros.sobrecarga_humana_fora_sessao_pct,
      estrategia_referencia: parametros.estrategia_referencia,
      divergencia_alerta_pct: parametros.divergencia_alerta_pct,
      modelo_referencia_roteamento: parametros.modelo_referencia_roteamento,
    },
    precos: { fonte: precos.fonte, consultado_em: precos.consultado_em, vigencia_inicio: precos.vigencia_inicio, credito_usd: precos.credito_usd },
    moeda: brlValido ? { cotacao_usd_brl: cot.cotacao_usd_brl, cotacao_data: cot.cotacao_data, cotacao_fonte: cot.cotacao_fonte } : null,
    calibracao: { versao: calibracao.versao, calibrado_por: calibracao.calibrado_por, calibrado_em: calibracao.calibrado_em },
    kpi: {
      atividades_concluidas: concluidas.length,
      atividades_com_ganho: comGanho.length,
      horas_sem_ia_ref: arred(horasRef, 1),
      horas_com_ia: arred(horasComIa, 1),
      horas_economizadas: arred(horasRef - horasComIa, 1),
      fator_produtividade: horasComIa > 0 ? arred(horasRef / horasComIa, 1) : null,
      custo_usd: arred(custoUsd, 2),
      creditos: arred(custoUsd / precos.credito_usd, 0),
      custo_brl: brlValido ? arred(custoUsd * cot.cotacao_usd_brl, 2) : null,
      custo_por_atividade_usd: concluidas.length ? arred(soma(concluidas, (a) => a.custo.usd) / concluidas.length, 2) : null,
      economia_roteamento_usd: arred(soma(sessoesPeriodo, (s) => s.custo.economia_roteamento_usd), 2),
      cache_entrada_pct: entradaTotal ? arred((cacheLeitura / entradaTotal) * 100, 1) : null,
      guardrails_acionados: denyTotal + askTotal + validadorFalhas + gitInterrompido,
      aprovacao_primeira_revisao_pct: comRevisao.length ? arred((aprovadasPrimeira / comRevisao.length) * 100, 0) : null,
      reprovacoes: soma(atividades, (a) => a.qualidade.reprovacoes),
      violacoes_invariante: gitExecutado,
      lacunas_explicitadas: lacunas,
      sessoes: sessoesPeriodo.length,
    },
    produtividade: {
      por_atividade: comGanho.map((a) => ({ id: a.id, rotulo: a.rotulo, sem_ia_h: a.estimativa.referencia_h, com_ia_h: a.tempo.com_ia_h, economizadas_h: a.ganho.horas_economizadas, fator: a.ganho.fator, fonte: a.estimativa.referencia_fonte })),
      por_semana: porSemana,
    },
    custo: {
      etapas,
      modelos: agregarModelos(sessoesPeriodo, precos),
      tokens: {
        entrada_nova: soma(sessoesPeriodo, (s) => s.tokens?.entrada_nova),
        cache_leitura: cacheLeitura,
        cache_escrita: soma(sessoesPeriodo, (s) => s.tokens?.cache_escrita),
        saida: soma(sessoesPeriodo, (s) => s.tokens?.saida),
      },
    },
    seguranca: {
      barreiras,
      por_regra: porRegra,
      deny: denyTotal,
      ask: askTotal,
      validador: { execucoes: somaTerm('validador_sdd', 'execucoes'), falhas: validadorFalhas },
      git_escrita_executada: gitExecutado,
      git_escrita_interrompida: gitInterrompido,
      contrato_editados: soma(atividades, (a) => a.seguranca.contrato_editados),
      ferramentas_interrompidas: soma(sessoesPeriodo, (s) => s.ferramentas.interrompidas),
      lacunas_explicitadas: lacunas,
    },
    qualidade: {
      atividades_com_revisao: comRevisao.length,
      aprovadas_primeira: aprovadasPrimeira,
      aprovacao_primeira_pct: comRevisao.length ? arred((aprovadasPrimeira / comRevisao.length) * 100, 0) : null,
      reprovacoes: soma(atividades, (a) => a.qualidade.reprovacoes),
      validador: { execucoes: somaTerm('validador_sdd', 'execucoes'), falhas: validadorFalhas },
      testes: { execucoes: somaTerm('teste', 'execucoes'), falhas: somaTerm('teste', 'falhas') },
      lint: { execucoes: somaTerm('lint', 'execucoes'), falhas: somaTerm('lint', 'falhas') },
      compactacoes_por_sessao: sessoesPeriodo.length ? arred(soma(sessoesPeriodo, (s) => s.compactacoes) / sessoesPeriodo.length, 2) : null,
      d2c: {
        sessoes: d2cSessoes.length,
        componentes: d2cComponentes,
        liquid_elementos: d2cLiquid,
        declaracoes_css: d2cCss,
        css_por_componente: d2cComponentes ? arred(d2cCss / d2cComponentes, 1) : null,
        liquid_por_componente: d2cComponentes ? arred(d2cLiquid / d2cComponentes, 1) : null,
      },
      sobrevivencia_edicoes: survNoRevert != null || survFourGram != null
        ? { sem_reversao_pct: arred((survNoRevert ?? 0) * 100, 0), quatro_gramas_pct: arred((survFourGram ?? 0) * 100, 0) }
        : null,
    },
    atividades,
    sessoes_sem_atividade: semAtividadePeriodo.map(resumoSessao),
    pendencias: {
      sem_estimativa: atividades.filter((a) => a.alertas.includes('sem_estimativa')).map((a) => a.rotulo),
      estimativa_nao_cega: atividades.filter((a) => a.alertas.includes('estimativa_nao_cega')).map((a) => a.rotulo),
      divergentes: atividades.filter((a) => a.alertas.includes('divergencia')).map((a) => a.rotulo),
      estimativas_sem_atividade: estimativasSemAtividade,
      sessoes_sem_atividade: semAtividadePeriodo.length,
      modelos_sem_preco: modelosSemPreco,
      calibracao_placeholder: /placeholder/i.test(calibracao.versao) || /AJUSTE/i.test(calibracao.calibrado_por),
    },
    cobertura,
    metodologia: metodologia(cfg, cobertura),
    _otel: { inventario_disponivel: otel.spans.length > 0 },
  };
}
