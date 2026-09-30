# VULNÉRABLE — fixture du lab, ne pas réutiliser
#
# Image de l'API Novafact. Une seule étape, une étiquette de base qui bouge, le
# jeton du registre privé passé par argument de build, et aucun changement
# d'utilisateur : le conteneur tourne en root.

FROM node:20

ENV NODE_ENV=development

# Le registre interne demande un jeton. « On le passe au build, et on efface le
# fichier après » — sauf que la couche qui l'a écrit reste dans l'image.
ARG NPM_TOKEN
RUN printf '//npm.novafact.example/:_authToken=%s\n' "$NPM_TOKEN" > /root/.npmrc

WORKDIR /app

# Tout le contexte de construction entre dans l'image : .git, .env, le state
# Terraform, les node_modules du poste de développement.
COPY . .

RUN npm install
RUN npm run build

RUN rm -f /root/.npmrc

EXPOSE 3000
CMD ["node", "dist/server/index.js"]
