/* Migrações automáticas.
   Os scripts de database/init só rodam quando o banco é criado do zero.
   Em um banco que já existe (outro PC, homologação no Coolify), as
   mudanças novas são aplicadas aqui, toda vez que a API liga.
   Cada comando é idempotente: pode rodar várias vezes sem estragar nada. */
import { pool } from "./database.js";

const MIGRACOES = [
  {
    nome: "2026-11-06 tabela notificacoes",
    sql: `CREATE TABLE IF NOT EXISTS notificacoes (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      destinatario_id INT NOT NULL,
      remetente_id    INT NULL,
      maquina_id      INT NULL,
      prioridade      ENUM('normal','urgente') NOT NULL DEFAULT 'normal',
      titulo          VARCHAR(120) NOT NULL,
      mensagem        TEXT NULL,
      criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lida_em         DATETIME NULL,
      CONSTRAINT fk_notif_destinatario FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_notif_remetente    FOREIGN KEY (remetente_id)    REFERENCES usuarios(id) ON DELETE SET NULL,
      CONSTRAINT fk_notif_maquina      FOREIGN KEY (maquina_id)      REFERENCES maquinas(id) ON DELETE SET NULL,
      INDEX ix_notif_caixa (destinatario_id, lida_em, criado_em)
    )`,
  },
];

// Tenta algumas vezes: no Docker/Coolify a API pode ligar antes do banco aceitar conexões.
export async function rodarMigracoes(tentativas = 10) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      for (const m of MIGRACOES) await pool.query(m.sql);
      console.log(`Banco atualizado (${MIGRACOES.length} migração(ões) conferida(s)).`);
      return true;
    } catch (e) {
      if (i === tentativas) {
        console.error("Não consegui aplicar as migrações:", e.code || e.message);
        return false;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
