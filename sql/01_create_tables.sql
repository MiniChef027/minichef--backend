-- =====================================================================
-- MiniChef | Banco de Dados Relacional (PostgreSQL)
-- Script 01: criação das tabelas e relacionamentos do MVP
--
-- MVP: CRUD de receitas, planner semanal, calculadora de porções e
-- geração da lista de compras (8 tabelas).
--
-- O modelo já nasce preparado para as próximas fases do MiniChef:
--   * colunas de funcionalidades futuras já existem e aceitam NULL
--     (marcadas com [FUTURO]), então nenhuma tabela precisa de ALTER;
--   * as tabelas das próximas fases (script 04) só acrescentam chaves
--     estrangeiras apontando para estas tabelas.
--
-- Pode ser executado mais de uma vez: apaga e recria tudo.
-- Execução: psql -U <usuario> -d <banco> -f sql/01_create_tables.sql
-- =====================================================================

-- Tabelas das próximas fases (script 04), caso tenham sido criadas
DROP TABLE IF EXISTS notificacao              CASCADE;
DROP TABLE IF EXISTS comentario               CASCADE;
DROP TABLE IF EXISTS curtida                  CASCADE;
DROP TABLE IF EXISTS seguidor                 CASCADE;
DROP TABLE IF EXISTS postagem_midia           CASCADE;
DROP TABLE IF EXISTS postagem                 CASCADE;
DROP TABLE IF EXISTS pedido_mercado           CASCADE;
DROP TABLE IF EXISTS item_despensa            CASCADE;
DROP TABLE IF EXISTS criterio_pesquisa        CASCADE;
DROP TABLE IF EXISTS substituicao             CASCADE;
DROP TABLE IF EXISTS receita_alergeno         CASCADE;
DROP TABLE IF EXISTS alergeno                 CASCADE;
DROP TABLE IF EXISTS informacao_nutricional   CASCADE;
DROP TABLE IF EXISTS codigo_confirmacao_email CASCADE;

-- Tabelas do MVP
DROP TABLE IF EXISTS item_lista_compras       CASCADE;
DROP TABLE IF EXISTS lista_compras            CASCADE;
DROP TABLE IF EXISTS item_planner             CASCADE;
DROP TABLE IF EXISTS planner_semanal          CASCADE;
DROP TABLE IF EXISTS receita_ingrediente      CASCADE;
DROP TABLE IF EXISTS receita                  CASCADE;
DROP TABLE IF EXISTS ingrediente              CASCADE;
DROP TABLE IF EXISTS usuario                  CASCADE;

-- ---------------------------------------------------------------------
-- usuario: pessoa cadastrada; autor de receitas e dono de planners
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id                SERIAL        PRIMARY KEY,
    nome              VARCHAR(120)  NOT NULL,
    email             VARCHAR(160)  NOT NULL UNIQUE,
    email_confirmado  BOOLEAN       NOT NULL DEFAULT FALSE,
    data_nascimento   DATE          NOT NULL,
    cpf               VARCHAR(14)   NOT NULL UNIQUE,
    senha_hash        VARCHAR(255)  NOT NULL,
    tipo_conta        VARCHAR(30)   NOT NULL DEFAULT 'Usuário comum',
    perfil_acesso     VARCHAR(30)   NOT NULL DEFAULT 'comum',
    ativo             BOOLEAN       NOT NULL DEFAULT TRUE,   -- [FUTURO] inativar conta em vez de excluir
    foto_perfil_url   VARCHAR(255),                          -- [FUTURO] avatar no feed de Notícias
    criado_em         TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_usuario_tipo_conta CHECK (tipo_conta IN (
        'Usuário comum', 'Chef de cozinha', 'Hotel', 'Restaurante',
        'Personal Trainer', 'Nutricionista', 'Administrador de eventos', 'Mercado')),
    CONSTRAINT ck_usuario_perfil_acesso CHECK (perfil_acesso IN (
        'comum', 'moderador', 'administrador'))
);

