const config = require('../config/config');

const checkSystemHealth = (processManager, io) => {
  const activeProcessCount = processManager.getActiveProcesses().length;
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent =
    (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const connectionCount = io.sockets.sockets.size;
  const maxConnections = config.SIMULATION_CONFIG.server.maxConnections;
  const connectionPercent = (connectionCount / maxConnections) * 100;

  const healthIssues = [];

  if (
    memoryUsagePercent >
    config.SIMULATION_CONFIG.server.alertThresholds.memoryUsagePercent
  ) {
    healthIssues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
  }

  if (
    connectionPercent >
    config.SIMULATION_CONFIG.server.alertThresholds.connectionWarningPercent
  ) {
    healthIssues.push(`High connection count: ${connectionCount}`);
  }

  if (
    activeProcessCount >
    config.SIMULATION_CONFIG.server.alertThresholds.maxActiveProcesses
  ) {
    healthIssues.push(`High active process count: ${activeProcessCount}`);
  }

  return {
    status: healthIssues.length > 0 ? 'degraded' : 'healthy',
    issues: healthIssues,
    metrics: {
      memoryUsagePercent,
      connectionPercent,
      activeProcessCount,
    },
  };
};

module.exports = {
  checkSystemHealth,
};
