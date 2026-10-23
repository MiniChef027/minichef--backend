class ListaCompras:
    def __init__(self, id_lista, planner, total_estimado, gerada_em):
        self._id = id_lista
        self._planner = planner  # Instância de PlannerSemanal
        self._total_estimado = total_estimado
        self._gerada_em = gerada_em

    # Getters
    def get_id(self): 
        return self._id
    
    def get_planner(self): 
        return self._planner
    
    def get_total_estimado(self): 
        return self._total_estimado
    
    def get_gerada_em(self): 
        return self._gerada_em

    # Setters
    def set_id(self, id_lista): 
        self._id = id_lista
    
    def set_planner(self, planner): 
        self._planner = planner
    
    def set_total_estimado(self, total_estimado): 
        self._total_estimado = total_estimado
    
    def set_gerada_em(self, gerada_em): 
        self._gerada_em = gerada_em

    def to_string(self):
        return f"Lista de Compras (ID: {self._id}) | Gerada em: {self._gerada_em} | Total Est.: {self._total_estimado}"