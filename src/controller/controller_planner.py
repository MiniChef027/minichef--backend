from utils.entrada import (ler_inteiro, ler_decimal, ler_data, ler_opcao,
                           confirmar, escolher_registro)

SQL_LISTA = """SELECT p.id, u.nome AS usuario, p.semana_inicio
               FROM planner_semanal p JOIN usuario u ON u.id = p.usuario_id
               ORDER BY p.id"""
SQL_USUARIOS = "SELECT id, nome, email FROM usuario ORDER BY id"
SQL_RECEITAS = "SELECT id, nome, porcao_padrao FROM receita ORDER BY id"
DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
REFEICOES = ["Café da manhã", "Almoço", "Jantar", "Lanche"]


class ControllerPlanner:
    def __init__(self, db):
        self.db = db

    def inserir(self):
        print("\n--- INSERIR PLANNER SEMANAL ---")
        usuario = escolher_registro(self.db, "DONO DO PLANNER", SQL_USUARIOS)
        if usuario is None:
            print("Cadastre um usuário antes de criar um planner.")
            return
        semana = ler_data("Início da semana (AAAA-MM-DD): ")
        orcamento = ler_decimal("Orçamento da semana (ENTER para pular): ", obrigatorio=False)

        novo = self.db.write(
            """INSERT INTO planner_semanal (usuario_id, semana_inicio, orcamento_definido)
               VALUES (%s, %s, %s) RETURNING id""", (usuario, semana, orcamento))
        id_planner = novo[0][0]
        print(f"Planner cadastrado com o ID {id_planner}.")

        while confirmar("Planejar uma refeição neste planner?"):
            receita = escolher_registro(self.db, "RECEITAS", SQL_RECEITAS)
            if receita is None:
                break
            print("Dia da semana:")
            dia = ler_opcao("Escolha: ", DIAS)
            print("Refeição:")
            refeicao = ler_opcao("Escolha: ", REFEICOES)
            porcoes = ler_inteiro("Quantas porções: ")
            self.db.write(
                """INSERT INTO item_planner (planner_id, receita_id, dia_semana, refeicao, porcoes_desejadas)
                   VALUES (%s, %s, %s, %s, %s)""",
                (id_planner, receita, dia, refeicao, porcoes))
            print("Refeição adicionada ao planner.")

    def remover(self):
        id_planner = escolher_registro(self.db, "PLANNERS", SQL_LISTA)
        if id_planner is None:
            return
        itens = int(self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM item_planner WHERE planner_id = %s",
            (id_planner,))["total"][0])
        listas = int(self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM lista_compras WHERE planner_id = %s",
            (id_planner,))["total"][0])

        if not confirmar(f"Remover o planner {id_planner}?"):
            print("Remoção cancelada.")
            return
        if itens or listas:
            print(f"Ele tem {itens} refeição(ões) e {listas} lista(s) de compras.")
            if not confirmar("Remover também esses registros?"):
                print("Remoção cancelada: o planner está em uso.")
                return
        # refeições e listas saem junto (ON DELETE CASCADE)
        self.db.write("DELETE FROM planner_semanal WHERE id = %s", (id_planner,))
        print("Planner removido.")

    def atualizar(self):
        id_planner = escolher_registro(self.db, "PLANNERS", SQL_LISTA)
        if id_planner is None:
            return
        semana = ler_data("Nova data de início (AAAA-MM-DD): ")
        orcamento = ler_decimal("Novo orçamento (ENTER para vazio): ", obrigatorio=False)
        self.db.write(
            "UPDATE planner_semanal SET semana_inicio = %s, orcamento_definido = %s WHERE id = %s",
            (semana, orcamento, id_planner))
        print("\nRegistro atualizado:")
        print(self.db.sqlToDataFrame(
            "SELECT * FROM planner_semanal WHERE id = %s", (id_planner,)).to_string(index=False))
