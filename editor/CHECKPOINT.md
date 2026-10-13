# Checkpoint — Editor MiniChef (13/10/2026)

**Objetivo:** editor visual em estilo canvas para `minichef--frontend/`, com um executor local que só grava no front,
botão "Rodar site" com escolha de porta e ferramentas para mover, redimensionar, selecionar, Ctrl+C/V, cores, texto,
fontes, glow, brilho e imagens.

**Decisões do usuário:** HTML/CSS/JS puro · glow + brilho · posição livre que empilha no celular (<768px).

**Agentes** (definições em `~/.claude/agents/minichef-editor-*.md`):
1. executor: servidor, API, segurança e testes · 2. canvas: interação · 3. ferramentas: inspetor, páginas e site · 4. qa: verificação independente.

| Etapa | Estado |
|---|---|
| Contrato (`CONTRATO.md`) + núcleo/casca (`public/js/nucleo.js`, `main.js`, `index.html`, `css/editor.css`) | feito (integrador) |
| Executor | em andamento |
| Canvas | em andamento |
| Inspetor/ferramentas | em andamento |
| Integração + QA e2e/segurança | pendente |
| README de uso | pendente |

**Invariante verificada no fim:** o `sha256` de `minichef--backend/*` não muda.

## Entrega do executável — 13/10/2026

- Pedido atual: adicionar `.exe` em `minichef/editor` e publicar no repositório
  `MiniChef027/minichef--backend`, sem modificar a pasta local `minichef--backend`.
- Gerado `MiniChef-Editor.exe` Windows x64 com Node.js 24.14.1 incorporado.
  Usa `executor.js`, `server/`, `public/` e `package.json` ao lado do executável.
- Adicionados build em `windows/`, README, licença do Node, checksum, lockfile
  e exclusões de `node_modules/` e `.build/`. Contrato atualizado quanto ao build.
- Validação: 48 testes existentes passaram. Executável PE32+ executado pelo Wine 9
  numa cópia temporária, com espaços no caminho e diretório de trabalho diferente:
  interface e API acessíveis, token obrigatório, criação e atualização de HTML,
  tentativa de escapar para backend recusada. Não houve teste em Windows nativo
  nem da abertura automática do navegador (teste usou `--sem-abrir`).
- Nenhum arquivo da pasta backend real foi modificado. Exclusões preexistentes
  da raiz e demais pastas não fazem parte desta entrega.
- Publicação pendente: GitHub retornou 403 para `bittigoncalves-sketch`;
  ambas as contas locais (`bittigoncalves-sketch` e `nirmind3`) reportaram `push: false`.
  Próximo passo: enviar o commit após obter acesso de escrita ao repositório.
