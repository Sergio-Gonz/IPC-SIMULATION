const cluster = require("cluster");
const os = require("os");
const logger = require("../core/logger/logger");

class ClusterManager {
  constructor() {
    this.numCPUs = os.cpus().length;
    this.maxWorkers = parseInt(process.env.MAX_WORKERS) || this.numCPUs;
    this.workerStats = new Map();
  }

  forkWorker() {
    const worker = cluster.fork();
    this.initializeWorkerStats(worker);
    return worker;
  }

  initializeWorkerStats(worker) {
    this.workerStats.set(worker.id, {
      pid: worker.process.pid,
      startTime: Date.now(),
      restarts: 0,
      lastRestart: null,
    });
  }

  updateWorkerStats(workerId, updates) {
    const stats = this.workerStats.get(workerId);
    if (stats) {
      Object.assign(stats, updates);
      this.workerStats.set(workerId, stats);
    }
  }

  handleWorkerExit(worker, code, signal) {
    const stats = this.workerStats.get(worker.id);
    const uptime = stats ? (Date.now() - stats.startTime) / 1000 : 0;

    logger.warn({
      message: `Worker ${worker.process.pid} murió`,
      details: {
        workerId: worker.id,
        exitCode: code,
        signal: signal,
        uptime: `${uptime.toFixed(2)}s`,
        restarts: stats?.restarts || 0,
      },
    });

    // Actualizar estadísticas antes de reiniciar
    if (stats) {
      this.updateWorkerStats(worker.id, {
        lastRestart: new Date().toISOString(),
        restarts: stats.restarts + 1,
      });
    }

    // Reiniciar worker
    this.forkWorker();
  }

  setupMasterProcess() {
    logger.info(
      `Master ${process.pid} iniciando con ${this.maxWorkers} workers`,
    );

    // Crear workers iniciales
    for (let i = 0; i < this.maxWorkers; i++) {
      this.forkWorker();
    }

    // Manejar salida de workers
    cluster.on("exit", (worker, code, signal) => {
      this.handleWorkerExit(worker, code, signal);
    });

    // Manejar mensajes de workers
    cluster.on("message", (worker, message) => {
      if (message.type === "status") {
        this.updateWorkerStats(worker.id, {
          lastStatus: message.data,
        });
      }
    });

    // Monitoreo periódico
    setInterval(() => {
      this.logClusterStatus();
    }, 60000); // cada minuto
  }

  setupWorkerProcess() {
    logger.info(`Worker ${process.pid} iniciando`);

    // Configurar manejo de señales
    process.on("SIGTERM", () => {
      logger.info(`Worker ${process.pid} recibió SIGTERM`);
      this.gracefulShutdown();
    });

    process.on("SIGINT", () => {
      logger.info(`Worker ${process.pid} recibió SIGINT`);
      this.gracefulShutdown();
    });

    // Cargar la aplicación
    require("./index");
  }

  gracefulShutdown() {
    logger.info(`Worker ${process.pid} iniciando apagado graceful`);

    // Dar tiempo para completar requests pendientes
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  }

  logClusterStatus() {
    const status = {
      master: process.pid,
      activeWorkers: Object.keys(cluster.workers).length,
      maxWorkers: this.maxWorkers,
      workers: Array.from(this.workerStats.entries()).map(([id, stats]) => ({
        id,
        ...stats,
        uptime: `${((Date.now() - stats.startTime) / 1000).toFixed(2)}s`,
      })),
    };

    logger.info({
      message: "Estado del cluster",
      status,
    });
  }

  getClusterMetrics() {
    return {
      workers: {
        active: Object.keys(cluster.workers).length,
        configured: this.maxWorkers,
        total: this.workerStats.size,
      },
      stats: Array.from(this.workerStats.values()).reduce(
        (acc, worker) => {
          acc.totalRestarts += worker.restarts;
          acc.avgUptime += Date.now() - worker.startTime;
          return acc;
        },
        { totalRestarts: 0, avgUptime: 0 },
      ),
    };
  }

  start() {
    if (cluster.isMaster) {
      this.setupMasterProcess();
    } else {
      this.setupWorkerProcess();
    }
  }
}

// Crear e iniciar el cluster
const clusterManager = new ClusterManager();
clusterManager.start();