-- ---------------------------------------------------------------------
-- ingrediente: catálogo mestre, mantido pelo administrador
-- ---------------------------------------------------------------------
CREATE TABLE ingrediente (
    id                   SERIAL         PRIMARY KEY,
    nome                 VARCHAR(100)   NOT NULL,
    categoria            VARCHAR(50),
    unidade_padrao       VARCHAR(20)    NOT NULL,
    validade_media_dias  INTEGER,                    -- [FUTURO] validade dos itens da despensa
    preco_medio          DECIMAL(10,2)               -- [FUTURO] preço por unidade_padrao, para orçamento
);

-- ---------------------------------------------------------------------
-- receita
-- usuario 1 : N receita (autor)     | ON DELETE RESTRICT
-- usuario 1 : N receita (moderador) | sem ação = bloqueia exclusão
-- ---------------------------------------------------------------------
CREATE TABLE receita (
    id                     SERIAL         PRIMARY KEY,
    nome                   VARCHAR(150)   NOT NULL,
    porcao_padrao          INTEGER        NOT NULL CHECK (porcao_padrao > 0),
    refeicao_recomendada   VARCHAR(60),
    modo_preparo           TEXT           NOT NULL,
    nacionalidade          VARCHAR(60),
    tempo_medio_gasto_min  INTEGER        NOT NULL CHECK (tempo_medio_gasto_min > 0),
    finalidade             VARCHAR(60),
    orcamento_estimado     DECIMAL(10,2),
    foto_url               VARCHAR(255),              -- [FUTURO] foto da receita
    link_video             VARCHAR(255),              -- [FUTURO] vídeo do YouTube ou Instagram
    status                 VARCHAR(20)    NOT NULL DEFAULT 'Rascunho',
    feedback_moderacao     TEXT,
    moderador_id           INTEGER,                   -- [FUTURO] administrador que analisou
    analisado_em           TIMESTAMP,                 -- [FUTURO] data da análise
    autor_id               INTEGER        NOT NULL,
    criado_em              TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_receita_autor FOREIGN KEY (autor_id)
        REFERENCES usuario(id) ON DELETE RESTRICT,
    CONSTRAINT fk_receita_moderador FOREIGN KEY (moderador_id)
        REFERENCES usuario(id),
    CONSTRAINT ck_receita_status CHECK (status IN (
        'Rascunho', 'Em Análise', 'Publicada', 'Recusada', 'Arquivada'))
);

-- ---------------------------------------------------------------------
-- receita_ingrediente: associativa receita N : N ingrediente
-- receita     1 : N receita_ingrediente | ON DELETE CASCADE
-- ingrediente 1 : N receita_ingrediente | ON DELETE RESTRICT
-- ---------------------------------------------------------------------
CREATE TABLE receita_ingrediente (
    id              SERIAL         PRIMARY KEY,
    receita_id      INTEGER        NOT NULL,
    ingrediente_id  INTEGER        NOT NULL,
    quantidade      DECIMAL(10,2)  NOT NULL CHECK (quantidade > 0),
    unidade         VARCHAR(20)    NOT NULL,
    papel           VARCHAR(20)    NOT NULL,
    visibilidade    VARCHAR(10)    NOT NULL,
    CONSTRAINT fk_ri_receita FOREIGN KEY (receita_id)
        REFERENCES receita(id) ON DELETE CASCADE,
    CONSTRAINT fk_ri_ingrediente FOREIGN KEY (ingrediente_id)
        REFERENCES ingrediente(id) ON DELETE RESTRICT,
    CONSTRAINT ck_ri_papel CHECK (papel IN (
        'Principal', 'Secundário', 'Removível', 'Opcional')),
    CONSTRAINT ck_ri_visibilidade CHECK (visibilidade IN (
        'Público', 'Privado', 'Opcional'))
);

