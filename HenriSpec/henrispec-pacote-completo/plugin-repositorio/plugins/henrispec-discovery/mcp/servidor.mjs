#!/usr/bin/env node
// Servidor MCP da família HenriSpec. Arquivo único, sem dependência, Node 18+.
// Transporte stdio: uma mensagem JSON-RPC por linha.
//
//   node servidor.mjs --perfil henrispec     ferramentas do fluxo SDD
//   node servidor.mjs --perfil discovery     só o contrato do discovery
//
// Por que existe: tudo que é mecânico sai do modelo e vira código. Os scripts rodam a partir
// do plugin, na versão do plugin; o repositório guarda só dados. E as etapas que não precisam
// de terminal deixam de tê-lo: o Git é lido por aqui, em modo só leitura, e o veredito é
// gravado por aqui, sem poder sobrescrever.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_PLUGIN = resolve(process.env.PLUGIN_ROOT || join(AQUI, '..'));
const PERFIL = (process.argv.includes('--perfil') ? process.argv[process.argv.indexOf('--perfil') + 1] : 'henrispec') || 'henrispec';
const MANIFESTO = JSON.parse(readFileSync(join(RAIZ_PLUGIN, 'plugin.json'), 'utf8'));
const LIMITE_SAIDA = 150_000;

// ------------------------------------------------------------------ JSON-RPC

let pendentes = new Map();
let proximoId = 1;
let raizesCliente = [];
let clienteTemRaizes = false;

function enviar(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function pedirAoCliente(method, params) {
  const id = `srv-${proximoId++}`;
  enviar({ jsonrpc: '2.0', id, method, params });
  return new Promise((ok) => {
    pendentes.set(id, ok);
    setTimeout(() => {
      if (pendentes.has(id)) {
        pendentes.delete(id);
        ok(null);
      }
    }, 5000);
  });
}

async function atualizarRaizes() {
  if (!clienteTemRaizes) return;
  const r = await pedirAoCliente('roots/list', {});
  if (r?.roots) {
    raizesCliente = r.roots
      .map((x) => x.uri)
      .filter((u) => u?.startsWith('file:'))
      .map((u) => fileURLToPath(u));
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (pedaco) => {
  buffer += pedaco;
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const linha = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (linha) tratar(linha);
  }
});

async function tratar(linha) {
  let msg;
  try {
    msg = JSON.parse(linha);
  } catch {
    return enviar({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } });
  }
  // resposta a um pedido nosso
  if (msg.id !== undefined && !msg.method) {
    const ok = pendentes.get(msg.id);
    if (ok) {
      pendentes.delete(msg.id);
      ok(msg.result ?? null);
    }
    return;
  }
  try {
    switch (msg.method) {
      case 'initialize':
        clienteTemRaizes = Boolean(msg.params?.capabilities?.roots);
        return enviar({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: msg.params?.protocolVersion || '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: MANIFESTO.name, version: MANIFESTO.version },
            instructions: 'Ferramentas mecânicas do fluxo HenriSpec. Os agentes do plugin dizem quando usar cada uma.',
          },
        });
      case 'notifications/initialized':
      case 'notifications/roots/list_changed':
        await atualizarRaizes();
        return;
      case 'ping':
        return enviar({ jsonrpc: '2.0', id: msg.id, result: {} });
      case 'tools/list':
        return enviar({ jsonrpc: '2.0', id: msg.id, result: { tools: FERRAMENTAS.map(({ executar, ...t }) => t) } });
      case 'tools/call': {
        const f = FERRAMENTAS.find((t) => t.name === msg.params?.name);
        if (!f) return enviar({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `ferramenta desconhecida: ${msg.params?.name}` } });
        let texto;
        let erro = false;
        try {
          texto = await f.executar(msg.params?.arguments || {});
        } catch (e) {
          texto = e.message;
          erro = true;
        }
        if (texto.length > LIMITE_SAIDA) texto = `${texto.slice(0, LIMITE_SAIDA)}\n… saída cortada em ${LIMITE_SAIDA} caracteres.`;
        return enviar({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: texto }], isError: erro } });
      }
      default:
        if (msg.id !== undefined) enviar({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `método não suportado: ${msg.method}` } });
    }
  } catch (e) {
    if (msg.id !== undefined) enviar({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } });
  }
}

// ------------------------------------------------------------------ apoio

