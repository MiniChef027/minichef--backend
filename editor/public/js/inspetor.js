// Inspetor do Editor MiniChef: propriedades da página (sem seleção), de um elemento
// (caixa, texto, imagem) ou as comuns a vários elementos.
// Os valores mostrados vêm do estilo computado. Toda escrita de estilo passa por
// nucleo.aplicarEstilo; controles contínuos usam `agrupar` para virar um passo só no histórico.
import * as nucleo from './nucleo.js';

const { estado, servicos } = nucleo;

// ---------------------------------------------------------------- dados

const FONTES = [
  { nome: 'Arial', pilha: 'Arial, Helvetica, sans-serif' },
  { nome: 'Georgia', pilha: 'Georgia, serif' },
  { nome: 'Verdana', pilha: 'Verdana, Geneva, sans-serif' },
  { nome: 'Times New Roman', pilha: '"Times New Roman", Times, serif' },
  { nome: 'Courier New', pilha: '"Courier New", Courier, monospace' },
  { nome: 'Trebuchet MS', pilha: '"Trebuchet MS", Helvetica, sans-serif' },
  { nome: 'Poppins', pilha: 'Poppins, sans-serif', google: 'Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700' },
  { nome: 'Roboto', pilha: 'Roboto, sans-serif', google: 'Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,400;1,700' },
  { nome: 'Montserrat', pilha: 'Montserrat, sans-serif', google: 'Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700' },
  { nome: 'Playfair Display', pilha: '"Playfair Display", serif', google: 'Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,700' },
  { nome: 'Lobster', pilha: 'Lobster, cursive', google: 'Lobster' },
  { nome: 'Nunito', pilha: 'Nunito, sans-serif', google: 'Nunito:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700' },
];

const PESOS = [
  ['100', 'Fino (100)'], ['200', 'Extraleve (200)'], ['300', 'Leve (300)'], ['400', 'Normal (400)'],
  ['500', 'Médio (500)'], ['600', 'Seminegrito (600)'], ['700', 'Negrito (700)'],
  ['800', 'Extranegrito (800)'], ['900', 'Black (900)'],
];

const TAGS_TEXTO = [
  ['div', 'Bloco (div)'], ['h1', 'Título 1 (h1)'], ['h2', 'Título 2 (h2)'], ['h3', 'Título 3 (h3)'], ['p', 'Parágrafo (p)'],
];

const GLOW_PADRAO = { hex: '#ffd54a', blur: 20, alcance: 4 };

// ---------------------------------------------------------------- utilidades

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const arred = (n, casas = 0) => Math.round(n * 10 ** casas) / 10 ** casas;
const estilo = (el) => (el.ownerDocument.defaultView ?? window).getComputedStyle(el);
const sel = () => estado.selecao.filter((el) => el.isConnected);
const primeiro = () => sel()[0] ?? null;

function aplicar(props, agrupar = null) {
  nucleo.aplicarEstilo(sel(), props, { agrupar, origem: 'inspetor' });
}

// Para valores que dependem de cada elemento: agrupa por resultado e registra um único passo no histórico.
let contadorAcao = 0;
function aplicarPorElemento(lista, gerar, agrupar = null) {
  const grupos = new Map();
  for (const el of lista) {
    const props = gerar(el);
    const chave = JSON.stringify(props);
    if (!grupos.has(chave)) grupos.set(chave, { props, els: [] });
    grupos.get(chave).els.push(el);
  }
  const chaveGrupo = grupos.size > 1 ? (agrupar ?? `inspetor-acao-${++contadorAcao}`) : agrupar;
  for (const { props, els } of grupos.values()) {
    nucleo.aplicarEstilo(els, props, { agrupar: chaveGrupo, origem: 'inspetor' });
  }
}

// --- cores

const contextoCor = document.createElement('canvas').getContext('2d');

function lerHex(texto) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(texto ?? '').trim());
  if (!m) return null;
  const v = m[1].toLowerCase();
  return `#${v.length === 3 ? [...v].map((c) => c + c).join('') : v}`;
}

const rgbDeHex = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const hexDe = (cor) => `#${[cor.r, cor.g, cor.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Aceita rgb()/rgba() (forma do estilo computado), #hex e, via canvas, qualquer outra cor CSS.
function lerCor(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(t);
  if (m) {
    const a = m[4] === undefined ? 1 : m[5] ? Number(m[4]) / 100 : Number(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
  }
  const hex = lerHex(t);
  if (hex) return { ...rgbDeHex(hex), a: 1 };
  contextoCor.fillStyle = '#000000';
  contextoCor.fillStyle = t;
  const normal = contextoCor.fillStyle;
  return normal === t ? null : lerCor(normal);
}

function corCss(hex, alfa = 1) {
  if (alfa >= 1) return hex;
  const { r, g, b } = rgbDeHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${arred(alfa, 2)})`;
}

// --- sombras (glow) e filtro (brilho)

