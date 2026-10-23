from conexion.pg_queries import PtgreSQLQueries
from model.Usuario import Usuario

class ControllerUsuario:
    def __init__(self):
        pass

    def usuario_existe(self, db: PtgreSQLQueries, id_usuario: int) -> bool:
        """Verifica se o utilizador existe na base de dados pelo ID."""
        query = f"SELECT count(1) AS total FROM usuario WHERE id = {id_usuario};"
        resultado = db.sqlToDataFrame(query)
        return int(resultado['total'].values[0]) > 0

    def usuario_existe_por_email(self, db: PtgreSQLQueries, email: str) -> bool:
        """Verifica se já existe um utilizador registado com o mesmo e-mail."""
        query = f"SELECT count(1) AS total FROM usuario WHERE LOWER(email) = LOWER('{email}');"
        resultado = db.sqlToDataFrame(query)
        return int(resultado['total'].values[0]) > 0

    def usuario_existe_por_cpf(self, db: PtgreSQLQueries, cpf: str) -> bool:
        """Verifica se já existe um utilizador registado com o mesmo CPF."""
        query = f"SELECT count(1) AS total FROM usuario WHERE cpf = '{cpf}';"
        resultado = db.sqlToDataFrame(query)
        return int(resultado['total'].values[0]) > 0

    def buscar_usuario_por_id(self, db: PtgreSQLQueries, id_usuario: int) -> Usuario:
        """Retorna uma instância da classe Usuario com base no ID."""
        query = f"SELECT id, nome, email, tipo_conta FROM usuario WHERE id = {id_usuario};"
        df = db.sqlToDataFrame(query)
        if not df.empty:
            return Usuario(
                id_usuario=int(df['id'].values[0]),
                nome=str(df['nome'].values[0]),
                email=str(df['email'].values[0]),
                tipo_conta=str(df['tipo_conta'].values[0])
            )
        return None

    def inserir_usuario(self) -> Usuario:
        db = PtgreSQLQueries(can_write=True)

        print("\n--- INSERIR NOVO UTILIZADOR ---")
        email = input("E-mail do utilizador: ").strip()

        # Validação de existência para manter a integridade
        if self.usuario_existe_por_email(db, email):
            print(f"Erro: Já existe um utilizador registado com o e-mail '{email}'.")
            return None

        cpf = input("CPF do utilizador (ex: 123.456.789-00): ").strip()
        if self.usuario_existe_por_cpf(db, cpf):
            print(f"Erro: Já existe um utilizador registado com o CPF '{cpf}'.")
            return None

        nome = input("Nome do utilizador: ").strip()
        data_nascimento = input("Data de Nascimento (AAAA-MM-DD): ").strip()
        senha = input("Palavra-passe (hash/texto): ").strip()
        
        print("Tipos de Conta disponíveis: 'Usuário comum', 'Chef de cozinha', 'Hotel', 'Restaurante', 'Personal Trainer', 'Nutricionista', 'Administrador de eventos', 'Mercado'")
        tipo_conta = input("Tipo de Conta: ").strip() or "Usuário comum"

        query = f"""
            INSERT INTO usuario (nome, email, data_nascimento, cpf, senha_hash, tipo_conta)
            VALUES ('{nome}', '{email}', '{data_nascimento}', '{cpf}', '{senha}', '{tipo_conta}')
            RETURNING id;
        """
        resultado = db.write(query)
        novo_id = resultado[0][0]
        print(f"Utilizador '{nome}' registado com sucesso! ID: {novo_id}")
        
        return Usuario(novo_id, nome, email, tipo_conta)

    def atualizar_usuario(self):
        db = PtgreSQLQueries(can_write=True)

        print("\n--- ATUALIZAR UTILIZADOR ---")
        id_usuario = int(input("Informe o ID do utilizador que deseja alterar: "))

        if not self.usuario_existe(db, id_usuario):
            print(f"Erro: Não foi encontrado nenhum utilizador com o ID {id_usuario}.")
            return

        novo_nome = input("Novo Nome: ").strip()
        novo_email = input("Novo E-mail: ").strip()
        novo_tipo = input("Novo Tipo de Conta: ").strip()

        query_update = f"""
            UPDATE usuario 
            SET nome = '{novo_nome}', 
                email = '{novo_email}', 
                tipo_conta = '{novo_tipo}'
            WHERE id = {id_usuario};
        """
        db.write(query_update)

        # Exibe o registo atualizado
        usuario_atualizado = self.buscar_usuario_por_id(db, id_usuario)
        print("\nRegisto Atualizado:")
        print(usuario_atualizado.to_string())

    def excluir_usuario(self):
        db = PtgreSQLQueries(can_write=True)

        print("\n--- REMOVER UTILIZADOR ---")
        id_usuario = int(input("Informe o ID do utilizador que deseja remover: "))

        if not self.usuario_existe(db, id_usuario):
            print(f"Erro: Não foi encontrado nenhum utilizador com o ID {id_usuario}.")
            return

        # Verificação de Chave Estrangeira (FK) nas tabelas dependentes
        query_fk_receita = f"SELECT count(1) AS total FROM receita WHERE autor_id = {id_usuario};"
        query_fk_planner = f"SELECT count(1) AS total FROM planner_semanal WHERE usuario_id = {id_usuario};"

        total_receitas = int(db.sqlToDataFrame(query_fk_receita)['total'].values[0])
        total_planners = int(db.sqlToDataFrame(query_fk_planner)['total'].values[0])

        if total_receitas > 0 or total_planners > 0:
            print(f"Erro: O utilizador ID {id_usuario} não pode ser removido pois possui {total_receitas} receita(s) e {total_planners} planner(s) associado(s).")
            return

        confirmacao = input(f"Tem a certeza de que deseja remover o utilizador ID {id_usuario}? (S/N): ").strip().upper()
        if confirmacao == 'S':
            query_delete = f"DELETE FROM usuario WHERE id = {id_usuario};"
            db.write(query_delete)
            print("Utilizador removido com sucesso!")
        else:
            print("Operação cancelada.")