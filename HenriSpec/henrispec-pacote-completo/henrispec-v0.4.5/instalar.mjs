#!/usr/bin/env node
// Instalador e atualizador da família HenriSpec. Arquivo único, sem dependência, Node 18+.
// O mesmo motor serve a qualquer pacote: o que é de cada toolkit (nome, lock, pós-instalação)
// vem do manifesto.json ao lado deste arquivo.
// Lê só o disco: não usa rede, não usa npm, não escreve em Git.
//
//   node instalar.mjs repo [caminho] [--dry-run] [--forcar] [--sem-github]
//   node instalar.mjs global          [--dry-run] [--forcar]
//   node instalar.mjs hashes          (manutenção: hashes deste pacote para o próximo manifesto)
//
// Três tipos de arquivo, declarados em manifesto.json:
//   gerenciado  do toolkit. Criado ou atualizado; se você o alterou, é CONFLITO e nada é escrito.
//   semente     criado só se não existir. Depois disso é seu: verificacao.json, padroes.md, índices.
//   removido    deixou de existir no toolkit. Apagado só se estiver intacto.
// Tudo que não está no manifesto — mudanças, specs, decisões, briefings — nunca é lido nem tocado.
//
// "Intacto" é provado por hash: o do lock gravado na última instalação, ou o de uma versão
// publicada listada em "conhecidos". Sem prova, o arquivo é tratado como alterado.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync,
} from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PACOTE = dirname(fileURLToPath(import.meta.url));
const PROPRIOS = new Set(['instalar.mjs', 'instalar.sh', 'manifesto.json', '.gitattributes']);

function sair(codigo, msg) {
  if (msg) (codigo === 0 ? console.log : console.error)(msg);
  process.exit(codigo);
}

const barra = (p) => p.split(sep).join('/').replace(/\\/g, '/');
const lf = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n');
const hash = (texto) => createHash('sha256').update(texto).digest('hex');
const hashArquivo = (p) => hash(lf(readFileSync(p)));

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

function listar(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '.git' || e.name === 'node_modules') return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? listar(p, base) : [barra(relative(base, p))];
  });
}

// "destino" terminado em "/" é prefixo (pastas inteiras, como assets/); senão, é o caminho final.
const destinoDe = (origem, regra) =>
  !regra.destino ? origem : regra.destino.endsWith('/') ? regra.destino + origem : regra.destino;

function compararVersao(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

function lerJson(p, padrao = null) {
  if (!existsSync(p)) return padrao;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    sair(2, `${p} não é JSON válido: ${e.message}`);
  }
}

// ------------------------------------------------------------------ manifesto

function carregarManifesto() {
  const m = lerJson(join(PACOTE, 'manifesto.json'));
  if (!m || !m.versao || !Array.isArray(m.regras)) sair(2, `manifesto.json ausente ou incompleto em ${PACOTE}`);
  for (const r of m.regras) {
    if (!['gerenciado', 'semente'].includes(r.tipo)) sair(2, `regra ${r.origem}: tipo "${r.tipo}" inválido`);
    r.re = globParaRegex(r.origem);
  }
  // Caminhos próprios de cada toolkit. Os padrões são os do HenriSpec, o primeiro da família.
  m.lock ||= '.sdd/toolkit.lock.json';
  m.backup ||= '.sdd/.toolkit-backup';
  m.lockGlobal ||= `${m.toolkit}.lock.json`;
  m.backupGlobal ||= `.${m.toolkit}-backup`;
  m.pendencias ||= {};
  m.removidos ||= [];
  // Arquivos do pacote que não vão para o repositório, como a fonte do onboarding.
  m.ignorarRe = (m.ignorar || []).map(globParaRegex);
  m.conhecidos ||= {};
  return m;
}

