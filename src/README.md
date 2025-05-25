# Estructura del Código Fuente

Este directorio contiene el código fuente principal del Sistema de Simulación IPC. A continuación se describe la estructura y propósito de cada subdirectorio:

## Directorios Principales

### `/core`

Contiene los componentes centrales del sistema:

- `logger/`: Sistema de logging centralizado
- `metrics/`: Recolección y exposición de métricas
- `process/`: Gestión de procesos y su ciclo de vida
- `queue/`: Sistema de colas y priorización

### `/routes`

Define los endpoints HTTP REST:

- Métricas en formato Prometheus
- Estado del sistema
- Monitoreo de salud
- Estado detallado

### `/sockets`

Maneja la comunicación en tiempo real:

- Autenticación de clientes
- Ejecución de acciones
- Interrupción de procesos
- Gestión de desconexiones

### `/middleware`

Componentes de middleware:

- Autenticación y autorización
- Rate limiting
- Validación de datos
- Control de conexiones

### `/utils`

Utilidades generales:

- Monitoreo de salud del sistema
- Funciones auxiliares
- Constantes compartidas

### `/config`

Configuración centralizada:

- Variables de entorno
- Constantes del sistema
- Configuración de seguridad

### `/validation`

Esquemas de validación:

- Validación de autenticación
- Validación de acciones
- Validación de datos de entrada

## Patrones de Diseño Utilizados

1. **Singleton**: Para gestores globales (ProcessManager, MetricsCollector)
2. **Observer**: Para eventos de Socket.IO
3. **Factory**: Creación de procesos
4. **Middleware**: Para autenticación y validación
5. **Repository**: Para acceso a datos de procesos

## Flujo de Datos

1. Cliente se conecta vía Socket.IO
2. Se autentica con JWT
3. Puede ejecutar acciones según sus permisos
4. Los procesos se gestionan y monitorizan
5. Las métricas se recolectan y exponen

## Consideraciones de Seguridad

- Autenticación basada en JWT
- Rate limiting por cliente
- Validación de datos de entrada
- Control de acceso basado en roles
- Límites de conexiones y procesos

## Monitoreo y Métricas

- Métricas Prometheus
- Estado de salud del sistema
- Logging centralizado
- Alertas configurables

## Manejo de Errores

- Logging estructurado
- Respuestas de error consistentes
- Validación preventiva
- Límites de recursos
