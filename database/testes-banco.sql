-- ============================================================
--  PredictMaint - Consultas para testar o banco
--
--  Como usar:
--   DBeaver ........ Alt+X roda o arquivo inteiro (cada resultado
--                    abre numa aba); Ctrl+Enter roda so a consulta
--                    onde o cursor esta.
--   MySQL Workbench  Ctrl+Shift+Enter roda tudo; Ctrl+Enter roda
--                    so a consulta do cursor.
--
--  Nada aqui altera o banco: o teste de escrita (parte 11)
--  desfaz tudo no final com ROLLBACK.
-- ============================================================

USE predictmaint;


-- ------------------------------------------------------------
-- 1. Conexao: qual banco, versao e horario do servidor
--    (o horario deve ser o de Sao Paulo)
-- ------------------------------------------------------------
SELECT DATABASE() AS banco, VERSION() AS versao_mysql, NOW() AS agora;


-- ------------------------------------------------------------
-- 2. Quantos registros tem em cada tabela
--    Esperado: 16 tabelas, 11 maquinas, 3 usuarios, 39 OS...
-- ------------------------------------------------------------
SELECT 'equipes'             AS tabela, COUNT(*) AS registros FROM equipes
UNION ALL SELECT 'setores',             COUNT(*) FROM setores
UNION ALL SELECT 'usuarios',            COUNT(*) FROM usuarios
UNION ALL SELECT 'usuario_perfis',      COUNT(*) FROM usuario_perfis
UNION ALL SELECT 'maquinas',            COUNT(*) FROM maquinas
UNION ALL SELECT 'grandezas',           COUNT(*) FROM grandezas
UNION ALL SELECT 'medicoes',            COUNT(*) FROM medicoes
UNION ALL SELECT 'alertas',             COUNT(*) FROM alertas
UNION ALL SELECT 'ordens_servico',      COUNT(*) FROM ordens_servico
UNION ALL SELECT 'chamados',            COUNT(*) FROM chamados
UNION ALL SELECT 'chamado_eventos',     COUNT(*) FROM chamado_eventos
UNION ALL SELECT 'chamado_comentarios', COUNT(*) FROM chamado_comentarios
UNION ALL SELECT 'pecas',               COUNT(*) FROM pecas
UNION ALL SELECT 'setor_pecas_padrao',  COUNT(*) FROM setor_pecas_padrao
UNION ALL SELECT 'orcamentos',          COUNT(*) FROM orcamentos
UNION ALL SELECT 'notificacoes',        COUNT(*) FROM notificacoes;


-- ------------------------------------------------------------
-- 3. Usuarios e perfis de acesso
--    A senha fica guardada com bcrypt (comeca com $2b$), nunca em texto
-- ------------------------------------------------------------
SELECT u.id, u.nome, u.email, u.matricula,
       s.nome                                   AS setor,
       GROUP_CONCAT(p.perfil ORDER BY p.perfil) AS perfis,
       LEFT(u.senha_hash, 7)                    AS inicio_do_hash,
       u.ativo
FROM usuarios u
LEFT JOIN setores        s ON s.id = u.setor_id
LEFT JOIN usuario_perfis p ON p.usuario_id = u.id
GROUP BY u.id, u.nome, u.email, u.matricula, s.nome, u.senha_hash, u.ativo
ORDER BY u.id;


-- ------------------------------------------------------------
-- 4. Maquinas da pior para a melhor saude (view usada pelo site)
-- ------------------------------------------------------------
SELECT id AS codigo, nome, setor, saude, status,
       tend AS perda_saude_por_hora, custoParada AS custo_parada_hora,
       ultima_medicao, prox AS proxima_manutencao
FROM vw_maquinas
ORDER BY saude;


-- ------------------------------------------------------------
-- 5. Saude media e custo de parada por setor
-- ------------------------------------------------------------
SELECT s.nome                                     AS setor,
       COUNT(m.id)                                AS maquinas,
       ROUND(AVG(m.saude), 1)                     AS saude_media,
       SUM(m.saude < 50)                          AS criticas,
       SUM(m.saude BETWEEN 50 AND 74)             AS em_atencao,
       SUM(m.custo_parada_hora)                   AS custo_parada_total_hora
FROM setores s
LEFT JOIN maquinas m ON m.setor_id = s.id AND m.ativo = TRUE
GROUP BY s.id, s.nome
ORDER BY saude_media;


-- ------------------------------------------------------------
-- 6. Limites de cada grandeza medida
-- ------------------------------------------------------------
SELECT codigo, nome, unidade, limite_atencao, limite_critico
FROM grandezas;


-- ------------------------------------------------------------
-- 7. Medicoes
-- 7a. As 20 mais recentes
-- ------------------------------------------------------------
SELECT data, maquina, nome AS grandeza, valor, unidade, situacao, obs
FROM vw_medicoes
ORDER BY data DESC
LIMIT 20;

-- 7b. Medicoes acima do limite de atencao ou critico
SELECT data, maquina, nome AS grandeza, valor, unidade, situacao
FROM vw_medicoes
WHERE situacao <> 'normal'
ORDER BY data DESC;

-- 7c. Ultimo valor de cada grandeza em cada maquina
SELECT m.codigo AS maquina, me.grandeza, me.valor, g.unidade, me.medido_em
FROM medicoes me
JOIN maquinas  m ON m.id = me.maquina_id
JOIN grandezas g ON g.codigo = me.grandeza
WHERE me.medido_em = (SELECT MAX(x.medido_em)
                      FROM medicoes x
                      WHERE x.maquina_id = me.maquina_id
                        AND x.grandeza   = me.grandeza)