// Arquivos do pacote, cada um com a regra que o rege. Arquivo sem regra não é instalado.
function arquivosDoPacote(manifesto, silencioso = false) {
  const out = [];
  const orfaos = [];
  for (const origem of listar(PACOTE)) {
    if (PROPRIOS.has(origem) || manifesto.ignorarRe.some((r) => r.test(origem))) continue;
    const regra = manifesto.regras.find((r) => r.re.test(origem));
    if (regra) out.push({ origem, regra });
    else orfaos.push(origem);
  }
  if (orfaos.length && !silencioso) console.log(`AVISO arquivos do pacote fora do manifesto, não instalados: ${orfaos.join(', ')}`);
  return out;
}

// ---------------------------------------------------------------------- alvos

function alvoRepo(caminho, semGithub, m) {
  const raiz = resolve(caminho || '.');
  if (!existsSync(raiz) || !statSync(raiz).isDirectory()) sair(2, `${raiz} não é uma pasta`);
  if (barra(raiz).toLowerCase() === barra(PACOTE).toLowerCase()) sair(2, 'o destino é o próprio pacote: rode a partir do repositório, ou passe o caminho dele');
  if (!existsSync(join(raiz, '.git'))) console.log(`AVISO ${raiz} não parece raiz de repositório Git (sem .git)`);
  return {
    nome: `repo ${barra(raiz)}`,
    raiz,
    lock: join(raiz, m.lock),
    backup: join(raiz, m.backup),
    instrucoes: true,
    // Com --sem-github, .github/ fica fora do alcance: nem escrito, nem apagado, nem esquecido no lock.
    toca: (destino) => !(semGithub && destino.startsWith('.github/')),
    destino(origem, regra) {
      if (semGithub && origem.startsWith('.github/')) return null;
      return destinoDe(origem, regra);
    },
    transformar: (texto) => texto,
  };
}

