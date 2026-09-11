#!/usr/bin/env node
// harness-metricas — CLI. Tudo que não é coleta acontece aqui, com zero token de LLM.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { RAIZ, VERSAO_COLETOR, carregarTudo, compilarToolkits } from '../lib/config.mjs';
import { projetar, dataLocal } from '../lib/projecao.mjs';
import { agregarConversas, arquivosOtel, inventarioAtributos, lerOtel } from '../lib/otel.mjs';
import { gerarDashboard } from '../lib/dashboard.mjs';
import { narrativaParaHtml, resumoNarrativa, validarNarrativa } from '../lib/narrativa.mjs';
import { gerarDemo } from '../lib/demo.mjs';

const EVENTOS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact', 'SubagentStart', 'SubagentStop', 'Stop'];

function argumentos(argv) {
  const pos = [];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      op[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    } else pos.push(a);
  }
  return { pos, op };
}

const hoje = () => dataLocal(Date.now());
const AJUDA = `harness-metricas v${VERSAO_COLETOR}

  hm instalar [--workspace <repo>] [--forcar]   escreve o arquivo de hooks e imprime a config do OTel
  hm diagnostico                                 checa coleta, OTel, correlação e config (rode isso no spike)
  hm estimar <atividade> <horas> [--nota "…"]    registra a estimativa CEGA antes de executar
  hm concluir <atividade>                        marca atividade concluída fora do fluxo SDD
  hm vincular <sessao_id> <atividade>            corrige o vínculo de uma sessão
  hm ignorar <sessao_id>                         exclui uma sessão das métricas
  hm pendencias [--de …] [--ate …]               o que falta para o painel ficar honesto
  hm guardar-otel                                arquiva o JSONL do OTel (protege contra truncamento)
  hm build [--de AAAA-MM-DD] [--ate …] [--saida <dir>] [--abrir]
  hm demo [--saida <dir>]                        gera dados sintéticos e um dashboard de exemplo

Variáveis: HARNESS_METRICAS_DADOS, HARNESS_METRICAS_CONFIG, HARNESS_METRICAS_GUARDRAILS`;

function gravarLinha(arquivo, obj) {
  mkdirSync(dirname(arquivo), { recursive: true });
  appendFileSync(arquivo, `${JSON.stringify(obj)}\n`);
}