function dividirNoTopo(texto, separador) {
  const partes = [];
  let nivel = 0;
  let atual = '';
  for (const c of texto) {
    if (c === '(') nivel += 1;
    else if (c === ')') nivel -= 1;
    const corta = nivel === 0 && (separador === ' ' ? /\s/.test(c) : c === separador);
    if (corta) {
      partes.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  partes.push(atual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

function lerSombras(texto) {
  if (!texto || texto === 'none') return [];
  return dividirNoTopo(texto, ',').map((camada) => {
    const sombra = { cor: null, inset: false };
    const medidas = [];
    for (const parte of dividirNoTopo(camada, ' ')) {
      if (parte === 'inset') sombra.inset = true;
      else if (/^-?[\d.]+(px)?$/.test(parte)) medidas.push(parseFloat(parte));
      else sombra.cor = lerCor(parte);
    }
    [sombra.x = 0, sombra.y = 0, sombra.blur = 0, sombra.spread = 0] = medidas;
    return sombra;
  });
}

// Glow = sombra sem deslocamento. Na caixa: box-shadow com desfoque e alcance (spread).
// No texto (text-shadow não tem spread): núcleo com metade do desfoque + halo com o desfoque inteiro.
function lerGlow(el) {
  const cs = estilo(el);
  const caixa = lerSombras(cs.boxShadow);
  const texto = lerSombras(cs.textShadow);
  const eGlow = (camadas) => camadas.length > 0 && camadas.every((c) => !c.inset && c.x === 0 && c.y === 0);
  const temCaixa = eGlow(caixa);
  const temTexto = eGlow(texto);
  if (!temCaixa && !temTexto) return { ligado: false };
  const base = temCaixa ? caixa[0] : texto[texto.length - 1];
  const glow = {
    ligado: true,
    alvo: temCaixa && temTexto ? 'ambos' : temCaixa ? 'caixa' : 'texto',
    blur: temCaixa ? base.blur : Math.max(...texto.map((c) => c.blur)),
  };
  if (base.cor) glow.hex = hexDe(base.cor);
  if (temCaixa) glow.alcance = base.spread;
  return glow;
}

function lerBrilho(el) {
  const m = /brightness\(\s*([\d.]+)(%?)\s*\)/.exec(estilo(el).filter);
  if (!m) return 100;
  return arred(m[2] ? Number(m[1]) : Number(m[1]) * 100);
}

// Troca só o brightness() do filtro inline, preservando outros filtros escritos à mão.
function filtroComBrilho(el, pct) {
  const resto = (el.style.filter || '')
    .replace(/brightness\([^)]*\)/g, '')
    .replace(/\bnone\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [resto, pct === 100 ? '' : `brightness(${pct}%)`].filter(Boolean).join(' ') || null;
}

// --- fontes

const primeiraFamilia = (pilha) => String(pilha ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '');
const fontePorNome = (nome) => FONTES.find((f) => f.nome.toLowerCase() === String(nome).toLowerCase()) ?? null;
const urlFonte = (fonte) => `https://fonts.googleapis.com/css2?family=${fonte.google}&display=swap`;

// Mantém um <link data-mc-fonte> por Google Font usada no body, e só esses. Roda após cada mudança
// (inclusive desfazer/colar), então o arquivo salvo nunca fica sem a fonte nem com link sobrando.
// O <head> não entra no histórico do núcleo; por isso o link é derivado do body, não uma edição própria.
function sincronizarFontes() {
  const doc = estado.doc;
  if (!doc?.head || !doc.body) return;
  const usadas = new Set();
  for (const el of [doc.body, ...doc.body.querySelectorAll('[style]')]) {
    const fonte = fontePorNome(primeiraFamilia(el.style.fontFamily));
    if (fonte?.google) usadas.add(fonte.nome);
  }
  for (const link of doc.head.querySelectorAll('link[data-mc-fonte]')) {
    if (!usadas.delete(link.getAttribute('data-mc-fonte'))) link.remove();
  }
  for (const nome of usadas) {
    const fonte = fontePorNome(nome);
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = urlFonte(fonte);
    link.setAttribute('data-mc-fonte', fonte.nome);
    doc.head.append(link);
  }
}

// ---------------------------------------------------------------- construção de controles

function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (nome === 'class') el.className = valor;
    else if (nome.startsWith('on')) el.addEventListener(nome.slice(2), valor);
    else el.setAttribute(nome, valor === true ? '' : String(valor));
  }
  el.append(...filhos.flat().filter((f) => f !== null && f !== undefined && f !== false));
  return el;
}

// Não sobrescreve o campo de digitação que está com foco (o usuário pode estar no meio de um número).
function definirValor(campo, valor) {
  if (campo === document.activeElement && (campo.type === 'number' || campo.type === 'text')) return;
  campo.value = valor;
}

const rotuloComUnidade = (rotulo, unidade) => [rotulo, unidade ? h('span', { class: 'mc-sr' }, ` (${unidade})`) : null];

function controleCor(chave, rotulo, aoMudar) {
  const id = `mc-i-${chave}`;
  const seletor = h('input', { type: 'color', class: 'mc-campo', id: `${id}-seletor` });
  const texto = h('input', {
    type: 'text', class: 'mc-campo mc-insp-hex', id, spellcheck: 'false', autocomplete: 'off', maxlength: '7',
  });
  let ultimo = null;
  const emitir = (hex) => {
    seletor.value = hex;
    if (hex === ultimo) return;
    ultimo = hex;
    aoMudar(hex, chave);
  };
  seletor.addEventListener('input', () => {
    texto.value = seletor.value;
    texto.removeAttribute('aria-invalid');
    emitir(seletor.value);
  });
  texto.addEventListener('input', () => {
    const hex = lerHex(texto.value);
    if (hex) texto.removeAttribute('aria-invalid');
    else texto.setAttribute('aria-invalid', 'true');
    if (hex && /^#?[0-9a-f]{6}$/i.test(texto.value.trim())) emitir(hex);
  });
  texto.addEventListener('change', () => {
    const hex = lerHex(texto.value);
    if (hex) emitir(hex);
    texto.value = hex ?? seletor.value;
    texto.removeAttribute('aria-invalid');
  });
  return {
    elemento: h('div', { class: 'mc-linha' },
      h('label', { for: id }, rotulo),
      h('label', { for: `${id}-seletor`, class: 'mc-sr' }, `${rotulo}: seletor de cor`),
      seletor, texto),
    definir(hex) {
      ultimo = hex;
      definirValor(seletor, hex);
      definirValor(texto, hex);
    },
    habilitar(sim) {
      seletor.disabled = !sim;
      texto.disabled = !sim;
    },
  };
}

// Número aplicado ao confirmar (Enter, sair do campo ou setas). `vazio` permite apagar o valor (ex.: altura automática).
function controleNumero(chave, rotulo, { min, max, passo = 1, unidade = '', vazio = null }, aoMudar) {
  const id = `mc-i-${chave}`;
  const campo = h('input', {
    type: 'number', class: 'mc-campo', id, min, max, step: passo, inputmode: 'decimal', placeholder: vazio ?? '',
  });
  campo.addEventListener('change', () => {
    if (campo.value === '') {
      if (vazio !== null) aoMudar(null, chave);
      else agendarAtualizacao();
      return;
    }
    const n = campo.valueAsNumber;
    if (Number.isFinite(n)) aoMudar(limitar(n, min, max), chave);
  });
  campo.addEventListener('blur', agendarAtualizacao);
  return {
    campo,
    elemento: h('div', { class: 'mc-linha' }, h('label', { for: id }, rotuloComUnidade(rotulo, unidade)), campo),
    definir(n) {
      definirValor(campo, n === null || n === undefined ? '' : String(arred(n, passo < 1 ? 2 : 0)));
    },
    habilitar(sim) {
      campo.disabled = !sim;
    },
  };
}

// Controle deslizante com campo numérico ao lado; o deslizante aplica ao vivo (agrupado no histórico).
function controleFaixa(chave, rotulo, { min, max, passo = 1, unidade = '' }, aoMudar) {
  const id = `mc-i-${chave}`;
  const faixa = h('input', { type: 'range', class: 'mc-campo', id, min, max, step: passo });
  const numero = h('input', {
    type: 'number', class: 'mc-campo mc-insp-num', id: `${id}-num`, min, max, step: passo, inputmode: 'decimal',
  });
  faixa.addEventListener('input', () => {
    numero.value = faixa.value;
    aoMudar(Number(faixa.value), chave);
  });
  numero.addEventListener('change', () => {
    const n = numero.valueAsNumber;
    if (!Number.isFinite(n)) return agendarAtualizacao();
    const v = limitar(n, min, max);
    faixa.value = String(v);
    aoMudar(v, chave);
  });
  numero.addEventListener('blur', agendarAtualizacao);
  return {
    elemento: h('div', { class: 'mc-linha' },
      h('label', { for: id }, rotuloComUnidade(rotulo, unidade)),
      faixa,
      h('label', { for: `${id}-num`, class: 'mc-sr' }, `${rotulo}: valor${unidade ? ` em ${unidade}` : ''}`),
      numero),
    definir(n) {
      definirValor(faixa, String(n));
      definirValor(numero, String(arred(n, 1)));
    },
    habilitar(sim) {
      faixa.disabled = !sim;
      numero.disabled = !sim;
    },
  };
}

// opcoes: [[valor, texto]] ou [{ grupo, opcoes: [[valor, texto]] }]
function controleSelecao(chave, rotulo, opcoes, aoMudar) {
  const id = `mc-i-${chave}`;
  const opcao = ([valor, texto]) => h('option', { value: valor }, texto);
  const campo = h('select', { class: 'mc-campo', id },
    opcoes.map((o) => (Array.isArray(o) ? opcao(o) : h('optgroup', { label: o.grupo }, o.opcoes.map(opcao)))));
  campo.addEventListener('change', () => aoMudar(campo.value, chave));
  return {
    campo,
    elemento: h('div', { class: 'mc-linha' }, h('label', { for: id }, rotulo), campo),
    definir(valor) {
      campo.value = valor;
    },
    habilitar(sim) {
      campo.disabled = !sim;
    },
  };
}

function controleMarcar(chave, rotulo, aoMudar) {
  const id = `mc-i-${chave}`;
  const campo = h('input', { type: 'checkbox', id });
  campo.addEventListener('change', () => aoMudar(campo.checked, chave));
  return {
    elemento: h('div', { class: 'mc-linha mc-insp-marcar' }, campo, h('label', { for: id }, rotulo)),
    definir(sim) {
      campo.checked = !!sim;
    },
  };
}

function controleTexto(chave, rotulo, { dica, placeholder } = {}, aoMudar) {
  const id = `mc-i-${chave}`;
  const idDica = `${id}-dica`;
  const campo = h('input', {
    type: 'text', class: 'mc-campo', id, placeholder, autocomplete: 'off', 'aria-describedby': dica ? idDica : null,
  });
  campo.addEventListener('input', () => aoMudar(campo.value, chave));
  campo.addEventListener('blur', agendarAtualizacao);
  return {
    elemento: h('div', { class: 'mc-linha mc-insp-empilhado' },
      h('label', { for: id }, rotulo), campo, dica ? h('p', { class: 'mc-insp-dica', id: idDica }, dica) : null),
    definir(valor) {
      definirValor(campo, valor);
    },
  };
}

// Botões de alternância (aria-pressed). botoes: [{ valor, texto, rotulo }]; texto pode ser nó.
function controleBotoes(chave, rotulo, botoes, aoClicar) {
  const idRotulo = `mc-i-${chave}-rotulo`;
  const lista = botoes.map((b) => h('button', {
    type: 'button', class: 'mc-botao', id: `mc-i-${chave}-${b.valor}`, 'aria-pressed': 'false',
    'aria-label': b.rotulo, title: b.rotulo, onclick: () => aoClicar(b.valor),
  }, b.texto));
  return {
    elemento: h('div', { class: 'mc-linha' },
      h('span', { class: 'mc-rotulo', id: idRotulo }, rotulo),
      h('div', { class: 'mc-insp-botoes', role: 'group', 'aria-labelledby': idRotulo }, lista)),
    definir(ativos) {
      for (const [i, b] of botoes.entries()) lista[i].setAttribute('aria-pressed', String(ativos.has(b.valor)));
    },
  };
}

function iconeAlinhar(larguras) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  larguras.forEach(([x, w], i) => {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', 3 + i * 4);
    r.setAttribute('width', w);
    r.setAttribute('height', '1.6');
    r.setAttribute('fill', 'currentColor');
    svg.append(r);
  });
  return svg;
}

const secao = (titulo, ...filhos) => h('section', { class: 'mc-grupo' }, h('h2', {}, titulo), ...filhos);

// ---------------------------------------------------------------- seções

let atualizadores = [];

function cabecalho(titulo, detalhe) {
  return h('div', { class: 'mc-insp-cabecalho' },
    h('p', { class: 'mc-insp-titulo' }, titulo),
    detalhe ? h('span', { class: 'mc-status', title: detalhe }, detalhe) : null);
}

function secoesPagina() {
  const comPrancheta = (fn) => (...args) => {
    const p = nucleo.prancheta();
    if (p) fn(p, ...args);
  };
  const fundoPrancheta = controleCor('pag-prancheta', 'Fundo da prancheta', comPrancheta((p, hex, g) =>
    nucleo.aplicarEstilo(p, { 'background-color': hex }, { agrupar: g, origem: 'inspetor' })));
  const fundoBody = controleCor('pag-body', 'Fundo da página', (hex, g) =>
    nucleo.aplicarEstilo(estado.doc.body, { 'background-color': hex }, { agrupar: g, origem: 'inspetor' }));
  const altura = controleNumero('pag-altura', 'Altura da prancheta', { min: 100, max: 50000, unidade: 'px' },
    comPrancheta((p, n) => nucleo.aplicarEstilo(p, { height: `${Math.round(n)}px` }, { origem: 'inspetor' })));
  const nota = h('p', { class: 'mc-insp-dica' },
    'Esta página não tem prancheta. Ela é criada ao inserir o primeiro elemento.');
  const dicaAltura = h('p', { class: 'mc-insp-dica' }, 'A prancheta nunca fica menor que o conteúdo + 40 px.');

  atualizadores.push(() => {
    const p = nucleo.prancheta();
    fundoPrancheta.habilitar(!!p);
    altura.habilitar(!!p);
    nota.hidden = !!p;
    dicaAltura.hidden = !p;
    if (p) {
      const cor = lerCor(estilo(p).backgroundColor);
      fundoPrancheta.definir(cor && cor.a > 0 ? hexDe(cor) : '#ffffff');
      altura.definir(parseFloat(estilo(p).height) || p.offsetHeight);
    }
    const corBody = lerCor(estilo(estado.doc.body).backgroundColor);
    fundoBody.definir(corBody && corBody.a > 0 ? hexDe(corBody) : '#ffffff');
  });

  return [
    cabecalho('Página', estado.caminho),
    secao('Cores', fundoPrancheta.elemento, fundoBody.elemento),
    secao('Prancheta', altura.elemento, dicaAltura, nota),
  ];
}

function secaoPreenchimento() {
  const st = { hex: '#ffffff', alfa: 100, sem: false };
  const escrever = (agrupar) => aplicar(
    { 'background-color': st.sem ? 'transparent' : corCss(st.hex, st.alfa / 100) }, agrupar);
  const sem = controleMarcar('fundo-sem', 'Sem fundo', (marcado) => {
    st.sem = marcado;
    if (!marcado && st.alfa === 0) st.alfa = 100;
    escrever();
  });
  const cor = controleCor('fundo-cor', 'Cor', (hex, g) => {
    st.hex = hex;
    st.sem = false;
    if (st.alfa === 0) st.alfa = 100;
    escrever(g);
  });
  const alfa = controleFaixa('fundo-alfa', 'Opacidade', { min: 0, max: 100, unidade: '%' }, (v, g) => {
    st.alfa = v;
    st.sem = false;
    escrever(g);
  });
  atualizadores.push(() => {
    const c = lerCor(estilo(primeiro()).backgroundColor);
    st.sem = !c || c.a === 0;
    if (!st.sem) {
      st.hex = hexDe(c);
      st.alfa = Math.round(c.a * 100);
    }
    sem.definir(st.sem);
    cor.definir(st.hex);
    alfa.definir(st.sem ? 0 : st.alfa);
  });
  return secao('Preenchimento', sem.elemento, cor.elemento, alfa.elemento);
}

function secaoBorda() {
  const st = { hex: '#1f1f1f', largura: 0 };
  const escrever = (agrupar) => aplicar(st.largura > 0
    ? { 'border-style': 'solid', 'border-width': `${st.largura}px`, 'border-color': st.hex }
    : { 'border-style': null, 'border-width': null, 'border-color': null }, agrupar);
  const cor = controleCor('borda-cor', 'Cor', (hex, g) => {
    st.hex = hex;
    if (st.largura === 0) st.largura = 1;
    escrever(g);
  });
  const largura = controleNumero('borda-largura', 'Espessura', { min: 0, max: 50, unidade: 'px' }, (n, g) => {
    st.largura = Math.round(n);
    escrever(g);
  });
  const raio = controleNumero('borda-raio', 'Raio', { min: 0, max: 999, unidade: 'px' }, (n, g) =>
    aplicar({ 'border-radius': `${Math.round(n)}px` }, g));
  atualizadores.push(() => {
    const cs = estilo(primeiro());
    st.largura = cs.borderTopStyle === 'none' || cs.borderTopStyle === 'hidden' ? 0 : Math.round(parseFloat(cs.borderTopWidth) || 0);
    const c = lerCor(cs.borderTopColor);
    if (st.largura > 0 && c) st.hex = hexDe(c);
    cor.definir(st.hex);
    largura.definir(st.largura);
    raio.definir(parseFloat(cs.borderTopLeftRadius) || 0);
  });
  return secao('Borda', cor.elemento, largura.elemento, raio.elemento);
}

function trocarTag(el, tag) {
  if (!el || el.tagName.toLowerCase() === tag) return;
  servicos.finalizarEdicao?.();
  const novo = el.ownerDocument.createElement(tag);
  for (const atributo of el.attributes) novo.setAttribute(atributo.name, atributo.value);
  novo.append(...el.childNodes);
  el.replaceWith(novo);
  nucleo.selecionar(estado.selecao.map((x) => (x === el ? novo : x)));
  nucleo.alterado('inspetor');
}

function secaoTexto(el) {
  const fonte = controleSelecao('txt-fonte', 'Fonte', [
    ['', 'Padrão da página'],
    { grupo: 'Seguras (já instaladas)', opcoes: FONTES.filter((f) => !f.google).map((f) => [f.nome, f.nome]) },
    { grupo: 'Google Fonts', opcoes: FONTES.filter((f) => f.google).map((f) => [f.nome, f.nome]) },
  ], (nome) => {
    aplicar({ 'font-family': fontePorNome(nome)?.pilha ?? null });
    sincronizarFontes();
  });
  const opcaoAtual = h('option', { value: '__atual', disabled: true, hidden: true });
  fonte.campo.append(opcaoAtual);

  const tamanho = controleNumero('txt-tamanho', 'Tamanho', { min: 6, max: 400, unidade: 'px' }, (n, g) =>
    aplicar({ 'font-size': `${n}px` }, g));
  const peso = controleSelecao('txt-peso', 'Peso', PESOS, (v) => aplicar({ 'font-weight': v }));

  const estilos = controleBotoes('txt-estilo', 'Estilo', [
    { valor: 'italico', texto: h('i', {}, 'I'), rotulo: 'Itálico' },
    { valor: 'sublinhado', texto: h('u', {}, 'S'), rotulo: 'Sublinhado' },
    { valor: 'tachado', texto: h('s', {}, 'abc'), rotulo: 'Tachado' },
  ], (valor) => {
    const cs = estilo(primeiro());
    if (valor === 'italico') {
      aplicar({ 'font-style': cs.fontStyle === 'italic' ? null : 'italic' });
      return;
    }
    const linhas = new Set(cs.textDecorationLine.split(/\s+/).filter((l) => l && l !== 'none'));
    const linha = valor === 'sublinhado' ? 'underline' : 'line-through';
    if (linhas.has(linha)) linhas.delete(linha);
    else linhas.add(linha);
    aplicar({ 'text-decoration-line': linhas.size ? [...linhas].join(' ') : null });
  });
  const alinhamento = controleBotoes('txt-alinhar', 'Alinhar', [
    { valor: 'left', texto: iconeAlinhar([[2, 12], [2, 8], [2, 10]]), rotulo: 'Alinhar à esquerda' },
    { valor: 'center', texto: iconeAlinhar([[2, 12], [4, 8], [3, 10]]), rotulo: 'Centralizar' },
    { valor: 'right', texto: iconeAlinhar([[2, 12], [6, 8], [4, 10]]), rotulo: 'Alinhar à direita' },
    { valor: 'justify', texto: iconeAlinhar([[2, 12], [2, 12], [2, 12]]), rotulo: 'Justificar' },
  ], (valor) => aplicar({ 'text-align': valor }));
  const cor = controleCor('txt-cor', 'Cor', (hex, g) => aplicar({ color: hex }, g));
  const letras = controleNumero('txt-letras', 'Entre letras', { min: -10, max: 100, passo: 0.5, unidade: 'px' }, (n, g) =>
    aplicar({ 'letter-spacing': n ? `${n}px` : null }, g));
  const entrelinha = controleNumero('txt-linha', 'Altura da linha', { min: 0.5, max: 5, passo: 0.1, vazio: 'normal' }, (n, g) =>
    aplicar({ 'line-height': n === null ? null : String(arred(n, 2)) }, g));
  const caixaAlta = controleSelecao('txt-caixa', 'Maiúsculas', [
    ['none', 'Como digitado'], ['uppercase', 'MAIÚSCULAS'], ['lowercase', 'minúsculas'], ['capitalize', 'Iniciais Maiúsculas'],
  ], (v) => aplicar({ 'text-transform': v === 'none' ? null : v }));
  const podeTrocarTag = TAGS_TEXTO.some(([tag]) => tag === el.tagName.toLowerCase());
  const tipo = podeTrocarTag ? controleSelecao('txt-tipo', 'Tipo', TAGS_TEXTO, (tag) => trocarTag(primeiro(), tag)) : null;

  atualizadores.push(() => {
    const alvo = primeiro();
    const cs = estilo(alvo);
    const conhecida = fontePorNome(primeiraFamilia(cs.fontFamily));
    opcaoAtual.hidden = true;
    if (conhecida && alvo.style.fontFamily) {
      fonte.definir(conhecida.nome);
    } else if (alvo.style.fontFamily) {
      opcaoAtual.textContent = `${primeiraFamilia(alvo.style.fontFamily)} (atual)`;
      opcaoAtual.hidden = false;
      fonte.definir('__atual');
    } else {
      fonte.definir('');
    }
    tamanho.definir(parseFloat(cs.fontSize));
    const pesoArredondado = String(limitar(Math.round(Number(cs.fontWeight) / 100) * 100, 100, 900));
    peso.definir(pesoArredondado);
    const linhas = cs.textDecorationLine;
    estilos.definir(new Set([
      cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique') ? 'italico' : '',
      linhas.includes('underline') ? 'sublinhado' : '',
      linhas.includes('line-through') ? 'tachado' : '',
    ]));
    const alinhar = { start: 'left', end: 'right', '-webkit-left': 'left', '-webkit-center': 'center', '-webkit-right': 'right' }[cs.textAlign] ?? cs.textAlign;
    alinhamento.definir(new Set([alinhar]));
    const c = lerCor(cs.color);
    if (c) cor.definir(hexDe(c));
    letras.definir(cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing));
    entrelinha.definir(cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight) / parseFloat(cs.fontSize));
    caixaAlta.definir(['uppercase', 'lowercase', 'capitalize'].includes(cs.textTransform) ? cs.textTransform : 'none');
    tipo?.definir(alvo.tagName.toLowerCase());
  });

  return secao('Texto',
    tipo?.elemento, fonte.elemento, tamanho.elemento, peso.elemento, estilos.elemento, alinhamento.elemento,
    cor.elemento, letras.elemento, entrelinha.elemento, caixaAlta.elemento);
}

