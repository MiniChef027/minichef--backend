// Canvas do Editor MiniChef: palco com zoom, sobreposição de seleção, mover, redimensionar,
// seleção por área, atalhos, área de transferência interna, edição de texto inline e prévia de celular.
// Contrato: editor/CONTRATO.md. Toda alteração no documento da página passa pelos helpers do núcleo.
import * as nucleo from './nucleo.js';

const { estado } = nucleo;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const PASSOS_ZOOM = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MARGEM = 40; // px de tela em volta da página no palco
// Altura mínima da página no palco; também é o 100vh que a página enxerga (evita realimentar min-height: 100vh).
const ALTURA_TELA = { desktop: 800, celular: 844 };
const LIMIAR_ARRASTO = 3; // px de tela antes de um clique virar arrasto
const TAMANHO_MIN = 8;
const DESLOCAMENTO_COLAR = 16;
const ALCAS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
// Elementos sem texto editável (substituídos ou de formulário).
const SEM_TEXTO = new Set(['img', 'video', 'audio', 'iframe', 'canvas', 'svg', 'input', 'select', 'textarea',
  'object', 'embed', 'picture', 'hr', 'br', 'meter', 'progress', 'math']);
const ESTILO_ARTEFATO = `
html { overflow: hidden !important; }
[data-mc-editando] { outline: none !important; cursor: text; }
`;

// ---------------------------------------------------------------- estado local

let palco;
let iframe;
let sobre;
let caixaHover;
let camadaSelecao;
let rotulo;
let areaSelecao;
let botaoZoom;
let botaoCelular;
const alcas = {};

const layout = { offX: MARGEM, offY: MARGEM, largura: nucleo.LARGURA_PRANCHETA, altura: ALTURA_TELA.desktop };
let hover = null; // elemento sob o ponteiro
let arrasto = null; // { tipo: 'mover' | 'redimensionar' | 'area', ... }
let edicao = null; // { el, htmlAntes, ce, sc }
let quadro = 0; // requestAnimationFrame agendado
let primeiraPagina = true;
let grupoSetas = 0; // muda a cada seleção: setas seguidas no mesmo alvo viram um passo de histórico
const areaTransferencia = { itens: [], colagens: 0 };
let copiaParaSistema = null; // dados que o próximo evento copy/cut grava na área de transferência do sistema
let colagemTratada = true;
const docsPreparados = new WeakSet();

// ---------------------------------------------------------------- utilidades

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const lerPx = (valor) => {
  const n = parseFloat(valor);
  return Number.isFinite(n) ? n : null;
};

function docAtual() {
  const doc = estado.doc;
  return doc?.defaultView && doc.body ? doc : null;
}

function larguraPagina() {
  return estado.modoCelular ? nucleo.LARGURA_CELULAR : nucleo.LARGURA_PRANCHETA;
}

function selecaoValida() {
  const doc = docAtual();
  return doc ? estado.selecao.filter((el) => el.isConnected && el.ownerDocument === doc) : [];
}

