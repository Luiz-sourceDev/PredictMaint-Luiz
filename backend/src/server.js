import "./config/env.js";

import app from "./app.js";
import { rodarMigracoes } from "./config/migracoes.js";
import { avaliarPrevisoes } from "./controllers/previsaoController.js";

const port = Number(process.env.PORT || 8080);

// Aplica as mudanças de banco pendentes antes de aceitar requisições.
// Se o banco ainda não estiver pronto, a API sobe mesmo assim e o /api/health mostra o problema.
const bancoOk = await rodarMigracoes();

// Confere as previsões de falha com as medições que já estão no banco
if (bancoOk) {
  avaliarPrevisoes()
    .then((r) => console.log(`Previsões de falha conferidas (${r.criados} alerta(s) novo(s)).`))
    .catch((e) => console.error("Não consegui calcular as previsões:", e.message));
}

app.listen(port, () => {
  console.log(`API do PredictMaint rodando na porta ${port}`);
});
