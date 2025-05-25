const QueueManager = require('../src/core/queue/QueueManager');
const ProcessManager = require('../src/core/process/ProcessManager');
const RandomHelper = require('../src/core/utils/RandomHelper');
const MetricsCollector = require('../src/core/metrics/MetricsCollector');

describe('Integración de Componentes', () => {
  let queueManager;
  let processManager;
  let metricsCollector;

  beforeEach(() => {
    queueManager = new QueueManager();
    processManager = new ProcessManager();
    metricsCollector = new MetricsCollector();
  });

  describe('Flujo de Proceso Completo', () => {
    test('proceso pasa por todos los estados correctamente', async () => {
      // Preparar acción
      const action = {
        type: 'TEST_PROCESS',
        data: { value: 42 },
        priority: 1,
      };

      // Encolar acción
      const enqueued = queueManager.enqueue(action);
      expect(enqueued).toBe(true);
      expect(queueManager.length).toBe(1);

      // Crear y ejecutar proceso
      const processId = RandomHelper.generateProcessId('test-socket');
      const process = processManager.createProcess(processId, {
        ...action,
        owner: 'test-user',
        role: 'admin',
      });

      expect(process.state).toBe('PENDING');

      await processManager.startProcess(processId);
      expect(process.state).toBe('RUNNING');

      await processManager.completeProcess(processId);
      expect(process.state).toBe('COMPLETED');

      // Verificar métricas
      const stats = queueManager.getStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.discardedActions).toBe(0);
    });

    test('maneja errores y límites correctamente', async () => {
      // Llenar la cola
      for (let i = 0; i < 6; i++) {
        const result = queueManager.enqueue({
          type: 'TEST_PROCESS',
          data: { value: i },
        });
        if (i < 5) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }

      // Verificar estadísticas
      const stats = queueManager.getStats();
      expect(stats.currentSize).toBe(5);
      expect(stats.discardedActions).toBe(1);
      expect(stats.utilizationPercent).toBe(100);

      // Intentar proceso con error
      const processId = RandomHelper.generateProcessId('test-socket');
      const process = processManager.createProcess(processId, {
        type: 'TEST_ERROR',
        data: { shouldFail: true },
      });

      try {
        await processManager.startProcess(processId);
      } catch (error) {
        expect(process.state).toBe('FAILED');
        expect(process.error).toBeTruthy();
      }
    });
  });

  describe('Rendimiento y Carga', () => {
    test('maneja múltiples procesos concurrentes', async () => {
      const numProcesses = 10;
      const processes = [];

      // Crear procesos concurrentes
      for (let i = 0; i < numProcesses; i++) {
        const processId = RandomHelper.generateProcessId(`test-socket-${i}`);
        processes.push(
          processManager.createProcess(processId, {
            type: 'TEST_CONCURRENT',
            data: { index: i },
            priority: RandomHelper.getRandomPriority(),
          }),
        );
      }

      // Ejecutar todos los procesos
      await Promise.all(
        processes.map((process) =>
          processManager.startProcess(process.id).catch(() => {
            /* ignorar errores */
          }),
        ),
      );

      // Verificar resultados
      const completedProcesses = processes.filter(
        (p) => p.state === 'COMPLETED',
      );
      const failedProcesses = processes.filter((p) => p.state === 'FAILED');

      expect(completedProcesses.length + failedProcesses.length).toBe(
        numProcesses,
      );
    });

    test('prioriza procesos correctamente', () => {
      // Encolar procesos con diferentes prioridades
      const priorities = [3, 1, 2];
      priorities.forEach((priority) => {
        queueManager.enqueue({
          type: 'TEST_PRIORITY',
          data: { value: priority },
          priority,
        });
      });

      // Verificar orden de procesamiento
      const processedPriorities = [];
      while (!queueManager.isEmpty) {
        const action = queueManager.dequeue();
        processedPriorities.push(action.priority);
      }

      expect(processedPriorities).toEqual([3, 2, 1]);
    });
  });

  describe('Métricas y Monitoreo', () => {
    test('registra métricas correctamente', async () => {
      // Simular actividad
      const processId = RandomHelper.generateProcessId('test-socket');
      const process = processManager.createProcess(processId, {
        type: 'TEST_METRICS',
        data: { value: 42 },
      });

      await processManager.startProcess(processId);
      await processManager.completeProcess(processId);

      // Verificar métricas
      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toContain('process_total');
      expect(metrics).toContain('process_active');
      expect(metrics).toContain('process_completed');
    });
  });

  describe('Utilidades y Helpers', () => {
    test('genera IDs únicos', () => {
      const numIds = 1000;
      const ids = new Set();

      for (let i = 0; i < numIds; i++) {
        ids.add(RandomHelper.generateProcessId('test-socket'));
      }

      expect(ids.size).toBe(numIds);
    });

    test('valida acciones correctamente', () => {
      // Acción válida
      expect(
        queueManager.validateAction({
          type: 'TEST',
          data: {},
        }),
      ).toBe(true);

      // Acciones inválidas
      expect(queueManager.validateAction(null)).toBe(false);
      expect(queueManager.validateAction({})).toBe(false);
      expect(queueManager.validateAction({ type: 'TEST' })).toBe(false);
      expect(queueManager.validateAction({ data: {} })).toBe(false);
    });
  });
});
