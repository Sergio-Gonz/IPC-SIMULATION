# Usamos la imagen oficial de Node.js (versión 20, por ejemplo)
FROM node:20

# Establecemos el directorio de trabajo en el contenedor
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código fuente
COPY . .

# Exponemos el puerto 3000 (el servidor escucha en 3000)
EXPOSE 3000

# Comando para iniciar el servidor
CMD ["node", "index.js"]
