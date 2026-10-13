# Editor MiniChef — contrato de arquitetura

Documento de referência para quem mexe no editor, seja pessoa ou agente.
Mudanças de contrato passam por aqui primeiro.

## Objetivo

Editor visual em estilo canvas para as páginas de `minichef--frontend/`.
Um executor local (Node 24, **sem dependências npm em execução**) serve o editor e
**só grava dentro de `minichef--frontend/`**. `minichef--backend/` e qualquer
outro caminho são somente leitura para o editor, inclusive `editor/`.

Decisões do usuário (13/10/2026):
- Front-end em **HTML/CSS/JS puro**: o editor lê e grava arquivos `.html`.
- "Brilho" = **glow** (sombra luminosa colorida) **e brilho** (`filter: brightness`).
- Posição **livre** (x/y absoluto) no desktop e **empilhada em coluna** abaixo de 768px.

## Estrutura

```
editor/
  executor.js            entrada: node editor/executor.js [--porta N] [--sem-abrir]
  MiniChef-Editor.exe    entrada Windows x64, inclui Node.js; usa os arquivos ao lado
  windows/              entrada SEA e build reproduzível (postject só no build)
  package.json           "type": "module", scripts start/test/build:windows
  server/
    caminhos.js          raízes, guarda de caminho (confinamento em minichef--frontend)
    estatico.js          servir arquivos (MIME, no-store), usado pelo editor e pelo site
    api.js               rotas /api
    servidorSite.js      sobe/para o servidor do site na porta escolhida; checa portas
  public/                interface do editor (ES modules, sem bundler)
    index.html           casca: barra superior, ferramentas, palco, inspetor
    css/editor.css       layout base e tokens (dono: integrador)
    css/canvas.css       (dono: agente canvas)
    css/inspetor.css     (dono: agente ferramentas)
    js/nucleo.js         estado, eventos, histórico, API, helpers de documento (dono: integrador)
    js/main.js           inicialização (dono: integrador)
    js/canvas.js         palco, zoom, seleção, mover, redimensionar, atalhos, área de transferência (agente canvas)
    js/inspetor.js       painel de propriedades: cores, texto, fontes, glow, brilho, borda, camadas, imagem (agente ferramentas)
    js/ferramentas.js    inserir caixa/texto/imagem, painel de páginas, painel "Rodar site" e portas (agente ferramentas)
  test/                  node:test (servidor) + e2e (Playwright, se disponível)
```

## Segurança do executor (obrigatório)

1. Escutar **só em `127.0.0.1`**, tanto o editor quanto o servidor do site.
2. **Token de sessão**: `crypto.randomBytes(24)` gerado na partida. Entra no `index.html`
   servido, no `<meta name="editor-token" content="__EDITOR_TOKEN__">`. Toda rota `/api/*`
   exige o cabeçalho `X-Editor-Token` com o valor correto (comparar com `timingSafeEqual`) → 403.
3. **Host**: rejeitar com 403 qualquer requisição ao editor cujo `Host` não seja
   `127.0.0.1:P`, `localhost:P` ou `[::1]:P` (proteção contra DNS rebinding).
   Em métodos que alteram (POST/PUT/DELETE), se houver `Origin`, ele precisa ser `http://<host permitido>`.
4. **Sem CORS**: nunca enviar `Access-Control-Allow-*`.
5. **Guarda de caminho** (`resolverNoFrontend(rel)`):
   - rejeitar bytes nulos, caminho absoluto, segmento `..` e barra invertida, já depois de decodificar a URL;
   - `path.resolve(FRONTEND, rel)` precisa ficar dentro de `FRONTEND + sep`;
   - `realpath` do destino (ou do pai existente mais próximo) também precisa ficar dentro de `realpath(FRONTEND)`, o que barra symlinks;
   - defesa extra: negar se cair em `minichef--backend` ou em `editor`.
6. Gravação só com extensões permitidas: páginas `.html`; imagens `.png .jpg .jpeg .gif .webp .svg`.
   Imagens são checadas por **assinatura de bytes**: PNG, JPEG, GIF, WEBP (`RIFF....WEBP`), e SVG por texto começando em `<svg` ou `<?xml`.
