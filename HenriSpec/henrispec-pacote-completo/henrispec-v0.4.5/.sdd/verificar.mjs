#!/usr/bin/env node
// SDD - verificação com escopo de mudança. Arquivo único, sem dependência. Node 18+.
//
//   node .sdd/verificar.mjs <change-id> [--so lint,tipos] [--todos]
//   node .sdd/verificar.mjs baseline <change-id>
//
// Roda só as verificações das camadas que a mudança tocou, só sobre os arquivos que ela
// tocou quando a ferramenta aceita lista de arquivos, e classifica cada achado:
//
//   BLOQUEANTE     introduzido pela mudança. Sai com código 1.
//   PRÉ-EXISTENTE  já existia antes dela. Contado, nunca bloqueia, nunca é corrigido aqui.
//
// Como cada verificação é classificada (campo "classificacao" em .sdd/verificacao.json):
//
//   base-stdin        exato. Roda a ferramenta sobre a versão do arquivo na base, lida com
//                     `git show`, e compara impressões digitais. Só lint que aceita stdin.
//   baseline          exato. Compara com .sdd/changes/<id>/baseline.json, gravado pelo
//                     subcomando baseline antes do primeiro commit da mudança.
//                     Sem baseline: "linhas" cai para linhas-alteradas; "jest-json" bloqueia.
//   linhas-alteradas  aproximado. Bloqueia só achado em linha que a mudança alterou.
//
// Lê Git, nunca escreve Git. Única escrita: baseline.json, no subcomando baseline.
// Saída curta de propósito: o detalhe de pré-existente não entra no contexto do modelo.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';

const SDD = '.sdd';
const CONFIG = join(SDD, 'verificacao.json');
const CHANGES = join(SDD, 'changes');
const LIMITE_LOTE = 6000; // caracteres de argumentos por execução; cmd.exe corta em 8191
const LIMITE_DETALHE = 30;

const FORMATOS = ['eslint-json', 'jest-json', 'linhas'];
const CLASSIFICACOES = ['base-stdin', 'baseline', 'linhas-alteradas'];

function sair(codigo, msg) {
  if (msg) (codigo === 0 ? console.log : console.error)(msg);
  process.exit(codigo);
}

// ----------------------------------------------------------------------- git

function git(args, { permitirFalha = false, input } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    input,
  });
  if (r.status !== 0) {
    if (permitirFalha) return null;
    sair(2, `git ${args.join(' ')} falhou: ${(r.stderr || '').trim()}`);
  }
  return r.stdout;
}

const linhasDe = (t) => (t || '').split(/\r?\n/);
const barra = (p) => p.replace(/\\/g, '/');
const CWD = process.cwd();
const rel = (p) => barra(relative(CWD, isAbsolute(p) ? p : resolve(CWD, p)));

function conferirRaiz() {
  const top = git(['rev-parse', '--show-toplevel'], { permitirFalha: true });
  if (top === null) sair(2, 'não é um repositório Git');
  const a = barra(resolve(top.trim())).toLowerCase();
  const b = barra(resolve(CWD)).toLowerCase();
  if (a !== b) sair(2, `rode na raiz do repositório (${top.trim()})`);
}

function mergeBase(base) {
  for (const ref of [base, `origin/${base}`]) {
    const r = git(['merge-base', ref, 'HEAD'], { permitirFalha: true });
    if (r) return { ref, sha: r.trim() };
  }
  sair(2, `sem merge-base entre "${base}" e HEAD. Faça fetch de ${base} e rode de novo.`);
}