const falha = (m) => {
  throw new Error(m);
};

function eRepo(p) {
  return existsSync(join(p, '.git'));
}

// Qual repositório? Argumento explícito, senão a pasta do workspace que é repositório e tem
// .sdd/, senão a única que é repositório. Ambiguidade vira erro, nunca palpite.
async function raizDoRepo(arg) {
  if (arg) {
    const p = resolve(arg);
    if (!eRepo(p)) falha(`"${p}" não é raiz de repositório Git.`);
    return p;
  }
  if (!raizesCliente.length) await atualizarRaizes();
  const repos = raizesCliente.filter(eRepo);
  const comSdd = repos.filter((p) => existsSync(join(p, '.sdd')));
  if (comSdd.length === 1) return comSdd[0];
  if (repos.length === 1) return repos[0];
  if (repos.length > 1) {
    falha(`Há ${repos.length} repositórios abertos (${repos.join(', ')}). Informe "repo" com o caminho do repositório desta mudança.`);
  }
  if (eRepo(process.cwd()) && resolve(process.cwd()) !== RAIZ_PLUGIN) return process.cwd();
  falha('Não encontrei o repositório. Abra a pasta do repositório no VS Code, ou informe "repo" com o caminho absoluto.');
}

function rodarNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  const saida = `${r.stdout || ''}${r.stderr ? `\n${r.stderr}` : ''}`.trim();
  // Script que quebrou não é resultado de verificação: é defeito do plugin, e vira erro.
  if (r.error || /node:internal|SyntaxError|ReferenceError|TypeError:/.test(r.stderr || '')) {
    falha(`o script ${script.split(/[\\/]/).pop()} falhou ao executar:\n${saida.split('\n').slice(0, 8).join('\n')}`);
  }
  return { status: r.status, saida };
}

