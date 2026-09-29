#!/usr/bin/env node
// instalar.mjs — instala o harness de acessibilidade no MFE e nos BFFs SEM alterar nada versionado.
//
//   node instalar.mjs --mfe "C:\repos\mfe" --bff "C:\repos\bff1" [--bff "C:\repos\bff2"]   (MFE + BFFs)
//   node instalar.mjs --mfe "C:\repos\mfe"                                              (só MFE)
//   node instalar.mjs --bff "C:\repos\bff1"                                             (só BFF)
// Instalou por partes? Rode depois com --mfe + todos os --bff para o MFE enxergar os BFFs.
//
// O que faz:
//   1. Copia os arquivos do pacote. Arquivo que JÁ EXISTE no repo nunca é sobrescrito (só avisa).
//   2. Gera tools/a11y/a11y.config.json no MFE, apontando para os BFFs e a pasta dos .ftl.
//   3. Gera a11y.code-workspace no MFE (MFE + BFFs no mesmo VS Code, só para a auditoria).
//   4. Adiciona tudo ao .git/info/exclude de cada repo: git status continua limpo, nada vai para commit.
// Pode rodar de novo: é idempotente.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACOTE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const multi = (n) => args.flatMap((a, i) => (a === `--${n}` && args[i + 1] ? [args[i + 1]] : []));
const mfe = multi('mfe')[0] && resolve(multi('mfe')[0]);
const bffs = multi('bff').map((b) => resolve(b));

// Argumento solto = caminho com espaço sem aspas (ex.: ...\Mobile PF\repo vira "...\Mobile" + "PF\repo").
const soltos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (soltos.length) {
  console.error(`Argumento inesperado: ${soltos.join(' ')}`);
  console.error('Caminho com espaço precisa de aspas: --mfe "C:\\...\\Mobile PF\\repo"');
  process.exit(2);
}
if (!mfe && !bffs.length) {
  console.error('Uso: node instalar.mjs [--mfe "<pasta do repo MFE>"] [--bff "<pasta do repo BFF>" ...]  (ao menos um)');
  process.exit(2);
}
for (const sub of ['mfe', 'bff'])
  if (!existsSync(join(PACOTE, sub))) { console.error(`Pasta "${sub}" não encontrada ao lado do instalar.mjs (${PACOTE}). Rode de dentro da pasta harness-a11y.`); process.exit(2); }
for (const p of [mfe, ...bffs].filter(Boolean)) {
  if (!existsSync(p)) { console.error(`Pasta não encontrada: ${p}`); process.exit(2); }
  if (!existsSync(join(p, '.git'))) { console.error(`Não é a raiz de um repositório git (sem .git): ${p}`); process.exit(2); }
}
if (!bffs.length) console.log('Sem --bff: instalando só no MFE. A auditoria cobre só o front até você rodar de novo com --bff.\n');
if (!mfe) console.log('Sem --mfe: instalando só no(s) BFF(s). Para o relatório do MFE incluir este BFF, rode depois com --mfe e todos os --bff.\n');

const EXCLUDE_MFE = [
  '.github/agents/a11y-*', '.github/instructions/a11y-*', '.github/prompts/a11y-*', '.github/skills/a11y-*', '.github/hooks/a11y.json',
  'tools/a11y/', 'e2e-a11y/', 'docs/a11y/', 'src/testing/a11y/', 'a11y-relatorios/', 'a11y.code-workspace',
];
const EXCLUDE_BFF = [
  '.github/instructions/ftl-json-a11y*', '.github/prompts/a11y-*', 'tools/a11y/', 'src/test/java/a11y/', 'src/test/resources/a11y/', 'target/a11y/',
];

let pulados = 0;
function copiar(origem, destino) {
  for (const e of readdirSync(origem)) {
    const o = join(origem, e), d = join(destino, e);
    if (statSync(o).isDirectory()) { mkdirSync(d, { recursive: true }); copiar(o, d); }
    else if (existsSync(d) && !d.endsWith('a11y.config.json')) { pulados++; console.log(`  = já existe, mantido: ${d}`); }
    else cpSync(o, d);
  }
}

