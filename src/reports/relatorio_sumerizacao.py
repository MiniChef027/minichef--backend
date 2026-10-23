import os
from conexion.pg_queries import PtgreSQLQueries # Ajuste para a sua classe de conexão

class Relatorios:
    def __init__(self):
        # Inicia a conexão à base de dados no modo leitura
        self.db = PtgreSQLQueries(can_write=False)

    def ler_ficheiro_sql(self, nome_ficheiro: str) -> str:
        """Abre o ficheiro SQL localizado na pasta src/sql/ e retorna o seu conteúdo como texto."""
        caminho_ficheiro = os.path.join("src", "sql", nome_ficheiro)
        try:
            with open(caminho_ficheiro, 'r', encoding='utf-8') as file:
                return file.read()
        except FileNotFoundError:
            print(f"Erro: O ficheiro '{caminho_ficheiro}' não foi encontrado.")
            return None

    def _executar_e_exibir(self, titulo: str, nome_ficheiro: str):
        """Método auxiliar interno para ler, executar a query e formatar a saída."""
        query = self.ler_ficheiro_sql(nome_ficheiro)
        if not query:
            return

        print(f"\n{'='*80}")
        print(f" RELATÓRIO: {titulo.upper()}")
        print(f"{'='*80}")
        
        df_relatorio = self.db.sqlToDataFrame(query)
        
        if df_relatorio.empty:
            print("Nenhum dado encontrado para este relatório.")
        else:
            print(df_relatorio.to_string(index=False))
        print(f"{'='*80}\n")

    def relatorio_produtividade_autores(self):
        self._executar_e_exibir("Produtividade dos Autores (Receitas por Utilizador)", "relatorio_produtividade_autores.sql")

    def relatorio_popularidade_ingredientes(self):
        self._executar_e_exibir("Popularidade dos Ingredientes", "relatorio_popularidade_ingredientes.sql")

    def relatorio_planeamento_por_refeicao(self):
        self._executar_e_exibir("Planeamento por Tipo de Refeição", "relatorio_planeamento_refeicao.sql")

    def relatorio_tempo_medio_por_nacionalidade(self):
        self._executar_e_exibir("Tempo Médio de Preparação por Nacionalidade", "relatorio_tempo_nacionalidade.sql")

    def relatorio_progresso_listas_compras(self):
        self._executar_e_exibir("Progresso das Listas de Compras", "relatorio_progresso_listas.sql")