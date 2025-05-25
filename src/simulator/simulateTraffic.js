const io = require('socket.io-client');
const logger = require('../core/logger/logger');
const config = require('../config/config');

// Configuración
const CONFIG = {
  NUM_CLIENTS: process.env.NUM_CLIENTS || 10,
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',
  MESSAGE_INTERVAL: process.env.MESSAGE_INTERVAL || 5000,
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
};

class ClientSimulator {
  constructor(index) {
    this.index = index;
    this.messageCount = 0;
    this.latencies = [];
    this.lastMessageTime = null;
    this.client = null;
    this.interval = null;
  }

  setupClient() {
    this.client = io(CONFIG.SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: CONFIG.RECONNECTION_ATTEMPTS,
      reconnectionDelay: CONFIG.RECONNECTION_DELAY,
      auth: { clientRole: 'simulator' },
    });

    this.setupEventHandlers();
    return this.client;
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info({
        event: 'connect',
        clientIndex: this.index,
        clientId: this.client.id,
      });

      this.startMessageInterval();
    });

    this.client.on('mensaje', (data) => {
      const receiveTime = Date.now();
      if (this.lastMessageTime) {
        const latency = receiveTime - this.lastMessageTime;
        this.latencies.push(latency);
      }

      logger.debug({
        event: 'message_received',
        clientIndex: this.index,
        data,
        latency: this.latencies[this.latencies.length - 1],
      });
    });

    this.client.on('disconnect', () => {
      logger.warn({
        event: 'disconnect',
        clientIndex: this.index,
      });
      this.stopMessageInterval();
    });

    this.client.on('connect_error', (error) => {
      logger.error({
        event: 'connect_error',
        clientIndex: this.index,
        error: error.message,
      });
    });
  }

  startMessageInterval() {
    this.interval = setInterval(() => {
      this.lastMessageTime = Date.now();
      this.messageCount++;

      this.client.emit('mensaje', {
        clientIndex: this.index,
        messageId: this.messageCount,
        timestamp: this.lastMessageTime,
        content: `Mensaje ${this.messageCount} desde cliente ${this.index}`,
      });
    }, CONFIG.MESSAGE_INTERVAL);
  }

  stopMessageInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStats() {
    return {
      clientIndex: this.index,
      messageCount: this.messageCount,
      averageLatency:
        this.latencies.length > 0
          ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
          : 0,
      connected: this.client.connected,
    };
  }
}

class TrafficSimulator {
  constructor() {
    this.clients = [];
    this.running = false;
  }

  start() {
    logger.info({
      event: 'simulation_start',
      config: CONFIG,
    });

    for (let i = 0; i < CONFIG.NUM_CLIENTS; i++) {
      const simulator = new ClientSimulator(i);
      simulator.setupClient();
      this.clients.push(simulator);
    }

    this.running = true;
    this.setupGracefulShutdown();
    this.startStatsReporting();
  }

  setupGracefulShutdown() {
    process.on('SIGINT', () => {
      logger.info('Iniciando apagado graceful...');
      this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Error no capturado:', error);
      this.stop();
      process.exit(1);
    });
  }

  stop() {
    logger.info('Deteniendo simulación...');
    this.running = false;

    this.clients.forEach((simulator) => {
      simulator.stopMessageInterval();
      if (simulator.client) {
        simulator.client.disconnect();
      }
    });

    this.reportFinalStats();
  }

  startStatsReporting() {
    setInterval(() => {
      if (!this.running) {
        return;
      }

      const stats = this.clients.map((simulator) => simulator.getStats());
      const totalMessages = stats.reduce(
        (sum, stat) => sum + stat.messageCount,
        0,
      );
      const avgLatency =
        stats.reduce((sum, stat) => sum + stat.averageLatency, 0) /
        stats.length;
      const connectedClients = stats.filter((stat) => stat.connected).length;

      logger.info({
        event: 'stats_report',
        totalMessages,
        averageLatency: avgLatency.toFixed(2),
        connectedClients,
        timestamp: Date.now(),
      });
    }, 10000); // Reportar estadísticas cada 10 segundos
  }

  reportFinalStats() {
    const stats = this.clients.map((simulator) => simulator.getStats());
    logger.info({
      event: 'final_stats',
      stats,
      timestamp: Date.now(),
    });
  }
}

// Iniciar simulación
const simulator = new TrafficSimulator();
simulator.start();
