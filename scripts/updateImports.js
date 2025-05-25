const fs = require('fs').promises;
const path = require('path');

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'logs',
  '*.log',
  '*.md',
  'package-lock.json',
];

const FILE_EXTENSIONS = ['.js', '.ts', '.tsx'];

async function shouldProcessFile(filePath) {
  if (!FILE_EXTENSIONS.includes(path.extname(filePath))) {
    return false;
  }

  return !IGNORE_PATTERNS.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

function getRelativePath(fromPath, toPath) {
  let relativePath = path.relative(path.dirname(fromPath), toPath);
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  return relativePath.replace(/\\/g, '/');
}

const IMPORT_MAP = {
  './config': '../config/config',
  './logger': '../core/logger/logger',
  './MetricsCollector': '../core/metrics/MetricsCollector',
  './ProcessManager': '../core/process/ProcessManager',
  './RandomHelper': '../core/utils/RandomHelper',
  './QueueManager': '../core/queue/QueueManager',
  './client': '../client/IPCClient',
  './simulateTraffic': '../simulator/simulateTraffic',
  './codeAudit': '../audit/codeAudit',
};

async function updateImports(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    let modified = false;
    let newContent = content;

    // Actualizar las importaciones
    Object.entries(IMPORT_MAP).forEach(([oldPath, newPath]) => {
      const regex = new RegExp(`require\\(['"]${oldPath}['"]\\)`, 'g');
      if (regex.test(newContent)) {
        const relativePath = getRelativePath(
          filePath,
          path.join(process.cwd(), 'src', newPath),
        );
        newContent = newContent.replace(regex, `require('${relativePath}')`);
        modified = true;
      }
    });

    if (modified) {
      await fs.writeFile(filePath, newContent);
      console.log(`[INFO] Actualizadas importaciones en: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      `[ERROR] Error al actualizar importaciones en ${filePath}:`,
      error,
    );
    return false;
  }
}

async function walkDirectory(dir) {
  const files = await fs.readdir(dir);
  let updatedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      updatedCount += await walkDirectory(filePath);
    } else if (await shouldProcessFile(filePath)) {
      if (await updateImports(filePath)) {
        updatedCount++;
      }
    }
  }

  return updatedCount;
}

async function main() {
  try {
    console.log('[INFO] Iniciando actualización de importaciones...');
    const startTime = Date.now();

    const srcDir = path.join(process.cwd(), 'src');
    const updatedCount = await walkDirectory(srcDir);

    const duration = (Date.now() - startTime) / 1000;
    console.log(
      `[INFO] Actualización completada en ${duration}s. Archivos actualizados: ${updatedCount}`,
    );
  } catch (error) {
    console.error('[ERROR] Error durante la actualización:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  updateImports,
  walkDirectory,
};
