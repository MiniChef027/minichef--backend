SELECT 
    u.nome AS autor, 
    COUNT(r.id) AS total_receitas_publicadas
FROM usuario u
JOIN receita r ON u.id = r.autor_id
GROUP BY u.nome
ORDER BY total_receitas_publicadas DESC;