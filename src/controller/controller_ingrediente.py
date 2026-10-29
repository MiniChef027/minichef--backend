from utils.entrada import ler_texto, ler_inteiro, ler_decimal, confirmar, escolher_registro

SQL_LISTA = "SELECT id, nome, categoria, unidade_padrao FROM ingrediente ORDER BY id"


class ControllerIngrediente:
    def __init__(self, db):
        self.db = db

    def _nome_em_uso(self, nome: str, ignorar_id: int = 0) -> bool:
        df = self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM ingrediente WHERE LOWER(nome) = LOWER(%s) AND id <> %s",
            (nome, ignorar_id))
        return int(df["total"][0]) > 0

    def inserir(self):
        print("\n--- INSERIR INGREDIENTE ---")
        nome = ler_texto("Nome: ")
        if self._nome_em_uso(nome):
            print("Já existe um ingrediente com esse nome.")
            return
        categoria = ler_texto("Categoria (ex.: vegetal, laticínio): ", obrigatorio=False) or None
        unidade = ler_texto("Unidade padrão (g, ml, unidade...): ")
        validade = ler_inteiro("Validade média em dias (ENTER se não souber): ", obrigatorio=False)
        preco = ler_decimal("Preço médio (ENTER se não souber): ", obrigatorio=False)

        novo = self.db.write(
            """INSERT INTO ingrediente (nome, categoria, unidade_padrao, validade_media_dias, preco_medio)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (nome, categoria, unidade, validade, preco))
        print(f"Ingrediente cadastrado com o ID {novo[0][0]}.")

    def remover(self):
        id_ingrediente = escolher_registro(self.db, "INGREDIENTES", SQL_LISTA)
        if id_ingrediente is None:
            return
        em_receitas = int(self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM receita_ingrediente WHERE ingrediente_id = %s",
            (id_ingrediente,))["total"][0])
        em_listas = int(self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM item_lista_compras WHERE ingrediente_id = %s",
            (id_ingrediente,))["total"][0])

        if not confirmar(f"Remover o ingrediente {id_ingrediente}?"):
            print("Remoção cancelada.")
            return

        comandos = []
        if em_receitas or em_listas:
            print(f"Ele aparece em {em_receitas} receita(s) e {em_listas} item(ns) de lista de compras.")
            if not confirmar("Remover também esses registros?"):
                print("Remoção cancelada: o ingrediente está em uso.")
                return
            comandos += [
                ("DELETE FROM receita_ingrediente WHERE ingrediente_id = %s", (id_ingrediente,)),
                ("DELETE FROM item_lista_compras WHERE ingrediente_id = %s", (id_ingrediente,)),
            ]
        comandos.append(("DELETE FROM ingrediente WHERE id = %s", (id_ingrediente,)))
        self.db.write_many(comandos)
        print("Ingrediente removido.")

    def atualizar(self):
        id_ingrediente = escolher_registro(self.db, "INGREDIENTES", SQL_LISTA)
        if id_ingrediente is None:
            return
        nome = ler_texto("Novo nome: ")
        if self._nome_em_uso(nome, id_ingrediente):
            print("Já existe outro ingrediente com esse nome.")
            return
        categoria = ler_texto("Nova categoria: ", obrigatorio=False) or None
        unidade = ler_texto("Nova unidade padrão: ")
        validade = ler_inteiro("Nova validade média em dias (ENTER para vazio): ", obrigatorio=False)
        preco = ler_decimal("Novo preço médio (ENTER para vazio): ", obrigatorio=False)

        self.db.write(
            """UPDATE ingrediente SET nome = %s, categoria = %s, unidade_padrao = %s,
                      validade_media_dias = %s, preco_medio = %s WHERE id = %s""",
            (nome, categoria, unidade, validade, preco, id_ingrediente))
        print("\nRegistro atualizado:")
        print(self.db.sqlToDataFrame(
            "SELECT * FROM ingrediente WHERE id = %s", (id_ingrediente,)).to_string(index=False))
