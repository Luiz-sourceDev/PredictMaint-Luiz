-- ============================================================
--  PredictMaint · Estrutura do banco (MySQL 8)
--  Responsável: Luiz (Banco de Dados)
--
--  Este arquivo cria TODAS as tabelas que as telas do front usam (16).
--  Os dados de exemplo ficam em 02-seed.sql.
--
--  Como rodar:
--   - Docker: roda sozinho na primeira vez que o container sobe
--             (para recriar: docker compose down -v && docker compose up -d database)
--   - XAMPP / Workbench: execute 01-schema.sql e depois 02-seed.sql
--
--  ATENÇÃO: o script apaga e recria as tabelas (DROP TABLE).
-- ============================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS predictmaint
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE predictmaint;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS vw_maquinas, vw_ordens, vw_chamados, vw_alertas, vw_medicoes;
DROP TABLE IF EXISTS
  notificacoes, chamado_comentarios, chamado_eventos, chamados,
  orcamentos, setor_pecas_padrao, pecas,
  ordens_servico, alertas, medicoes, grandezas,
  usuario_perfis, usuarios, maquinas, setores, equipes,
  users, health_checks;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Equipes de manutenção (Mecânica, Elétrica, ...)
-- ------------------------------------------------------------
CREATE TABLE equipes (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(60) NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- Setores da planta (Estamparia, Usinagem, ...)
-- Os campos *_padrao alimentam a tela de Orçamento.
-- ------------------------------------------------------------
CREATE TABLE setores (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  nome                 VARCHAR(60) NOT NULL UNIQUE,
  equipe_padrao_id     INT NULL,                               -- equipe que recebe a OS por padrão
  tecnicos_padrao      TINYINT UNSIGNED NOT NULL DEFAULT 2,    -- técnicos por intervenção
  horas_padrao         DECIMAL(5,1) NOT NULL DEFAULT 4,        -- horas de trabalho
  horas_parada_padrao  DECIMAL(5,1) NOT NULL DEFAULT 3,        -- horas de máquina parada
  valor_hora_tecnico   DECIMAL(8,2) NOT NULL DEFAULT 85.00,    -- R$ por hora de técnico
  CONSTRAINT fk_setor_equipe FOREIGN KEY (equipe_padrao_id) REFERENCES equipes(id)
    ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Usuários e perfis
-- Um usuário pode ter mais de um perfil (o admin tem os três).
-- A senha é guardada com bcrypt (NUNCA em texto puro).
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,
  matricula   VARCHAR(20)  NOT NULL UNIQUE,
  senha_hash  VARCHAR(100) NOT NULL,
  setor_id    INT NULL,                                        -- setor do funcionário (chão de fábrica)
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_setor FOREIGN KEY (setor_id) REFERENCES setores(id)
    ON DELETE SET NULL
);

CREATE TABLE usuario_perfis (
  usuario_id INT NOT NULL,
  perfil     ENUM('gestor','tecnico','funcionario') NOT NULL,
  PRIMARY KEY (usuario_id, perfil),
  CONSTRAINT fk_perfil_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Máquinas (ativos)
-- O front usa o "codigo" (ex.: PH-03) como identificador.
-- O status NÃO é guardado: sai da saúde (ver vw_maquinas).
--   saude < 50  -> critico | < 75 -> atencao | senão -> normal
-- ------------------------------------------------------------
CREATE TABLE maquinas (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  codigo              VARCHAR(20)  NOT NULL UNIQUE,
  nome                VARCHAR(120) NOT NULL,
  setor_id            INT NOT NULL,
  saude               TINYINT UNSIGNED NOT NULL DEFAULT 100,   -- 0 a 100 (%)
  tendencia           DECIMAL(4,2) NOT NULL DEFAULT 0,         -- pontos de saúde perdidos por hora (planta)
  custo_parada_hora   DECIMAL(10,2) NOT NULL DEFAULT 0,        -- R$ por hora parada
  ultima_medicao      DATETIME NULL,
  proxima_manutencao  DATE NULL,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,           -- "excluir" = desativar, para não perder histórico
  criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_maquina_saude CHECK (saude BETWEEN 0 AND 100),
  CONSTRAINT fk_maquina_setor FOREIGN KEY (setor_id) REFERENCES setores(id)
);

-- ------------------------------------------------------------
-- Grandezas medidas e seus limites (tela Alertas > Limites)
-- ------------------------------------------------------------
CREATE TABLE grandezas (
  codigo          VARCHAR(20) PRIMARY KEY,                    -- vibracao | temperatura | corrente
  nome            VARCHAR(40) NOT NULL,
  unidade         VARCHAR(10) NOT NULL,
  limite_atencao  DECIMAL(8,2) NOT NULL,
  limite_critico  DECIMAL(8,2) NOT NULL,
  CONSTRAINT ck_grandeza_limites CHECK (limite_atencao < limite_critico)
);

-- ------------------------------------------------------------
-- Medições (sensores ou lançamento manual)
-- ------------------------------------------------------------
CREATE TABLE medicoes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  maquina_id  INT NOT NULL,
  grandeza    VARCHAR(20) NOT NULL,
  valor       DECIMAL(8,2) NOT NULL,
  medido_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacao  VARCHAR(255) NULL,
  usuario_id  INT NULL,                                        -- quem lançou (NULL = sensor)
  CONSTRAINT fk_medicao_maquina  FOREIGN KEY (maquina_id) REFERENCES maquinas(id) ON DELETE CASCADE,
  CONSTRAINT fk_medicao_grandeza FOREIGN KEY (grandeza)   REFERENCES grandezas(codigo),
  CONSTRAINT fk_medicao_usuario  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX ix_medicao_serie (maquina_id, grandeza, medido_em)
);

-- ------------------------------------------------------------
-- Alertas
-- ------------------------------------------------------------
CREATE TABLE alertas (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  maquina_id       INT NOT NULL,
  medicao_id       INT NULL,                                   -- medição que disparou (se houver)
  grandeza         VARCHAR(20) NULL,
  nivel            ENUM('info','atencao','critico') NOT NULL,
  titulo           VARCHAR(120) NOT NULL,
  valor_medido     VARCHAR(40) NULL,                           -- texto pronto: "6,4 mm/s"
  valor_limite     VARCHAR(40) NULL,
  previsao         VARCHAR(60) NULL,                           -- "Até 6 dias"
  acao             VARCHAR(255) NULL,                          -- ação recomendada
  estado           ENUM('novo','reconhecido','resolvido') NOT NULL DEFAULT 'novo',
  criado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reconhecido_por  INT NULL,
  reconhecido_em   DATETIME NULL,
  CONSTRAINT fk_alerta_maquina  FOREIGN KEY (maquina_id)      REFERENCES maquinas(id) ON DELETE CASCADE,
  CONSTRAINT fk_alerta_medicao  FOREIGN KEY (medicao_id)      REFERENCES medicoes(id) ON DELETE SET NULL,
  CONSTRAINT fk_alerta_grandeza FOREIGN KEY (grandeza)        REFERENCES grandezas(codigo),
  CONSTRAINT fk_alerta_usuario  FOREIGN KEY (reconhecido_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX ix_alerta_estado (estado, criado_em)
);

-- ------------------------------------------------------------
-- Chamados abertos pelo chão de fábrica
-- O código exibido é "CH-" + id (ex.: CH-1042).
-- ------------------------------------------------------------
CREATE TABLE chamados (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  maquina_id  INT NOT NULL,
  usuario_id  INT NULL,                                        -- quem abriu
  setor_id    INT NULL,
  problema    ENUM('Ruído anormal','Vazamento','Parada','Superaquecimento','Outro') NOT NULL DEFAULT 'Outro',
  urgencia    ENUM('Baixa','Média','Alta','Máquina parada') NOT NULL DEFAULT 'Média',
  situacao    ENUM('Registrado','Triado','Técnico designado','Em reparo','Concluído') NOT NULL DEFAULT 'Registrado',
  descricao   TEXT NULL,
  foto_url    VARCHAR(255) NULL,
  aberto_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chamado_maquina FOREIGN KEY (maquina_id) REFERENCES maquinas(id),
  CONSTRAINT fk_chamado_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_chamado_setor   FOREIGN KEY (setor_id)   REFERENCES setores(id)  ON DELETE SET NULL
);

-- Linha do tempo do chamado (etapas 1 a 4; a 0 é a abertura)
CREATE TABLE chamado_eventos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  chamado_id  INT NOT NULL,
  etapa       TINYINT UNSIGNED NOT NULL,                       -- 1 Triado | 2 Técnico designado | 3 Em reparo | 4 Concluído
  ocorrido_em DATETIME NULL,
  detalhe     VARCHAR(120) NULL,                               -- "prioridade alta", "Equipe Mecânica"...
  CONSTRAINT ck_evento_etapa CHECK (etapa BETWEEN 1 AND 4),
  CONSTRAINT fk_evento_chamado FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE CASCADE,
  UNIQUE KEY uq_evento (chamado_id, etapa)
);

CREATE TABLE chamado_comentarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  chamado_id  INT NOT NULL,
  usuario_id  INT NULL,
  texto       TEXT NOT NULL,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_coment_chamado FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE CASCADE,
  CONSTRAINT fk_coment_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Ordens de serviço (quadro Kanban)
-- O código exibido é "OS-" + id com 4 dígitos (ex.: OS-0241).
-- ------------------------------------------------------------
CREATE TABLE ordens_servico (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  titulo        VARCHAR(120) NOT NULL,
  descricao     TEXT NULL,
  maquina_id    INT NOT NULL,
  equipe_id     INT NULL,
  prioridade    ENUM('baixa','media','alta') NOT NULL DEFAULT 'media',
  status        ENUM('aberta','andamento','peca','concluida') NOT NULL DEFAULT 'aberta',
  prazo         DATE NULL,
  alerta_id     INT NULL,                                      -- OS criada a partir de um alerta
  chamado_id    INT NULL,                                      -- OS criada a partir de um chamado
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em  DATETIME NULL,
  CONSTRAINT fk_os_maquina FOREIGN KEY (maquina_id) REFERENCES maquinas(id),
  CONSTRAINT fk_os_equipe  FOREIGN KEY (equipe_id)  REFERENCES equipes(id)  ON DELETE SET NULL,
  CONSTRAINT fk_os_alerta  FOREIGN KEY (alerta_id)  REFERENCES alertas(id)  ON DELETE SET NULL,
  CONSTRAINT fk_os_chamado FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE SET NULL,
  INDEX ix_os_status (status, prazo)
);

-- ------------------------------------------------------------
-- Orçamento: catálogo de peças e peças padrão por setor
-- ------------------------------------------------------------
CREATE TABLE pecas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(120) NOT NULL UNIQUE,
  valor_unitario  DECIMAL(10,2) NOT NULL
);

