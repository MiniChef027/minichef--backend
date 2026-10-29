import os

class Relatorios:
    def __init__(self, db):
        self.db = db

    def ler_ficheiro_sql(self, nome_ficheiro: str) -> str:
        """Abre o ficheiro SQL localizado na pasta src/sql/ e retorna o seu conteúdo como texto."""
        pasta_sql = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sql")
        caminho_ficheiro = os.path.join(pasta_sql, nome_ficheiro)
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

    def relatorio_cardapio_semanal(self):
        self._executar_e_exibir("Cardápio Semanal Detalhado", "relatorio_cardapio_semanal.sql")

    def relatorio_composicao_receitas(self):
        self._executar_e_exibir("Composição Detalhada das Receitas", "relatorio_composicao_receitas.sql")

    def relatorio_catalogo_receitas(self):
        self._executar_e_exibir("Catálogo de Receitas e Autores", "relatorio_catalogo_receitas.sql")

    def relatorio_lista_compras_completa(self):
        self._executar_e_exibir("Lista de Compras Completa com Categorias", "relatorio_lista_compras.sql")

    def relatorio_historico_planeamento(self):
        self._executar_e_exibir("Histórico de Planeamento e Listas Geradas", "relatorio_historico_planeamento.sql")