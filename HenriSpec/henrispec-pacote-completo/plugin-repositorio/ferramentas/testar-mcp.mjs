#!/usr/bin/env node
// Teste de fumaça do servidor MCP dos plugins. Sem dependência, Node 18+.
// Faz o papel do VS Code: sobe o servidor, entrega o repositório como "root", lista as
// ferramentas e chama as que não alteram nada.
//
//   node ferramentas/testar-mcp.mjs <caminho-do-repositorio> [henrispec|henrispec-discovery]
//
// Não escreve no repositório: init roda só como plano, e veredito e arquivamento não são
// chamados. Sai com 1 se alguma chamada falhar.

import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = process.argv[2] && resolve(process.argv[2]);
const plugin = process.argv[3] || 'henrispec';
if (!repo) {
  console.error('uso: node ferramentas/testar-mcp.mjs <caminho-do-repositorio> [henrispec|henrispec-discovery]');
  process.exit(2);
}
const raizPlugin = join(RAIZ, 'plugins', plugin);
const perfil = plugin === 'henrispec' ? 'henrispec' : 'discovery';

const srv = spawn(process.execPath, [join(raizPlugin, 'mcp', 'servidor.mjs'), '--perfil', perfil], {
  cwd: raizPlugin,
  env: { ...process.env, PLUGIN_ROOT: raizPlugin },
  stdio: ['pipe', 'pipe', 'inherit'],
});

let id = 0;
const espera = new Map();
let buf = '';
srv.stdout.setEncoding('utf8');
srv.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i));
    buf = buf.slice(i + 1);
    if (msg.method === 'roots/list') {
      srv.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { roots: [{ uri: pathToFileURL(repo).href, name: 'repo' }] } })}\n`);
    } else if (espera.has(msg.id)) {
      espera.get(msg.id)(msg);
      espera.delete(msg.id);
    }
  }
});

function chamar(method, params) {
  const meuId = ++id;
  srv.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: meuId, method, params })}\n`);
  return new Promise((ok) => espera.set(meuId, ok));
}

let falhas = 0;
async function ferramenta(nome, args) {
  const r = await chamar('tools/call', { name: nome, arguments: args });
  const texto = r.result?.content?.[0]?.text ?? JSON.stringify(r.error);
  const erro = Boolean(r.error || r.result?.isError);
  if (erro) falhas++;
  console.log(`\n── ${nome} ${JSON.stringify(args)} ${erro ? 'ERRO' : 'ok'}\n${texto.split('\n').slice(0, 14).join('\n')}`);
}

const ini = await chamar('initialize', { protocolVersion: '2025-06-18', capabilities: { roots: { listChanged: true } }, clientInfo: { name: 'teste', version: '1' } });
console.log(`servidor: ${ini.result.serverInfo.name} ${ini.result.serverInfo.version}`);
srv.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
await new Promise((r) => setTimeout(r, 300));
const lista = await chamar('tools/list', {});
console.log(`ferramentas: ${lista.result.tools.map((t) => t.name).join(', ')}`);

await ferramenta('status', {});
await ferramenta('contrato', { parte: 'skill' });
await ferramenta('init', {});
if (perfil === 'henrispec') {
  await ferramenta('git', { consulta: 'estado' });
  await ferramenta('validar', {});
}
srv.kill();
console.log(`\n${falhas ? `${falhas} chamada(s) com erro` : 'tudo ok'}`);
process.exit(falhas ? 1 : 0);