7. Limites de corpo: JSON até 2 MB; imagem até 10 MB → 413.
8. **Nenhum comando de shell** recebe entrada do usuário. O servidor do site é um `http.Server`
   do próprio processo (sem `spawn`). A única exceção é abrir o navegador na partida
   (`xdg-open`/`open`/`cmd /c start`) com a URL fixa do editor, via `spawn` sem shell.
9. Erros respondem `{ "erro": "mensagem em português" }`, sem stack trace nem caminho absoluto.

## Rotas do executor (porta padrão 4300)

Rotas estáticas, sem token, mas com checagem de Host:
- `GET /` → `public/index.html` com `__EDITOR_TOKEN__` substituído.
- `GET /css/*`, `GET /js/*` → `public/...`.
- `GET /site/<caminho>` → arquivo de `minichef--frontend/` (somente leitura, guarda de caminho, `Cache-Control: no-store`).
  É o que o iframe do editor carrega. Mesma origem do editor, o que é necessário para acessar o DOM.

API (JSON, exige `X-Editor-Token`):

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/info` | — | `{ pastaFrontend: "minichef--frontend", portaEditor, site: {rodando, porta, url} }` |
| GET | `/api/paginas` | — | `{ paginas: ["index.html", "receitas/bolo.html"] }`: `.html` recursivo, `/` como separador, ordenado, ignora `node_modules` e pastas ocultas |
| GET | `/api/pagina?caminho=x.html` | — | `{ caminho, html }` · 404 se não existir |
| PUT | `/api/pagina` | `{ caminho, html, criar? }` | `{ ok: true, caminho }` · com `criar: true` → 409 se já existir · cria subpastas dentro do front |
| POST | `/api/imagens` | bytes crus · cabeçalho `X-Nome-Arquivo` (URI-encoded) | `{ caminho: "imagens/foto-a1b2c3.png" }` · salva em `minichef--frontend/imagens/` com nome higienizado (minúsculas, `[a-z0-9-]`) + sufixo aleatório |
| GET | `/api/site` | — | `{ rodando, porta, url }` |
| POST | `/api/site/iniciar` | `{ porta }` | `{ rodando: true, porta, url }` · porta inteira 1024–65535, diferente da do editor → 400 · porta ocupada → 409 `{erro:"A porta 3000 já está em uso."}` · se já roda em outra porta, para e sobe na nova |
| POST | `/api/site/parar` | — | `{ rodando: false }` |
| GET | `/api/portas` | — | `{ sugestoes: [{porta, livre}] }` para 3000, 5500, 8080, 5173, 8000 |
| GET | `/api/portas/verificar?porta=N` | — | `{ porta, livre }` |

Servidor do site: serve `minichef--frontend/` como site estático. `/` e diretórios entregam `index.html`,
sem listagem de diretório, 404 simples, `no-store`. Encerra junto com o processo (SIGINT/SIGTERM).

Porta do editor: `--porta N` ou `EDITOR_PORTA`. Sem porta explícita, tenta 4300..4310 e usa a primeira livre.
Com porta explícita ocupada, mostra erro claro e sai com código 1.

## Formato da página ("prancheta")

Página nova (`nucleo.modeloPaginaNova(titulo)`):
- `<style data-mc-base>` com o CSS base: prancheta de 1280px centralizada,
  filhos `[data-mc]` com `position:absolute` e media query `max-width:768px` que empilha em coluna.
- `<main class="mc-prancheta" data-mc-prancheta style="height:900px">` no `<body>`.

Elementos criados pelo editor são **filhos diretos** da prancheta:
- `data-mc="caixa" | "texto" | "imagem"` e `data-mc-id="mc-xxxxxx"` (único na página).
- Geometria inline: `left, top, width, height` em px, mais `--mc-a` (altura) para o modo celular.
  Use **sempre** `nucleo.definirGeometria(el, {x,y,w,h})` e `nucleo.geometria(el)`.
- Caixa e texto são `<div>` (o texto pode virar `h1/h2/h3/p` pelo inspetor) e aceitam texto inline e estilos de fonte.
  "Texto" é só uma caixa sem fundo e com conteúdo inicial.
- Imagem: `<img data-mc="imagem" src="imagens/..." alt="...">` com `object-fit`.
- Estilos visuais ficam **inline** (`style`). Motivo: o round-trip é simples e quem edita à mão vê o resultado.
  Gatilho para revisitar: precisar de temas ou breakpoints por elemento → migrar para classes num CSS gerado.
- Ordem no celular: na serialização, `nucleo.serializar()` grava `order:N` inline, ordenando por (top, left).
- Camadas: a ordem no DOM é a ordem de empilhamento (o último fica por cima).

Interior de `#mc-palco` pertence ao canvas, que pode reorganizá-lo via JS (por exemplo, com um invólucro de zoom).

