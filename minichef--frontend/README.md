# MiniChef — frontend

Interface em HTML, CSS e JavaScript, sem dependências de execução e sem alterações no backend, SQL ou editor.

## Abrir

Na raiz do projeto:

```sh
python3 -m http.server 4311 --bind 127.0.0.1 --directory minichef--frontend
```

Abra http://127.0.0.1:4311. Também é possível abrir `index.html` diretamente, mas o armazenamento local depende das permissões do navegador para arquivos locais. O editor existente continua podendo servir esta pasta.

## Telas e fluxos

| Escopo solicitado | Rota | Comportamento |
| --- | --- | --- |
| Login, cadastro, confirmação | `#entrar`, `#cadastro` | Validação de campos, senhas coincidentes, 11 dígitos de CPF, nascimento válido, mostrar/ocultar senha e código de seis dígitos. Sem criação de conta ou autenticação fictícia. |
| Menu principal | `#inicio` | Acesso aos módulos, resumo de receitas, planejamento da semana atual e alertas. Gaveta acessível no celular, tema claro/escuro. |
| Receitas — UC02, UC04, UC07, UC08 | `#receitas`, `#nova-receita` | Busca por nome e ingrediente; filtros de refeição, tempo, origem e finalidade; detalhes, favoritos, ingredientes dinâmicos, rascunho, edição de receitas próprias não publicadas e envio para análise. |
| Aprovação — UC03 | `#aprovacao` | Prévia administrativa local, ingredientes/preparo completos, aprovação, recusa com motivo obrigatório e histórico. Receita recusada pode ser corrigida e reenviada. |
| Porções — UC05 | `#calculadora` | Escala proporcional com duas casas decimais; sem recalcular tempo de preparo. |
| Planner/compras — UC06 | `#planner`, `#compras` | Sete dias, quatro tipos de refeição, várias receitas por dia, semanas independentes, porções por receita, remoção confirmada, lista automática e marcação de comprado. |
| Despensa/validade — UC14, UC15 | `#despensa` | Cadastro, edição e remoção de lotes, filtros, vencidos, vencimento hoje/amanhã/em até três dias, contador no menu e início. |
| Alertas de validade — UC15 | `#alertas` | Acesso próprio no menu, lista por ordem de validade com vencidos e vencimento em até três dias, estado sem alertas e ligação para a despensa. |

A barra superior preserva o fundo verde e as figuras originais de comidas e utensílios (`img/padrao-cozinha.svg`), também no celular e no tema escuro.

A especificação detalhada de cada UC não estava no repositório. Os números acima seguem o agrupamento informado no pedido; as regras de porções e compras seguem `docs/BANCO_DE_DADOS.md`.

## Limites da demonstração

- O backend disponível contém classes, sem API HTTP. Nenhuma chamada de rede é feita pelo aplicativo e nenhuma operação é gravada no servidor.
- Receitas de exemplo são identificadas como demonstração. Receitas, favoritos, planner, compras e despensa são armazenados em `minichef-demo-v1` no navegador, sem sincronização, contas ou permissões reais. O tema mantém a chave anterior `minichef-tema`.
- Login/cadastro/confirmar informam a indisponibilidade do serviço após validar os campos. Senhas, CPF e demais dados de autenticação não são persistidos; senhas são apagadas após o envio e formulários pessoais são limpos ao sair da tela.
- A tela de aprovação é explicitamente uma prévia. Autorização administrativa real precisa ser aplicada pelo servidor quando existir integração.
- A lista agrega por nome normalizado de ingrediente e unidade, exclui opcionais e arredonda unidades/dentes para cima após a soma. Outras unidades usam duas casas decimais. Não converte unidades, desconta despensa nem estima preços. Alterar o planner reinicia as marcações de compras da semana.
- Receitas publicadas ficam fora da edição local para preservar as referências no planner. Rascunhos exigem os campos básicos válidos.
- Alertas são visuais dentro da aplicação, recalculados ao navegar ou retornar à aba; não são notificações do sistema ou e-mails. O limite de três dias é uma decisão da interface, ajustável após detalhamento dos UCs.
- Dados locais inválidos, armazenamento indisponível ou alterações concorrentes em outra aba produzem aviso. Dados inválidos/concorrentes não são sobrescritos; nesse caso, a visita continua em memória.

## Verificação

```sh
node --test minichef--frontend/test/dados.test.cjs
node --check minichef--frontend/js/app.js
```

Oito testes verificam cálculos, arredondamento agregado, filtros combinados, datas, validade e contrato do armazenamento. Sem build obrigatório.

Validação no Chromium via Playwright em 16/10/2026:

- Busca e filtros, calculadora (arroz de 4 para 8 porções = 800 g).
- Criar receita → recusar exigindo motivo → editar → reenviar → aprovar → visualizar publicada. Entrada contendo HTML permanece texto.
- Planner → lista de compras → marcação → recarga; separação entre semanas.
- Despensa: adicionar → alertar validade → editar → recarregar → cancelar remoção → confirmar remoção.
- Cadastro com senhas divergentes, ausência de dados pessoais no armazenamento, mensagem honesta de indisponibilidade do login.
- Treze rotas nas larguras 360, 768 e 1440 px, sem transbordamento horizontal ou erros de JavaScript. Menu móvel com Escape, foco restaurado e conteúdo de fundo inerte; temas claro/escuro inspecionados visualmente.
- Armazenamento corrompido preservado, falha de gravação avisada, foco mantido nos favoritos, atalho para conteúdo sem mudar de tela e senha ocultada novamente após envio.
- Backend: SHA-256 dos quatro arquivos idênticos antes/depois. Não foram executados serviços nem testes do backend.

Isso valida a demonstração do frontend, não integração ou segurança do servidor.
