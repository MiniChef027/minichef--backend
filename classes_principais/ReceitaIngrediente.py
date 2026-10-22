class ReceitaIngrediente:
    def __init__(self, id_ri, receita, ingrediente, quantidade, unidade, papel, visibilidade):
        self._id = id_ri
        self._receita = receita          # Instância de Receita
        self._ingrediente = ingrediente  # Instância de Ingrediente
        self._quantidade = quantidade
        self._unidade = unidade
        self._papel = papel
        self._visibilidade = visibilidade

    # Getters
    def get_id(self): 
        return self._id
    
    def get_receita(self): 
        return self._receita
    
    def get_ingrediente(self): 
        return self._ingrediente
    
    def get_quantidade(self): 
        return self._quantidade
    
    def get_unidade(self): 
        return self._unidade
    
    def get_papel(self): 
        return self._papel
    
    def get_visibilidade(self): 
        return self._visibilidade

    # Setters
    def set_id(self, id_ri): 
        self._id = id_ri
    
    def set_receita(self, receita): 
        self._receita = receita
    
    def set_ingrediente(self, ingrediente): 
        self._ingrediente = ingrediente
    
    def set_quantidade(self, quantidade): 
        self._quantidade = quantidade
    
    def set_unidade(self, unidade): 
        self._unidade = unidade
    
    def set_papel(self, papel): 
        self._papel = papel
    
    def set_visibilidade(self, visibilidade): 
        self._visibilidade = visibilidade

    def to_string(self):
        return f"Associação ID: {self._id} | Receita: {self._receita.get_nome()} | Ingrediente: {self._ingrediente.get_nome()} | Qtd: {self._quantidade} {self._unidade}"