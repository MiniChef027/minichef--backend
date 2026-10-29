from utils.entrada import ler_texto, ler_data, ler_opcao, confirmar, escolher_registro
from utils.seguranca import gerar_hash_senha

TIPOS_CONTA = [
    "Usuário comum", "Chef de cozinha", "Hotel", "Restaurante",
    "Personal Trainer", "Nutricionista", "Administrador de eventos", "Mercado",
]
SQL_LISTA = "SELECT id, nome, email FROM usuario ORDER BY id"


class ControllerUsuario:
    def __init__(self, db):
        self.db = db

    def _existe(self, coluna: str, valor: str) -> bool:
        df = self.db.sqlToDataFrame(
            f"SELECT count(1) AS total FROM usuario WHERE LOWER({coluna}) = LOWER(%s)", (valor,))
        return int(df["total"][0]) > 0

    def inserir(self):
        print("\n--- INSERIR USUÁRIO ---")
        nome = ler_texto("Nome: ")
        email = ler_texto("E-mail: ")
        if self._existe("email", email):
            print("Já existe um usuário com esse e-mail.")
            return
        data_nascimento = ler_data("Data de nascimento (AAAA-MM-DD): ")
        cpf = ler_texto("CPF (000.000.000-00): ")
        if self._existe("cpf", cpf):
            print("Já existe um usuário com esse CPF.")
            return
        senha = ler_texto("Senha: ")
        print("Tipo de conta:")
        tipo = ler_opcao("Escolha: ", TIPOS_CONTA)

        novo = self.db.write(
            """INSERT INTO usuario (nome, email, data_nascimento, cpf, senha_hash, tipo_conta)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (nome, email, data_nascimento, cpf, gerar_hash_senha(senha), tipo))
        print(f"Usuário cadastrado com o ID {novo[0][0]}.")

    def remover(self):
        id_usuario = escolher_registro(self.db, "USUÁRIOS", SQL_LISTA)
        if id_usuario is None:
            return
        receitas = self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM receita WHERE autor_id = %s", (id_usuario,))
        planners = self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM planner_semanal WHERE usuario_id = %s", (id_usuario,))
        total_receitas, total_planners = int(receitas["total"][0]), int(planners["total"][0])

        if not confirmar(f"Remover o usuário {id_usuario}?"):
            print("Remoção cancelada.")
            return

        comandos = []
        if total_receitas or total_planners:
            print(f"Esse usuário tem {total_receitas} receita(s) e {total_planners} planner(s).")
            if not confirmar("Remover também esses registros?"):
                print("Remoção cancelada: o usuário continua sendo usado por outras tabelas.")
                return
            comandos += [
                ("DELETE FROM item_planner WHERE receita_id IN (SELECT id FROM receita WHERE autor_id = %s)", (id_usuario,)),
                ("DELETE FROM receita WHERE autor_id = %s", (id_usuario,)),
            ]
        # moderador_id não tem ON DELETE, então precisa ser limpo antes
        comandos += [
            ("UPDATE receita SET moderador_id = NULL WHERE moderador_id = %s", (id_usuario,)),
            ("DELETE FROM usuario WHERE id = %s", (id_usuario,)),
        ]
        self.db.write_many(comandos)
        print("Usuário removido.")

    def atualizar(self):
        id_usuario = escolher_registro(self.db, "USUÁRIOS", SQL_LISTA)
        if id_usuario is None:
            return
        print("Informe os novos dados (a senha e o CPF não mudam aqui).")
        nome = ler_texto("Novo nome: ")
        email = ler_texto("Novo e-mail: ")
        outro = self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM usuario WHERE LOWER(email) = LOWER(%s) AND id <> %s",
            (email, id_usuario))
        if int(outro["total"][0]) > 0:
            print("Esse e-mail já pertence a outro usuário.")
            return
        tipo = ler_opcao("Novo tipo de conta: ", TIPOS_CONTA)

        self.db.write("UPDATE usuario SET nome = %s, email = %s, tipo_conta = %s WHERE id = %s",
                      (nome, email, tipo, id_usuario))
        print("\nRegistro atualizado:")
        print(self.db.sqlToDataFrame(
            "SELECT id, nome, email, tipo_conta FROM usuario WHERE id = %s", (id_usuario,)
        ).to_string(index=False))
