const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Nivel mínimo a registrar
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [
    new transports.Console(), // Imprime en consola
    // Puedes agregar un transporte para guardar logs en archivo:
    new transports.File({ filename: 'app.log' })
  ]
});

module.exports = logger;
