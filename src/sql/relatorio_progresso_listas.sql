SELECT 
    lista_compras_id,
    SUM(CASE WHEN comprado = TRUE THEN 1 ELSE 0 END) AS itens_comprados,
    SUM(CASE WHEN comprado = FALSE THEN 1 ELSE 0 END) AS itens_pendentes
FROM item_lista_compras
GROUP BY lista_compras_id
ORDER BY lista_compras_id;