// Ferramentas do Editor MiniChef: inserir caixa/texto/imagem, painel de páginas e painel "Rodar site".
// Inserções passam por nucleo.criarElemento + nucleo.inserir (o inserido fica selecionado).
import * as nucleo from './nucleo.js';

const { estado, servicos, api, TIPOS, LARGURA_PRANCHETA } = nucleo;

const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const LIMITE_IMAGEM = 10 * 1024 * 1024;
const LARGURA_MAX_IMAGEM = 480;
const PONTO_SEM_CANVAS = { x: 80, y: 80 }; // canto superior esquerdo, se o canvas não informar o centro
const CHAVE_PORTA = 'mc:porta-site';

// ---------------------------------------------------------------- utilidades

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

const avisar = (tipo, texto) => nucleo.avisar(tipo, texto);
const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const caminhoUrl = (caminho) => caminho.split('/').map(encodeURIComponent).join('/');

function svg(conteudo) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '1.8');
  el.innerHTML = conteudo; // conteúdo fixo deste arquivo, nunca entrada do usuário
  return el;
}

// Diálogo modal nativo (<dialog>): Esc cancela, o foco volta para onde estava.
// opcoes: [{ valor, texto, primario?, perigo? }] — a primeira é o botão padrão do Enter.
// campo: { rotulo, valor?, validar(texto) → { ok, mensagem } } — devolve o texto digitado.
function dialogo({ titulo, texto, opcoes, campo }) {
  return new Promise((resolve) => {
    const focoAnterior = document.activeElement;
    const dlg = h('dialog', { class: 'mc-dialogo', 'aria-labelledby': 'mc-dlg-titulo', 'aria-describedby': texto ? 'mc-dlg-texto' : null });
    let entrada = null;
    let dica = null;
    if (campo) {
      entrada = h('input', { type: 'text', class: 'mc-campo', id: 'mc-dlg-campo', autocomplete: 'off', autofocus: true, 'aria-describedby': 'mc-dlg-dica' });
      entrada.value = campo.valor ?? '';
      dica = h('p', { class: 'mc-status mc-dlg-dica', id: 'mc-dlg-dica', 'aria-live': 'polite' });
      const mostrar = () => {
        const r = campo.validar(entrada.value);
        dica.textContent = r.mensagem;
        dica.classList.toggle('mc-status--erro', !r.ok && entrada.value.trim() !== '');
      };
      entrada.addEventListener('input', mostrar);
      mostrar();
    }
    const form = h('form', { method: 'dialog' },
      h('h2', { id: 'mc-dlg-titulo' }, titulo),
      texto ? h('p', { id: 'mc-dlg-texto' }, texto) : null,
      campo ? h('div', { class: 'mc-dlg-campo' }, h('label', { for: 'mc-dlg-campo' }, campo.rotulo), entrada, dica) : null,
      h('div', { class: 'mc-dlg-acoes' }, opcoes.map((o, i) => h('button', {
        value: o.valor,
        class: `mc-botao${o.primario ? ' mc-botao--primario' : ''}${o.perigo ? ' mc-botao--perigo' : ''}`,
        autofocus: !campo && i === 0,
      }, o.texto))));
    form.addEventListener('submit', (evento) => {
      if (!campo || evento.submitter?.value === 'cancelar') return;
      const r = campo.validar(entrada.value);
      if (!r.ok) {
        evento.preventDefault();
        dica.textContent = r.mensagem;
        dica.classList.add('mc-status--erro');
        entrada.focus();
      }
    });
    dlg.addEventListener('close', () => {
      const valor = dlg.returnValue;
      dlg.remove();
      if (focoAnterior?.isConnected) focoAnterior.focus();
      if (!valor || valor === 'cancelar') resolve(null);
      else resolve(campo ? entrada.value.trim() : valor);
    });
    dlg.append(form);
    document.body.append(dlg);
    dlg.showModal();
  });
}

