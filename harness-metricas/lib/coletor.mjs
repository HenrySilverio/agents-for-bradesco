// harness-metricas — lógica do coletor (usada por bin/hook.mjs e pelos testes).
//
// Contrato de comportamento (não negociável):
//   1. Observador puro: o hook SEMPRE sai com código 0 e stdout "{}". Nunca bloqueia, nunca injeta
//      contexto no modelo (custo zero de token).
//   2. Nunca grava texto de prompt, conteúdo de arquivo, texto de comando de terminal nem caminho absoluto.
//   3. Um evento = uma linha JSON em <dados>/eventos/<session_id>.jsonl (append-only).
//   4. Qualquer erro vai para <dados>/erros-hook.log e é engolido.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  RAIZ, carregarConfig, categoriaFerramenta, classeTerminal, compilarToolkits,
} from './config.mjs';

const EVENTOS = new Set([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PreCompact', 'SubagentStart', 'SubagentStop', 'Stop',
]);
const LIMITE_SONDA_BYTES = 512 * 1024;
const LIMITE_RESPOSTA_CHARS = 200_000;
const CHAVES_CAMINHO = /^(file_?path|path|paths|files?|uris?|dir_?path|directory|target_?file|old_?path|new_?path)$/i;
const CHAVES_IGNORADAS = /^(content|code|new_?string|old_?string|text|query|command|explanation|prompt)$/i;


export function registrarErro(dadosDir, ev, err) {
  try {
    const dir = dadosDir || join(RAIZ, 'dados');
    mkdirSync(dir, { recursive: true });
    const msg = String(err?.message || err).replace(/\s+/g, ' ').slice(0, 300);
    appendFileSync(join(dir, 'erros-hook.log'), `${new Date().toISOString()}\t${ev || '?'}\t${msg}\n`);
  } catch { /* último recurso: silêncio */ }
}

const git = (cwd, args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : null;
};

function idSessao(entrada, cwd) {
  const bruto = entrada.session_id || entrada.sessionId;
  if (bruto) return { sid: String(bruto).replace(/[^\w.-]/g, '_').slice(0, 120), origem: 'hook' };
  const dia = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const h = createHash('sha256').update(String(cwd)).digest('hex').slice(0, 8);
  return { sid: `anon-${dia}-${h}`, origem: 'fallback' };
}

export function caminhoRelativo(p, cwd) {
  if (typeof p !== 'string' || !p.trim()) return null;
  let s = p.trim().replace(/^file:\/\//i, '');
  try { s = decodeURIComponent(s); } catch { /* mantém */ }
  if (/^\/[a-zA-Z]:[\\/]/.test(s)) s = s.slice(1);
  const absoluto = isAbsolute(s) || /^[a-zA-Z]:[\\/]/.test(s);
  const abs = absoluto ? s : resolve(cwd, s);
  const rel = relative(cwd, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return `~ext/${basename(abs)}`;
  return rel.split(sep).join('/').replace(/\\/g, '/');
}

export function extrairCaminhos(input) {
  const achados = new Set();
  const visitar = (v, chave, prof) => {
    if (prof > 5 || v == null) return;
    if (typeof v === 'string') {
      if (chave && CHAVES_CAMINHO.test(chave)) achados.add(v);
      if (chave && /^(input|patch)$/i.test(chave)) {
        for (const m of v.matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gm)) achados.add(m[1].trim());
      }
      return;
    }
    if (Array.isArray(v)) { for (const x of v.slice(0, 300)) visitar(x, chave, prof + 1); return; }
    if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (CHAVES_IGNORADAS.test(k) && !/^(input|patch)$/i.test(k)) continue;
        visitar(x, k, prof + 1);
      }
    }
  };
  visitar(input, null, 0);
  return [...achados].slice(0, 300);
}

function comandoDoInput(input) {
  if (!input || typeof input !== 'object') return null;
  for (const k of ['command', 'cmd', 'commandLine', 'script']) if (typeof input[k] === 'string') return input[k];
  return null;
}