function secaoEfeitos({ comAlvo, alvoPadrao }) {
  const st = { ligado: false, ...GLOW_PADRAO, alvo: alvoPadrao };
  const escreverGlow = (agrupar) => {
    const alvo = comAlvo ? st.alvo : 'caixa';
    const caixa = `0 0 ${st.blur}px ${st.alcance}px ${st.hex}`;
    const texto = `0 0 ${arred(st.blur / 2, 1)}px ${st.hex}, 0 0 ${st.blur}px ${st.hex}`;
    aplicar({
      'box-shadow': st.ligado && alvo !== 'texto' ? caixa : null,
      'text-shadow': st.ligado && alvo !== 'caixa' ? texto : null,
    }, agrupar);
  };
  const ligado = controleMarcar('glow-ligado', 'Glow (luz em volta)', (sim) => {
    st.ligado = sim;
    escreverGlow();
  });
  const cor = controleCor('glow-cor', 'Cor', (hex, g) => {
    st.hex = hex;
    escreverGlow(g);
  });
  const blur = controleFaixa('glow-blur', 'Intensidade', { min: 0, max: 60, unidade: 'px' }, (v, g) => {
    st.blur = v;
    escreverGlow(g);
  });
  const alcance = controleFaixa('glow-alcance', 'Alcance', { min: 0, max: 30, unidade: 'px' }, (v, g) => {
    st.alcance = v;
    escreverGlow(g);
  });
  const alvo = comAlvo
    ? controleSelecao('glow-alvo', 'Aplicar em', [['caixa', 'Caixa'], ['texto', 'Texto'], ['ambos', 'Caixa e texto']], (v) => {
      st.alvo = v;
      escreverGlow();
    })
    : null;
  const dicaAlcance = h('p', { class: 'mc-insp-dica' }, 'No texto, o CSS não tem alcance: use a intensidade.');
  const brilho = controleFaixa('brilho', 'Brilho', { min: 0, max: 200, unidade: '%' }, (v, g) =>
    aplicarPorElemento(sel(), (el) => ({ filter: filtroComBrilho(el, v) }), g));
  const opacidade = controleFaixa('opacidade', 'Opacidade', { min: 0, max: 100, unidade: '%' }, (v, g) =>
    aplicar({ opacity: v === 100 ? null : String(arred(v / 100, 2)) }, g));

  atualizadores.push(() => {
    const el = primeiro();
    const glow = lerGlow(el);
    Object.assign(st, glow);
    ligado.definir(st.ligado);
    cor.habilitar(st.ligado);
    blur.habilitar(st.ligado);
    alvo?.habilitar(st.ligado);
    const semAlcance = comAlvo && st.alvo === 'texto';
    alcance.habilitar(st.ligado && !semAlcance);
    dicaAlcance.hidden = !(st.ligado && semAlcance);
    cor.definir(st.hex);
    blur.definir(st.blur);
    alcance.definir(st.alcance);
    alvo?.definir(st.alvo);
    brilho.definir(lerBrilho(el));
    opacidade.definir(Math.round(Number(estilo(el).opacity) * 100));
  });

  return secao('Efeitos',
    ligado.elemento, cor.elemento, blur.elemento, alcance.elemento, dicaAlcance, alvo?.elemento,
    h('hr', { class: 'mc-insp-separador' }), brilho.elemento, opacidade.elemento);
}

