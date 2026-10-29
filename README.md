# MiniChef – aplicação de console com PostgreSQL

Trabalho da disciplina de Banco de Dados (Prof. Howard Roatti). Programa em Python, com menu no terminal, que gerencia receitas, ingredientes, planner semanal e lista de compras.

**Grupo:** Carlos Henrique, Nathã, Gabriel Bitti Gonçalves, César Augusto e João Felipe Lopes.

## O que o programa faz

- Mostra o nome do projeto, o grupo e quantos registros existem em cada tabela.
- **Relatórios:** 5 com agrupamento (`GROUP BY`) e 5 com junção de tabelas.
- **Inserir / Remover / Atualizar** em: usuário, ingrediente, receita, planner semanal e lista de compras.
- Ao remover, se o registro é usado em outra tabela, o programa avisa e pergunta se os registros filhos também devem ser apagados.
- Senhas são guardadas com hash (scrypt), e todas as consultas usam parâmetros `%s`.

## Como executar no Linux

Requisitos: Python 3.10+ e PostgreSQL.

```bash
# 1. banco e tabelas
createdb -U postgres minichef
psql -U postgres -d minichef -f src/sql/01_create_tables.sql
psql -U postgres -d minichef -f src/sql/02_insert_samples.sql   # dados de exemplo (opcional)

# 2. dependências
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. acesso ao banco (ajuste para o seu ambiente)
export PGHOST=localhost PGPORT=5432 PGDATABASE=minichef PGUSER=postgres PGPASSWORD=sua_senha

# 4. rodar
python3 src/principal.py
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/principal.py` | menu principal |
| `src/conexion/` | conexão com o PostgreSQL |
| `src/controller/` | inserir, remover e atualizar de cada entidade |
| `src/reports/` e `src/sql/` | relatórios e scripts SQL |
| `src/utils/` | splash screen, leitura do teclado e hash de senha |
| `src/diagrams/` | diagrama relacional |
