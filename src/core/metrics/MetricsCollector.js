const prometheus = require('prom-client');
const { METRICS_CONFIG } = require('../../config/config');
const logger = require('../../core/logger/logger');

/**
 * Colector de métricas para el sistema IPC
 * Proporciona métricas detalladas sobre procesos, conexiones, errores y rendimiento
 * para su consumo por Prometheus y visualización en Grafana.
 */
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.initializeMetrics();
  }

  /**
   * Inicializa todas las métricas del sistema
   * @private
   */
  initializeMetrics() {
    // Crear registro personalizado
    this.register = new prometheus.Registry();

    // Configurar métricas por defecto
    prometheus.collectDefaultMetrics({
      register: this.register,
      prefix: 'ipc_',
      labels: { application: 'ipc_server' },
    });

    this._initializeMetrics();
  }

  /**
   * Inicializa todas las métricas del sistema
   * @private
   */
  _initializeMetrics() {
    // Métricas de procesos
    this.processCounter = new prometheus.Counter({
      name: 'ipc_processes_total',
      help: 'Total de procesos creados',
      labelNames: ['process_type', 'role', 'state'],
      registers: [this.register],
    });

    this.processTimeHistogram = new prometheus.Histogram({
      name: 'ipc_process_duration_seconds',
      help: 'Duración de los procesos en segundos',
      labelNames: ['process_type', 'role', 'state'],
      buckets: METRICS_CONFIG.processTimeBuckets,
      registers: [this.register],
    });

    this.activeProcessesGauge = new prometheus.Gauge({
      name: 'ipc_active_processes',
      help: 'Número actual de procesos activos',
      labelNames: ['process_type', 'role'],
      registers: [this.register],
    });

    // Métricas de cola
    this.queueSizeGauge = new prometheus.Gauge({
      name: 'ipc_queue_size_current',
      help: 'Tamaño actual de la cola de procesos',
      labelNames: ['process_type'],
      registers: [this.register],
    });

    this.queueWaitTimeHistogram = new prometheus.Histogram({
      name: 'ipc_queue_wait_time_seconds',
      help: 'Tiempo de espera en cola en segundos',
      labelNames: ['process_type', 'priority'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Métricas de errores
    this.errorCounter = new prometheus.Counter({
      name: 'ipc_errors_total',
      help: 'Total de errores por tipo',
      labelNames: ['error_type', 'process_type', 'role'],
      registers: [this.register],
    });

    // Métricas de conexiones
    this.connectionGauge = new prometheus.Gauge({
      name: 'ipc_connections_current',
      help: 'Número actual de conexiones',
      labelNames: ['role'],
      registers: [this.register],
    });

    // Métricas de acciones
    this.actionCounter = new prometheus.Counter({
      name: 'ipc_actions_total',
      help: 'Total de acciones realizadas',
      labelNames: ['action_type', 'role', 'status'],
      registers: [this.register],
    });

    // Métricas de recursos
    this.resourceUsageGauge = new prometheus.Gauge({
      name: 'ipc_resource_usage_percent',
      help: 'Uso de recursos del sistema',
      labelNames: ['resource_type'],
      registers: [this.register],
    });
  }

  /**
   * Obtiene las etiquetas comunes para un proceso
   * @private
   * @param {Object} process - Proceso del cual obtener etiquetas
   * @returns {Object} Objeto con las etiquetas
   */
  _getProcessLabels(process) {
    if (!this._validateProcess(process)) {
      logger.warn('Proceso inválido para etiquetas:', process);
      return {
        process_type: 'unknown',
        role: 'unknown',
        state: 'unknown',
      };
    }

    return {
      process_type: process.type,
      role: process.role,
      state: process.state,
    };
  }

  /**
   * Valida que un proceso tenga todas las propiedades necesarias
   * @private
   * @param {Object} process - Proceso a validar
   * @returns {boolean} true si el proceso es válido
   */
  _validateProcess(process) {
    return (
      process &&
      typeof process === 'object' &&
      process.type &&
      process.role &&
      process.state
    );
  }

  /**
   * Registra el inicio de un proceso
   * @param {Object} process - Proceso iniciado
   */
  recordProcessStart(process) {
    if (!this._validateProcess(process)) {
      logger.error('Proceso inválido en recordProcessStart:', process);
      return;
    }

    const labels = this._getProcessLabels(process);
    this.processCounter.inc(labels);
    this.activeProcessesGauge.inc(labels);

    logger.debug('Proceso iniciado:', { process_id: process.id, ...labels });
  }

  /**
   * Registra la finalización de un proceso
   * @param {Object} process - Proceso finalizado
   */
  recordProcessEnd(process) {
    if (!this._validateProcess(process) || !process.startTime) {
      logger.error('Proceso inválido en recordProcessEnd:', process);
      return;
    }

    const labels = this._getProcessLabels(process);
    const duration = (Date.now() - process.startTime) / 1000;

    this.processTimeHistogram.observe(labels, duration);
    this.activeProcessesGauge.dec(labels);

    logger.debug('Proceso finalizado:', {
      process_id: process.id,
      duration,
      ...labels,
    });
  }

  /**
   * Registra un error en el sistema
   * @param {string} errorType - Tipo de error
   * @param {string} processType - Tipo de proceso
   * @param {string} role - Rol que experimentó el error
   */
  recordError(errorType, processType, role) {
    const labels = {
      error_type: errorType,
      process_type: processType || 'unknown',
      role: role || 'unknown',
    };

    this.errorCounter.inc(labels);
    logger.error('Error registrado:', labels);
  }

  /**
   * Registra una conexión de cliente
   * @param {string} role - Rol del cliente
   */
  recordClientConnection(role) {
    if (!role) {
      logger.warn('Rol no especificado en conexión de cliente');
      return;
    }

    this.connectionGauge.inc({ role });
    logger.debug('Cliente conectado:', { role });
  }

  /**
   * Registra una desconexión de cliente
   * @param {string} role - Rol del cliente
   */
  recordClientDisconnection(role) {
    if (!role) {
      logger.warn('Rol no especificado en desconexión de cliente');
      return;
    }

    this.connectionGauge.dec({ role });
    logger.debug('Cliente desconectado:', { role });
  }

  /**
   * Registra una acción denegada
   * @param {string} actionType - Tipo de acción
   * @param {string} role - Rol que intentó la acción
   */
  recordDeniedAction(actionType, role) {
    const labels = {
      action_type: actionType,
      role: role,
      status: 'denied',
    };

    this.actionCounter.inc(labels);
    logger.warn('Acción denegada:', labels);
  }

  /**
   * Registra el tamaño actual de la cola
   * @param {number} size - Tamaño actual de la cola
   * @param {string} processType - Tipo de proceso en cola
   */
  recordQueueSize(size, processType = 'all') {
    this.queueSizeGauge.set({ process_type: processType }, size);

    if (size > METRICS_CONFIG.queueWarningThreshold) {
      logger.warn('Cola alcanzó tamaño de advertencia:', {
        size,
        process_type: processType,
        threshold: METRICS_CONFIG.queueWarningThreshold,
      });
    }
  }

  /**
   * Registra el tiempo de espera en cola de un proceso
   * @param {Object} process - Proceso que estuvo en cola
   * @param {number} waitTime - Tiempo de espera en milisegundos
   */
  recordQueueWaitTime(process, waitTime) {
    if (!this._validateProcess(process)) {
      logger.error('Proceso inválido en recordQueueWaitTime:', process);
      return;
    }

    const waitTimeSeconds = waitTime / 1000;
    this.queueWaitTimeHistogram.observe(
      {
        process_type: process.type,
        priority: process.priority || 'normal',
      },
      waitTimeSeconds,
    );

    logger.debug('Tiempo de espera en cola:', {
      process_id: process.id,
      wait_time: waitTimeSeconds,
      process_type: process.type,
      priority: process.priority,
    });
  }

  /**
   * Registra el uso de recursos del sistema
   * @param {Object} usage - Objeto con porcentajes de uso de recursos
   */
  recordResourceUsage(usage) {
    if (!usage || typeof usage !== 'object') {
      logger.error('Uso de recursos inválido:', usage);
      return;
    }

    Object.entries(usage).forEach(([resource, value]) => {
      this.resourceUsageGauge.set({ resource_type: resource }, value);
    });

    logger.debug('Uso de recursos actualizado:', usage);
  }

  /**
   * Obtiene todas las métricas actuales
   * @returns {Promise<string>} Métricas en formato Prometheus
   */
  async getMetrics() {
    try {
      return await this.register.metrics();
    } catch (error) {
      logger.error('Error al obtener métricas:', error);
      throw error;
    }
  }

  /**
   * Limpia todas las métricas
   */
  reset() {
    this.register.clear();
    this._initializeMetrics();
    logger.info('Métricas reiniciadas');
  }
}

module.exports = new MetricsCollector();
