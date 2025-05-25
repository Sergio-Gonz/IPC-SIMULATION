const { createLogger } = require('../../config/logging');

class QueueManager {
  constructor(config = {}) {
    this.maxQueueSize = config.maxQueueSize || 100;
    this.queue = [];
    this.discardedActions = 0;
    this.totalProcessedActions = 0;
    this.createdAt = Date.now();

    // Usar el logger centralizado
    this.logger = createLogger('queue-manager', {
      file: {
        level: config.logLevel || 'info',
      },
    });
  }

  validateAction(action) {
    if (!action || typeof action !== 'object') {
      this.logger.warn('Acción inválida: debe ser un objeto');
      return false;
    }

    const requiredFields = ['type', 'data'];
    const missingFields = requiredFields.filter((field) => !(field in action));

    if (missingFields.length > 0) {
      this.logger.warn(
        `Acción inválida: faltan campos requeridos [${missingFields.join(', ')}]`,
      );
      return false;
    }

    return true;
  }

  canEnqueue() {
    return this.queue.length < this.maxQueueSize;
  }

  enqueue(action) {
    if (!this.canEnqueue()) {
      this.discardedActions++;
      this.logger.warn({
        message: 'Cola de procesos llena, acción descartada',
        queueSize: this.queue.length,
        maxSize: this.maxQueueSize,
        discardedTotal: this.discardedActions,
      });
      return false;
    }

    if (!this.validateAction(action)) {
      this.discardedActions++;
      return false;
    }

    const queuedAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      queuePosition: this.queue.length + 1,
    };

    this.queue.push(queuedAction);

    this.logger.info({
      message: 'Acción encolada exitosamente',
      actionId: queuedAction.id,
      queueSize: this.queue.length,
      actionType: action.type,
    });

    return true;
  }

  dequeue() {
    if (this.isEmpty) {
      this.logger.debug('Intento de dequeue en cola vacía');
      return null;
    }

    const action = this.queue.shift();
    this.totalProcessedActions++;

    const waitTime = Date.now() - action.timestamp;
    this.logger.info({
      message: 'Acción desencolada',
      actionId: action.id,
      waitTime,
      remainingQueue: this.queue.length,
    });

    return action;
  }

  clear() {
    const clearedCount = this.queue.length;
    this.queue = [];

    this.logger.info({
      message: 'Cola limpiada',
      clearedActions: clearedCount,
    });
  }

  getStats() {
    const now = Date.now();
    const queueAge = now - this.createdAt;
    const averageWaitTime = this.getAverageWaitTime();

    return {
      currentSize: this.queue.length,
      maxSize: this.maxQueueSize,
      utilizationPercent: (this.queue.length / this.maxQueueSize) * 100,
      totalProcessed: this.totalProcessedActions,
      discardedActions: this.discardedActions,
      averageWaitTime,
      oldestAction: this.queue[0]?.timestamp
        ? now - this.queue[0].timestamp
        : 0,
      queueAge,
      throughputRate:
        queueAge > 0 ? (this.totalProcessedActions / queueAge) * 1000 : 0, // acciones por segundo
      discardRate: queueAge > 0 ? (this.discardedActions / queueAge) * 1000 : 0, // descartes por segundo
    };
  }

  getAverageWaitTime() {
    if (this.isEmpty) {
      return 0;
    }
    const now = Date.now();
    const totalWaitTime = this.queue.reduce(
      (acc, action) => acc + (now - action.timestamp),
      0,
    );
    return totalWaitTime / this.queue.length;
  }

  pruneOldActions(maxAge) {
    const now = Date.now();
    const initialLength = this.queue.length;

    this.queue = this.queue.filter((action) => {
      const age = now - action.timestamp;
      return age <= maxAge;
    });

    const prunedCount = initialLength - this.queue.length;
    if (prunedCount > 0) {
      this.logger.info({
        message: 'Acciones antiguas eliminadas',
        prunedCount,
        remainingActions: this.queue.length,
      });
    }

    return prunedCount;
  }

  get isEmpty() {
    return this.queue.length === 0;
  }

  get length() {
    return this.queue.length;
  }

  get nextAction() {
    return this.isEmpty ? null : this.queue[0];
  }

  get utilizationPercent() {
    return (this.queue.length / this.maxQueueSize) * 100;
  }
}

module.exports = QueueManager;