-- ---------------------------------------------------------------------
-- planner_semanal: planejamento de uma semana de um usuário
-- usuario 1 : N planner_semanal | ON DELETE CASCADE
-- ---------------------------------------------------------------------
CREATE TABLE planner_semanal (
    id                  SERIAL         PRIMARY KEY,
    usuario_id          INTEGER        NOT NULL,
    semana_inicio       DATE           NOT NULL,
    orcamento_definido  DECIMAL(10,2),             -- [FUTURO] limite de gasto da semana
    CONSTRAINT fk_planner_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- item_planner: receita planejada para um dia e uma refeição, com o
-- número de porções desejado (entrada da calculadora de porções)
-- planner_semanal 1 : N item_planner | ON DELETE CASCADE
-- receita         1 : N item_planner | sem ação = bloqueia exclusão
-- ---------------------------------------------------------------------
CREATE TABLE item_planner (
    id                 SERIAL       PRIMARY KEY,
    planner_id         INTEGER      NOT NULL,
    receita_id         INTEGER      NOT NULL,
    dia_semana         VARCHAR(15)  NOT NULL,
    refeicao           VARCHAR(20)  NOT NULL,
    porcoes_desejadas  INTEGER      NOT NULL CHECK (porcoes_desejadas > 0),
    CONSTRAINT fk_ip_planner FOREIGN KEY (planner_id)
        REFERENCES planner_semanal(id) ON DELETE CASCADE,
    CONSTRAINT fk_ip_receita FOREIGN KEY (receita_id)
        REFERENCES receita(id),
    CONSTRAINT ck_ip_dia CHECK (dia_semana IN (
        'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo')),
    CONSTRAINT ck_ip_refeicao CHECK (refeicao IN (
        'Café da manhã', 'Almoço', 'Jantar', 'Lanche'))
);

-- ---------------------------------------------------------------------
-- lista_compras: gerada a partir de um planner
-- planner_semanal 1 : N lista_compras | ON DELETE CASCADE
-- ---------------------------------------------------------------------
CREATE TABLE lista_compras (
    id              SERIAL         PRIMARY KEY,
    planner_id      INTEGER        NOT NULL,
    total_estimado  DECIMAL(10,2),                 -- [FUTURO] soma dos custos dos itens
    gerada_em       TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_lista_planner FOREIGN KEY (planner_id)
        REFERENCES planner_semanal(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- item_lista_compras: ingrediente agregado a comprar
-- lista_compras 1 : N item_lista_compras | ON DELETE CASCADE
-- ingrediente   1 : N item_lista_compras | sem ação = bloqueia exclusão
-- ---------------------------------------------------------------------
CREATE TABLE item_lista_compras (
    id                SERIAL         PRIMARY KEY,
    lista_compras_id  INTEGER        NOT NULL,
    ingrediente_id    INTEGER        NOT NULL,
    quantidade        DECIMAL(10,2)  NOT NULL CHECK (quantidade > 0),
    unidade           VARCHAR(20)    NOT NULL,
    custo_estimado    DECIMAL(10,2),               -- [FUTURO] quantidade x preço médio
    comprado          BOOLEAN        NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_ilc_lista FOREIGN KEY (lista_compras_id)
        REFERENCES lista_compras(id) ON DELETE CASCADE,
    CONSTRAINT fk_ilc_ingrediente FOREIGN KEY (ingrediente_id)
        REFERENCES ingrediente(id)
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
-- Nome de ingrediente único, sem diferenciar maiúsculas de minúsculas
-- (impede 'Tomate' e 'tomate' como ingredientes diferentes)
CREATE UNIQUE INDEX ux_ingrediente_nome       ON ingrediente(LOWER(nome));
CREATE INDEX ix_receita_status                ON receita(status);
CREATE INDEX ix_receita_nacionalidade         ON receita(nacionalidade);
CREATE INDEX ix_receita_refeicao              ON receita(refeicao_recomendada);
CREATE INDEX ix_receita_autor                 ON receita(autor_id);
CREATE INDEX ix_ri_ingrediente_papel          ON receita_ingrediente(ingrediente_id, papel);
CREATE INDEX ix_item_planner_planner          ON item_planner(planner_id);
CREATE INDEX ix_lista_planner                 ON lista_compras(planner_id);
CREATE INDEX ix_ilc_lista                     ON item_lista_compras(lista_compras_id);
