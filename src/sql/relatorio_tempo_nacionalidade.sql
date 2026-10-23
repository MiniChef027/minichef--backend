SELECT 
    COALESCE(nacionalidade, 'Não informada') AS nacionalidade, 
    ROUND(AVG(tempo_medio_gasto_min), 2) AS tempo_medio_minutos
FROM receita
GROUP BY nacionalidade
ORDER BY tempo_medio_minutos ASC;