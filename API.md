# Documentación de API y Queries

## Endpoints REST

### 1. Página Principal

```http
GET /
```

- **Descripción**: Página de bienvenida
- **Respuesta**: Mensaje de bienvenida en texto plano

### 2. Métricas

```http
GET /metrics
```

- **Descripción**: Métricas del sistema en formato Prometheus
- **Respuesta**: Métricas en formato texto Prometheus
- **Campos**:
  - `ipc_active_processes`: Gauge de procesos activos
  - `ipc_errors_total`: Contador de errores
  - `ipc_queue_size`: Gauge de tamaño de cola

### 3. Estado del Sistema

```http
GET /status
```

- **Descripción**: Estado general del sistema
- **Respuesta**: JSON con estado actual
- **Campos**:
  ```json
  {
    "activeProcesses": 5,
    "processTypes": {
      "COMPUTE": 2,
      "IO": 3
    },
    "connectedClients": 10
  }
  ```

### 4. Estado de Salud

```http
GET /health
```

- **Descripción**: Estado de salud del sistema
- **Respuesta**: JSON con métricas de salud
- **Campos**:
  ```json
  {
    "status": "healthy|degraded",
    "timestamp": "2024-02-20T12:00:00Z",
    "version": "1.0.0",
    "uptime": 3600,
    "memory": {
      "heapUsed": 1000000,
      "heapTotal": 2000000
    },
    "connections": {
      "total": 10,
      "byRole": {
        "admin": 1,
        "user": 9
      }
    },
    "processes": {
      "active": 5,
      "total": 100,
      "byState": {
        "RUNNING": 3,
        "PENDING": 2
      }
    }
  }
  ```

### 5. Estado Detallado

```http
GET /status/detailed
```

- **Descripción**: Estado detallado del sistema
- **Respuesta**: JSON con estado detallado
- **Campos**: Incluye toda la información de salud más:
  - Estadísticas de CPU
  - Información del sistema
  - Estado de la cola
  - Métricas detalladas

## Eventos Socket.IO

### 1. Autenticación

```javascript
// Enviar
socket.emit("auth", {
  role: "admin|user|viewer",
  token: "auth-token",
});

// Recibir
socket.on("auth_response", {
  status: "success|error",
  permissions: {
    actions: ["READ", "WRITE"],
    processTypes: ["COMPUTE", "IO"],
    maxConcurrentProcesses: 5,
  },
});
```

### 2. Ejecución de Acciones

```javascript
// Enviar
socket.emit("accion", {
  type: "READ|WRITE|EXECUTE",
  processType: "COMPUTE|IO",
  priority: 1 - 5,
  data: {
    // Datos específicos de la acción
  },
});

// Recibir
socket.on("accion_respuesta", {
  status: "success|error",
  processId: "process-id",
  mensaje: "Descripción del resultado",
});
```

### 3. Interrupción de Procesos

```javascript
// Enviar
socket.emit("interrumpir", "process-id");

// Recibir
socket.on("interrupcion_respuesta", {
  status: "success|error",
  mensaje: "Resultado de la interrupción",
});
```

## Códigos de Error

### HTTP

- `429`: Límite de recursos excedido
- `500`: Error interno del servidor

### Socket.IO

- `auth_error`: Error de autenticación
- `rate_limit_exceeded`: Límite de tasa excedido
- `permission_denied`: Permiso denegado
- `process_error`: Error en la ejecución del proceso

## Rate Limiting

### Por Socket

- Máximo de peticiones: Configurable en `config.js`
- Ventana de tiempo: Configurable en `config.js`
- Reset automático al expirar la ventana

### Por Conexión

- Límite de conexiones concurrentes
- Límite de procesos por cliente
- Límite global de sistema

## Ejemplos de Uso

### Autenticación y Ejecución de Proceso

```javascript
// Conectar y autenticar
const socket = io("http://localhost:3000");
socket.emit("auth", { role: "admin" });

// Ejecutar acción tras autenticación
socket.on("auth_response", (response) => {
  if (response.status === "success") {
    socket.emit("accion", {
      type: "EXECUTE",
      processType: "COMPUTE",
      priority: 1,
      data: { value: 42 },
    });
  }
});

// Manejar respuesta
socket.on("accion_respuesta", (response) => {
  console.log(`Proceso ${response.processId}: ${response.mensaje}`);
});
```

### Monitoreo de Estado

```javascript
// Consulta periódica de estado
setInterval(async () => {
  const response = await fetch("http://localhost:3000/health");
  const health = await response.json();
  console.log("Estado del sistema:", health.status);
}, 5000);
```