function git(raiz, args) {
  const r = spawnSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) falha(`git ${args.join(' ')}: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

// Artefatos versionados ou locais: .sdd/henrispec.json. Sem o arquivo, versionados.
function artefatosLocais(raiz) {
  try {
    return JSON.parse(readFileSync(join(raiz, '.sdd', 'henrispec.json'), 'utf8')).versionarArtefatos === false;
  } catch {
    return false;
  }
}

const INSTRUCOES = ['AGENTS.md', '.github/copilot-instructions.md'];

// Linhas do git status que contam como trabalho não commitado: fora a pasta de vereditos da
// mudança e os arquivos de instrução, que o init pode ter alterado localmente.
function naoCommitados(raiz, changeId, extras = []) {
  return git(raiz, ['status', '--porcelain'])
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.slice(3))
    .filter((p) => !INSTRUCOES.includes(p) && !p.startsWith(`.sdd/changes/${changeId}/revisao/`) && !extras.some((e) => p.startsWith(e)));
}

// Veredito vigente de um eixo num commit: entre <eixo>-<commit>.md, -2, -3..., o de maior número.
function vereditoVigente(dir, eixo, head) {
  const pasta = join(dir, 'revisao');
  if (!existsSync(pasta)) return null;
  const re = new RegExp(`^${eixo}-${head}(?:-(\\d+))?\\.md$`);
  const achados = readdirSync(pasta)
    .map((n) => ({ n, m: n.match(re) }))
    .filter((x) => x.m)
    .map((x) => ({ arquivo: join(pasta, x.n), nome: x.n, ordem: x.m[1] ? Number(x.m[1]) : 1 }))
    .sort((a, b) => b.ordem - a.ordem);
  return achados[0] || null;
}

function hashArquivo(raiz, caminho) {
  const r = spawnSync('git', ['hash-object', '--', caminho], { cwd: raiz, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function exigeChange(raiz, id) {
  if (!id || !ID.test(id)) falha('changeId inválido: use o change-id em kebab-case.');
  const dir = join(raiz, '.sdd', 'changes', id);
  if (!existsSync(dir)) falha(`.sdd/changes/${id}/ não existe.`);
  return dir;
}

function lerProposta(dir) {
  const pre = readFileSync(join(dir, 'proposta.md'), 'utf8').split(/^##\s+/m)[0];
  const meta = (k) => (pre.match(new RegExp(`^\\s*${k}\\s*:\\s*(\\S+)`, 'im')) || [])[1];
  return { base: meta('Base'), branch: meta('Branch') };
}

function mergeBase(raiz, base) {
  for (const ref of [base, `origin/${base}`]) {
    const r = spawnSync('git', ['merge-base', ref, 'HEAD'], { cwd: raiz, encoding: 'utf8' });
    if (r.status === 0) return r.stdout.trim();
  }
  falha(`Sem merge-base entre "${base}" e HEAD. Faça fetch de ${base}.`);
}

// ------------------------------------------------------------------ contrato

const CONTRATOS = {
  henrispec: {
    skill: 'skills/sdd-workflow/SKILL.md',
    moldes: 'skills/sdd-workflow/references/moldes-artefatos.md',
    'specs-e-deltas': 'skills/sdd-workflow/references/specs-e-deltas.md',
    decisoes: 'skills/sdd-workflow/references/decisoes.md',
    eixos: 'skills/sdd-workflow/references/eixos-de-revisao.md',
  },
  discovery: {
    skill: 'skills/discovery-workflow/SKILL.md',
    'molde-briefing': 'skills/discovery-workflow/references/molde-briefing.md',
    'tecnica-grilling': 'skills/discovery-workflow/references/tecnica-grilling.md',
    'modos-prototipo': 'skills/discovery-workflow/references/modos-prototipo.md',
  },
};

const contrato = {
  name: 'contrato',
  description: 'Devolve o texto do contrato do fluxo ou de uma das referências. Use no Passo 0 de cada agente e quando o agente mandar ler uma referência.',
  inputSchema: {
    type: 'object',
    properties: { parte: { type: 'string', enum: Object.keys(CONTRATOS[PERFIL] || {}) } },
    required: ['parte'],
  },
  async executar({ parte }) {
    const rel = CONTRATOS[PERFIL]?.[parte];
    if (!rel) falha(`parte desconhecida: ${parte}`);
    return readFileSync(join(RAIZ_PLUGIN, rel), 'utf8').replace(/^---[\s\S]*?---\s*/, '');
  },
};

const status = {
  name: 'status',
  description: 'Mostra a versão do plugin, o repositório detectado, a versão da camada do repositório (lock) e cópias antigas do toolkit que fariam sombra ao plugin.',
  inputSchema: { type: 'object', properties: { repo: { type: 'string', description: 'Caminho absoluto do repositório, só se houver mais de um aberto.' } } },
  async executar({ repo }) {
    const linhas = [`plugin ${MANIFESTO.name} ${MANIFESTO.version}, Node ${process.versions.node}`];
    let raiz;
    try {
      raiz = await raizDoRepo(repo);
    } catch (e) {
      return `${linhas[0]}\nrepositório: ${e.message}`;
    }
    linhas.push(`repositório: ${raiz}`);
    const lockPath = join(raiz, PERFIL === 'discovery' ? 'docs/henrispec-discovery/toolkit.lock.json' : '.sdd/toolkit.lock.json');
    if (existsSync(lockPath)) {
      const l = JSON.parse(readFileSync(lockPath, 'utf8'));
      linhas.push(`camada do repositório: ${l.toolkit} ${l.versao}${l.formato ? `, formato ${l.formato}` : ''}`);
    } else {
      linhas.push(PERFIL === 'discovery' ? 'camada do repositório: não é obrigatória para o discovery' : 'camada do repositório: AUSENTE. Rode /henrispec:init.');
    }
    const proprio = (n) =>
      PERFIL === 'discovery'
        ? /^(discovery-|henrispec-discovery-)/.test(n)
        : /^(sdd-|henrispec-)/.test(n) && !n.startsWith('henrispec-discovery');
    const sombras = ['.github/agents', '.github/skills', '.github/prompts']
      .flatMap((d) => (existsSync(join(raiz, d)) ? readdirSync(join(raiz, d)).map((n) => `${d}/${n}`) : []))
      .filter((p) => proprio(p.split('/').pop()));
    if (PERFIL !== 'discovery') {
      linhas.push(`artefatos de .sdd/: ${artefatosLocais(raiz) ? 'locais, fora dos commits (versionarArtefatos: false)' : 'versionados, entram nos commits'}`);
    }
    const marcador = PERFIL === 'discovery' ? 'henrispec-discovery' : 'henrispec';
    const instr = INSTRUCOES.find((f) => existsSync(join(raiz, f)));
    if (!instr) linhas.push('instruções do projeto: nenhum AGENTS.md nem copilot-instructions.md. O init cria o AGENTS.md.');
    else if (!readFileSync(join(raiz, instr), 'utf8').includes(`<!-- ${marcador}:inicio -->`)) linhas.push(`instruções do projeto: ${instr} existe, sem o bloco do plugin. Rode o init.`);
    else linhas.push(`instruções do projeto: ${instr}, com o bloco do plugin.`);
    if (existsSync(join(raiz, '.github', 'AGENTS.md'))) linhas.push('AVISO .github/AGENTS.md não é lido por padrão: mova para a raiz do repositório.');
    if (sombras.length) {
      linhas.push(`ATENÇÃO cópias antigas no repositório têm precedência sobre o plugin: ${sombras.join(', ')}. Rode o init para removê-las.`);
    }
    return linhas.join('\n');
  },
};

// ------------------------------------------------------------------ henrispec

const repoArg = { repo: { type: 'string', description: 'Caminho absoluto do repositório, só se houver mais de um aberto.' } };

const init = {
    name: 'init',
    description: 'Instala ou atualiza a camada do repositório deste plugin e remove cópias antigas intactas do toolkit, que teriam precedência sobre o plugin. Sem "aplicar", só mostra o plano.',
    inputSchema: { type: 'object', properties: { ...repoArg, aplicar: { type: 'boolean' }, forcar: { type: 'boolean' } } },
    async executar({ repo, aplicar, forcar }) {
      const raiz = await raizDoRepo(repo);
      const args = ['repo', raiz];
      if (!aplicar) args.push('--dry-run');
      if (forcar) args.push('--forcar');
      const r = rodarNode(join(RAIZ_PLUGIN, 'repo', 'instalar.mjs'), args, raiz);
      const fim = !aplicar
        ? 'Nada foi gravado. Para aplicar, chame init com aplicar=true.'
        : artefatosLocais(raiz)
          ? 'Os arquivos gerados ficam locais: estão em .git/info/exclude e não entram em commit.'
          : 'Confira e commite os arquivos criados.';
      return `${r.saida}\n\n(saída ${r.status})\n${fim}`;
    },
  };

const ferramentasHenrispec = [
  contrato,
  status,
  init,
  {
    name: 'validar',
    description: 'Roda o validador dos portões mecânicos nos artefatos de uma mudança, ou em todas as abertas.',
    inputSchema: { type: 'object', properties: { ...repoArg, changeId: { type: 'string' } } },
    async executar({ repo, changeId }) {
      const raiz = await raizDoRepo(repo);
      const r = rodarNode(join(RAIZ_PLUGIN, 'mcp', 'sdd.mjs'), ['validate', ...(changeId ? [changeId] : [])], raiz);
      return `${r.saida}\n\n(saída ${r.status}: ${r.status === 0 ? 'ok' : 'há erro'})`;
    },
  },
  {
    name: 'verificar',
    description: 'Verificação com escopo da mudança: lint, tipos e testes só nas camadas tocadas, com cada achado classificado como BLOQUEANTE ou PRÉ-EXISTENTE.',
    inputSchema: {
      type: 'object',
      properties: { ...repoArg, changeId: { type: 'string' }, so: { type: 'string', description: 'Verificações separadas por vírgula, ex.: lint' }, todos: { type: 'boolean' } },
      required: ['changeId'],
    },
    async executar({ repo, changeId, so, todos }) {
      const raiz = await raizDoRepo(repo);
      exigeChange(raiz, changeId);
      const args = [changeId, ...(so ? ['--so', so] : []), ...(todos ? ['--todos'] : [])];
      const r = rodarNode(join(RAIZ_PLUGIN, 'mcp', 'verificar.mjs'), args, raiz);
      return `${r.saida}\n\n(saída ${r.status}: ${r.status === 0 ? 'sem bloqueante' : r.status === 1 ? 'há BLOQUEANTE' : 'erro de uso ou configuração'})`;
    },
  },
  {
    name: 'baseline',
    description: 'Grava a linha de base de erros da mudança. Só antes da primeira edição, com a branch sem commits além da base.',
    inputSchema: { type: 'object', properties: { ...repoArg, changeId: { type: 'string' } }, required: ['changeId'] },
    async executar({ repo, changeId }) {
      const raiz = await raizDoRepo(repo);
      exigeChange(raiz, changeId);
      const r = rodarNode(join(RAIZ_PLUGIN, 'mcp', 'verificar.mjs'), ['baseline', changeId], raiz);
      return `${r.saida}\n\n(saída ${r.status})`;
    },
  },
  {
    name: 'git',
    description: 'Leitura do Git, nunca escrita. Consultas: estado (branch, HEAD e árvore), merge-base, diff-stat, diff, log, mostrar (conteúdo de um arquivo numa ref).',
    inputSchema: {
      type: 'object',
      properties: {
        ...repoArg,
        consulta: { type: 'string', enum: ['estado', 'merge-base', 'diff-stat', 'diff', 'log', 'mostrar'] },
        base: { type: 'string', description: 'Branch base, para merge-base, diff-stat, diff e log.' },
        caminho: { type: 'string', description: 'Restringe o diff a um caminho, ou o arquivo de "mostrar".' },
        ref: { type: 'string', description: 'Ref de "mostrar". Padrão: HEAD.' },
      },
      required: ['consulta'],
    },
    async executar({ repo, consulta, base, caminho, ref }) {
      const raiz = await raizDoRepo(repo);
      const exigeBase = () => base || falha('informe "base".');
      switch (consulta) {
        case 'estado': {
          const branch = git(raiz, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
          const head = git(raiz, ['rev-parse', '--short=7', 'HEAD']).trim();
          const sujo = git(raiz, ['status', '--porcelain']).trim();
          return `branch: ${branch}\nHEAD: ${head}\nárvore: ${sujo ? `com alterações\n${sujo}` : 'limpa'}`;
        }
        case 'merge-base':
          return mergeBase(raiz, exigeBase());
        case 'diff-stat':
          return git(raiz, ['diff', '--stat', `${mergeBase(raiz, exigeBase())}...HEAD`]);
        case 'diff':
          return git(raiz, ['diff', '--no-color', `${mergeBase(raiz, exigeBase())}...HEAD`, ...(caminho ? ['--', caminho] : [])]) || '(diff vazio)';
        case 'log':
          return git(raiz, ['log', '--oneline', '-n', '50', `${mergeBase(raiz, exigeBase())}..HEAD`]) || '(sem commits além da base)';
        case 'mostrar':
          if (!caminho) falha('informe "caminho".');
          return git(raiz, ['show', `${ref || 'HEAD'}:${caminho}`]);
        default:
          falha(`consulta desconhecida: ${consulta}`);
      }
    },
  },
  {
    name: 'ponto_de_partida',
    description: 'Para o henrispec-plan: sugere o Início da mudança (o Fim da última mudança arquivada nesta branch, ou o ponto em que a branch saiu da base) e mostra o trabalho que já existe desde ali, commitado ou não.',
    inputSchema: { type: 'object', properties: { ...repoArg, base: { type: 'string', description: 'Branch base da proposta.' } }, required: ['base'] },
    async executar({ repo, base }) {
      const raiz = await raizDoRepo(repo);
      const branch = git(raiz, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
      const head = git(raiz, ['rev-parse', 'HEAD']).trim();
      let inicio = mergeBase(raiz, base);
      let origem = `ponto em que ${branch} saiu de ${base}`;
      // Última mudança arquivada nesta branch cujo Fim é ancestral do HEAD.
      const arq = join(raiz, '.sdd', 'changes', 'archive');
      let melhor = null;
      for (const d of existsSync(arq) ? readdirSync(arq) : []) {
        const prop = join(arq, d, 'proposta.md');
        if (!existsSync(prop)) continue;
        const pre = readFileSync(prop, 'utf8').split(/^##\s+/m)[0];
        const b = (pre.match(/^\s*Branch\s*:\s*(\S+)/im) || [])[1];
        const fim = (pre.match(/^\s*Fim\s*:\s*([0-9a-f]{7,40})/im) || [])[1];
        if (b !== branch || !fim) continue;
        const anc = spawnSync('git', ['merge-base', '--is-ancestor', fim, 'HEAD'], { cwd: raiz });
        if (anc.status !== 0) continue;
        const dist = Number(git(raiz, ['rev-list', '--count', `${fim}..HEAD`]).trim());
        if (!melhor || dist < melhor.dist) melhor = { fim, dist, d };
      }
      if (melhor) {
        inicio = git(raiz, ['rev-parse', melhor.fim]).trim();
        origem = `Fim da mudança arquivada ${melhor.d}`;
      }
      const curto = (h) => h.slice(0, 7);
      // Só código: commits que mexem apenas em .sdd/ ou nas instruções são do próprio fluxo.
      const fora = ['--', '.', ':(exclude).sdd', ':(exclude)AGENTS.md', ':(exclude).github/copilot-instructions.md'];
      const log = git(raiz, ['log', '--oneline', '-n', '30', `${inicio}..HEAD`, ...fora]).trim();
      const stat = log ? git(raiz, ['diff', '--stat', `${inicio}..HEAD`, ...fora]).trim().split('\n').slice(-12).join('\n') : '';
      const sujo = naoCommitados(raiz, '-', ['.sdd/']);
      const linhas = [
        `branch: ${branch}, HEAD ${curto(head)}`,
        `Início sugerido: ${curto(inicio)} (${origem})`,
        log ? `commits desde o Início:\n${log}\narquivos:\n${stat}` : 'nenhum commit desde o Início: declare Início igual ao HEAD.',
        sujo.length ? `NÃO COMMITADO: ${sujo.slice(0, 10).join(', ')}. Pare e peça para commitar ou guardar com git stash antes de planejar.` : 'árvore: limpa',
      ];
      return linhas.join('\n');
    },
  },
  {
    name: 'hash',
    description: 'Calcula o hash de conteúdo (git hash-object, sem gravar nada) de arquivos locais, fora do Git, para amarrar o veredito ao que foi revisado.',
    inputSchema: { type: 'object', properties: { ...repoArg, caminhos: { type: 'array', items: { type: 'string' } } }, required: ['caminhos'] },
    async executar({ repo, caminhos }) {
      const raiz = await raizDoRepo(repo);
      return caminhos
        .map((c) => {
          if (!existsSync(join(raiz, c))) return `- ${c} AUSENTE`;
          return `- ${c} ${hashArquivo(raiz, c) ?? 'ERRO'}`;
        })
        .join('\n');
    },
  },
  {
    name: 'gravar_veredito',
    description: 'Grava o veredito de um eixo da revisão em .sdd/changes/<id>/revisao/<eixo>-<commit>.md. Nunca sobrescreve. O commit é o HEAD atual, conferido aqui.',
    inputSchema: {
      type: 'object',
      properties: {
        ...repoArg,
        changeId: { type: 'string' },
        eixo: { type: 'string', enum: ['padroes', 'spec'] },
        conteudo: { type: 'string', description: 'O registro completo, começando por "# <eixo> - APROVADO" ou "# <eixo> - REPROVADO".' },
      },
      required: ['changeId', 'eixo', 'conteudo'],
    },
    async executar({ repo, changeId, eixo, conteudo }) {
      const raiz = await raizDoRepo(repo);
      const dir = exigeChange(raiz, changeId);
      const head = git(raiz, ['rev-parse', '--short=7', 'HEAD']).trim();
      const sujo = naoCommitados(raiz, changeId);
      if (sujo.length) falha(`A árvore tem alteração não commitada (${sujo.slice(0, 3).join('; ')}): um veredito sobre ela não vale para nenhum commit.`);
      const cab = conteudo.trimStart().split('\n')[0].trim();
      if (!new RegExp(`^# ${eixo} - (APROVADO|REPROVADO)$`).test(cab)) falha(`A primeira linha precisa ser "# ${eixo} - APROVADO" ou "# ${eixo} - REPROVADO".`);
      const commit = (conteudo.match(/^Commit revisado:\s*(\S+)/m) || [])[1];
      if (commit !== head) falha(`"Commit revisado:" precisa ser o HEAD atual, ${head}.`);
      // Nunca sobrescreve. Revisão repetida no mesmo HEAD, comum quando a mudança é só em
      // arquivos locais e não gera commit, vira <eixo>-<commit>-2.md, -3...; vale o maior.
      mkdirSync(join(dir, 'revisao'), { recursive: true });
      const atual = vereditoVigente(dir, eixo, head);
      const nome = atual ? `${eixo}-${head}-${atual.ordem + 1}.md` : `${eixo}-${head}.md`;
      writeFileSync(join(dir, 'revisao', nome), `${conteudo.trim()}\n`, { flag: 'wx' });
      return `gravado: .sdd/changes/${changeId}/revisao/${nome}${atual ? ` (substitui ${atual.nome} como veredito vigente deste HEAD)` : ''}`;
    },
  },
  {
    name: 'arquivar',
    description: 'Do henrispec-archive: com conferir=true, só confere as precondições, no início; sem ele, no último passo, confere de novo, exige o resumo.md e move a pasta para .sdd/changes/archive/AAAA-MM-DD-<id>/.',
    inputSchema: { type: 'object', properties: { ...repoArg, changeId: { type: 'string' }, conferir: { type: 'boolean' } }, required: ['changeId'] },
    async executar({ repo, changeId, conferir }) {
      const raiz = await raizDoRepo(repo);
      const dir = exigeChange(raiz, changeId);
      const head = git(raiz, ['rev-parse', '--short=7', 'HEAD']).trim();
      for (const eixo of ['padroes', 'spec']) {
        const v = vereditoVigente(dir, eixo, head);
        if (!v) falha(`Sem veredito de ${eixo} para o HEAD atual (${head}). Rode o henrispec-review.`);
        const texto = readFileSync(v.arquivo, 'utf8');
        if (!/^# \w+ - APROVADO/.test(texto)) falha(`O veredito vigente de ${eixo} para ${head} (${v.nome}) não é APROVADO.`);
        // Revisão local: o arquivo revisado não pode ter mudado depois do veredito.
        if (/^Revisão local:\s*sim/im.test(texto)) {
          for (const m of texto.matchAll(/^-\s+(\S+)\s+([0-9a-f]{40})\s*$/gim)) {
            const atualHash = existsSync(join(raiz, m[1])) ? hashArquivo(raiz, m[1]) : null;
            if (atualHash !== m[2]) falha(`${m[1]} mudou depois da revisão de ${eixo} (${v.nome}): rode o henrispec-review de novo.`);
          }
        }
      }
      const tarefas = readFileSync(join(dir, 'tarefas.md'), 'utf8');
      if (/^\s*-\s*\[ \]/m.test(tarefas)) falha('Há tarefa pendente em tarefas.md.');
      const fora = naoCommitados(raiz, changeId, ['.sdd/specs/', '.sdd/decisoes/', `.sdd/changes/${changeId}/`]);
      if (fora.length) falha(`Alteração não commitada fora da mudança, de specs/ e de decisoes/: ${fora.slice(0, 5).join(', ')}.`);
      if (conferir) return `precondições ok para ${changeId}: dois APROVADO em ${head}, tarefas concluídas, árvore limpa.`;
      if (!existsSync(join(dir, 'resumo.md'))) falha('Falta o resumo.md da mudança (Passo 3.5): ele vai para o Jira e o Confluence, e é escrito antes de mover.');
      // Fim: o HEAD em que a mudança terminou. É o Início sugerido da próxima mudança na branch.
      const propPath = join(dir, 'proposta.md');
      const prop = readFileSync(propPath, 'utf8');
      const headCompleto = git(raiz, ['rev-parse', 'HEAD']).trim();
      const comFim = /^\s*Fim\s*:.*$/im.test(prop.split(/^##\s+/m)[0])
        ? prop.replace(/^(\s*)Fim\s*:.*$/im, `$1Fim: ${headCompleto}`)
        : prop.replace(/^(\s*Base\s*:.*)$/im, `$1\nFim: ${headCompleto}`);
      writeFileSync(propPath, comFim);
      const hoje = new Date().toISOString().slice(0, 10);
      const destino = join(raiz, '.sdd', 'changes', 'archive', `${hoje}-${changeId}`);
      if (existsSync(destino)) falha(`${destino} já existe.`);
      mkdirSync(dirname(destino), { recursive: true });
      renameSync(dir, destino);
      const n = readdirSync(destino, { recursive: true }).filter((f) => statSync(join(destino, f)).isFile()).length;
      const commit = artefatosLocais(raiz) ? 'Artefatos locais: nada de .sdd/ para commitar.' : 'Commite .sdd/.';
      return `movido: .sdd/changes/${changeId}/ → .sdd/changes/archive/${hoje}-${changeId}/ (${n} arquivo(s)). ${commit} Resumo: .sdd/changes/archive/${hoje}-${changeId}/resumo.md`;
    },
  },
];

const FERRAMENTAS = PERFIL === 'discovery' ? [contrato, status, init] : ferramentasHenrispec;
