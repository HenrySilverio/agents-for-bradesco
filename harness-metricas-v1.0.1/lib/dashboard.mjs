// Dashboard HTML autocontido: sem CDN, sem fetch, abre por file:// na máquina do banco.
// Paleta: cores padrão Bradesco (cores-padrao-bradesco.md), vermelho da marca como acento.
const CSS = String.raw`
:root{
  color-scheme: light;
  --red:#cc092f; --red-dark:#9d0b21; --red-light:#d63a59; --red-xlight:#fce7ec;
  --ink:#262626; --ink-2:#47484c; --ink-3:#6d6e71; --line:#d9dcdd; --soft:#f0f1f5; --soft-2:#fafbff;
  --base-bar:#a7a8ac; --page:#f0f1f5; --surface:#ffffff;
  --ok:#09ab47; --ok-dark:#056129; --ok-bg:#e6faee;
  --warn:#ffbc00; --warn-dark:#ab6100; --warn-bg:#fefbd5;
  --err:#e1173f; --err-dark:#b00f2f; --err-bg:#fce7ec;
  --radius:14px;
  --font:"Bradesco Sans","Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--page);color:var(--ink);font-family:var(--font);font-size:14px;line-height:1.45}
a{color:var(--red-dark)}
.topo{background:linear-gradient(120deg,var(--red) 0%,var(--red-dark) 100%);color:#fff;padding:28px 24px 84px}
.topo-in{max-width:1240px;margin:0 auto;display:flex;flex-wrap:wrap;gap:16px 32px;justify-content:space-between;align-items:flex-end}
.olho{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;font-weight:600;margin:0 0 6px}
.topo h1{margin:0;font-size:clamp(22px,3vw,30px);line-height:1.15;font-weight:700}
.topo .sub{margin:6px 0 0;opacity:.92;font-size:14px}
.topo-meta{font-size:12px;opacity:.9;text-align:right}
.topo-meta div{margin-top:2px}
main{max-width:1240px;margin:-60px auto 0;padding:0 24px 48px;position:relative}
.aviso{display:flex;gap:10px;align-items:flex-start;border-radius:10px;padding:12px 14px;margin:0 0 16px;font-size:13.5px;border:1px solid}
.aviso svg{flex:0 0 18px;margin-top:1px}
.aviso strong{display:block;margin-bottom:2px}
.aviso--warn{background:var(--warn-bg);border-color:#f3dc7a;color:#5c3a00}
.aviso--warn svg{color:var(--warn-dark)}
.aviso--err{background:var(--err-bg);border-color:#f2b8c5;color:var(--err-dark)}
.grade{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}
.card{background:var(--surface);border-radius:var(--radius);box-shadow:0 1px 2px rgba(38,38,38,.06),0 4px 16px rgba(38,38,38,.05);padding:20px 22px;min-width:0}
.s12{grid-column:span 12}.s8{grid-column:span 8}.s7{grid-column:span 7}.s6{grid-column:span 6}.s5{grid-column:span 5}.s4{grid-column:span 4}
@media (max-width:980px){.s8,.s7,.s6,.s5,.s4{grid-column:span 12}}
.card-cab{display:flex;gap:8px 12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}
.card-cab h3{margin:0;font-size:15.5px;font-weight:700;color:var(--ink)}
.card-cab p{margin:3px 0 0;color:var(--ink-3);font-size:12.5px}
.card-acoes{display:flex;gap:8px;align-items:center}
.secao{margin:34px 0 12px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.secao h2{margin:0;font-size:19px;font-weight:700;color:var(--ink);padding-left:12px;border-left:4px solid var(--red)}
.secao p{margin:0;color:var(--ink-3);font-size:13px}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:2px 8px;border:1px solid var(--line);background:var(--soft);color:var(--ink-2);white-space:nowrap}
.chip i{font-style:normal;font-size:10px}
.chip--derivado{background:#fff}
.chip--estimado{background:var(--warn-bg);border-color:#f3dc7a;color:#7a4700}
.toggle{font:inherit;font-size:12px;border:1px solid var(--line);background:#fff;color:var(--ink-2);border-radius:8px;padding:4px 10px;cursor:pointer}
.toggle:hover{border-color:var(--red-light);color:var(--red-dark)}
.toggle:focus-visible,.foco:focus-visible{outline:2px solid var(--red);outline-offset:2px}
/* herói */
.heroi{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px;align-items:center}
@media (max-width:860px){.heroi{grid-template-columns:1fr}}
.heroi-rot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--ink-2);font-weight:600;font-size:13.5px}
.heroi-num{font-size:clamp(48px,7vw,64px);font-weight:700;color:var(--red);line-height:1.05;margin:8px 0 6px;letter-spacing:-.01em}
.heroi-sub{color:var(--ink-3);font-size:13px;max-width:52ch}
.comparar{display:grid;gap:14px}
.comparar-l{display:grid;gap:5px}
.comparar-t{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--ink-2)}
.comparar-t strong{color:var(--ink);font-size:14px}
.trilho{height:14px;background:var(--soft);border-radius:0 4px 4px 0}
.trilho span{display:block;height:100%;border-radius:0 4px 4px 0}
/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:16px;margin-top:16px}
.kpi{background:var(--surface);border-radius:var(--radius);padding:16px 18px;box-shadow:0 1px 2px rgba(38,38,38,.06),0 4px 16px rgba(38,38,38,.05);display:flex;flex-direction:column;gap:5px;min-width:0;border-top:3px solid var(--red)}
.kpi-rot{font-size:12.5px;color:var(--ink-2);font-weight:600}
.kpi-val{font-size:26px;font-weight:700;color:var(--ink);line-height:1.15;white-space:nowrap}
.kpi-sub{font-size:12px;color:var(--ink-3)}
.rodape-chip{margin-top:auto;padding-top:8px}
.medidor{height:8px;background:var(--red-xlight);border-radius:4px;overflow:hidden;margin-top:2px}
.medidor span{display:block;height:100%;background:var(--red);border-radius:4px}
.status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
.status svg{width:15px;height:15px}
.status--ok{color:var(--ok-dark)}.status--warn{color:var(--warn-dark)}.status--err{color:var(--err-dark)}
/* narrativa */
.narrativa{border-left:4px solid var(--red)}
.narrativa h3{font-size:14px;margin:14px 0 4px;color:var(--red-dark)}
.narrativa h3:first-child{margin-top:0}
.narrativa p,.narrativa li{color:var(--ink);font-size:14px}
.narrativa ul{margin:4px 0;padding-left:20px}
.cit{border-bottom:1px dotted var(--red-light);cursor:help;font-weight:600}
.nota{font-size:11.5px;color:var(--ink-3);margin-top:12px}
/* barras horizontais */
.legenda{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--ink-2);margin:-4px 0 12px}
.legenda span{display:inline-flex;align-items:center;gap:6px}
.legenda b{width:12px;height:12px;border-radius:3px;display:inline-block}
.hbar{display:grid;grid-template-columns:minmax(96px,38%) minmax(0,1fr);gap:4px 12px;align-items:center;padding:6px 0;border-bottom:1px solid var(--soft)}
.hbar:last-child{border-bottom:0}
.hbar-rot{font-size:13px;color:var(--ink);font-weight:600;overflow-wrap:anywhere}
.hbar-rot small{display:block;font-weight:400;color:var(--ink-3);font-size:11.5px}
.hbar-trilhas{display:grid;gap:2px;min-width:0}
.hbar-linha{display:flex;align-items:center;gap:8px;min-width:0}
.barra{height:12px;border-radius:0 4px 4px 0;flex:0 0 auto;min-width:2px;cursor:default}
.barra:hover,.barra:focus-visible{filter:brightness(1.12)}
.barra--base{background:var(--base-bar)}
.barra--acento{background:var(--red)}
.barra--neg{background:var(--red-dark)}
.hbar-val{font-size:12px;color:var(--ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}
/* colunas */
.colunas svg{display:block;width:100%;height:auto;overflow:visible}
.colunas text{font-family:var(--font);fill:var(--ink-3);font-size:11px}
.colunas .val{fill:var(--ink-2);font-weight:600}
/* tabelas */
.tab-wrap{overflow-x:auto;margin:0 -4px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3);font-weight:700;text-align:left;padding:8px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:8px 8px;border-bottom:1px solid var(--soft);vertical-align:top}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.expansivel{cursor:pointer}
tr.expansivel:hover td{background:var(--soft-2)}
tr.detalhe td{background:var(--soft-2);padding:12px 14px}
.fluxo{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.passo{font-size:11px;border-radius:6px;padding:1px 6px;border:1px solid var(--line);color:var(--ink-2);background:#fff;white-space:nowrap}
.passo--sdd{background:var(--red-xlight);border-color:#f2b8c5;color:var(--red-dark)}
.passo--design-to-code-liquid{border-color:var(--red-light);color:var(--red-dark)}
.passo--discovery{background:var(--soft);color:var(--ink-2)}
.seta{color:var(--base-bar);font-size:11px}
.alerta{display:inline-flex;align-items:center;gap:4px;font-size:11px;border-radius:6px;padding:1px 6px;margin:0 4px 4px 0;background:var(--warn-bg);color:#7a4700;border:1px solid #f3dc7a;white-space:nowrap}
.alerta--neutro{background:var(--soft);color:var(--ink-2);border-color:var(--line)}
.det-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.det-grade h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3)}
.mini td,.mini th{padding:4px 6px;font-size:12px}
/* tiles */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.tile{border:1px solid var(--soft);background:var(--soft-2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;min-width:0}
.tile-rot{font-size:12.5px;color:var(--ink-2);font-weight:600}
.tile-val{font-size:24px;font-weight:700;color:var(--ink);line-height:1.15;white-space:nowrap}
.tile-sub{font-size:12px;color:var(--ink-3)}
.lista-pend{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.lista-pend li{display:flex;gap:8px;align-items:flex-start;font-size:13px}
.lista-pend svg{flex:0 0 16px;margin-top:2px;color:var(--warn-dark)}
.vazio{color:var(--ink-3);font-size:13px;padding:12px 0}
.modelo-nome{white-space:nowrap;font-size:12.5px}
.tip{position:fixed;z-index:50;pointer-events:none;background:#fff;border:1px solid var(--line);box-shadow:0 8px 24px rgba(38,38,38,.16);border-radius:10px;padding:8px 10px;font-size:12px;max-width:280px}
.tip-tit{font-weight:700;color:var(--ink);margin-bottom:4px}
.tip-l{display:flex;align-items:center;gap:6px;color:var(--ink-2);margin-top:2px}
.tip-l strong{color:var(--ink);font-variant-numeric:tabular-nums}
.tip-k{width:12px;height:3px;border-radius:2px;display:inline-block}
footer{max-width:1240px;margin:0 auto;padding:0 24px 32px;color:var(--ink-3);font-size:12px}
@media print{
  html,body{background:#fff}
  .topo{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding-bottom:28px}
  main{margin-top:12px}
  .toggle{display:none}
  .card,.kpi{box-shadow:none;border:1px solid var(--line);break-inside:avoid}
  .barra,.medidor span,.trilho span,.chip,.passo,.alerta{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media (max-width:520px){ main{padding:0 16px 40px} .topo{padding:24px 16px 80px} .card{padding:16px} .hbar{grid-template-columns:1fr} }
`;

