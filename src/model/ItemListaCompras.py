class ItemListaCompras:
    def __init__(self, id_item_lista, lista_compras, ingrediente, quantidade, unidade, custo_estimado, comprado):
        self._id = id_item_lista
        self._lista_compras = lista_compras  # Instância de ListaCompras
        self._ingrediente = ingrediente      # Instância de Ingrediente
        self._quantidade = quantidade
        self._unidade = unidade
        self._custo_estimado = custo_estimado
        self._comprado = comprado

    # Getters
    def get_id(self): 
        return self._id
    
    def get_lista_compras(self): 
        return self._lista_compras
    
    def get_ingrediente(self): 
        return self._ingrediente
    
    def get_quantidade(self): 
        return self._quantidade
    
    def get_unidade(self): 
        return self._unidade
    
    def get_custo_estimado(self): 
        return self._custo_estimado
    
    def get_comprado(self): 
        return self._comprado

    # Setters
    def set_id(self, id_item_lista): 
        self._id = id_item_lista
    
    def set_lista_compras(self, lista_compras): 
        self._lista_compras = lista_compras
    
    def set_ingrediente(self, ingrediente): 
        self._ingrediente = ingrediente
    
    def set_quantidade(self, quantidade): 
        self._quantidade = quantidade
    
    def set_unidade(self, unidade): 
        self._unidade = unidade
    
    def set_custo_estimado(self, custo_estimado): 
        self._custo_estimado = custo_estimado
    
    def set_comprado(self, comprado): 
        self._comprado = comprado

    def to_string(self):
        estado = "Comprado" if self._comprado else "Pendente"
        return f"Item Compra (ID: {self._id}) | {self._ingrediente.get_nome()} - {self._quantidade} {self._unidade} | Estado: {estado}"