// Só os elementos cujo ancestral não está também selecionado, em ordem de documento.
function raizes(lista) {
  return lista
    .filter((el) => !lista.some((outro) => outro !== el && outro.contains(el)))
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

// O que mover, copiar e apagar podem tocar: nunca a prancheta nem a estrutura da página.
function manipulaveis(lista) {
  return raizes(lista.filter((el) => !el.matches('[data-mc-prancheta], html, head, body')));
}

function focoEmCampo(alvo) {
  const el = alvo?.nodeType === 1 ? alvo : document.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  return !!el.closest?.('dialog[open], [role="dialog"], [role="alertdialog"]');
}

function temArquivos(evento) {
  return [...(evento.dataTransfer?.types ?? [])].includes('Files');
}

function imagensDe(transferencia) {
  if (!transferencia) return [];
  let arquivos = [...(transferencia.files ?? [])];
  if (!arquivos.length) {
    arquivos = [...(transferencia.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
  }
  return arquivos.filter((f) => f.type.startsWith('image/'));
}

// ---------------------------------------------------------------- coordenadas

// Ponto do evento em coordenadas da sobreposição (= conteúdo rolável do palco).
function pontoNaSobreposicao(evento) {
  const r = sobre.getBoundingClientRect();
  return { ox: evento.clientX - r.left, oy: evento.clientY - r.top };
}

// Sobreposição → coordenadas de cliente do documento do iframe (desfaz o zoom).
function paraDocumento({ ox, oy }) {
  return { x: (ox - layout.offX) / estado.zoom, y: (oy - layout.offY) / estado.zoom };
}

// Retângulo do documento do iframe → sobreposição.
function naTela(r) {
  const z = estado.zoom;
  return { left: layout.offX + r.left * z, top: layout.offY + r.top * z, width: r.width * z, height: r.height * z };
}

// Ponto do documento → coordenadas da prancheta (as que criarElemento e definirGeometria usam).
function pontoNaPrancheta({ x, y }) {
  const p = nucleo.prancheta();
  let px = x;
  let py = y;
  if (p) {
    const r = p.getBoundingClientRect();
    px -= r.left;
    py -= r.top;
  } else {
    px -= Math.max(0, (layout.largura - nucleo.LARGURA_PRANCHETA) / 2);
  }
  return { x: Math.max(0, Math.round(px)), y: Math.max(0, Math.round(py)) };
}

function centroVisivel() {
  if (!docAtual() || !palco.clientWidth) return { x: 40, y: 40 };
  const rp = palco.getBoundingClientRect();
  const rs = sobre.getBoundingClientRect();
  const ox = rp.left + palco.clientWidth / 2 - rs.left;
  const oy = rp.top + palco.clientHeight / 2 - rs.top;
  return pontoNaPrancheta(paraDocumento({ ox, oy }));
}

// ---------------------------------------------------------------- alvo do ponteiro

function normalizarAlvo(no) {
  const doc = docAtual();
  let el = no?.nodeType === 1 ? no : no?.parentElement;
  if (!el || !doc || el.ownerDocument !== doc) return null;
  while (el.ownerSVGElement) el = el.ownerSVGElement; // SVG é selecionado inteiro
  if (el.closest('[data-mc-artefato], head')) return null;
  const doEditor = el.closest('[data-mc]');
  if (doEditor) return doEditor;
  if (el === doc.body || el === doc.documentElement || el === nucleo.prancheta(doc)) return null;
  return el;
}

function alvoNoPonto(x, y) {
  const doc = docAtual();
  if (!doc || x < 0 || y < 0 || x >= layout.largura || y >= layout.altura) return null;
  return normalizarAlvo(doc.elementFromPoint(x, y));
}

function alvoNaSobreposicao(p) {
  const { x, y } = paraDocumento(p);
  return alvoNoPonto(x, y);
}

function editavel(el) {
  return !!el?.isConnected && !SEM_TEXTO.has(el.localName);
}

// ---------------------------------------------------------------- palco e zoom

// Mede a altura rolável da página. Começa de uma tela para não crescer sem fim com min-height: 100vh.
function medirAltura() {
  const doc = docAtual();
  const minimo = estado.modoCelular ? ALTURA_TELA.celular : ALTURA_TELA.desktop;
  iframe.style.width = `${layout.largura}px`;
  if (!doc) return minimo;
  iframe.style.height = `${minimo}px`;
  const altura = Math.max(minimo, Math.ceil(doc.documentElement.scrollHeight), Math.ceil(doc.body.scrollHeight));
  iframe.style.height = `${altura}px`;
  const rolagem = doc.scrollingElement;
  if (rolagem && (rolagem.scrollTop || rolagem.scrollLeft)) rolagem.scrollTo(0, 0);
  return altura;
}

function posicionarPalco() {
  const z = estado.zoom;
  const larguraVisual = layout.largura * z;
  const alturaVisual = layout.altura * z;
  const vw = palco.clientWidth;
  const vh = palco.clientHeight;
  layout.offX = Math.max(MARGEM, Math.round((vw - larguraVisual) / 2));
  layout.offY = MARGEM;
  iframe.style.width = `${layout.largura}px`;
  iframe.style.height = `${layout.altura}px`;
  iframe.style.left = `${layout.offX}px`;
  iframe.style.top = `${layout.offY}px`;
  iframe.style.transform = `scale(${z})`;
  sobre.style.width = `${Math.max(vw, layout.offX + Math.ceil(larguraVisual) + MARGEM)}px`;
  sobre.style.height = `${Math.max(vh, layout.offY + Math.ceil(alturaVisual) + MARGEM)}px`;
}

function atualizarAgora() {
  if (quadro) {
    cancelAnimationFrame(quadro);
    quadro = 0;
  }
  layout.largura = larguraPagina();
  layout.altura = medirAltura();
  posicionarPalco();
  desenhar();
}

function agendar() {
  if (!quadro) {
    quadro = requestAnimationFrame(() => {
      quadro = 0;
      atualizarAgora();
    });
  }
}

function atualizarRotuloZoom() {
  botaoZoom.textContent = `${Math.round(estado.zoom * 100)}%`;
}

// ancora: ponto de tela ({clientX, clientY}) que fica parado; padrão é o centro do palco.
function definirZoom(valor, ancora) {
  const z = limitar(Math.round(valor * 1000) / 1000, ZOOM_MIN, ZOOM_MAX);
  if (z === estado.zoom) return;
  const rp = palco.getBoundingClientRect();
  const rs = sobre.getBoundingClientRect();
  const ax = ancora?.clientX ?? rp.left + palco.clientWidth / 2;
  const ay = ancora?.clientY ?? rp.top + palco.clientHeight / 2;
  const ponto = paraDocumento({ ox: ax - rs.left, oy: ay - rs.top });
  estado.zoom = z;
  posicionarPalco();
  palco.scrollLeft = layout.offX + ponto.x * z - (ax - rp.left);
  palco.scrollTop = layout.offY + ponto.y * z - (ay - rp.top);
  atualizarRotuloZoom();
  desenhar();
  nucleo.emit('zoom:mudou', { zoom: z });
}

function passoDeZoom(direcao) {
  const z = estado.zoom;
  const alvo = direcao > 0 ? PASSOS_ZOOM.find((p) => p > z + 0.001) : [...PASSOS_ZOOM].reverse().find((p) => p < z - 0.001);
  definirZoom(alvo ?? (direcao > 0 ? ZOOM_MAX : ZOOM_MIN));
}

function ajustarZoom({ maximo = ZOOM_MAX } = {}) {
  const disponivel = palco.clientWidth - 2 * MARGEM;
  if (disponivel <= 0) return;
  definirZoom(Math.min(maximo, Math.floor((disponivel / layout.largura) * 100) / 100));
}

function aoRodar(evento, ancora = evento) {
  if (!(evento.ctrlKey || evento.metaKey)) return;
  evento.preventDefault();
  const sensibilidade = evento.deltaMode === 1 ? 0.05 : 0.0015; // linhas ou pixels
  definirZoom(estado.zoom * Math.exp(-evento.deltaY * sensibilidade), ancora);
}

function alternarCelular() {
  if (arrasto) cancelarArrasto();
  estado.modoCelular = !estado.modoCelular;
  botaoCelular.setAttribute('aria-pressed', String(estado.modoCelular));
  hover = null;
  atualizarAgora();
}

// ---------------------------------------------------------------- desenho da sobreposição

function posicionar(el, r) {
  if (!r) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.style.left = `${Math.round(r.left)}px`;
  el.style.top = `${Math.round(r.top)}px`;
  el.style.width = `${Math.max(1, Math.round(r.width))}px`;
  el.style.height = `${Math.max(1, Math.round(r.height))}px`;
}

function desenharHover() {
  const valido = hover?.isConnected && hover.ownerDocument === docAtual() && !edicao && !arrasto?.ativo
    && !estado.selecao.includes(hover);
  posicionar(caixaHover, valido ? naTela(hover.getBoundingClientRect()) : null);
}

function textoDoRotulo(el, r) {
  const tipo = nucleo.tipoDe(el);
  const nome = tipo ? `${el.localName} · ${tipo}` : el.localName;
  const editando = edicao?.el === el ? ' · editando' : '';
  return `${nome}  ${Math.round(r.width)} × ${Math.round(r.height)}${editando}`;
}

function desenhar() {
  desenharHover();
  const sel = selecaoValida();
  const caixas = [];
  let uniao = null;
  for (const el of sel) {
    const r = el.getBoundingClientRect();
    const tela = naTela(r);
    const caixa = document.createElement('div');
    caixa.className = edicao?.el === el ? 'mc-caixa mc-caixa--selecao mc-caixa--editando' : 'mc-caixa mc-caixa--selecao';
    posicionar(caixa, tela);
    caixas.push(caixa);
    uniao = uniao
      ? {
        left: Math.min(uniao.left, tela.left),
        top: Math.min(uniao.top, tela.top),
        right: Math.max(uniao.right, tela.left + tela.width),
        bottom: Math.max(uniao.bottom, tela.top + tela.height),
      }
      : { left: tela.left, top: tela.top, right: tela.left + tela.width, bottom: tela.top + tela.height };
  }
  camadaSelecao.replaceChildren(...caixas);

  const mostrarAlcas = sel.length === 1 && !estado.modoCelular && !edicao;
  for (const nome of ALCAS) {
    const alca = alcas[nome];
    alca.hidden = !mostrarAlcas;
    if (!mostrarAlcas) continue;
    const { left, top, right, bottom } = uniao;
    const x = nome.includes('w') ? left : nome.includes('e') ? right : (left + right) / 2;
    const y = nome.includes('n') ? top : nome.includes('s') ? bottom : (top + bottom) / 2;
    alca.style.left = `${Math.round(x)}px`;
    alca.style.top = `${Math.round(y)}px`;
  }

  if (!uniao || arrasto?.tipo === 'area') {
    rotulo.hidden = true;
  } else {
    rotulo.hidden = false;
    rotulo.textContent = sel.length === 1 ? textoDoRotulo(sel[0], sel[0].getBoundingClientRect()) : `${sel.length} selecionados`;
    rotulo.style.left = `${Math.round(uniao.left)}px`;
    rotulo.style.top = `${Math.round(uniao.bottom + 6)}px`;
  }
}

// ---------------------------------------------------------------- geometria de arrasto

// Posição inicial e limite mínimo (não sair pela esquerda nem pelo topo) de um elemento.
function inicioDeMovimento(el) {
  const livre = nucleo.eLivre(el);
  const r = el.getBoundingClientRect();
  let x;
  let y;
  if (livre) {
    ({ x, y } = nucleo.geometria(el));
  } else {
    // De fluxo: o deslocamento atual vem do estilo inline ou do CSS da página (position relative/absolute).
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    const estatico = cs.position === 'static';
    x = lerPx(el.style.left) ?? (estatico ? 0 : lerPx(cs.left) ?? 0);
    y = lerPx(el.style.top) ?? (estatico ? 0 : lerPx(cs.top) ?? 0);
  }
  return { el, livre, x, y, minX: livre ? 0 : x - r.left, minY: livre ? 0 : y - r.top };
}

// Limita o deslocamento do grupo inteiro, preservando as posições relativas.
function limitarDelta(itens, dx, dy) {
  let minDx = -Infinity;
  let minDy = -Infinity;
  for (const i of itens) {
    minDx = Math.max(minDx, Math.min(0, i.minX - i.x));
    minDy = Math.max(minDy, Math.min(0, i.minY - i.y));
  }
  return [Math.round(Math.max(dx, minDx)), Math.round(Math.max(dy, minDy))];
}

function inicioDeRedimensionar(el, alca) {
  const base = inicioDeMovimento(el);
  let w;
  let h;
  let extraW = 0;
  let extraH = 0;
  if (base.livre) {
    ({ w, h } = nucleo.geometria(el));
  } else {
    const r = el.getBoundingClientRect();
    w = el.offsetWidth || r.width;
    h = el.offsetHeight || r.height;
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    if (cs.boxSizing === 'content-box') {
      const soma = (...props) => props.reduce((t, p) => t + (lerPx(cs[p]) ?? 0), 0);
      extraW = soma('paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth');
      extraH = soma('paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth');
    }
  }
  return { ...base, w, h, extraW, extraH, alca, imagem: el.localName === 'img' };
}

function aplicarRedimensionamento(dados, dx, dy, shift) {
  const { el, alca, x: x0, y: y0, w: w0, h: h0 } = dados;
  const canto = alca.length === 2;
  // Shift mantém a proporção; em imagens a proporção é o padrão e o Shift a solta.
  const proporcional = (dados.imagem !== shift) && w0 >= 1 && h0 >= 1;
  let w = w0 + (alca.includes('e') ? dx : alca.includes('w') ? -dx : 0);
  let h = h0 + (alca.includes('s') ? dy : alca.includes('n') ? -dy : 0);
  const maxW = alca.includes('w') ? x0 + w0 - Math.min(x0, dados.minX) : Infinity;
  const maxH = alca.includes('n') ? y0 + h0 - Math.min(y0, dados.minY) : Infinity;
  if (proporcional) {
    let s;
    if (canto) {
      const sw = w / w0;
      const sh = h / h0;
      s = Math.abs(sw - 1) >= Math.abs(sh - 1) ? sw : sh;
    } else {
      s = alca === 'e' || alca === 'w' ? w / w0 : h / h0;
    }
    s = Math.min(s, maxW / w0, maxH / h0);
    s = Math.max(s, TAMANHO_MIN / w0, TAMANHO_MIN / h0);
    w = w0 * s;
    h = h0 * s;
  } else {
    w = Math.max(TAMANHO_MIN, Math.min(w, maxW));
    h = Math.max(TAMANHO_MIN, Math.min(h, maxH));
  }
  w = Math.round(w);
  h = Math.round(h);
  const geo = {};
  if (proporcional || alca.includes('e') || alca.includes('w')) geo.w = w - dados.extraW;
  if (proporcional || alca.includes('n') || alca.includes('s')) geo.h = h - dados.extraH;
  if (alca.includes('w')) geo.x = x0 + w0 - w;
  if (alca.includes('n')) geo.y = y0 + h0 - h;
  nucleo.definirGeometria(el, geo);
  return w !== Math.round(w0) || h !== Math.round(h0);
}

function fotoDeEstilos(elementos) {
  const lista = [...elementos];
  const p = nucleo.prancheta();
  if (p) lista.push(p);
  return lista.map((el) => [el, el.getAttribute('style')]);
}

function restaurarEstilos(foto) {
  for (const [el, estilo] of foto ?? []) {
    if (estilo === null) el.removeAttribute('style');
    else el.setAttribute('style', estilo);
  }
}

// ---------------------------------------------------------------- ponteiro

function iniciarArrasto(evento, dados) {
  arrasto = { ativo: false, pointerId: evento.pointerId, ...dados };
  try {
    sobre.setPointerCapture(evento.pointerId);
  } catch {
    // ponteiro já liberado; o arrasto termina no próximo pointerup
  }
}

function aoPressionar(evento) {
  if (evento.button !== 0 || !docAtual() || edicao) return;
  sobre.focus({ preventScroll: true });
  const p = pontoNaSobreposicao(evento);
  const sel = selecaoValida();
  const alca = evento.target.closest?.('.mc-alca')?.dataset.alca;
  if (alca) {
    evento.preventDefault();
    if (sel.length !== 1 || estado.modoCelular) return;
    iniciarArrasto(evento, { tipo: 'redimensionar', inicio: p, alca });
    return;
  }
  const alvo = alvoNaSobreposicao(p);
  if (evento.shiftKey) {
    if (alvo) {
      nucleo.selecionar(sel.includes(alvo) ? sel.filter((el) => el !== alvo) : [...sel, alvo]);
      return;
    }
    iniciarArrasto(evento, { tipo: 'area', inicio: p, base: sel });
    return;
  }
  if (alvo) {
    if (!sel.includes(alvo)) nucleo.selecionar([alvo]);
    iniciarArrasto(evento, { tipo: 'mover', inicio: p, alvo, reduzir: sel.includes(alvo) && sel.length > 1 });
    return;
  }
  nucleo.limparSelecao();
  iniciarArrasto(evento, { tipo: 'area', inicio: p, base: [] });
}

function comecarArrasto(a) {
  const sel = selecaoValida();
  if (a.tipo === 'mover') {
    if (estado.modoCelular || !sel.length) return false;
    a.itens = manipulaveis(sel).map(inicioDeMovimento);
    if (!a.itens.length) return false;
    a.foto = fotoDeEstilos(a.itens.map((i) => i.el));
  } else if (a.tipo === 'redimensionar') {
    if (estado.modoCelular || sel.length !== 1 || !manipulaveis(sel).length) return false;
    a.dados = inicioDeRedimensionar(sel[0], a.alca);
    a.foto = fotoDeEstilos([sel[0]]);
  }
  hover = null;
  return true;
}

function aoMover(evento) {
  const p = pontoNaSobreposicao(evento);
  if (!arrasto) {
    if (evento.target.closest?.('.mc-alca') || !docAtual() || edicao) return;
    const alvo = alvoNaSobreposicao(p);
    sobre.style.cursor = alvo && !estado.modoCelular && estado.selecao.includes(alvo) ? 'move' : '';
    if (alvo !== hover) {
      hover = alvo;
      desenharHover();
    }
    return;
  }
  if (evento.pointerId !== arrasto.pointerId) return;
  const a = arrasto;
  if (!a.ativo) {
    if (Math.hypot(p.ox - a.inicio.ox, p.oy - a.inicio.oy) < LIMIAR_ARRASTO) return;
    if (!comecarArrasto(a)) {
      if (estado.modoCelular && a.tipo !== 'area') nucleo.avisar('info', 'No modo celular a posição e o tamanho não mudam. Volte ao desktop para mover.');
      a.tipo = 'nada';
    }
    a.ativo = true;
  }
  const dx = (p.ox - a.inicio.ox) / estado.zoom;
  const dy = (p.oy - a.inicio.oy) / estado.zoom;
  if (a.tipo === 'mover') {
    const [mx, my] = limitarDelta(a.itens, dx, dy);
    for (const i of a.itens) nucleo.definirGeometria(i.el, { x: i.x + mx, y: i.y + my });
    a.mudou = mx !== 0 || my !== 0;
    nucleo.ajustarAlturaPrancheta();
    agendar();
  } else if (a.tipo === 'redimensionar') {
    a.mudou = aplicarRedimensionamento(a.dados, dx, dy, evento.shiftKey);
    nucleo.ajustarAlturaPrancheta();
    agendar();
  } else if (a.tipo === 'area') {
    atualizarAreaSelecao(a, p);
  }
}

function atualizarAreaSelecao(a, p) {
  const left = Math.min(a.inicio.ox, p.ox);
  const top = Math.min(a.inicio.oy, p.oy);
  const width = Math.abs(p.ox - a.inicio.ox);
  const height = Math.abs(p.oy - a.inicio.oy);
  posicionar(areaSelecao, { left, top, width, height });
  const doc = docAtual();
  if (!doc) return;
  const c1 = paraDocumento({ ox: left, oy: top });
  const c2 = paraDocumento({ ox: left + width, oy: top + height });
  const candidatos = [...doc.querySelectorAll('[data-mc]')].filter((el) => !el.parentElement?.closest('[data-mc]'));
  const dentro = candidatos.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.right > c1.x && r.left < c2.x && r.bottom > c1.y && r.top < c2.y;
  });
  nucleo.selecionar([...a.base, ...dentro.filter((el) => !a.base.includes(el))]);
  desenhar();
}

function soltarCaptura(pointerId) {
  try {
    if (sobre.hasPointerCapture(pointerId)) sobre.releasePointerCapture(pointerId);
  } catch {
    // nada a liberar
  }
}

function aoSoltar(evento) {
  if (!arrasto || evento.pointerId !== arrasto.pointerId) return;
  const a = arrasto;
  arrasto = null;
  soltarCaptura(a.pointerId);
  areaSelecao.hidden = true;
  if (a.ativo && (a.tipo === 'mover' || a.tipo === 'redimensionar')) {
    if (a.mudou) {
      nucleo.alterado(a.tipo); // um único passo de histórico por arrasto
    } else {
      restaurarEstilos(a.foto);
      agendar();
    }
    return;
  }
  if (!a.ativo && a.tipo === 'mover' && a.reduzir) nucleo.selecionar([a.alvo]);
  agendar();
}

function cancelarArrasto() {
  if (!arrasto) return;
  const a = arrasto;
  arrasto = null;
  soltarCaptura(a.pointerId);
  areaSelecao.hidden = true;
  if (a.ativo && (a.tipo === 'mover' || a.tipo === 'redimensionar')) restaurarEstilos(a.foto);
  if (a.tipo === 'area') nucleo.selecionar(a.base);
  agendar();
}

function aoDuploClique(evento) {
  if (!docAtual() || edicao || evento.target.closest?.('.mc-alca')) return;
  const d = paraDocumento(pontoNaSobreposicao(evento));
  const alvo = alvoNoPonto(d.x, d.y);
  if (alvo && editavel(alvo)) iniciarEdicao(alvo, d);
}

// ---------------------------------------------------------------- edição de texto inline

function posicionarCursor(doc, el, ponto) {
  let faixa = null;
  if (ponto) {
    if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(ponto.x, ponto.y);
      if (pos?.offsetNode) {
        faixa = doc.createRange();
        faixa.setStart(pos.offsetNode, pos.offset);
      }
    } else if (doc.caretRangeFromPoint) {
      faixa = doc.caretRangeFromPoint(ponto.x, ponto.y);
    }
    if (faixa && !el.contains(faixa.startContainer)) faixa = null;
    faixa?.collapse(true);
  }
  if (!faixa) {
    faixa = doc.createRange();
    faixa.selectNodeContents(el);
    if (ponto) faixa.collapse(false); // sem ponto (serviço): seleciona tudo para digitar por cima
  }
  const selecao = doc.getSelection();
  selecao.removeAllRanges();
  selecao.addRange(faixa);
}