// ───────────────────────── instalar ─────────────────────────
function instalar(cfg, op) {
  const hook = join(RAIZ, 'bin', 'hook.mjs');
  const comando = `node "${hook}"`;
  const conteudo = { hooks: Object.fromEntries(EVENTOS.map((e) => [e, [{ type: 'command', command: comando, timeout: e === 'Stop' ? 15 : 10 }]])) };
  const destino = op.workspace
    ? join(resolve(String(op.workspace)), '.github', 'hooks', 'harness-metricas.json')
    : join(process.env.HOME || process.env.USERPROFILE || RAIZ, '.copilot', 'hooks', 'harness-metricas.json');
  if (existsSync(destino) && !op.forcar) {
    console.log(`Já existe: ${destino}\nUse --forcar para sobrescrever.`);
  } else {
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, `${JSON.stringify(conteudo, null, 2)}\n`);
    console.log(`Hooks escritos em: ${destino}`);
  }
  const otel = join(cfg.dados, 'otel', 'copilot-otel.jsonl');
  console.log(`
Pasta de dados: ${cfg.dados}

1) OTel do Copilot (é daqui que vêm tokens e custo). Escolha UM caminho:

   settings.json do USUÁRIO:
     "github.copilot.chat.otel.enabled": true,
     "github.copilot.chat.otel.exporterType": "file",
     "github.copilot.chat.otel.outfile": ${JSON.stringify(otel)},
     "github.copilot.chat.otel.captureContent": false

   ou variáveis de ambiente (Windows, uma vez, e reabra o VS Code):
     setx COPILOT_OTEL_ENABLED true
     setx COPILOT_OTEL_FILE_EXPORTER_PATH "${otel.replace(/\//g, '\\')}"

   captureContent FICA EM false: com true, prompt e conteúdo de arquivo do banco vão para disco.

2) Contrato opcional para os hooks de guarda já existentes (guard-invariants e afins):
     setx HARNESS_METRICAS_GUARDRAILS "${join(cfg.dados, 'guardrails.jsonl').replace(/\//g, '\\')}"
   O hook de guarda só precisa acrescentar uma linha JSON nesse arquivo quando decidir deny/ask.
   Formato em schemas/guardrail-evento.schema.json. Sem a variável, ele não faz nada.

3) Agente da narrativa: copie agents/metricas-narrador.agent.md para ~/.copilot/agents/.
${op.workspace ? `
ATENÇÃO: hooks de workspace têm precedência sobre os de usuário para o mesmo evento.
Não commite .github/hooks/harness-metricas.json. Adicione ao .git/info/exclude do repo.` : `
Se este repositório já tiver .github/hooks/*.json, rode também:
  node bin/hm.mjs instalar --workspace <caminho-do-repo>
porque hooks de workspace têm precedência sobre os de usuário para o mesmo evento.`}

Depois de uma sessão real no VS Code: node bin/hm.mjs diagnostico`);
}

// ───────────────────────── diagnóstico ─────────────────────────
async function diagnostico(cfg) {
  const comp = compilarToolkits(cfg.toolkits, cfg.parametros);
  const { carregarEventos } = await import('../lib/projecao.mjs');
  const porSessao = carregarEventos(cfg.dados);
  const contagem = {};
  const ferramentas = {};
  const categorias = {};
  const resTerminal = {};
  const comandos = {};
  let total = 0;
  let fallback = 0;
  const hookMs = [];
  for (const evs of porSessao.values()) {
    for (const e of evs) {
      total++;
      contagem[e.ev] = (contagem[e.ev] || 0) + 1;
      if (e.sid_origem === 'fallback') fallback++;
      if (e.hook_ms != null) hookMs.push(e.hook_ms);
      if (e.tool) { ferramentas[e.tool] = (ferramentas[e.tool] || 0) + 1; categorias[e.cat] = (categorias[e.cat] || 0) + 1; }
      if (e.term && e.res) resTerminal[`${e.term}:${e.res}`] = (resTerminal[`${e.term}:${e.res}`] || 0) + 1;
      if (e.cmd) comandos[e.cmd] = (comandos[e.cmd] || 0) + 1;
    }
  }
  const p = (xs, q) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((q / 100) * xs.length) - 1)] : null);
  console.log(`# Coleta (hooks)
pasta de dados      ${cfg.dados}
sessões             ${porSessao.size}
eventos             ${total}
sessões sem ID      ${fallback} (session_id ausente no payload do hook)
overhead do coletor p50 ${p(hookMs, 50) ?? '—'} ms · p95 ${p(hookMs, 95) ?? '—'} ms

eventos por tipo:`);
  for (const ev of EVENTOS) console.log(`  ${ev.padEnd(18)} ${contagem[ev] || 0}${contagem[ev] ? '' : '   <-- nenhum: hook não está rodando para este evento'}`);
  console.log(`
# Detecção
comandos vistos     ${Object.keys(comandos).length ? Object.entries(comandos).map(([k, v]) => `${k}(${v})`).join(' ') : 'NENHUM — o prompt não chega com /comando no payload? Use agentes/arquivos como gatilho.'}
categorias          ${Object.entries(categorias).map(([k, v]) => `${k}=${v}`).join(' ') || '—'}
resultado terminal  ${Object.entries(resTerminal).map(([k, v]) => `${k}=${v}`).join(' ') || '—'}${Object.keys(resTerminal).some((k) => k.endsWith('desconhecido')) ? '\n                    ^ ajuste resultado_terminal em toolkits.json para reconhecer a saída real' : ''}

ferramentas (top 15, categoria entre parênteses):`);
  const { categoriaFerramenta } = await import('../lib/config.mjs');
  for (const [nome, n] of Object.entries(ferramentas).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    const cat = categoriaFerramenta(comp, nome);
    console.log(`  ${nome.padEnd(34)} ${String(n).padStart(5)}  ${cat}${cat === 'outra' ? '  <-- sem categoria: ajuste categorias_ferramenta' : ''}`);
  }

  const arqs = arquivosOtel(cfg.dados, cfg.parametros.otel?.arquivos);
  const otel = await lerOtel(arqs);
  console.log(`
# OpenTelemetry
arquivos            ${arqs.length ? arqs.map((a) => basename(a)).join(', ') : 'NENHUM — tokens e custo ficarão zerados'}
linhas / inválidas  ${otel.linhas} / ${otel.invalidas}${otel.duplicados ? ` · ${otel.duplicados} spans duplicados ignorados` : ''}
spans               ${otel.spans.length}`);
  if (otel.spans.length) {
    const { conversas, inputIncluiCache } = agregarConversas(otel.spans, {
      inputIncluiCache: cfg.parametros.otel?.input_inclui_cache ?? 'auto',
      atributosDecisao: cfg.toolkits.otel?.atributos_decisao_hook,
      atributosNomeHook: cfg.toolkits.otel?.atributos_nome_hook,
    });
    const ids = new Set(porSessao.keys());
    const casadas = conversas.filter((c) => ids.has(c.id)).length;
    const modelos = new Set();
    for (const c of conversas) for (const m of Object.keys(c.modelos)) modelos.add(m);
    const semPreco = [...modelos].filter((m) => !cfg.precos.modelos.some((x) => new RegExp(x.padrao, 'i').test(m)));
    console.log(`conversas           ${conversas.length}
conversation.id = session_id  ${casadas}/${conversas.length} ${casadas === conversas.length ? '(correlação direta: ótimo)' : '(o resto cai na correlação por horário)'}
input inclui cache  ${inputIncluiCache} (detecção ${cfg.parametros.otel?.input_inclui_cache})
modelos             ${[...modelos].join(', ') || '—'}
modelos sem preço   ${semPreco.join(', ') || 'nenhum'}
hooks com decisão   ${conversas.reduce((a, c) => a + c.hooks.filter((h) => h.decisao).length, 0)} de ${conversas.reduce((a, c) => a + c.hooks.length, 0)} spans execute_hook`);
    const inv = inventarioAtributos(otel.spans);
    console.log('\natributos por tipo de span (use isto para ajustar toolkits.json > otel):');
    for (const [op, e] of Object.entries(inv)) {
      console.log(`  ${op} (${e.spans} spans)`);
      for (const [a, n] of Object.entries(e.atributos).sort((x, y) => y[1] - x[1])) console.log(`     ${a}  ${n}`);
    }
    const metricas = [...otel.metricas.keys()];
    if (metricas.length) console.log(`\nmétricas encontradas: ${metricas.join(', ')}`);
  }

  console.log(`
# Config
calibração          ${cfg.calibracao.versao} por ${cfg.calibracao.calibrado_por}${/placeholder|AJUSTE/i.test(`${cfg.calibracao.versao}${cfg.calibracao.calibrado_por}`) ? '  <-- ainda não calibrada pela squad' : ''}
preços              ${cfg.precos.fonte} (consultado em ${cfg.precos.consultado_em})
cotação BRL         ${cfg.parametros.moeda?.cotacao_usd_brl ?? 'não configurada (painel fica só em dólar)'}
ajustes pendentes   ${JSON.stringify(cfg.toolkits).match(/AJUSTE/g)?.length ?? 0} marcadores AJUSTE em toolkits.json`);
  const erros = join(cfg.dados, 'erros-hook.log');
  if (existsSync(erros)) {
    const linhas = readFileSync(erros, 'utf8').trim().split('\n');
    console.log(`\n# Erros do coletor (${linhas.length}); últimos 5:`);
    for (const l of linhas.slice(-5)) console.log(`  ${l}`);
  }
}

// ───────────────────────── build ─────────────────────────
async function build(cfg, op) {
  const de = op.de ? String(op.de) : null;
  const ate = op.ate ? String(op.ate) : null;
  const dados = await projetar(cfg, { de, ate, demo: Boolean(op.demo) });
  const saida = resolve(op.saida ? String(op.saida) : join(cfg.dados, 'relatorios', hoje()));
  mkdirSync(saida, { recursive: true });
  writeFileSync(join(saida, 'dados.json'), `${JSON.stringify(dados, null, 1)}\n`);
  const resumo = resumoNarrativa(dados);
  writeFileSync(join(saida, 'resumo-narrativa.json'), `${JSON.stringify(resumo, null, 1)}\n`);

  let narrativaHtml = '';
  let recusada = null;
  const arqNarr = join(saida, 'narrativa.md');
  if (existsSync(arqNarr)) {
    const md = readFileSync(arqNarr, 'utf8');
    const v = validarNarrativa(md, resumo);
    if (v.ok) narrativaHtml = narrativaParaHtml(md);
    else recusada = v.erros;
  }
  const html = gerarDashboard(dados, { narrativaHtml });
  const arqHtml = join(saida, 'dashboard.html');
  writeFileSync(arqHtml, html);

  const k = dados.kpi;
  console.log(`dashboard   ${arqHtml}
dados       ${join(saida, 'dados.json')}
período     ${dados.periodo.de ?? '—'} → ${dados.periodo.ate ?? '—'}  (${k.sessoes} sessões, ${dados.atividades.length} atividades)
economia    ${k.horas_economizadas ?? '—'} h em ${k.atividades_com_ganho} atividades concluídas · fator ${k.fator_produtividade ?? '—'}×
custo       US$ ${k.custo_usd ?? 0} (${k.creditos ?? 0} créditos) · guard-rails ${k.guardrails_acionados}`);
  if (!dados.cobertura.otel_disponivel) console.log('\nATENÇÃO: nenhum span OTel. Tokens e custo estão zerados — rode "hm diagnostico".');
  if (dados.pendencias.calibracao_placeholder) console.log('ATENÇÃO: calibracao.json ainda tem valores de exemplo. O painel avisa isso no topo.');
  if (recusada) {
    console.log(`\nNarrativa RECUSADA (${recusada.length} problemas) — o dashboard saiu sem ela:`);
    for (const e of recusada) console.log(`  - ${e}`);
    console.log('Corrija narrativa.md e rode o build de novo.');
  } else if (!narrativaHtml) {
    console.log(`\nPara a leitura executiva: no Copilot Chat, com o agente metricas-narrador,
  #readFile ${join(saida, 'resumo-narrativa.json')}
e depois rode o build novamente (o dashboard embute narrativa.md validada).`);
  }
  return { saida, recusada };
}

// ───────────────────────── main ─────────────────────────
const { pos, op } = argumentos(process.argv.slice(2));
const comando = pos[0] || 'ajuda';

if (comando === 'demo') {
  const dadosDir = resolve(op.saida ? String(op.saida) : join(RAIZ, 'dados-demo'));
  const r = gerarDemo(dadosDir);
  const cfg = carregarTudo({ dadosDir });
  console.log(`Dados sintéticos: ${r.sessoes} sessões, ${r.estimativas} estimativas em ${dadosDir}\n`);
  const saidaDemo = join(dadosDir, 'relatorio');
  const exemploNarrativa = join(RAIZ, 'exemplos', 'narrativa-demo.md');
  if (existsSync(exemploNarrativa)) {
    mkdirSync(saidaDemo, { recursive: true });
    copyFileSync(exemploNarrativa, join(saidaDemo, 'narrativa.md'));
  }
  const { saida } = await build(cfg, { ...op, saida: saidaDemo, demo: true });
  console.log(`\nDemonstração pronta em ${saida}`);
} else if (comando === 'ajuda' || op.h || op.ajuda) {
  console.log(AJUDA);
} else {
  const cfg = carregarTudo();
  switch (comando) {
    case 'instalar': instalar(cfg, op); break;
    case 'diagnostico': await diagnostico(cfg); break;
    case 'estimar': {
      const [, atividade, horas] = pos;
      const h = Number(String(horas ?? '').replace(',', '.'));
      if (!atividade || !Number.isFinite(h) || h <= 0) { console.error('uso: hm estimar <atividade> <horas> [--nota "…"]'); process.exit(1); }
      gravarLinha(join(cfg.dados, 'estimativas.jsonl'), { v: 1, t: new Date().toISOString(), atividade, horas: h, origem: 'cli', nota: typeof op.nota === 'string' ? op.nota : null });
      console.log(`Estimativa sem IA registrada: ${atividade} = ${h} h.
Ela só conta como CEGA se nenhuma sessão desta atividade tiver editado código ainda.`);
      break;
    }
    case 'concluir': {
      const [, atividade] = pos;
      if (!atividade) { console.error('uso: hm concluir <atividade>'); process.exit(1); }
      gravarLinha(join(cfg.dados, 'conclusoes.jsonl'), { v: 1, t: new Date().toISOString(), atividade });
      console.log(`${atividade} marcada como concluída.`);
      break;
    }
    case 'vincular':
    case 'ignorar': {
      const arq = join(cfg.dados, 'vinculos.json');
      const atual = existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : { sessoes: {}, ignorar: [] };
      atual.sessoes ||= {};
      atual.ignorar ||= [];
      if (comando === 'vincular') {
        const [, sid, atividade] = pos;
        if (!sid || !atividade) { console.error('uso: hm vincular <sessao_id> <atividade>'); process.exit(1); }
        atual.sessoes[sid] = atividade;
        console.log(`Sessão ${sid} vinculada a ${atividade}.`);
      } else {
        const [, sid] = pos;
        if (!sid) { console.error('uso: hm ignorar <sessao_id>'); process.exit(1); }
        if (!atual.ignorar.includes(sid)) atual.ignorar.push(sid);
        console.log(`Sessão ${sid} será ignorada nas métricas.`);
      }
      mkdirSync(dirname(arq), { recursive: true });
      writeFileSync(arq, `${JSON.stringify(atual, null, 2)}\n`);
      break;
    }
    case 'guardar-otel': {
      const arqs = arquivosOtel(cfg.dados, ['otel/*.jsonl']);
      if (!arqs.length) { console.log('Nenhum arquivo OTel em otel/.'); break; }
      const destinoDir = join(cfg.dados, 'otel', 'historico');
      mkdirSync(destinoDir, { recursive: true });
      const marca = new Date().toISOString().replace(/[:.]/g, '-');
      for (const a of arqs) {
        const destino = join(destinoDir, `${marca}-${basename(a)}`);
        copyFileSync(a, destino);
        console.log(`Arquivado: ${destino}`);
      }
      console.log('Spans repetidos entre arquivo ativo e histórico são deduplicados no build.');
      break;
    }
    case 'pendencias': {
      const d = await projetar(cfg, { de: op.de ? String(op.de) : null, ate: op.ate ? String(op.ate) : null });
      const p = d.pendencias;
      const linhas = [
        ['calibração com valores de exemplo', p.calibracao_placeholder ? 'sim — calibre config/calibracao.json' : 'não'],
        ['atividades sem estimativa cega', p.sem_estimativa.join(', ') || 'nenhuma'],
        ['estimativas registradas tarde', p.estimativa_nao_cega.join(', ') || 'nenhuma'],
        ['estimativas divergentes', p.divergentes.join(', ') || 'nenhuma'],
        ['estimativas sem atividade', p.estimativas_sem_atividade.map((e) => `${e.atividade} (${e.horas} h)`).join(', ') || 'nenhuma'],
        ['sessões sem atividade', String(p.sessoes_sem_atividade)],
        ['modelos sem preço', p.modelos_sem_preco.join(', ') || 'nenhum'],
        ['conversas OTel órfãs', String(d.cobertura.correlacao.orfas)],
        ['correlação ambígua', String(d.cobertura.correlacao.ambigua)],
      ];
      for (const [k, v] of linhas) console.log(`${k.padEnd(34)} ${v}`);
      if (d.sessoes_sem_atividade.length) {
        console.log('\nsessões sem atividade (id · etapa · data · custo):');
        for (const s of d.sessoes_sem_atividade) console.log(`  ${s.id}  ${s.passo}  ${dataLocal(s.inicio)}  US$ ${s.usd ?? 0}`);
      }
      break;
    }
    case 'build': await build(cfg, op); break;
    default:
      console.log(AJUDA);
      process.exit(1);
  }
}
