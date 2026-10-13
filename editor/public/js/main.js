// Inicialização do editor: liga o núcleo, carrega os módulos e abre a página inicial.
import * as nucleo from './nucleo.js';

const { estado } = nucleo;

function iniciarAvisos() {
  const area = document.getElementById('mc-avisos');
  nucleo.on('aviso', ({ tipo = 'info', texto }) => {
    const aviso = document.createElement('div');
    aviso.className = `mc-aviso mc-aviso--${tipo}`;
    aviso.textContent = texto;
    area.append(aviso);
    setTimeout(() => aviso.remove(), tipo === 'erro' ? 6000 : 2500);
  });
}

function atualizarTitulo() {
  const pagina = estado.caminho ? ` — ${estado.caminho}` : '';
  document.title = `${estado.sujo ? '● ' : ''}Editor MiniChef${pagina}`;
}

function atualizarVazio() {
  const temPagina = !!estado.doc;
  document.getElementById('mc-vazio').hidden = temPagina;
  document.getElementById('mc-palco').hidden = !temPagina;
}

// Cada módulo carrega isolado: um erro num deles não derruba os outros.
async function carregarModulo(arquivo, funcao) {
  try {
    const modulo = await import(arquivo);
    modulo[funcao]();
  } catch (erro) {
    console.error(`[main] falha ao iniciar ${arquivo}`, erro);
    nucleo.avisar('erro', `Falha ao iniciar ${arquivo.replace('./', '')}. Veja o console.`);
  }
}

async function abrirPaginaInicial() {
  try {
    const { paginas } = await nucleo.api.listarPaginas();
    if (!paginas.length) return;
    await nucleo.abrirPagina(paginas.includes('index.html') ? 'index.html' : paginas[0]);
  } catch (erro) {
    nucleo.avisar('erro', erro.message);
  }
}

async function iniciar() {
  nucleo.iniciar(document.getElementById('mc-quadro'));
  iniciarAvisos();
  nucleo.on('sujo:mudou', atualizarTitulo);
  nucleo.on('pagina:carregada', () => {
    atualizarTitulo();
    atualizarVazio();
  });
  atualizarVazio();

  window.addEventListener('beforeunload', (evento) => {
    if (!estado.sujo) return;
    evento.preventDefault();
    evento.returnValue = '';
  });

  await carregarModulo('./canvas.js', 'iniciarCanvas');
  await carregarModulo('./inspetor.js', 'iniciarInspetor');
  await carregarModulo('./ferramentas.js', 'iniciarFerramentas');
  await abrirPaginaInicial();
}

iniciar();
