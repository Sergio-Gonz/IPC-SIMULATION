require("dotenv").config();
const io = require("socket.io-client");
const { createLogger } = require("../config/logging");
const logger = createLogger("ipc-client");
const config = require("../config/config");
const {
  ROLES,
  PROCESS_TYPES,
  SIMULATION_CONFIG,
} = require("../../config/config");
const RandomHelper = require("../../core/utils/RandomHelper");
const QueueManager = require("../../core/queue/QueueManager");
const crypto = require("crypto");

class IPCClient {
  constructor(config = {}) {
    this.config = {
      serverUrl: process.env.SERVER_URL || "http://localhost:3000",
      role: config.role || "viewer",
      reconnectInterval: {
        min: 1000,
        max: 5000,
      },
    };

    this.socket = io(this.config.serverUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: this._generateAuthToken(),
      },
    });

    this.authenticated = false;
    this.activeProcesses = new Map();
    this.queueManager = new QueueManager(logger);
    this.permissions = null;

    this._setupEventHandlers();
  }

  _generateAuthToken() {
    // En un sistema real, esto vendría de un servicio de autenticación
    return crypto
      .createHash("sha256")
      .update(`${this.config.role}-${Date.now()}`)
      .digest("hex");
  }

  _setupEventHandlers() {
    // Conexión
    this.socket.on("connect", () => {
      logger.info("Conectando al servidor:", this.socket.id);
      this._authenticate();
    });

    // Autenticación
    this.socket.on("auth_response", (response) => {
      if (response.status === "success") {
        this.authenticated = true;
        this.permissions = response.permissions;
        logger.info(`Autenticado como: ${this.config.role}`);
        logger.debug("Permisos:", this.permissions);
        this._startSimulation();
      } else {
        logger.error("Error de autenticación:", response.mensaje);
      }
    });

    // Respuestas de acciones
    this.socket.on("accion_respuesta", (response) => {
      if (response.processId) {
        this.activeProcesses.delete(response.processId);
      }

      if (response.status === "success") {
        logger.info(
          `Proceso ${response.processId} completado:`,
          response.resultado,
        );
      } else {
        logger.error(
          `Error en proceso ${response.processId}:`,
          response.mensaje,
        );
      }

      this._checkQueueAndProcess();
    });

    // Respuestas de interrupciones
    this.socket.on("interrupcion_respuesta", (response) => {
      logger.info("Respuesta de interrupción:", response.mensaje);
    });

    // Desconexión
    this.socket.on("disconnect", () => {
      logger.warn("Desconectado del servidor");
      this.authenticated = false;
      this.activeProcesses.clear();
      this.queueManager.clear();
    });

    // Errores de conexión
    this.socket.on("connect_error", (error) => {
      logger.error("Error de conexión:", error);
      if (!this.socket.connected) {
        this._scheduleReconnect();
      }
    });
  }

  _authenticate() {
    this.socket.emit("auth", {
      role: this.config.role,
      token: this._generateAuthToken(),
    });
  }

  _startSimulation() {
    // Iniciar ciclo de acciones aleatorias
    this._scheduleNextAction();

    // Si es admin, iniciar ciclo de interrupciones
    if (this.config.role === ROLES.ADMIN) {
      this._scheduleNextInterruption();
    }
  }

  _scheduleNextAction() {
    const delay = RandomHelper.getRandomTime(
      SIMULATION_CONFIG.client.actionInterval.min,
      SIMULATION_CONFIG.client.actionInterval.max,
    );
    setTimeout(() => {
      this._performRandomAction();
      this._scheduleNextAction();
    }, delay);
  }

  _scheduleNextInterruption() {
    if (this.config.role !== ROLES.ADMIN) return;

    const delay = RandomHelper.getRandomTime(5000, 15000);
    setTimeout(() => {
      this._performRandomInterruption();
      this._scheduleNextInterruption();
    }, delay);
  }

  _scheduleReconnect() {
    const delay = RandomHelper.getRandomTime(
      SIMULATION_CONFIG.client.reconnectInterval.min,
      SIMULATION_CONFIG.client.reconnectInterval.max,
    );
    setTimeout(() => {
      logger.info("Intentando reconexión...");
      this.socket.connect();
    }, delay);
  }

  hasPermission(actionType, processType) {
    return (
      this.permissions &&
      this.permissions.actions?.includes(actionType) &&
      this.permissions.processTypes?.includes(processType)
    );
  }

  _createAction(processType, actionType) {
    return {
      type: actionType,
      processType: processType,
      priority: RandomHelper.getRandomPriority(),
      data: {
        timestamp: Date.now(),
        parameters: RandomHelper.getRandomParameters(),
      },
    };
  }

  async _executeAction(action) {
    const processId = RandomHelper.generateProcessId(this.socket.id);
    this.activeProcesses.set(processId, action);

    logger.info(`Iniciando ${action.type} de tipo ${action.processType}`);
    this.socket.emit("accion", action);

    return processId;
  }

  _performRandomAction() {
    if (!this.authenticated) return;

    // Verificar límite de procesos concurrentes
    if (this.activeProcesses.size >= this.permissions?.maxConcurrentProcesses) {
      this._queueAction();
      return;
    }

    const processType = RandomHelper.getRandomProcessType(this.permissions);
    const actionType = RandomHelper.getRandomAction(this.permissions);

    if (
      !processType ||
      !actionType ||
      !this.hasPermission(actionType, processType)
    ) {
      logger.warn("Acción aleatoria generada no válida o sin permisos");
      return;
    }

    const action = this._createAction(processType, actionType);
    this._executeAction(action);
  }

  _queueAction() {
    if (!this.queueManager.canEnqueue()) return;

    const processType = RandomHelper.getRandomProcessType(this.permissions);
    const actionType = RandomHelper.getRandomAction(this.permissions);

    if (!processType || !actionType) return;

    const action = this._createAction(processType, actionType);
    this.queueManager.enqueue(action);
  }

  _checkQueueAndProcess() {
    if (
      !this.queueManager.isEmpty &&
      this.activeProcesses.size < this.permissions?.maxConcurrentProcesses
    ) {
      const nextAction = this.queueManager.dequeue();
      if (nextAction) {
        this._executeAction(nextAction);
      }
    }
  }

  _performRandomInterruption() {
    if (!this.authenticated || !this.permissions?.canInterrupt) return;

    const activeProcessIds = Array.from(this.activeProcesses.keys());
    if (activeProcessIds.length === 0) return;

    const randomProcessId = RandomHelper.getRandomFromArray(activeProcessIds);
    if (!randomProcessId) return;

    logger.info(`Intentando interrumpir proceso: ${randomProcessId}`);
    this.socket.emit("interrumpir", randomProcessId);
  }

  getStats() {
    return {
      authenticated: this.authenticated,
      role: this.config.role,
      socketId: this.socket.id,
      connected: this.socket.connected,
      activeProcesses: {
        count: this.activeProcesses.size,
        max: this.permissions?.maxConcurrentProcesses || 0,
        processes: Array.from(this.activeProcesses.entries()).map(
          ([id, action]) => ({
            id,
            type: action.type,
            processType: action.processType,
            priority: action.priority,
            timestamp: action.data.timestamp,
          }),
        ),
      },
      queue: this.queueManager.getStats(),
      permissions: this.permissions,
    };
  }
}

// Crear e iniciar el cliente
const client = new IPCClient();
