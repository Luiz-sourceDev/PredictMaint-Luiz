import cors from "cors";
import express from "express";
import helmet from "helmet";

import { errorHandler, rotaNaoEncontrada } from "./middlewares/errorHandler.js";
import { PASTA_UPLOADS } from "./middlewares/upload.js";
import rotas from "./routes/index.js";

const app = express();

// Atrás do proxy do Coolify/Traefik: confia no cabeçalho X-Forwarded-* do primeiro proxy
app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // libera as fotos para o front
app.use(
  cors({
    // Aceita mais de uma origem separando por vírgula: http://localhost:3000,https://meusite.com
    origin: (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map((s) => s.trim()),
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (request, response) => {
  response.json({ mensagem: "API do PredictMaint", saude: "/api/health" });
});

app.use("/uploads", express.static(PASTA_UPLOADS, { maxAge: "7d" }));
app.use("/api", rotas);

app.use(rotaNaoEncontrada);
app.use(errorHandler);

export default app;
