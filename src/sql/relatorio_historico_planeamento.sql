SELECT 
    u.nome AS utilizador, 
    ps.semana_inicio AS inicio_semana_planeada, 
    lc.id AS id_lista_compras, 
    lc.gerada_em AS data_geracao_lista
FROM usuario u
JOIN planner_semanal ps ON u.id = ps.usuario_id
JOIN lista_compras lc ON ps.id = lc.planner_id
ORDER BY u.nome, ps.semana_inicio;