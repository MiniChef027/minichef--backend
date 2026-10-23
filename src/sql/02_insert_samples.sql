-- =====================================================================
-- MiniChef | Banco de Dados Relacional (PostgreSQL)
-- Script 02: registros de exemplo
--
-- TODOS OS DADOS SÃO FICTÍCIOS: pessoas, CPFs, e-mails, quantidades e
-- custos servem apenas para demonstrar o funcionamento do sistema.
-- As colunas marcadas como [FUTURO] no script 01 ficam vazias (NULL).
-- Executar depois de 01_create_tables.sql.
-- =====================================================================

-- usuario (senha_hash fictício; o programa grava o hash real da senha)
INSERT INTO usuario (nome, email, email_confirmado, data_nascimento, cpf, senha_hash, tipo_conta, perfil_acesso) VALUES
('Admin MiniChef',  'admin@exemplo.com',  TRUE,  '1995-03-10', '000.000.000-01', 'hash_ilustrativo', 'Usuário comum',   'administrador'),
('Ana Exemplo',     'ana@exemplo.com',    TRUE,  '2001-07-22', '000.000.000-02', 'hash_ilustrativo', 'Usuário comum',   'comum'),
('Bruno Exemplo',   'bruno@exemplo.com',  TRUE,  '1998-11-05', '000.000.000-03', 'hash_ilustrativo', 'Chef de cozinha', 'comum'),
('Carla Exemplo',   'carla@exemplo.com',  FALSE, '2003-01-30', '000.000.000-04', 'hash_ilustrativo', 'Usuário comum',   'comum');

-- ingrediente (preco_medio fica NULL: orçamento é funcionalidade futura)
INSERT INTO ingrediente (nome, categoria, unidade_padrao, validade_media_dias) VALUES
('Arroz branco',     'grão',       'g',       365),
('Feijão carioca',   'grão',       'g',       365),
('Peito de frango',  'proteína',   'g',       2),
('Ovo',              'proteína',   'unidade', 21),
('Leite integral',   'laticínio',  'ml',      5),
('Farinha de trigo', 'grão',       'g',       180),
('Tomate',           'vegetal',    'unidade', 7),
('Cebola',           'vegetal',    'unidade', 30),
('Alho',             'tempero',    'dente',   60),
('Azeite',           'gordura',    'ml',      540),
('Queijo muçarela',  'laticínio',  'g',       NULL),
('Banana',           'fruta',      'unidade', 5);

-- receita
INSERT INTO receita (nome, porcao_padrao, refeicao_recomendada, modo_preparo, nacionalidade, tempo_medio_gasto_min, finalidade, orcamento_estimado, status, autor_id) VALUES
('Arroz soltinho',           4, 'Almoço',          'Refogue alho e cebola no azeite. Junte o arroz, refogue, cubra com água e cozinhe tampado até secar.', 'Brasileira', 25, 'dia a dia', 6.50,  'Publicada',  2),
('Feijão caseiro',           6, 'Almoço',          'Cozinhe o feijão na pressão. Refogue alho e cebola, junte ao feijão e apure.',                       'Brasileira', 60, 'dia a dia', 9.00,  'Publicada',  2),
('Frango grelhado',          2, 'Jantar',          'Tempere o frango com alho e sal. Grelhe dos dois lados até dourar.',                                 'Brasileira', 30, 'nutrição',  14.00, 'Publicada',  3),
('Omelete simples',          1, 'Café da manhã',   'Bata os ovos, junte tomate e cebola picados, despeje na frigideira untada e dobre ao firmar.',        'Francesa',   10, 'dia a dia', 4.00,  'Publicada',  3),
('Panqueca de banana',       2, 'Lanche',          'Amasse a banana, misture ovo e farinha, frite pequenas porções em frigideira untada.',               'Americana',  15, 'dia a dia', 3.50,  'Em Análise', 4),
('Molho de tomate rústico',  4, 'Almoço',          'Refogue alho e cebola, junte tomates picados e cozinhe em fogo baixo até encorpar.',                 'Italiana',   35, 'festa',     8.00,  'Rascunho',   3);

-- receita_ingrediente
INSERT INTO receita_ingrediente (receita_id, ingrediente_id, quantidade, unidade, papel, visibilidade) VALUES
(1, 1, 400, 'g',       'Principal',  'Privado'),
(1, 8, 1,   'unidade', 'Secundário', 'Privado'),
(1, 9, 2,   'dente',   'Secundário', 'Privado'),
(1, 10, 15, 'ml',      'Removível',  'Opcional'),
(2, 2, 500, 'g',       'Principal',  'Privado'),
(2, 8, 1,   'unidade', 'Secundário', 'Privado'),
(2, 9, 3,   'dente',   'Secundário', 'Privado'),
(3, 3, 400, 'g',       'Principal',  'Privado'),
(3, 9, 2,   'dente',   'Secundário', 'Privado'),
(3, 10, 10, 'ml',      'Removível',  'Opcional'),
(4, 4, 2,   'unidade', 'Principal',  'Privado'),
(4, 7, 1,   'unidade', 'Opcional',   'Opcional'),
(4, 8, 0.5, 'unidade', 'Opcional',   'Opcional'),
(4, 11, 30, 'g',       'Opcional',   'Opcional'),
(5, 12, 2,  'unidade', 'Principal',  'Privado'),
(5, 4, 1,   'unidade', 'Principal',  'Privado'),
(5, 6, 60,  'g',       'Secundário', 'Privado'),
(6, 7, 6,   'unidade', 'Principal',  'Privado'),
(6, 8, 1,   'unidade', 'Secundário', 'Privado'),
(6, 9, 3,   'dente',   'Secundário', 'Privado'),
(6, 10, 20, 'ml',      'Removível',  'Opcional');

-- planner_semanal: semana de 19/10/2026 da Ana e do Bruno
INSERT INTO planner_semanal (usuario_id, semana_inicio, orcamento_definido) VALUES
(2, '2026-10-19', 120.00),
(3, '2026-10-19', NULL);

-- item_planner: porções desejadas diferentes da porção padrão da receita
INSERT INTO item_planner (planner_id, receita_id, dia_semana, refeicao, porcoes_desejadas) VALUES
(1, 1, 'segunda', 'Almoço',        8),
(1, 2, 'segunda', 'Almoço',        6),
(1, 3, 'terça',   'Jantar',        4),
(1, 4, 'quarta',  'Café da manhã', 2),
(1, 1, 'quinta',  'Almoço',        4),
(2, 6, 'sexta',   'Almoço',        8);
