# Sistema de Simulación IPC

Sistema de simulación de comunicación entre procesos (IPC) con control de acceso por roles, métricas y monitoreo en tiempo real.

## 🚀 Características

- ✅ Simulación de IPC con WebSockets
- 🔐 Control de acceso basado en roles (RBAC)
- 📊 Métricas Prometheus
- 🔄 Gestión de procesos en tiempo real
- 📝 Logging estructurado
- ⚡ Rate limiting y control de carga
- 🐳 Contenerización con Docker

## 🛠️ Tecnologías

- Node.js
- Express
- Socket.IO
- Prometheus
- JWT
- Jest
- Docker

## 📋 Requisitos Previos

- Node.js >= 14.x
- npm >= 6.x
- Docker >= 20.10.x
- Docker Compose >= 2.0.x

## 🐳 Ejecución con Docker

### Usando Docker Compose (Recomendado)

1. Construir y levantar todos los servicios:

   ```bash
   docker compose up --build
   ```

2. Acceder a los servicios:
   - API: http://localhost:3000
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001 (usuario: admin, contraseña: admin)

### Usando Docker manualmente

1. Construir la imagen:

   ```bash
   docker build -t ipc-server .
   ```

2. Ejecutar el contenedor:
   ```bash
   docker run -p 3000:3000 ipc-server
   ```

### Servicios Disponibles

- **IPC Server**: API principal y WebSocket server
- **Prometheus**: Recolección de métricas
- **Grafana**: Visualización de métricas y dashboards

### Volúmenes Persistentes

- `prometheus-data`: Almacena datos históricos de métricas
- `grafana-data`: Almacena configuración y dashboards de Grafana
- `./logs`: Almacena logs de la aplicación

## 🔧 Instalación Local

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/Sergio-Gonz/IPC-SIMULATION.git
   cd IPC-SIMULATION
   ```

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Configurar variables de entorno:

   ```bash
   cp .env.example .env
   ```

4. Iniciar el servidor:
   ```bash
   npm run dev
   ```

## 📚 Documentación

- [Arquitectura del Sistema](ARQUITECTURA.md)
- [Documentación de API](API.md)

## 🧪 Tests

```bash
npm test
```

## 🔍 Monitoreo

- `/metrics`: Métricas en formato Prometheus
- `/health`: Estado de salud del sistema
- `/status`: Estado general
- `/status/detailed`: Estado detallado

## 🔐 Seguridad

- Autenticación JWT
- Rate limiting por cliente
- Validación de datos
- Control de acceso por roles

## 📦 Estructura del Proyecto

```
src/
├── core/          # Componentes centrales
├── routes/        # Endpoints HTTP
├── sockets/       # Manejo de WebSockets
├── middleware/    # Middlewares
├── utils/         # Utilidades
├── config/        # Configuración
└── validation/    # Esquemas de validación
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama (`git checkout -b feature/nueva-caracteristica`)
3. Commit los cambios (`git commit -m 'feat: Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.
