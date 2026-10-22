from conexion.pg_queries import PtgreSQLQueries  # Classe de conexão PostgreSQL do seu projeto
from model.Ingrediente import Ingrediente

class ControllerIngrediente:
    def __init__(self):
        pass

    def ingrediente_existe(self, db: PtgreSQLQueries, id_ingrediente: int) -> bool:
        """Verifica se o ingrediente existe na base de dados pelo ID."""
        query = f"SELECT count(1) AS total FROM ingrediente WHERE id = {id_ingrediente};"
        resultado = db.sqlToDataFrame(query)
        return int(resultado['total'].values[0]) > 0

    def ingrediente_existe_por_nome(self, db: PtgreSQLQueries, nome: str) -> bool:
        """Verifica se já existe um ingrediente com o mesmo nome (case-insensitive)."""
        query = f"SELECT count(1) AS total FROM ingrediente WHERE LOWER(nome) = LOWER('{nome}');"
        resultado = db.sqlToDataFrame(query)
        return int(resultado['total'].values[0]) > 0

    def inserir_ingrediente(self) -> Ingrediente:
        db = PtgreSQLQueries(can_write=True)

        print("\n--- INSERIR NOVO INGREDIENTE ---")
        nome = input("Nome do ingrediente: ").strip()

        # Validação de existência para manter a integridade
        if self.ingrediente_existe_por_nome(db, nome):
            print(f"Erro: Já existe um ingrediente cadastrado com o nome '{nome}'.")
            return None

        categoria = input("Categoria (ex: Vegetal, Laticínio): ").strip()
        unidade_padrao = input("Unidade padrão (ex: kg, g, ml, un): ").strip()
        validade_dias = input("Validade média em dias (pressione ENTER se nulo): ").strip()
        preco_medio = input("Preço médio (pressione ENTER se nulo): ").strip()

        val_sql = validade_dias if validade_dias.isdigit() else "NULL"
        preco_sql = preco_medio.replace(',', '.') if preco_medio else "NULL"

        # Concatenação da instrução SQL sem ORM
        query = f"""
            INSERT INTO ingrediente (nome, categoria, unidade_padrao, validade_media_dias, preco_medio)
            VALUES ('{nome}', '{categoria}', '{unidade_padrao}', {val_sql}, {preco_sql})
            RETURNING id, nome, categoria, unidade_padrao, validade_media_dias, preco_medio;
        """
        
        resultado = db.write(query)
        print("Ingrediente cadastrado com sucesso!")
        
        # Retorna a instância criada usando a classe do modelo
        novo_id = resultado[0][0]
        return Ingrediente(novo_id, nome, categoria, unidade_padrao, val_sql, preco_sql)

    def atualizar_ingrediente(self):
        db = PtgreSQLQueries(can_write=True)

        print("\n--- ATUALIZAR INGREDIENTE ---")
        id_ingrediente = int(input("Informe o ID do ingrediente que deseja alterar: "))

        # Verifica se o registo existe antes de alterar
        if not self.ingrediente_existe(db, id_ingrediente):
            print(f"Erro: Não foi encontrado nenhum ingrediente com o ID {id_ingrediente}.")
            return

        novo_nome = input("Novo Nome: ").strip()
        nova_categoria = input("Nova Categoria: ").strip()
        nova_unidade = input("Nova Unidade Padrão: ").strip()

        query_update = f"""
            UPDATE ingrediente 
            SET nome = '{novo_nome}', 
                categoria = '{nova_categoria}', 
                unidade_padrao = '{nova_unidade}'
            WHERE id = {id_ingrediente};
        """
        db.write(query_update)

        # Recupera e exibe o registo atualizado
        query_select = f"SELECT id, nome, categoria, unidade_padrao, validade_media_dias, preco_medio FROM ingrediente WHERE id = {id_ingrediente};"
        df = db.sqlToDataFrame(query_select)
        
        ingrediente_atualizado = Ingrediente(
            df['id'].values[0], df['nome'].values[0], df['categoria'].values[0],
            df['unidade_padrao'].values[0], df['validade_media_dias'].values[0], df['preco_medio'].values[0]
        )
        
        print("\nRegisto Atualizado:")
        print(ingrediente_atualizado.to_string())

    def excluir_ingrediente(self):
        db = PtgreSQLQueries(can_write=True)

        print("\n--- REMOVER INGREDIENTE ---")
        id_ingrediente = int(input("Informe o ID do ingrediente que deseja remover: "))

        if not self.ingrediente_existe(db, id_ingrediente):
            print(f"Erro: Não foi encontrado nenhum ingrediente com o ID {id_ingrediente}.")
            return

        # Verificação de Chave Estrangeira (FK) nas tabelas dependentes
        query_fk_receita = f"SELECT count(1) AS total FROM receita_ingrediente WHERE ingrediente_id = {id_ingrediente};"
        query_fk_lista = f"SELECT count(1) AS total FROM item_lista_compras WHERE ingrediente_id = {id_ingrediente};"
        
        total_receitas = int(db.sqlToDataFrame(query_fk_receita)['total'].values[0])
        total_listas = int(db.sqlToDataFrame(query_fk_lista)['total'].values[0])

        if total_receitas > 0 or total_listas > 0:
            print(f"Erro: O ingrediente ID {id_ingrediente} não pode ser removido pois está associado a receitas ou listas de compras existentes.")
            return

        confirmacao = input(f"Tem a certeza de que deseja remover o ingrediente ID {id_ingrediente}? (S/N): ").strip().upper()
        if confirmacao == 'S':
            query_delete = f"DELETE FROM ingrediente WHERE id = {id_ingrediente};"
            db.write(query_delete)
            print("Ingrediente removido com sucesso!")
        else:
            print("Operação cancelada.")