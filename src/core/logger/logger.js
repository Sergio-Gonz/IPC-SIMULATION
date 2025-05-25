const { createLogger } = require("../../config/logging");

// Crear logger principal de la aplicación
const logger = createLogger("ipc-simulation");

module.exports = logger;
