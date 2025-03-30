const cluster = require('cluster');
const os = require('os');
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} ejecutándose`);
  // Crear un worker por cada núcleo
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} murió. Reiniciándolo...`);
    cluster.fork();
  });
} else {
  // Cargar la aplicación
  require('./index');
}
