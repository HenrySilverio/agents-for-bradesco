#!/usr/bin/env node
// harness-metricas — ponto de entrada dos hooks do Copilot (todos os eventos).
// Observador puro: sempre exit 0 e stdout "{}". Ver lib/coletor.mjs.
const t0 = performance.now();

function lerStdin() {
  return new Promise((ok) => {
    let buf = '';
    let feito = false;
    const fim = () => { if (!feito) { feito = true; ok(buf); } };
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => {
        buf += c;
        // Não depende do 'end': se o JSON já está completo, segue. Evita esperar stdin que não fecha.
        try { JSON.parse(buf); fim(); } catch { /* ainda incompleto */ }
      });
      process.stdin.on('end', fim);
      process.stdin.on('error', fim);
    } catch { fim(); }
    setTimeout(fim, 2000);
  });
}

function sair() {
  const encerrar = () => process.exit(0);
  setTimeout(encerrar, 500);
  try { process.stdout.write('{}', encerrar); } catch { encerrar(); }
}

try {
  const bruto = await lerStdin();
  const { processarPayload } = await import('../lib/coletor.mjs');
  processarPayload(bruto, { t0 });
} catch {
  // nada: o coletor nunca pode atrapalhar a sessão
} finally {
  sair();
}