function iniciarEdicao(el, ponto = null) {
  finalizarEdicao();
  const doc = docAtual();
  if (!doc || el?.ownerDocument !== doc || !editavel(el)) return false;
  if (arrasto) cancelarArrasto();
  nucleo.selecionar([el]);
  edicao = { el, htmlAntes: el.innerHTML, ce: el.getAttribute('contenteditable'), sc: el.getAttribute('spellcheck') };
  el.setAttribute('data-mc-editando', '');
  try {
    el.contentEditable = 'plaintext-only'; // colar e soltar viram texto puro: nada de HTML externo na página
  } catch {
    el.contentEditable = 'true';
  }
  el.spellcheck = false;
  hover = null;
  sobre.classList.add('mc-sobreposicao--editando');
  iframe.focus();
  el.focus({ preventScroll: true });
  posicionarCursor(doc, el, ponto);
  desenhar();
  return true;
}

function finalizarEdicao() {
  if (!edicao) return;
  const { el, htmlAntes, ce, sc } = edicao;
  edicao = null;
  const doc = el.ownerDocument;
  for (const n of doc.querySelectorAll('[data-mc-editando]')) {
    n.removeAttribute('data-mc-editando');
    n.removeAttribute('contenteditable');
    n.removeAttribute('spellcheck');
  }
  if (ce !== null) el.setAttribute('contenteditable', ce);
  if (sc !== null) el.setAttribute('spellcheck', sc);
  try {
    doc.getSelection()?.removeAllRanges();
  } catch {
    // documento já descarregado
  }
  sobre.classList.remove('mc-sobreposicao--editando');
  if (document.activeElement === iframe) sobre.focus({ preventScroll: true });
  if (el.isConnected && doc === docAtual() && el.innerHTML !== htmlAntes) nucleo.alterado('texto');
  else agendar();
}