Elementos que não são do editor (HTML escrito à mão, fora da prancheta) podem ser selecionados e estilizados.
"Mover" aplica `position:relative; left; top`. Inserir um elemento cria a prancheta se ela não existir.

Artefatos do editor dentro do documento do iframe (estilos de realce, `contenteditable`)
levam `data-mc-artefato` ou são removidos por `nucleo.serializar()`. Nada do editor vai para o arquivo salvo.

## Iframe

`<iframe id="mc-quadro" sandbox="allow-same-origin">` carrega `/site/<caminho>`. Os scripts da página **não rodam**
no editor, então o DOM salvo é o DOM do arquivo. O editor acessa `iframe.contentDocument`
(validado no Chromium em 13/10/2026: acesso ao DOM, listeners do pai, `contentEditable` e `elementFromPoint` funcionam).
Os eventos de ponteiro são capturados por uma **camada de sobreposição no documento do editor**, por cima do iframe,
e o alvo é encontrado com `doc.elementFromPoint`. Assim links e formulários da página não reagem durante a edição.

## Eventos do núcleo (`nucleo.on(nome, fn)` / `nucleo.emit`)

| Evento | Dados | Quem emite |
|---|---|---|
| `pagina:carregada` | `{ caminho, doc }` | nucleo.abrirPagina |
| `pagina:salva` | `{ caminho }` | nucleo.salvar |
| `selecao:mudou` | `{ elementos }` | nucleo.selecionar/limparSelecao |
| `documento:mudou` | `{ origem }` | toda alteração no DOM via nucleo (e módulos que alteram direto **devem** chamar `nucleo.alterado(origem)`) |
| `historico:mudou` | `{ podeDesfazer, podeRefazer }` | nucleo.historico |
| `sujo:mudou` | `{ sujo }` | nucleo |
| `zoom:mudou` | `{ zoom }` | canvas |
| `aviso` | `{ tipo: "info"|"sucesso"|"erro", texto }` | qualquer um; main.js mostra o toast |

Serviços registrados por um módulo e usados por outro (`nucleo.servicos`):
- `servicos.centroVisivel()` → `{x, y}` em coordenadas da prancheta, no centro da área visível (registrado pelo canvas).
- `servicos.inserirImagemArquivo(file, {x,y}?)` → envia e insere a imagem (registrado pelas ferramentas; o canvas usa em soltar e colar).
- `servicos.editarTexto(el)` → entra em edição inline (registrado pelo canvas).
- `servicos.finalizarEdicao()` → encerra a edição de texto inline, se houver (registrado pelo canvas; o núcleo chama antes de salvar, desfazer ou trocar de página).

## Atalhos (canvas)

Ctrl/Cmd+C copiar · Ctrl+V colar (+16px de deslocamento, ids novos; cola imagem da área de transferência do sistema) ·
Ctrl+X recortar · Ctrl+Z desfazer · Ctrl+Shift+Z / Ctrl+Y refazer · Ctrl+S salvar · Delete/Backspace remover ·
setas movem 1px (Shift: 10px) · Esc limpa a seleção ou sai da edição de texto · duplo clique edita o texto ·
Shift+clique adiciona à seleção ou remove dela · arrastar no vazio faz seleção por área · Ctrl+roda do mouse dá zoom.
Nenhum atalho age quando o foco está em `input`, `textarea`, `select` ou num elemento em edição.

## Portas de teste (agentes)

Cada agente usa a própria faixa para não colidir: executor 4310–4319 · canvas 4320–4329 · ferramentas 4330–4339 · QA 4340–4349.
Sempre `--sem-abrir`. Encerre os processos que iniciar.
