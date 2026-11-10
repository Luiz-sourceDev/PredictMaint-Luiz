import { HttpError } from "../lib/http.js";

// Todo erro sai no formato { mensagem }, que é o campo que o front lê.
export function errorHandler(error, request, response, next) {
  // JSON mal formado ou grande demais no corpo da requisição
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ mensagem: "O corpo da requisição não é um JSON válido." });
  }
  if (error.type === "entity.too.large") {
    return response.status(413).json({ mensagem: "Os dados enviados são grandes demais." });
  }

  if (error instanceof HttpError) {
    return response.status(error.status).json({ mensagem: error.message });
  }

  // Erros conhecidos do MySQL
  if (error.code === "ER_DUP_ENTRY") {
    return response.status(409).json({ mensagem: "Já existe um registro com esses dados." });
  }
  if (error.code === "ER_ROW_IS_REFERENCED_2") {
    return response.status(409).json({ mensagem: "Este registro está em uso e não pode ser apagado." });
  }
  if (error.code === "ER_CHECK_CONSTRAINT_VIOLATED" || error.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || error.code === "WARN_DATA_TRUNCATED") {
    return response.status(400).json({ mensagem: "Algum valor enviado está fora do permitido." });
  }
  if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR" || error.code === "ER_BAD_DB_ERROR") {
    console.error("Banco de dados indisponível:", error.code);
    return response.status(503).json({ mensagem: "O banco de dados não está respondendo." });
  }

  console.error(error);
  response.status(500).json({ mensagem: "Erro interno no servidor." });
}

export function rotaNaoEncontrada(request, response) {
  response.status(404).json({ mensagem: `Rota não encontrada: ${request.method} ${request.path}` });
}
