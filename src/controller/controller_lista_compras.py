from utils.entrada import confirmar, escolher_registro

SQL_PLANNERS = """SELECT p.id, u.nome AS usuario, p.semana_inicio
                  FROM planner_semanal p JOIN usuario u ON u.id = p.usuario_id
                  ORDER BY p.id"""
SQL_LISTAS = """SELECT l.id, l.planner_id, to_char(l.gerada_em, 'DD/MM/YYYY HH24:MI') AS gerada_em
                FROM lista_compras l ORDER BY l.id"""
SQL_ITENS = """SELECT i.id, g.nome AS ingrediente, i.quantidade, i.unidade,
                      CASE WHEN i.comprado THEN 'comprado' ELSE 'pendente' END AS situacao
               FROM item_lista_compras i JOIN ingrediente g ON g.id = i.ingrediente_id
               WHERE i.lista_compras_id = %s ORDER BY i.id"""


class ControllerListaCompras:
    def __init__(self, db):
        self.db = db

    def inserir(self):
        """Gera uma lista de compras somando os ingredientes das refeições de um planner."""
        print("\n--- GERAR LISTA DE COMPRAS ---")
        id_planner = escolher_registro(self.db, "PLANNERS", SQL_PLANNERS)
        if id_planner is None:
            return
        # cada ingrediente é proporcional às porções desejadas na refeição
        resultado = self.db.write_many([
            ("INSERT INTO lista_compras (planner_id) VALUES (%s) RETURNING id", (id_planner,)),
        ])
        id_lista = resultado[0][0][0]
        self.db.write(
            """INSERT INTO item_lista_compras (lista_compras_id, ingrediente_id, quantidade, unidade)
               SELECT %s, ri.ingrediente_id,
                      SUM(ri.quantidade / r.porcao_padrao * ip.porcoes_desejadas), ri.unidade
               FROM item_planner ip
               JOIN receita r ON r.id = ip.receita_id
               JOIN receita_ingrediente ri ON ri.receita_id = r.id
               WHERE ip.planner_id = %s
               GROUP BY ri.ingrediente_id, ri.unidade""", (id_lista, id_planner))
        print(f"Lista {id_lista} gerada. Itens:")
        print(self.db.sqlToDataFrame(SQL_ITENS, (id_lista,)).to_string(index=False))

    def remover(self):
        id_lista = escolher_registro(self.db, "LISTAS DE COMPRAS", SQL_LISTAS)
        if id_lista is None:
            return
        itens = int(self.db.sqlToDataFrame(
            "SELECT count(1) AS total FROM item_lista_compras WHERE lista_compras_id = %s",
            (id_lista,))["total"][0])
        if not confirmar(f"Remover a lista {id_lista}?"):
            print("Remoção cancelada.")
            return
        if itens and not confirmar(f"Ela tem {itens} item(ns). Remover também os itens?"):
            print("Remoção cancelada: a lista tem itens.")
            return
        self.db.write("DELETE FROM lista_compras WHERE id = %s", (id_lista,))
        print("Lista removida.")

    def atualizar(self):
        """Marca ou desmarca um item da lista como comprado."""
        id_lista = escolher_registro(self.db, "LISTAS DE COMPRAS", SQL_LISTAS)
        if id_lista is None:
            return
        id_item = escolher_registro(self.db, f"ITENS DA LISTA {id_lista}", SQL_ITENS, (id_lista,))
        if id_item is None:
            return
        self.db.write("UPDATE item_lista_compras SET comprado = NOT comprado WHERE id = %s", (id_item,))
        print("\nItem atualizado:")
        print(self.db.sqlToDataFrame(SQL_ITENS, (id_lista,)).query("id == @id_item").to_string(index=False))