CREATE TABLE setor_pecas_padrao (
  setor_id    INT NOT NULL,
  peca_id     INT NOT NULL,
  quantidade  DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (setor_id, peca_id),
  CONSTRAINT fk_spp_setor FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE CASCADE,
  CONSTRAINT fk_spp_peca  FOREIGN KEY (peca_id)  REFERENCES pecas(id)   ON DELETE CASCADE
);

-- Orçamentos salvos. O código exibido é "ORC-" + id com 3 dígitos.
CREATE TABLE orcamentos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  maquina_id       INT NOT NULL,
  usuario_id       INT NULL,
  tipo             ENUM('preventiva','corretiva') NOT NULL,
  total            DECIMAL(12,2) NOT NULL,
  cuidar_agora     DECIMAL(12,2) NOT NULL,                    -- custo preventivo
  esperar_quebrar  DECIMAL(12,2) NOT NULL,                    -- custo corretivo
  detalhes         JSON NULL,                                  -- parâmetros usados no cálculo
  criado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orc_maquina FOREIGN KEY (maquina_id) REFERENCES maquinas(id),
  CONSTRAINT fk_orc_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Notificações: o gestor envia um aviso a um usuário
-- (ex.: "urgência na PH-03"). Aparece no sininho de quem recebe.
-- ------------------------------------------------------------
CREATE TABLE notificacoes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  destinatario_id INT NOT NULL,
  remetente_id    INT NULL,
  maquina_id      INT NULL,                                    -- máquina relacionada (opcional)
  prioridade      ENUM('normal','urgente') NOT NULL DEFAULT 'normal',
  titulo          VARCHAR(120) NOT NULL,
  mensagem        TEXT NULL,
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lida_em         DATETIME NULL,                               -- NULL = ainda não lida
  CONSTRAINT fk_notif_destinatario FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_remetente    FOREIGN KEY (remetente_id)    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_notif_maquina      FOREIGN KEY (maquina_id)      REFERENCES maquinas(id) ON DELETE SET NULL,
  INDEX ix_notif_caixa (destinatario_id, lida_em, criado_em)
);

