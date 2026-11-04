#!/usr/bin/env node
// Valida os plugins deste repositório antes de publicar. Sem dependência, Node 18+.
//
//   node ferramentas/validar.mjs
//
// Confere o que, se errado, faz o cliente ignorar o plugin ou um componente em silêncio:
// esquema e nome do plugin.json, mcp.json, nome de cada skill igual à pasta, front matter
// dos agentes, ferramentas MCP citadas, hooks.json, e versões iguais no plugin.json, no
// marketplace.json e nas entradas para o marketplace do banco.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESQ_PLUGIN = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const ESQ_MCP = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
const CAMPOS = new Set(['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions']);
const NOME = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
const SKILL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let erros = 0;
let avisos = 0;
const erro = (onde, m) => {
  erros++;
  console.log(`  ERRO  ${onde}: ${m}`);
};
const aviso = (onde, m) => {
  avisos++;
  console.log(`  AVISO ${onde}: ${m}`);
};

function json(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    erro(p.replace(`${RAIZ}/`, ''), `JSON inválido: ${e.message}`);
    return null;
  }
}

// Front matter YAML simples: chave: valor, com ou sem aspas, e listas JSON em uma linha.
function frontMatter(texto, onde) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    erro(onde, 'sem front matter');
    return {};
  }
  const out = {};
  for (const linha of m[1].split(/\r?\n/)) {
    if (!linha.trim() || /^\s/.test(linha)) continue;
    const kv = linha.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) {
      erro(onde, `linha de front matter ilegível: ${linha}`);
      continue;
    }
    let v = kv[2].trim();
    if (v.startsWith('"')) {
      try {
        v = JSON.parse(v);
      } catch {
        erro(onde, `${kv[1]}: aspas mal fechadas`);
      }
    } else if (v.startsWith('[')) {
      try {
        v = JSON.parse(v);
      } catch {
        erro(onde, `${kv[1]}: lista inválida`);
      }
    } else if (/:\s/.test(v) || /\s#/.test(v)) {
      erro(onde, `${kv[1]}: valor com ": " ou " #" precisa de aspas, senão o YAML quebra`);
    }
    out[kv[1]] = v;
  }
  return out;
}

const versoes = {};

