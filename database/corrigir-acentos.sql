-- =============================================================
--  PredictMaint · Corrige acentos quebrados (ex.: "MecÃ¢nica")
--  Uso: no terminal do serviço "database" do Coolify
--    mysql --default-character-set=utf8mb4 -uroot -p predictmaint < corrigir-acentos.sql
--  ou cole o conteúdo dentro do mysql aberto com --default-character-set=utf8mb4.
--
--  O que faz: em todas as colunas de texto do banco predictmaint, desfaz o
--  "acento gravado duas vezes" (UTF-8 lido como latin1). Só mexe nas linhas
--  que estão quebradas; texto certo não é alterado. Pode rodar mais de uma vez.
--  Não apaga nada.
-- =============================================================
SET NAMES utf8mb4;
USE predictmaint;

DROP PROCEDURE IF EXISTS pm_corrigir_acentos;
DELIMITER //
CREATE PROCEDURE pm_corrigir_acentos()
BEGIN
  DECLARE fim INT DEFAULT 0;
  DECLARE t VARCHAR(64);
  DECLARE c VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT col.TABLE_NAME, col.COLUMN_NAME
      FROM information_schema.COLUMNS col
      JOIN information_schema.TABLES tab
        ON tab.TABLE_SCHEMA = col.TABLE_SCHEMA AND tab.TABLE_NAME = col.TABLE_NAME
     WHERE col.TABLE_SCHEMA = DATABASE()
       AND tab.TABLE_TYPE = 'BASE TABLE'
       AND col.DATA_TYPE IN ('char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET fim = 1;

  OPEN cur;
  laco: LOOP
    FETCH cur INTO t, c;
    IF fim THEN LEAVE laco; END IF;
    -- Corrige só quando a conversão volta um UTF-8 válido e diferente do original
    SET @sql = CONCAT(
      'UPDATE `', t, '` SET `', c, '` = CONVERT(CAST(CONVERT(`', c, '` USING latin1) AS BINARY) USING utf8mb4) ',
      'WHERE `', c, '` REGEXP ''[ÃÂ]'' ',
      'AND CONVERT(CAST(CONVERT(`', c, '` USING latin1) AS BINARY) USING utf8mb4) IS NOT NULL ',
      'AND CONVERT(CAST(CONVERT(`', c, '` USING latin1) AS BINARY) USING utf8mb4) <> `', c, '`');
    PREPARE st FROM @sql;
    EXECUTE st;
    DEALLOCATE PREPARE st;
  END LOOP;
  CLOSE cur;
END //
DELIMITER ;

CALL pm_corrigir_acentos();
DROP PROCEDURE pm_corrigir_acentos;

-- Conferência: devem aparecer com acento certo (Mecânica, Elétrica, Logística...)
SELECT nome AS equipes FROM equipes ORDER BY id;
SELECT nome AS setores FROM setores ORDER BY id;