// true = pode seguir (salvou ou descartou). acao completa os rótulos: "Salvar e abrir".
async function resolverNaoSalvo(acao) {
  if (!estado.sujo) return true;
  const escolha = await dialogo({
    titulo: 'Alterações não salvas',
    texto: `${estado.caminho ?? 'A página'} tem alterações que ainda não foram salvas.`,
    opcoes: [
      { valor: 'salvar', texto: `Salvar e ${acao}`, primario: true },
      { valor: 'descartar', texto: 'Descartar alterações', perigo: true },
      { valor: 'cancelar', texto: 'Cancelar' },
    ],
  });
  if (escolha === 'salvar') return nucleo.salvar();
  return escolha === 'descartar';
}

// ---------------------------------------------------------------- inserir

function pontoCentral() {
  try {
    return servicos.centroVisivel?.() ?? null;
  } catch (erro) {
    console.warn('[ferramentas] centroVisivel falhou', erro);
    return null;
  }
}

// Centraliza no ponto (do canvas ou informado); sem ponto, usa o canto fixo.
function posicaoPara(largura, altura, ponto = pontoCentral()) {
  const canto = ponto ? { x: ponto.x - largura / 2, y: ponto.y - altura / 2 } : PONTO_SEM_CANVAS;
  return {
    x: Math.round(limitar(canto.x, 0, Math.max(0, LARGURA_PRANCHETA - largura))),
    y: Math.round(Math.max(0, canto.y)),
  };
}

function exigirPagina() {
  if (estado.doc) return true;
  avisar('erro', 'Abra ou crie uma página antes de inserir elementos.');
  return false;
}

function inserirCaixa() {
  if (!exigirPagina()) return;
  const el = nucleo.criarElemento(TIPOS.CAIXA, posicaoPara(200, 120));
  nucleo.inserir(el);
}

function inserirTexto() {
  if (!exigirPagina()) return;
  const el = nucleo.criarElemento(TIPOS.TEXTO, posicaoPara(320, 40));
  nucleo.inserir(el);
  servicos.editarTexto?.(el);
}

function medirArquivo(arquivo) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    const fim = (medida) => {
      URL.revokeObjectURL(url);
      resolve(medida);
    };
    img.onload = () => fim({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => fim({ w: 0, h: 0 });
    img.src = url;
  });
}

function srcRelativo(caminhoImagem) {
  const profundidade = (estado.caminho ?? '').split('/').length - 1;
  return '../'.repeat(Math.max(0, profundidade)) + caminhoImagem;
}

// Serviço do contrato: envia a imagem ao executor e insere com a proporção natural (até 480px de largura).
async function inserirImagemArquivo(arquivo, ponto) {
  if (!exigirPagina()) return null;
  if (!arquivo) return null;
  if (arquivo.type && !TIPOS_IMAGEM.includes(arquivo.type)) {
    avisar('erro', 'Formato não suportado. Use PNG, JPG, GIF, WEBP ou SVG.');
    return null;
  }
  if (arquivo.size > LIMITE_IMAGEM) {
    avisar('erro', 'A imagem passa de 10 MB.');
    return null;
  }
  const docAntes = estado.doc;
  let caminho;
  let medida;
  try {
    [{ caminho }, medida] = await Promise.all([api.enviarImagem(arquivo), medirArquivo(arquivo)]);
  } catch (erro) {
    avisar('erro', `Não foi possível enviar a imagem: ${erro.message}`);
    return null;
  }
  if (estado.doc !== docAntes) {
    avisar('info', `A página mudou durante o envio. A imagem ficou salva em ${caminho}, mas não foi inserida.`);
    return null;
  }
  let { w, h: altura } = medida;
  if (!w || !altura) [w, altura] = [240, 160]; // SVG sem tamanho próprio
  if (w > LARGURA_MAX_IMAGEM) [w, altura] = [LARGURA_MAX_IMAGEM, (altura * LARGURA_MAX_IMAGEM) / w];
  const el = nucleo.criarElemento(TIPOS.IMAGEM, { ...posicaoPara(w, altura, ponto), w, h: altura, src: srcRelativo(caminho), alt: '' });
  nucleo.inserir(el);
  return el;
}

