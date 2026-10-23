SELECT 
    r.nome AS receita, 
    i.nome AS ingrediente, 
    ri.quantidade, 
    ri.unidade, 
    ri.papel
FROM receita_ingrediente ri
JOIN receita r ON ri.receita_id = r.id
JOIN ingrediente i ON ri.ingrediente_id = i.id
ORDER BY r.nome, ri.papel;