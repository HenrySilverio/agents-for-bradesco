// Gerador de dados SINTÉTICOS para demonstração e teste de ponta a ponta.
// Escreve no mesmo formato do coletor (eventos) e do exportador OTel (OTLP/JSON), então o build
// real processa estes dados pelo mesmo caminho dos dados de produção.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function criarRng(semente) {
  let s = semente >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const REPO_MFE = 'recr-fed-agc-posvenda';
const REPO_SHELL = 'cockpit-renegociacao-shell';

const MODELO_POR_PASSO = {
  'discovery-rota': 'gpt-5-mini',
  'discovery-triagem': 'claude-sonnet-5',
  'discovery-grill': 'claude-sonnet-5',
  'discovery-prototipo': 'gemini-3.6-flash',
  'sdd-plan': 'claude-sonnet-5',
  'sdd-implement': 'claude-haiku-4.5',
  'sdd-review': 'claude-haiku-4.5',
  'sdd-archive': 'claude-haiku-4.5',
  'design-to-code-liquid': 'claude-sonnet-5',
  livre: 'gpt-5.4',
};

const BASE_TOKENS = {
  'discovery-rota': [8000, 12000], 'discovery-triagem': [18000, 38000], 'discovery-grill': [15000, 42000],
  'discovery-prototipo': [22000, 55000], 'sdd-plan': [38000, 72000], 'sdd-implement': [45000, 115000],
  'sdd-review': [30000, 62000], 'sdd-archive': [25000, 45000], 'design-to-code-liquid': [52000, 125000], livre: [9000, 28000],
};

