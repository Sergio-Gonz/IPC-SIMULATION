require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const client = require('prom-client');

const app = express();

// Recolectar métricas predeterminadas
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client });

// Endpoint para Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Ruta raíz para verificar que el servidor responde
app.get('/', (req, res) => {
  res.send('¡Bienvenido a la Simulación de IPC optimizada y monitorizada!');
});

const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
    console.log('Proceso conectado:', socket.id);
    
    socket.on('mensaje', (data) => {
        console.log('Mensaje recibido:', data);
        socket.broadcast.emit('mensaje', data);
    });

    socket.on('disconnect', () => {
        console.log('Proceso desconectado:', socket.id);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor IPC corriendo en http://localhost:${port}`);
});
