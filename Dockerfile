# Etapa de construcción
FROM node:20-alpine as builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del código
COPY . .

# Ejecutar pruebas y lint
RUN npm run lint && npm test

# Etapa de producción
FROM node:20-alpine

WORKDIR /app

# Copiar solo los archivos necesarios desde la etapa de construcción
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/*.js ./
COPY --from=builder /app/.env.example ./.env

# Exponer el puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3000

# Usuario no root para seguridad
USER node

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/health || exit 1

# Comando de inicio
CMD ["node", "index.js"]