-- ============================================================
--  VIEWS — já devolvem os dados no formato que o front espera.
--  No backend basta: SELECT * FROM vw_maquinas WHERE ...
-- ============================================================

CREATE VIEW vw_maquinas AS
SELECT
  m.id                  AS maquina_id,
  m.codigo              AS id,                 -- o front chama o código de "id"
  m.nome,
  s.nome                AS setor,
  m.saude,
  CASE WHEN m.saude < 50 THEN 'critico'
       WHEN m.saude < 75 THEN 'atencao'
       ELSE 'normal' END AS status,
  m.tendencia           AS tend,
  m.custo_parada_hora   AS custoParada,
  m.ultima_medicao,
  m.proxima_manutencao  AS prox
FROM maquinas m
JOIN setores s ON s.id = m.setor_id
WHERE m.ativo = TRUE;

CREATE VIEW vw_medicoes AS
SELECT
  me.id,
  me.medido_em          AS data,
  m.codigo              AS maquina,
  me.grandeza,
  me.valor,
  me.observacao         AS obs,
  g.nome,
  g.unidade,
  CASE WHEN me.valor >  g.limite_critico THEN 'critico'
       WHEN me.valor >= g.limite_atencao THEN 'atencao'
       ELSE 'normal' END AS situacao
FROM medicoes me
JOIN maquinas  m ON m.id = me.maquina_id
JOIN grandezas g ON g.codigo = me.grandeza;