// --- camadas: a ordem no DOM é a ordem de empilhamento (o último fica por cima).

const ehCamada = (el) => !el.hasAttribute('data-mc-artefato');

function vizinho(el, direcao, ignorar) {
  let atual = direcao > 0 ? el.nextElementSibling : el.previousElementSibling;
  while (atual && (!ehCamada(atual) || ignorar?.has(atual))) {
    atual = direcao > 0 ? atual.nextElementSibling : atual.previousElementSibling;
  }
  return atual;
}

function moverCamada(acao) {
  const lista = sel().filter((el) => el.parentElement);
  if (!lista.length) return;
  servicos.finalizarEdicao?.();
  lista.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const selecionados = new Set(lista);
  let mudou = false;
  if (acao === 'topo') {
    for (const el of lista) {
      if (vizinho(el, 1, selecionados)) mudou = true;
      el.parentElement.append(el);
    }
  } else if (acao === 'fundo') {
    for (const el of [...lista].reverse()) {
      if (vizinho(el, -1, selecionados)) mudou = true;
      el.parentElement.prepend(el);
    }
  } else if (acao === 'frente') {
    for (const el of [...lista].reverse()) {
      const proximo = vizinho(el, 1, selecionados);
      if (proximo) {
        proximo.after(el);
        mudou = true;
      }
    }
  } else if (acao === 'tras') {
    for (const el of lista) {
      const anterior = vizinho(el, -1, selecionados);
      if (anterior) {
        anterior.before(el);
        mudou = true;
      }
    }
  }
  if (mudou) nucleo.alterado('camadas');
}

