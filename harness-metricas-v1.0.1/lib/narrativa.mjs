// Narrativa executiva: o agente escreve, o código confere.
// Regra: todo número da narrativa vem seguido da chave de onde saiu, ex.: "117,6 h [kpi.horas_economizadas]".
// O build recusa narrativa com número sem chave, chave inexistente ou valor diferente do dado.

const RE_CITACAO = /(?<![\w.,])([-−]?\d[\d.,]*\d|[-−]?\d)([^\d[\]\n]{0,24}?)\s*\[([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\]/g;

function semNulos(obj) {
  if (Array.isArray(obj)) return obj.map(semNulos);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null).map(([k, v]) => [k, semNulos(v)]));
  }
  return obj;
}

export function resumoNarrativa(d) {
  const etapas = {};
  for (const e of d.custo.etapas) {
    etapas[e.passo.replace(/[^a-z0-9]+/gi, '_').toLowerCase()] = {
      rotulo: e.rotulo, sessoes: e.sessoes, custo_usd: e.usd, custo_medio_sessao_usd: e.usd_medio_sessao,
      cache_pct: e.cache_pct, tempo_ativo_min: e.ativo_min,
    };
  }
  const destaques = {};
  [...d.produtividade.por_atividade]
    .sort((a, b) => b.economizadas_h - a.economizadas_h)
    .slice(0, 3)
    .forEach((a, i) => { destaques[`a${i + 1}`] = { rotulo: a.rotulo, economizadas_h: a.economizadas_h, fator: a.fator }; });
  return semNulos({
    _instrucao: 'Todo número citado deve vir seguido da chave entre colchetes, ex.: 117,6 h [kpi.horas_economizadas]. Não calcule nada. Não cite datas.',
    kpi: d.kpi,
    seguranca: {
      bloqueios_hook: d.seguranca.deny,
      confirmacoes_exigidas: d.seguranca.ask,
      falhas_validador: d.seguranca.validador.falhas,
      git_escrita_executada: d.seguranca.git_escrita_executada,
      git_escrita_interrompida: d.seguranca.git_escrita_interrompida,
      contrato_editados: d.seguranca.contrato_editados,
      lacunas_explicitadas: d.seguranca.lacunas_explicitadas,
    },
    qualidade: {
      atividades_com_revisao: d.qualidade.atividades_com_revisao,
      aprovadas_primeira: d.qualidade.aprovadas_primeira,
      aprovacao_primeira_pct: d.qualidade.aprovacao_primeira_pct,
      reprovacoes: d.qualidade.reprovacoes,
      testes_execucoes: d.qualidade.testes.execucoes,
      testes_falhas: d.qualidade.testes.falhas,
      d2c_componentes: d.qualidade.d2c.componentes,
      d2c_css_por_componente: d.qualidade.d2c.css_por_componente,
    },
    etapas,
    destaques,
    cobertura: {
      sessoes_com_tokens_pct: d.cobertura.sessoes_com_tokens_pct,
      sessoes_com_atividade_pct: d.cobertura.sessoes_com_atividade_pct,
      concluidas_com_estimativa_cega_pct: d.cobertura.concluidas_com_estimativa_cega_pct,
    },
    alertas: {
      calibracao_placeholder: d.pendencias.calibracao_placeholder,
      atividades_sem_estimativa: d.pendencias.sem_estimativa.length,
      estimativas_nao_cegas: d.pendencias.estimativa_nao_cega.length,
      atividades_com_estimativas_divergentes: d.pendencias.divergentes.length,
      modelos_sem_preco: d.pendencias.modelos_sem_preco.length,
      dados_sinteticos: d.demo,
    },
  });
}

function valorNaChave(obj, caminho) {
  let atual = obj;
  for (const parte of caminho.split('.')) {
    if (atual == null || typeof atual !== 'object' || !(parte in atual)) return undefined;
    atual = atual[parte];
  }
  return atual;
}

export function lerNumeroBr(texto) {
  let s = texto.trim().replace(/^−/, '-');
  const neg = s.startsWith('-');
  s = s.replace(/^-/, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  const casas = (s.split('.')[1] || '').length;
  return { n: neg ? -n : n, casas, valido: Number.isFinite(n) };
}

export function validarNarrativa(md, resumo) {
  const erros = [];
  const citacoes = [];
  for (const m of md.matchAll(RE_CITACAO)) {
    const [, numero, , chave] = m;
    const { n, casas, valido } = lerNumeroBr(numero);
    const valor = valorNaChave(resumo, chave);
    if (!valido) { erros.push(`Número ilegível "${numero}" em [${chave}]`); continue; }
    if (valor === undefined) { erros.push(`Chave inexistente [${chave}] (número ${numero})`); continue; }
    if (typeof valor !== 'number') { erros.push(`Chave [${chave}] não é numérica`); continue; }
    const tolerancia = 0.5 * 10 ** -casas + 1e-9;
    if (Math.abs(valor - n) > tolerancia) erros.push(`Valor divergente em [${chave}]: narrativa diz ${numero}, dado é ${valor}`);
    citacoes.push({ numero, chave });
  }
  const resto = md
    .replace(RE_CITACAO, ' ')
    .replace(/^\s*\d+\.\s/gm, ' ')
    .replace(/\[[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+\]/g, ' ');
  for (const m of resto.matchAll(/[^\n]{0,30}\d[^\n]{0,30}/g)) {
    erros.push(`Número sem chave de origem: "…${m[0].trim()}…"`);
  }
  const palavras = md.replace(/\[[^\]]+\]/g, '').split(/\s+/).filter(Boolean).length;
  if (palavras > 260) erros.push(`Narrativa com ${palavras} palavras (limite 260)`);
  return { ok: erros.length === 0, erros, citacoes: citacoes.length };
}

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function narrativaParaHtml(md) {
  const linhas = escapar(md.trim()).split('\n');
  const html = [];
  let lista = false;
  let paragrafo = [];
  const fecharParagrafo = () => { if (paragrafo.length) { html.push(`<p>${paragrafo.join(' ')}</p>`); paragrafo = []; } };
  const fecharLista = () => { if (lista) { html.push('</ul>'); lista = false; } };
  const inline = (t) => t
    .replace(RE_CITACAO, (_, num, unidade, chave) => `<span class="cit" title="Fonte: dados.json → ${chave}">${num}${unidade.replace(/\s+$/, '')}</span>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const bruta of linhas) {
    const l = bruta.trimEnd();
    if (/^#{1,3}\s/.test(l)) { fecharParagrafo(); fecharLista(); html.push(`<h3>${inline(l.replace(/^#{1,3}\s+/, ''))}</h3>`); continue; }
    if (/^\s*[-*]\s+/.test(l)) { fecharParagrafo(); if (!lista) { html.push('<ul>'); lista = true; } html.push(`<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`); continue; }
    if (!l.trim()) { fecharParagrafo(); fecharLista(); continue; }
    fecharLista();
    paragrafo.push(inline(l.trim()));
  }
  fecharParagrafo();
  fecharLista();
  return html.join('\n');
}
