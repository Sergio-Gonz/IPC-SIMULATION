# Husky Git Hooks

Este directorio contiene los hooks de Git configurados con Husky para SGIPCPROYECTOSOIIIS12025.

## Hooks Configurados

### pre-commit

- Ejecuta el linter (ESLint)
- Verifica el formato del código
- Ejecuta pruebas unitarias críticas

### pre-push

- Ejecuta todas las pruebas
- Verifica la cobertura de código
- Ejecuta auditoría de seguridad

### commit-msg

- Valida el formato del mensaje de commit
- Asegura que siga las convenciones del proyecto

## Configuración

Los hooks se instalan automáticamente al ejecutar `npm install`. Para reinstalar manualmente:

```bash
npm run prepare
```

## Deshabilitar Hooks

Temporalmente para un commit:

```bash
git commit -m "mensaje" --no-verify
```

Para todos los commits:

```bash
export HUSKY=0
```

## Depuración

Para ver mensajes de depuración:

```bash
export HUSKY_DEBUG=1
```

Para trazas detalladas:

```bash
export HUSKY_DEBUG=2
```