// ---------------------------------------------------------------- área de transferência

function htmlLimpo(el) {
  const copia = el.cloneNode(true);
  copia.querySelectorAll('[data-mc-artefato]').forEach((n) => n.remove());
  for (const n of [copia, ...copia.querySelectorAll('[data-mc-editando]')]) {
    if (!n.hasAttribute('data-mc-editando')) continue;
    n.removeAttribute('data-mc-editando');
    n.removeAttribute('contenteditable');
    n.removeAttribute('spellcheck');
  }
  return copia.outerHTML;
}

function copiar(recortar) {
  const sel = manipulaveis(selecaoValida());
  if (!sel.length) return false;
  areaTransferencia.itens = sel.map((el) => {
    const livre = nucleo.eLivre(el);
    return {
      html: htmlLimpo(el),
      livre,
      origem: livre ? null : el,
      ancora: livre ? null : { pai: el.parentElement, proximo: el.nextSibling },
    };
  });
  // Depois de recortar, a primeira colagem volta ao lugar original; depois de copiar, desloca +16px.
  areaTransferencia.colagens = recortar ? -1 : 0;
  copiaParaSistema = {
    html: areaTransferencia.itens.map((i) => i.html).join('\n'),
    texto: sel.map((el) => el.innerText ?? el.textContent ?? '').join('\n'),
  };
  setTimeout(() => {
    copiaParaSistema = null;
  }, 0);
  if (recortar) nucleo.remover(sel);
  return true;
}

