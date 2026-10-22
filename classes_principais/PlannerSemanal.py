class PlannerSemanal:
    def __init__(self, id_planner, usuario, semana_inicio, orcamento_definido):
        self._id = id_planner
        self._usuario = usuario  # Instância de Usuario
        self._semana_inicio = semana_inicio
        self._orcamento_definido = orcamento_definido

    # Getters
    def get_id(self): 
        return self._id
    
    def get_usuario(self): 
        return self._usuario
    
    def get_semana_inicio(self): 
        return self._semana_inicio
    
    def get_orcamento_definido(self): 
        return self._orcamento_definido

    # Setters
    def set_id(self, id_planner): 
        self._id = id_planner
    
    def set_usuario(self, usuario): 
        self._usuario = usuario
    
    def set_semana_inicio(self, semana_inicio): 
        self._semana_inicio = semana_inicio
    
    def set_orcamento_definido(self, orcamento_definido): 
        self._orcamento_definido = orcamento_definido

    def to_string(self):
        return f"Planner (ID: {self._id}) | Início: {self._semana_inicio} | Utilizador: {self._usuario.get_nome()}"