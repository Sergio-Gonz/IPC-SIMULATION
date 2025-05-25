const logger = require("../core/logger/logger");
const {
  checkRateLimit,
  validateAuth,
  validateAction,
  tienePermiso,
} = require("../middleware/auth");
const config = require("../config/config");

/**
 * Maneja las conexiones de socket y sus eventos
 * @param {SocketIO.Server} io - Instancia del servidor Socket.IO
 * @param {SocketIO.Socket} socket - Socket del cliente
 * @param {ProcessManager} processManager - Gestor de procesos
 */
const handleConnection = (io, socket, processManager) => {
  // Cache de procesos activos para optimizar rendimiento
  let activeProcessesCache = null;
  let lastCacheUpdate = 0;
  const CACHE_TTL = 5000; // 5 segundos

  const getActiveProcesses = () => {
    const now = Date.now();
    if (!activeProcessesCache || now - lastCacheUpdate > CACHE_TTL) {
      activeProcessesCache = processManager.getActiveProcesses();
      lastCacheUpdate = now;
    }
    return activeProcessesCache;
  };

  socket.on("auth", async (credentials) => {
    const validationResult = await validateAuth(credentials);

    if (!validationResult.isValid) {
      socket.emit("auth_response", {
        status: "error",
        mensaje: validationResult.error,
      });
      return;
    }

    socket.clientData = {
      ...validationResult.tokenData,
      authenticated: true,
    };

    socket.emit("auth_response", {
      status: "success",
      permissions: config.PERMISSIONS[credentials.role],
    });

    logger.info(`Cliente autenticado como ${credentials.role}: ${socket.id}`);
  });

  socket.on("accion", async (action) => {
    if (!socket.clientData?.authenticated) {
      socket.emit("accion_respuesta", {
        status: "error",
        mensaje: "No autenticado",
      });
      return;
    }

    if (!checkRateLimit(socket.id)) {
      socket.emit("accion_respuesta", {
        status: "error",
        mensaje: "Rate limit excedido",
      });
      return;
    }

    const validationResult = await validateAction(action);
    if (!validationResult.isValid) {
      socket.emit("accion_respuesta", {
        status: "error",
        mensaje: validationResult.error,
      });
      return;
    }

    if (
      !tienePermiso(socket.clientData.role, action.type, action.processType)
    ) {
      socket.emit("accion_respuesta", {
        status: "error",
        mensaje: "Permiso denegado",
      });
      return;
    }

    try {
      const processId = await processManager.createProcess(socket.id, {
        ...action,
        owner: socket.id,
        role: socket.clientData.role,
      });

      await processManager.startProcess(processId);

      socket.emit("accion_respuesta", {
        status: "success",
        processId,
        mensaje: "Proceso iniciado correctamente",
      });
    } catch (error) {
      logger.error(`Error al procesar acción: ${error.message}`);
      socket.emit("accion_respuesta", {
        status: "error",
        mensaje: error.message,
      });
    }
  });

  socket.on("interrumpir", async (processId) => {
    if (!socket.clientData?.authenticated) {
      socket.emit("interrupcion_respuesta", {
        status: "error",
        mensaje: "No autenticado",
      });
      return;
    }

    try {
      const proceso = processManager.getProcess(processId);
      if (!proceso) {
        throw new Error("Proceso no encontrado");
      }

      if (proceso.owner !== socket.id && socket.clientData.role !== "admin") {
        throw new Error("No tienes permiso para interrumpir este proceso");
      }

      await processManager.interruptProcess(processId);
      socket.emit("interrupcion_respuesta", {
        status: "success",
        mensaje: "Proceso interrumpido correctamente",
      });
    } catch (error) {
      logger.error(`Error al interrumpir proceso: ${error.message}`);
      socket.emit("interrupcion_respuesta", {
        status: "error",
        mensaje: error.message,
      });
    }
  });

  socket.on("disconnect", () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
    // Limpiar caché al desconectar
    activeProcessesCache = null;
  });
};

module.exports = handleConnection;