export function gerarDemo(dadosDir) {
  rmSync(dadosDir, { recursive: true, force: true });
  for (const d of ['eventos', 'otel']) mkdirSync(join(dadosDir, d), { recursive: true });
  const rng = criarRng(20260911);
  const entre = (a, b) => a + (b - a) * rng();
  const inteiro = (a, b) => Math.round(entre(a, b));
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join('');
  const iso = (ms) => new Date(ms).toISOString();
  const nanos = (ms) => `${Math.round(ms)}000000`;

  const eventos = new Map();
  const otelLinhas = [];
  const estimativas = [];
  const guardrails = [];
  const conclusoes = [];
  let seq = 0;

  const emitir = (sid, e) => { if (!eventos.has(sid)) eventos.set(sid, []); eventos.get(sid).push({ v: 1, sid, hook_ms: Math.round(entre(22, 58) * 10) / 10, ...e }); };
  const quando = (dia, hora) => Date.parse(`${dia}T${hora}:00-03:00`);

  function sessao(o) {
    const sid = o.sid || `vscode-chat-${String(++seq).padStart(3, '0')}-${hex(6)}`;
    const cmd = o.passo === 'livre' ? null : o.passo;
    const inicio = quando(o.dia, o.hora);
    const head = hex(40);
    const semHook = o.semHook === true;
    const tiposTool = [];
    let t = inicio;
    if (!semHook) {
      emitir(sid, { t: iso(t), ev: 'SessionStart', repo: o.repo || REPO_MFE, origem: 'new', git: { branch: o.branch, head } });
      t += 5000;
      emitir(sid, { t: iso(t), ev: 'UserPromptSubmit', cmd, tickets: o.ticketPrompt ? [o.ticketPrompt] : [], estimativa_h: o.estimativaPrompt ?? null, chars: inteiro(80, 420) });
    }
    const nTools = Math.max(6, Math.round(o.ativoMin / 2.2));
    const passoMs = (o.ativoMin * 60000) / nTools;
    const especiais = new Map();
    const agendar = (frac, acao) => {
      let i = Math.min(nTools - 1, Math.max(0, Math.floor(frac * nTools)));
      while (especiais.has(i)) i = (i + 1) % nTools;
      especiais.set(i, acao);
    };
    (o.acoes || []).forEach(([frac, acao]) => agendar(frac, acao));
    const editados = new Set();
    let adicionadas = 0;
    let removidas = 0;
    for (let i = 0; i < nTools; i++) {
      t += passoMs * entre(0.6, 1.4);
      if (o.pausaLonga && i === Math.floor(nTools / 2)) t += 48 * 60000;
      if (semHook) continue;
      const acao = especiais.get(i);
      const id = `tool-${hex(8)}`;
      const fimTool = t + entre(400, 4200);
      if (acao) {
        const pre = { t: iso(t), ev: 'PreToolUse', tool: acao.tool, id, cat: acao.cat, term: acao.term ?? null, paths: acao.paths || [], contrato: Boolean(acao.contrato) };
        if (acao.cat === 'edicao') pre.novos = acao.novo ? [...(acao.paths || [])] : [];
        emitir(sid, pre);
        if (acao.cat === 'edicao') for (const p of acao.paths || []) { editados.add(p); adicionadas += inteiro(8, 120); removidas += acao.novo ? 0 : inteiro(0, 30); }
        if (acao.interrompida) continue;
        const post = { t: iso(fimTool), ev: 'PostToolUse', tool: acao.tool, id, cat: acao.cat, term: acao.term ?? null };
        if (acao.term) post.res = acao.res || 'sucesso';
        if (acao.sondas) post.sondas = acao.sondas.map((s) => ({ op: acao.cat, ...s }));
        emitir(sid, post);
        tiposTool.push(acao.tool);
        continue;
      }
      const leitura = i < nTools * 0.35 || rng() < 0.45 || !o.editaCodigo;
      const tool = leitura ? (rng() < 0.6 ? 'readFile' : 'textSearch') : (rng() < 0.7 ? 'replaceString' : 'editFiles');
      const cat = leitura ? 'leitura' : 'edicao';
      const paths = leitura
        ? [`src/app/features/${o.modulo || 'renegociacao'}/${['store', 'service', 'page', 'mapper'][inteiro(0, 3)]}.ts`]
        : [`src/app/features/${o.modulo || 'renegociacao'}/${['store', 'service', 'page', 'mapper'][inteiro(0, 3)]}.ts`];
      const pre = { t: iso(t), ev: 'PreToolUse', tool, id, cat, term: null, paths, contrato: false };
      if (cat === 'edicao') { pre.novos = []; for (const p of paths) editados.add(p); adicionadas += inteiro(2, 40); removidas += inteiro(0, 15); }
      emitir(sid, pre);
      emitir(sid, { t: iso(fimTool), ev: 'PostToolUse', tool, id, cat, term: null });
      tiposTool.push(tool);
    }
    const fim = t + 20000;
    if (!semHook && o.ativoMin >= 200) emitir(sid, { t: iso(inicio + (fim - inicio) * 0.7), ev: 'PreCompact', gatilho: 'auto' });
    if (!semHook) emitir(sid, { t: iso(fim), ev: 'Stop', git: { branch: o.branch, head, diff: { arquivos: editados.size, adicionadas, removidas } } });

    // OTel: um invoke_agent por prompt, spans chat com uso de tokens, execute_hook ocasional
    const traceId = hex(32);
    const raiz = hex(16);
    const modelo = o.modelo || MODELO_POR_PASSO[o.passo];
    const [b0, b1] = BASE_TOKENS[o.passo];
    const nChat = Math.max(3, Math.round(o.ativoMin / 3.5));
    const conv = o.conversa || sid;
    const kv = (k, v) => ({ key: k, value: typeof v === 'number' ? (Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v }) : { stringValue: String(v) } });
    const spans = [];
    let entradaAgente = 0;
    let saidaAgente = 0;
    for (let c = 0; c < nChat; c++) {
      const tc = inicio + ((fim - inicio) * (c + 0.5)) / nChat;
      const entrada = Math.round(b0 + (b1 - b0) * (c / nChat) + entre(-2500, 2500));
      const cacheLeitura = c === 0 ? 0 : Math.round(entrada * entre(0.68, 0.86));
      const cacheEscrita = Math.round(entrada * entre(0.03, 0.09));
      const saida = inteiro(o.passo === 'sdd-plan' || o.passo === 'design-to-code-liquid' ? 900 : 250, o.passo === 'sdd-plan' ? 3200 : 1900);
      entradaAgente += entrada;
      saidaAgente += saida;
      spans.push({
        traceId, spanId: hex(16), parentSpanId: raiz, name: `chat ${modelo}`, kind: 3,
        startTimeUnixNano: nanos(tc), endTimeUnixNano: nanos(tc + entre(4000, 26000)),
        attributes: [
          kv('gen_ai.operation.name', 'chat'), kv('gen_ai.provider.name', 'github'), kv('gen_ai.conversation.id', conv),
          kv('gen_ai.request.model', modelo), kv('gen_ai.response.model', modelo),
          kv('gen_ai.usage.input_tokens', entrada), kv('gen_ai.usage.output_tokens', saida),
          kv('gen_ai.usage.cache_read.input_tokens', cacheLeitura), kv('gen_ai.usage.cache_creation.input_tokens', cacheEscrita),
          kv('copilot_chat.time_to_first_token', inteiro(450, 2400)), kv('copilot_chat.debug_name', 'agentMode'),
        ],
        status: { code: 1 },
      });
    }
    for (let h = 0; h < Math.min(4, tiposTool.length); h++) {
      const th = inicio + ((fim - inicio) * (h + 1)) / 5;
      spans.push({
        traceId, spanId: hex(16), parentSpanId: raiz, name: 'execute_hook PreToolUse',
        startTimeUnixNano: nanos(th), endTimeUnixNano: nanos(th + 40),
        attributes: [kv('gen_ai.operation.name', 'execute_hook'), kv('gen_ai.conversation.id', conv), kv('copilot_chat.hook.event', 'PreToolUse')],
      });
    }
    spans.unshift({
      traceId, spanId: raiz, name: `invoke_agent ${o.agente || 'copilot'}`,
      startTimeUnixNano: nanos(inicio), endTimeUnixNano: nanos(fim),
      attributes: [
        kv('gen_ai.operation.name', 'invoke_agent'), kv('gen_ai.provider.name', 'github'), kv('gen_ai.agent.name', o.agente || 'copilot'),
        kv('gen_ai.conversation.id', conv), kv('gen_ai.request.model', modelo), kv('gen_ai.response.model', modelo),
        kv('gen_ai.usage.input_tokens', entradaAgente), kv('gen_ai.usage.output_tokens', saidaAgente), kv('copilot_chat.turn_count', nChat),
      ],
    });
    otelLinhas.push(JSON.stringify({
      resourceSpans: [{
        resource: { attributes: [kv('service.name', 'copilot-chat'), kv('service.version', '0.40.0')] },
        scopeSpans: [{ scope: { name: 'copilot-chat' }, spans }],
      }],
    }));
    (o.guardrails || []).forEach(([regra, decisao, categoria, alvo]) => {
      guardrails.push({ v: 1, t: iso(inicio + (fim - inicio) * entre(0.3, 0.9)), sid, hook: 'guard-invariants', regra, decisao, categoria, alvo_tipo: alvo });
    });
    return { sid, inicio, fim };
  }

  // ───── ações reutilizáveis ─────
  const mud = (slug) => `.sdd/mudancas/${slug}`;
  const aProposta = (slug, ticket, branch, cat = 'leitura') => ({
    tool: cat === 'edicao' ? 'createFile' : 'readFile', cat, paths: [`${mud(slug)}/proposta.md`], novo: cat === 'edicao',
    sondas: [{ id: 'sdd.proposta', path: `${mud(slug)}/proposta.md`, campos: { mudanca: slug, ticket, branch } }],
  });
  const aTarefas = (slug, fatias, cat = 'leitura', concluidas = 0) => ({
    tool: cat === 'edicao' ? 'createFile' : 'readFile', cat, paths: [`${mud(slug)}/tarefas.md`], novo: cat === 'edicao',
    sondas: [{ id: 'sdd.tarefas', path: `${mud(slug)}/tarefas.md`, campos: { mudanca: slug, fatias, concluidas, pendentes: Math.max(0, fatias * 3 - concluidas) } }],
  });
  const aBriefing = (slug, lacunas, cat, ticket) => ({
    tool: cat === 'edicao' ? 'createFile' : 'readFile', cat, paths: [`docs/briefings/${slug}.md`], novo: cat === 'edicao',
    sondas: [{ id: 'discovery.briefing', path: `docs/briefings/${slug}.md`, campos: { slug, nao_respondido: lacunas, ...(ticket ? { ticket } : {}) } }],
  });
  const aVeredito = (slug, eixo, veredito) => {
    const commit = hex(7);
    return {
      tool: 'createFile', cat: 'edicao', novo: true, paths: [`${mud(slug)}/revisao/${eixo}-${commit}.md`],
      sondas: [{ id: 'sdd.veredito', path: `${mud(slug)}/revisao/${eixo}-${commit}.md`, campos: { mudanca: slug, eixo, commit, veredito } }],
    };
  };
  const aSpec = (modulo, nome) => ({ tool: 'createFile', cat: 'edicao', novo: true, paths: [`src/app/features/${modulo}/${nome}.spec.ts`] });
  const aTeste = (res = 'sucesso') => ({ tool: 'runInTerminal', cat: 'terminal', term: 'teste', res });
  const aValidador = (res = 'sucesso') => ({ tool: 'runInTerminal', cat: 'terminal', term: 'validador_sdd', res });
  const aLint = (res = 'sucesso') => ({ tool: 'runInTerminal', cat: 'terminal', term: 'lint', res });
  const aContrato = () => ({ tool: 'replaceString', cat: 'edicao', contrato: true, paths: ['federation.config.js'] });
  const aGit = (interrompida) => ({ tool: 'runInTerminal', cat: 'terminal', term: 'git_escrita', res: 'sucesso', interrompida });
  const aDecisao = (slug) => ({ tool: 'createFile', cat: 'edicao', novo: true, paths: [`.sdd/decisoes/${slug}.md`] });
  const aFigma = () => ({ tool: 'mcp_figma_get_design_context', cat: 'mcp' });
  const aComponente = (modulo, nome, pagina = false, liquid = 16, css = 4) => {
    const base = `src/app/features/${modulo}/${pagina ? 'pages/' : 'components/'}${nome}/${nome}.component`;
    return [
      { tool: 'createFile', cat: 'edicao', novo: true, paths: [`${base}.ts`] },
      { tool: 'createFile', cat: 'edicao', novo: true, paths: [`${base}.html`], sondas: [{ id: 'd2c.template', path: `${base}.html`, campos: { liquid_elementos: liquid, liquid_classes: Math.round(liquid * 1.6) } }] },
      { tool: 'createFile', cat: 'edicao', novo: true, paths: [`${base}.scss`], sondas: [{ id: 'd2c.estilo', path: `${base}.scss`, campos: { declaracoes_css: css } }] },
    ];
  };
  const est = (atividade, horas, dia, hora, nota) => estimativas.push({ v: 1, t: iso(quando(dia, hora)), atividade, horas, origem: 'cli', nota: nota ?? null });

  // Fluxo SDD completo, com opções. Retorna nada; datas explícitas.
  function fluxoSdd(c) {
    const b = c.branch;
    const slug = c.slug;
    const m = c.modulo;
    sessao({ repo: c.repo, dia: c.dias[0], hora: '09:40', passo: 'sdd-plan', ativoMin: c.min[0], branch: c.branchPlan || 'develop', ticketPrompt: c.ticket, modulo: m, modelo: c.modeloPlan, estimativaPrompt: c.estimativaPrompt,
      acoes: [...(c.briefing ? [[0.1, aBriefing(c.briefing, c.lacunas ?? 0, 'leitura')]] : []), [0.5, aProposta(slug, c.ticket, b, 'edicao')], [0.8, aTarefas(slug, c.fatias, 'edicao')], [0.9, aValidador(c.validadorPlan || 'sucesso')]] });
    const impls = c.impl;
    impls.forEach((minImpl, k) => {
      const acoes = [[0.05, aProposta(slug, c.ticket, b)], [0.08, aTarefas(slug, c.fatias)]];
      for (let s = 0; s < (c.specs?.[k] ?? 0); s++) acoes.push([0.3 + s * 0.12, aSpec(m, `${slug}-${s + 1}`)]);
      for (const r of c.testes?.[k] || []) acoes.push([0.55 + rng() * 0.35, aTeste(r)]);
      for (const r of c.validador?.[k] || []) acoes.push([0.85 + rng() * 0.1, aValidador(r)]);
      if (c.contrato?.[k]) for (let x = 0; x < c.contrato[k]; x++) acoes.push([0.4 + x * 0.1, aContrato()]);
      if (c.gitExecutado && k === 0) acoes.push([0.95, aGit(false)]);
      if (c.gitInterrompido?.[k]) acoes.push([0.93, aGit(true)]);
      acoes.push([0.7, aLint(rng() < 0.2 ? 'falha' : 'sucesso')]);
      sessao({ repo: c.repo, dia: c.dias[1 + k], hora: k === 0 ? '10:15' : '14:05', passo: 'sdd-implement', ativoMin: minImpl, branch: b, modulo: m, editaCodigo: true, pausaLonga: minImpl > 200,
        modelo: c.modeloImpl?.[k], conversa: c.conversaImpl?.[k], guardrails: c.guard?.[k], acoes });
    });
    let i = 1 + impls.length;
    (c.revisoes || [['APROVADO', 'APROVADO']]).forEach(([spec, padroes], r) => {
      sessao({ repo: c.repo, dia: c.dias[i], hora: '15:20', passo: 'sdd-review', ativoMin: c.min[1 + r], branch: b, modulo: m,
        acoes: [[0.05, aProposta(slug, c.ticket, b)], [0.6, aVeredito(slug, 'spec', spec)], [0.85, aVeredito(slug, 'padroes', padroes)]] });
      i++;
      if (spec === 'REPROVADO' || padroes === 'REPROVADO') {
        sessao({ repo: c.repo, dia: c.dias[i], hora: '09:30', passo: 'sdd-plan', ativoMin: c.replan[0], branch: b, ticketPrompt: c.ticket, modulo: m,
          acoes: [[0.2, aProposta(slug, c.ticket, b)], [0.6, aTarefas(slug, c.fatias + 1, 'edicao', c.fatias * 3)]] });
        sessao({ repo: c.repo, dia: c.dias[i], hora: '11:00', passo: 'sdd-implement', ativoMin: c.replan[1], branch: b, modulo: m, editaCodigo: true,
          acoes: [[0.05, aTarefas(slug, c.fatias + 1)], [0.4, aSpec(m, `${slug}-fix`)], [0.7, aTeste('falha')], [0.8, aTeste('sucesso')], [0.9, aValidador('sucesso')]] });
        i++;
      }
    });
    if (c.arquivar !== false) {
      sessao({ repo: c.repo, dia: c.dias[i], hora: '17:10', passo: 'sdd-archive', ativoMin: c.min[c.min.length - 1], branch: b, modulo: m,
        acoes: [[0.1, aProposta(slug, c.ticket, b)], [0.5, aDecisao(slug)], [0.8, aValidador('sucesso')]] });
    }
  }

  // ───── semana 1 (27/07) ─────
  est('REAB-401', 24, '2026-07-27', '09:05', 'planning poker da squad');
  sessao({ dia: '2026-07-27', hora: '09:20', passo: 'discovery-triagem', ativoMin: 30, branch: 'develop', ticketPrompt: 'REAB-401', modulo: 'acordo', acoes: [[0.8, aBriefing('simulacao-acordo', 2, 'edicao', 'REAB-401')]] });
  fluxoSdd({ ticket: 'REAB-401', slug: 'simulacao-acordo', modulo: 'acordo', branch: 'feature/REAB-401-simulacao-acordo', briefing: 'simulacao-acordo', lacunas: 2, fatias: 4,
    dias: ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30'], min: [55, 35, 15], impl: [240], specs: [3], testes: [['falha', 'sucesso', 'sucesso']], validador: [['falha', 'sucesso']], contrato: [1],
    guard: [[['contrato-federation', 'ask', 'contrato', 'arquivo-contrato']]] });

  est('REAB-415', 12, '2026-07-28', '16:00');
  fluxoSdd({ ticket: 'REAB-415', slug: 'ajuste-juros-mora', modulo: 'parcelas', branch: 'feature/REAB-415-juros-mora', fatias: 2,
    dias: ['2026-07-29', '2026-07-30', '2026-07-31', '2026-07-31'], min: [30, 20, 10], impl: [110], specs: [2], testes: [['sucesso']], validador: [['falha', 'falha', 'sucesso']] });

  // ───── semana 2 (03/08) ─────
  sessao({ dia: '2026-08-03', hora: '09:10', passo: 'discovery-rota', ativoMin: 5, branch: 'develop', ticketPrompt: 'REAB-409', modulo: 'extrato' });
  sessao({ dia: '2026-08-03', hora: '09:30', passo: 'discovery-triagem', ativoMin: 25, branch: 'develop', ticketPrompt: 'REAB-409', modulo: 'extrato', acoes: [[0.8, aBriefing('extrato-parcelas', 1, 'edicao', 'REAB-409')]] });
  fluxoSdd({ ticket: 'REAB-409', slug: 'extrato-parcelas', modulo: 'extrato', branch: 'feature/REAB-409-extrato', briefing: 'extrato-parcelas', lacunas: 1, fatias: 3, estimativaPrompt: 16,
    dias: ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-05'], min: [40, 25, 10], impl: [150], specs: [2], testes: [['sucesso', 'sucesso']], validador: [['sucesso']],
    conversaImpl: [`conv-${hex(12)}`] });
  sessao({ dia: '2026-08-04', hora: '11:30', passo: 'livre', ativoMin: 18, branch: 'develop', modulo: 'extrato', conversa: `conv-${hex(12)}`, modelo: 'gpt-5.4' });

  est('REAB-418', 20, '2026-08-06', '17:30', 'registrada depois de começar');
  fluxoSdd({ ticket: 'REAB-418', slug: 'filtro-carteira', modulo: 'carteira', branch: 'feature/REAB-418-filtro-carteira', fatias: 3,
    dias: ['2026-08-05', '2026-08-06', '2026-08-07', '2026-08-07'], min: [45, 30, 12], impl: [180], specs: [3], testes: [['falha', 'sucesso']], validador: [['sucesso']],
    guard: [[['comando-destrutivo', 'deny', 'seguranca', 'comando-terminal']]], gitInterrompido: [true] });

  // ───── semana 3 (10/08) ─────
  sessao({ dia: '2026-08-10', hora: '09:15', passo: 'discovery-grill', ativoMin: 50, branch: 'develop', modulo: 'negociacao', acoes: [[0.9, aBriefing('proposta-renegociacao', 4, 'edicao')]] });
  sessao({ dia: '2026-08-10', hora: '14:00', passo: 'discovery-grill', ativoMin: 40, branch: 'develop', modulo: 'negociacao', acoes: [[0.2, aBriefing('proposta-renegociacao', 4, 'leitura')], [0.9, aBriefing('proposta-renegociacao', 2, 'edicao')]] });
  sessao({ dia: '2026-08-11', hora: '09:10', passo: 'discovery-prototipo', ativoMin: 45, branch: 'develop', modulo: 'negociacao', acoes: [[0.1, aBriefing('proposta-renegociacao', 2, 'leitura')]] });
  est('REAB-405', 30, '2026-08-11', '11:00');
  fluxoSdd({ ticket: 'REAB-405', slug: 'proposta-renegociacao', modulo: 'negociacao', branch: 'feature/REAB-405-proposta', briefing: 'proposta-renegociacao', lacunas: 2, fatias: 6,
    dias: ['2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-17', '2026-08-18'], min: [70, 40, 30, 15], impl: [300], specs: [4], testes: [['falha', 'falha', 'sucesso']], validador: [['falha', 'sucesso']],
    contrato: [2], revisoes: [['APROVADO', 'REPROVADO'], ['APROVADO', 'APROVADO']], replan: [35, 120],
    guard: [[['contrato-federation', 'ask', 'contrato', 'arquivo-contrato'], ['contrato-federation', 'ask', 'contrato', 'arquivo-contrato'], ['openapi-spec', 'ask', 'contrato', 'arquivo-contrato']]] });

  est('REAB-423', 60, '2026-08-12', '10:00', 'estimativa inflada — exemplo de divergência');
  fluxoSdd({ ticket: 'REAB-423', slug: 'banner-oferta', modulo: 'ofertas', branch: 'feature/REAB-423-banner-oferta', fatias: 3, modeloPlan: 'claude-opus-5',
    dias: ['2026-08-12', '2026-08-13', '2026-08-14', '2026-08-14'], min: [40, 25, 10], impl: [160], specs: [2], testes: [['sucesso']], validador: [['sucesso']] });

  // ───── semana 4 (17/08) ─────
  est('REAB-433', 22, '2026-08-17', '09:00');
  sessao({ dia: '2026-08-17', hora: '09:30', passo: 'design-to-code-liquid', ativoMin: 120, branch: 'feature/REAB-433-cards-cliente', modulo: 'cliente', editaCodigo: true, agente: 'design-to-code-liquid', pausaLonga: false,
    acoes: [[0.05, aFigma()], [0.1, aFigma()], ...aComponente('cliente', 'card-dados-cliente', false, 18, 3).map((a, k) => [0.2 + k * 0.05, a]), ...aComponente('cliente', 'card-contratos', false, 22, 5).map((a, k) => [0.45 + k * 0.05, a])] });
  sessao({ dia: '2026-08-18', hora: '10:00', passo: 'design-to-code-liquid', ativoMin: 90, branch: 'feature/REAB-433-cards-cliente', modulo: 'cliente', editaCodigo: true, agente: 'design-to-code-liquid',
    acoes: [[0.05, aFigma()], ...aComponente('cliente', 'badge-situacao', false, 6, 2).map((a, k) => [0.15 + k * 0.05, a]), ...aComponente('cliente', 'visao-cliente', true, 34, 9).map((a, k) => [0.5 + k * 0.08, a])] });
  sessao({ dia: '2026-08-18', hora: '15:30', passo: 'livre', ativoMin: 30, branch: 'feature/REAB-433-cards-cliente', modulo: 'cliente', editaCodigo: true, modelo: 'gpt-5.4' });
  conclusoes.push({ v: 1, t: iso(quando('2026-08-19', '10:00')), atividade: 'REAB-433' });

  fluxoSdd({ ticket: 'REAB-420', slug: 'mascara-cpf', modulo: 'cliente', branch: 'feature/REAB-420-mascara-cpf', fatias: 1,
    dias: ['2026-08-19', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-21', '2026-08-21'], min: [40, 35, 30, 15], impl: [250], specs: [0], testes: [['falha', 'falha', 'sucesso']], validador: [['sucesso']],
    revisoes: [['REPROVADO', 'APROVADO'], ['APROVADO', 'APROVADO']], replan: [25, 70] });

  // ───── semana 5 (24/08) ─────
  est('REAB-412', 32, '2026-08-24', '09:00');
  sessao({ dia: '2026-08-24', hora: '09:20', passo: 'discovery-grill', ativoMin: 45, branch: 'develop', modulo: 'parcelas', acoes: [[0.9, aBriefing('parcelamento-entrada', 3, 'edicao')]] });
  fluxoSdd({ ticket: 'REAB-412', slug: 'parcelamento-entrada', modulo: 'parcelas', branch: 'feature/REAB-412-parcelamento-entrada', briefing: 'parcelamento-entrada', lacunas: 3, fatias: 5,
    dias: ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-27'], min: [60, 35, 15], impl: [200, 140], specs: [3, 1], testes: [['falha', 'sucesso'], ['sucesso']], validador: [['sucesso'], ['falha', 'sucesso']],
    contrato: [0, 1], guard: [[], [['contrato-federation', 'ask', 'contrato', 'arquivo-contrato'], ['comando-destrutivo', 'deny', 'seguranca', 'comando-terminal']]], gitInterrompido: [false, true] });

  est('REAB-436', 30, '2026-08-25', '09:00');
  sessao({ dia: '2026-08-25', hora: '09:30', passo: 'sdd-plan', ativoMin: 45, branch: 'develop', ticketPrompt: 'REAB-436', modulo: 'acompanhamento',
    acoes: [[0.5, aProposta('painel-acompanhamento', 'REAB-436', 'feature/REAB-436-painel', 'edicao')], [0.8, aTarefas('painel-acompanhamento', 3, 'edicao')]] });
  sessao({ dia: '2026-08-26', hora: '09:15', passo: 'design-to-code-liquid', ativoMin: 100, branch: 'feature/REAB-436-painel', modulo: 'acompanhamento', editaCodigo: true, agente: 'design-to-code-liquid',
    acoes: [[0.05, aFigma()], [0.08, aFigma()], ...aComponente('acompanhamento', 'grafico-pagamentos', false, 12, 6).map((a, k) => [0.2 + k * 0.05, a]), ...aComponente('acompanhamento', 'lista-eventos', false, 14, 2).map((a, k) => [0.4 + k * 0.05, a]), ...aComponente('acompanhamento', 'painel-acompanhamento', true, 28, 7).map((a, k) => [0.65 + k * 0.06, a])] });
  sessao({ dia: '2026-08-27', hora: '09:10', passo: 'sdd-implement', ativoMin: 150, branch: 'feature/REAB-436-painel', modulo: 'acompanhamento', editaCodigo: true,
    acoes: [[0.05, aTarefas('painel-acompanhamento', 3)], [0.3, aSpec('acompanhamento', 'painel-1')], [0.4, aSpec('acompanhamento', 'painel-2')], [0.7, aTeste('sucesso')], [0.9, aValidador('sucesso')]] });
  sessao({ dia: '2026-08-28', hora: '10:00', passo: 'sdd-review', ativoMin: 30, branch: 'feature/REAB-436-painel', modulo: 'acompanhamento',
    acoes: [[0.05, aProposta('painel-acompanhamento', 'REAB-436', 'feature/REAB-436-painel')], [0.6, aVeredito('painel-acompanhamento', 'spec', 'APROVADO')], [0.85, aVeredito('painel-acompanhamento', 'padroes', 'APROVADO')]] });
  sessao({ dia: '2026-08-28', hora: '16:00', passo: 'sdd-archive', ativoMin: 12, branch: 'feature/REAB-436-painel', modulo: 'acompanhamento',
    acoes: [[0.1, aProposta('painel-acompanhamento', 'REAB-436', 'feature/REAB-436-painel')], [0.5, aDecisao('painel-acompanhamento')]] });

  // ───── semana 6 (31/08) ─────
  est('REAB-430', 14, '2026-08-31', '09:00');
  fluxoSdd({ ticket: 'REAB-430', slug: 'aviso-inadimplencia', modulo: 'avisos', branch: 'feature/REAB-430-aviso', fatias: 2, gitExecutado: true, repo: REPO_SHELL,
    dias: ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-02'], min: [35, 25, 10], impl: [140], specs: [2], testes: [['sucesso']], validador: [['sucesso']] });

  est('REAB-439', 14, '2026-09-01', '09:00');
  sessao({ dia: '2026-09-01', hora: '09:20', passo: 'design-to-code-liquid', ativoMin: 110, branch: 'feature/REAB-439-simulador', modulo: 'simulador', editaCodigo: true, agente: 'design-to-code-liquid',
    acoes: [[0.05, aFigma()], ...['campo-valor', 'seletor-parcelas', 'resumo-simulacao', 'rodape-acoes'].flatMap((n, j) => aComponente('simulador', n, false, 10 + j * 3, j === 2 ? 8 : 2).map((a, k) => [0.12 + j * 0.2 + k * 0.05, a]))] });
  sessao({ dia: '2026-09-02', hora: '14:00', passo: 'design-to-code-liquid', ativoMin: 80, branch: 'feature/REAB-439-simulador', modulo: 'simulador', editaCodigo: true, agente: 'design-to-code-liquid',
    acoes: [[0.05, aFigma()]] });
  conclusoes.push({ v: 1, t: iso(quando('2026-09-03', '11:00')), atividade: 'REAB-439' });

  est('REAB-427', 18, '2026-09-02', '09:00');
  fluxoSdd({ ticket: 'REAB-427', slug: 'exportar-extrato', modulo: 'extrato', branch: 'feature/REAB-427-exportar', fatias: 3, arquivar: false, revisoes: [],
    dias: ['2026-09-03', '2026-09-04'], min: [50], impl: [120], specs: [1], testes: [['falha']], validador: [['sucesso']] });

  // sessões avulsas e ruído realista
  sessao({ dia: '2026-08-20', hora: '16:40', passo: 'livre', ativoMin: 14, branch: 'develop', modulo: 'geral', modelo: 'gpt-5.4' });
  sessao({ dia: '2026-09-03', hora: '17:20', passo: 'livre', ativoMin: 12, branch: 'develop', modulo: 'geral', modelo: 'raptor-mini-preview' });
  sessao({ dia: '2026-08-29', hora: '10:00', passo: 'livre', ativoMin: 22, branch: 'develop', semHook: true, conversa: `conv-${hex(12)}`, modelo: 'gpt-5.4' });

  // métrica OTel de sobrevivência de edição (histograma cumulativo)
  const histo = (nome, soma, contagem) => ({ name: nome, histogram: { aggregationTemporality: 2, dataPoints: [{ startTimeUnixNano: nanos(quando('2026-07-27', '08:00')), timeUnixNano: nanos(quando('2026-09-04', '18:00')), sum: soma, count: contagem, attributes: [] }] } });
  otelLinhas.push(JSON.stringify({ resourceMetrics: [{ resource: { attributes: [] }, scopeMetrics: [{ scope: { name: 'copilot-chat' }, metrics: [histo('copilot_chat.edit.survival.no_revert', 187.4, 214), histo('copilot_chat.edit.survival.four_gram', 158.9, 214)] }] }] }));

  // ───── gravação ─────
  for (const [sid, evs] of eventos) writeFileSync(join(dadosDir, 'eventos', `${sid}.jsonl`), `${evs.map((e) => JSON.stringify(e)).join('\n')}\n`);
  writeFileSync(join(dadosDir, 'otel', 'copilot-otel.jsonl'), `${otelLinhas.join('\n')}\n`);
  writeFileSync(join(dadosDir, 'estimativas.jsonl'), `${estimativas.map((e) => JSON.stringify(e)).join('\n')}\n`);
  writeFileSync(join(dadosDir, 'guardrails.jsonl'), `${guardrails.map((e) => JSON.stringify(e)).join('\n')}\n`);
  writeFileSync(join(dadosDir, 'conclusoes.jsonl'), `${conclusoes.map((e) => JSON.stringify(e)).join('\n')}\n`);
  return { sessoes: eventos.size, spansLinhas: otelLinhas.length, estimativas: estimativas.length };
}
