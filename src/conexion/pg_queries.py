import os

import pandas as pd
import psycopg2


class PtgreSQLQueries:
    """Conexão simples com o PostgreSQL.

    Os dados de acesso vêm de variáveis de ambiente (veja o README), assim
    nenhuma senha fica salva no repositório.
    Todas as consultas recebem os valores em `params` (%s) e nunca por
    concatenação de texto, para o banco tratar o que o usuário digitou.
    """

    def __init__(self, can_write: bool = False):
        self.can_write = can_write
        self.conn = psycopg2.connect(
            host=os.getenv("PGHOST", "localhost"),
            port=os.getenv("PGPORT", "5432"),
            dbname=os.getenv("PGDATABASE", "minichef"),
            user=os.getenv("PGUSER", "postgres"),
            password=os.getenv("PGPASSWORD", ""),
        )

    def sqlToDataFrame(self, query: str, params=None) -> pd.DataFrame:
        """Executa um SELECT e devolve o resultado como DataFrame."""
        with self.conn.cursor() as cur:
            cur.execute(query, params)
            colunas = [c[0] for c in cur.description]
            linhas = cur.fetchall()
        self.conn.rollback()  # só leitura: encerra a transação aberta
        return pd.DataFrame(linhas, columns=colunas)

    def write(self, query: str, params=None):
        """Executa INSERT/UPDATE/DELETE. Se houver RETURNING, devolve as linhas."""
        return self.write_many([(query, params)])[0]

    def write_many(self, comandos):
        """Executa vários comandos na mesma transação: ou grava tudo, ou nada."""
        if not self.can_write:
            raise PermissionError("Conexão aberta somente para leitura.")
        resultados = []
        try:
            with self.conn.cursor() as cur:
                for query, params in comandos:
                    cur.execute(query, params)
                    resultados.append(cur.fetchall() if cur.description else None)
            self.conn.commit()
        except psycopg2.Error:
            self.conn.rollback()
            raise
        return resultados

    def close(self):
        self.conn.close()