for (const nomePlugin of readdirSync(join(RAIZ, 'plugins'))) {
  const raiz = join(RAIZ, 'plugins', nomePlugin);
  if (!statSync(raiz).isDirectory()) continue;
  const rel = (p) => `plugins/${nomePlugin}/${p}`;
  console.log(`\n${nomePlugin}`);

  // plugin.json
  const pj = json(join(raiz, 'plugin.json'));
  if (!pj) continue;
  if (pj.$schema !== ESQ_PLUGIN) erro(rel('plugin.json'), `$schema deve ser ${ESQ_PLUGIN}`);
  if (!NOME.test(pj.name || '') || /--|\.\./.test(pj.name)) erro(rel('plugin.json'), `name inválido: ${pj.name}`);
  if (pj.name !== nomePlugin) aviso(rel('plugin.json'), `name (${pj.name}) diferente da pasta (${nomePlugin})`);
  for (const k of Object.keys(pj)) if (!CAMPOS.has(k)) erro(rel('plugin.json'), `campo não permitido no Agent Plugins 1.0: ${k}`);
  if (!/^\d+\.\d+\.\d+$/.test(pj.version || '')) aviso(rel('plugin.json'), 'version fora do padrão semântico');
  if (/<[^>]+>/.test(JSON.stringify(pj))) aviso(rel('plugin.json'), 'ainda tem marcador <...> para trocar');
  versoes[pj.name] = pj.version;

  // mcp.json
  let servidores = [];
  if (existsSync(join(raiz, 'mcp.json'))) {
    const mj = json(join(raiz, 'mcp.json'));
    if (mj) {
      if (mj.$schema !== ESQ_MCP) erro(rel('mcp.json'), `$schema deve ser ${ESQ_MCP}, mesma versão do plugin.json`);
      for (const k of Object.keys(mj)) if (!['$schema', 'mcpServers'].includes(k)) erro(rel('mcp.json'), `campo não permitido: ${k}`);
      for (const [n, s] of Object.entries(mj.mcpServers || {})) {
        servidores.push(n);
        if (s.type !== 'stdio') erro(rel('mcp.json'), `${n}: type deve ser stdio`);
        if (!s.command || /\s/.test(s.command) || s.command.includes('${')) erro(rel('mcp.json'), `${n}: command é um único executável, sem espaço nem placeholder`);
        for (const a of s.args || []) {
          const m = a.match(/^\$\{PLUGIN_ROOT\}\/(.+)$/);
          if (m && !existsSync(join(raiz, m[1]))) erro(rel('mcp.json'), `${n}: arquivo não existe no plugin: ${m[1]}`);
        }
        if (s.env && ('PLUGIN_ROOT' in s.env || 'PLUGIN_DATA' in s.env)) erro(rel('mcp.json'), `${n}: env não pode definir PLUGIN_ROOT nem PLUGIN_DATA`);
      }
    }
  }

  // skills
  const dirSkills = join(raiz, 'skills');
  const skills = existsSync(dirSkills) ? readdirSync(dirSkills).filter((d) => statSync(join(dirSkills, d)).isDirectory()) : [];
  for (const d of skills) {
    const p = join(dirSkills, d, 'SKILL.md');
    if (!existsSync(p)) {
      erro(rel(`skills/${d}`), 'pasta sem SKILL.md');
      continue;
    }
    const fm = frontMatter(readFileSync(p, 'utf8'), rel(`skills/${d}/SKILL.md`));
    if (fm.name !== d) erro(rel(`skills/${d}/SKILL.md`), `name (${fm.name}) precisa ser igual à pasta (${d}); senão a skill é ignorada em silêncio`);
    if (!SKILL.test(fm.name || '')) erro(rel(`skills/${d}/SKILL.md`), 'name precisa ser kebab-case simples');
    if (!fm.description) erro(rel(`skills/${d}/SKILL.md`), 'sem description');
    else if (fm.description.length > 1024) erro(rel(`skills/${d}/SKILL.md`), 'description acima de 1024 caracteres');
  }

  // agentes
  const dirAg = join(raiz, 'com.github.copilot', 'agents');
  for (const f of existsSync(dirAg) ? readdirSync(dirAg).filter((x) => x.endsWith('.agent.md')) : []) {
    const onde = rel(`com.github.copilot/agents/${f}`);
    const texto = readFileSync(join(dirAg, f), 'utf8');
    const fm = frontMatter(texto, onde);
    if (fm.name !== basename(f, '.agent.md')) erro(onde, 'name precisa ser igual ao nome do arquivo');
    if (!fm.description) erro(onde, 'sem description');
    if (fm.model) aviso(onde, 'tem model: a escolha do modelo é de quem usa, remova a linha');
    if (!Array.isArray(fm.tools)) erro(onde, 'tools precisa ser uma lista');
    for (const t of Array.isArray(fm.tools) ? fm.tools : []) {
      const srv = t.includes('/') ? t.split('/')[0] : null;
      if (srv && !['read', 'edit', 'search', 'execute', 'web', 'agent', 'todo'].includes(srv) && !servidores.includes(srv)) {
        erro(onde, `ferramenta ${t}: o servidor MCP "${srv}" não está no mcp.json deste plugin`);
      }
    }
    if (/\.github\/skills\/|node \.sdd\//.test(texto)) erro(onde, 'ainda cita caminho do modo repositório (.github/skills ou node .sdd/)');
  }

  // hooks
  const hj = join(raiz, 'com.github.copilot', 'hooks', 'hooks.json');
  if (existsSync(hj)) {
    const h = json(hj);
    if (h && h.version !== 1) erro(rel('com.github.copilot/hooks/hooks.json'), 'version deve ser 1');
    for (const lista of Object.values(h?.hooks || {})) {
      for (const e of lista) {
        const cmd = `${e.bash || ''} ${e.powershell || ''} ${e.command || ''}`;
        for (const m of cmd.matchAll(/PLUGIN_ROOT\}?\/([\w./-]+)/g)) {
          if (!existsSync(join(raiz, m[1]))) erro(rel('com.github.copilot/hooks/hooks.json'), `script não existe: ${m[1]}`);
        }
      }
    }
  }
}

// marketplace próprio e entradas para o marketplace do banco
console.log('\nmarketplace');
const mk = json(join(RAIZ, '.github', 'plugin', 'marketplace.json'));
for (const p of mk?.plugins || []) {
  const src = typeof p.source === 'string' ? p.source : null;
  if (src && !existsSync(join(RAIZ, src))) erro('.github/plugin/marketplace.json', `${p.name}: source não existe: ${src}`);
  if (versoes[p.name] !== p.version) erro('.github/plugin/marketplace.json', `${p.name}: version ${p.version} diferente do plugin.json (${versoes[p.name]})`);
}
const ent = json(join(RAIZ, 'integracao', 'entradas-marketplace.json'));
for (const variante of ['variante-github', 'variante-url']) {
  for (const p of ent?.[variante] || []) {
    if (versoes[p.name] !== p.version) erro(`integracao/entradas-marketplace.json`, `${variante} ${p.name}: version ${p.version} diferente do plugin.json`);
    const ref = p.source?.ref;
    if (ref && ref !== `v${versoes[p.name]}`) aviso(`integracao/entradas-marketplace.json`, `${variante} ${p.name}: ref ${ref} não é v${versoes[p.name]}`);
    if (p.source?.path && !existsSync(join(RAIZ, p.source.path))) erro('integracao/entradas-marketplace.json', `${p.name}: path não existe: ${p.source.path}`);
  }
}

console.log(`\n${erros} erro(s), ${avisos} aviso(s).`);
process.exit(erros ? 1 : 0);
