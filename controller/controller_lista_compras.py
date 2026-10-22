from conexion.pg_queries import PtgreSQLQueries
from model.ListaCompras import ListaCompras
from controller.controller_planner import ControllerPlanner
from controller.controller_ingrediente import ControllerIngrediente

class ControllerListaCompras:
    def __init__(self):
        self.ctrl_planner = ControllerPlanner()
        self.ctrl_ingrediente = ControllerIngrediente()

    def lista_existe(self, db: PtgreSQLQueries, id_lista: int) -> bool:
        """Verifica se a lista de compras existe na base de dados pelo ID."""
        query = f"SELECT count(1) AS total FROM lista_compras WHERE id = {id_lista};"
        resultado = db.sqlToDataFrame(query)
        return int(resultado['total'].values[0]) > 0

    def buscar_lista_por_id(self, db: PtgreSQLQueries, id_lista: int) -> ListaCompras:
        """Retorna uma instância da classe ListaCompras."""
        query = f"SELECT id, planner_id, total_estimado, gerada_em FROM lista_compras WHERE id = {id_lista};"
        df = db.sqlToDataFrame(query)
        if not df.empty:
            planner_id = int(df['planner_id'].values[0])
            planner = self.ctrl_planner.buscar_planner_por_id(db, planner_id)
            return ListaCompras(
                id_lista=int(df['id'].values[0]),
                planner=planner,
                total_estimado=df['total_estimado'].values[0],
                gerada_em=str(df['gerada_em'].values[0])
            )
        return None

    def gerar_lista_compras_do_planner(self) -> ListaCompras:
        """Gera a lista de compras consolidando os ingredientes das receitas agendadas no planner."""
        db = PtgreSQLQueries(can_write=True)

        print("\n--- GERAR LISTA DE COMPRAS A PARTIR DE UM PLANNER ---")
        id_planner = int(input("Informe o ID do Planner Semanal: "))

        if not self.ctrl_planner.planner_existe(db, id_planner):
            print(f"Erro: Não existe nenhum planner com o ID {id_planner}.")
            return None

        # 1. Cria o registo mestre da lista de compras
        query_lista = f"""
            INSERT INTO lista_compras (planner_id)
            VALUES ({id_planner})
            RETURNING id, gerada_em;
        """
        res_lista = db.write(query_lista)
        nova_lista_id = res_lista[0][0]
        gerada_em = res_lista[0][1]

        # 2. Consolida a quantidade de ingredientes com base na proporção das porções desejadas
        query_consolidacao = f"""
            INSERT INTO item_lista_compras (lista_compras_id, ingrediente_id, quantidade, unidade)
            SELECT 
                {nova_lista_id} AS lista_compras_id,
                ri.ingrediente_id,
                SUM((ri.quantidade / r.porcao_padrao) * ip.porcoes_desejadas) AS quantidade_total,
                ri.unidade
            FROM item_planner ip
            JOIN receita r ON ip.receita_id = r.id
            JOIN receita_ingrediente ri ON r.id = ri.receita_id
            WHERE ip.planner_id = {id_planner}
            GROUP BY ri.ingrediente_id, ri.unidade;
        """
        db.write(query_consolidacao)
        print(f"Lista de Compras ID {nova_lista_id} gerada com sucesso e itens consolidados!")

        planner = self.ctrl_planner.buscar_planner_por_id(db, id_planner)
        return ListaCompras(nova_lista_id, planner, None, gerada_em)

    def atualizar_item_comprado(self):
        """Atualiza o estado de um item da lista de compras para 'Comprado' ou 'Pendente'."""
        db = PtgreSQLQueries(can_write=True)

        print("\n--- ATUALIZAR ESTADO DO ITEM NA LISTA ---")
        id_item_lista = int(input("Informe o ID do item da lista de compras: "))

        query_check = f"SELECT count(1) AS total FROM item_lista_compras WHERE id = {id_item_lista};"
        if int(db.sqlToDataFrame(query_check)['total'].values[0]) == 0:
            print(f"Erro: Item ID {id_item_lista} não foi encontrado na lista de compras.")
            return

        status_input = input("Marcar como comprado? (S/N): ").strip().upper()
        comprado_bool = "TRUE" if status_input == 'S' else "FALSE"

        query_update = f"""
            UPDATE item_lista_compras 
            SET comprado = {comprado_bool}
            WHERE id = {id_item_lista};
        """
        db.write(query_update)
        print(f"Estado do item ID {id_item_lista} atualizado para: {'Comprado' if status_input == 'S' else 'Pendente'}.")

    def excluir_lista_compras(self):
        db = PtgreSQLQueries(can_write=True)

        print("\n--- REMOVER LISTA DE COMPRAS ---")
        id_lista = int(input("Informe o ID da lista de compras que deseja remover: "))

        if not self.lista_existe(db, id_lista):
            print(f"Erro: Não foi encontrada nenhuma lista de compras com o ID {id_lista}.")
            return

        confirmacao = input(f"Tem a certeza de que deseja eliminar a lista de compras ID {id_lista}? (S/N): ").strip().upper()
        if confirmacao == 'S':
            query_delete = f"DELETE FROM lista_compras WHERE id = {id_lista};"
            db.write(query_delete)
            print("Lista de compras eliminada com sucesso!")
        else:
            print("Operação cancelada.")