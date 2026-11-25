import dotenv from "dotenv";

// Lê backend/.env (padrão do README). Também aceita backend/src/.env,
// para não quebrar quem já tinha configurado o arquivo lá.
dotenv.config({ path: [".env", "src/.env"], quiet: true });
