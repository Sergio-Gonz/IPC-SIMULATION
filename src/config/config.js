/**
 * Configuración centralizada del sistema IPC
 * Este archivo define las constantes y configuraciones principales del sistema,
 * incluyendo roles, tipos de procesos, estados, permisos y parámetros de simulación.
 */

// Tipos de acciones disponibles en el sistema
const ACTION_TYPES = {
  SOLICITUD: 'solicitud',
  ACTUALIZACION: 'actualización',
  CONSULTA: 'consulta',
  REPORTE: 'reporte',
  INTERRUMPIR: 'interrumpir',
};

// Roles del sistema y sus niveles de acceso
const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
};

// Tipos de procesos que pueden ser ejecutados
const PROCESS_TYPES = {
  CALCULATION: 'calculation',
  DATABASE: 'database',
  FILE_OPERATION: 'file_operation',
  NETWORK: 'network',
  ANALYSIS: 'analysis',
};

// Estados posibles de los procesos
const PROCESS_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  INTERRUPTED: 'interrupted',
};

// Conjuntos comunes de acciones por nivel de acceso
const COMMON_ACTIONS = {
  BASIC: [ACTION_TYPES.CONSULTA],
  OPERATOR: [
    ACTION_TYPES.SOLICITUD,
    ACTION_TYPES.ACTUALIZACION,
    ACTION_TYPES.CONSULTA,
  ],
  ADMIN: Object.values(ACTION_TYPES),
};

// Conjuntos comunes de tipos de proceso por rol
const COMMON_PROCESS_TYPES = {
  BASIC: [PROCESS_TYPES.ANALYSIS],
  OPERATOR: [
    PROCESS_TYPES.CALCULATION,
    PROCESS_TYPES.DATABASE,
    PROCESS_TYPES.FILE_OPERATION,
  ],
  ADMIN: Object.values(PROCESS_TYPES),
};

// Matriz de permisos por rol
const PERMISSIONS = {
  [ROLES.ADMIN]: {
    actions: COMMON_ACTIONS.ADMIN,
    processTypes: COMMON_PROCESS_TYPES.ADMIN,
    canInterrupt: true,
    canPrioritize: true,
    maxConcurrentProcesses: parseInt(process.env.ADMIN_MAX_PROCESSES) || 10,
  },
  [ROLES.OPERATOR]: {
    actions: COMMON_ACTIONS.OPERATOR,
    processTypes: COMMON_PROCESS_TYPES.OPERATOR,
    canInterrupt: false,
    canPrioritize: true,
    maxConcurrentProcesses: parseInt(process.env.OPERATOR_MAX_PROCESSES) || 5,
  },
  [ROLES.VIEWER]: {
    actions: COMMON_ACTIONS.BASIC,
    processTypes: COMMON_PROCESS_TYPES.BASIC,
    canInterrupt: false,
    canPrioritize: false,
    maxConcurrentProcesses: parseInt(process.env.VIEWER_MAX_PROCESSES) || 2,
  },
};

// Configuración de métricas para monitoreo
const METRICS_CONFIG = {
  processTimeBuckets: [0.1, 0.5, 1, 2, 5, 10],
  defaultLabels: ['role', 'process_type', 'status'],
  collection_interval: parseInt(process.env.METRICS_INTERVAL) || 10000,
  retention_period: parseInt(process.env.METRICS_RETENTION) || 3600000, // 1 hora
};

// Configuración del cliente de simulación
const CLIENT_CONFIG = {
  reconnectInterval: {
    min: parseInt(process.env.CLIENT_RECONNECT_MIN) || 1000,
    max: parseInt(process.env.CLIENT_RECONNECT_MAX) || 5000,
  },
  actionInterval: {
    min: parseInt(process.env.CLIENT_ACTION_MIN) || 2000,
    max: parseInt(process.env.CLIENT_ACTION_MAX) || 10000,
  },
  maxQueueSize: parseInt(process.env.CLIENT_MAX_QUEUE) || 100,
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minuto
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100, // máximo 100 acciones por minuto
  },
};

// Configuración del servidor de simulación
const SERVER_CONFIG = {
  process: {
    minDuration: parseInt(process.env.PROCESS_MIN_DURATION) || 1000,
    maxDuration: parseInt(process.env.PROCESS_MAX_DURATION) || 10000,
    checkInterval: parseInt(process.env.PROCESS_CHECK_INTERVAL) || 100,
    maxRetries: parseInt(process.env.PROCESS_MAX_RETRIES) || 3,
  },
  maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 100,
  processCleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 60000,
  alertThresholds: {
    memoryUsagePercent: parseInt(process.env.MEMORY_THRESHOLD) || 85,
    maxActiveProcesses: parseInt(process.env.MAX_ACTIVE_PROCESSES) || 100,
    connectionWarningPercent: parseInt(process.env.CONNECTION_WARNING) || 90,
  },
};

// Configuración combinada para compatibilidad con código existente
const SIMULATION_CONFIG = {
  process: SERVER_CONFIG.process,
  client: CLIENT_CONFIG,
  server: SERVER_CONFIG,
};

// Validación básica de configuración
const validateConfig = () => {
  // Validar umbrales
  if (SERVER_CONFIG.alertThresholds.memoryUsagePercent > 95) {
    console.warn('ADVERTENCIA: Umbral de memoria muy alto (>95%)');
  }

  // Validar intervalos
  if (CLIENT_CONFIG.actionInterval.min > CLIENT_CONFIG.actionInterval.max) {
    throw new Error(
      'Configuración inválida: actionInterval.min > actionInterval.max',
    );
  }

  // Validar límites de procesos
  Object.entries(PERMISSIONS).forEach(([role, perms]) => {
    if (perms.maxConcurrentProcesses > SERVER_CONFIG.maxConnections) {
      console.warn(
        `ADVERTENCIA: ${role} tiene maxConcurrentProcesses mayor que maxConnections`,
      );
    }
  });
};

// Ejecutar validación al cargar el módulo
validateConfig();

module.exports = {
  ACTION_TYPES,
  ROLES,
  PROCESS_TYPES,
  PROCESS_STATES,
  PERMISSIONS,
  METRICS_CONFIG,
  SIMULATION_CONFIG,
  CLIENT_CONFIG,
  SERVER_CONFIG,
  COMMON_ACTIONS,
  COMMON_PROCESS_TYPES,
};
