const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const logger = require("../src/core/logger/logger");
const { createLogger } = require("./config/logging");
const { createLogger: createLoggerConfig } = require("../config/logging");

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "logs",
  "*.log",
  "*.md",
  "package-lock.json",
];

async function shouldProcessFile(filePath) {
  // Ignorar archivos de test
  if (filePath.includes(".test.") || filePath.includes("__tests__")) {
    return false;
  }

  // Verificar patrones de ignorar
  return !IGNORE_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace("*", ".*"));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

async function migrateFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    let modified = false;
    let hasLoggerImport = false;
    let hasLoggerDeclaration = false;

    // Buscar si ya tiene importación del logger
    lines.forEach((line) => {
      if (line.includes("require('./config/logging')")) {
        hasLoggerImport = true;
      }
      if (line.includes("const logger = createLogger(")) {
        hasLoggerDeclaration = true;
      }
    });

    // Procesar cada línea
    const newLines = lines.map((line) => {
      if (line.includes("console.log(")) {
        modified = true;
        // Extraer argumentos del console.log
        const match = line.match(/console\.log\((.*)\)/);
        if (match) {
          const args = match[1];
          // Mantener la indentación
          const indent = line.match(/^\s*/)[0];
          return `${indent}logger.info(${args});`;
        }
      }
      return line;
    });

    // Agregar importación y declaración del logger si es necesario
    if (modified && !hasLoggerImport) {
      newLines.unshift("const { createLogger } = require('./config/logging');");
    }
    if (modified && !hasLoggerDeclaration) {
      const serviceName = path.basename(filePath, ".js");
      newLines.unshift(`const logger = createLogger('${serviceName}');`);
      newLines.unshift("");
    }

    if (modified) {
      await writeFile(filePath, newLines.join("\n"));
      logger.info(`Archivo migrado: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`Error al migrar archivo ${filePath}:`, error);
    return false;
  }
}

async function walkDirectory(dir) {
  const files = await readdir(dir);
  let migratedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await readdir(filePath);

    if (stats.isDirectory()) {
      if (!(await shouldProcessFile(filePath))) {
        continue;
      }
      migratedCount += await walkDirectory(filePath);
    } else if (file.endsWith(".js") && (await shouldProcessFile(filePath))) {
      if (await migrateFile(filePath)) {
        migratedCount++;
      }
    }
  }

  return migratedCount;
}

async function main() {
  try {
    logger.info("Iniciando migración de logging...");
    const startTime = Date.now();

    const rootDir = path.join(__dirname, "..");
    const migratedCount = await walkDirectory(rootDir);

    const duration = (Date.now() - startTime) / 1000;
    logger.info(`Migración completada en ${duration}s`, {
      filesProcessed: migratedCount,
    });
  } catch (error) {
    logger.error("Error durante la migración:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  migrateFile,
  walkDirectory,
};
