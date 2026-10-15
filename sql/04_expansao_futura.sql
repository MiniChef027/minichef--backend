-- =====================================================================
-- MiniChef | Banco de Dados Relacional (PostgreSQL)
-- Script 04: tabelas das próximas fases (FORA DO MVP)
--
-- NÃO é necessário para executar o programa do MVP.
-- Mostra como o banco cresce até a visão completa do MiniChef
-- (22 tabelas) SEM ALTER nas 8 tabelas do MVP: cada tabela nova só
-- acrescenta chaves estrangeiras que apontam para as tabelas existentes.
--
-- Executar depois de 01_create_tables.sql (e, se quiser, do 02).
-- =====================================================================

-- ========== IDENTIDADE: confirmação de e-mail por código ==========
CREATE TABLE codigo_confirmacao_email (
    id             SERIAL      PRIMARY KEY,
    usuario_id     INTEGER     NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    codigo         VARCHAR(8)  NOT NULL,
    expira_em      TIMESTAMP   NOT NULL,
    confirmado_em  TIMESTAMP
);

-- ========== RECEITAS: nutrição, alergias e substituições ==========
CREATE TABLE informacao_nutricional (            -- 1 : 1 com receita
    id                       SERIAL   PRIMARY KEY,
    receita_id               INTEGER  NOT NULL UNIQUE REFERENCES receita(id) ON DELETE CASCADE,
    valor_energetico_kcal    DECIMAL(8,2),
    carboidratos_g           DECIMAL(8,2),
    acucares_totais_g        DECIMAL(8,2),
    acucares_adicionados_g   DECIMAL(8,2),
    proteinas_g              DECIMAL(8,2),
    gorduras_totais_g        DECIMAL(8,2),
    gorduras_saturadas_g     DECIMAL(8,2),
    gorduras_trans_g         DECIMAL(8,2),
    fibra_alimentar_g        DECIMAL(8,2),
    sodio_mg                 DECIMAL(8,2)
);

CREATE TABLE alergeno (
    id    SERIAL       PRIMARY KEY,
    nome  VARCHAR(60)  NOT NULL UNIQUE
);

CREATE TABLE receita_alergeno (                  -- receita N : N alergeno
    receita_id   INTEGER NOT NULL REFERENCES receita(id) ON DELETE CASCADE,
    alergeno_id  INTEGER NOT NULL REFERENCES alergeno(id),
    PRIMARY KEY (receita_id, alergeno_id)
);

CREATE TABLE substituicao (                      -- ingrediente N : N ingrediente
    id                         SERIAL        PRIMARY KEY,
    ingrediente_original_id    INTEGER       NOT NULL REFERENCES ingrediente(id),
    ingrediente_substituto_id  INTEGER       NOT NULL REFERENCES ingrediente(id),
    observacao                 VARCHAR(200),
    CHECK (ingrediente_original_id <> ingrediente_substituto_id)
);