const JS = String.raw`
(function(){
const D = JSON.parse(document.getElementById('dados').textContent);
const NBR = (min, max) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
const F = {
  num: (n, c = 1) => n == null ? '—' : NBR(0, c).format(n),
  h: (n, c = 1) => n == null ? '—' : NBR(0, c).format(n) + ' h',
  usd: (n) => n == null ? '—' : 'US$ ' + NBR(2, 2).format(n),
  brl: (n) => n == null ? '—' : 'R$ ' + NBR(2, 2).format(n),
  int: (n) => n == null ? '—' : NBR(0, 0).format(Math.round(n)),
  pct: (n) => n == null ? '—' : NBR(0, 1).format(n) + '%',
  x: (n) => n == null ? '—' : NBR(1, 1).format(n) + '×',
  compacto: (n) => n == null ? '—' : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n),
  min: (n) => { if (n == null) return '—'; const h = Math.floor(n / 60), m = Math.round(n - h * 60); return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min'; },
  data: (v) => v == null ? '—' : new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  dataCurta: (v) => { const d = new Date(typeof v === 'string' && v.length === 10 ? v + 'T12:00:00' : v); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); },
};
const NS = 'http://www.w3.org/2000/svg';
function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return el;
}
function s(tag, attrs, ...filhos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const f of filhos.flat()) if (f != null) el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return el;
}
const ICONES = {
  alerta: 'M12 3 2 20h20L12 3Zm0 6v5m0 3v.01',
  ok: 'M5 12.5 10 17 19 7',
  erro: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3 6 6 6m0-6-6 6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v.01M12 11v5',
};
const icone = (nome) => s('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, s('path', { d: ICONES[nome] }));
const TIPOS = { Medido: ['●', ''], Derivado: ['◐', 'chip--derivado'], Estimado: ['≈', 'chip--estimado'] };
const chip = (tipo) => { const [i, c] = TIPOS[tipo] || TIPOS.Medido; return h('span', { class: 'chip ' + c, title: 'Tipo de métrica: ' + tipo }, h('i', { text: i }), tipo); };
const status = (nivel, texto) => h('span', { class: 'status status--' + nivel }, icone(nivel === 'ok' ? 'ok' : nivel === 'err' ? 'erro' : 'alerta'), texto);

// ── tooltip ──
const tip = h('div', { class: 'tip', role: 'tooltip', hidden: true });
document.body.append(tip);
function mostrarTip(ev, titulo, linhas) {
  tip.replaceChildren(h('div', { class: 'tip-tit', text: titulo }), ...linhas.map(([valor, rotulo, cor]) => h('div', { class: 'tip-l' }, cor ? h('span', { class: 'tip-k', style: { background: cor } }) : null, h('strong', { text: valor }), h('span', { text: rotulo }))));
  tip.hidden = false;
  let x, y;
  if (ev.type === 'focus') { const r = ev.target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
  else { x = ev.clientX; y = ev.clientY; }
  const w = tip.offsetWidth, hh = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + 'px';
  tip.style.top = Math.max(8, y - hh - 12) + 'px';
}
const esconderTip = () => { tip.hidden = true; };
function comTip(el, titulo, linhas) {
  el.tabIndex = 0;
  el.classList.add('foco');
  el.setAttribute('aria-label', titulo + ': ' + linhas.map((l) => l[1] + ' ' + l[0]).join(', '));
  el.addEventListener('pointermove', (e) => mostrarTip(e, titulo, linhas));
  el.addEventListener('pointerleave', esconderTip);
  el.addEventListener('focus', (e) => mostrarTip(e, titulo, linhas));
  el.addEventListener('blur', esconderTip);
  return el;
}

// ── blocos ──
function cartao({ titulo, sub, tipo, corpo, tabela, span = 's12' }) {
  const acoes = h('div', { class: 'card-acoes' }, tipo ? chip(tipo) : null);
  const conteudo = h('div', {}, corpo);
  let tab = null;
  if (tabela && corpo) {
    tab = h('div', { class: 'tab-wrap', hidden: true }, tabela);
    const bt = h('button', { class: 'toggle', type: 'button', 'aria-pressed': 'false', text: 'Ver tabela' });
    bt.addEventListener('click', () => {
      const ativo = tab.hidden;
      tab.hidden = !ativo; conteudo.hidden = ativo;
      bt.textContent = ativo ? 'Ver gráfico' : 'Ver tabela';
      bt.setAttribute('aria-pressed', String(ativo));
    });
    acoes.append(bt);
  }
  return h('section', { class: 'card ' + span },
    h('div', { class: 'card-cab' }, h('div', {}, h('h3', { text: titulo }), sub ? h('p', { text: sub }) : null), acoes),
    corpo ? conteudo : h('div', { class: 'tab-wrap' }, tabela), tab);
}
function tabela(colunas, linhas) {
  return h('table', {},
    h('thead', {}, h('tr', {}, colunas.map((c) => h('th', { class: c.n ? 'n' : null, scope: 'col', text: c.t })))),
    h('tbody', {}, linhas.map((l) => h('tr', {}, l.map((v, i) => h('td', { class: colunas[i].n ? 'n' : null }, v))))));
}
function kpi({ rotulo, valor, sub, tipo, extra }) {
  return h('div', { class: 'kpi' }, h('div', { class: 'kpi-rot', text: rotulo }), h('div', { class: 'kpi-val', text: valor }), extra || null, sub ? h('div', { class: 'kpi-sub', text: sub }) : null, tipo ? h('div', { class: 'rodape-chip' }, chip(tipo)) : null);
}
function tile({ rotulo, valor, sub, tipo, extra }) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-rot', text: rotulo }), h('div', { class: 'tile-val', text: valor }), extra || null, sub ? h('div', { class: 'tile-sub', text: sub }) : null, tipo ? h('div', { class: 'rodape-chip' }, chip(tipo)) : null);
}
const medidor = (pct) => h('div', { class: 'medidor', role: 'img', 'aria-label': F.pct(pct) }, h('span', { style: { width: Math.max(0, Math.min(100, pct || 0)) + '%' } }));
const secao = (titulo, sub) => h('div', { class: 'secao' }, h('h2', { text: titulo }), sub ? h('p', { text: sub }) : null);
const vazio = (texto) => h('div', { class: 'vazio', text: texto });

function barrasH(linhas, { formato, max }) {
  if (!linhas.length) return vazio('Sem dados no período.');
  const topo = max ?? (Math.max(...linhas.map((l) => Math.abs(l.valor)), 0) || 1);
  return h('div', {}, linhas.map((l) => {
    const pct = Math.abs(l.valor) / topo;
    const barra = h('span', { class: 'barra ' + (l.valor < 0 ? 'barra--neg' : 'barra--acento'), style: { width: 'calc((100% - 92px) * ' + pct.toFixed(4) + ')' } });
    comTip(barra, l.rotulo, l.tip || [[formato(l.valor), '']]);
    return h('div', { class: 'hbar' }, h('div', { class: 'hbar-rot' }, l.rotulo, l.sub ? h('small', { text: l.sub }) : null),
      h('div', { class: 'hbar-trilhas' }, h('div', { class: 'hbar-linha' }, barra, h('span', { class: 'hbar-val', text: formato(l.valor) }))));
  }));
}

function barrasPareadas(linhas) {
  if (!linhas.length) return vazio('Nenhuma atividade concluída com estimativa no período.');
  const topo = Math.max(...linhas.flatMap((l) => [l.a, l.b]), 0) || 1;
  const leg = h('div', { class: 'legenda' },
    h('span', {}, h('b', { style: { background: 'var(--base-bar)' } }), 'Sem IA — estimativa de referência'),
    h('span', {}, h('b', { style: { background: 'var(--red)' } }), 'Com IA — tempo ativo + sobrecarga'));
  return h('div', {}, leg, linhas.map((l) => {
    const tips = [[F.h(l.a), 'sem IA (' + l.fonte + ')', 'var(--base-bar)'], [F.h(l.b), 'com IA', 'var(--red)'], [F.h(l.eco), 'economizadas'], [F.x(l.fator), 'fator']];
    const mk = (v, cls) => comTip(h('span', { class: 'barra ' + cls, style: { width: 'calc((100% - 64px) * ' + (v / topo).toFixed(4) + ')' } }), l.rotulo, tips);
    return h('div', { class: 'hbar' },
      h('div', { class: 'hbar-rot' }, l.rotulo, h('small', { text: 'referência ' + l.fonte + ' · ' + F.x(l.fator) })),
      h('div', { class: 'hbar-trilhas' },
        h('div', { class: 'hbar-linha' }, mk(l.a, 'barra--base'), h('span', { class: 'hbar-val', text: F.h(l.a) })),
        h('div', { class: 'hbar-linha' }, mk(l.b, 'barra--acento'), h('span', { class: 'hbar-val', text: F.h(l.b) }))));
  }));
}

function passoBonito(passo) {
  if (passo === 'livre') return 'livre';
  const [tk, etapa] = passo.split('.');
  const nomes = { discovery: 'Discovery', sdd: 'SDD', 'design-to-code-liquid': 'D2C Liquid' };
  return (nomes[tk] || tk) + ' · ' + etapa;
}

function colunas(pontos) {
  const cont = h('div', { class: 'colunas' });
  if (!pontos.length) { cont.append(vazio('Sem atividades concluídas no período.')); return cont; }
  const desenhar = () => {
    const W = Math.max(280, cont.clientWidth || 520), H = 230, m = { l: 44, r: 10, t: 22, b: 30 };
    const vals = pontos.map((p) => p.horas_economizadas);
    const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
    const bruto = (maxV - minV) / 4 || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto);
    const topo = Math.ceil(maxV / passo) * passo || passo, base = Math.floor(minV / passo) * passo;
    const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - base) / (topo - base));
    const banda = (W - m.l - m.r) / pontos.length, larg = Math.min(24, banda * 0.6);
    const svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Horas economizadas por semana' });
    for (let v = base; v <= topo + 1e-9; v += passo) {
      svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v === 0 ? '#a7a8ac' : '#e6e8ea', 'stroke-width': 1 }));
      svg.append(s('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, F.num(v, 0)));
    }
    const iMax = vals.indexOf(maxV), iUlt = vals.length - 1;
    pontos.forEach((p, i) => {
      const cx = m.l + banda * i + banda / 2, v = p.horas_economizadas;
      const y0 = y(0), y1 = y(v), alto = Math.abs(y0 - y1), r = Math.min(4, alto);
      const x0 = cx - larg / 2;
      const d = v >= 0
        ? 'M' + x0 + ',' + y0 + 'V' + (y1 + r) + 'Q' + x0 + ',' + y1 + ' ' + (x0 + r) + ',' + y1 + 'H' + (x0 + larg - r) + 'Q' + (x0 + larg) + ',' + y1 + ' ' + (x0 + larg) + ',' + (y1 + r) + 'V' + y0 + 'Z'
        : 'M' + x0 + ',' + y0 + 'V' + (y1 - r) + 'Q' + x0 + ',' + y1 + ' ' + (x0 + r) + ',' + y1 + 'H' + (x0 + larg - r) + 'Q' + (x0 + larg) + ',' + y1 + ' ' + (x0 + larg) + ',' + (y1 - r) + 'V' + y0 + 'Z';
      svg.append(s('path', { d, fill: v >= 0 ? '#cc092f' : '#9d0b21' }));
      if (i === iMax || i === iUlt) svg.append(s('text', { x: cx, y: (v >= 0 ? y1 - 6 : y1 + 14), 'text-anchor': 'middle', class: 'val' }, F.num(v, 1)));
      const mostrarRotulo = pontos.length <= 10 || i % 2 === 0;
      if (mostrarRotulo) svg.append(s('text', { x: cx, y: H - 10, 'text-anchor': 'middle' }, F.dataCurta(p.inicio)));
      const alvo = s('rect', { x: m.l + banda * i, y: m.t, width: banda, height: H - m.t - m.b, fill: 'transparent', tabindex: 0 });
      const titulo = 'Semana de ' + F.dataCurta(p.inicio);
      const linhas = [[F.h(v), 'economizadas', '#cc092f'], [F.int(p.atividades), p.atividades === 1 ? 'atividade concluída' : 'atividades concluídas']];
      alvo.setAttribute('aria-label', titulo + ': ' + F.h(v));
      alvo.addEventListener('pointermove', (e) => mostrarTip(e, titulo, linhas));
      alvo.addEventListener('pointerleave', esconderTip);
      alvo.addEventListener('focus', (e) => mostrarTip(e, titulo, linhas));
      alvo.addEventListener('blur', esconderTip);
      svg.append(alvo);
    });
    cont.replaceChildren(svg);
  };
  requestAnimationFrame(desenhar);
  if ('ResizeObserver' in window) { let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(desenhar, 80); }).observe(cont); }
  return cont;
}

const ROTULO_ALERTA = {
  estimativa_nao_cega: ['Estimativa registrada após o início', 'warn'],
  sem_estimativa: ['Sem estimativa do dev', 'warn'],
  divergencia: ['Estimativas divergentes', 'warn'],
  fonte_unica: ['Referência de fonte única', 'neutro'],
  nao_concluida: ['Em andamento', 'neutro'],
  sessao_sem_tokens: ['Sessão sem tokens', 'warn'],
  modelo_sem_preco: ['Modelo sem preço', 'warn'],
  correlacao_ambigua: ['Correlação de tokens ambígua', 'warn'],
  sid_fallback: ['Sessão sem ID do hook', 'warn'],
  multiplos_tickets: ['Mais de um ticket agrupado', 'warn'],
};
const alertaChip = (a) => { const [t, n] = ROTULO_ALERTA[a] || [a, 'neutro']; return h('span', { class: 'alerta' + (n === 'neutro' ? ' alerta--neutro' : '') }, t); };
const fluxoChips = (fluxo) => h('div', { class: 'fluxo' }, fluxo.flatMap((p, i) => [i ? h('span', { class: 'seta', text: '→' }) : null, h('span', { class: 'passo passo--' + p.split('.')[0], text: passoBonito(p) })]));

// ───────────── montagem ─────────────
const K = D.kpi, raiz = document.getElementById('app');

if (D.demo) raiz.append(h('div', { class: 'aviso aviso--warn', role: 'note' }, icone('alerta'), h('div', {}, h('strong', { text: 'Dados sintéticos de demonstração' }), 'Gerados por hm demo para validar o painel. Não apresente estes números como resultado.')));
if (D.pendencias.calibracao_placeholder) raiz.append(h('div', { class: 'aviso aviso--warn', role: 'note' }, icone('alerta'), h('div', {}, h('strong', { text: 'Tabela de calibração ainda com valores de exemplo' }), 'A estimativa paramétrica usa config/calibracao.json sem calibração da squad. Calibre antes de levar horas economizadas para a gerência.')));

// herói
const semIa = K.horas_sem_ia_ref || 0, comIa = K.horas_com_ia || 0, topoH = Math.max(semIa, comIa) || 1;
raiz.append(h('section', { class: 'card heroi', 'aria-label': 'Resultado principal' },
  h('div', {},
    h('div', { class: 'heroi-rot' }, h('span', { text: 'Horas economizadas' }), chip('Estimado')),
    h('div', { class: 'heroi-num', text: F.h(K.horas_economizadas) }),
    h('div', { class: 'heroi-sub', text: 'Em ' + F.int(K.atividades_com_ganho) + ' atividades concluídas no período. Referência sem IA = ' + (D.parametros.estrategia_referencia === 'minimo' ? 'menor valor entre a estimativa cega do dev e a tabela calibrada' : 'estimativa ' + D.parametros.estrategia_referencia) + '.' })),
  h('div', { class: 'comparar' },
    h('div', { class: 'comparar-l' }, h('div', { class: 'comparar-t' }, h('span', { text: 'Sem IA — referência' }), h('strong', { text: F.h(semIa) })), h('div', { class: 'trilho' }, h('span', { style: { width: (semIa / topoH * 100) + '%', background: 'var(--base-bar)' } }))),
    h('div', { class: 'comparar-l' }, h('div', { class: 'comparar-t' }, h('span', { text: 'Com IA — tempo ativo + ' + D.parametros.sobrecarga_humana_fora_sessao_pct + '% de sobrecarga' }), h('strong', { text: F.h(comIa) })), h('div', { class: 'trilho' }, h('span', { style: { width: (comIa / topoH * 100) + '%', background: 'var(--red)' } }))),
    h('div', { class: 'comparar-t' }, h('span', { text: 'Fator de produtividade' }), h('strong', { text: F.x(K.fator_produtividade) })))));

// KPIs
const g = D.seguranca;
raiz.append(h('div', { class: 'kpis' },
  kpi({ rotulo: 'Fator de produtividade', valor: F.x(K.fator_produtividade), sub: 'horas sem IA ÷ horas com IA', tipo: 'Estimado' }),
  kpi({ rotulo: 'Custo de consumo', valor: F.usd(K.custo_usd), sub: F.int(K.creditos) + ' créditos · valor de lista' + (K.custo_brl != null ? ' · ' + F.brl(K.custo_brl) : ''), tipo: 'Derivado' }),
  kpi({ rotulo: 'Custo por atividade concluída', valor: F.usd(K.custo_por_atividade_usd), sub: 'todas as sessões da atividade', tipo: 'Derivado' }),
  kpi({ rotulo: 'Economia do roteamento de modelos', valor: F.usd(K.economia_roteamento_usd), sub: 'vs. tudo em ' + D.parametros.modelo_referencia_roteamento, tipo: 'Estimado' }),
  kpi({ rotulo: 'Guard-rails acionados', valor: F.int(K.guardrails_acionados), sub: F.int(g.deny) + ' bloqueios · ' + F.int(g.ask) + ' confirmações · ' + F.int(g.validador.falhas) + ' portões · ' + F.int(g.git_escrita_interrompida) + ' git barrados', tipo: 'Medido' }),
  kpi({ rotulo: 'Aprovação na 1ª revisão', valor: F.pct(K.aprovacao_primeira_revisao_pct), sub: F.int(D.qualidade.aprovadas_primeira) + ' de ' + F.int(D.qualidade.atividades_com_revisao) + ' atividades revisadas', tipo: 'Medido', extra: medidor(K.aprovacao_primeira_revisao_pct) })));

// narrativa (pré-renderizada e validada no build)
const narr = document.getElementById('narrativa-fonte');
if (narr && narr.innerHTML.trim()) {
  const card = h('section', { class: 'card narrativa', style: { marginTop: '16px' } }, h('div', { class: 'card-cab' }, h('div', {}, h('h3', { text: 'Leitura executiva' })), h('div', { class: 'card-acoes' }, chip('Derivado'))));
  const corpo = h('div', {}); corpo.innerHTML = narr.innerHTML; card.append(corpo);
  card.append(h('div', { class: 'nota', text: 'Texto redigido por agente a partir de resumo-narrativa.json. O build conferiu cada número contra a chave de origem; passe o mouse sobre um número para ver a fonte.' }));
  raiz.append(card);
}

// produtividade
raiz.append(secao('Produtividade', 'Atividades reconhecidas na data de conclusão'));
const prod = [...D.produtividade.por_atividade].sort((a, b) => b.sem_ia_h - a.sem_ia_h);
raiz.append(h('div', { class: 'grade' },
  cartao({ span: 's7', titulo: 'Horas por atividade concluída', sub: 'Estimativa sem IA vs. tempo com IA', tipo: 'Estimado',
    corpo: barrasPareadas(prod.map((a) => ({ rotulo: a.rotulo, a: a.sem_ia_h, b: a.com_ia_h, eco: a.economizadas_h, fator: a.fator, fonte: a.fonte === 'cega' ? 'cega' : 'paramétrica' }))),
    tabela: tabela([{ t: 'Atividade' }, { t: 'Sem IA', n: 1 }, { t: 'Fonte' }, { t: 'Com IA', n: 1 }, { t: 'Economia', n: 1 }, { t: 'Fator', n: 1 }], prod.map((a) => [a.rotulo, F.h(a.sem_ia_h), a.fonte, F.h(a.com_ia_h), F.h(a.economizadas_h), F.x(a.fator)])) }),
  cartao({ span: 's5', titulo: 'Horas economizadas por semana', sub: 'Soma das atividades concluídas na semana', tipo: 'Estimado',
    corpo: colunas(D.produtividade.por_semana),
    tabela: tabela([{ t: 'Semana de' }, { t: 'Horas', n: 1 }, { t: 'Atividades', n: 1 }], D.produtividade.por_semana.map((p) => [F.data(p.inicio + 'T12:00:00'), F.h(p.horas_economizadas), F.int(p.atividades)])) })));

// custo
raiz.append(secao('Custo e tokens', 'Todas as sessões iniciadas no período · preços ' + D.precos.consultado_em));
const et = D.custo.etapas;
const tk = D.custo.tokens, entradaTot = tk.entrada_nova + tk.cache_leitura + tk.cache_escrita;
const modelos = D.custo.modelos;
raiz.append(h('div', { class: 'grade' },
  cartao({ span: 's7', titulo: 'Custo por etapa do fluxo', sub: 'Valor de lista em dólar', tipo: 'Derivado',
    corpo: barrasH(et.map((e) => ({ rotulo: e.rotulo, valor: e.usd, sub: F.int(e.sessoes) + (e.sessoes === 1 ? ' sessão' : ' sessões') + ' · média ' + F.usd(e.usd_medio_sessao), tip: [[F.usd(e.usd), 'custo'], [F.int(e.sessoes), 'sessões'], [F.usd(e.usd_medio_sessao), 'por sessão'], [F.min(e.ativo_min), 'tempo ativo'], [F.compacto(e.tokens), 'tokens']] })), { formato: F.usd }),
    tabela: tabela([{ t: 'Etapa' }, { t: 'Sessões', n: 1 }, { t: 'Tempo ativo', n: 1 }, { t: 'Custo', n: 1 }, { t: 'Por sessão', n: 1 }, { t: 'Cache', n: 1 }, { t: 'Tokens', n: 1 }], et.map((e) => [e.rotulo, F.int(e.sessoes), F.min(e.ativo_min), F.usd(e.usd), F.usd(e.usd_medio_sessao), F.pct(e.cache_pct), F.compacto(e.tokens)])) }),
  cartao({ span: 's5', titulo: 'Consumo por modelo', sub: 'Tokens medidos pelo OpenTelemetry do Copilot', tipo: 'Medido',
    tabela: h('div', {},
      h('div', { style: { margin: '0 4px 14px' } }, h('div', { class: 'comparar-t' }, h('span', { text: 'Entrada servida por cache' }), h('strong', { text: F.pct(K.cache_entrada_pct) })), medidor(K.cache_entrada_pct)),
      tabela([{ t: 'Modelo' }, { t: 'Tokens', n: 1 }, { t: 'Custo', n: 1 }, { t: '% do custo', n: 1 }],
        modelos.map((m) => [
          h('span', { class: 'modelo-nome' }, m.modelo, m.com_preco ? null : h('span', { class: 'alerta', text: 'sem preço' })),
          F.compacto(m.entrada_nova + m.cache_leitura + m.cache_escrita + m.saida),
          m.com_preco ? F.usd(m.usd) : '—', m.com_preco ? F.pct(m.pct_usd) : '—'])),
      h('div', { class: 'nota', text: F.compacto(tk.entrada_nova) + ' tokens de entrada nova · ' + F.compacto(tk.cache_leitura + tk.cache_escrita) + ' de cache · ' + F.compacto(tk.saida) + ' de saída (' + F.compacto(entradaTot + tk.saida) + ' no total).' })) })));

// segurança
raiz.append(secao('Segurança e guard-rails', 'Barreiras que impediram ação indevida ou exigiram decisão humana'));
const bar = g.barreiras;
const viol = g.git_escrita_executada;
raiz.append(h('div', { class: 'grade' },
  cartao({ span: 's7', titulo: 'Barreiras acionadas', sub: 'Hooks de guarda, portões do validador e invariantes', tipo: 'Medido',
    corpo: barrasH(bar.map((b) => ({ rotulo: b.rotulo, valor: b.valor, sub: b.grupo })), { formato: F.int }),
    tabela: tabela([{ t: 'Barreira' }, { t: 'Origem' }, { t: 'Vezes', n: 1 }], bar.map((b) => [b.rotulo, b.grupo, F.int(b.valor)])) }),
  cartao({ span: 's5', titulo: 'Invariantes e exposição', sub: 'O que passou pelas barreiras', tipo: 'Medido',
    tabela: h('div', { class: 'tiles' },
      tile({ rotulo: 'Violações de invariante', valor: F.int(viol), sub: 'git de escrita executado pelo agente', extra: viol ? status('err', 'Investigar sessão') : status('ok', 'Nenhuma') }),
      tile({ rotulo: 'Arquivos de contrato editados', valor: F.int(g.contrato_editados), sub: 'federation, OpenAPI, manifest, CONTRACT.md' }),
      tile({ rotulo: 'Lacunas explicitadas', valor: F.int(g.lacunas_explicitadas), sub: 'marcadores [NÃO RESPONDIDO] em vez de requisito inventado' }),
      tile({ rotulo: 'Ferramentas interrompidas', valor: F.int(g.ferramentas_interrompidas), sub: 'chamada iniciada sem conclusão (bloqueio, recusa ou falha)' })) })));

// qualidade
const q = D.qualidade;
raiz.append(secao('Qualidade do código entregue', 'Sinais medidos durante o fluxo, antes do merge'));
raiz.append(h('div', { class: 'grade' }, cartao({ span: 's12', titulo: 'Indicadores de qualidade', tipo: 'Medido',
  tabela: h('div', { class: 'tiles' },
    tile({ rotulo: 'Aprovação na 1ª revisão', valor: F.pct(q.aprovacao_primeira_pct), sub: 'eixos spec e padrões aprovados de primeira', extra: medidor(q.aprovacao_primeira_pct) }),
    tile({ rotulo: 'Retrabalho na revisão', valor: F.int(q.reprovacoes), sub: 'vereditos REPROVADO que voltaram ao plan' }),
    tile({ rotulo: 'Falhas do validador', valor: F.int(q.validador.falhas), sub: 'de ' + F.int(q.validador.execucoes) + ' execuções · barradas antes da revisão' }),
    tile({ rotulo: 'Testes falhando na sessão', valor: F.int(q.testes.falhas), sub: 'de ' + F.int(q.testes.execucoes) + ' execuções · corrigidos no mesmo ciclo' }),
    q.d2c.componentes ? tile({ rotulo: 'CSS custom por componente', valor: F.num(q.d2c.css_por_componente, 1), sub: F.num(q.d2c.liquid_por_componente, 1) + ' elementos Liquid por componente · ' + F.int(q.d2c.componentes) + ' gerados', tipo: 'Derivado' }) : null,
    q.sobrevivencia_edicoes ? tile({ rotulo: 'Edições do agente mantidas', valor: F.pct(q.sobrevivencia_edicoes.sem_reversao_pct), sub: 'sem reversão pelo dev (métrica do Copilot)' }) : null,
    tile({ rotulo: 'Compactações de contexto', valor: F.num(q.compactacoes_por_sessao, 2), sub: 'por sessão · sinal de pressão de tokens' })) })));

// camadas
raiz.append(secao('Por camada do harness', 'Uso e custo de cada toolkit e etapa'));
raiz.append(h('div', { class: 'grade' }, cartao({ span: 's12', titulo: 'Toolkits e etapas', sub: 'Sessão sem toolkit = chat livre, sem comando do harness', tipo: 'Medido',
  tabela: tabela([{ t: 'Camada' }, { t: 'Sessões', n: 1 }, { t: 'Tempo ativo', n: 1 }, { t: 'Custo', n: 1 }, { t: 'Por sessão', n: 1 }, { t: 'Cache', n: 1 }, { t: 'Tokens', n: 1 }, { t: 'Prompts', n: 1 }, { t: 'Ferramentas', n: 1 }, { t: 'Modelos' }],
    et.map((e) => [e.rotulo, F.int(e.sessoes), F.min(e.ativo_min), F.usd(e.usd), F.usd(e.usd_medio_sessao), F.pct(e.cache_pct), F.compacto(e.tokens), F.int(e.prompts), F.int(e.ferramentas), e.modelos.join(', ') || '—'])) })));

// atividades
raiz.append(secao('Atividades', 'Clique numa linha para ver estimativas e sessões'));
const colsAt = [{ t: 'Atividade' }, { t: 'Fluxo' }, { t: 'Sem IA', n: 1 }, { t: 'Com IA', n: 1 }, { t: 'Economia', n: 1 }, { t: 'Custo', n: 1 }, { t: 'Revisão' }, { t: 'Alertas' }];
const corpoAt = h('tbody', {});
for (const a of D.atividades) {
  const revisao = a.qualidade.aprovada_primeira == null ? '—' : a.qualidade.aprovada_primeira ? status('ok', 'de primeira') : status('warn', F.int(a.qualidade.reprovacoes) + (a.qualidade.reprovacoes === 1 ? ' reprovação' : ' reprovações'));
  const linha = h('tr', { class: 'expansivel', tabindex: 0, 'aria-expanded': 'false' },
    h('td', {}, h('strong', { text: a.rotulo }), h('div', { class: 'kpi-sub', text: (a.concluida ? 'concluída ' : 'última sessão ') + F.data(a.fim) })),
    h('td', {}, fluxoChips(a.fluxo)),
    h('td', { class: 'n' }, F.h(a.estimativa.referencia_h)),
    h('td', { class: 'n' }, F.h(a.tempo.com_ia_h)),
    h('td', { class: 'n' }, a.ganho ? F.h(a.ganho.horas_economizadas) : '—'),
    h('td', { class: 'n' }, F.usd(a.custo.usd)),
    h('td', {}, revisao),
    h('td', {}, a.alertas.map(alertaChip)));
  const e = a.estimativa;
  const det = h('tr', { class: 'detalhe', hidden: true }, h('td', { colspan: colsAt.length },
    h('div', { class: 'det-grade' },
      h('div', {}, h('h4', { text: 'Estimativas sem IA' }),
        h('table', { class: 'mini' }, h('tbody', {},
          h('tr', {}, h('td', { text: 'Cega (dev)' }), h('td', { class: 'n', text: F.h(e.cega_h) }), h('td', { text: e.cega_registrada_em ? 'registrada ' + F.data(e.cega_registrada_em) + ' via ' + e.cega_origem : (e.nao_cega_h != null ? 'não cega: ' + F.h(e.nao_cega_h) : 'não registrada') })),
          h('tr', {}, h('td', { text: 'Paramétrica' }), h('td', { class: 'n', text: F.h(e.parametrica_h) }), h('td', { text: e.parametrica_detalhe.map((d) => d.quantidade + ' × ' + d.rotulo + ' (' + F.h(d.horas_unidade) + ')').join(' + ') || '—' })),
          h('tr', {}, h('td', { text: 'Referência' }), h('td', { class: 'n', text: F.h(e.referencia_h) }), h('td', { text: (e.referencia_fonte || '—') + (e.divergencia_pct != null ? ' · divergência ' + F.pct(e.divergencia_pct) : '') }))))),
      h('div', {}, h('h4', { text: 'Sessões' }),
        h('table', { class: 'mini' }, h('thead', {}, h('tr', {}, ['Data', 'Etapa', 'Ativo', 'Custo', 'Modelo'].map((t, i) => h('th', { class: i === 2 || i === 3 ? 'n' : null, text: t })))),
          h('tbody', {}, a.sessoes_detalhe.map((s) => h('tr', {}, h('td', { text: F.data(s.inicio) }), h('td', { text: passoBonito(s.passo) }), h('td', { class: 'n', text: F.min(s.ativo_min) }), h('td', { class: 'n', text: F.usd(s.usd) }), h('td', { text: s.modelos.join(', ') || '—' })))))),
      h('div', {}, h('h4', { text: 'Qualidade e segurança' }),
        h('table', { class: 'mini' }, h('tbody', {},
          h('tr', {}, h('td', { text: 'Vereditos' }), h('td', { text: a.qualidade.vereditos.map((v) => v.eixo + ': ' + v.veredito).join(' · ') || '—' })),
          h('tr', {}, h('td', { text: 'Validador' }), h('td', { text: F.int(a.qualidade.validador.falhas) + ' falhas em ' + F.int(a.qualidade.validador.execucoes) })),
          h('tr', {}, h('td', { text: 'Testes' }), h('td', { text: F.int(a.qualidade.testes.falhas) + ' falhas em ' + F.int(a.qualidade.testes.execucoes) })),
          h('tr', {}, h('td', { text: 'Guard-rails' }), h('td', { text: F.int(a.seguranca.guardrails.deny) + ' bloqueios · ' + F.int(a.seguranca.guardrails.ask) + ' confirmações' })),
          h('tr', {}, h('td', { text: 'Lacunas' }), h('td', { text: F.int(a.qualidade.lacunas_explicitadas) + ' [NÃO RESPONDIDO]' })),
          h('tr', {}, h('td', { text: 'Arquivos editados' }), h('td', { text: F.int(a.arquivos_editados) + ' · lead time ' + F.num(a.lead_time_dias, 1) + ' dias' }))))))));
  const alternar = () => { det.hidden = !det.hidden; linha.setAttribute('aria-expanded', String(!det.hidden)); };
  linha.addEventListener('click', alternar);
  linha.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alternar(); } });
  corpoAt.append(linha, det);
}
raiz.append(h('div', { class: 'grade' }, h('section', { class: 'card s12' },
  D.atividades.length ? h('div', { class: 'tab-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, colsAt.map((c) => h('th', { class: c.n ? 'n' : null, text: c.t })))), corpoAt)) : vazio('Nenhuma atividade no período.'),
  D.sessoes_sem_atividade.length ? h('div', { class: 'nota', text: F.int(D.sessoes_sem_atividade.length) + ' sessões sem atividade vinculada (chat livre sem ticket, branch ignorada ou conversa sem hook). Use hm vincular <sessão> <atividade> para corrigir.' }) : null)));

// metodologia
const c = D.cobertura, p = D.pendencias;
raiz.append(secao('Metodologia e confiabilidade', 'Como cada número foi obtido e onde ele é frágil'));
const pend = [];
if (p.calibracao_placeholder) pend.push('Tabela de calibração com valores de exemplo (config/calibracao.json).');
if (p.sem_estimativa.length) pend.push('Sem estimativa cega do dev: ' + p.sem_estimativa.join(', ') + '.');
if (p.estimativa_nao_cega.length) pend.push('Estimativa registrada após o início da execução (excluída como cega): ' + p.estimativa_nao_cega.join(', ') + '.');
if (p.divergentes.length) pend.push('Estimativa cega e paramétrica divergem mais de ' + D.parametros.divergencia_alerta_pct + '%: ' + p.divergentes.join(', ') + '.');
if (p.modelos_sem_preco.length) pend.push('Modelos sem preço em precos.json (custo não contabilizado): ' + p.modelos_sem_preco.join(', ') + '.');
if (p.estimativas_sem_atividade.length) pend.push(p.estimativas_sem_atividade.length + ' estimativas aguardando sessões da atividade.');
if (c.correlacao.ambigua) pend.push(c.correlacao.ambigua + (c.correlacao.ambigua === 1 ? ' conversa OTel casada' : ' conversas OTel casadas') + ' por horário com mais de uma sessão candidata.');
if (c.correlacao.orfas) pend.push(c.correlacao.orfas + (c.correlacao.orfas === 1 ? ' conversa OTel sem sessão do hook (entra' : ' conversas OTel sem sessão do hook (entram') + ' como chat livre).');
if (!c.otel_disponivel) pend.push('Nenhum span OpenTelemetry encontrado: tokens e custo estão zerados. Veja hm diagnostico.');
raiz.append(h('div', { class: 'grade' },
  cartao({ span: 's7', titulo: 'Cobertura da coleta', tipo: 'Medido',
    tabela: h('div', { class: 'tiles' },
      tile({ rotulo: 'Sessões com tokens', valor: F.pct(c.sessoes_com_tokens_pct), sub: F.int(c.sessoes_total) + ' sessões · ' + F.int(c.sessoes_so_otel) + ' só OTel' }),
      tile({ rotulo: 'Concluídas com estimativa cega', valor: F.pct(c.concluidas_com_estimativa_cega_pct), sub: F.int(c.atividades_concluidas) + ' atividades concluídas' }),
      tile({ rotulo: 'Sessões com atividade', valor: F.pct(c.sessoes_com_atividade_pct), sub: 'vínculo por ticket, branch, briefing ou mudança SDD' }),
      tile({ rotulo: 'Custo do coletor', valor: c.hook_ms_p95 != null ? F.int(c.hook_ms_p95) + ' ms' : '—', sub: 'p95 por evento · zero token' })) }),
  cartao({ span: 's5', titulo: 'Pendências de dado', tipo: null,
    tabela: pend.length ? h('ul', { class: 'lista-pend' }, pend.map((t) => h('li', {}, icone('alerta'), h('span', { text: t })))) : h('div', {}, status('ok', 'Nenhuma pendência')) }),
  cartao({ span: 's12', titulo: 'Origem de cada métrica', sub: 'Medido = lido de evento real · Derivado = conta sobre medidas · Estimado = depende de premissa humana',
    tabela: tabela([{ t: 'Métrica' }, { t: 'Tipo' }, { t: 'Fonte' }, { t: 'Premissa' }], D.metodologia.map((m) => [m.metrica, chip(m.tipo), m.fonte, m.premissa])) }),
  cartao({ span: 's12', titulo: 'O que este painel não mede',
    tabela: h('ul', { class: 'lista-pend' }, [
      'Causalidade por camada: o painel mostra uso e custo de cada toolkit, não quanto do ganho vem de cada um. Isso exige experimento controlado (mesma tarefa com e sem a camada).',
      'Tempo humano fora da sessão (revisão de PR, teste manual): coberto só pela sobrecarga fixa de ' + D.parametros.sobrecarga_humana_fora_sessao_pct + '%.',
      'Qualidade em produção: incidentes, defeitos pós-merge e achados do Mend ainda não entram no cálculo.',
      'Custo desembolsado: o valor é de lista; o Copilot Business inclui créditos por usuário.',
    ].map((t) => h('li', {}, icone('info'), h('span', { text: t })))) })));
})();
`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function gerarDashboard(dados, { narrativaHtml = '' } = {}) {
  const periodo = dados.periodo.de && dados.periodo.ate
    ? `${dados.periodo.de.split('-').reverse().join('/')} a ${dados.periodo.ate.split('-').reverse().join('/')}`
    : 'sem dados';
  const repos = dados.repos.length ? dados.repos.join(' · ') : 'nenhum repositório';
  const json = JSON.stringify(dados).replace(/</g, '\\u003c').replace(new RegExp('[\\u2028\\u2029]', 'g'), (c) => (c.charCodeAt(0) === 0x2028 ? '\\u2028' : '\\u2029'));
  const gerado = new Date(dados.gerado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resultados do Harness de IA · ${esc(periodo)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="topo">
  <div class="topo-in">
    <div>
      <p class="olho">Harness de IA · GitHub Copilot</p>
      <h1>Produtividade, segurança e qualidade</h1>
      <p class="sub">${esc(periodo)} · ${esc(repos)}</p>
    </div>
    <div class="topo-meta">
      <div>Gerado em ${esc(gerado)}</div>
      <div>${esc(String(dados.kpi.sessoes))} sessões · coletor v${esc(dados.versao_coletor)}</div>
      ${dados.demo ? '<div><strong>DADOS SINTÉTICOS</strong></div>' : ''}
    </div>
  </div>
</header>
<main id="app"></main>
<footer>harness-metricas v${esc(dados.versao_coletor)} · dados.json de ${esc(dados.gerado_em)} · preços: <a href="${esc(dados.precos.fonte)}">${esc(dados.precos.fonte)}</a> (consultado em ${esc(dados.precos.consultado_em)})</footer>
<div id="narrativa-fonte" hidden>${narrativaHtml}</div>
<script type="application/json" id="dados">${json}</script>
<script>${JS}</script>
</body>
</html>
`;
}
