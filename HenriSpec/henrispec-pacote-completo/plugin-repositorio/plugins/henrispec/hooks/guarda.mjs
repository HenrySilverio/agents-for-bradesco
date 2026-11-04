#!/usr/bin/env node
// Hook preToolUse do HenriSpec. Arquivo único, sem dependência, Node 18+.
//
// Roda antes de cada ferramenta, em qualquer agente, mas só age em repositório com .sdd/.
// Três regras, todas sobre registros que o fluxo trata como imutáveis:
//   1. veredito em .sdd/changes/<id>/revisao/ não é escrito nem editado por ferramenta comum:
//      só pela henrispec/gravar_veredito, que nunca sobrescreve;
//   2. mudança arquivada em .sdd/changes/archive/ não é editada;
//   3. opcional: com {"bloquearGitNoAgente": true} em .sdd/henrispec.json, o agente não escreve
//      no Git pelo terminal (commit, push, merge, rebase, reset, troca ou criação de branch).
//
// Hook de comando com erro nega a ferramenta. Por isso tudo aqui é protegido: em dúvida,
// o hook não decide nada e a ferramenta segue o fluxo normal de permissão.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function negar(motivo) {
  process.stdout.write(JSON.stringify({ permissionDecision: 'deny', permissionDecisionReason: `HenriSpec: ${motivo}` }));
  process.exit(0);
}

function textos(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => textos(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => textos(x, out));
  return out;
}

try {
  const entrada = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const ferramenta = String(entrada.toolName ?? entrada.tool_name ?? '');
  let args = entrada.toolArgs ?? entrada.tool_input ?? {};
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      /* argumento em texto: segue como texto */
    }
  }
  const cwd = entrada.cwd || process.cwd();
  if (!existsSync(join(cwd, '.sdd'))) process.exit(0);
  if (/henrispec/i.test(ferramenta)) process.exit(0);

  const texto = textos(args).join('\n').replace(/\\/g, '/');
  const escrita = /edit|create|write|patch|replace|insert|delete|remove|rename|move/i.test(ferramenta);
  const terminal = /bash|powershell|shell|terminal|execute|run_in|runin/i.test(ferramenta);
  const veredito = /\.sdd\/changes\/[^\s"'`]*\/revisao\//;
  const arquivo = /\.sdd\/changes\/archive\//;
  const escreveNoTerminal = /(>|\brm\b|\bmv\b|\bcp\b|sed\s+-i|\btee\b|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|\bdel\b)/i;

  if (escrita && veredito.test(texto)) {
    negar('veredito é gravado só pela ferramenta henrispec/gravar_veredito, e nunca editado.');
  }
  if (escrita && arquivo.test(texto)) negar('mudança arquivada é registro de auditoria: não se edita.');
  if (terminal && (veredito.test(texto) || arquivo.test(texto)) && escreveNoTerminal.test(texto)) {
    negar('o terminal não escreve em vereditos nem em mudanças arquivadas.');
  }

  const cfgPath = join(cwd, '.sdd', 'henrispec.json');
  if (terminal && existsSync(cfgPath)) {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const gitEscreve = /\bgit\s+(-\S+\s+)*(commit|push|merge|rebase|reset|cherry-pick|revert|tag|checkout\s+-b|switch\s+(-c|--create)|branch\s+(-[dDmM]|--delete|--move))\b/;
    if (cfg.bloquearGitNoAgente === true && gitEscreve.test(texto)) {
      negar('o fluxo não escreve no Git. Revise o diff e commite você mesmo.');
    }
  }
} catch {
  /* sem decisão */
}
process.exit(0);
