// Carregamento de configuração compartilhado pelo hook e pela CLI.
// Só módulos nativos: o hook roda a cada tool call e não pode pagar custo de import.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const VERSAO_COLETOR = '1.0.0';

export const lerJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function carregarConfig({ dadosDir, configDir } = {}) {
  const cfgDir = resolve(configDir || process.env.HARNESS_METRICAS_CONFIG || join(RAIZ, 'config'));
  const parametros = lerJson(join(cfgDir, 'parametros.json'));
  const toolkits = lerJson(join(cfgDir, 'toolkits.json'));
  const dados = resolve(
    dadosDir || process.env.HARNESS_METRICAS_DADOS || parametros.dados_dir || join(RAIZ, 'dados')
  );
  return { raiz: RAIZ, cfgDir, dados, parametros, toolkits };
}

export function carregarTudo(opcoes = {}) {
  const base = carregarConfig(opcoes);
  return {
    ...base,
    precos: lerJson(join(base.cfgDir, 'precos.json')),
    calibracao: lerJson(join(base.cfgDir, 'calibracao.json')),
  };
}

const re = (fonte, flags = 'i') => new RegExp(fonte, flags);

// Pré-compila tudo que é regex declarada em toolkits.json.
export function compilarToolkits(tk, parametros) {
  const comandosConhecidos = new Map();
  for (const [toolkit, def] of Object.entries(tk.toolkits)) {
    for (const [cmd, etapa] of Object.entries(def.comandos || {})) {
      comandosConhecidos.set(cmd.toLowerCase(), { toolkit, etapa });
    }
  }
  return {
    comandosConhecidos,
    categorias: tk.categorias_ferramenta.map(([cat, fonte]) => [cat, re(fonte)]),
    classePorFerramenta: Object.entries(tk.classe_por_ferramenta || {}).map(([fonte, classe]) => [re(fonte), classe]),
    comandosTerminal: tk.comandos_terminal.map(([classe, fonte]) => [classe, re(fonte)]),
    resFalha: re(tk.resultado_terminal.falha),
    resSucesso: re(tk.resultado_terminal.sucesso),
    contrato: re(tk.caminhos_contrato),
    sondas: tk.sondas.map((s) => ({
      ...s,
      reCaminho: new RegExp(s.caminho),
      reContar: Object.entries(s.contar || {}).map(([campo, fonte]) => [campo, new RegExp(fonte, 'gm')]),
      reExtrair: Object.entries(s.extrair || {}).map(([campo, fonte]) => [campo, new RegExp(fonte, 'm')]),
    })),
    ticket: parametros ? new RegExp(parametros.ticket_regex, 'g') : null,
    estimativa: parametros ? new RegExp(parametros.estimativa_prompt_regex, 'i') : null,
  };
}

export function categoriaFerramenta(compilado, nome) {
  const n = String(nome || '');
  for (const [cat, rx] of compilado.categorias) if (rx.test(n)) return cat;
  return 'outra';
}

export function classeTerminal(compilado, nomeFerramenta, comando) {
  for (const [rx, classe] of compilado.classePorFerramenta) if (rx.test(nomeFerramenta || '')) return classe;
  if (typeof comando !== 'string' || !comando) return null;
  for (const [classe, rx] of compilado.comandosTerminal) if (rx.test(comando)) return classe;
  return 'outro';
}

export function globParaRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${esc}$`);
}
