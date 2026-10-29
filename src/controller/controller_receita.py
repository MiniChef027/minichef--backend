from utils.entrada import (ler_texto, ler_inteiro, ler_decimal, ler_opcao,
                           confirmar, escolher_registro)

SQL_LISTA = "SELECT id, nome, nacionalidade, porcao_padrao FROM receita ORDER BY id"
SQL_USUARIOS = "SELECT id, nome, email FROM usuario ORDER BY id"
SQL_INGREDIENTES = "SELECT id, nome, unidade_padrao FROM ingrediente ORDER BY id"
PAPEIS = ["Principal", "Secundário", "Removível", "Opcional"]
VISIBILIDADES = ["Público", "Privado", "Opcional"]


class ControllerReceita:
    def __init__(self, db):
        self.db = db

    def inserir(self):
        print("\n--- INSERIR RECEITA ---")
        autor = escolher_registro(self.db, "AUTOR DA RECEITA", SQL_USUARIOS)
        if autor is None:
            print("Cadastre um usuário antes de criar uma receita.")
            return
        nome = ler_texto("Nome da receita: ")
        porcoes = ler_inteiro("Porção padrão (quantas pessoas serve): ")
        tempo = ler_inteiro("Tempo médio de preparo (minutos): ")
        nacionalidade = ler_texto("Nacionalidade (ENTER para pular): ", obrigatorio=False) or None
        refeicao = ler_texto("Refeição recomendada (ENTER para pular): ", obrigatorio=False) or None
        orcamento = ler_decimal("Orçamento estimado (ENTER para pular): ", obrigatorio=False)
        modo_preparo = ler_texto("Modo de preparo: ")

        nova = self.db.write(
            """INSERT INTO receita (nome, porcao_padrao, refeicao_recomendada, modo_preparo,
                                   nacionalidade, tempo_medio_gasto_min, orcamento_estimado, autor_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (nome, porcoes, refeicao, modo_preparo, nacionalidade, tempo, orcamento, autor))
        id_receita = nova[0][0]
        print(f"Receita cadastrada com o ID {id_receita}.")

        while confirmar("Adicionar um ingrediente à receita?"):
            self._adicionar_ingrediente(id_receita)

    def _adicionar_ingrediente(self, id_receita: int):
        id_ingrediente = escolher_registro(self.db, "INGREDIENTES", SQL_INGREDIENTES)
        if id_ingrediente is None:
            return
        quantidade = ler_decimal("Quantidade: ")
        unidade = ler_texto("Unidade (g, ml, unidade...): ")
        print("Papel do ingrediente:")
        papel = ler_opcao("Escolha: ", PAPEIS)
        print("Visibilidade:")
        visibilidade = ler_opcao("Escolha: ", VISIBILIDADES)
        self.db.write(
            """INSERT INTO receita_ingrediente (receita_id, ingrediente_id, quantidade, unidade, papel, visibilidade)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (id_receita, id_ingrediente, quantidade, unidade, papel, visibilidade))
        print("Ingrediente adicionado.")

    def remover(self):
        id_receita = escolher_registro(self.db, "RECEITAS", SQL_LISTA)
        if id_receita is None:
            return
        no_planner = int(self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM item_planner WHERE receita_id = %s",
            (id_receita,))["total"][0])

        if not confirmar(f"Remover a receita {id_receita}?"):
            print("Remoção cancelada.")
            return

        comandos = []
        if no_planner:
            print(f"Essa receita está em {no_planner} refeição(ões) planejada(s).")
            if not confirmar("Remover também essas refeições do planner?"):
                print("Remoção cancelada: a receita está em uso.")
                return
            comandos.append(("DELETE FROM item_planner WHERE receita_id = %s", (id_receita,)))
        # os ingredientes da receita são apagados junto (ON DELETE CASCADE)
        comandos.append(("DELETE FROM receita WHERE id = %s", (id_receita,)))
        self.db.write_many(comandos)
        print("Receita removida.")

    def atualizar(self):
        id_receita = escolher_registro(self.db, "RECEITAS", SQL_LISTA)
        if id_receita is None:
            return
        nome = ler_texto("Novo nome: ")
        porcoes = ler_inteiro("Nova porção padrão: ")
        tempo = ler_inteiro("Novo tempo de preparo (minutos): ")
        nacionalidade = ler_texto("Nova nacionalidade (ENTER para vazio): ", obrigatorio=False) or None
        modo_preparo = ler_texto("Novo modo de preparo: ")

        self.db.write(
            """UPDATE receita SET nome = %s, porcao_padrao = %s, tempo_medio_gasto_min = %s,
                      nacionalidade = %s, modo_preparo = %s WHERE id = %s""",
            (nome, porcoes, tempo, nacionalidade, modo_preparo, id_receita))
        print("\nRegistro atualizado:")
        print(self.db.sqlToDataFrame(
            """SELECT id, nome, porcao_padrao, tempo_medio_gasto_min, nacionalidade, modo_preparo
               FROM receita WHERE id = %s""", (id_receita,)).to_string(index=False))