// Grava a cópia também na área de transferência do sistema. Assim uma imagem antiga do sistema
// não "ganha" da cópia interna no próximo Ctrl+V.
function aoCopiarSistema(evento) {
  if (!copiaParaSistema || !evento.clipboardData || focoEmCampo(evento.target)) return;
  evento.clipboardData.setData('text/plain', copiaParaSistema.texto);
  evento.clipboardData.setData('text/html', copiaParaSistema.html);
  evento.preventDefault();
  copiaParaSistema = null;
}

function criarDoHtml(doc, html) {
  const modelo = doc.createElement('template');
  modelo.innerHTML = html;
  return modelo.content.firstElementChild;
}

function inserirNoFluxo(item, el, doc) {
  const { origem, ancora } = item;
  if (origem?.isConnected && origem.ownerDocument === doc) origem.after(el);
  else if (ancora?.pai?.isConnected && ancora.pai.ownerDocument === doc) {
    ancora.pai.insertBefore(el, ancora.proximo?.parentNode === ancora.pai ? ancora.proximo : null);
  } else doc.body.append(el);
}

function colarInterno() {
  const doc = docAtual();
  if (!doc || !areaTransferencia.itens.length) return false;
  areaTransferencia.colagens += 1;
  const deslocamento = DESLOCAMENTO_COLAR * areaTransferencia.colagens;
  const livres = [];
  const todos = [];
  for (const item of areaTransferencia.itens) {
    const el = criarDoHtml(doc, item.html);
    if (!el) continue;
    // ids novos: o núcleo dá data-mc-id a quem não tem; id HTML repetido deixaria a página inválida
    for (const n of [el, ...el.querySelectorAll('[data-mc-id], [id]')]) {
      n.removeAttribute('data-mc-id');
      n.removeAttribute('id');
    }
    if (item.livre) {
      nucleo.garantirPrancheta().append(el);
      const g = nucleo.geometria(el);
      nucleo.definirGeometria(el, { x: g.x + deslocamento, y: g.y + deslocamento });
      livres.push(el);
    } else {
      inserirNoFluxo(item, el, doc);
    }
    todos.push(el);
  }
  if (!todos.length) return false;
  nucleo.garantirIds(doc);
  if (livres.length) nucleo.inserir(livres, { selecionarInseridos: false, origem: 'colar' });
  else nucleo.alterado('colar');
  nucleo.selecionar(todos);
  return true;
}

