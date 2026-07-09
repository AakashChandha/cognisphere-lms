FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g serve@latest

COPY --from=build /app/dist ./dist

EXPOSE 4173

CMD ["sh", "-c", "serve -s dist -l ${FRONTEND_PORT:-4173}"]