CREATE VIEW vw_alertas AS
SELECT
  a.id,
  a.nivel,
  a.titulo,
  m.codigo              AS ativo,
  m.nome                AS maquina,
  s.nome                AS setor,
  TIMESTAMPDIFF(MINUTE, a.criado_em, NOW()) AS min,  -- o front monta o "há 12 min"
  a.estado,
  a.valor_medido        AS medido,
  a.valor_limite        AS limite,
  a.previsao,
  a.acao,
  a.criado_em
FROM alertas a
JOIN maquinas m ON m.id = a.maquina_id
JOIN setores  s ON s.id = m.setor_id;

CREATE VIEW vw_ordens AS
SELECT
  CONCAT('OS-', LPAD(o.id, 4, '0')) AS id,
  o.id                  AS os_id,
  o.titulo,
  o.descricao,
  m.codigo              AS ativo,
  e.nome                AS equipe,
  o.prazo,
  o.prioridade,
  o.status,
  (o.status <> 'concluida' AND o.prazo < CURDATE()) AS vencida,
  o.alerta_id           AS alertaId,
  o.criado_em
FROM ordens_servico o
JOIN maquinas m     ON m.id = o.maquina_id
LEFT JOIN equipes e ON e.id = o.equipe_id;

CREATE VIEW vw_chamados AS
SELECT
  CONCAT('CH-', c.id)   AS id,
  c.id                  AS chamado_id,
  m.codigo              AS maquina,
  c.problema,
  c.urgencia,
  c.situacao,
  c.aberto_em           AS aberto,
  s.nome                AS setor,
  c.descricao,
  c.usuario_id
FROM chamados c
JOIN maquinas m     ON m.id = c.maquina_id
LEFT JOIN setores s ON s.id = c.setor_id;
