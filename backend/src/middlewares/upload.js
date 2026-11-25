import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";

import { erro400 } from "../lib/http.js";

// Fotos dos chamados ficam em backend/uploads (servidas em /uploads)
export const PASTA_UPLOADS = path.resolve(process.env.UPLOADS_DIR || "uploads");
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const upload = multer({
  storage: multer.diskStorage({
    destination: PASTA_UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + TIPOS[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => (TIPOS[file.mimetype] ? cb(null, true) : cb(erro400("A foto precisa ser JPG, PNG ou WEBP."))),
});

// Aceita JSON comum ou multipart com o campo "foto"
export function uploadFoto(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  upload.single("foto")(req, res, (e) => {
    if (e?.code === "LIMIT_FILE_SIZE") return next(erro400("A foto pode ter no máximo 5 MB."));
    next(e);
  });
}