// Arquivos alterados desde o merge-base, incluindo não commitados e não rastreados.
function lerDiff(mb) {
  const arquivos = new Map();
  const ns = git(['diff', '--name-status', '-M30%', mb]);
  for (const l of linhasDe(ns)) {
    if (!l.trim()) continue;
    const p = l.split('\t');
    const st = p[0][0];
    if (st === 'D') continue;
    const novo = barra(p[p.length - 1]);
    arquivos.set(novo, {
      status: st,
      antigo: st === 'A' ? null : barra(st === 'R' || st === 'C' ? p[1] : novo),
      linhas: new Set(),
      todas: st === 'A',
    });
  }

  const d = git(['diff', '-U0', '-M30%', '--no-color', '--src-prefix=a/', '--dst-prefix=b/', mb]);
  let atual = null;
  for (const l of linhasDe(d)) {
    if (l.startsWith('+++ ')) {
      const p = l.slice(4).trim();
      atual = p === '/dev/null' ? null : arquivos.get(p.replace(/^b\//, '')) || null;
      continue;
    }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h && atual) {
      const ini = Number(h[1]);
      const n = h[2] === undefined ? 1 : Number(h[2]);
      if (n === 0) atual.linhas.add(ini); // remoção pura: a linha vizinha conta como tocada
      for (let k = 0; k < n; k++) atual.linhas.add(ini + k);
    }
  }

  for (const p of linhasDe(git(['ls-files', '--others', '--exclude-standard']))) {
    if (p.trim()) arquivos.set(barra(p.trim()), { status: 'U', antigo: null, linhas: new Set(), todas: true });
  }

  for (const k of [...arquivos.keys()]) if (k.startsWith(`${SDD}/`)) arquivos.delete(k);
  return arquivos;
}

// -------------------------------------------------------------------- config

function globParaRegex(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        const comBarra = g[i + 2] === '/';
        re += comBarra ? '(?:.*/)?' : '.*';
        i += comBarra ? 2 : 1;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const raizDoGlob = (g) =>
  g
    .split('/')
    .filter((_, i, a) => !a.slice(0, i + 1).some((s) => /[*?]/.test(s)))
    .join('/') || '.';

function carregarConfig() {
  if (!existsSync(CONFIG)) {
    sair(2, `${CONFIG} não existe. Sem ele não há como saber o que é camada nem qual comando roda.`);
  }
  let c;
  try {
    c = JSON.parse(readFileSync(CONFIG, 'utf8'));
  } catch (e) {
    sair(2, `${CONFIG} não é JSON válido: ${e.message}`);
  }
  const defs = c.verificacoes || {};
  const camadas = c.camadas || {};

  for (const [nome, d] of Object.entries(defs)) {
    if (!d.comando) sair(2, `verificação "${nome}" sem "comando"`);
    if (!FORMATOS.includes(d.formato)) sair(2, `verificação "${nome}": formato deve ser ${FORMATOS.join(' | ')}`);
    if (!CLASSIFICACOES.includes(d.classificacao)) {
      sair(2, `verificação "${nome}": classificacao deve ser ${CLASSIFICACOES.join(' | ')}`);
    }
    if (d.classificacao === 'base-stdin' && (d.formato !== 'eslint-json' || !d.comandoBase)) {
      sair(2, `verificação "${nome}": base-stdin exige formato eslint-json e "comandoBase" com {arquivo}`);
    }
    if (d.formato === 'linhas') {
      if (!d.padrao) sair(2, `verificação "${nome}": formato linhas exige "padrao"`);
      try {
        d.re = new RegExp(d.padrao, 'gm');
      } catch (e) {
        sair(2, `verificação "${nome}": padrao inválido: ${e.message}`);
      }
      for (const g of ['arquivo', 'linha', 'mensagem']) {
        if (!d.padrao.includes(`?<${g}>`)) sair(2, `verificação "${nome}": padrao sem o grupo nomeado ${g}`);
      }
    }
  }
  for (const [nome, cam] of Object.entries(camadas)) {
    if (!Array.isArray(cam.arquivos) || cam.arquivos.length === 0) sair(2, `camada "${nome}" sem "arquivos"`);
    for (const v of cam.verificacoes || []) {
      if (!defs[v]) sair(2, `camada "${nome}" usa verificação inexistente: ${v}`);
    }
    cam.re = cam.arquivos.map(globParaRegex);
    cam.raizes = cam.arquivos.map(raizDoGlob);
  }
  return { defs, camadas };
}

const camadaDe = (arq, camadas) =>
  Object.keys(camadas).find((n) => camadas[n].re.some((r) => r.test(arq))) || null;

// ------------------------------------------------------------- artefatos SDD

function lerMudanca(id) {
  if (!id) sair(2, 'informe o change-id');
  const dir = join(CHANGES, id);
  const proposta = join(dir, 'proposta.md');
  if (!existsSync(proposta)) sair(2, `${proposta} não existe`);
  const pre = readFileSync(proposta, 'utf8').split(/^##\s+/m)[0];
  // Início, quando declarado, é o commit em que esta mudança começou: numa branch com várias
  // mudanças em sequência, o diff desta parte dele, e não da base.
  const inicio = (pre.match(/^\s*In[ií]cio\s*:\s*([0-9a-f]{7,40})/im) || [])[1];
  const base = inicio || (pre.match(/^\s*Base\s*:\s*(\S+)/im) || [])[1];
  if (!base) sair(2, 'proposta.md não declara Base. Defeito de planejamento: rode o validador.');

  // Escopo vive no agrupamento de Verificação, o último de tarefas.md.
  let escopo = null;
  const tarefas = join(dir, 'tarefas.md');
  if (existsSync(tarefas)) {
    const blocos = readFileSync(tarefas, 'utf8').split(/^###\s+\d+\.\s+/m);
    const m = blocos[blocos.length - 1].match(/^\s*Escopo\s*:\s*(.*)$/im);
    if (m) escopo = m[1].split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  return { dir, base, escopo };
}

// ------------------------------------------------------------------ execução

function executar(tpl, { arquivos = [], raizes = [], arquivo, input } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-'));
  const saida = join(dir, 'saida.json');
  const q = (s) => `"${s}"`;
  const cmd = tpl
    .replaceAll('{arquivos}', arquivos.map(q).join(' '))
    .replaceAll('{raizes}', raizes.map(q).join(' '))
    .replaceAll('{arquivo}', arquivo ? q(arquivo) : '')
    .replaceAll('{saida}', q(saida));
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 1 << 28, input });
  let texto = r.stdout || '';
  if (tpl.includes('{saida}') && existsSync(saida)) texto = readFileSync(saida, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, texto, erro: r.stderr || '' };
}

function emLotes(arquivos) {
  const lotes = [];
  let atual = [];
  let tam = 0;
  for (const a of arquivos) {
    if (atual.length && tam + a.length + 3 > LIMITE_LOTE) {
      lotes.push(atual);
      atual = [];
      tam = 0;
    }
    atual.push(a);
    tam += a.length + 3;
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}

// Devolve { ok, falhas: [{arquivo, linha, regra, mensagem}], avisos, extra } ou ok=false.
function interpretar(def, r) {
  const quebrou = (motivo) => ({
    ok: false,
    motivo: `${motivo}; saída ${r.status}. ${linhasDe(r.erro || r.texto).filter(Boolean).slice(0, 3).join(' | ')}`,
  });

  if (def.formato === 'eslint-json') {
    const i = r.texto.indexOf('[');
    let json;
    try {
      json = JSON.parse(r.texto.slice(i));
    } catch {
      return quebrou('saída do eslint não é JSON');
    }
    const falhas = [];
    let avisos = 0;
    for (const f of json) {
      for (const m of f.messages || []) {
        if (m.severity === 2) {
          falhas.push({ arquivo: rel(f.filePath), linha: m.line || 0, regra: m.ruleId || 'parse', mensagem: m.message });
        } else avisos++;
      }
    }
    return { ok: true, falhas, avisos };
  }

  if (def.formato === 'jest-json') {
    const i = r.texto.indexOf('{');
    let json;
    try {
      json = JSON.parse(r.texto.slice(i));
    } catch {
      return quebrou('saída do jest não é JSON');
    }
    const falhas = [];
    for (const s of json.testResults || []) {
      const arquivo = rel(s.name);
      const quebradas = (s.assertionResults || []).filter((a) => a.status === 'failed');
      for (const a of quebradas) falhas.push({ arquivo, linha: 0, regra: 'teste', mensagem: a.fullName || a.title });
      if (s.status === 'failed' && quebradas.length === 0) {
        falhas.push({ arquivo, linha: 0, regra: 'suite', mensagem: 'suíte falhou ao executar' });
      }
    }
    return { ok: true, falhas, avisos: 0, extra: `${json.numTotalTests ?? '?'} teste(s) executado(s)` };
  }

  // linhas
  const texto = `${r.texto}\n${r.erro}`;
  const falhas = [];
  def.re.lastIndex = 0;
  for (const m of texto.matchAll(def.re)) {
    falhas.push({
      arquivo: rel(m.groups.arquivo.trim()),
      linha: Number(m.groups.linha) || 0,
      regra: def.regra || 'erro',
      mensagem: m.groups.mensagem.trim(),
    });
  }
  if (falhas.length === 0 && r.status !== 0) return quebrou('comando falhou sem achado reconhecível pelo padrao');
  return { ok: true, falhas, avisos: 0 };
}

function rodar(def, tpl, { arquivos = [], raizes = [] }) {
  if (!tpl.includes('{arquivos}')) return interpretar(def, executar(tpl, { raizes }));
  const total = { ok: true, falhas: [], avisos: 0, extras: [] };
  for (const lote of emLotes(arquivos)) {
    const r = interpretar(def, executar(tpl, { arquivos: lote, raizes }));
    if (!r.ok) return r;
    total.falhas.push(...r.falhas);
    total.avisos += r.avisos;
    if (r.extra) total.extras.push(r.extra);
  }
  total.extra = total.extras.join(', ');
  return total;
}

// ------------------------------------------------------------- classificação

const fpTeste = (f) => `${f.arquivo}|${f.mensagem}`;

function multiconjunto(chaves) {
  const m = new Map();
  for (const k of chaves) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

function consumir(m, k) {
  const n = m.get(k) || 0;
  if (n === 0) return false;
  m.set(k, n - 1);
  return true;
}

function textoDaLinha(conteudo, n) {
  return (linhasDe(conteudo)[n - 1] || '').trim();
}

function classificarBaseStdin(def, falhas, diff, mb) {
  const porArquivo = new Map();
  for (const f of falhas) {
    if (!porArquivo.has(f.arquivo)) porArquivo.set(f.arquivo, []);
    porArquivo.get(f.arquivo).push(f);
  }
  for (const [arq, lista] of porArquivo) {
    const info = diff.get(arq);
    if (!info || info.todas || !info.antigo) {
      for (const f of lista) Object.assign(f, { classe: 'BLOQUEANTE', metodo: 'exato' });
      continue;
    }
    const baseConteudo = git(['show', `${mb}:${info.antigo}`], { permitirFalha: true });
    if (baseConteudo === null) {
      for (const f of lista) Object.assign(f, { classe: 'BLOQUEANTE', metodo: 'exato' });
      continue;
    }
    const rb = interpretar(def, executar(def.comandoBase, { arquivo: arq, input: baseConteudo }));
    if (!rb.ok) {
      // sem como provar que é antigo: cai para linhas alteradas e declara
      for (const f of lista) classificarPorLinha(f, diff);
      continue;
    }
    const naBase = multiconjunto(rb.falhas.map((b) => `${b.regra}|${b.mensagem}|${textoDaLinha(baseConteudo, b.linha)}`));
    const atual = existsSync(arq) ? readFileSync(arq, 'utf8') : '';
    for (const f of lista) {
      const k = `${f.regra}|${f.mensagem}|${textoDaLinha(atual, f.linha)}`;
      Object.assign(f, { classe: consumir(naBase, k) ? 'PRÉ-EXISTENTE' : 'BLOQUEANTE', metodo: 'exato' });
    }
  }
}

function classificarPorLinha(f, diff) {
  const info = diff.get(f.arquivo);
  const tocada = info && (info.todas || (f.linha ? info.linhas.has(f.linha) : true));
  Object.assign(f, { classe: tocada ? 'BLOQUEANTE' : 'PRÉ-EXISTENTE', metodo: 'aproximado' });
}

function classificar(nome, def, falhas, { diff, mb, baseline }) {
  if (def.classificacao === 'base-stdin') return classificarBaseStdin(def, falhas, diff, mb);

  const registro = baseline?.verificacoes?.[nome];
  if (def.classificacao === 'baseline' && registro && !registro.falhou) {
    const naBase = new Map(Object.entries(registro.falhas || {}));
    for (const f of falhas) {
      Object.assign(f, { classe: consumir(naBase, fpTeste(f)) ? 'PRÉ-EXISTENTE' : 'BLOQUEANTE', metodo: 'baseline' });
    }
    return;
  }
  if (def.classificacao === 'baseline' && def.formato === 'jest-json') {
    // teste quebrado sem baseline não tem como ser provado antigo, e regressão é exatamente
    // o que teste existe para pegar: bloqueia.
    for (const f of falhas) Object.assign(f, { classe: 'BLOQUEANTE', metodo: 'sem-baseline' });
    return;
  }
  for (const f of falhas) classificarPorLinha(f, diff);
}

// ----------------------------------------------------------------- comandos

function lerArgs(argv) {
  const out = { pos: [], so: null, todos: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--so') out.so = (argv[++i] || '').split(',').filter(Boolean);
    else if (argv[i] === '--todos') out.todos = true;
    else out.pos.push(argv[i]);
  }
  return out;
}

function cmdBaseline(id) {
  conferirRaiz();
  const { defs, camadas } = carregarConfig();
  const { dir, base, escopo } = lerMudanca(id);
  const destino = join(dir, 'baseline.json');
  if (existsSync(destino)) sair(2, `${destino} já existe e não é regravado: a linha de base é a do início da mudança.`);
  if (!escopo || escopo.length === 0) sair(2, 'tarefas.md não declara "Escopo:" no agrupamento de Verificação.');
  for (const c of escopo) if (!camadas[c]) sair(2, `camada "${c}" do Escopo não existe em ${CONFIG}`);

  const sujo = linhasDe(git(['status', '--porcelain'])).filter((l) => l.trim() && !l.slice(3).startsWith(`${SDD}/`));
  if (sujo.length) sair(2, `há alteração fora de ${SDD}/ na árvore. A linha de base precisa ser gravada contra o código antes da mudança.`);
  const mb = mergeBase(base);
  const head = git(['rev-parse', 'HEAD']).trim();
  if (head !== mb.sha) {
    sair(2, 'a branch já tem commits além da base: uma linha de base gravada agora esconderia erro introduzido pela mudança. Siga sem ela; a classificação cai para linhas alteradas.');
  }

  const nomes = new Set(escopo.flatMap((c) => camadas[c].verificacoes || []));
  const raizes = [...new Set(escopo.flatMap((c) => camadas[c].raizes))];
  const registro = { versao: 1, gravadoEm: new Date().toISOString(), mergeBase: mb.sha, camadas: escopo, verificacoes: {} };

  console.log(`baseline ${id} — merge-base ${mb.sha.slice(0, 7)}, camadas: ${escopo.join(', ')}`);
  for (const nome of nomes) {
    const def = defs[nome];
    if (def.classificacao !== 'baseline') continue;
    const tpl = def.comandoBaseline || def.comando;
    if (tpl.includes('{arquivos}')) {
      console.log(`  ${nome.padEnd(8)} ignorada: precisa de "comandoBaseline" sem {arquivos}`);
      continue;
    }
    const r = rodar(def, tpl, { raizes });
    if (!r.ok) {
      registro.verificacoes[nome] = { falhou: true, motivo: r.motivo };
      console.log(`  ${nome.padEnd(8)} FALHOU ao executar: ${r.motivo}`);
      continue;
    }
    const falhas = Object.fromEntries(multiconjunto(r.falhas.map(fpTeste)));
    registro.verificacoes[nome] = { falhas };
    console.log(`  ${nome.padEnd(8)} ${r.falhas.length} falha(s) pré-existente(s) registrada(s)${r.extra ? `, ${r.extra}` : ''}`);
  }
  writeFileSync(destino, `${JSON.stringify(registro, null, 2)}\n`);
  console.log(`gravado: ${barra(destino)} — commite junto com a primeira fatia.`);
}

function cmdVerificar(id, { so, todos }) {
  conferirRaiz();
  const { defs, camadas } = carregarConfig();
  const { dir, base, escopo } = lerMudanca(id);
  const mb = mergeBase(base);
  const head = git(['rev-parse', '--short', 'HEAD']).trim();
  const sujos = linhasDe(git(['status', '--porcelain'])).filter((l) => l.trim()).length;
  const diff = lerDiff(mb.sha);

  let baseline = null;
  const pb = join(dir, 'baseline.json');
  if (existsSync(pb)) {
    try {
      baseline = JSON.parse(readFileSync(pb, 'utf8'));
    } catch {
      console.log('AVISO baseline.json ilegível: ignorado');
    }
  }

  const porCamada = new Map();
  const semCamada = [];
  for (const arq of diff.keys()) {
    const c = camadaDe(arq, camadas);
    if (c) {
      if (!porCamada.has(c)) porCamada.set(c, []);
      porCamada.get(c).push(arq);
    } else semCamada.push(arq);
  }
  const tocadas = [...porCamada.keys()];

  console.log(`verificar ${id} — base ${mb.ref} (merge-base ${mb.sha.slice(0, 7)}), HEAD ${head}, árvore: ${sujos ? `${sujos} alteração(ões) não commitada(s)` : 'limpa'}`);
  console.log(`Escopo declarado: ${escopo ? escopo.join(', ') : '(não declarado)'} | camadas tocadas: ${tocadas.join(', ') || 'nenhuma'}`);
  console.log(`Arquivos no diff: ${diff.size}${semCamada.length ? ` (${semCamada.length} fora de qualquer camada)` : ''}`);
  if (baseline && baseline.mergeBase !== mb.sha) {
    console.log(`AVISO baseline gravada contra ${baseline.mergeBase.slice(0, 7)}, merge-base atual é ${mb.sha.slice(0, 7)}: houve rebase, a classificação por baseline pode estar desatualizada`);
  }

  const bloqueantes = [];
  const pre = [];
  const resumo = [];

  if (!escopo) {
    console.log('AVISO tarefas.md não declara "Escopo:" na Verificação: conferência de escopo desligada');
  } else {
    for (const c of tocadas) {
      if (!escopo.includes(c)) {
        bloqueantes.push({
          arquivo: porCamada.get(c).slice(0, 3).join(', '),
          linha: 0,
          regra: 'escopo',
          mensagem: `camada "${c}" alterada fora do Escopo declarado`,
          verificacao: 'escopo',
          metodo: 'exato',
        });
      }
    }
  }

  const nomes = [...new Set(tocadas.flatMap((c) => camadas[c].verificacoes || []))].filter(
    (n) => !so || so.includes(n)
  );
  if (nomes.length === 0) console.log('Nenhuma verificação a rodar.');

  for (const nome of nomes) {
    const def = defs[nome];
    const arquivos = tocadas
      .filter((c) => (camadas[c].verificacoes || []).includes(nome))
      .flatMap((c) => porCamada.get(c))
      .filter((a) => !def.extensoes || def.extensoes.some((e) => a.endsWith(e)))
      .filter((a) => existsSync(a));
    if (def.comando.includes('{arquivos}') && arquivos.length === 0) {
      resumo.push(`  ${nome.padEnd(8)} sem arquivo aplicável`);
      continue;
    }
    const raizes = [...new Set(tocadas.flatMap((c) => camadas[c].raizes))];
    const r = rodar(def, def.comando, { arquivos, raizes });
    if (!r.ok) {
      bloqueantes.push({ arquivo: '-', linha: 0, regra: 'ferramenta', mensagem: r.motivo, verificacao: nome, metodo: 'exato' });
      resumo.push(`  ${nome.padEnd(8)} FALHOU ao executar`);
      continue;
    }
    classificar(nome, def, r.falhas, { diff, mb: mb.sha, baseline });
    const b = r.falhas.filter((f) => f.classe === 'BLOQUEANTE');
    const p = r.falhas.filter((f) => f.classe === 'PRÉ-EXISTENTE');
    const metodos = [...new Set(r.falhas.map((f) => f.metodo))].join('/') || '-';
    b.forEach((f) => bloqueantes.push({ ...f, verificacao: nome }));
    p.forEach((f) => pre.push({ ...f, verificacao: nome }));
    resumo.push(
      `  ${nome.padEnd(8)} BLOQUEANTE ${b.length} | pré-existente ${p.length} | classificação ${metodos}` +
        `${r.avisos ? ` | avisos ${r.avisos}` : ''}${r.extra ? ` | ${r.extra}` : ''}`
    );
  }

  if (resumo.length) console.log(`\n${resumo.join('\n')}`);

  if (bloqueantes.length) {
    console.log(`\nBLOQUEANTES (${bloqueantes.length}):`);
    for (const f of bloqueantes.slice(0, LIMITE_DETALHE)) {
      const onde = f.linha ? `${f.arquivo}:${f.linha}` : f.arquivo;
      console.log(`  ${onde}  ${f.verificacao}  ${f.regra}  ${f.mensagem}${f.metodo !== 'exato' ? `  [${f.metodo}]` : ''}`);
    }
    if (bloqueantes.length > LIMITE_DETALHE) console.log(`  ... e mais ${bloqueantes.length - LIMITE_DETALHE}`);
  }

  if (pre.length) {
    if (todos) {
      console.log(`\nPRÉ-EXISTENTES (${pre.length}), não bloqueiam e não são corrigidos nesta mudança:`);
      for (const f of pre.slice(0, 200)) {
        console.log(`  ${f.linha ? `${f.arquivo}:${f.linha}` : f.arquivo}  ${f.verificacao}  ${f.regra}  ${f.mensagem}  [${f.metodo}]`);
      }
    } else {
      const cont = multiconjunto(pre.map((f) => f.arquivo));
      const top = [...cont].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, n]) => `${a} ${n}`);
      console.log(`\nPré-existentes por arquivo (não bloqueiam; --todos para detalhar): ${top.join(', ')}${cont.size > 8 ? ', ...' : ''}`);
    }
  }

  const aprox = pre.some((f) => f.metodo === 'aproximado');
  if (aprox) console.log('NOTA classificação aproximada: erro em linha não alterada causado pela mudança passaria como pré-existente.');

  console.log(`\nRESULTADO: ${bloqueantes.length ? `REPROVA (${bloqueantes.length} bloqueante(s))` : 'sem bloqueante'}`);
  process.exit(bloqueantes.length ? 1 : 0);
}

// ---------------------------------------------------------------------- main

const args = lerArgs(process.argv.slice(2));
const [primeiro, segundo] = args.pos;

if (!primeiro) sair(2, 'uso: node .sdd/verificar.mjs <change-id> [--so a,b] [--todos]\n     node .sdd/verificar.mjs baseline <change-id>');
if (primeiro === 'baseline') cmdBaseline(segundo);
else cmdVerificar(primeiro, args);
