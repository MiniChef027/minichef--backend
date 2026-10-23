SELECT 
    r.nome AS nome_receita, 
    r.status, 
    r.tempo_medio_gasto_min, 
    u.nome AS autor, 
    u.tipo_conta
FROM receita r
JOIN usuario u ON r.autor_id = u.id
ORDER BY r.status, r.nome;