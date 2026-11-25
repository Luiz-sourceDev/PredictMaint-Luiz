/** @type {import('next').NextConfig} */

// Endereço INTERNO da API (rede do Docker / Coolify). O site repassa para ela tudo
// que chegar em /api e /uploads. Assim o navegador fala só com o endereço do site:
// sem problema de http x https e sem CORS, em qualquer servidor.
const API_INTERNA = (process.env.API_INTERNA || "http://backend:8080").replace(/\/+$/, "");

const nextConfig = {
  output: "standalone",
  // A tela "Planta ao vivo" foi retirada: quem tiver o endereço antigo cai no Dashboard
  async redirects() {
    return [{ source: "/planta", destination: "/dashboard", permanent: false }];
  },
  async rewrites() {
    return [
      { source: "/api/:caminho*", destination: `${API_INTERNA}/api/:caminho*` },
      { source: "/uploads/:caminho*", destination: `${API_INTERNA}/uploads/:caminho*` },
    ];
  },
};

export default nextConfig;
