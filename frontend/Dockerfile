FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:24-alpine AS builder

WORKDIR /app

# /api = o site repassa as chamadas para a API (recomendado). Também aceita um endereço completo.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Endereço da API dentro da rede do Docker (nome do serviço no compose)
ARG API_INTERNA=http://backend:8080
ENV API_INTERNA=$API_INTERNA

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
