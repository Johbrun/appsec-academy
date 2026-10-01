# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts : better-sqlite3 embarque ses binaires précompilés (prebuilds/) ; son script d'installation
# tenterait de recompiler, ce que l'image (sans Python ni compilateur) ne peut pas faire.
RUN npm ci --ignore-scripts
COPY . .
# `vite build` seul : le typage est vérifié par `npm run check`, pas par l'image.
RUN npx vite build

FROM node:22-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4300 DATABASE_PATH=/data/appsec.db
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4300
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts"]
