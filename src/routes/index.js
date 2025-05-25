const express = require('express');
const prometheus = require('prom-client');
const config = require('../config/config');
const { checkSystemHealth } = require('../utils/systemHealth');
const logger = require('../core/logger/logger');

const router = express.Router();

// Ruta principal
router.get('/', (req, res) => {
  res.send('¡Bienvenido a la Simulación de IPC optimizada con RLS!');
});

// Ruta de métricas
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheus.register.contentType);
    const metrics = await prometheus.register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error(`Error en /metrics: ${error.message}`);
    res.status(500).send(error.message);
  }
});

// Ruta de estado
router.get('/status', (req, res) => {
  const activeProcesses = req.app.locals.processManager.getActiveProcesses();
  const status = {
    activeProcesses: activeProcesses.length,
    processTypes: Object.values(config.PROCESS_TYPES).reduce((acc, type) => {
      acc[type] = activeProcesses.filter((p) => p.type === type).length;
      return acc;
    }, {}),
    connectedClients: req.app.locals.io.sockets.sockets.size,
  };
  res.json(status);
});

// Ruta de salud
router.get('/health', (req, res) => {
  const systemHealth = checkSystemHealth(
    req.app.locals.processManager,
    req.app.locals.io,
  );
  const healthData = {
    status: systemHealth.status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      total: req.app.locals.io.sockets.sockets.size,
      byRole: Array.from(req.app.locals.io.sockets.sockets.values()).reduce(
        (acc, socket) => {
          const role = socket.clientData?.role || 'unknown';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        },
        {},
      ),
    },
    processes: {
      active: req.app.locals.processManager.getActiveProcesses().length,
      total: req.app.locals.processManager.processes.size,
      byState: Object.values(config.PROCESS_STATES).reduce((acc, state) => {
        acc[state] =
          req.app.locals.processManager.getProcessesByState(state).length;
        return acc;
      }, {}),
      byType: Object.values(config.PROCESS_TYPES).reduce((acc, type) => {
        acc[type] = req.app.locals.processManager
          .getActiveProcesses()
          .filter((p) => p.type === type).length;
        return acc;
      }, {}),
    },
  };

  if (systemHealth.issues.length > 0) {
    healthData.issues = systemHealth.issues;
    res.status(429).json(healthData);
  } else {
    res.json(healthData);
  }
});

// Ruta de estado detallado
router.get('/status/detailed', async (req, res) => {
  const activeProcesses = req.app.locals.processManager.getActiveProcesses();
  const detailedStatus = {
    system: {
      version: process.env.npm_package_version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      health: checkSystemHealth(
        req.app.locals.processManager,
        req.app.locals.io,
      ),
    },
    processes: {
      active: activeProcesses,
      queue: req.app.locals.processManager.processQueue,
      statistics: {
        totalProcessed: req.app.locals.processManager.processes.size,
        activeCount: activeProcesses.length,
        queueLength: req.app.locals.processManager.processQueue.length,
        byType: Object.values(config.PROCESS_TYPES).reduce((acc, type) => {
          acc[type] = {
            active: activeProcesses.filter((p) => p.type === type).length,
            total: Array.from(
              req.app.locals.processManager.processes.values(),
            ).filter((p) => p.type === type).length,
          };
          return acc;
        }, {}),
      },
    },
  };
  res.json(detailedStatus);
});

module.exports = router;
