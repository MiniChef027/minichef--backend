class Ingrediente:
    def __init__(self, id_ingrediente, nome, categoria, unidade_padrao, validade_media_dias, preco_medio):
        self._id = id_ingrediente
        self._nome = nome
        self._categoria = categoria
        self._unidade_padrao = unidade_padrao
        self._validade_media_dias = validade_media_dias
        self._preco_medio = preco_medio

    # Getters
    def get_id(self): 
        return self._id
    
    def get_nome(self): 
        return self._nome
    
    def get_categoria(self): 
        return self._categoria
    
    def get_unidade_padrao(self): 
        return self._unidade_padrao

    def get_validade_media_dias(self): 
        return self._validade_media_dias

    def get_preco_medio(self): 
        return self._preco_medio

    # Setters
    def set_id(self, id_ingrediente): 
        self._id = id_ingrediente

    def set_nome(self, nome): 
        self._nome = nome

    def set_categoria(self, categoria): 
        self._categoria = categoria

    def set_unidade_padrao(self, unidade_padrao): 
        self._unidade_padrao = unidade_padrao

    def set_validade_media_dias(self, validade_media_dias): 
        self._validade_media_dias = validade_media_dias

    def set_preco_medio(self, preco_medio): 
        self._preco_medio = preco_medio

    def to_string(self):
        return f"Ingrediente: {self._nome} (ID: {self._id}) | Unidade: {self._unidade_padrao} | Categoria: {self._categoria}"