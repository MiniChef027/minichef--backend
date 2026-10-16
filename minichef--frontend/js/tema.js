// Tema claro/escuro. Roda no <head> (sem defer) para aplicar a escolha antes de pintar a página.
// A escolha fica só neste navegador (localStorage); sem ela, vale o tema do sistema.
(() => {
  const raiz = document.documentElement;
  const escuroDoSistema = matchMedia("(prefers-color-scheme: dark)");

  function guardado() {
    try { const v = localStorage.getItem("minichef-tema"); return v === "dark" || v === "light" ? v : null; }
    catch { return null; }
  }
  function aplicar() {
    const escolhido = guardado();
    if (escolhido) raiz.dataset.theme = escolhido; else delete raiz.dataset.theme;
    raiz.dataset.temaAtivo = escolhido || (escuroDoSistema.matches ? "dark" : "light");
  }

  aplicar();
  escuroDoSistema.addEventListener("change", aplicar);

  document.addEventListener("DOMContentLoaded", () => {
    const botao = document.getElementById("tema");
    botao.addEventListener("click", () => {
      const novo = raiz.dataset.temaAtivo === "dark" ? "light" : "dark";
      try { localStorage.setItem("minichef-tema", novo); } catch { /* sem armazenamento: vale só nesta visita */ }
      raiz.dataset.theme = novo;
      raiz.dataset.temaAtivo = novo;
    });
  });
})();
