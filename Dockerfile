# Etapa de construcción
FROM node:20-alpine as builder

# Crear directorio de la app
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Ejecutar linting y pruebas
RUN npm run lint
RUN npm run test:unit

# Etapa de producción
FROM node:20-alpine

# Crear directorio de la app
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm install --omit=dev

# Copiar el código construido
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/config ./config

# Crear usuario no root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /usr/src/app

# Cambiar a usuario no root
USER nodejs

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3000

# Exponer el puerto
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["node", "src/index.js"] 