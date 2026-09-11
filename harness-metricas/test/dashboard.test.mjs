import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carregarTudo } from '../lib/config.mjs';
import { projetar } from '../lib/projecao.mjs';
import { gerarDashboard } from '../lib/dashboard.mjs';
import { narrativaParaHtml, resumoNarrativa, validarNarrativa } from '../lib/narrativa.mjs';
import { gerarDemo } from '../lib/demo.mjs';

const dadosDir = mkdtempSync(join(tmpdir(), 'hm-dash-'));
gerarDemo(dadosDir);
const cfg = carregarTudo({ dadosDir });
const dados = await projetar(cfg, { demo: true });

test('a demo produz um conjunto de dados coerente', () => {
  assert.ok(dados.kpi.atividades_concluidas >= 10);
  assert.ok(dados.kpi.custo_usd > 0, 'sem custo não há OTel sendo lido');
  assert.ok(dados.atividades.every((a) => a.sessoes.length > 0));
  assert.ok(dados.cobertura.correlacao.id > 0);
  assert.equal(dados.cobertura.input_inclui_cache, true);
  const comGanho = dados.atividades.filter((a) => a.ganho);
  const soma = comGanho.reduce((s, a) => s + a.ganho.horas_economizadas, 0);
  assert.ok(Math.abs(soma - dados.kpi.horas_economizadas) < 0.5, 'KPI precisa bater com a soma das atividades');
});

test('projeção é determinística: mesma entrada, mesma saída', async () => {
  const outra = await projetar(cfg, { demo: true, agora: Date.parse(dados.gerado_em) });
  assert.deepEqual(JSON.parse(JSON.stringify(outra)), JSON.parse(JSON.stringify({ ...dados, gerado_em: outra.gerado_em })));
});

test('dashboard é autocontido: nada carregado de fora', () => {
  const html = gerarDashboard(dados, {});
  assert.ok(!/<script[^>]+src=/i.test(html), 'script externo');
  assert.ok(!/<link[^>]+href=/i.test(html), 'stylesheet externa');
  assert.ok(!/@import/i.test(html));
  assert.ok(!/fetch\(|XMLHttpRequest/i.test(html));
  const urls = [...html.matchAll(/https?:\/\/[^"' )<]+/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(urls)].filter((u) => !u.startsWith('https://docs.github.com') && !u.startsWith('http://www.w3.org')), []);
  assert.ok(html.includes('DADOS SINTÉTICOS'));
  for (const t of ['Horas economizadas', 'Guard-rails acionados', 'Metodologia e confiabilidade', 'O que este painel não mede']) assert.ok(html.includes(t), t);
});

test('narrativa só entra no dashboard se passar no portão', () => {
  const resumo = resumoNarrativa(dados);
  const boa = `## Resultado\nEconomia estimada de ${String(resumo.kpi.horas_economizadas).replace('.', ',')} h [kpi.horas_economizadas].`;
  assert.equal(validarNarrativa(boa, resumo).ok, true);
  const html = gerarDashboard(dados, { narrativaHtml: narrativaParaHtml(boa) });
  assert.ok(html.includes('class="cit"'));
  const ruim = '## Resultado\nEconomia de 999,9 h [kpi.horas_economizadas].';
  assert.equal(validarNarrativa(ruim, resumo).ok, false);
});

test('JSON embutido não pode fechar a tag script', () => {
  const perigoso = { ...dados, repos: ['</script><script>alert(1)</script>'] };
  const html = gerarDashboard(perigoso, {});
  const bloco = html.slice(html.indexOf('id="dados"'));
  assert.ok(!bloco.slice(0, bloco.indexOf('</script>')).includes('</script'));
});
