# Front Angular com SSR (Node). Build da SPA + servidor Express de render.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build de produção (usa src/environments/environment.ts).
# API_URL/SITE_URL permitem apontar ao ALB do ECS sem alterar o arquivo versionado.
ARG API_URL=https://api.plataforma-esporte.com
ARG SITE_URL=https://plataforma-esporte.com
RUN sed -i "s|https://api.plataforma-esporte.com|${API_URL}|g" src/environments/environment.ts \
 && sed -i "s|https://plataforma-esporte.com|${SITE_URL}|g" src/environments/environment.ts \
 && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
# Apenas o artefato de distribuição (browser + server) é necessário em runtime.
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/front-plataforma-esporte/server/server.mjs"]
