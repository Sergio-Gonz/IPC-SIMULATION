const client = require('prom-client');
const { METRICS_CONFIG } = require('./config');

class MetricsCollector {
  constructor() {
    this.register = new client.Registry();
    
    // Métricas predeterminadas
    client.collectDefaultMetrics({
      register: this.register,
      timeout: METRICS_CONFIG.collection_interval
    });

    this._initializeMetrics();
  }

  _initializeMetrics() {
    // Contador de procesos por tipo y estado
    this.processCounter = new client.Counter({
      name: 'ipc_processes_total',
      help: 'Total de procesos por tipo y estado',
      labelNames: ['process_type', 'state', 'role'],
      registers: [this.register]
    });

    // Gauge para procesos activos
    this.activeProcessesGauge = new client.Gauge({
      name: 'ipc_active_processes',
      help: 'Número de procesos activos por tipo',
      labelNames: ['process_type', 'role'],
      registers: [this.register]
    });

    // Histograma para tiempos de proceso
    this.processTimeHistogram = new client.Histogram({
      name: 'ipc_process_duration_seconds',
      help: 'Duración de los procesos en segundos',
      labelNames: ['process_type', 'state', 'role'],
      buckets: METRICS_CONFIG.processTimeBuckets,
      registers: [this.register]
    });

    // Contador de errores
    this.errorCounter = new client.Counter({
      name: 'ipc_errors_total',
      help: 'Total de errores por tipo',
      labelNames: ['error_type', 'process_type', 'role'],
      registers: [this.register]
    });

    // Gauge para clientes conectados
    this.connectedClientsGauge = new client.Gauge({
      name: 'ipc_connected_clients',
      help: 'Número de clientes conectados por rol',
      labelNames: ['role'],
      registers: [this.register]
    });

    // Contador de acciones denegadas
    this.deniedActionsCounter = new client.Counter({
      name: 'ipc_denied_actions_total',
      help: 'Total de acciones denegadas por tipo',
      labelNames: ['action_type', 'role'],
      registers: [this.register]
    });

    // Histograma para tamaño de cola de procesos
    this.queueSizeHistogram = new client.Histogram({
      name: 'ipc_queue_size',
      help: 'Tamaño de la cola de procesos',
      labelNames: ['process_type'],
      buckets: [0, 5, 10, 20, 50, 100],
      registers: [this.register]
    });
  }

  // Métodos para registrar eventos
  recordProcessStart(process) {
    this.processCounter.labels(process.type, 'started', process.role).inc();
    this.activeProcessesGauge.labels(process.type, process.role).inc();
  }

  recordProcessEnd(process) {
    const duration = (process.endTime - process.startTime) / 1000; // convertir a segundos
    this.processTimeHistogram.labels(process.type, process.state, process.role).observe(duration);
    this.activeProcessesGauge.labels(process.type, process.role).dec();
  }

  recordError(errorType, processType, role) {
    this.errorCounter.labels(errorType, processType, role).inc();
  }

  recordClientConnection(role) {
    this.connectedClientsGauge.labels(role).inc();
  }

  recordClientDisconnection(role) {
    this.connectedClientsGauge.labels(role).dec();
  }

  recordDeniedAction(actionType, role) {
    this.deniedActionsCounter.labels(actionType, role).inc();
  }

  recordQueueSize(size, processType) {
    this.queueSizeHistogram.labels(processType).observe(size);
  }

  // Método para obtener todas las métricas
  async getMetrics() {
    return await this.register.metrics();
  }

  // Método para obtener el tipo de contenido
  getContentType() {
    return this.register.contentType;
  }
}

module.exports = MetricsCollector; 