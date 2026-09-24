#!/usr/bin/env node
// instalar.mjs — instala o harness de acessibilidade no MFE e nos BFFs SEM alterar nada versionado.
//
//   node instalar.mjs --mfe C:\repos\mfe-renegociacao --bff C:\repos\bff-renegociacao [--bff C:\repos\bff-outro]
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
if (!mfe) {
  console.error('Uso: node instalar.mjs --mfe "<pasta do repo MFE>" [--bff "<pasta do repo BFF>" ...]');
  process.exit(2);
}
for (const p of [mfe, ...bffs]) {
  if (!existsSync(p)) { console.error(`Pasta não encontrada: ${p}`); process.exit(2); }
  if (!existsSync(join(p, '.git'))) { console.error(`Não é a raiz de um repositório git (sem .git): ${p}`); process.exit(2); }
}
if (!bffs.length) console.log('Sem --bff: instalando só no MFE. A auditoria cobre só o front até você rodar de novo com --bff.\n');

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
console.log(`MFE → ${mfe}`);
copiar(join(PACOTE, 'mfe'), mfe);
mkdirSync(join(mfe, 'a11y-relatorios'), { recursive: true });

const config = {
  mfe: { raiz: 'src/app' },
  bffs: bffs.map((b) => ({
    nome: basename(b),
    raiz: barra(relative(mfe, b)),
    templates: pastaDosFtl(b),
    saidaContrato: 'target/a11y',
  })),
  relatorios: 'a11y-relatorios',
};
writeFileSync(join(mfe, 'tools', 'a11y', 'a11y.config.json'), JSON.stringify(config, null, 2) + '\n');
writeFileSync(join(mfe, 'a11y.code-workspace'), JSON.stringify({
  folders: [{ path: '.', name: `MFE · ${basename(mfe)}` }, ...config.bffs.map((b) => ({ path: b.raiz, name: `BFF · ${b.nome}` }))],
}, null, 2) + '\n');
excluir(mfe, EXCLUDE_MFE);

// ---------------------------------------------------------------- BFFs
for (const b of bffs) {
  console.log(`BFF → ${b}`);
  copiar(join(PACOTE, 'bff'), b);
  mkdirSync(join(b, 'src', 'test', 'resources', 'a11y', 'cenarios'), { recursive: true });
  writeFileSync(join(b, 'src', 'test', 'resources', 'a11y', 'config.properties'), `# gerado por instalar.mjs\ntemplates=${pastaDosFtl(b)}\n`);
  excluir(b, EXCLUDE_BFF);
}

console.log(`\nPronto. ${pulados} arquivo(s) já existiam e foram mantidos.`);
for (const b of config.bffs) console.log(`  ${b.nome}: .ftl em ${b.templates}  (se estiver errado, ajuste tools/a11y/a11y.config.json)`);
console.log(`\nPróximo passo: abra ${barra(join(basename(mfe), 'a11y.code-workspace'))} no VS Code e siga docs/a11y/PASSO-A-PASSO.md`);
