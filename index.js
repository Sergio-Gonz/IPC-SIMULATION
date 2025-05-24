require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const logger = require('./logger');
const ProcessManager = require('./ProcessManager');
const MetricsCollector = require('./MetricsCollector');
const { PERMISSIONS, SIMULATION_CONFIG, PROCESS_TYPES, PROCESS_STATES } = require('./config');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Inicializar gestores
const processManager = new ProcessManager();
const metricsCollector = new MetricsCollector();

// Middleware para verificar límites de conexión
io.use((socket, next) => {
  const clientCount = io.sockets.sockets.size;
  if (clientCount >= SIMULATION_CONFIG.server.maxConnections) {
    next(new Error('Servidor al límite de conexiones'));
    return;
  }
  next();
});

// Rutas HTTP
app.get('/', (req, res) => {
  res.send('¡Bienvenido a la Simulación de IPC optimizada con RLS!');
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsCollector.getContentType());
    res.end(await metricsCollector.getMetrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

app.get('/status', (req, res) => {
  const status = {
    activeProcesses: processManager.getActiveProcesses().length,
    processTypes: Object.values(PROCESS_TYPES).reduce((acc, type) => {
      acc[type] = processManager.getProcessesByState('RUNNING')
        .filter(p => p.type === type).length;
      return acc;
    }, {}),
    connectedClients: io.sockets.sockets.size
  };
  res.json(status);
});

// Endpoint de salud
app.get('/health', (req, res) => {
  const systemHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      total: io.sockets.sockets.size,
      byRole: Array.from(io.sockets.sockets.values()).reduce((acc, socket) => {
        const role = socket.clientData?.role || 'unknown';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {})
    },
    processes: {
      active: processManager.getActiveProcesses().length,
      total: processManager.processes.size,
      byState: Object.values(PROCESS_STATES).reduce((acc, state) => {
        acc[state] = processManager.getProcessesByState(state).length;
        return acc;
      }, {}),
      byType: Object.values(PROCESS_TYPES).reduce((acc, type) => {
        acc[type] = processManager.getActiveProcesses().filter(p => p.type === type).length;
        return acc;
      }, {})
    }
  };

  // Verificar umbrales críticos
  const healthIssues = [];

  // Verificar memoria
  const memoryUsagePercent = (systemHealth.memory.heapUsed / systemHealth.memory.heapTotal) * 100;
  if (memoryUsagePercent > 85) {
    healthIssues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
  }

  // Verificar conexiones
  if (systemHealth.connections.total >= SIMULATION_CONFIG.server.maxConnections * 0.9) {
    healthIssues.push(`High connection count: ${systemHealth.connections.total}`);
  }

  // Verificar procesos activos
  const totalActiveProcesses = systemHealth.processes.active;
  if (totalActiveProcesses > 100) {
    healthIssues.push(`High active process count: ${totalActiveProcesses}`);
  }

  if (healthIssues.length > 0) {
    systemHealth.status = 'degraded';
    systemHealth.issues = healthIssues;
    res.status(warning ? 429 : 200).json(systemHealth);
  } else {
    res.json(systemHealth);
  }
});

// Endpoint detallado de estado del sistema
app.get('/status/detailed', async (req, res) => {
  const detailedStatus = {
    system: {
      version: process.env.npm_package_version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    processes: {
      active: processManager.getActiveProcesses(),
      queue: processManager.processQueue,
      statistics: {
        totalProcessed: processManager.processes.size,
        activeCount: processManager.getActiveProcesses().length,
        queueLength: processManager.processQueue.length,
        byType: Object.values(PROCESS_TYPES).reduce((acc, type) => {
          acc[type] = {
            active: processManager.getActiveProcesses().filter(p => p.type === type).length,
            total: Array.from(processManager.processes.values()).filter(p => p.type === type).length
          };
          return acc;
        }, {})
      }
    },
    clients: {
      connected: Array.from(io.sockets.sockets.values()).map(socket => ({
        id: socket.id,
        role: socket.clientData?.role,
        activeProcesses: socket.clientData?.processes.size || 0,
        connectedSince: socket.handshake.time
      }))
    },
    metrics: await metricsCollector.getMetrics()
  };

  res.json(detailedStatus);
});

// Verificar permisos
const tienePermiso = (role, actionType, processType) => {
  const permisos = PERMISSIONS[role];
  return permisos &&
    permisos.actions.includes(actionType) &&
    permisos.processTypes.includes(processType);
};

// Manejo de eventos de Socket.IO
io.on('connection', (socket) => {
  socket.on('auth', (credentials) => {
    const role = credentials.role;
    if (!PERMISSIONS[role]) {
      socket.emit('auth_response', {
        status: 'error',
        mensaje: 'Rol no válido'
      });
      return;
    }

    socket.clientData = {
      role,
      processes: new Set(),
      authenticated: true
    };

    metricsCollector.recordClientConnection(role);
    logger.info(`Cliente conectado: ${socket.id} con rol: ${role}`);

    socket.emit('auth_response', {
      status: 'success',
      permissions: PERMISSIONS[role]
    });
  });

  socket.on('accion', async (action) => {
    if (!socket.clientData?.authenticated) {
      socket.emit('accion_respuesta', {
        status: 'error',
        mensaje: 'Cliente no autenticado'
      });
      return;
    }

    const role = socket.clientData.role;
    const processId = `${socket.id}-${Date.now()}`;

    if (!tienePermiso(role, action.type, action.processType)) {
      metricsCollector.recordDeniedAction(action.type, role);
      socket.emit('accion_respuesta', {
        status: 'error',
        mensaje: 'No tienes permisos para esta acción'
      });
      return;
    }

    // Verificar límite de procesos concurrentes
    const activeProcessCount = socket.clientData.processes.size;
    if (activeProcessCount >= PERMISSIONS[role].maxConcurrentProcesses) {
      metricsCollector.recordDeniedAction(action.type, role);
      socket.emit('accion_respuesta', {
        status: 'error',
        mensaje: 'Límite de procesos concurrentes alcanzado'
      });
      return;
    }

    try {
      const process = processManager.createProcess(processId, {
        type: action.processType,
        priority: action.priority,
        data: action.data,
        owner: socket.id,
        role: role
      });

      socket.clientData.processes.add(processId);
      metricsCollector.recordProcessStart(process);

      const result = await processManager.startProcess(processId);
      metricsCollector.recordProcessEnd(result);

      socket.emit('accion_respuesta', {
        status: 'success',
        processId,
        resultado: result
      });
    } catch (error) {
      metricsCollector.recordError('process_error', action.processType, role);
      socket.emit('accion_respuesta', {
        status: 'error',
        mensaje: error.message,
        processId
      });
    } finally {
      socket.clientData.processes.delete(processId);
    }
  });

  socket.on('interrumpir', (processId) => {
    if (!socket.clientData?.authenticated) return;

    const role = socket.clientData.role;
    if (!PERMISSIONS[role].canInterrupt) {
      metricsCollector.recordDeniedAction('interrumpir', role);
      socket.emit('interrupcion_respuesta', {
        status: 'error',
        mensaje: 'No tienes permisos para interrumpir procesos'
      });
      return;
    }

    const success = processManager.interruptProcess(processId);
    socket.emit('interrupcion_respuesta', {
      status: success ? 'success' : 'error',
      mensaje: success ? 'Proceso interrumpido' : 'Proceso no encontrado'
    });
  });

  socket.on('disconnect', () => {
    if (socket.clientData?.authenticated) {
      const role = socket.clientData.role;

      // Cancelar todos los procesos activos del cliente
      socket.clientData.processes.forEach(processId => {
        processManager.interruptProcess(processId);
      });

      metricsCollector.recordClientDisconnection(role);
      logger.info(`Cliente desconectado: ${socket.id} (rol: ${role})`);
    }
  });
});

// Limpieza periódica de procesos
setInterval(() => {
  processManager.cleanup();
}, SIMULATION_CONFIG.server.processCleanupInterval);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  logger.info(`Servidor IPC corriendo en http://localhost:${port}`);
});
