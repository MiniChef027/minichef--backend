from conexion.pg_queries import PtgreSQLQueries
from model.PlannerSemanal import PlannerSemanal
from controller.controller_usuario import ControllerUsuario
from controller.controller_receita import ControllerReceita

class ControllerPlanner:
    def __init__(self):
        self.ctrl_usuario = ControllerUsuario()
        self.ctrl_receita = ControllerReceita()

    def planner_existe(self, db: PtgreSQLQueries, id_planner: int) -> bool:
        """Verifica se o planner semanal existe na base de dados pelo ID."""
        query = f"SELECT count(1) AS total FROM planner_semanal WHERE id = {id_planner};"
        resultado = db.sqlToDataFrame(query)
        return int(resultado['total'].values[0]) > 0

    def buscar_planner_por_id(self, db: PtgreSQLQueries, id_planner: int) -> PlannerSemanal:
        """Retorna uma instância da classe PlannerSemanal com o objeto Usuario correspondente."""
        query = f"SELECT id, usuario_id, semana_inicio, orcamento_definido FROM planner_semanal WHERE id = {id_planner};"
        df = db.sqlToDataFrame(query)
        if not df.empty:
            usuario_id = int(df['usuario_id'].values[0])
            usuario = self.ctrl_usuario.buscar_usuario_por_id(db, usuario_id)
            return PlannerSemanal(
                id_planner=int(df['id'].values[0]),
                usuario=usuario,
                semana_inicio=str(df['semana_inicio'].values[0]),
                orcamento_definido=df['orcamento_definido'].values[0]
            )
        return None

    def inserir_planner(self) -> PlannerSemanal:
        db = PtgreSQLQueries(can_write=True)

        print("\n--- INSERIR NOVO PLANNER SEMANAL ---")
        id_usuario = int(input("Informe o ID do Utilizador dono do planner: "))

        if not self.ctrl_usuario.usuario_existe(db, id_usuario):
            print(f"Erro: Não existe nenhum utilizador cadastrado com o ID {id_usuario}.")
            return None

        semana_inicio = input("Data de início da semana (AAAA-MM-DD): ").strip()
        orcamento = input("Orçamento definido para a semana (opcional): ").strip()
        orcamento_sql = orcamento.replace(',', '.') if orcamento else "NULL"

        query = f"""
            INSERT INTO planner_semanal (usuario_id, semana_inicio, orcamento_definido)
            VALUES ({id_usuario}, '{semana_inicio}', {orcamento_sql})
            RETURNING id;
        """
        resultado = db.write(query)
        novo_id = resultado[0][0]
        print(f"Planner semanal criado com sucesso! ID: {novo_id}")

        usuario = self.ctrl_usuario.buscar_usuario_por_id(db, id_usuario)
        return PlannerSemanal(novo_id, usuario, semana_inicio, orcamento_sql)

    def adicionar_item_planner(self):
        """Adiciona uma receita agendada a um planner num determinado dia e refeição."""
        db = PtgreSQLQueries(can_write=True)

        print("\n--- ADICIONAR ITEM AO PLANNER ---")
        id_planner = int(input("ID do Planner Semanal: "))
        if not self.planner_existe(db, id_planner):
            print(f"Erro: Planner ID {id_planner} não existe.")
            return

        id_receita = int(input("ID da Receita a ser agendada: "))
        if not self.ctrl_receita.receita_existe(db, id_receita):
            print(f"Erro: Receita ID {id_receita} não existe.")
            return

        print("Dias válidos: 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'")
        dia_semana = input("Dia da semana: ").strip().lower()

        print("Refeições válidas: 'Café da manhã', 'Almoço', 'Jantar', 'Lanche'")
        refeicao = input("Refeição: ").strip()

        porcoes = int(input("Porções desejadas para esta refeição: "))

        query = f"""
            INSERT INTO item_planner (planner_id, receita_id, dia_semana, refeicao, porcoes_desejadas)
            VALUES ({id_planner}, {id_receita}, '{dia_semana}', '{refeicao}', {porcoes});
        """
        db.write(query)
        print("Item adicionado ao planner semanal com sucesso!")

    def atualizar_planner(self):
        db = PtgreSQLQueries(can_write=True)

        print("\n--- ATUALIZAR PLANNER SEMANAL ---")
        id_planner = int(input("Informe o ID do planner que deseja alterar: "))

        if not self.planner_existe(db, id_planner):
            print(f"Erro: Não foi encontrado nenhum planner com o ID {id_planner}.")
            return

        nova_data_inicio = input("Nova Data de Início (AAAA-MM-DD): ").strip()
        novo_orcamento = input("Novo Orçamento Definido: ").strip()
        orcamento_sql = novo_orcamento.replace(',', '.') if novo_orcamento else "NULL"

        query_update = f"""
            UPDATE planner_semanal 
            SET semana_inicio = '{nova_data_inicio}', 
                orcamento_definido = {orcamento_sql}
            WHERE id = {id_planner};
        """
        db.write(query_update)

        planner_atualizado = self.buscar_planner_por_id(db, id_planner)
        print("\nRegisto Atualizado:")
        print(planner_atualizado.to_string())

    def excluir_planner(self):
        db = PtgreSQLQueries(can_write=True)

        print("\n--- REMOVER PLANNER SEMANAL ---")
        id_planner = int(input("Informe o ID do planner que deseja remover: "))

        if not self.planner_existe(db, id_planner):
            print(f"Erro: Não foi encontrado nenhum planner com o ID {id_planner}.")
            return

        confirmacao = input(f"Tem a certeza de que deseja eliminar o planner ID {id_planner}? Os itens agendados e a lista de compras associados serão eliminados em cascata. (S/N): ").strip().upper()
        if confirmacao == 'S':
            query_delete = f"DELETE FROM planner_semanal WHERE id = {id_planner};"
            db.write(query_delete)
            print("Planner semanal eliminado com sucesso!")
        else:
            print("Operação cancelada.")