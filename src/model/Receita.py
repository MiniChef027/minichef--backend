class Receita:
    def __init__(self, id_receita, nome, porcao_padrao, modo_preparo, autor):
        self._id = id_receita
        self._nome = nome
        self._porcao_padrao = porcao_padrao
        self._modo_preparo = modo_preparo
        # O atributo recebe a instância do objeto Usuario
        self._autor = autor 

    # Getters
    def get_id(self):
        return self._id

    def get_nome(self):
        return self._nome

    def get_porcao_padrao(self):
        return self._porcao_padrao

    def get_modo_preparo(self):
        return self._modo_preparo

    def get_autor(self):
        return self._autor

    # Setters
    def set_id(self, id_receita):
        self._id = id_receita

    def set_nome(self, nome):
        self._nome = nome

    def set_porcao_padrao(self, porcao_padrao):
        self._porcao_padrao = porcao_padrao

    def set_modo_preparo(self, modo_preparo):
        self._modo_preparo = modo_preparo

    def set_autor(self, autor):
        self._autor = autor

    # Método to_string
    def to_string(self):
        return f"Receita: {self._nome} (ID: {self._id}) | Porções: {self._porcao_padrao}\nAutor -> [{self._autor.to_string()}]"