async function inserirImagens(arquivos, ponto) {
  const inserir = nucleo.servicos.inserirImagemArquivo;
  if (!inserir) {
    nucleo.avisar('erro', 'Inserir imagem ainda não está disponível no editor.');
    return;
  }
  for (const [i, arquivo] of arquivos.entries()) {
    const pos = ponto ? { x: ponto.x + i * DESLOCAMENTO_COLAR, y: ponto.y + i * DESLOCAMENTO_COLAR } : undefined;
    try {
      await inserir(arquivo, pos);
    } catch (erro) {
      nucleo.avisar('erro', `Não foi possível inserir ${arquivo.name || 'a imagem'}: ${erro.message}`);
    }
  }
}

function aoColar(evento) {
  if (edicao || focoEmCampo(evento.target) || !docAtual()) return;
  colagemTratada = true;
  evento.preventDefault();
  const imagens = imagensDe(evento.clipboardData);
  if (imagens.length) inserirImagens(imagens);
  else colarInterno(); // HTML vindo de fora nunca é interpretado: só a cópia interna vira elemento
}

// ---------------------------------------------------------------- teclado

function moverComTeclado(dx, dy, repetido) {
  if (estado.modoCelular) {
    if (!repetido) nucleo.avisar('info', 'No modo celular a posição não muda. Volte ao desktop para mover.');
    return;
  }
  const itens = manipulaveis(selecaoValida()).map(inicioDeMovimento);
  const [mx, my] = limitarDelta(itens, dx, dy);
  if (!mx && !my) return;
  for (const i of itens) nucleo.definirGeometria(i.el, { x: i.x + mx, y: i.y + my });
  nucleo.alterado('setas', { agrupar: `setas-${grupoSetas}` });
}

