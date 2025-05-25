const config = require('../config/config');
const logger = require('../core/logger/logger');
const { verifyToken } = require('../config/security');
const { authSchema, actionSchema } = require('../validation/schemas');

const socketRateLimiter = new Map();

const checkRateLimit = (socketId) => {
  const now = Date.now();
  const userLimits = socketRateLimiter.get(socketId) || {
    count: 0,
    lastReset: now,
  };

  if (
    now - userLimits.lastReset >=
    config.SIMULATION_CONFIG.server.rateLimitWindow
  ) {
    userLimits.count = 0;
    userLimits.lastReset = now;
  }

  userLimits.count++;
  socketRateLimiter.set(socketId, userLimits);

  return userLimits.count <= config.SIMULATION_CONFIG.server.rateLimit;
};

const validateAuth = async (credentials) => {
  try {
    await authSchema.validateAsync(credentials);
    const tokenData = verifyToken(credentials.token);
    if (!tokenData) {
      return { isValid: false, error: 'Token inválido o expirado' };
    }
    if (tokenData.role !== credentials.role) {
      return { isValid: false, error: 'El rol no coincide con el token' };
    }
    return { isValid: true, tokenData };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

const validateAction = async (action) => {
  try {
    await actionSchema.validateAsync(action);
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

const tienePermiso = (role, actionType, processType) => {
  const permisos = config.PERMISSIONS[role];
  if (!permisos) {
    return false;
  }

  return (
    permisos.actions.includes(actionType) &&
    permisos.processTypes.includes(processType)
  );
};

const checkConnectionLimit = (io, socket, next) => {
  const clientCount = io.sockets.sockets.size;
  if (clientCount >= config.SIMULATION_CONFIG.server.maxConnections) {
    logger.warn('Servidor al límite de conexiones');
    next(new Error('Servidor al límite de conexiones'));
    return;
  }
  next();
};

// Limpieza periódica del rate limiter
setInterval(() => {
  const now = Date.now();
  for (const [socketId, limits] of socketRateLimiter.entries()) {
    if (
      now - limits.lastReset >=
      config.SIMULATION_CONFIG.server.rateLimitWindow * 2
    ) {
      socketRateLimiter.delete(socketId);
    }
  }
}, config.SIMULATION_CONFIG.server.rateLimitWindow);

module.exports = {
  checkRateLimit,
  validateAuth,
  validateAction,
  tienePermiso,
  checkConnectionLimit,
};
