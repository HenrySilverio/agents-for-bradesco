import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrativaParaHtml, resumoNarrativa, validarNarrativa } from '../lib/narrativa.mjs';

const resumo = { kpi: { horas_economizadas: 161.3, fator_produtividade: 2.8, custo_usd: 47.73, aprovacao_primeira_revisao_pct: 80 }, alertas: { calibracao_placeholder: true } };

test('aceita número correto com chave de origem', () => {
  const md = '## Resultado\nO harness economizou 161,3 h [kpi.horas_economizadas], fator 2,8× [kpi.fator_produtividade], a um custo de consumo de US$ 47,73 [kpi.custo_usd].';
  const v = validarNarrativa(md, resumo);
  assert.equal(v.ok, true, v.erros.join(' | '));
  assert.equal(v.citacoes, 3);
});

test('aceita arredondamento para menos casas', () => {
  assert.equal(validarNarrativa('161 h [kpi.horas_economizadas]', resumo).ok, true);
  assert.equal(validarNarrativa('80% [kpi.aprovacao_primeira_revisao_pct]', resumo).ok, true);
});

test('recusa valor divergente, chave inexistente e número sem chave', () => {
  assert.match(validarNarrativa('190,0 h [kpi.horas_economizadas]', resumo).erros[0], /Valor divergente/);
  assert.match(validarNarrativa('5 h [kpi.inexistente]', resumo).erros[0], /Chave inexistente/);
  const semChave = validarNarrativa('Economizamos cerca de 200 horas no trimestre.', resumo);
  assert.equal(semChave.ok, false);
  assert.match(semChave.erros[0], /Número sem chave/);
});

test('recusa conta feita pelo agente', () => {
  // 161,3 + 47,73 não existe no resumo: some como número sem chave
  const v = validarNarrativa('Total combinado de 209 [kpi.horas_economizadas].', resumo);
  assert.equal(v.ok, false);
});

test('resumo é compacto e não vaza dados crus', () => {
  const dados = {
    kpi: { horas_economizadas: 10, custo_usd: 1 },
    custo: { etapas: [{ passo: 'sdd.plan', rotulo: 'SDD · plan', sessoes: 2, usd: 1, usd_medio_sessao: 0.5, cache_pct: 70, ativo_min: 30 }] },
    produtividade: { por_atividade: [{ rotulo: 'ABC-1', economizadas_h: 10, fator: 2 }] },
    seguranca: { deny: 1, ask: 2, validador: { falhas: 0 }, git_escrita_executada: 0, git_escrita_interrompida: 0, contrato_editados: 0, lacunas_explicitadas: 3 },
    qualidade: { atividades_com_revisao: 1, aprovadas_primeira: 1, aprovacao_primeira_pct: 100, reprovacoes: 0, testes: { execucoes: 2, falhas: 1 }, d2c: { componentes: 0, css_por_componente: null } },
    cobertura: { sessoes_com_tokens_pct: 100, sessoes_com_atividade_pct: 90, concluidas_com_estimativa_cega_pct: 80 },
    pendencias: { calibracao_placeholder: false, sem_estimativa: [], estimativa_nao_cega: [], divergentes: [], modelos_sem_preco: [] },
    demo: false,
  };
  const r = resumoNarrativa(dados);
  assert.equal(r.destaques.a1.rotulo, 'ABC-1');
  assert.equal(r.etapas.sdd_plan.custo_usd, 1);
  assert.ok(JSON.stringify(r).length < 2500, 'resumo precisa caber em poucos tokens');
  assert.ok(!('sessoes_detalhe' in r));
});

test('markdown vira HTML com a citação virando fonte no hover', () => {
  const html = narrativaParaHtml('## Resultado\n- economia de 161,3 h [kpi.horas_economizadas]\n');
  assert.match(html, /<h3>Resultado<\/h3>/);
  assert.match(html, /<span class="cit" title="Fonte: dados.json → kpi.horas_economizadas">161,3 h<\/span>/);
});

test('escapa HTML vindo da narrativa', () => {
  const html = narrativaParaHtml('texto com <script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
});