function iniciarBarra() {
  const barra = document.getElementById('mc-ferramentas');
  const arquivo = h('input', { type: 'file', accept: TIPOS_IMAGEM.join(','), hidden: true, id: 'mc-ferr-arquivo', tabindex: '-1' });
  arquivo.addEventListener('change', () => {
    const [escolhido] = arquivo.files;
    arquivo.value = '';
    if (escolhido) inserirImagemArquivo(escolhido);
  });
  const ferramenta = (id, rotulo, dica, icone, acao) => h('button', {
    type: 'button', class: 'mc-botao mc-ferramenta', id, title: dica, disabled: true, onclick: acao,
  }, svg(icone), h('span', {}, rotulo));
  const botoes = [
    ferramenta('mc-ferr-caixa', 'Caixa', 'Inserir caixa', '<rect x="4" y="5" width="16" height="14" rx="2"/>', inserirCaixa),
    ferramenta('mc-ferr-texto', 'Texto', 'Inserir texto', '<path d="M5 6h14M12 6v13M9 19h6"/>', inserirTexto),
    ferramenta('mc-ferr-imagem', 'Imagem', 'Inserir imagem do computador', '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>', () => arquivo.click()),
  ];
  barra.replaceChildren(...botoes, arquivo);
  nucleo.on('pagina:carregada', () => {
    for (const b of botoes) {
      b.disabled = false;
      b.removeAttribute('aria-disabled');
    }
  });
}

// ---------------------------------------------------------------- páginas