ORDER BY m.codigo, me.grandeza;


-- ------------------------------------------------------------
-- 8. Alertas que ainda nao foram resolvidos
-- ------------------------------------------------------------
SELECT id, nivel, titulo, ativo AS maquina, setor,
       medido, limite, previsao, estado,
       min AS minutos_atras
FROM vw_alertas
WHERE estado <> 'resolvido'
ORDER BY FIELD(nivel, 'critico', 'atencao', 'info'), criado_em DESC;


-- ------------------------------------------------------------
-- 9. Ordens de servico
-- 9a. Quantidade por status
-- ------------------------------------------------------------
SELECT status, COUNT(*) AS quantidade
FROM ordens_servico
GROUP BY status
ORDER BY FIELD(status, 'aberta', 'andamento', 'peca', 'concluida');

-- 9b. OS em aberto, com as vencidas primeiro
SELECT id, titulo, ativo AS maquina, equipe, prioridade, status, prazo,
       IF(vencida, 'SIM', 'nao') AS vencida
FROM vw_ordens
WHERE status <> 'concluida'
ORDER BY vencida DESC, prazo;

-- 9c. Tempo medio de reparo (MTTR) por equipe, em horas
SELECT e.nome AS equipe,
       COUNT(*) AS os_concluidas,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, o.criado_em, o.concluido_em)) / 60, 1) AS mttr_horas
FROM ordens_servico o
LEFT JOIN equipes e ON e.id = o.equipe_id
WHERE o.status = 'concluida' AND o.concluido_em IS NOT NULL
GROUP BY e.nome
ORDER BY mttr_horas;


-- ------------------------------------------------------------
-- 10. Chamados abertos pelos funcionarios e a linha do tempo
-- ------------------------------------------------------------
SELECT c.id, c.maquina, c.problema, c.urgencia, c.situacao, c.aberto, c.setor,
       u.nome AS aberto_por
FROM vw_chamados c
LEFT JOIN usuarios u ON u.id = c.usuario_id
ORDER BY c.aberto DESC;

SELECT CONCAT('CH-', ev.chamado_id) AS chamado,
       ev.etapa,
       ELT(ev.etapa, 'Triado', 'Tecnico designado', 'Em reparo', 'Concluido') AS etapa_nome,
       ev.ocorrido_em, ev.detalhe
FROM chamado_eventos ev
ORDER BY ev.chamado_id, ev.etapa;


-- ------------------------------------------------------------
-- 11. Pecas padrao por setor e custo estimado de uma intervencao
--     (base do calculo da tela de Orcamento)
-- ------------------------------------------------------------
SELECT s.nome AS setor, p.nome AS peca, sp.quantidade, p.valor_unitario,
       sp.quantidade * p.valor_unitario AS subtotal
FROM setor_pecas_padrao sp
JOIN setores s ON s.id = sp.setor_id
JOIN pecas   p ON p.id = sp.peca_id
ORDER BY s.nome, subtotal DESC;

SELECT s.nome AS setor,
       pc.custo_pecas,
       s.tecnicos_padrao * s.horas_padrao * s.valor_hora_tecnico AS custo_mao_de_obra,
       pc.custo_pecas + s.tecnicos_padrao * s.horas_padrao * s.valor_hora_tecnico AS total_preventiva
FROM setores s
JOIN (SELECT sp.setor_id, SUM(sp.quantidade * p.valor_unitario) AS custo_pecas
      FROM setor_pecas_padrao sp
      JOIN pecas p ON p.id = sp.peca_id
      GROUP BY sp.setor_id) pc ON pc.setor_id = s.id
ORDER BY total_preventiva DESC;


-- ------------------------------------------------------------
-- 12. Teste de escrita (desfeito no final com ROLLBACK)
--     Lanca uma medicao de vibracao na PH-03, confere e desfaz.
-- ------------------------------------------------------------
START TRANSACTION;

INSERT INTO medicoes (maquina_id, grandeza, valor, observacao)
SELECT id, 'vibracao', 9.99, 'TESTE - sera desfeito'
FROM maquinas WHERE codigo = 'PH-03';

SELECT 'depois do INSERT' AS momento, data, maquina, valor, situacao, obs
FROM vw_medicoes WHERE obs = 'TESTE - sera desfeito';

ROLLBACK;

SELECT 'depois do ROLLBACK (deve vir 0)' AS momento, COUNT(*) AS medicoes_de_teste
FROM medicoes WHERE observacao = 'TESTE - sera desfeito';


-- ------------------------------------------------------------
-- 13. Testes de regras do banco (devem DAR ERRO)
--     Estao comentados para nao parar o arquivo. Para testar,
--     tire o "-- " do inicio da linha e rode so ela (Ctrl+Enter).
-- ------------------------------------------------------------
-- Saude maior que 100 -> erro 3819 (Check constraint 'ck_maquina_saude')
-- INSERT INTO maquinas (codigo, nome, setor_id, saude) VALUES ('TESTE-01', 'Maquina teste', 1, 150);

-- Grandeza que nao existe -> erro 1452 (chave estrangeira)
-- INSERT INTO medicoes (maquina_id, grandeza, valor) VALUES (1, 'pressao', 10);

-- E-mail repetido -> erro 1062 (Duplicate entry)
-- INSERT INTO usuarios (nome, email, matricula, senha_hash) VALUES ('Copia', 'admin@mantech.com.br', 'x999', 'x');