function secaoCamadas() {
  const botoes = Object.fromEntries([
    ['frente', 'Trazer para frente'],
    ['tras', 'Levar para trás'],
    ['topo', 'Trazer para o topo'],
    ['fundo', 'Enviar para o fundo'],
  ].map(([acao, texto]) => [acao, h('button', {
    type: 'button', class: 'mc-botao', id: `mc-i-camada-${acao}`, onclick: () => moverCamada(acao),
  }, texto)]));
  atualizadores.push(() => {
    const lista = sel();
    const unico = lista.length === 1 ? lista[0] : null;
    const temDepois = unico ? !!vizinho(unico, 1) : true;
    const temAntes = unico ? !!vizinho(unico, -1) : true;
    botoes.frente.disabled = !temDepois;
    botoes.topo.disabled = !temDepois;
    botoes.tras.disabled = !temAntes;
    botoes.fundo.disabled = !temAntes;
  });
  return secao('Camadas', h('div', { class: 'mc-insp-camadas' }, Object.values(botoes)));
}

function secaoGeometria() {
  const aplicarGeo = (chave) => (n, agrupar) => {
    const el = primeiro();
    if (!el) return;
    if (n === null) {
      nucleo.aplicarEstilo(el, { height: null, '--mc-a': null }, { agrupar, origem: 'inspetor' });
      return;
    }
    nucleo.definirGeometria(el, { [chave]: n });
    nucleo.alterado('inspetor', { agrupar });
  };
  const x = controleNumero('geo-x', 'X', { min: -20000, max: 20000, unidade: 'px' }, aplicarGeo('x'));
  const y = controleNumero('geo-y', 'Y', { min: -20000, max: 50000, unidade: 'px' }, aplicarGeo('y'));
  const largura = controleNumero('geo-w', 'Largura', { min: 1, max: 20000, unidade: 'px' }, aplicarGeo('w'));
  const altura = controleNumero('geo-h', 'Altura', { min: 1, max: 50000, unidade: 'px', vazio: 'auto' }, aplicarGeo('h'));
  atualizadores.push(() => {
    const el = primeiro();
    const g = nucleo.geometria(el);
    x.definir(g.x);
    y.definir(g.y);
    largura.definir(g.w);
    const automatica = !el.style.height;
    altura.definir(automatica ? null : g.h);
    altura.campo.placeholder = automatica ? `auto (${Math.round(el.offsetHeight)})` : 'auto';
  });
  return secao('Posição e tamanho', h('div', { class: 'mc-insp-grade' },
    x.elemento, y.elemento, largura.elemento, altura.elemento));
}

