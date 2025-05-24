# Simulación de IPC (Comunicación Entre Procesos)

Este proyecto implementa un sistema de simulación de IPC con las siguientes características:

## Características Principales

- Sistema cliente-servidor usando Socket.IO
- Sistema de roles (admin, operator, viewer)
- Monitoreo con Prometheus y métricas personalizadas
- Gestión de procesos con ProcessManager
- Recolección de métricas con MetricsCollector
- Endpoints de monitoreo (/health, /metrics, /status/detailed)

## Requisitos

- Node.js v20 o superior
- npm v8 o superior

## Instalación

```bash
# Clonar el repositorio
git clone [URL_DEL_REPOSITORIO]

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
```

## Uso

```bash
# Iniciar el servidor
npm start

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar pruebas
npm test

# Ejecutar linter
npm run lint
```

## Estructura del Proyecto

```
├── config.js           # Configuración centralizada
├── index.js           # Punto de entrada
├── ProcessManager.js  # Gestión de procesos
├── MetricsCollector.js # Recolección de métricas
├── client.js         # Cliente de prueba
└── simulateTraffic.js # Simulador de tráfico
```

## Monitoreo

El sistema incluye endpoints para monitoreo:

- `/health`: Estado básico del sistema
- `/metrics`: Métricas de Prometheus
- `/status/detailed`: Estado detallado del sistema

## CI/CD

El proyecto incluye configuración de GitHub Actions para:

- Pruebas automáticas
- Análisis de código
- Construcción de imagen Docker
- Despliegue automático

## Licencia

ISC