const SETAS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function aoTeclar(evento) {
  if (evento.defaultPrevented || evento.isComposing) return;
  const mod = (evento.ctrlKey || evento.metaKey) && !evento.altKey;
  const tecla = evento.key.length === 1 ? evento.key.toLowerCase() : evento.key;
  // Ctrl+S salva também com foco em campo ou na edição de texto: não há texto a proteger e evita o "Salvar como" do navegador.
  if (mod && tecla === 's') {
    evento.preventDefault();
    if (docAtual()) nucleo.salvar();
    return;
  }
  if (edicao || focoEmCampo(evento.target) || !docAtual()) return;

  if (evento.key === 'Escape') {
    if (arrasto) cancelarArrasto();
    else if (estado.selecao.length) nucleo.limparSelecao();
    return;
  }
  if (arrasto?.ativo) return;
  if (mod) {
    if (tecla === 'z') {
      evento.preventDefault();
      if (evento.shiftKey) nucleo.historico.refazer();
      else nucleo.historico.desfazer();
    } else if (tecla === 'y') {
      evento.preventDefault();
      nucleo.historico.refazer();
    } else if (tecla === 'c' || tecla === 'x') {
      copiar(tecla === 'x'); // sem preventDefault: o evento copy/cut grava a área de transferência do sistema
    } else if (tecla === 'v') {
      // O evento paste decide entre imagem do sistema e cópia interna. Se ele não vier, cola a interna.
      colagemTratada = false;
      setTimeout(() => {
        if (!colagemTratada) colarInterno();
        colagemTratada = true;
      }, 0);
    }
    return;
  }
  const sel = selecaoValida();
  if (!sel.length) return;
  if (evento.key === 'Delete' || evento.key === 'Backspace') {
    evento.preventDefault();
    nucleo.remover(manipulaveis(sel));
    return;
  }
  const seta = SETAS[evento.key];
  if (seta && !evento.altKey && !evento.ctrlKey && !evento.metaKey) {
    evento.preventDefault();
    const passo = evento.shiftKey ? 10 : 1;
    moverComTeclado(seta[0] * passo, seta[1] * passo, evento.repeat);
  }
}

// ---------------------------------------------------------------- documento da página

function prepararDocumento(doc) {
  if (docsPreparados.has(doc)) return;
  docsPreparados.add(doc);

  const estilo = doc.createElement('style');
  estilo.setAttribute('data-mc-artefato', '');
  estilo.textContent = ESTILO_ARTEFATO;
  doc.head.append(estilo);

  // Com o ponteiro passado ao iframe (edição de texto), os eventos chegam aqui, não na sobreposição.
  doc.addEventListener('keydown', (evento) => {
    if (!edicao) {
      aoTeclar(evento);
      return;
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      finalizarEdicao();
    } else if ((evento.ctrlKey || evento.metaKey) && !evento.altKey && evento.key.toLowerCase() === 's') {
      evento.preventDefault();
      nucleo.salvar();
    }
  }, true);
  doc.addEventListener('input', () => {
    if (edicao) nucleo.alterado('texto', { historico: false }); // marca "sujo"; o passo de histórico vem ao encerrar
  });
  doc.addEventListener('pointerdown', (evento) => {
    if (!edicao || edicao.el.contains(evento.target)) return;
    evento.preventDefault();
    finalizarEdicao();
    const alvo = normalizarAlvo(evento.target);
    if (alvo) nucleo.selecionar([alvo]);
    else nucleo.limparSelecao();
  }, true);
  doc.addEventListener('paste', (evento) => {
    if (!edicao) {
      aoColar(evento);
      return;
    }
    if (edicao.el.contentEditable === 'plaintext-only') return;
    evento.preventDefault();
    const texto = evento.clipboardData?.getData('text/plain') ?? '';
    if (texto) doc.execCommand('insertText', false, texto);
  }, true);
  doc.addEventListener('dragover', (evento) => {
    evento.preventDefault();
    if (evento.dataTransfer) evento.dataTransfer.dropEffect = temArquivos(evento) ? 'copy' : 'none';
  }, true);
  doc.addEventListener('drop', (evento) => {
    evento.preventDefault(); // nada de HTML ou arquivo solto direto na página
    const imagens = imagensDe(evento.dataTransfer);
    if (!imagens.length) return;
    finalizarEdicao();
    inserirImagens(imagens, pontoNaPrancheta({ x: evento.clientX, y: evento.clientY }));
  }, true);
  doc.addEventListener('wheel', (evento) => {
    const rs = sobre.getBoundingClientRect();
    aoRodar(evento, {
      clientX: rs.left + layout.offX + evento.clientX * estado.zoom,
      clientY: rs.top + layout.offY + evento.clientY * estado.zoom,
    });
  }, { passive: false });
  doc.addEventListener('load', agendar, true); // imagens que terminam de carregar mudam a altura
  doc.addEventListener('scroll', agendar, true);
  doc.fonts?.ready.then(agendar).catch(() => {});
}

// ---------------------------------------------------------------- montagem

function criarBotao(texto, { titulo, rotuloAcessivel, classe = '' } = {}) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = `mc-botao ${classe}`.trim();
  botao.textContent = texto;
  if (titulo) botao.title = titulo;
  if (rotuloAcessivel) botao.setAttribute('aria-label', rotuloAcessivel);
  return botao;
}