function rodarSondas(comp, paths, cat, cwd) {
  const resultado = [];
  for (const rel of paths) {
    if (rel.startsWith('~ext/')) continue;
    for (const s of comp.sondas) {
      if (!s.quando.includes(cat)) continue;
      const m = rel.match(s.reCaminho);
      if (!m) continue;
      const campos = {};
      for (const [idx, nome] of Object.entries(s.grupos || {})) if (m[Number(idx)]) campos[nome] = m[Number(idx)];
      const abs = resolve(cwd, rel);
      try {
        const st = statSync(abs);
        if (!st.isFile() || st.size > LIMITE_SONDA_BYTES) continue;
        const texto = readFileSync(abs, 'utf8');
        for (const [campo, rx] of s.reContar) campos[campo] = (texto.match(rx) || []).length;
        for (const [campo, rx] of s.reExtrair) {
          const x = texto.match(rx);
          if (x) campos[campo] = x[1] ?? x[0];
        }
      } catch { continue; }
      resultado.push({ id: s.id, path: rel, op: cat, campos });
    }
  }
  return resultado;
}

function detectarComando(comp, prompt) {
  const candidatos = [...prompt.matchAll(/(?:^|\s)\/([\w:.-]+)/g)].map((m) => m[1]);
  const conhecido = candidatos.find((c) => comp.comandosConhecidos.has(c.toLowerCase()));
  if (conhecido) return conhecido;
  const inicio = prompt.match(/^\s*\/([\w:.-]+)/);
  return inicio ? inicio[1] : null;
}

function diffDaSessao(cfg, sid, cwd, headAtual) {
  const arq = join(cfg.dados, 'eventos', `${sid}.jsonl`);
  if (!existsSync(arq)) return null;
  let headInicio = null;
  const editados = new Set();
  const novos = new Set();
  for (const linha of readFileSync(arq, 'utf8').split('\n')) {
    if (!linha) continue;
    let e;
    try { e = JSON.parse(linha); } catch { continue; }
    if (e.ev === 'SessionStart' && e.git?.head && !headInicio) headInicio = e.git.head;
    if (e.ev === 'PreToolUse' && e.cat === 'edicao') {
      for (const p of e.paths || []) if (!p.startsWith('~ext/')) editados.add(p);
      for (const p of e.novos || []) novos.add(p);
    }
  }
  if (!editados.size) return { arquivos: 0, adicionadas: 0, removidas: 0 };
  const lista = [...editados].slice(0, 300);
  const base = headInicio || headAtual || 'HEAD';
  const numstat = git(cwd, ['diff', '--numstat', base, '--', ...lista]);
  let adicionadas = 0;
  let removidas = 0;
  const vistos = new Set();
  for (const l of (numstat || '').split('\n')) {
    const [a, r, p] = l.split('\t');
    if (!p) continue;
    vistos.add(p);
    adicionadas += Number(a) || 0;
    removidas += Number(r) || 0;
  }
  for (const p of novos) {
    if (vistos.has(p)) continue;
    try {
      const abs = resolve(cwd, p);
      const st = statSync(abs);
      if (st.isFile() && st.size <= LIMITE_SONDA_BYTES) {
        const texto = readFileSync(abs, 'utf8');
        adicionadas += texto ? texto.split('\n').length - (texto.endsWith('\n') ? 1 : 0) : 0;
        vistos.add(p);
      }
    } catch { /* arquivo removido depois */ }
  }
  const arquivos = lista.filter((p) => vistos.has(p) || existsSync(resolve(cwd, p))).length;
  return { arquivos, adicionadas, removidas };
}

