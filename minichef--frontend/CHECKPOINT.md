# Frontend MiniChef — 16/10/2026

Objetivo: login, cadastro, menu, receitas e filtros/formulário (UC02/04/07/08), aprovação (UC03), porções (UC05), planner/compras (UC06), despensa/validade (UC14/15). Alterar exclusivamente esta pasta.

Decisões: preservar HTML/CSS/JS, verde e temas. Não existe API HTTP no backend disponível; demonstrar fluxos locais explicitamente, sem autenticação fictícia nem persistência de credenciais/CPF. Usar regras de porções/compras de docs/BANCO_DE_DADOS.md. A especificação detalhada dos UCs não foi encontrada; numeração segue agrupamento do pedido.

Estado: telas e interações implementadas. Cópia anterior e hashes do backend em /tmp/minichef-before. Não houve alteração de editor, SQL, docs ou backend.

Arquivos: index.html, css/styles.css e js/app.js atualizados; js/dados.js, test/dados.test.cjs, README.md e este checkpoint adicionados. js/tema.js e imagens preservados.

Validação: 8 testes de modelo passaram; fluxos de receita/revisão, porções/planner/compras, despensa e autenticação indisponível exercitados em Chromium. 13 rotas em 360/768/1440 px sem transbordamento ou erros JS. Hashes SHA-256 do backend intactos. Detalhes em README.md.

Limitação: nenhuma API disponível; tudo funciona como demonstração local identificada. Login/cadastro não criam sessão/conta; prévia administrativa não é controle de acesso real. Nenhuma integração com servidor foi validada. Próxima etapa externa a este pedido: detalhar UCs e conectar endpoints quando disponíveis, preservando autorização exclusivamente no servidor.

Correção solicitada: restaurada a barra superior verde com o SVG original de comidas/utensílios. Adicionada rota `#alertas` e entrada explícita “Alertas de validade”, com itens vencidos e vencimento em até três dias vindos da despensa; resumo inicial leva aos alertas. Escopo continua exclusivamente frontend.

Validação da correção: Chromium em 1440 px e 390 px, barra original visível no claro/escuro, sem transbordamento. Quatro ingredientes cadastrados pelo formulário (ontem, hoje, +3 e +4 dias): três alertas corretos, +4 excluído, persistência após recarga, estado vazio e acesso pelo menu móvel verificados; sem erros JavaScript.
