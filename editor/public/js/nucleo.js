// Núcleo do editor: estado compartilhado, eventos, histórico, API e helpers de documento.
// É o contrato entre canvas, inspetor e ferramentas (ver editor/CONTRATO.md).

export const TIPOS = Object.freeze({ CAIXA: 'caixa', TEXTO: 'texto', IMAGEM: 'imagem' });
export const LARGURA_PRANCHETA = 1280;
export const LARGURA_CELULAR = 390;

// CSS gravado em toda página criada pelo editor: posição livre no desktop, coluna no celular.
export const ESTILO_BASE = `
/* Base do Editor MiniChef: prancheta de posição livre que empilha em coluna no celular. */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: #f3f3f3; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.mc-prancheta { position: relative; width: ${LARGURA_PRANCHETA}px; margin: 0 auto; background: #ffffff; overflow: hidden; }
.mc-prancheta > [data-mc] { position: absolute; margin: 0; overflow-wrap: anywhere; }
@media (max-width: 768px) {
  .mc-prancheta { width: 100%; height: auto !important; min-height: 100vh; display: flex; flex-direction: column; gap: 12px; padding: 16px; }
  .mc-prancheta > [data-mc] { position: static !important; width: auto !important; max-width: 100%; height: auto !important; min-height: var(--mc-a, 0); }
  .mc-prancheta > img[data-mc] { width: 100% !important; min-height: 0; }
}
`;

// ---------------------------------------------------------------- eventos

const ouvintes = new Map();

export function on(nome, fn) {
  if (!ouvintes.has(nome)) ouvintes.set(nome, new Set());
  ouvintes.get(nome).add(fn);
  return () => ouvintes.get(nome).delete(fn);
}

export function emit(nome, dados = {}) {
  for (const fn of ouvintes.get(nome) ?? []) {
    try {
      fn(dados);
    } catch (erro) {
      console.error(`[nucleo] ouvinte de "${nome}" falhou`, erro);
    }
  }
}

export function avisar(tipo, texto) {
  emit('aviso', { tipo, texto });
}

// ---------------------------------------------------------------- estado

export const estado = {
  caminho: null, // página aberta, relativa a minichef--frontend
  doc: null, // Document do iframe
  iframe: null,
  selecao: [], // Elements do doc
  sujo: false,
  zoom: 1,
  modoCelular: false,
};

// Funções que um módulo registra para outro usar (ver CONTRATO.md).
export const servicos = {};

export function iniciar(iframe) {
  estado.iframe = iframe;
}

function definirSujo(valor) {
  if (estado.sujo === valor) return;
  estado.sujo = valor;
  emit('sujo:mudou', { sujo: valor });
}

// ---------------------------------------------------------------- API do executor

const token = document.querySelector('meta[name="editor-token"]')?.content ?? '';