const TIPOS_IMAGEM = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';

function srcRelativo(caminhoImagem) {
  const profundidade = (estado.caminho ?? '').split('/').length - 1;
  return '../'.repeat(Math.max(0, profundidade)) + caminhoImagem;
}

async function trocarImagem(arquivo) {
  const el = primeiro();
  if (!arquivo || el?.tagName !== 'IMG') return;
  const doc = estado.doc;
  try {
    const { caminho } = await nucleo.api.enviarImagem(arquivo);
    if (estado.doc !== doc || !el.isConnected) return;
    el.setAttribute('src', srcRelativo(caminho));
    nucleo.alterado('inspetor');
  } catch (erro) {
    nucleo.avisar('erro', `Não foi possível trocar a imagem: ${erro.message}`);
  }
}

function secaoImagem() {
  const alt = controleTexto('img-alt', 'Texto alternativo', {
    placeholder: 'Descreva a imagem',
    dica: 'Lido por leitores de tela. Deixe vazio só se a imagem for decorativa.',
  }, (valor, chave) => {
    const el = primeiro();
    if (!el) return;
    el.setAttribute('alt', valor);
    nucleo.alterado('inspetor', { agrupar: chave });
  });
  const ajuste = controleSelecao('img-ajuste', 'Ajuste', [
    ['cover', 'Cobrir (corta as sobras)'], ['contain', 'Conter (imagem inteira)'], ['fill', 'Esticar'],
  ], (v) => aplicar({ 'object-fit': v }));
  const raio = controleNumero('img-raio', 'Raio da borda', { min: 0, max: 999, unidade: 'px' }, (n, g) =>
    aplicar({ 'border-radius': `${Math.round(n)}px` }, g));
  const arquivo = h('input', { type: 'file', accept: TIPOS_IMAGEM, hidden: true, id: 'mc-i-img-arquivo', tabindex: '-1' });
  arquivo.addEventListener('change', () => {
    const [escolhido] = arquivo.files;
    arquivo.value = '';
    trocarImagem(escolhido);
  });
  const trocar = h('button', { type: 'button', class: 'mc-botao', id: 'mc-i-img-trocar', onclick: () => arquivo.click() }, 'Trocar imagem…');
  atualizadores.push(() => {
    const el = primeiro();
    alt.definir(el.getAttribute('alt') ?? '');
    const encaixe = estilo(el).objectFit;
    ajuste.definir(['cover', 'contain', 'fill'].includes(encaixe) ? encaixe : 'fill');
    raio.definir(parseFloat(estilo(el).borderTopLeftRadius) || 0);
  });
  return secao('Imagem', alt.elemento, ajuste.elemento, raio.elemento, h('div', { class: 'mc-linha' }, trocar, arquivo));
}

