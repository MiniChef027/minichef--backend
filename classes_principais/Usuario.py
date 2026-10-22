class Usuario:
    def __init__(self, id_usuario, nome, email, tipo_conta):
        self._id = id_usuario
        self._nome = nome
        self._email = email
        self._tipo_conta = tipo_conta

    # Getters
    def get_id(self):
        return self._id

    def get_nome(self):
        return self._nome

    def get_email(self):
        return self._email

    def get_tipo_conta(self):
        return self._tipo_conta

    # Setters
    def set_id(self, id_usuario):
        self._id = id_usuario

    def set_nome(self, nome):
        self._nome = nome

    def set_email(self, email):
        self._email = email

    def set_tipo_conta(self, tipo_conta):
        self._tipo_conta = tipo_conta

    # Método to_string
    def to_string(self):
        return f"ID: {self._id} | Nome: {self._nome} | Email: {self._email} | Tipo: {self._tipo_conta}"