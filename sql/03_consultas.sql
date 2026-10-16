-- =====================================================================
-- MiniChef | Banco de Dados Relacional (PostgreSQL)
-- Script 03: consultas usadas pelo programa
--
-- O programa monta estes textos SQL por concatenação (sem ORM). Onde
-- aparece o valor 1 como identificador, o programa troca pelo id
-- escolhido pelo usuário.
-- =====================================================================

-- =====================================================================
-- RELATÓRIOS
-- =====================================================================

-- R1 | Agrupamento: receitas por refeição recomendada
SELECT COALESCE(r.refeicao_recomendada, 'Não informada')  AS refeicao,
       COUNT(1)                                           AS total_receitas,
       ROUND(AVG(r.tempo_medio_gasto_min), 1)             AS tempo_medio_min,
       ROUND(AVG(r.orcamento_estimado), 2)                AS orcamento_medio
  FROM receita r
 GROUP BY r.refeicao_recomendada
 ORDER BY total_receitas DESC, refeicao;

-- R2 | Junção: ficha de ingredientes de cada receita
SELECT r.id AS receita_id, r.nome AS receita, u.nome AS autor,
       i.nome AS ingrediente, ri.quantidade, ri.unidade, ri.papel
  FROM receita r
  JOIN usuario u              ON u.id = r.autor_id
  JOIN receita_ingrediente ri ON ri.receita_id = r.id
  JOIN ingrediente i          ON i.id = ri.ingrediente_id
 ORDER BY r.id, ri.id;

-- R3 | Agrupamento com junção: ingredientes mais usados em receitas
SELECT i.nome AS ingrediente, COUNT(DISTINCT ri.receita_id) AS qtd_receitas
  FROM ingrediente i
  JOIN receita_ingrediente ri ON ri.ingrediente_id = i.id
 GROUP BY i.nome
 ORDER BY qtd_receitas DESC, i.nome;

-- R4 | Junção: planner semanal (planner id = 1)
SELECT p.semana_inicio, ip.dia_semana, ip.refeicao,
       r.nome AS receita, r.porcao_padrao, ip.porcoes_desejadas
  FROM planner_semanal p
  JOIN item_planner ip ON ip.planner_id = p.id
  JOIN receita r       ON r.id = ip.receita_id
 WHERE p.id = 1
 ORDER BY ARRAY_POSITION(ARRAY['segunda','terça','quarta','quinta','sexta','sábado','domingo'], ip.dia_semana),
          ip.id;

-- =====================================================================
-- CALCULADORA DE PORÇÕES (itens do planner id = 1)
-- quantidade ajustada = quantidade base x porções desejadas / porção padrão
-- O resultado é calculado na consulta e não é gravado.
-- =====================================================================
SELECT ip.id AS item_planner_id, r.nome AS receita, i.nome AS ingrediente,
       ri.quantidade AS qtd_base, r.porcao_padrao, ip.porcoes_desejadas,
       ROUND(ri.quantidade * ip.porcoes_desejadas / r.porcao_padrao, 2) AS qtd_ajustada,
       ri.unidade
  FROM item_planner ip
  JOIN receita r              ON r.id = ip.receita_id
  JOIN receita_ingrediente ri ON ri.receita_id = r.id
  JOIN ingrediente i          ON i.id = ri.ingrediente_id
 WHERE ip.planner_id = 1
 ORDER BY ip.id, ri.id;

-- =====================================================================
-- GERAÇÃO DA LISTA DE COMPRAS (planner id = 1)
-- Regras:
--   * soma as quantidades ajustadas por ingrediente e unidade;
--   * ingredientes com papel 'Opcional' não entram;
--   * unidades contáveis ('unidade', 'dente') arredondam para cima,
--     as demais ficam com 2 casas decimais;
--   * custo_estimado e total_estimado ficam NULL até existir preço.
-- Executar os dois INSERT na mesma transação.
-- =====================================================================
BEGIN;

INSERT INTO lista_compras (planner_id) VALUES (1) RETURNING id;   -- o programa guarda este id

INSERT INTO item_lista_compras (lista_compras_id, ingrediente_id, quantidade, unidade)
SELECT 1,                                        -- id retornado acima
       ri.ingrediente_id,
       CASE WHEN ri.unidade IN ('unidade', 'dente')
            THEN CEIL(SUM(ri.quantidade * ip.porcoes_desejadas / r.porcao_padrao))
            ELSE ROUND(SUM(ri.quantidade * ip.porcoes_desejadas / r.porcao_padrao), 2)
       END,
       ri.unidade
  FROM item_planner ip
  JOIN receita r              ON r.id = ip.receita_id
  JOIN receita_ingrediente ri ON ri.receita_id = r.id
 WHERE ip.planner_id = 1
   AND ri.papel <> 'Opcional'
 GROUP BY ri.ingrediente_id, ri.unidade;

COMMIT;

-- Lista gerada (lista id = 1)
SELECT i.nome AS ingrediente, l.quantidade, l.unidade,
       CASE WHEN l.comprado THEN 'sim' ELSE 'não' END AS comprado
  FROM item_lista_compras l
  JOIN ingrediente i ON i.id = l.ingrediente_id
 WHERE l.lista_compras_id = 1
 ORDER BY i.nome;

-- =====================================================================
-- TELA INICIAL: total de registros por tabela
-- =====================================================================
SELECT COUNT(1) AS total_usuario             FROM usuario;
SELECT COUNT(1) AS total_ingrediente         FROM ingrediente;
SELECT COUNT(1) AS total_receita             FROM receita;
SELECT COUNT(1) AS total_receita_ingrediente FROM receita_ingrediente;
SELECT COUNT(1) AS total_planner_semanal     FROM planner_semanal;
SELECT COUNT(1) AS total_item_planner        FROM item_planner;
SELECT COUNT(1) AS total_lista_compras       FROM lista_compras;
SELECT COUNT(1) AS total_item_lista_compras  FROM item_lista_compras;

-- =====================================================================
-- REMOÇÃO: contar registros filhos ANTES de excluir o pai (id = 1)
-- Se o total for maior que zero, o programa avisa ou pergunta se
-- remove os filhos, conforme a regra de cada relacionamento.
-- =====================================================================
-- usuario
SELECT COUNT(1) AS receitas_autor     FROM receita         WHERE autor_id = 1;      -- bloqueia
SELECT COUNT(1) AS receitas_moderadas FROM receita         WHERE moderador_id = 1;  -- bloqueia
SELECT COUNT(1) AS planners           FROM planner_semanal WHERE usuario_id = 1;    -- remove junto
-- ingrediente
SELECT COUNT(1) AS em_receitas        FROM receita_ingrediente WHERE ingrediente_id = 1;  -- bloqueia
SELECT COUNT(1) AS em_listas          FROM item_lista_compras  WHERE ingrediente_id = 1;  -- bloqueia
-- receita
SELECT COUNT(1) AS ingredientes       FROM receita_ingrediente WHERE receita_id = 1;  -- remove junto
SELECT COUNT(1) AS em_planners        FROM item_planner        WHERE receita_id = 1;  -- bloqueia
-- planner_semanal
SELECT COUNT(1) AS itens_planner      FROM item_planner  WHERE planner_id = 1;  -- remove junto
SELECT COUNT(1) AS listas             FROM lista_compras WHERE planner_id = 1;  -- remove junto
-- lista_compras
SELECT COUNT(1) AS itens_lista        FROM item_lista_compras WHERE lista_compras_id = 1;  -- remove junto
