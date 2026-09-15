import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const HOOK = join(RAIZ, 'bin', 'hook.mjs');

function ambiente() {
  const base = mkdtempSync(join(tmpdir(), 'hm-test-'));
  const repo = join(base, 'repo');
  const dados = join(base, 'dados');
  mkdirSync(join(repo, '.sdd/mudancas/x/revisao'), { recursive: true });
  mkdirSync(join(repo, 'docs/briefings'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  writeFileSync(join(repo, 'src/a.ts'), 'const a = 1;\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  return { base, repo, dados };
}

const disparar = (dados, payload) => {
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env: { ...process.env, HARNESS_METRICAS_DADOS: dados }, encoding: 'utf8' });
  return r;
};
const eventos = (dados, sid) => readFileSync(join(dados, 'eventos', `${sid}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('hook é observador puro: exit 0, stdout {} e nada de conteúdo sensível em disco', () => {
  const { repo, dados } = ambiente();
  const r1 = disparar(dados, { hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'new' });
  assert.equal(r1.status, 0);
  assert.equal(r1.stdout, '{}');
  const r2 = disparar(dados, {
    hook_event_name: 'PreToolUse', session_id: 's1', cwd: repo, tool_name: 'createFile', tool_use_id: 't1',
    tool_input: { filePath: 'src/segredo.ts', content: 'const token = "SENHA-SUPER-SECRETA";' },
  });
  assert.equal(r2.status, 0);
  const r3 = disparar(dados, {
    hook_event_name: 'PreToolUse', session_id: 's1', cwd: repo, tool_name: 'runInTerminal', tool_use_id: 't2',
    tool_input: { command: 'curl -H "Authorization: Bearer TOKEN-SECRETO" https://x' },
  });
  assert.equal(r3.status, 0);
  const bruto = readFileSync(join(dados, 'eventos', 's1.jsonl'), 'utf8');
  assert.ok(!bruto.includes('SENHA-SUPER-SECRETA'), 'conteúdo de arquivo vazou');
  assert.ok(!bruto.includes('TOKEN-SECRETO'), 'comando de terminal vazou');
  assert.ok(!bruto.includes(repo), 'caminho absoluto vazou');
});

test('stdin inválido não derruba o hook', () => {
  const { dados } = ambiente();
  const r = spawnSync(process.execPath, [HOOK], { input: 'isto não é json', env: { ...process.env, HARNESS_METRICAS_DADOS: dados }, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '{}');
  assert.ok(existsSync(join(dados, 'erros-hook.log')));
});

test('prompt vira comando, ticket e estimativa — sem guardar o texto', () => {
  const { repo, dados } = ambiente();
  disparar(dados, { hook_event_name: 'SessionStart', session_id: 's2', cwd: repo, source: 'new' });
  const texto = '/sdd-implement REAB-412 primeira fatia. estimativa-sem-ia: 12,5h';
  disparar(dados, { hook_event_name: 'UserPromptSubmit', session_id: 's2', cwd: repo, prompt: texto });
  const [, prompt] = eventos(dados, 's2');
  assert.equal(prompt.cmd, 'sdd-implement');
  assert.deepEqual(prompt.tickets, ['REAB-412']);
  assert.equal(prompt.estimativa_h, 12.5);
  assert.equal(prompt.chars, texto.length);
  assert.ok(!JSON.stringify(prompt).includes('primeira fatia'));
});

test('sondas extraem fato do artefato no momento da escrita', () => {
  const { repo, dados } = ambiente();
  writeFileSync(join(repo, '.sdd/mudancas/x/proposta.md'), '# Proposta\n**Ticket:** REAB-777\n**Branch:** `feature/REAB-777-x`\n');
  writeFileSync(join(repo, '.sdd/mudancas/x/tarefas.md'), '## F1\nDemonstra: tela\n- [x] a\n## F2\n**Demonstra:** api\n- [ ] b\n');
  writeFileSync(join(repo, '.sdd/mudancas/x/revisao/padroes-abc1234.md'), 'Veredito: REPROVADO\n');
  writeFileSync(join(repo, 'docs/briefings/tela-x.md'), 'Sintoma: x\n**[NÃO RESPONDIDO]** limite?\n**[NÃO RESPONDIDO]** prazo?\n');
  disparar(dados, { hook_event_name: 'SessionStart', session_id: 's3', cwd: repo, source: 'new' });
  const post = (path, tool = 'readFile') => disparar(dados, { hook_event_name: 'PostToolUse', session_id: 's3', cwd: repo, tool_name: tool, tool_use_id: 'x', tool_input: { filePath: path }, tool_response: 'ok' });
  post('.sdd/mudancas/x/proposta.md');
  post('.sdd/mudancas/x/tarefas.md');
  post('.sdd/mudancas/x/revisao/padroes-abc1234.md', 'createFile');
  post('docs/briefings/tela-x.md', 'createFile');
  const sondas = eventos(dados, 's3').flatMap((e) => e.sondas || []);
  const porId = Object.fromEntries(sondas.map((s) => [s.id, s.campos]));
  assert.equal(porId['sdd.proposta'].ticket, 'REAB-777');
  assert.equal(porId['sdd.proposta'].branch, 'feature/REAB-777-x');
  assert.equal(porId['sdd.proposta'].mudanca, 'x');
  assert.equal(porId['sdd.tarefas'].fatias, 2);
  assert.equal(porId['sdd.tarefas'].concluidas, 1);
  assert.equal(porId['sdd.veredito'].veredito, 'REPROVADO');
  assert.equal(porId['sdd.veredito'].eixo, 'padroes');
  assert.equal(porId['sdd.veredito'].commit, 'abc1234');
  assert.equal(porId['discovery.briefing'].nao_respondido, 2);
  assert.equal(porId['discovery.briefing'].slug, 'tela-x');
});

test('classifica terminal e resultado sem guardar o comando', () => {
  const { repo, dados } = ambiente();
  disparar(dados, { hook_event_name: 'SessionStart', session_id: 's4', cwd: repo, source: 'new' });
  disparar(dados, { hook_event_name: 'PostToolUse', session_id: 's4', cwd: repo, tool_name: 'runInTerminal', tool_use_id: 'v', tool_input: { command: 'node .sdd/sdd.mjs validar' }, tool_response: '2 portões FAILED\nCommand exited with code 1' });
  disparar(dados, { hook_event_name: 'PostToolUse', session_id: 's4', cwd: repo, tool_name: 'runInTerminal', tool_use_id: 'g', tool_input: { command: 'git commit -m x' }, tool_response: 'ok' });
  const evs = eventos(dados, 's4');
  assert.equal(evs[1].term, 'validador_sdd');
  assert.equal(evs[1].res, 'falha');
  assert.equal(evs[2].term, 'git_escrita');
});

test('Stop mede o diff só dos arquivos tocados pelo agente', () => {
  const { repo, dados } = ambiente();
  disparar(dados, { hook_event_name: 'SessionStart', session_id: 's5', cwd: repo, source: 'new' });
  disparar(dados, { hook_event_name: 'PreToolUse', session_id: 's5', cwd: repo, tool_name: 'createFile', tool_use_id: 'n', tool_input: { filePath: 'src/novo.ts' } });
  writeFileSync(join(repo, 'src/novo.ts'), 'a\nb\nc\n');
  writeFileSync(join(repo, 'src/a.ts'), 'const a = 2;\n');
  disparar(dados, { hook_event_name: 'PreToolUse', session_id: 's5', cwd: repo, tool_name: 'replaceString', tool_use_id: 'e', tool_input: { filePath: 'src/a.ts' } });
  disparar(dados, { hook_event_name: 'Stop', session_id: 's5', cwd: repo, stop_hook_active: false });
  const stop = eventos(dados, 's5').at(-1);
  assert.equal(stop.git.diff.arquivos, 2);
  assert.equal(stop.git.diff.adicionadas, 4);
  assert.equal(stop.git.diff.removidas, 1);
});

test('caminho fora do cwd não vaza estrutura da máquina', () => {
  const { repo, dados } = ambiente();
  disparar(dados, { hook_event_name: 'PreToolUse', session_id: 's6', cwd: repo, tool_name: 'readFile', tool_use_id: 'z', tool_input: { filePath: '/etc/hosts' } });
  const [e] = eventos(dados, 's6');
  assert.deepEqual(e.paths, ['~ext/hosts']);
});
