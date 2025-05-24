require('dotenv').config();
const io = require('socket.io-client');
const { ROLES, PROCESS_TYPES, SIMULATION_CONFIG } = require('./config');

class IPCClient {
  constructor(config = {}) {
    this.config = {
      serverUrl: 'http://localhost:3000',
      role: config.role || 'viewer',
      reconnectInterval: {
        min: 1000,
        max: 5000
      }
    };
    
    this.socket = io(this.config.serverUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.authenticated = false;
    this.activeProcesses = new Map();
    this.processQueue = [];
    this.permissions = null;

    this._setupEventHandlers();
  }

  _setupEventHandlers() {
    // Conexión
    this.socket.on('connect', () => {
      console.log('Conectando al servidor:', this.socket.id);
      this._authenticate();
    });

    // Autenticación
    this.socket.on('auth_response', (response) => {
      if (response.status === 'success') {
        this.authenticated = true;
        this.permissions = response.permissions;
        console.log(`Autenticado como: ${this.config.role}`);
        console.log('Permisos:', this.permissions);
        this._startSimulation();
      } else {
        console.error('Error de autenticación:', response.mensaje);
      }
    });

    // Respuestas de acciones
    this.socket.on('accion_respuesta', (response) => {
      if (response.processId) {
        this.activeProcesses.delete(response.processId);
      }

      if (response.status === 'success') {
        console.log(`Proceso ${response.processId} completado:`, response.resultado);
      } else {
        console.error(`Error en proceso ${response.processId}:`, response.mensaje);
      }

      this._checkQueueAndProcess();
    });

    // Respuestas de interrupciones
    this.socket.on('interrupcion_respuesta', (response) => {
      console.log('Respuesta de interrupción:', response.mensaje);
    });

    // Desconexión
    this.socket.on('disconnect', () => {
      console.log('Desconectado del servidor');
      this.authenticated = false;
      this.activeProcesses.clear();
      this.processQueue = [];
    });

    // Errores de conexión
    this.socket.on('connect_error', (error) => {
      console.log('Error de conexión:', error);
      this._scheduleReconnect();
    });
  }

  _authenticate() {
    this.socket.emit('auth', { role: this.config.role });
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
    const delay = this._getRandomTime(
      SIMULATION_CONFIG.client.actionInterval.min,
      SIMULATION_CONFIG.client.actionInterval.max
    );
    setTimeout(() => {
      this._performRandomAction();
      this._scheduleNextAction();
    }, delay);
  }

  _scheduleNextInterruption() {
    if (this.config.role !== ROLES.ADMIN) return;

    const delay = this._getRandomTime(5000, 15000);
    setTimeout(() => {
      this._performRandomInterruption();
      this._scheduleNextInterruption();
    }, delay);
  }

  _scheduleReconnect() {
    const delay = this._getRandomTime(
      SIMULATION_CONFIG.client.reconnectInterval.min,
      SIMULATION_CONFIG.client.reconnectInterval.max
    );
    setTimeout(() => {
      console.log('Intentando reconexión...');
      this.socket.connect();
    }, delay);
  }

  _getRandomTime(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  _getRandomProcessType() {
    const availableTypes = this.permissions?.processTypes || [];
    return availableTypes[Math.floor(Math.random() * availableTypes.length)];
  }

  _getRandomAction() {
    const availableActions = this.permissions?.actions || [];
    return availableActions[Math.floor(Math.random() * availableActions.length)];
  }

  _performRandomAction() {
    if (!this.authenticated) return;

    // Verificar límite de procesos concurrentes
    if (this.activeProcesses.size >= this.permissions.maxConcurrentProcesses) {
      if (this.processQueue.length < SIMULATION_CONFIG.client.maxQueueSize) {
        this._queueAction();
      }
      return;
    }

    const processType = this._getRandomProcessType();
    const actionType = this._getRandomAction();

    if (!processType || !actionType) return;

    const action = {
      type: actionType,
      processType: processType,
      priority: Math.floor(Math.random() * 3) + 1,
      data: {
        timestamp: Date.now(),
        parameters: {
          value: Math.random() * 100,
          iterations: Math.floor(Math.random() * 10) + 1
        }
      }
    };

    const processId = `${this.socket.id}-${Date.now()}`;
    this.activeProcesses.set(processId, action);

    console.log(`Iniciando ${action.type} de tipo ${action.processType}`);
    this.socket.emit('accion', action);
  }

  _queueAction() {
    const action = {
      timestamp: Date.now(),
      type: this._getRandomAction(),
      processType: this._getRandomProcessType()
    };
    this.processQueue.push(action);
    console.log('Acción en cola:', action);
  }

  _checkQueueAndProcess() {
    if (this.processQueue.length > 0 && 
        this.activeProcesses.size < this.permissions.maxConcurrentProcesses) {
      const nextAction = this.processQueue.shift();
      this._performRandomAction();
    }
  }

  _performRandomInterruption() {
    if (!this.authenticated || !this.permissions?.canInterrupt) return;

    const activeProcessIds = Array.from(this.activeProcesses.keys());
    if (activeProcessIds.length === 0) return;

    const randomProcessId = activeProcessIds[
      Math.floor(Math.random() * activeProcessIds.length)
    ];

    console.log(`Intentando interrumpir proceso: ${randomProcessId}`);
    this.socket.emit('interrumpir', randomProcessId);
  }
}

// Crear e iniciar el cliente
const client = new IPCClient();
