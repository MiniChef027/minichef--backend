# Uso de IA no projeto

Registro exigido pelo edital (item 8, observação 5).

| Prompt | Fonte | O que o grupo fez com a resposta |
|---|---|---|
| "abrir este arquivo C2_Edital_Desenvolvimento_Banco_Relacional... fazer a etapa 5 e 6 do edital, humanizar o que for feito na etapa 5 e 6" | Claude Code | Gerou `src/principal.py`, `conexion/pg_queries.py`, `controller/controller_receita.py`, `utils/` e refez os demais controllers com consultas parametrizadas. Testado em PostgreSQL 16 com os dados de exemplo. **Pendente: o grupo revisar e conseguir explicar o código.** |
| Revisão automática de segurança (plugin do Claude Code) | Claude Code | Apontou SQL por concatenação e senha sem hash; as duas coisas foram corrigidas. |