function excluir(repo, linhas) {
  const arq = join(repo, '.git', 'info', 'exclude');
  mkdirSync(dirname(arq), { recursive: true });
  const atual = existsSync(arq) ? readFileSync(arq, 'utf8') : '';
  const novas = linhas.filter((l) => !atual.split(/\r?\n/).includes(l));
  if (novas.length) appendFileSync(arq, `${atual.endsWith('\n') || !atual ? '' : '\n'}# harness a11y (local, não versionar)\n${novas.join('\n')}\n`);
}

function pastaDosFtl(repo) {
  // pasta com mais .ftl dentro de src/main/resources
  const base = join(repo, 'src', 'main', 'resources');
  const contagem = new Map();
  const andar = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) andar(p);
      else if (e.endsWith('.ftl')) contagem.set(d, (contagem.get(d) ?? 0) + 1);
    }
  };
  andar(base);
  const melhor = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
  return melhor ? relative(repo, melhor[0]).split(sep).join('/') : 'src/main/resources/templates';
}

const barra = (p) => p.split(sep).join('/');

// ---------------------------------------------------------------- MFE
const bffsConfig = [];
if (mfe) {
  console.log(`MFE → ${mfe}`);
  const arqConfig = join(mfe, 'tools', 'a11y', 'a11y.config.json');
  // BFFs de instalações anteriores são mantidos; os passados agora sobrescrevem pelo nome.
  const anteriores = existsSync(arqConfig) ? (JSON.parse(readFileSync(arqConfig, 'utf8')).bffs ?? []).filter((b) => b.nome !== 'bff-exemplo') : [];
  copiar(join(PACOTE, 'mfe'), mfe);
  mkdirSync(join(mfe, 'a11y-relatorios'), { recursive: true });

  const novos = bffs.map((b) => ({ nome: basename(b), raiz: barra(relative(mfe, b)), templates: pastaDosFtl(b), saidaContrato: 'target/a11y' }));
  bffsConfig.push(...anteriores.filter((a) => !novos.some((n) => n.nome === a.nome)), ...novos);
  const config = { mfe: { raiz: 'src/app' }, bffs: bffsConfig, relatorios: 'a11y-relatorios' };
  writeFileSync(arqConfig, JSON.stringify(config, null, 2) + '\n');
  writeFileSync(join(mfe, 'a11y.code-workspace'), JSON.stringify({
    folders: [{ path: '.', name: `MFE · ${basename(mfe)}` }, ...bffsConfig.map((b) => ({ path: b.raiz, name: `BFF · ${b.nome}` }))],
  }, null, 2) + '\n');
  excluir(mfe, EXCLUDE_MFE);
}

// ---------------------------------------------------------------- BFFs
for (const b of bffs) {
  console.log(`BFF → ${b}`);
  copiar(join(PACOTE, 'bff'), b);
  mkdirSync(join(b, 'src', 'test', 'resources', 'a11y', 'cenarios'), { recursive: true });
  const props = join(b, 'src', 'test', 'resources', 'a11y', 'config.properties');
  if (!existsSync(props)) writeFileSync(props, `# gerado por instalar.mjs\ntemplates=${pastaDosFtl(b)}\n`); // ajuste manual é preservado
  excluir(b, EXCLUDE_BFF);
}

console.log(`\nPronto. ${pulados} arquivo(s) já existiam e foram mantidos.`);
for (const b of bffs) console.log(`  ${basename(b)}: .ftl em ${pastaDosFtl(b)}  (se estiver errado, ajuste src/test/resources/a11y/config.properties${mfe ? ' e tools/a11y/a11y.config.json' : ''})`);
if (mfe) console.log(`\nPróximo passo: abra ${barra(join(basename(mfe), 'a11y.code-workspace'))} no VS Code e siga docs/a11y/PASSO-A-PASSO.md`);
else console.log('\nPróximo passo: no IntelliJ, crie um cenário em src/test/resources/a11y/cenarios/ e rode A11yContratoFtlTest.');