-- ========== PESQUISA INTELIGENTE: histórico de critérios ==========
CREATE TABLE criterio_pesquisa (
    id                        SERIAL         PRIMARY KEY,
    usuario_id                INTEGER        REFERENCES usuario(id) ON DELETE CASCADE,
    ingrediente_pesquisado    VARCHAR(100)   NOT NULL,
    numero_porcoes            INTEGER        NOT NULL CHECK (numero_porcoes > 0),
    orcamento_medio           DECIMAL(10,2),
    tempo_medio_proposto_min  INTEGER,
    modalidade_refeicao       VARCHAR(60),
    criado_em                 TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ========== PLANEJAMENTO: despensa e pedido a mercado ==========
CREATE TABLE item_despensa (
    id                                  SERIAL         PRIMARY KEY,
    usuario_id                          INTEGER        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    ingrediente_id                      INTEGER        NOT NULL REFERENCES ingrediente(id),
    quantidade                          DECIMAL(10,2)  NOT NULL,
    unidade                             VARCHAR(20)    NOT NULL,
    data_validade                       DATE,
    validade_calculada_automaticamente  BOOLEAN        NOT NULL DEFAULT FALSE,
    criado_em                           TIMESTAMP      NOT NULL DEFAULT NOW(),
    atualizado_em                       TIMESTAMP
);

CREATE TABLE pedido_mercado (                    -- mercado é um usuario com tipo_conta 'Mercado'
    id                SERIAL         PRIMARY KEY,
    lista_compras_id  INTEGER        NOT NULL REFERENCES lista_compras(id),
    usuario_id        INTEGER        NOT NULL REFERENCES usuario(id),
    mercado_id        INTEGER        NOT NULL REFERENCES usuario(id),
    status            VARCHAR(20)    NOT NULL DEFAULT 'Enviado'
                      CHECK (status IN ('Enviado', 'Confirmado', 'Em Entrega', 'Entregue', 'Cancelado')),
    endereco_entrega  VARCHAR(255)   NOT NULL,
    valor_total       DECIMAL(10,2),
    criado_em         TIMESTAMP      NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMP
);

-- ========== REDE SOCIAL: aba Notícias ==========
CREATE TABLE postagem (
    id                  SERIAL       PRIMARY KEY,
    autor_id            INTEGER      NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    texto               TEXT         NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'Em Análise'
                        CHECK (status IN ('Em Análise', 'Publicada', 'Recusada', 'Removida', 'Denunciada')),
    feedback_moderacao  TEXT,
    moderador_id        INTEGER      REFERENCES usuario(id),
    analisado_em        TIMESTAMP,
    criado_em           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE postagem_midia (
    id           SERIAL        PRIMARY KEY,
    postagem_id  INTEGER       NOT NULL REFERENCES postagem(id) ON DELETE CASCADE,
    tipo         VARCHAR(10)   NOT NULL CHECK (tipo IN ('imagem', 'video')),
    url          VARCHAR(500)  NOT NULL,
    ordem        INTEGER       NOT NULL DEFAULT 1
);

CREATE TABLE seguidor (                          -- usuario N : N usuario
    seguidor_id  INTEGER    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    seguido_id   INTEGER    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    criado_em    TIMESTAMP  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (seguidor_id, seguido_id),
    CHECK (seguidor_id <> seguido_id)
);

CREATE TABLE curtida (                           -- em postagem OU em receita
    id           SERIAL     PRIMARY KEY,
    usuario_id   INTEGER    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    postagem_id  INTEGER    REFERENCES postagem(id) ON DELETE CASCADE,
    receita_id   INTEGER    REFERENCES receita(id) ON DELETE CASCADE,
    criado_em    TIMESTAMP  NOT NULL DEFAULT NOW(),
    CHECK ((postagem_id IS NOT NULL AND receita_id IS NULL)
        OR (postagem_id IS NULL AND receita_id IS NOT NULL))
);
CREATE UNIQUE INDEX ux_curtida_postagem ON curtida(usuario_id, postagem_id) WHERE postagem_id IS NOT NULL;
CREATE UNIQUE INDEX ux_curtida_receita  ON curtida(usuario_id, receita_id)  WHERE receita_id  IS NOT NULL;

CREATE TABLE comentario (                        -- em postagem OU em receita
    id           SERIAL     PRIMARY KEY,
    usuario_id   INTEGER    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    postagem_id  INTEGER    REFERENCES postagem(id) ON DELETE CASCADE,
    receita_id   INTEGER    REFERENCES receita(id) ON DELETE CASCADE,
    texto        TEXT       NOT NULL,
    criado_em    TIMESTAMP  NOT NULL DEFAULT NOW(),
    CHECK ((postagem_id IS NOT NULL AND receita_id IS NULL)
        OR (postagem_id IS NULL AND receita_id IS NOT NULL))
);

-- ========== NOTIFICAÇÕES ==========
CREATE TABLE notificacao (
    id                 SERIAL        PRIMARY KEY,
    usuario_id         INTEGER       NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    tipo               VARCHAR(40)   NOT NULL,
    categoria          VARCHAR(20)   NOT NULL CHECK (categoria IN ('receitas', 'social', 'mensagens')),
    titulo             VARCHAR(150)  NOT NULL,
    descricao          TEXT,
    referencia_tipo    VARCHAR(30),
    referencia_id      INTEGER,
    origem_usuario_id  INTEGER       REFERENCES usuario(id) ON DELETE SET NULL,
    lida               BOOLEAN       NOT NULL DEFAULT FALSE,
    lida_em            TIMESTAMP,
    criado_em          TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ========== ÍNDICES ==========
CREATE INDEX ix_item_despensa_validade  ON item_despensa(usuario_id, data_validade);
CREATE INDEX ix_pedido_mercado_mercado  ON pedido_mercado(mercado_id, status);
CREATE INDEX ix_postagem_feed           ON postagem(status, criado_em DESC);
CREATE INDEX ix_seguidor_seguidor       ON seguidor(seguidor_id);
CREATE INDEX ix_notificacao_usuario     ON notificacao(usuario_id, lida, criado_em DESC);
