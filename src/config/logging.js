const winston = require("winston");
const path = require("path");

const defaultLogConfig = {
  console: {
    level: process.env.LOG_LEVEL || "info",
    enabled: process.env.NODE_ENV !== "production",
  },
  file: {
    level: "info",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    dirname: "logs",
  },
};

const createLogger = (serviceName, customConfig = {}) => {
  const config = {
    ...defaultLogConfig,
    ...customConfig,
  };

  const transports = [];

  // Archivo de logs de error
  transports.push(
    new winston.transports.File({
      filename: path.join(config.file.dirname, `${serviceName}-error.log`),
      level: "error",
      maxsize: config.file.maxsize,
      maxFiles: config.file.maxFiles,
    }),
  );

  // Archivo de logs combinados
  transports.push(
    new winston.transports.File({
      filename: path.join(config.file.dirname, `${serviceName}-combined.log`),
      maxsize: config.file.maxsize,
      maxFiles: config.file.maxFiles,
    }),
  );

  // Consola en desarrollo
  if (config.console.enabled) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
        level: config.console.level,
      }),
    );
  }

  return winston.createLogger({
    level: config.file.level,
    format: winston.format.combine(
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ),
    defaultMeta: { service: serviceName },
    transports,
  });
};

// Asegurar que existe el directorio de logs
const fs = require("fs");
const logDir = path.join(process.cwd(), defaultLogConfig.file.dirname);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

module.exports = {
  createLogger,
  defaultLogConfig,
};