function montarControles() {
  const grupo = document.createElement('div');
  grupo.className = 'mc-controles-canvas';
  grupo.setAttribute('role', 'group');
  grupo.setAttribute('aria-label', 'Zoom e visualização');

  const menos = criarBotao('−', { titulo: 'Diminuir zoom (Ctrl + roda do mouse)', rotuloAcessivel: 'Diminuir zoom', classe: 'mc-botao--icone' });
  botaoZoom = criarBotao('100%', { titulo: 'Voltar a 100%', rotuloAcessivel: 'Zoom atual; clique para voltar a 100%', classe: 'mc-zoom-valor' });
  const mais = criarBotao('+', { titulo: 'Aumentar zoom (Ctrl + roda do mouse)', rotuloAcessivel: 'Aumentar zoom', classe: 'mc-botao--icone' });
  const ajustar = criarBotao('Ajustar', { titulo: 'Ajustar a página à largura do palco' });
  const separador = document.createElement('span');
  separador.className = 'mc-controles-canvas__separador';
  botaoCelular = criarBotao('Celular', { titulo: 'Prévia a 390px. Mover e redimensionar ficam desligados.' });
  botaoCelular.setAttribute('aria-pressed', 'false');

  menos.addEventListener('click', () => passoDeZoom(-1));
  mais.addEventListener('click', () => passoDeZoom(1));
  botaoZoom.addEventListener('click', () => definirZoom(1));
  ajustar.addEventListener('click', () => ajustarZoom());
  botaoCelular.addEventListener('click', alternarCelular);

  grupo.append(menos, botaoZoom, mais, ajustar, separador, botaoCelular);
  document.getElementById('mc-controles-palco').append(grupo);
}

function montarSobreposicao() {
  sobre.tabIndex = -1;
  sobre.setAttribute('aria-label', 'Página em edição: clique para selecionar, arraste para mover, duplo clique edita o texto');
  caixaHover = document.createElement('div');
  caixaHover.className = 'mc-caixa mc-caixa--hover';
  caixaHover.hidden = true;
  camadaSelecao = document.createElement('div');
  camadaSelecao.className = 'mc-camada-selecao';
  rotulo = document.createElement('div');
  rotulo.className = 'mc-rotulo';
  rotulo.hidden = true;
  areaSelecao = document.createElement('div');
  areaSelecao.className = 'mc-area-selecao';
  areaSelecao.hidden = true;
  sobre.replaceChildren(caixaHover, camadaSelecao);
  for (const nome of ALCAS) {
    const alca = document.createElement('div');
    alca.className = 'mc-alca';
    alca.dataset.alca = nome;
    alca.hidden = true;
    alcas[nome] = alca;
    sobre.append(alca);
  }
  sobre.append(rotulo, areaSelecao);
}

export function iniciarCanvas() {
  palco = document.getElementById('mc-palco');
  iframe = document.getElementById('mc-quadro');
  sobre = document.getElementById('mc-sobreposicao');
  montarSobreposicao();
  montarControles();

  sobre.addEventListener('pointerdown', aoPressionar);
  sobre.addEventListener('pointermove', aoMover);
  sobre.addEventListener('pointerup', aoSoltar);
  sobre.addEventListener('pointercancel', cancelarArrasto);
  sobre.addEventListener('pointerleave', () => {
    if (arrasto) return;
    hover = null;
    desenharHover();
  });
  sobre.addEventListener('dblclick', aoDuploClique);
  palco.addEventListener('wheel', aoRodar, { passive: false });
  palco.addEventListener('dragover', (evento) => {
    if (!temArquivos(evento) || !docAtual()) return;
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
  });
  palco.addEventListener('drop', (evento) => {
    if (!temArquivos(evento) || !docAtual()) return;
    evento.preventDefault();
    const imagens = imagensDe(evento.dataTransfer);
    if (!imagens.length) {
      nucleo.avisar('erro', 'Solte arquivos de imagem (PNG, JPG, GIF, WEBP ou SVG).');
      return;
    }
    inserirImagens(imagens, pontoNaPrancheta(paraDocumento(pontoNaSobreposicao(evento))));
  });
  // Arquivo solto fora do palco não pode fazer o navegador sair do editor.
  window.addEventListener('dragover', (evento) => {
    if (evento.defaultPrevented || !temArquivos(evento)) return;
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'none';
  });
  window.addEventListener('drop', (evento) => {
    if (!evento.defaultPrevented && temArquivos(evento)) evento.preventDefault();
  });

  document.addEventListener('keydown', aoTeclar);
  document.addEventListener('copy', aoCopiarSistema);
  document.addEventListener('cut', aoCopiarSistema);
  document.addEventListener('paste', aoColar);
  // Clique fora da edição de texto a encerra (o inspetor pode ser usado durante a edição).
  document.addEventListener('pointerdown', (evento) => {
    if (!edicao || evento.target.closest?.('#mc-inspetor')) return;
    const noPalco = palco.contains(evento.target);
    finalizarEdicao();
    if (noPalco) nucleo.limparSelecao();
  }, true);

  new ResizeObserver(agendar).observe(palco);

  nucleo.servicos.centroVisivel = centroVisivel;
  nucleo.servicos.editarTexto = (el) => iniciarEdicao(el);
  nucleo.servicos.finalizarEdicao = finalizarEdicao;

  nucleo.on('pagina:carregada', ({ doc }) => {
    edicao = null;
    arrasto = null;
    hover = null;
    sobre.classList.remove('mc-sobreposicao--editando');
    prepararDocumento(doc);
    atualizarAgora();
    if (primeiraPagina) {
      primeiraPagina = false;
      ajustarZoom({ maximo: 1 });
    }
    palco.scrollTop = 0;
  });
  nucleo.on('documento:mudou', agendar);
  nucleo.on('selecao:mudou', () => {
    grupoSetas += 1;
    if (edicao && !estado.selecao.includes(edicao.el)) finalizarEdicao();
    agendar();
  });

  atualizarRotuloZoom();
  if (docAtual()) {
    prepararDocumento(estado.doc);
    atualizarAgora();
  }
}
