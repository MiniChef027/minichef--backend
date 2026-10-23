SELECT 
    lc.id AS id_lista, 
    lc.gerada_em, 
    i.categoria, 
    i.nome AS ingrediente, 
    ilc.quantidade, 
    ilc.unidade, 
    CASE WHEN ilc.comprado THEN 'Sim' ELSE 'Não' END AS ja_comprado
FROM lista_compras lc
JOIN item_lista_compras ilc ON lc.id = ilc.lista_compras_id
JOIN ingrediente i ON ilc.ingrediente_id = i.id
ORDER BY lc.id, i.categoria, i.nome;