// ---------------------------------------------------------------- montagem

const NOMES = { caixa: 'Caixa', texto: 'Texto', imagem: 'Imagem' };

function tipoDaSelecao() {
  if (!estado.doc) return 'vazio';
  const lista = sel();
  if (!lista.length) return 'pagina';
  if (lista.length > 1) return 'multiplo';
  const el = lista[0];
  if (el.hasAttribute('data-mc-prancheta') || el === estado.doc.body || el === estado.doc.documentElement) return 'pagina';
  return el.tagName === 'IMG' ? 'imagem' : 'elemento';
}

function secoesPara(tipo) {
  if (tipo === 'vazio') {
    return [h('p', { class: 'mc-insp-vazio' }, 'Abra ou crie uma página para editar as propriedades.')];
  }
  if (tipo === 'pagina') return secoesPagina();
  if (tipo === 'multiplo') {
    return [
      cabecalho(`${sel().length} elementos`, 'propriedades comuns'),
      secaoPreenchimento(), secaoBorda(), secaoEfeitos({ comAlvo: true, alvoPadrao: 'caixa' }), secaoCamadas(),
    ];
  }
  const el = primeiro();
  const tipoMc = nucleo.tipoDe(el);
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('data-mc-id');
  const detalhe = [tag !== 'div' && tag !== 'img' ? tag : null, id].filter(Boolean).join(' · ');
  if (tipo === 'imagem') {
    return [
      cabecalho(tipoMc ? NOMES.imagem : 'Imagem (escrita à mão)', detalhe),
      secaoImagem(), secaoEfeitos({ comAlvo: false, alvoPadrao: 'caixa' }), secaoCamadas(), secaoGeometria(),
    ];
  }
  const titulo = NOMES[tipoMc] ?? `Elemento <${tag}>`;
  const ehTexto = tipoMc === 'texto';
  const efeitos = secaoEfeitos({ comAlvo: true, alvoPadrao: ehTexto ? 'texto' : 'caixa' });
  const ordem = ehTexto
    ? [secaoTexto(el), secaoPreenchimento(), secaoBorda()]
    : [secaoPreenchimento(), secaoBorda(), secaoTexto(el)];
  return [cabecalho(titulo, detalhe), ...ordem, efeitos, secaoCamadas(), secaoGeometria()];
}