function slug(nome) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\.html?$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function iniciarPaginas() {
  const raiz = document.getElementById('mc-paginas');
  let paginas = [];
  let carregando = false;

  const lista = h('select', { class: 'mc-campo mc-pag-lista', id: 'mc-pag-lista' });
  const vazio = h('span', { class: 'mc-status' }, 'Nenhuma página ainda.');
  const criarIndex = h('button', { type: 'button', class: 'mc-botao mc-botao--primario', id: 'mc-pag-criar-index' }, 'Criar index.html');
  const nova = h('button', { type: 'button', class: 'mc-botao', id: 'mc-pag-nova' }, 'Nova página');
  const salvar = h('button', {
    type: 'button', class: 'mc-botao', id: 'mc-pag-salvar', title: 'Salvar (Ctrl+S)', 'aria-keyshortcuts': 'Control+S', disabled: true,
  }, 'Salvar');
  const indicador = h('span', { class: 'mc-status mc-pag-estado', id: 'mc-pag-estado', 'aria-live': 'polite' });

  raiz.replaceChildren(
    h('label', { for: 'mc-pag-lista', class: 'mc-sr' }, 'Página aberta'),
    lista, vazio, criarIndex, nova, salvar, indicador);

  function renderizar() {
    const semPaginas = paginas.length === 0;
    lista.hidden = semPaginas;
    vazio.hidden = !semPaginas;
    criarIndex.hidden = !semPaginas;
    lista.replaceChildren(...paginas.map((p) => h('option', { value: p }, p)));
    if (estado.caminho && !paginas.includes(estado.caminho)) lista.prepend(h('option', { value: estado.caminho }, estado.caminho));
    if (!estado.caminho && !semPaginas) lista.prepend(h('option', { value: '', disabled: true }, 'Escolha uma página…'));
    lista.value = estado.caminho ?? '';
    lista.disabled = carregando;
    salvar.disabled = !estado.doc || carregando;
    renderizarEstado();
  }

  function renderizarEstado() {
    const sujo = !!estado.doc && estado.sujo;
    indicador.textContent = !estado.doc ? '' : sujo ? '● Não salvo' : 'Salvo';
    indicador.classList.toggle('mc-pag-estado--sujo', sujo);
    salvar.classList.toggle('mc-botao--primario', sujo);
  }

  async function carregarLista() {
    try {
      ({ paginas } = await api.listarPaginas());
    } catch (erro) {
      avisar('erro', erro.message);
    }
    renderizar();
  }

  async function abrir(caminho) {
    if (!caminho || caminho === estado.caminho) return renderizar();
    if (!(await resolverNaoSalvo('abrir'))) return renderizar();
    carregando = true;
    renderizar();
    try {
      await nucleo.abrirPagina(caminho);
    } catch (erro) {
      avisar('erro', erro.message);
    } finally {
      carregando = false;
      renderizar();
    }
  }

  async function criar(caminho, titulo) {
    try {
      await api.salvarPagina(caminho, nucleo.modeloPaginaNova(titulo), { criar: true });
    } catch (erro) {
      avisar('erro', erro.status === 409 ? `Já existe uma página ${caminho}.` : erro.message);
      return;
    }
    avisar('sucesso', `${caminho} criada.`);
    await carregarLista();
    await abrir(caminho);
  }

  async function novaPagina() {
    const nome = await dialogo({
      titulo: 'Nova página',
      campo: {
        rotulo: 'Nome da página',
        validar(texto) {
          const base = slug(texto);
          if (!base) return { ok: false, mensagem: 'Use letras ou números no nome.' };
          const arquivo = `${base}.html`;
          if (paginas.includes(arquivo)) return { ok: false, mensagem: `Já existe ${arquivo}.` };
          return { ok: true, mensagem: `Arquivo: ${arquivo}` };
        },
      },
      opcoes: [{ valor: 'criar', texto: 'Criar página', primario: true }, { valor: 'cancelar', texto: 'Cancelar' }],
    });
    if (nome) await criar(`${slug(nome)}.html`, nome);
  }

  lista.addEventListener('change', () => abrir(lista.value));
  criarIndex.addEventListener('click', () => criar('index.html', 'MiniChef'));
  nova.addEventListener('click', novaPagina);
  salvar.addEventListener('click', () => nucleo.salvar());
  nucleo.on('pagina:carregada', renderizar);
  nucleo.on('sujo:mudou', renderizarEstado);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') carregarLista();
  });
  carregarLista();
}

// ---------------------------------------------------------------- rodar site

function lembrarPorta(porta) {
  try {
    localStorage.setItem(CHAVE_PORTA, String(porta));
  } catch {
    // armazenamento indisponível: só perde a conveniência
  }
}

function portaLembrada() {
  try {
    return Number(localStorage.getItem(CHAVE_PORTA)) || null;
  } catch {
    return null;
  }
}

const portaValida = (n) => Number.isInteger(n) && n >= 1024 && n <= 65535;

