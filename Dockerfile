# Etapa de construcción
FROM node:20-alpine as builder

# Establecer variables de construcción
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Crear usuario no root para la construcción
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias con flags de seguridad
RUN npm ci --only=production --audit=true --no-optional

# Copiar el resto del código
COPY --chown=appuser:appgroup . .

# Ejecutar pruebas y lint
RUN npm run lint && npm test

# Etapa de producción
FROM node:20-alpine

# Establecer variables de entorno
ENV NODE_ENV=production \
    PORT=3000 \
    # Deshabilitar el debugger de Node.js en producción
    NODE_OPTIONS='--no-deprecation --no-warnings --max-old-space-size=2048' \
    # Configuraciones de seguridad adicionales
    NPM_CONFIG_AUDIT=true \
    NPM_CONFIG_AUDIT_LEVEL=high \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_LOGLEVEL=warn

# Crear usuario no root para la aplicación
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    # Crear directorios necesarios con permisos correctos
    mkdir -p /app/logs /app/data && \
    chown -R appuser:appgroup /app

WORKDIR /app

# Copiar solo los archivos necesarios desde la etapa de construcción
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/*.js ./
COPY --from=builder --chown=appuser:appgroup /app/.env.example ./.env

# Establecer permisos restrictivos
RUN chmod -R 550 /app && \
    chmod -R 660 /app/logs /app/data

# Exponer el puerto
EXPOSE 3000

# Cambiar al usuario no root
USER appuser

# Healthcheck mejorado con timeout y retry
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Comando de inicio con opciones de seguridad
CMD ["node", "--no-deprecation", "--no-warnings", "index.js"]
