# syntax=docker/dockerfile:1.7
#
# Image de l'API Novafact.

# CORRIGÉ : construction en deux étapes. L'étape de build a la chaîne d'outils
# et les dépendances de développement ; l'image finale ne reçoit que le
# résultat, sur une base neuve.
#
# CORRIGÉ : l'image de base est épinglée par empreinte. Une étiquette est un
# alias qui bouge — deux constructions à une semaine d'écart ne produisent pas
# le même système. L'empreinte, elle, EST l'image. Renovate renouvelle la ligne
# et ouvre la PR quand une nouvelle version sort.
FROM node:20.18.1-bookworm-slim@sha256:8399d62704124c963ff2f5a235b89c3b4980842b1b2aaa1961490c879153a104 AS build

WORKDIR /app

# CORRIGÉ : plus d'ARG NPM_TOKEN. Un argument de build est visible dans
# l'historique des couches (`docker history`) et dans le cache du constructeur,
# même si le fichier qu'il a servi à écrire est supprimé ensuite. Le secret est
# monté le temps de la commande et n'entre dans aucune couche.
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_token \
    npm config set //npm.novafact.example/:_authToken "$(cat /run/secrets/npm_token)" \
    && npm ci \
    && npm config delete //npm.novafact.example/:_authToken

# CORRIGÉ : des copies explicites, plus de « COPY . . ». Ce qui n'est pas
# nommé ici n'entre pas dans l'image — ni .git, ni .env, ni le state Terraform.
COPY tsconfig.json ./
COPY server ./server
COPY src ./src
RUN npm run build

# ── Image finale ─────────────────────────────────────────────────────────────
FROM node:20.18.1-bookworm-slim@sha256:8399d62704124c963ff2f5a235b89c3b4980842b1b2aaa1961490c879153a104 AS runtime

ENV NODE_ENV=production
WORKDIR /app

# CORRIGÉ : seules les dépendances de production entrent dans l'image finale.
# `npm ci` seul installe aussi les devDependencies, quel que soit NODE_ENV.
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_token \
    npm config set //npm.novafact.example/:_authToken "$(cat /run/secrets/npm_token)" \
    && npm ci --omit=dev \
    && npm config delete //npm.novafact.example/:_authToken \
    && npm cache clean --force

COPY --from=build /app/dist ./dist

# CORRIGÉ : le conteneur ne tourne plus en root. C'est la DERNIÈRE instruction
# USER du fichier qui décide de l'utilisateur du processus : en ajouter une au
# milieu ne change rien si une autre la suit.
USER node

EXPOSE 3000

# Le système de fichiers est monté en lecture seule au déploiement
# (readOnlyRootFilesystem côté Kubernetes, --read-only côté Docker) ; /tmp est
# le seul volume inscriptible.
CMD ["node", "dist/server/index.js"]
