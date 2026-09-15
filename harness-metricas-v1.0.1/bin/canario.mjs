#!/usr/bin/env node
// Canário: prova se os hooks do Copilot realmente EXECUTAM nesta máquina.
// Independente do resto do pacote de propósito — não lê config, não pode falhar por configuração errada.
// Grava uma linha por evento em <dados>/canario.jsonl e sai 0 com stdout "{}".
import { appendFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = resolve(process.env.HARNESS_METRICAS_DADOS || join(RAIZ, 'dados'));

function lerStdin() {
  return new Promise((ok) => {
    let buf = '';
    let feito = false;
    const fim = () => { if (!feito) { feito = true; ok(buf); } };
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => { buf += c; try { JSON.parse(buf); fim(); } catch { /* incompleto */ } });
      process.stdin.on('end', fim);
      process.stdin.on('error', fim);
    } catch { fim(); }
    setTimeout(fim, 2000);
  });
}

try {
  const bruto = await lerStdin();
  let e = {};
  try { e = JSON.parse(bruto || '{}'); } catch { e = { _stdin_invalido: true }; }
  mkdirSync(DADOS, { recursive: true });
  appendFileSync(join(DADOS, 'canario.jsonl'), `${JSON.stringify({
    t: new Date().toISOString(),
    ev: e.hook_event_name || e.hookEventName || '?',
    sid: e.session_id || e.sessionId || null,
    repo: e.cwd ? basename(String(e.cwd)) : null,
    escopo: process.env.HARNESS_CANARIO_ESCOPO || 'usuario',
    node: process.version,
  })}\n`);
} catch { /* canário nunca atrapalha a sessão */ } finally {
  const sair = () => process.exit(0);
  setTimeout(sair, 500);
  try { process.stdout.write('{}', sair); } catch { sair(); }
}
