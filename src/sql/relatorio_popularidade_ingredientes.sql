SELECT 
    i.nome AS ingrediente, 
    COUNT(ri.id) AS total_receitas_que_utilizam
FROM ingrediente i
JOIN receita_ingrediente ri ON i.id = ri.ingrediente_id
GROUP BY i.nome
ORDER BY total_receitas_que_utilizam DESC;