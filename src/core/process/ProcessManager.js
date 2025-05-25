const EventEmitter = require("events");
const { PROCESS_STATES, SIMULATION_CONFIG } = require("../../config/config");

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
    this.processQueue = [];
    this.activeProcesses = new Map();
  }

  createProcess(processId, options) {
    const process = {
      id: processId,
      type: options.type,
      priority: options.priority || 1,
      state: PROCESS_STATES.PENDING,
      data: options.data,
      owner: options.owner,
      role: options.role,
      startTime: null,
      endTime: null,
      retries: 0,
      error: null,
      canceled: false,
    };

    this.processes.set(processId, process);
    this.emit("process:created", process);
    return process;
  }

  async startProcess(processId) {
    const process = this.processes.get(processId);
    if (!process) throw new Error(`Proceso ${processId} no encontrado`);

    process.state = PROCESS_STATES.RUNNING;
    process.startTime = Date.now();
    this.activeProcesses.set(processId, process);

    try {
      await this._executeProcess(process);

      if (!process.canceled) {
        process.state = PROCESS_STATES.COMPLETED;
        process.endTime = Date.now();
        this.emit("process:completed", process);
      }
    } catch (error) {
      process.error = error;
      process.state = PROCESS_STATES.FAILED;
      process.endTime = Date.now();

      if (process.retries < SIMULATION_CONFIG.process.maxRetries) {
        process.retries++;
        return this.startProcess(processId);
      }

      this.emit("process:failed", process);
    } finally {
      this.activeProcesses.delete(processId);
    }

    return process;
  }

  async _executeProcess(process) {
    const duration =
      Math.random() *
        (SIMULATION_CONFIG.process.maxDuration -
          SIMULATION_CONFIG.process.minDuration) +
      SIMULATION_CONFIG.process.minDuration;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!process.canceled) resolve();
      }, duration);

      const checkInterval = setInterval(() => {
        if (process.canceled) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          process.state = PROCESS_STATES.INTERRUPTED;
          process.endTime = Date.now();
          this.emit("process:interrupted", process);
          reject(new Error("Proceso interrumpido"));
        }
      }, SIMULATION_CONFIG.process.checkInterval);

      // Limpiar el intervalo cuando el proceso termine
      timer.unref();
      checkInterval.unref();
    });
  }

  interruptProcess(processId) {
    const process = this.activeProcesses.get(processId);
    if (!process) return false;

    process.canceled = true;
    return true;
  }

  getProcessInfo(processId) {
    return this.processes.get(processId);
  }

  getActiveProcesses() {
    return Array.from(this.activeProcesses.values());
  }

  getProcessesByOwner(ownerId) {
    return Array.from(this.processes.values()).filter(
      (process) => process.owner === ownerId,
    );
  }

  getProcessesByState(state) {
    return Array.from(this.processes.values()).filter(
      (process) => process.state === state,
    );
  }

  cleanup() {
    const now = Date.now();
    const retentionTime = SIMULATION_CONFIG.server.metricsRetention;

    for (const [id, process] of this.processes.entries()) {
      if (process.endTime && now - process.endTime > retentionTime) {
        this.processes.delete(id);
      }
    }
  }
}

module.exports = ProcessManager;