let raiz = null;
let tipoAnterior = null;
let quadroPendente = 0;

function atualizar() {
  if (!estado.doc && tipoAnterior !== 'vazio') return montar();
  if (estado.doc && !sel().length && tipoAnterior !== 'pagina') return montar();
  for (const fn of atualizadores) {
    try {
      fn();
    } catch (erro) {
      console.error('[inspetor] falha ao atualizar campo', erro);
    }
  }
}

// Várias mudanças no mesmo quadro (ex.: arrastar no canvas) viram uma leitura só.
function agendarAtualizacao() {
  if (quadroPendente) return;
  quadroPendente = requestAnimationFrame(() => {
    quadroPendente = 0;
    sincronizarFontes();
    atualizar();
  });
}

function montar() {
  const focado = raiz.contains(document.activeElement) ? document.activeElement.id : null;
  const tipo = tipoDaSelecao();
  const rolagem = tipo === tipoAnterior ? raiz.scrollTop : 0;
  atualizadores = [];
  raiz.replaceChildren(...secoesPara(tipo));
  tipoAnterior = tipo;
  atualizar();
  raiz.scrollTop = rolagem;
  if (focado) document.getElementById(focado)?.focus();
}

export function iniciarInspetor() {
  raiz = document.getElementById('mc-inspetor');
  if (!raiz) throw new Error('#mc-inspetor não encontrado');
  nucleo.on('selecao:mudou', montar);
  nucleo.on('pagina:carregada', () => {
    sincronizarFontes();
    montar();
  });
  nucleo.on('documento:mudou', agendarAtualizacao);
  montar();
}
