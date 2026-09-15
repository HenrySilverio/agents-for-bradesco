import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carregarTudo } from '../lib/config.mjs';
import { precificar, projetar } from '../lib/projecao.mjs';

const T = (dia, hora) => new Date(`2026-08-${dia}T${hora}:00-03:00`).toISOString();

function cenario(sessoes, extras = {}) {
  const dados = mkdtempSync(join(tmpdir(), 'hm-proj-'));
  mkdirSync(join(dados, 'eventos'), { recursive: true });
  for (const [sid, evs] of Object.entries(sessoes)) {
    writeFileSync(join(dados, 'eventos', `${sid}.jsonl`), `${evs.map((e) => JSON.stringify({ v: 1, sid, ...e })).join('\n')}\n`);
  }
  for (const [arq, linhas] of Object.entries(extras)) {
    writeFileSync(join(dados, arq), `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  }
  return carregarTudo({ dadosDir: dados });
}

const sessaoBase = (branch, cmd, t0, t1, extras = []) => [
  { t: T('10', t0), ev: 'SessionStart', repo: 'r', git: { branch, head: 'abc' } },
  { t: T('10', t0), ev: 'UserPromptSubmit', cmd, tickets: [], estimativa_h: null, chars: 10 },
  ...extras,
  { t: T('10', t1), ev: 'Stop', git: { branch, head: 'abc', diff: { arquivos: 1, adicionadas: 5, removidas: 0 } } },
];

test('briefing lido no plan liga a sessão de discovery à atividade do ticket', async () => {
  const cfg = cenario({
    disc: sessaoBase('develop', 'discovery-grill', '09:00', '09:30', [
      { t: T('10', '09:20'), ev: 'PostToolUse', tool: 'createFile', cat: 'edicao', sondas: [{ id: 'discovery.briefing', path: 'docs/briefings/tela.md', op: 'edicao', campos: { slug: 'tela', nao_respondido: 2 } }] },
    ]),
    plan: sessaoBase('develop', 'sdd-plan', '10:00', '10:40', [
      { t: T('10', '10:05'), ev: 'PostToolUse', tool: 'readFile', cat: 'leitura', sondas: [{ id: 'discovery.briefing', path: 'docs/briefings/tela.md', op: 'leitura', campos: { slug: 'tela' } }] },
      { t: T('10', '10:20'), ev: 'PostToolUse', tool: 'createFile', cat: 'edicao', sondas: [{ id: 'sdd.proposta', path: '.sdd/m/proposta.md', op: 'edicao', campos: { mudanca: 'm', ticket: 'ABC-1', branch: 'feature/ABC-1' } }] },
    ]),
  });
  const d = await projetar(cfg);
  assert.equal(d.atividades.length, 1);
  assert.equal(d.atividades[0].rotulo, 'ABC-1');
  assert.equal(d.atividades[0].sessoes.length, 2);
  assert.equal(d.atividades[0].qualidade.lacunas_explicitadas, 2);
});

test('estimativa registrada depois da primeira edição de código não é cega', async () => {
  const eventosImpl = [
    { t: T('10', '11:05'), ev: 'PreToolUse', tool: 'editFiles', cat: 'edicao', paths: ['src/a.ts'], novos: [], contrato: false },
  ];
  const base = {
    impl: [
      { t: T('10', '11:00'), ev: 'SessionStart', repo: 'r', git: { branch: 'feature/ABC-9', head: 'a' } },
      { t: T('10', '11:00'), ev: 'UserPromptSubmit', cmd: 'sdd-implement', tickets: ['ABC-9'], estimativa_h: null, chars: 5 },
      ...eventosImpl,
      { t: T('10', '12:00'), ev: 'Stop', git: { branch: 'feature/ABC-9', head: 'a', diff: null } },
    ],
    arch: sessaoBase('feature/ABC-9', 'sdd-archive', '12:10', '12:20'),
  };
  const cega = await projetar(cenario(base, { 'estimativas.jsonl': [{ v: 1, t: T('10', '10:00'), atividade: 'ABC-9', horas: 20 }] }));
  assert.equal(cega.atividades[0].estimativa.cega_h, 20);
  assert.ok(!cega.atividades[0].alertas.includes('estimativa_nao_cega'));

  const tarde = await projetar(cenario(base, { 'estimativas.jsonl': [{ v: 1, t: T('10', '13:00'), atividade: 'ABC-9', horas: 20 }] }));
  assert.equal(tarde.atividades[0].estimativa.cega_h, null);
  assert.equal(tarde.atividades[0].estimativa.nao_cega_h, 20);
  assert.ok(tarde.atividades[0].alertas.includes('estimativa_nao_cega'));
});

test('tempo ativo ignora intervalo maior que o limiar de ociosidade', async () => {
  const cfg = cenario({
    s: [
      { t: T('10', '09:00'), ev: 'SessionStart', repo: 'r', git: { branch: 'feature/ABC-2', head: 'a' } },
      { t: T('10', '09:05'), ev: 'PreToolUse', tool: 'readFile', cat: 'leitura', paths: [] },
      { t: T('10', '11:05'), ev: 'PreToolUse', tool: 'readFile', cat: 'leitura', paths: [] },
      { t: T('10', '11:10'), ev: 'Stop', git: { branch: 'feature/ABC-2', head: 'a', diff: null } },
    ],
  });
  const d = await projetar(cfg);
  const a = d.atividades[0];
  assert.equal(a.tempo.ativo_min, 10, '2h de pausa não contam');
});

test('estratégia mínimo escolhe a menor referência e sinaliza divergência', async () => {
  const cfg = cenario({
    plan: sessaoBase('feature/ABC-3', 'sdd-plan', '09:00', '09:30', [
      { t: T('10', '09:10'), ev: 'PostToolUse', tool: 'createFile', cat: 'edicao', sondas: [{ id: 'sdd.tarefas', path: '.sdd/m/tarefas.md', op: 'edicao', campos: { mudanca: 'm', fatias: 2 } }] },
    ]),
    arch: sessaoBase('feature/ABC-3', 'sdd-archive', '10:00', '10:10'),
  }, { 'estimativas.jsonl': [{ v: 1, t: T('10', '08:00'), atividade: 'ABC-3', horas: 60 }] });
  const d = await projetar(cfg);
  const e = d.atividades[0].estimativa;
  assert.equal(e.parametrica_h, 12);
  assert.equal(e.referencia_h, 12);
  assert.equal(e.referencia_fonte, 'parametrica');
  assert.ok(d.atividades[0].alertas.includes('divergencia'));
});

test('precificação usa preço de cache e acusa modelo desconhecido', () => {
  const precos = {
    credito_usd: 0.01,
    modelos: [{ id: 'claude-haiku-4.5', padrao: 'haiku', entrada: 1, cache_leitura: 0.1, cache_escrita: 1.25, saida: 5 }, { id: 'claude-sonnet-5', padrao: 'sonnet.?5', entrada: 2, cache_leitura: 0.2, cache_escrita: 2.5, saida: 10 }],
  };
  const r = precificar({ 'claude-haiku-4.5': { entrada_nova: 1e6, cache_leitura: 1e6, cache_escrita: 1e6, saida: 1e6 }, 'modelo-x': { entrada_nova: 100, cache_leitura: 0, cache_escrita: 0, saida: 0 } }, precos, 'claude-sonnet-5');
  assert.equal(r.usd, 1 + 0.1 + 1.25 + 5);
  assert.equal(r.creditos, 735);
  assert.deepEqual(r.sem_preco, ['modelo-x']);
  assert.equal(Math.round(r.economia_roteamento_usd * 100) / 100, 7.35);
});
