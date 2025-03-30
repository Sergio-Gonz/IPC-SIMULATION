require('dotenv').config();
const io = require('socket.io-client');

// Se conecta usando la variable de entorno SERVER_URL
const socket = io(process.env.SERVER_URL);

socket.on('connect', () => {
  console.log('Cliente conectado al servidor:', socket.id);
  socket.emit('mensaje', 'Hola desde el cliente optimizado');
});

socket.on('mensaje', (data) => {
  console.log('Mensaje recibido del servidor:', data);
});

socket.on('disconnect', () => {
  console.log('Cliente desconectado');
});

socket.on('connect_error', (error) => {
  console.log('Error de conexión:', error);
});
