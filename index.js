require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const client = require('prom-client');
const logger = require('./logger');  // Se importa el logger

// Crear una nueva instancia de Registry para las métricas
const register = new client.Registry();

// Recolectar métricas predeterminadas utilizando el nuevo registry
client.collectDefaultMetrics({ register });

// Crear un contador para el endpoint /slow
const slowRequestsCounter = new client.Counter({
  name: 'slow_requests_total',
  help: 'Total de solicitudes al endpoint /slow',
  registers: [register]
});

const app = express();

// Definir todas las rutas

// Ruta raíz
app.get('/', (req, res) => {
  res.send('¡Bienvenido a la Simulación de IPC optimizada!');
});

// Endpoint para exponer las métricas de Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Endpoint que simula una respuesta lenta (30 segundos) e incrementa la métrica personalizada
app.get('/slow', (req, res) => {
  slowRequestsCounter.inc(); // Incrementa en 1
  setTimeout(() => {
    res.send('Respuesta lenta completada');
  }, 30000);
});

// Crear el servidor HTTP y configurar Socket.io
const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
  logger.info(`Proceso conectado: ${socket.id}`);
  
  socket.on('mensaje', (data) => {
    logger.info(`Mensaje recibido: ${data}`);
    socket.broadcast.emit('mensaje', data);
  });

  socket.on('disconnect', () => {
    logger.info(`Proceso desconectado: ${socket.id}`);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  logger.info(`Servidor IPC corriendo en http://localhost:${port}`);
});