function alvoGlobal(m) {
  const raiz = resolve(process.env.COPILOT_HOME || join(homedir(), '.copilot'));
  const abs = barra(raiz);
  return {
    nome: `global ${abs}`,
    raiz,
    lock: join(raiz, m.lockGlobal),
    lockAntigo: m.lockGlobalAntigo ? join(raiz, m.lockGlobalAntigo) : null,
    backup: join(raiz, m.backupGlobal),
    toca: () => true,
    // Só agente e skill existem no nível do usuário; .sdd/ e docs/ são do repositório.
    destino(origem, regra) {
      if (!regra.global) return null;
      return origem.replace(/^\.github\//, '');
    },
    // Os agentes leem o contrato por caminho. Fora do repositório, o caminho muda; as
    // instructions do projeto (.github/instructions) continuam sendo do repositório.
    transformar: (texto) =>
      texto.replaceAll('.github/skills/', `${abs}/skills/`).replaceAll('.github/agents/', `${abs}/agents/`),
  };
}

// ----------------------------------------------------------------- planejamento

function versaoInstalada(alvo, lock, manifesto) {
  if (lock) return { versao: lock.versao, como: 'lock' };
  // Arquivo que não mudou entre versões assina por todas elas ("0.3,0.4.0"). Vence a versão
  // com mais arquivos batendo; no empate, a mais antiga, que é a hipótese conservadora.
  const votos = new Map();
  for (const [destino, porHash] of Object.entries(manifesto.conhecidos)) {
    const p = join(alvo.raiz, destino);
    if (!existsSync(p)) continue;
    const v = porHash[hashArquivo(p)];
    if (v) for (const x of v.split(',')) votos.set(x, (votos.get(x) || 0) + 1);
  }
  if (!votos.size) return null;
  const [versao] = [...votos].sort((a, b) => b[1] - a[1] || compararVersao(a[0], b[0]))[0];
  return { versao, como: 'assinatura' };
}

function intacto(destino, hAtual, lock, manifesto) {
  if (lock?.arquivos?.[destino] === hAtual) return true;
  return Boolean(manifesto.conhecidos[destino]?.[hAtual]);
}

function planejar(alvo, manifesto, forcar) {
  // Instalação global anterior à 0.4.2 gravava o lock com o nome antigo.
  const lock = lerJson(alvo.lock) || (alvo.lockAntigo ? lerJson(alvo.lockAntigo) : null);
  const acoes = [];
  const destinosNovos = new Set();

  for (const { origem, regra } of arquivosDoPacote(manifesto)) {
    const destino = alvo.destino(origem, regra);
    if (!destino) continue;
    destinosNovos.add(destino);
    const conteudo = alvo.transformar(lf(readFileSync(join(PACOTE, origem))));
    const hNovo = hash(conteudo);
    const p = join(alvo.raiz, destino);
    const base = { destino, conteudo, hNovo, tipo: regra.tipo };

    if (!existsSync(p)) {
      acoes.push({ ...base, acao: 'criar' });
      continue;
    }
    if (regra.tipo === 'semente') {
      acoes.push({ ...base, acao: 'manter' });
      continue;
    }
    const hAtual = hashArquivo(p);
    if (hAtual === hNovo) acoes.push({ ...base, acao: 'igual' });
    else if (intacto(destino, hAtual, lock, manifesto)) acoes.push({ ...base, acao: 'atualizar' });
    else acoes.push({ ...base, acao: forcar ? 'sobrescrever' : 'CONFLITO' });
  }

  // Removidos declarados, mais o que o lock diz ser nosso e o pacote não traz mais.
  const candidatos = new Set([
    ...manifesto.removidos
      .map((r) => alvo.destino(r, { tipo: 'gerenciado', global: /^\.github\/(agents|skills)\//.test(r) }))
      .filter(Boolean),
    ...Object.keys(lock?.arquivos || {}),
  ]);
  for (const destino of candidatos) {
    if (destinosNovos.has(destino) || !alvo.toca(destino)) continue;
    const p = join(alvo.raiz, destino);
    if (!existsSync(p)) continue;
    const hAtual = hashArquivo(p);
    if (intacto(destino, hAtual, lock, manifesto)) acoes.push({ destino, acao: 'remover', tipo: 'removido' });
    else acoes.push({ destino, acao: forcar ? 'remover' : 'manter-alterado', tipo: 'removido' });
  }

  return { lock, acoes };
}

// --------------------------------------------------------------------- aplicação

function aplicar(alvo, manifesto, acoes, lockAnterior) {
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const pastaBackup = join(alvo.backup, carimbo);
  let backups = 0;

  const guardar = (destino) => {
    const de = join(alvo.raiz, destino);
    const para = join(pastaBackup, destino);
    mkdirSync(dirname(para), { recursive: true });
    copyFileSync(de, para);
    backups++;
  };

  for (const a of acoes) {
    const p = join(alvo.raiz, a.destino);
    if (['criar', 'atualizar', 'sobrescrever'].includes(a.acao)) {
      if (existsSync(p)) guardar(a.destino);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, a.conteudo);
    } else if (a.acao === 'remover') {
      guardar(a.destino);
      rmSync(p);
      apagarPastasVazias(dirname(p), alvo.raiz);
    }
  }

  if (backups) {
    const gi = join(alvo.backup, '.gitignore');
    if (!existsSync(gi)) writeFileSync(gi, '*\n');
  }

  const arquivos = Object.fromEntries(
    Object.entries(lockAnterior?.arquivos || {}).filter(([d]) => !alvo.toca(d))
  );
  for (const a of acoes) {
    if (a.tipo === 'gerenciado' && ['criar', 'atualizar', 'sobrescrever', 'igual'].includes(a.acao)) {
      arquivos[a.destino] = a.hNovo;
    }
  }
  const lock = {
    toolkit: manifesto.toolkit,
    versao: manifesto.versao,
    ...(manifesto.formato ? { formato: manifesto.formato } : {}),
    instaladoEm: new Date().toISOString(),
    arquivos: Object.fromEntries(Object.entries(arquivos).sort()),
  };
  mkdirSync(dirname(alvo.lock), { recursive: true });
  writeFileSync(alvo.lock, `${JSON.stringify(lock, null, 2)}\n`);
  return backups ? barra(relative(alvo.raiz, pastaBackup)) : null;
}

// Arquivos de .github/ que o pacote instala: usados para avisar de cópia esquecida no repositório.
function acoesGithub(m) {
  return arquivosDoPacote(m, true)
    .filter(({ origem }) => origem.startsWith('.github/') && !origem.includes('/references/'))
    .map(({ origem }) => origem);
}

function apagarPastasVazias(dir, raiz) {
  let d = dir;
  while (resolve(d) !== resolve(raiz) && existsSync(d) && readdirSync(d).length === 0) {
    rmSync(d, { recursive: true });
    d = dirname(d);
  }
}

// ------------------------------------------------ instruções do projeto e exclude local

const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function gitSaida(raiz, args) {
  const r = spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Bloco do toolkit no arquivo de instruções do projeto: AGENTS.md na raiz, senão
// .github/copilot-instructions.md, senão um AGENTS.md novo. O bloco fica entre marcadores e é
// trocado inteiro a cada instalação; o resto do arquivo é do time e não é tocado.
function planejarInstrucoes(alvo, m) {
  const cfg = m.instrucoes;
  if (!cfg || !alvo.instrucoes) return null;
  const ini = `<!-- ${cfg.marcador}:inicio -->`;
  const fim = `<!-- ${cfg.marcador}:fim -->`;
  const texto = `${ini}\n${lf(readFileSync(join(PACOTE, cfg.arquivo))).trim()}\n${fim}`;
  const avisos = [];
  if (existsSync(join(alvo.raiz, '.github', 'AGENTS.md'))) {
    avisos.push('.github/AGENTS.md não é lido por padrão: o lugar do AGENTS.md é a raiz do repositório, ao lado do package.json.');
  }
  const existente = ['AGENTS.md', '.github/copilot-instructions.md'].find((c) => existsSync(join(alvo.raiz, c)));
  const destino = existente || 'AGENTS.md';
  if (!alvo.toca(destino)) {
    avisos.push(`${destino} está em .github/ e --sem-github não toca nessa pasta: o bloco de instruções não foi incluído.`);
    return { avisos, acao: 'pular', destino };
  }
  const atual = existente ? lf(readFileSync(join(alvo.raiz, destino))) : '';
  const re = new RegExp(`${escRe(ini)}[\\s\\S]*?${escRe(fim)}`);
  let novo;
  let acao;
  if (re.test(atual)) {
    novo = atual.replace(re, texto);
    acao = novo === atual ? 'igual' : 'atualizar bloco';
  } else if (existente) {
    novo = `${atual.replace(/\s*$/, '')}\n\n${texto}\n`;
    acao = 'incluir bloco';
  } else {
    novo = `# Instruções para agentes de IA\n\n${texto}\n`;
    acao = 'criar';
  }
  const rastreado = existente ? gitSaida(alvo.raiz, ['ls-files', '--error-unmatch', destino]) !== null : false;
  return { destino, novo, acao, avisos, rastreado, criado: !existente };
}

// Bloco do toolkit em .git/info/exclude: o que o toolkit gera no repositório fica fora do Git
// sem mexer no .gitignore, que é versionado. Linhas fora do bloco são de quem usa e não mudam.
function planejarExclude(alvo, m, instr) {
  if (!alvo.instrucoes) return null;
  const desejados = [...(m.excluir || [])];
  if (instr?.criado) desejados.push('/AGENTS.md');
  if (!desejados.length) return null;
  const rel = gitSaida(alvo.raiz, ['rev-parse', '--git-path', 'info/exclude']);
  if (!rel) return { aviso: 'sem repositório Git: .git/info/exclude não foi atualizado.' };
  const abs = resolve(alvo.raiz, rel);
  const atual = existsSync(abs) ? lf(readFileSync(abs)) : '';
  const ini = `# >>> ${m.toolkit}: arquivos locais gerados pelo instalador`;
  const fim = `# <<< ${m.toolkit}`;
  const re = new RegExp(`${escRe(ini)}\\n([\\s\\S]*?)${escRe(fim)}\\n?`);
  const anteriores = (atual.match(re)?.[1] || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const fora = atual.replace(re, '');
  const jaFora = new Set(fora.split('\n').map((l) => l.trim()));
  const bloco = [...new Set([...anteriores, ...desejados])].filter((p) => !jaFora.has(p));
  const novos = desejados.filter((p) => !jaFora.has(p) && !anteriores.includes(p));
  const conteudo = `${fora.replace(/\s*$/, '')}${fora.trim() ? '\n\n' : ''}${ini}\n${bloco.join('\n')}\n${fim}\n`;
  return { abs, novos, conteudo, mudou: conteudo !== atual };
}

// ------------------------------------------------------------------------ main

function lerArgs(argv) {
  const out = { pos: [], dryRun: false, forcar: false, semGithub: false };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--forcar') out.forcar = true;
    else if (a === '--sem-github') out.semGithub = true;
    else if (a.startsWith('--')) sair(2, `opção desconhecida: ${a}`);
    else out.pos.push(a);
  }
  return out;
}

const USO = `uso:
  instalar.sh repo [caminho] [--dry-run] [--forcar] [--sem-github]
  instalar.sh global          [--dry-run] [--forcar]`;

const args = lerArgs(process.argv.slice(2));
const [modo, caminho] = args.pos;
const manifesto = carregarManifesto();

if (modo === 'hashes') {
  const out = {};
  for (const { origem, regra } of arquivosDoPacote(manifesto, true)) {
    if (regra.tipo === 'gerenciado') out[destinoDe(origem, regra)] = { [hashArquivo(join(PACOTE, origem))]: manifesto.versao };
  }
  sair(0, JSON.stringify(out, null, 2));
}

let alvo;
if (modo === 'repo') alvo = alvoRepo(caminho, args.semGithub, manifesto);
else if (modo === 'global') alvo = alvoGlobal(manifesto);
else sair(2, USO);

const { lock, acoes } = planejar(alvo, manifesto, args.forcar);
const instalada = versaoInstalada(alvo, lock, manifesto);

console.log(
  `${manifesto.nome || manifesto.toolkit} ${instalada ? `${instalada.versao} (por ${instalada.como})` : '(não instalado)'} -> ${manifesto.versao}  alvo: ${alvo.nome}${args.dryRun ? '  [dry-run]' : ''}`
);

if (instalada && compararVersao(instalada.versao, manifesto.versao) > 0 && !args.forcar) {
  sair(2, `a versão instalada é mais nova que o pacote. Para voltar de versão, use --forcar.`);
}

const ordem = ['CONFLITO', 'manter-alterado', 'sobrescrever', 'remover', 'atualizar', 'criar', 'manter', 'igual'];
const mostrar = acoes.filter((a) => a.acao !== 'igual' && a.acao !== 'manter').sort((a, b) => ordem.indexOf(a.acao) - ordem.indexOf(b.acao));
for (const a of mostrar) {
  const nota = {
    CONFLITO: 'alterado localmente; nada será escrito. Compare com o pacote e decida, ou use --forcar',
    'manter-alterado': 'saiu do toolkit, mas foi alterado localmente: mantido, apague à mão',
    sobrescrever: 'alterado localmente; backup antes de sobrescrever',
  }[a.acao];
  console.log(`  ${a.acao.padEnd(15)} ${a.destino}${nota ? `  (${nota})` : ''}`);
}
const iguais = acoes.filter((a) => a.acao === 'igual').length;
if (iguais) console.log(`  ${'igual'.padEnd(15)} ${iguais} arquivo(s) já na versão do pacote`);
const mantidas = acoes.filter((a) => a.acao === 'manter').length;
if (mantidas) console.log(`  ${'manter'.padEnd(15)} ${mantidas} semente(s) que já existiam: são suas, não são tocadas`);

const instr = planejarInstrucoes(alvo, manifesto);
const excl = planejarExclude(alvo, manifesto, instr);
if (instr && !['igual', 'pular'].includes(instr.acao)) {
  console.log(`  ${'instruções'.padEnd(15)} ${instr.acao} em ${instr.destino}${instr.rastreado ? '  (arquivo versionado: a alteração fica só na sua máquina)' : ''}`);
}
for (const a of instr?.avisos || []) console.log(`AVISO ${a}`);
if (excl?.aviso) console.log(`AVISO ${excl.aviso}`);
for (const p of excl?.novos || []) console.log(`  ${'excluir'.padEnd(15)} ${p}  (em .git/info/exclude)`);

const conflitos = acoes.filter((a) => a.acao === 'CONFLITO');
if (conflitos.length) sair(1, `\n${conflitos.length} conflito(s). Nada foi escrito.`);
if (args.dryRun) sair(0, '\ndry-run: nada foi escrito.');

const backup = aplicar(alvo, manifesto, acoes, lock);
if (instr && !['igual', 'pular'].includes(instr.acao)) {
  const p = join(alvo.raiz, instr.destino);
  if (existsSync(p)) {
    const copia = join(alvo.backup, `instrucoes-${Date.now()}`, instr.destino);
    mkdirSync(dirname(copia), { recursive: true });
    copyFileSync(p, copia);
  }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, instr.novo);
  if (instr.rastreado) {
    gitSaida(alvo.raiz, ['update-index', '--skip-worktree', instr.destino]);
    console.log(`PENDENTE ${instr.destino} é versionado: o bloco foi marcado com skip-worktree para não aparecer no git status. Para desfazer: git update-index --no-skip-worktree ${instr.destino}`);
  }
}
if (excl?.mudou) {
  mkdirSync(dirname(excl.abs), { recursive: true });
  writeFileSync(excl.abs, excl.conteudo);
}
console.log(`\nInstalado ${manifesto.versao}. Lock: ${barra(relative(alvo.raiz, alvo.lock))}${backup ? ` | backup: ${backup}` : ''}`);

// ------------------------------------------------------------ depois de instalar

const semeados = acoes.filter((a) => a.tipo === 'semente' && a.acao === 'criar').map((a) => a.destino);
for (const [semente, msg] of Object.entries(manifesto.pendencias)) {
  if (semeados.includes(semente)) console.log(`PENDENTE ${msg}`);
}
if (modo === 'repo' && args.semGithub) {
  const legado = [...manifesto.removidos, ...acoesGithub(manifesto)]
    .filter((p) => existsSync(join(alvo.raiz, p))).slice(0, 4);
  if (legado.length) {
    console.log(`AVISO --sem-github não tocou em .github/, e ele ainda tem cópia do toolkit (${legado.join(', ')}). Junto com a instalação global, isso dá skill e agente duplicados: apague à mão.`);
  }
}
if (modo === 'global') {
  console.log('PENDENTE em cada repositório: instalar.sh repo <caminho> --sem-github, para o que fica fora de .github/.');
  console.log('AVISO agente com o mesmo nome no repositório e no usuário aparece duas vezes no seletor.');
}
const pos = manifesto.posInstalacao;
if (modo === 'repo' && pos && existsSync(join(alvo.raiz, pos.script))) {
  const r = spawnSync(process.execPath, [pos.script, ...(pos.args || [])], { cwd: alvo.raiz, encoding: 'utf8' });
  const linhas = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  console.log(`\n${pos.titulo || 'Pós-instalação'}:\n  ${linhas.slice(-12).join('\n  ')}`);
  if (r.status !== 0 && pos.seFalhar) console.log(`PENDENTE ${pos.seFalhar}`);
}
