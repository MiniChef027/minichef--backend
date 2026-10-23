SELECT 
    u.nome AS utilizador, 
    ps.semana_inicio, 
    ip.dia_semana, 
    ip.refeicao, 
    r.nome AS receita_agendada, 
    ip.porcoes_desejadas
FROM planner_semanal ps
JOIN usuario u ON ps.usuario_id = u.id
JOIN item_planner ip ON ps.id = ip.planner_id
JOIN receita r ON ip.receita_id = r.id
ORDER BY ps.semana_inicio, ip.dia_semana, ip.refeicao;