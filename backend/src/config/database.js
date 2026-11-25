import mysql from "mysql2/promise";
import "./env.js";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "predictmaint",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true, // DECIMAL chega como número, não como texto
  dateStrings: true, // datas chegam como "2026-11-04 08:40:00", sem conversão de fuso
  // UTF-8 com a mesma regra de comparação de texto do MySQL 8 (utf8mb4_0900_ai_ci).
  // Com só "utf8mb4", a conexão usaria utf8mb4_general_ci e filtros como status = 'critico'
  // dariam "Illegal mix of collations" ao comparar com colunas calculadas das views.
  charset: "UTF8MB4_0900_AI_CI",
});

export async function checkDatabaseConnection() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}
