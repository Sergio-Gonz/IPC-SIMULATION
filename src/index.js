require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const prometheus = require("prom-client");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const logger = require("./core/logger/logger");
const ProcessManager = require("./core/process/ProcessManager");
const MetricsCollector = require("./core/metrics/MetricsCollector");
const routes = require("./routes");
const handleConnection = require("./sockets/connectionHandler");
const { checkConnectionLimit } = require("./middleware/auth");

// Inicializar Express y Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// Inicializar gestores
const processManager = new ProcessManager();
const metricsCollector = new MetricsCollector();

// Configuración de seguridad
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true,
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite por IP
});
app.use(limiter);

// Límite de payload
app.use(express.json({ limit: "10kb" }));

// Configuración de métricas Prometheus
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
collectDefaultMetrics();

// Métricas personalizadas
const activeProcesses = new prometheus.Gauge({
  name: "ipc_active_processes",
  help: "Número de procesos activos",
});

const errorCounter = new prometheus.Counter({
  name: "ipc_errors_total",
  help: "Total de errores en el sistema",
});

const queueSize = new prometheus.Gauge({
  name: "ipc_queue_size",
  help: "Tamaño actual de la cola de procesos",
});

// Cache de métricas
let metricsCache = null;
let lastMetricsUpdate = 0;
const METRICS_CACHE_TTL = 10000; // 10 segundos

// Middleware para logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Compartir instancias con las rutas
app.locals.processManager = processManager;
app.locals.io = io;
app.locals.metricsCollector = metricsCollector;
app.locals.metricsCache = {
  get: async () => {
    const now = Date.now();
    if (!metricsCache || now - lastMetricsUpdate > METRICS_CACHE_TTL) {
      metricsCache = await prometheus.register.metrics();
      lastMetricsUpdate = now;
    }
    return metricsCache;
  },
};

// Configurar rutas
app.use("/", routes);

// Configurar Socket.IO
io.use((socket, next) => checkConnectionLimit(io, socket, next));

io.on("connection", (socket) => {
  handleConnection(io, socket, processManager);
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.error(`Error no manejado: ${err.message}`);
  errorCounter.inc();
  res.status(500).json({
    status: "error",
    message: "Error interno del servidor",
  });
});

// Actualización periódica de métricas
setInterval(() => {
  const processes = processManager.getActiveProcesses();
  activeProcesses.set(processes.length);
  queueSize.set(processManager.processQueue.length);
}, 5000);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Servidor iniciado en puerto ${PORT}`);
});
