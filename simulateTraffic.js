const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
// Prueba con un número menor inicialmente, por ejemplo, 100
const NUM_CLIENTS = 100; 
const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
  // Configuración de reconexión personalizada:
  const client = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: 5,  // Intenta reconectar hasta 5 veces
    reconnectionDelay: 1000    // Espera 1 segundo entre intentos
  });

  client.on('connect', () => {
    console.log(`Cliente ${i} conectado: ${client.id}`);
    // Envía un mensaje cada 5 segundos
    setInterval(() => {
      client.emit('mensaje', `Hola desde cliente ${i}`);
    }, 5000);
  });

  client.on('connect_error', (error) => {
    console.log(`Error de conexión en cliente ${i}:`, error.message);
  });

  client.on('mensaje', (data) => {
    console.log(`Cliente ${i} recibió: ${data}`);
  });

  client.on('disconnect', () => {
    console.log(`Cliente ${i} desconectado`);
  });

  clients.push(client);
}
