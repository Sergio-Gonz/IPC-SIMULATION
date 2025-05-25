const ProcessManager = require('../../src/core/process/ProcessManager');
const { PROCESS_STATES, SIMULATION_CONFIG } = require('../../src/config/config');
const EventEmitter = require('events');

describe('ProcessManager', () => {
  let processManager;

  beforeEach(() => {
    processManager = new ProcessManager();
  });

  describe('createProcess', () => {
    test('crea un proceso con los valores correctos', () => {
      const processId = 'test-process-1';
      const options = {
        type: 'TEST_PROCESS',
        priority: 2,
        data: { value: 42 },
        owner: 'test-user',
        role: 'admin'
      };

      const process = processManager.createProcess(processId, options);

      expect(process).toEqual({
        id: processId,
        type: options.type,
        priority: options.priority,
        state: PROCESS_STATES.PENDING,
        data: options.data,
        owner: options.owner,
        role: options.role,
        startTime: null,
        endTime: null,
        retries: 0,
        error: null,
        canceled: false
      });
    });

    test('emite evento process:created', (done) => {
      const processId = 'test-process-2';
      const options = {
        type: 'TEST_PROCESS',
        data: { value: 42 }
      };

      processManager.once('process:created', (process) => {
        expect(process.id).toBe(processId);
        done();
      });

      processManager.createProcess(processId, options);
    });
  });

  describe('startProcess', () => {
    test('inicia un proceso existente', async () => {
      const processId = 'test-process-3';
      const process = processManager.createProcess(processId, {
        type: 'TEST_PROCESS'
      });

      const startedProcess = await processManager.startProcess(processId);
      
      expect(startedProcess.state).toBe(PROCESS_STATES.COMPLETED);
      expect(startedProcess.startTime).toBeTruthy();
      expect(startedProcess.endTime).toBeTruthy();
    });

    test('maneja proceso no encontrado', async () => {
      await expect(processManager.startProcess('non-existent'))
        .rejects
        .toThrow('Proceso non-existent no encontrado');
    });

    test('maneja reintento de proceso fallido', async () => {
      const processId = 'test-process-4';
      const process = processManager.createProcess(processId, {
        type: 'TEST_PROCESS'
      });

      // Mockear _executeProcess para que falle
      jest.spyOn(processManager, '_executeProcess')
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce();

      const startedProcess = await processManager.startProcess(processId);
      
      expect(startedProcess.retries).toBe(1);
      expect(startedProcess.state).toBe(PROCESS_STATES.COMPLETED);
    });
  });

  describe('interruptProcess', () => {
    test('interrumpe un proceso activo', async () => {
      const processId = 'test-process-5';
      processManager.createProcess(processId, { type: 'TEST_PROCESS' });

      // Iniciar el proceso
      const processPromise = processManager.startProcess(processId);
      
      // Interrumpir después de un breve delay
      setTimeout(() => {
        const result = processManager.interruptProcess(processId);
        expect(result).toBe(true);
      }, 100);

      const process = await processPromise.catch(e => e);
      expect(process.message).toBe('Proceso interrumpido');
    });

    test('retorna false para proceso no activo', () => {
      const result = processManager.interruptProcess('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getProcessInfo y métodos de consulta', () => {
    beforeEach(() => {
      // Crear algunos procesos de prueba
      processManager.createProcess('test1', {
        type: 'TYPE_A',
        owner: 'user1',
        role: 'admin',
        state: PROCESS_STATES.COMPLETED
      });
      processManager.createProcess('test2', {
        type: 'TYPE_B',
        owner: 'user2',
        role: 'operator',
        state: PROCESS_STATES.RUNNING
      });
    });

    test('obtiene información de un proceso específico', () => {
      const process = processManager.getProcessInfo('test1');
      expect(process.type).toBe('TYPE_A');
      expect(process.owner).toBe('user1');
    });

    test('obtiene procesos por propietario', () => {
      const processes = processManager.getProcessesByOwner('user2');
      expect(processes).toHaveLength(1);
      expect(processes[0].type).toBe('TYPE_B');
    });

    test('obtiene procesos por estado', () => {
      const processes = processManager.getProcessesByState(PROCESS_STATES.RUNNING);
      expect(processes).toHaveLength(1);
      expect(processes[0].id).toBe('test2');
    });
  });

  describe('cleanup', () => {
    test('limpia procesos antiguos', () => {
      const oldProcess = processManager.createProcess('old-process', {
        type: 'TEST_PROCESS'
      });
      
      // Simular proceso completado hace tiempo
      oldProcess.endTime = Date.now() - (SIMULATION_CONFIG.server.metricsRetention * 2);
      
      processManager.cleanup();
      
      expect(processManager.getProcessInfo('old-process')).toBeUndefined();
    });

    test('mantiene procesos recientes', () => {
      const recentProcess = processManager.createProcess('recent-process', {
        type: 'TEST_PROCESS'
      });
      
      // Simular proceso completado recientemente
      recentProcess.endTime = Date.now() - 1000;
      
      processManager.cleanup();
      
      expect(processManager.getProcessInfo('recent-process')).toBeTruthy();
    });
  });
}); 