/* Endereços e logins usados pelos testes.
   Por padrão aponta para o sistema rodando no Docker deste PC.
   Para testar outro lugar (ex.: homologação no Coolify):
     set API_URL=https://api-predictmaint.seudominio.com/api
     set SITE_URL=https://predictmaint.seudominio.com            */
export const API_URL = (process.env.API_URL || "http://localhost:8080/api").replace(/\/$/, "");
export const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const SENHA = process.env.SENHA || "senai@123";

export const LOGINS = {
  gestor: "admin@mantech.com.br",
  tecnico: "tecnico@mantech.com.br",
  funcionario: "funcionario@mantech.com.br",
};

// Marca única desta rodada: tudo que o teste cria leva esse sufixo, assim
// dá para rodar várias vezes sem conflito e sem mexer nos dados de exemplo.
export const RODADA = Date.now().toString(36).slice(-5).toUpperCase();
