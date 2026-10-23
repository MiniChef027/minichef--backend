SELECT 
    refeicao, 
    SUM(porcoes_desejadas) AS total_porcoes_planeadas
FROM item_planner
GROUP BY refeicao
ORDER BY total_porcoes_planeadas DESC;