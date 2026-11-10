// Erro com status HTTP. O errorHandler transforma em { mensagem } para o front.
export class HttpError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export const erro400 = (msg) => new HttpError(400, msg);
export const erro401 = (msg) => new HttpError(401, msg);
export const erro403 = (msg) => new HttpError(403, msg);
export const erro404 = (msg) => new HttpError(404, msg);
export const erro409 = (msg) => new HttpError(409, msg);

// "OS-0241" -> 241 | "CH-1042" -> 1042 | "241" -> 241
export function idDoCodigo(codigo) {
  const n = Number(String(codigo).replace(/^[A-Za-z]+-/, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
}