export function montarEvento(cfg, comp, entrada) {
  const ev = entrada.hook_event_name || entrada.hookEventName;
  if (!EVENTOS.has(ev)) return null;
  const cwd = resolve(entrada.cwd || process.cwd());
  const { sid, origem } = idSessao(entrada, cwd);
  const t = entrada.timestamp && !Number.isNaN(Date.parse(entrada.timestamp))
    ? new Date(entrada.timestamp).toISOString()
    : new Date().toISOString();
  const e = { v: 1, t, ev, sid };
  if (origem !== 'hook') e.sid_origem = origem;

  switch (ev) {
    case 'SessionStart': {
      const topo = git(cwd, ['rev-parse', '--show-toplevel']);
      e.repo = basename(topo || cwd);
      e.origem = entrada.source ?? null;
      e.git = { branch: git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']), head: git(cwd, ['rev-parse', 'HEAD']) };
      break;
    }
    case 'UserPromptSubmit': {
      const prompt = String(entrada.prompt ?? '');
      e.cmd = detectarComando(comp, prompt);
      comp.ticket.lastIndex = 0;
      e.tickets = [...new Set(prompt.match(comp.ticket) || [])].slice(0, 3);
      const est = prompt.match(comp.estimativa);
      e.estimativa_h = est ? Number.parseFloat(est[1].replace(',', '.')) : null;
      e.chars = prompt.length;
      break;
    }
    case 'PreToolUse':
    case 'PostToolUse': {
      const tool = String(entrada.tool_name ?? entrada.toolName ?? '');
      const input = entrada.tool_input ?? entrada.toolInput ?? {};
      e.tool = tool.slice(0, 80);
      e.id = entrada.tool_use_id ?? entrada.toolUseId ?? null;
      e.cat = categoriaFerramenta(comp, tool);
      const paths = extrairCaminhos(input).map((p) => caminhoRelativo(p, cwd)).filter(Boolean);
      e.term = e.cat === 'terminal' ? classeTerminal(comp, tool, comandoDoInput(input)) : null;
      if (ev === 'PreToolUse') {
        e.paths = [...new Set(paths)];
        if (e.cat === 'edicao') e.novos = e.paths.filter((p) => !p.startsWith('~ext/') && !existsSync(resolve(cwd, p)));
        e.contrato = e.paths.some((p) => comp.contrato.test(p));
      } else {
        if (e.term) {
          const r = entrada.tool_response ?? entrada.toolResponse ?? '';
          const texto = (typeof r === 'string' ? r : JSON.stringify(r)).slice(0, LIMITE_RESPOSTA_CHARS);
          e.res = comp.resFalha.test(texto) ? 'falha' : comp.resSucesso.test(texto) ? 'sucesso' : 'desconhecido';
        }
        const sondas = rodarSondas(comp, [...new Set(paths)], e.cat, cwd);
        if (sondas.length) e.sondas = sondas;
      }
      break;
    }
    case 'PreCompact':
      e.gatilho = entrada.trigger ?? null;
      break;
    case 'SubagentStart':
    case 'SubagentStop':
      e.agente_tipo = entrada.agent_type ?? null;
      e.agente_id = entrada.agent_id ?? null;
      break;
    case 'Stop': {
      const head = git(cwd, ['rev-parse', 'HEAD']);
      e.git = { branch: git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']), head, diff: diffDaSessao(cfg, sid, cwd, head) };
      break;
    }
    default:
      break;
  }
  return e;
}

// Processa um payload de hook (string JSON). Nunca lança.
export function processarPayload(bruto, { t0 = performance.now(), opcoesConfig } = {}) {
  let cfg = null;
  try {
    cfg = carregarConfig(opcoesConfig);
    let entrada;
    try { entrada = JSON.parse(bruto || 'null'); } catch { entrada = null; }
    if (!entrada || typeof entrada !== 'object') { registrarErro(cfg.dados, '?', 'stdin sem JSON válido'); return null; }
    const comp = compilarToolkits(cfg.toolkits, cfg.parametros);
    const evento = montarEvento(cfg, comp, entrada);
    if (!evento) return null;
    evento.hook_ms = Math.round((performance.now() - t0) * 10) / 10;
    const dir = join(cfg.dados, 'eventos');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, `${evento.sid}.jsonl`), `${JSON.stringify(evento)}\n`);
    return evento;
  } catch (err) {
    registrarErro(cfg?.dados, 'processar', err);
    return null;
  }
}
