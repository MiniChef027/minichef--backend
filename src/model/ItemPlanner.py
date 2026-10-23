class ItemPlanner:
    def __init__(self, id_item, planner, receita, dia_semana, refeicao, porcoes_desejadas):
        self._id = id_item
        self._planner = planner  # Instância de PlannerSemanal
        self._receita = receita  # Instância de Receita
        self._dia_semana = dia_semana
        self._refeicao = refeicao
        self._porcoes_desejadas = porcoes_desejadas

    # Getters
    def get_id(self): 
        return self._id
    
    def get_planner(self): 
        return self._planner
    
    def get_receita(self): 
        return self._receita
    
    def get_dia_semana(self): 
        return self._dia_semana
    
    def get_refeicao(self): 
        return self._refeicao
    
    def get_porcoes_desejadas(self): 
        return self._porcoes_desejadas

    # Setters
    def set_id(self, id_item): 
        self._id = id_item
    
    def set_planner(self, planner): 
        self._planner = planner
    
    def set_receita(self, receita): 
        self._receita = receita
    
    def set_dia_semana(self, dia_semana): 
        self._dia_semana = dia_semana
    
    def set_refeicao(self, refeicao): 
        self._refeicao = refeicao
    
    def set_porcoes_desejadas(self, porcoes): 
        self._porcoes_desejadas = porcoes

    def to_string(self):
        return f"Item Planner (ID: {self._id}) | {self._dia_semana} - {self._refeicao}: {self._receita.get_nome()} ({self._porcoes_desejadas} porções)"