async function pedir(metodo, rota, { json, corpo, cabecalhos = {} } = {}) {
  const opcoes = { method: metodo, headers: { 'X-Editor-Token': token, ...cabecalhos } };
  if (json !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(json);
  } else if (corpo !== undefined) {
    opcoes.body = corpo;
  }
  let resposta;
  try {
    resposta = await fetch(rota, opcoes);
  } catch {
    throw new Error('Sem conexão com o executor. Ele ainda está rodando?');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(dados.erro || `Erro ${resposta.status} do executor.`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

const EXTENSAO_POR_TIPO = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

function nomeDaImagem(arquivo) {
  const nome = arquivo.name || 'imagem';
  if (/\.[a-z0-9]+$/i.test(nome)) return nome;
  return `${nome}.${EXTENSAO_POR_TIPO[arquivo.type] ?? 'png'}`;
}

export const api = {
  info: () => pedir('GET', '/api/info'),
  listarPaginas: () => pedir('GET', '/api/paginas'),
  lerPagina: (caminho) => pedir('GET', `/api/pagina?caminho=${encodeURIComponent(caminho)}`),
  salvarPagina: (caminho, html, { criar = false } = {}) =>
    pedir('PUT', '/api/pagina', { json: { caminho, html, criar } }),
  enviarImagem: (arquivo) =>
    pedir('POST', '/api/imagens', {
      corpo: arquivo,
      cabecalhos: {
        'X-Nome-Arquivo': encodeURIComponent(nomeDaImagem(arquivo)),
        'Content-Type': arquivo.type || 'application/octet-stream',
      },
    }),
  site: () => pedir('GET', '/api/site'),
  iniciarSite: (porta) => pedir('POST', '/api/site/iniciar', { json: { porta } }),
  pararSite: () => pedir('POST', '/api/site/parar'),
  portas: () => pedir('GET', '/api/portas'),
  verificarPorta: (porta) => pedir('GET', `/api/portas/verificar?porta=${encodeURIComponent(porta)}`),
};

// ---------------------------------------------------------------- documento

export function prancheta(doc = estado.doc) {
  return doc?.querySelector('[data-mc-prancheta]') ?? null;
}

// Cria a prancheta (e o CSS base) numa página que ainda não tem — por exemplo, HTML escrito à mão.
export function garantirPrancheta() {
  const doc = estado.doc;
  const existente = prancheta(doc);
  if (existente) return existente;
  if (!doc.head.querySelector('style[data-mc-base]')) {
    const estilo = doc.createElement('style');
    estilo.setAttribute('data-mc-base', '');
    estilo.textContent = ESTILO_BASE;
    doc.head.append(estilo);
  }
  const nova = doc.createElement('main');
  nova.className = 'mc-prancheta';
  nova.setAttribute('data-mc-prancheta', '');
  nova.style.height = '900px';
  doc.body.append(nova);
  return nova;
}

export function tipoDe(el) {
  return el?.getAttribute?.('data-mc') ?? null;
}

// Livre = criado pelo editor e filho direto da prancheta (posição absoluta).
export function eLivre(el) {
  return !!el?.hasAttribute?.('data-mc') && el.parentElement === prancheta(el.ownerDocument);
}

export function novoId(doc = estado.doc) {
  let id;
  do {
    id = `mc-${Math.random().toString(36).slice(2, 8)}`;
  } while (doc?.querySelector(`[data-mc-id="${id}"]`));
  return id;
}

// Dá id a todo [data-mc] sem id e troca ids repetidos (ex.: depois de colar).
export function garantirIds(raiz = estado.doc) {
  const vistos = new Set();
  for (const el of raiz.querySelectorAll('[data-mc]')) {
    let id = el.getAttribute('data-mc-id');
    if (!id || vistos.has(id)) {
      id = novoId();
      el.setAttribute('data-mc-id', id);
    }
    vistos.add(id);
  }
}

export function elementoPorId(id, doc = estado.doc) {
  return id ? doc?.querySelector(`[data-mc-id="${CSS.escape(id)}"]`) ?? null : null;
}

const lerPx = (valor) => {
  const n = parseFloat(valor);
  return Number.isFinite(n) ? n : null;
};

// Livre: x/y relativos à prancheta. De fluxo: x/y são o deslocamento de position:relative.
export function geometria(el) {
  const s = el.style;
  if (eLivre(el)) {
    return {
      x: lerPx(s.left) ?? el.offsetLeft,
      y: lerPx(s.top) ?? el.offsetTop,
      w: lerPx(s.width) ?? el.offsetWidth,
      h: lerPx(s.height) ?? el.offsetHeight,
    };
  }
  return { x: lerPx(s.left) ?? 0, y: lerPx(s.top) ?? 0, w: el.offsetWidth, h: el.offsetHeight };
}

// Só altera as chaves informadas. Não emite eventos: chame alterado() ao concluir a ação.
export function definirGeometria(el, { x, y, w, h } = {}) {
  const s = el.style;
  const px = (n) => `${Math.round(n)}px`;
  if (!eLivre(el) && (x !== undefined || y !== undefined)) {
    if (el.ownerDocument.defaultView.getComputedStyle(el).position === 'static') s.position = 'relative';
  }
  if (x !== undefined) s.left = px(x);
  if (y !== undefined) s.top = px(y);
  if (w !== undefined) s.width = px(Math.max(1, w));
  if (h !== undefined) {
    s.height = px(Math.max(1, h));
    if (el.hasAttribute('data-mc')) s.setProperty('--mc-a', px(Math.max(1, h)));
  }
}

// Cresce a prancheta quando algum elemento livre passa do fundo (nunca encolhe sozinha).
export function ajustarAlturaPrancheta() {
  const p = prancheta();
  if (!p) return;
  let fundo = 0;
  for (const el of p.children) {
    if (!el.hasAttribute('data-mc')) continue;
    const g = geometria(el);
    fundo = Math.max(fundo, g.y + g.h);
  }
  const atual = lerPx(p.style.height) ?? p.offsetHeight;
  if (fundo + 40 > atual) p.style.height = `${Math.ceil(fundo + 40)}px`;
}

// Cria (sem inserir) um elemento do editor. Geometria em coordenadas da prancheta.
export function criarElemento(tipo, { x = 40, y = 40, w, h, texto, src, alt = '' } = {}) {
  const doc = estado.doc;
  let el;
  if (tipo === TIPOS.IMAGEM) {
    el = doc.createElement('img');
    el.setAttribute('src', src);
    el.setAttribute('alt', alt);
    el.style.objectFit = 'cover';
    w ??= 240;
    h ??= 160;
  } else if (tipo === TIPOS.TEXTO) {
    el = doc.createElement('div');
    el.textContent = texto ?? 'Digite seu texto';
    el.style.fontSize = '24px';
    el.style.color = '#1f1f1f';
    w ??= 320; // altura automática: o texto cresce conforme o conteúdo
  } else if (tipo === TIPOS.CAIXA) {
    el = doc.createElement('div');
    if (texto) el.textContent = texto;
    el.style.backgroundColor = '#ffb347';
    el.style.borderRadius = '8px';
    w ??= 200;
    h ??= 120;
  } else {
    throw new Error(`Tipo de elemento desconhecido: ${tipo}`);
  }
  el.setAttribute('data-mc', tipo);
  el.setAttribute('data-mc-id', novoId());
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.width = `${Math.round(w)}px`;
  if (h !== undefined) {
    el.style.height = `${Math.round(h)}px`;
    el.style.setProperty('--mc-a', `${Math.round(h)}px`);
  }
  return el;
}

// Insere na prancheta (criando-a se preciso), seleciona e registra no histórico.
export function inserir(elementos, { selecionarInseridos = true, origem = 'inserir' } = {}) {
  const lista = [elementos].flat();
  const p = garantirPrancheta();
  for (const el of lista) p.append(el);
  garantirIds(p);
  if (selecionarInseridos) selecionar(lista);
  alterado(origem);
  return lista;
}

export function remover(elementos) {
  const lista = [elementos].flat().filter((el) => el?.isConnected);
  if (!lista.length) return;
  for (const el of lista) el.remove();
  selecionar(estado.selecao.filter((el) => el.isConnected));
  alterado('remover');
}

// props em nomes CSS (kebab-case): { 'background-color': '#fff', 'box-shadow': null }. null/'' remove.
// Use agrupar em controles contínuos (sliders) para virar um único passo no histórico.
export function aplicarEstilo(elementos, props, { agrupar = null, origem = 'estilo' } = {}) {
  const lista = [elementos].flat().filter(Boolean);
  if (!lista.length) return;
  for (const el of lista) {
    for (const [prop, valor] of Object.entries(props)) {
      if (valor === null || valor === undefined || valor === '') el.style.removeProperty(prop);
      else el.style.setProperty(prop, String(valor));
    }
  }
  alterado(origem, { agrupar });
}

// Toda alteração no DOM termina aqui: cresce a prancheta, registra histórico, marca sujo e avisa.
export function alterado(origem = 'edicao', { historico: registrar = true, agrupar = null } = {}) {
  if (!estado.doc) return;
  ajustarAlturaPrancheta();
  if (registrar) historico.registrar(agrupar);
  definirSujo(true);
  emit('documento:mudou', { origem });
}

// ---------------------------------------------------------------- seleção

export function selecionar(elementos) {
  const lista = [...new Set([elementos].flat().filter((el) => el?.isConnected))];
  const igual = lista.length === estado.selecao.length && lista.every((el, i) => el === estado.selecao[i]);
  estado.selecao = lista;
  if (!igual) emit('selecao:mudou', { elementos: lista });
}

export function limparSelecao() {
  selecionar([]);
}

// ---------------------------------------------------------------- histórico (fotos do body)

const LIMITE_HISTORICO = 100;
const pilha = [];
let indice = -1;
let indiceSalvo = -1;
let ultimoGrupo = null;
let ultimoTempo = 0;

function limparArtefatos(raiz) {
  raiz.querySelectorAll('[data-mc-artefato]').forEach((n) => n.remove());
  raiz.querySelectorAll('[data-mc-editando]').forEach((n) => {
    n.removeAttribute('data-mc-editando');
    n.removeAttribute('contenteditable');
    n.removeAttribute('spellcheck');
  });
}

function foto() {
  const body = estado.doc.body.cloneNode(true);
  limparArtefatos(body);
  return { html: body.innerHTML, estilo: estado.doc.body.getAttribute('style') };
}

function restaurar(f) {
  const doc = estado.doc;
  const ids = estado.selecao.map((el) => el.getAttribute('data-mc-id')).filter(Boolean);
  doc.body.innerHTML = f.html;
  if (f.estilo === null) doc.body.removeAttribute('style');
  else doc.body.setAttribute('style', f.estilo);
  ultimoGrupo = null;
  selecionar(ids.map((id) => elementoPorId(id)).filter(Boolean));
  definirSujo(indice !== indiceSalvo);
  emit('documento:mudou', { origem: 'historico' });
  emitirHistorico();
}

function emitirHistorico() {
  emit('historico:mudou', { podeDesfazer: historico.podeDesfazer, podeRefazer: historico.podeRefazer });
}

export const historico = {
  registrar(agrupar = null) {
    if (!estado.doc) return;
    const agora = Date.now();
    const f = foto();
    if (agrupar && agrupar === ultimoGrupo && agora - ultimoTempo < 1000 && indice > 0 && indice === pilha.length - 1) {
      pilha[indice] = f; // mesmo controle contínuo: atualiza o passo em vez de empilhar
      if (indiceSalvo === indice) indiceSalvo = -1;
    } else {
      pilha.splice(indice + 1);
      pilha.push(f);
      if (pilha.length > LIMITE_HISTORICO) {
        pilha.shift();
        indiceSalvo -= 1;
      }
      indice = pilha.length - 1;
    }
    ultimoGrupo = agrupar;
    ultimoTempo = agora;
    emitirHistorico();
  },
  desfazer() {
    if (!this.podeDesfazer) return false;
    servicos.finalizarEdicao?.();
    indice -= 1;
    restaurar(pilha[indice]);
    return true;
  },
  refazer() {
    if (!this.podeRefazer) return false;
    servicos.finalizarEdicao?.();
    indice += 1;
    restaurar(pilha[indice]);
    return true;
  },
  limpar() {
    pilha.length = 0;
    indice = -1;
    indiceSalvo = -1;
    ultimoGrupo = null;
    emitirHistorico();
  },
  get podeDesfazer() {
    return indice > 0;
  },
  get podeRefazer() {
    return indice < pilha.length - 1;
  },
};

// ---------------------------------------------------------------- abrir / salvar

export async function abrirPagina(caminho) {
  servicos.finalizarEdicao?.();
  await api.lerPagina(caminho); // valida existência e mostra o erro do executor, se houver
  const iframe = estado.iframe;
  const doc = await new Promise((resolve, reject) => {
    const aoCarregar = () => {
      iframe.removeEventListener('load', aoCarregar);
      const carregado = iframe.contentDocument;
      if (carregado?.body) resolve(carregado);
      else reject(new Error('Não foi possível carregar a página no editor.'));
    };
    iframe.addEventListener('load', aoCarregar);
    iframe.src = `/site/${caminho.split('/').map(encodeURIComponent).join('/')}`;
  });
  estado.doc = doc;
  estado.caminho = caminho;
  garantirIds(doc);
  estado.selecao = [];
  emit('selecao:mudou', { elementos: [] });
  historico.limpar();
  historico.registrar();
  indiceSalvo = indice;
  definirSujo(false);
  emit('pagina:carregada', { caminho, doc });
  return doc;
}

// Ordena os filhos livres por (top, left) para a coluna do celular e quebra linha entre eles.
function prepararPrancheta(raiz) {
  const p = raiz.querySelector('[data-mc-prancheta]');
  if (!p) return;
  const livres = [...p.children].filter((el) => el.hasAttribute('data-mc'));
  const posicao = (el) => [lerPx(el.style.top) ?? 0, lerPx(el.style.left) ?? 0];
  [...livres]
    .sort((a, b) => {
      const [ta, la] = posicao(a);
      const [tb, lb] = posicao(b);
      return ta - tb || la - lb;
    })
    .forEach((el, i) => el.style.setProperty('order', String(i)));
  for (const no of [...p.childNodes]) {
    if (no.nodeType === Node.TEXT_NODE && !no.textContent.trim()) no.remove();
  }
  for (const el of [...p.children]) p.insertBefore(raiz.ownerDocument.createTextNode('\n  '), el);
  if (p.children.length) p.append(raiz.ownerDocument.createTextNode('\n'));
}

// HTML final do arquivo, sem nenhum artefato do editor.
export function serializar() {
  const doc = estado.doc;
  const raiz = doc.documentElement.cloneNode(true);
  limparArtefatos(raiz);
  prepararPrancheta(raiz);
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : '<!DOCTYPE html>';
  return `${doctype}\n${raiz.outerHTML}\n`;
}

export async function salvar() {
  if (!estado.doc || !estado.caminho) return false;
  servicos.finalizarEdicao?.();
  try {
    await api.salvarPagina(estado.caminho, serializar());
  } catch (erro) {
    avisar('erro', `Não foi possível salvar: ${erro.message}`);
    return false;
  }
  indiceSalvo = indice;
  definirSujo(false);
  emit('pagina:salva', { caminho: estado.caminho });
  avisar('sucesso', `${estado.caminho} salvo.`);
  return true;
}

const escaparHtml = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function modeloPaginaNova(titulo = 'MiniChef') {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(titulo)}</title>
<style data-mc-base>${ESTILO_BASE}</style>
</head>
<body>
<main class="mc-prancheta" data-mc-prancheta style="height: 900px">
</main>
</body>
</html>
`;
}
