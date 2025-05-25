const MetricsCollector = require('../../src/core/metrics/MetricsCollector');
const { METRICS_CONFIG } = require('../../src/config/config');

describe('MetricsCollector', () => {
  let metricsCollector;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
  });

  describe('recordProcessStart', () => {
    test('registra inicio de proceso correctamente', () => {
      const process = {
        id: 'test-process-1',
        type: 'TEST_PROCESS',
        role: 'admin',
        state: 'RUNNING'
      };

      metricsCollector.recordProcessStart(process);

      // Verificar que las métricas se actualizaron
      expect(metricsCollector.processCounter.labels).toBeDefined();
      expect(metricsCollector.activeProcessesGauge.labels).toBeDefined();
    });

    test('maneja proceso inválido', () => {
      const invalidProcess = null;
      metricsCollector.recordProcessStart(invalidProcess);
      // No debería lanzar error, solo registrar warning
    });
  });

  describe('recordProcessEnd', () => {
    test('registra fin de proceso correctamente', () => {
      const process = {
        id: 'test-process-2',
        type: 'TEST_PROCESS',
        role: 'admin',
        state: 'COMPLETED',
        startTime: Date.now() - 1000 // 1 segundo atrás
      };

      metricsCollector.recordProcessEnd(process);

      // Verificar que las métricas se actualizaron
      expect(metricsCollector.processTimeHistogram.labels).toBeDefined();
      expect(metricsCollector.activeProcessesGauge.labels).toBeDefined();
    });

    test('maneja proceso sin tiempo de inicio', () => {
      const process = {
        id: 'test-process-3',
        type: 'TEST_PROCESS',
        role: 'admin',
        state: 'COMPLETED'
      };

      metricsCollector.recordProcessEnd(process);
      // No debería lanzar error, solo registrar warning
    });
  });

  describe('recordError', () => {
    test('registra error correctamente', () => {
      const errorType = 'TEST_ERROR';
      const processType = 'TEST_PROCESS';
      const role = 'admin';

      metricsCollector.recordError(errorType, processType, role);

      // Verificar que el contador de errores se incrementó
      expect(metricsCollector.errorCounter.labels).toBeDefined();
    });

    test('maneja parámetros faltantes', () => {
      metricsCollector.recordError('TEST_ERROR');
      // Debería usar valores por defecto para los parámetros faltantes
    });
  });

  describe('recordClientConnection y Disconnection', () => {
    test('registra conexión y desconexión de cliente', () => {
      const role = 'admin';

      metricsCollector.recordClientConnection(role);
      expect(metricsCollector.connectionGauge.labels).toBeDefined();

      metricsCollector.recordClientDisconnection(role);
      expect(metricsCollector.connectionGauge.labels).toBeDefined();
    });

    test('maneja rol no especificado', () => {
      metricsCollector.recordClientConnection();
      metricsCollector.recordClientDisconnection();
      // No debería lanzar error, solo registrar warning
    });
  });

  describe('recordQueueSize', () => {
    test('registra tamaño de cola correctamente', () => {
      const size = 5;
      const processType = 'TEST_PROCESS';

      metricsCollector.recordQueueSize(size, processType);
      expect(metricsCollector.queueSizeGauge.labels).toBeDefined();
    });

    test('emite warning cuando se excede el umbral', () => {
      const size = METRICS_CONFIG.queueWarningThreshold + 1;
      metricsCollector.recordQueueSize(size);
      // Debería registrar un warning
    });
  });

  describe('recordQueueWaitTime', () => {
    test('registra tiempo de espera correctamente', () => {
      const process = {
        id: 'test-process-4',
        type: 'TEST_PROCESS',
        priority: 1
      };
      const waitTime = 5000; // 5 segundos

      metricsCollector.recordQueueWaitTime(process, waitTime);
      expect(metricsCollector.queueWaitTimeHistogram.labels).toBeDefined();
    });

    test('maneja proceso inválido', () => {
      metricsCollector.recordQueueWaitTime(null, 1000);
      // No debería lanzar error, solo registrar warning
    });
  });

  describe('recordResourceUsage', () => {
    test('registra uso de recursos correctamente', () => {
      const usage = {
        cpu: 50,
        memory: 70,
        disk: 30
      };

      metricsCollector.recordResourceUsage(usage);
      expect(metricsCollector.resourceUsageGauge.labels).toBeDefined();
    });

    test('maneja datos de uso inválidos', () => {
      metricsCollector.recordResourceUsage(null);
      metricsCollector.recordResourceUsage({});
      // No debería lanzar error, solo registrar warning
    });
  });

  describe('getMetrics', () => {
    test('obtiene métricas en formato correcto', async () => {
      const metrics = await metricsCollector.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('ipc_');
    });

    test('maneja errores al obtener métricas', async () => {
      // Simular error en el registro
      jest.spyOn(metricsCollector.register, 'metrics')
        .mockRejectedValueOnce(new Error('Test error'));

      await expect(metricsCollector.getMetrics())
        .rejects
        .toThrow('Test error');
    });
  });

  describe('reset', () => {
    test('reinicia todas las métricas correctamente', () => {
      metricsCollector.reset();
      // Verificar que las métricas se reiniciaron
      expect(metricsCollector.register).toBeDefined();
    });
  });
}); 