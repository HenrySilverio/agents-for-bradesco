#!/usr/bin/env node
// SDD - validador de portões sintáticos.
// Arquivo único, sem dependência. Node 18+.
//
//   node .sdd/sdd.mjs validate [change-id]
//
// Sem change-id, valida todas as mudanças abertas em .sdd/changes/.
// Sai com código 1 se houver erro, 0 se não houver.
//
// Este arquivo cobre o que é mecânico: presença de campo, formato de item,
// alvo inexistente, ciclo no grafo de bloqueio. Julgamento continua no
// /sdd-review. Regra escrita em markdown custa token toda vez que carrega;
// regra escrita aqui custa zero, sempre.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const SDD = '.sdd';
const CHANGES = join(SDD, 'changes');
const SPECS = join(SDD, 'specs');
const DECISOES = join(SDD, 'decisoes');

const findings = [];
const add = (level, file, msg) => findings.push({ level, file, msg });
const erro = (file, msg) => add('ERRO', file, msg);
const aviso = (file, msg) => add('AVISO', file, msg);

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const lines = (t) => t.split(/\r?\n/);

// ---------------------------------------------------------------- proposta

const SECOES_PROPOSTA = ['Intenção', 'Escopo', 'Restrições', 'Critérios de aceite'];

function validarProposta(dir) {
  const file = join(dir, 'proposta.md');
  const txt = read(file);
  if (txt === null) return erro(file, 'proposta.md não existe');

  const preambulo = txt.split(/^##\s+/m)[0];
  for (const campo of ['Ticket', 'Branch', 'Base']) {
    if (!new RegExp(`^\\s*${campo}\\s*:\\s*\\S`, 'mi').test(preambulo)) {
      erro(file, `metadado ausente antes da primeira seção: ${campo}`);
    }
  }
  // Início e Fim são opcionais: o commit em que a mudança começou e o HEAD em que foi arquivada.
  for (const campo of ['In[ií]cio', 'Fim']) {
    const m = preambulo.match(new RegExp(`^\\s*${campo}\\s*:\\s*(\\S*)`, 'mi'));
    if (m && !/^[0-9a-f]{7,40}$/i.test(m[1])) {
      erro(file, `${campo.replace('In[ií]cio', 'Início')} precisa ser um hash de commit, de 7 a 40 caracteres: "${m[1]}"`);
    }
  }

  const titulos = lines(txt)
    .filter((l) => /^##\s+/.test(l))
    .map((l) => l.replace(/^##\s+/, '').trim());

  for (const s of SECOES_PROPOSTA) {
    if (!titulos.some((t) => t.toLowerCase() === s.toLowerCase())) {
      erro(file, `seção obrigatória ausente: ${s}`);
    }
  }

  const corpo = seccionar(txt);
  for (const s of SECOES_PROPOSTA) {
    const c = corpo[s.toLowerCase()];
    if (c !== undefined && c.trim() === '') {
      erro(file, `seção vazia: ${s}. Se não há nada a dizer, escreva "nenhuma" — vazio é indistinguível de esquecido`);
    }
  }

  const escopo = corpo['escopo'] || '';
  if (escopo && !/fora/i.test(escopo)) {
    aviso(file, 'Escopo não parece declarar o que está fora. Fora do escopo não é opcional');
  }
}

function seccionar(txt) {
  const out = {};
  let atual = null;
  for (const l of lines(txt)) {
    const m = l.match(/^##\s+(.+?)\s*$/);
    if (m) {
      atual = m[1].toLowerCase();
      out[atual] = '';
    } else if (atual !== null) {
      out[atual] += l + '\n';
    }
  }
  return out;
}

// ----------------------------------------------------------------- tarefas

function validarTarefas(dir) {
  const file = join(dir, 'tarefas.md');
  const txt = read(file);
  if (txt === null) return erro(file, 'tarefas.md não existe');

  const ls = lines(txt);
  const grupos = [];
  let atual = null;

  ls.forEach((l, i) => {
    const g = l.match(/^###\s+(\d+)\.\s+(.+?)\s*$/);
    if (g) {
      atual = { num: Number(g[1]), titulo: g[2], linha: i + 1, demonstra: null, bloqueado: null, escopo: null, itens: 0 };
      grupos.push(atual);
      return;
    }
    if (!atual) return;
    const d = l.match(/^\s*Demonstra\s*:\s*(.*)$/i);
    if (d) atual.demonstra = d[1].trim();
    const b = l.match(/^\s*Bloqueado por\s*:\s*(.*)$/i);
    if (b) atual.bloqueado = b[1].trim();
    const e = l.match(/^\s*Escopo\s*:\s*(.*)$/i);
    if (e) atual.escopo = e[1].trim();
    if (/^\s*-\s*\[.?\]/.test(l)) atual.itens++;
    if (/^\s*-\s*\[X\]/.test(l)) {
      erro(file, `linha ${i + 1}: use x minúsculo em "[X]"`);
    } else {
      const ruim = l.match(/^\s*-\s*\[(?![ x]\])([^\]]*)\]/);
      if (ruim) erro(file, `linha ${i + 1}: marcador inválido "[${ruim[1]}]". Use "[ ]" ou "[x]"`);
    }
    if (/^\s*-\s*\[[ xX]\]/.test(l) && !/^\s*-\s*\[[ xX]\]\s+\d+(\.\d+)*\s+\S/.test(l)) {
      erro(file, `linha ${i + 1}: item sem número. Formato: "- [ ] 1.2 descrição"`);
    }
    // Tarefa manual concluída precisa da linha de evidência logo abaixo: código não prova
    // conferência visual, teste manual nem aprovação.
    if (/^\s*-\s*\[x\].*\(manual\)/i.test(l)) {
      const ev = (ls[i + 1] || '').match(/^\s+Evid[êe]ncia\s*:\s*(.*)$/i);
      if (!ev || ev[1].trim().length < 10) {
        erro(file, `linha ${i + 1}: tarefa manual marcada [x] sem "Evidência:" na linha de baixo, dizendo o quê, onde, quem e quando`);
      }
    }
  });

  if (grupos.length === 0) return erro(file, 'nenhum agrupamento no formato "### N. Título"');

  const nums = grupos.map((g) => g.num);
  if (new Set(nums).size !== nums.length) erro(file, 'número de agrupamento repetido');

  const ultimo = grupos[grupos.length - 1];
  if (!/verifica/i.test(ultimo.titulo)) {
    erro(file, `o último agrupamento deve ser Verificação, e é "${ultimo.titulo}"`);
  }

  for (const g of grupos) {
    const ehVerificacao = g === ultimo;
    if (g.itens === 0) erro(file, `agrupamento ${g.num} não tem nenhum item de checklist`);
    if (g.bloqueado === null) {
      erro(file, `agrupamento ${g.num} não declara "Bloqueado por:"`);
    }
    if (ehVerificacao) {
      if (g.demonstra !== null) {
        erro(file, `agrupamento ${g.num} é a Verificação e não leva "Demonstra:"`);
      }
      if (!/^todos$/i.test((g.bloqueado || '').trim())) {
        erro(file, `agrupamento ${g.num} é a Verificação e deve declarar "Bloqueado por: todos"`);
      }
      validarEscopo(file, g);
      continue;
    }
    if (g.escopo !== null) {
      erro(file, `agrupamento ${g.num}: "Escopo:" só existe no agrupamento de Verificação`);
    }
    if (g.demonstra === null) {
      erro(file, `agrupamento ${g.num} não declara "Demonstra:"`);
    } else if (g.demonstra === '') {
      erro(file, `agrupamento ${g.num}: "Demonstra:" está vazio`);
    } else if (/\b(está|estão|foi|foram|ficou|ficaram)\s+(pront|criad|implementad|feit)[oa]s?\b/i.test(g.demonstra)) {
      // heurística deliberadamente estreita: só pega "X está pronto", que é a
      // forma canônica da fatia horizontal. Julgar o corte é do /sdd-review.
      aviso(file, `agrupamento ${g.num}: "Demonstra:" parece descrever estado de camada, não comportamento — "${g.demonstra}"`);
    }
  }

  // grafo de bloqueio
  const validos = new Set(nums);
  const arestas = new Map();
  for (const g of grupos) {
    const raw = (g.bloqueado || '').trim();
    let alvos = [];
    if (raw && !/^(nenhum|nenhuma|-|n\/a)$/i.test(raw)) {
      if (/^todos$/i.test(raw)) {
        alvos = nums.filter((n) => n !== g.num);
      } else {
        alvos = raw.split(/[,;e\s]+/).map(Number).filter((n) => !Number.isNaN(n));
        if (alvos.length === 0) erro(file, `agrupamento ${g.num}: "Bloqueado por: ${raw}" não é lista de números`);
      }
    }
    for (const a of alvos) {
      if (!validos.has(a)) erro(file, `agrupamento ${g.num} bloqueado por ${a}, que não existe`);
      if (a === g.num) erro(file, `agrupamento ${g.num} bloqueia a si mesmo`);
    }
    arestas.set(g.num, alvos.filter((a) => validos.has(a) && a !== g.num));
  }

  const primeiro = grupos[0];
  if ((arestas.get(primeiro.num) || []).length > 0) {
    erro(file, `o primeiro agrupamento (${primeiro.num}) tem bloqueio. Algum agrupamento precisa começar`);
  }

  const ciclo = acharCiclo(arestas);
  if (ciclo) erro(file, `ciclo em "Bloqueado por:": ${ciclo.join(' -> ')}`);
}

// Escopo é o conjunto de camadas de .sdd/verificacao.json que a mudança pode tocar. É ele
// que o verificar.mjs usa para rodar lint, tipos e testes só onde a mudança mexeu.
function validarEscopo(file, g) {
  const cfgPath = join(SDD, 'verificacao.json');
  if (!existsSync(cfgPath)) {
    if (g.escopo !== null) aviso(file, `"Escopo:" declarado, mas ${cfgPath} não existe: ninguém vai conferi-lo`);
    return;
  }
  if (g.escopo === null || g.escopo === '') {
    return erro(file, `a Verificação não declara "Escopo:" com as camadas de ${cfgPath}`);
  }
  let camadas = {};
  try {
    camadas = JSON.parse(readFileSync(cfgPath, 'utf8')).camadas || {};
  } catch {
    return erro(cfgPath, 'não é JSON válido');
  }
  for (const c of g.escopo.split(/[,;\s]+/).filter(Boolean)) {
    if (!camadas[c]) erro(file, `Escopo cita a camada "${c}", que não existe em ${cfgPath}`);
  }
  if (!/verificar\.mjs|henrispec\/verificar/.test(readFileSync(file, 'utf8'))) {
    aviso(file, 'a Verificação não roda o verificador (henrispec/verificar ou node .sdd/verificar.mjs): lint e teste do projeto inteiro reprovam por erro que a mudança não criou');
  }
}

function acharCiclo(arestas) {
  const BRANCO = 0, CINZA = 1, PRETO = 2;
  const cor = new Map([...arestas.keys()].map((k) => [k, BRANCO]));
  const pilha = [];
  let achado = null;

  const visitar = (n) => {
    if (achado) return;
    cor.set(n, CINZA);
    pilha.push(n);
    for (const m of arestas.get(n) || []) {
      if (cor.get(m) === CINZA) {
        achado = [...pilha.slice(pilha.indexOf(m)), m];
        return;
      }
      if (cor.get(m) === BRANCO) visitar(m);
      if (achado) return;
    }
    pilha.pop();
    cor.set(n, PRETO);
  };

  for (const n of arestas.keys()) if (cor.get(n) === BRANCO) visitar(n);
  return achado;
}

// ------------------------------------------------------------------ design

function validarDesign(dir) {
  const file = join(dir, 'design.md');
  const txt = read(file);
  if (txt === null) return; // opcional, só rigor Full

  const ls = lines(txt);
  const decisoes = [];
  let atual = null;
  let emDecisoes = false;

  ls.forEach((l, i) => {
    const h2 = l.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      emDecisoes = /decis/i.test(h2[1]);
      atual = null;
      return;
    }
    const d = l.match(/^###\s+(.+?)\s*$/);
    if (d) {
      atual = emDecisoes
        ? { titulo: d[1], linha: i + 1, durabilidade: null, substitui: null, capacidades: null }
        : null;
      if (atual) decisoes.push(atual);
      return;
    }
    if (!atual) return;
    const du = l.match(/^\s*Durabilidade\s*:\s*(\S+)/i);
    if (du) atual.durabilidade = du[1].toLowerCase().replace(/[.,]$/, '');
    const su = l.match(/^\s*Substitui\s*:\s*(DEC-\d{3})/i);
    if (su) atual.substitui = su[1].toUpperCase();
    const ca = l.match(/^\s*Capacidades\s*:\s*(.*)$/i);
    if (ca) atual.capacidades = ca[1].trim();
  });

  if (decisoes.length === 0) {
    return erro(
      file,
      'design.md sem nenhuma decisão sob o título literal "## Decisões", cada uma em "### Título". ' +
        'Sem esse formato os portões de decisão não rodam e a promoção não acontece'
    );
  }

  const idx = read(join(DECISOES, 'index.md')) || '';
  const vigentes = new Set([...idx.matchAll(/\bDEC-(\d{3})\b/g)].map((m) => `DEC-${m[1]}`));

  for (const d of decisoes) {
    if (d.durabilidade === null) {
      erro(file, `decisão "${d.titulo}" (linha ${d.linha}) não declara Durabilidade`);
    } else if (!['local', 'permanente'].includes(d.durabilidade)) {
      erro(file, `decisão "${d.titulo}": Durabilidade "${d.durabilidade}" inválida. Use local ou permanente`);
    }
    if (d.durabilidade === 'permanente' && !d.capacidades) {
      erro(file, `decisão "${d.titulo}" é permanente e não declara Capacidades. Use "nenhuma" se não afeta specs/`);
    }
    if (d.substitui) {
      if (d.durabilidade !== 'permanente') {
        erro(file, `decisão "${d.titulo}" declara Substitui mas não é permanente`);
      }
      if (!vigentes.has(d.substitui)) {
        erro(file, `decisão "${d.titulo}": Substitui ${d.substitui}, que não existe em ${DECISOES}/index.md`);
      }
    }
  }
}

// ------------------------------------------------------------------ deltas

function validarDeltas(dir) {
  const file = join(dir, 'deltas.md');
  const txt = read(file);
  if (txt === null) return; // opcional

  const entradas = [...txt.matchAll(/^\s*[-|]?\s*Opera(?:ç|c)(?:ã|a)o\s*[:|]\s*(\w+)/gim)];
  if (entradas.length === 0) return erro(file, 'deltas.md existe mas não tem nenhuma entrada com Operação');

  const alvos = [...txt.matchAll(/^\s*[-|]?\s*Alvo\s*[:|]\s*(\S+)/gim)].map((m) => m[1]);
  const caps = [...txt.matchAll(/^\s*[-|]?\s*Capacidade\s*[:|]\s*(\S+)/gim)].map((m) => m[1]);
  const ops = entradas.map((m) => m[1].toUpperCase());

  if (ops.length !== alvos.length || ops.length !== caps.length) {
    erro(
      file,
      `${ops.length} Operação, ${caps.length} Capacidade, ${alvos.length} Alvo. ` +
        'Cada entrada precisa dos três — o arquivamento usa Capacidade para escolher qual spec.md abrir'
    );
    return;
  }

  // REQ por capacidade, não em conjunto: alvo válido na capacidade errada é delta escrito
  // contra outro arquivo, e o archive aplicaria no lugar errado sem julgar.
  const reqPorCap = new Map();
  if (existsSync(SPECS)) {
    for (const cap of readdirSync(SPECS)) {
      const t = read(join(SPECS, cap, 'spec.md'));
      const s = new Set();
      if (t) for (const m of t.matchAll(/\bREQ-[\w-]+-\d{3}\b/g)) s.add(m[0]);
      reqPorCap.set(cap, s);
    }
  }

  ops.forEach((op, i) => {
    const alvo = alvos[i];
    const cap = caps[i];
    if (!['ADICIONAR', 'SUBSTITUIR', 'REMOVER'].includes(op)) {
      erro(file, `operação inválida: ${op}`);
      return;
    }
    if (op === 'ADICIONAR') {
      if (!/^novo$/i.test(alvo)) erro(file, `ADICIONAR deve ter Alvo "novo", e tem "${alvo}"`);
      return; // capacidade nova é legítima: o archive a cria
    }
    if (!/^REQ-/.test(alvo)) {
      erro(file, `${op} precisa apontar para um REQ-..., e aponta para "${alvo}"`);
      return;
    }
    if (!reqPorCap.has(cap)) {
      erro(file, `${op} ${alvo}: capacidade "${cap}" não existe em ${SPECS}. Só ADICIONAR cria capacidade`);
      return;
    }
    if (!reqPorCap.get(cap).has(alvo)) {
      const outra = [...reqPorCap].find(([, s]) => s.has(alvo));
      erro(
        file,
        outra
          ? `${op} aponta para ${alvo} sob a capacidade "${cap}", mas ele vive em "${outra[0]}"`
          : `${op} aponta para ${alvo}, que não existe em ${SPECS}. Delta escrito contra estado que já mudou`
      );
    }
  });

  if (/\b(ajustar|atualizar|melhorar) o (requisito|texto)\b/i.test(txt)) {
    aviso(file, 'algum Texto parece descrever a intenção em vez de trazer o texto final');
  }
}

// -------------------------------------------------------------------- main

function validarMudanca(id) {
  const dir = join(CHANGES, id);
  if (!existsSync(dir)) {
    erro(dir, 'mudança não existe');
    return;
  }
  validarProposta(dir);
  validarTarefas(dir);
  validarDesign(dir);
  validarDeltas(dir);
}

function abertas() {
  if (!existsSync(CHANGES)) return [];
  return readdirSync(CHANGES).filter(
    (n) => n !== 'archive' && !n.startsWith('.') && statSync(join(CHANGES, n)).isDirectory()
  );
}

const [, , cmd, arg] = process.argv;

if (cmd !== 'validate') {
  console.error('uso: node .sdd/sdd.mjs validate [change-id]');
  process.exit(2);
}

const alvo = arg ? [arg] : abertas();

if (alvo.length === 0) {
  console.log('Nenhuma mudança aberta em .sdd/changes/. Nada a validar.');
  process.exit(0);
}

for (const id of alvo) {
  const antes = findings.length;
  validarMudanca(id);
  const novos = findings.slice(antes);
  const erros = novos.filter((f) => f.level === 'ERRO').length;
  console.log(`\n${id}: ${erros === 0 ? 'ok' : `${erros} erro(s)`}${novos.length - erros ? `, ${novos.length - erros} aviso(s)` : ''}`);
  for (const f of novos) {
    console.log(`  ${f.level.padEnd(5)} ${basename(f.file).padEnd(12)} ${f.msg}`);
  }
}

const totalErros = findings.filter((f) => f.level === 'ERRO').length;
console.log(
  `\n${alvo.length} mudança(s), ${totalErros} erro(s), ${findings.length - totalErros} aviso(s).`
);
process.exit(totalErros > 0 ? 1 : 0);
