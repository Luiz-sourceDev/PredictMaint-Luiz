FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Fusos horários, para a API usar o mesmo horário do banco (TZ no docker-compose)
RUN apk add --no-cache tzdata

COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

EXPOSE 8080

CMD ["npm", "start"]