function iniciarSite() {
  const raiz = document.getElementById('mc-site');
  let site = { rodando: false, porta: null, url: null };
  let sugestoes = [];
  let portaEditor = null;
  let ocupado = false;
  let erro = '';
  let escolhaInicial = portaLembrada();
  let pedidoVerificacao = 0;
  let temporizador = 0;
  let ultimaBuscaSugestoes = 0;

  const seletor = h('select', { class: 'mc-campo mc-site-porta', id: 'mc-site-porta' });
  const outra = h('input', {
    type: 'number', class: 'mc-campo mc-site-outra', id: 'mc-site-outra', min: 1024, max: 65535, step: 1,
    inputmode: 'numeric', placeholder: '1024–65535', hidden: true, 'aria-describedby': 'mc-site-outra-dica',
  });
  const rotuloOutra = h('label', { for: 'mc-site-outra', class: 'mc-sr' }, 'Porta personalizada');
  const dicaOutra = h('span', { class: 'mc-status', id: 'mc-site-outra-dica', 'aria-live': 'polite', hidden: true });
  const rodar = h('button', { type: 'button', class: 'mc-botao mc-botao--primario', id: 'mc-site-rodar' }, 'Rodar site');
  const parar = h('button', { type: 'button', class: 'mc-botao', id: 'mc-site-parar', disabled: true }, 'Parar');
  const status = h('span', { class: 'mc-status mc-site-status', id: 'mc-site-status', role: 'status' });
  const abrirSite = h('a', { class: 'mc-botao', id: 'mc-site-abrir', target: '_blank', rel: 'noopener', hidden: true }, 'Abrir site');

  raiz.replaceChildren(
    h('label', { for: 'mc-site-porta', class: 'mc-site-rotulo' }, 'Porta'),
    seletor, rotuloOutra, outra, dicaOutra, rodar, parar, status, abrirSite);

  const usandoOutra = () => seletor.value === 'outra';
  const portaEscolhida = () => (usandoOutra() ? outra.valueAsNumber : Number(seletor.value));

  function rotuloSugestao({ porta, livre }) {
    if (site.rodando && porta === site.porta) return `${porta} · este site`;
    return `${porta} · ${livre ? 'livre' : 'ocupada'}`;
  }

  function renderizarSeletor() {
    const valorAtual = seletor.value;
    seletor.replaceChildren(
      ...sugestoes.map((s) => h('option', { value: s.porta }, rotuloSugestao(s))),
      h('option', { value: 'outra' }, 'Outra porta…'));
    let alvo = valorAtual;
    if (escolhaInicial !== null) {
      alvo = sugestoes.some((s) => s.porta === escolhaInicial) ? String(escolhaInicial) : 'outra';
      if (alvo === 'outra') outra.value = String(escolhaInicial);
      escolhaInicial = null;
    }
    if (![...seletor.options].some((o) => o.value === alvo)) alvo = seletor.options[0]?.value ?? 'outra';
    seletor.value = alvo;
    outra.hidden = !usandoOutra();
    dicaOutra.hidden = !usandoOutra();
  }

  function urlParaAbrir() {
    try {
      const base = new URL(site.url);
      if (base.protocol !== 'http:') return null;
      const pagina = estado.caminho && estado.caminho !== 'index.html' ? caminhoUrl(estado.caminho) : '';
      return new URL(pagina, base).href;
    } catch {
      return null;
    }
  }

  function renderizar() {
    rodar.disabled = ocupado;
    parar.disabled = ocupado || !site.rodando;
    seletor.disabled = ocupado;
    outra.disabled = ocupado;
    status.classList.toggle('mc-status--ok', site.rodando && !erro);
    status.classList.toggle('mc-status--erro', !!erro);
    status.textContent = erro || (ocupado ? 'Aguarde…' : site.rodando ? `Rodando na porta ${site.porta}` : 'Site parado');
    status.title = status.textContent;
    const url = site.rodando ? urlParaAbrir() : null;
    abrirSite.hidden = !url;
    if (url) {
      abrirSite.href = url;
      abrirSite.title = `Abrir ${url} em nova aba`;
    } else {
      abrirSite.removeAttribute('href');
    }
  }

  async function buscarSugestoes() {
    ultimaBuscaSugestoes = Date.now();
    try {
      ({ sugestoes } = await api.portas());
    } catch (e) {
      sugestoes = [];
      erro = e.message;
    }
    renderizarSeletor();
    renderizar();
  }

  async function buscarEstado() {
    try {
      site = await api.site();
    } catch (e) {
      erro = e.message;
    }
    renderizar();
  }

  function verificarOutra() {
    clearTimeout(temporizador);
    const pedido = ++pedidoVerificacao;
    dicaOutra.classList.remove('mc-status--ok', 'mc-status--erro');
    const n = outra.valueAsNumber;
    if (outra.value === '') {
      dicaOutra.textContent = '';
      return;
    }
    if (!portaValida(n)) {
      dicaOutra.textContent = 'Use 1024 a 65535';
      dicaOutra.classList.add('mc-status--erro');
      return;
    }
    if (n === portaEditor) {
      dicaOutra.textContent = 'É a porta do editor';
      dicaOutra.classList.add('mc-status--erro');
      return;
    }
    if (site.rodando && n === site.porta) {
      dicaOutra.textContent = 'este site';
      return;
    }
    dicaOutra.textContent = 'verificando…';
    temporizador = setTimeout(async () => {
      try {
        const { livre } = await api.verificarPorta(n);
        if (pedido !== pedidoVerificacao) return;
        dicaOutra.textContent = livre ? 'livre' : 'ocupada';
        dicaOutra.classList.add(livre ? 'mc-status--ok' : 'mc-status--erro');
      } catch (e) {
        if (pedido === pedidoVerificacao) dicaOutra.textContent = e.message;
      }
    }, 350);
  }

  async function iniciar() {
    const porta = portaEscolhida();
    if (!portaValida(porta) || porta === portaEditor) {
      erro = porta === portaEditor ? 'Essa é a porta do editor. Escolha outra.' : 'Escolha uma porta entre 1024 e 65535.';
      renderizar();
      (usandoOutra() ? outra : seletor).focus();
      return;
    }
    if (estado.sujo) {
      const escolha = await dialogo({
        titulo: 'Salvar antes de rodar?',
        texto: 'O site mostra os arquivos salvos. As alterações desta página ainda não estão no arquivo.',
        opcoes: [
          { valor: 'salvar', texto: 'Salvar e rodar', primario: true },
          { valor: 'rodar', texto: 'Rodar sem salvar' },
          { valor: 'cancelar', texto: 'Cancelar' },
        ],
      });
      if (!escolha) return;
      if (escolha === 'salvar' && !(await nucleo.salvar())) return;
    }
    ocupado = true;
    erro = '';
    renderizar();
    try {
      site = await api.iniciarSite(porta);
      lembrarPorta(porta);
      avisar('sucesso', `Site rodando em ${site.url}`);
    } catch (e) {
      erro = e.message; // 409: o executor explica qual porta está ocupada
      avisar('erro', e.message);
    } finally {
      ocupado = false;
      renderizar();
      buscarSugestoes();
    }
  }

  async function encerrar() {
    ocupado = true;
    erro = '';
    renderizar();
    try {
      site = await api.pararSite();
      avisar('info', 'Site parado.');
    } catch (e) {
      erro = e.message;
    } finally {
      ocupado = false;
      renderizar();
      buscarSugestoes();
    }
  }

  seletor.addEventListener('change', () => {
    erro = '';
    outra.hidden = !usandoOutra();
    dicaOutra.hidden = !usandoOutra();
    if (usandoOutra()) {
      outra.focus();
      verificarOutra();
    }
    renderizar();
  });
  // Disponibilidade muda com o tempo: atualiza ao focar o seletor, no máximo a cada 3 s.
  seletor.addEventListener('focus', () => {
    if (Date.now() - ultimaBuscaSugestoes > 3000) buscarSugestoes();
  });
  outra.addEventListener('input', () => {
    erro = '';
    renderizar();
    verificarOutra();
  });
  outra.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') iniciar();
  });
  rodar.addEventListener('click', iniciar);
  parar.addEventListener('click', encerrar);
  nucleo.on('pagina:carregada', renderizar);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') buscarEstado();
  });

  renderizar();
  api.info().then((info) => {
    portaEditor = info.portaEditor ?? null;
  }).catch(() => {});
  buscarEstado().then(() => {
    if (site.rodando && escolhaInicial === null) escolhaInicial = site.porta;
    if (site.rodando) escolhaInicial = site.porta;
    return buscarSugestoes();
  });
}

// ---------------------------------------------------------------- entrada

export function iniciarFerramentas() {
  servicos.inserirImagemArquivo = inserirImagemArquivo;
  iniciarBarra();
  iniciarPaginas();
  iniciarSite();
}
