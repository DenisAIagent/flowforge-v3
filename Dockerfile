FROM node:18-alpine

WORKDIR /usr/src/app

# Copier package.json et installer dependencies
COPY package*.json ./
RUN npm install --production

# Copier le code source
COPY . .

# Variables d'environnement
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3000

# Exposer le port
EXPOSE 3000

# Healthcheck simple
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Démarrer l'application
CMD ["node", "src/simple-server.js"]

