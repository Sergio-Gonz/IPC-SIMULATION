const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
};

const PROCESS_TYPES = {
  CALCULATION: 'calculation',
  DATABASE: 'database',
  FILE_OPERATION: 'file_operation',
  NETWORK: 'network',
  ANALYSIS: 'analysis'
};

const PROCESS_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  INTERRUPTED: 'interrupted'
};

const PERMISSIONS = {
  [ROLES.ADMIN]: {
    actions: ['solicitud', 'actualización', 'consulta', 'reporte', 'interrumpir'],
    processTypes: Object.values(PROCESS_TYPES),
    canInterrupt: true,
    canPrioritize: true,
    maxConcurrentProcesses: 10
  },
  [ROLES.OPERATOR]: {
    actions: ['solicitud', 'actualización', 'consulta'],
    processTypes: [PROCESS_TYPES.CALCULATION, PROCESS_TYPES.DATABASE, PROCESS_TYPES.FILE_OPERATION],
    canInterrupt: false,
    canPrioritize: true,
    maxConcurrentProcesses: 5
  },
  [ROLES.VIEWER]: {
    actions: ['consulta', 'reporte'],
    processTypes: [PROCESS_TYPES.ANALYSIS],
    canInterrupt: false,
    canPrioritize: false,
    maxConcurrentProcesses: 2
  }
};

const METRICS_CONFIG = {
  processTimeBuckets: [0.1, 0.5, 1, 2, 5, 10],
  defaultLabels: ['role', 'process_type', 'status'],
  collection_interval: 10000
};

const SIMULATION_CONFIG = {
  process: {
    minDuration: 1000,    // 1 segundo
    maxDuration: 10000,   // 10 segundos
    checkInterval: 100,   // 100ms para verificar interrupciones
    maxRetries: 3
  },
  client: {
    reconnectInterval: {
      min: 1000,
      max: 5000
    },
    actionInterval: {
      min: 2000,
      max: 10000
    },
    maxQueueSize: 100
  },
  server: {
    maxConnections: 100,
    processCleanupInterval: 60000,  // 1 minuto
    metricsRetention: 3600000      // 1 hora
  }
};

module.exports = {
  ROLES,
  PROCESS_TYPES,
  PROCESS_STATES,
  PERMISSIONS,
  METRICS_CONFIG,
  SIMULATION_CONFIG
}; 