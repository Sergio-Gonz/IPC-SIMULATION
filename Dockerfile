# Etapa de construcción
FROM node:20 AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Etapa final: imagen más ligera sin herramientas de compilación
FROM node:20-slim

# Crear un usuario no root
RUN useradd --user-group --create-home --shell /bin/false appuser

WORKDIR /app

# Copiar los archivos necesarios desde la etapa de construcción
COPY --from=builder /app ./

# Cambiar a usuario no root
USER appuser

EXPOSE 3000

# Si usas clustering, asegúrate de ejecutar cluster.js
CMD ["node", "cluster.js"]
