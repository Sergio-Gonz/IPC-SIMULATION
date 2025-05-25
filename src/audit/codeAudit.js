const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./config/logging');

// Usar el logger centralizado
const logger = createLogger('code-auditor');

// Archivos y directorios a ignorar
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.env',
  '*.log',
  '*.md',
  'package-lock.json',
];

// Extensiones de archivo a auditar
const FILE_EXTENSIONS = ['.js', '.json', '.yml', '.yaml', '.env.example'];

class CodeAuditor {
  constructor() {
    this.fileCount = 0;
    this.totalLines = 0;
    this.filesWithIssues = [];
    this.summary = {
      totalFiles: 0,
      totalLines: 0,
      fileTypes: {},
      potentialIssues: [],
    };
  }

  shouldIgnore(filePath) {
    return IGNORE_PATTERNS.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }

  async auditFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const extension = path.extname(filePath);
      const lines = content.split('\n');

      this.summary.totalFiles++;
      this.summary.totalLines += lines.length;
      this.summary.fileTypes[extension] =
        (this.summary.fileTypes[extension] || 0) + 1;

      logger.info(`Auditando archivo: ${filePath}`, {
        lines: lines.length,
        type: extension,
      });

      // Análisis básico de código
      const analysis = {
        imports: [],
        exports: [],
        classes: [],
        functions: [],
        potentialIssues: [],
      };

      lines.forEach((line, index) => {
        // Detectar imports
        if (line.includes('require(') || line.includes('import ')) {
          analysis.imports.push({ line: index + 1, content: line.trim() });
        }

        // Detectar exports
        if (line.includes('module.exports') || line.includes('export ')) {
          analysis.exports.push({ line: index + 1, content: line.trim() });
        }

        // Detectar clases
        if (line.includes('class ')) {
          analysis.classes.push({ line: index + 1, content: line.trim() });
        }

        // Detectar funciones
        if (
          line.match(/function\s+\w+\s*\(/) ||
          line.match(/const\s+\w+\s*=\s*function/)
        ) {
          analysis.functions.push({ line: index + 1, content: line.trim() });
        }

        // Detectar problemas potenciales
        if (line.includes('TODO') || line.includes('FIXME')) {
          analysis.potentialIssues.push({
            line: index + 1,
            content: line.trim(),
            type: 'comment',
          });
        }

        // Detectar uso de console.log en producción
        if (line.includes('console.log') && !filePath.includes('.test.')) {
          analysis.potentialIssues.push({
            line: index + 1,
            content: line.trim(),
            type: 'logging',
            recommendation: 'Reemplazar console.log con el logger centralizado',
          });
        }
      });

      // Registrar el contenido y análisis del archivo
      logger.info('Análisis de archivo completado', {
        file: filePath,
        analysis: {
          ...analysis,
          content:
            content.length > 1000
              ? content.substring(0, 1000) + '... (truncado)'
              : content,
        },
      });

      if (analysis.potentialIssues.length > 0) {
        this.filesWithIssues.push({
          file: filePath,
          issues: analysis.potentialIssues,
        });
      }
    } catch (error) {
      logger.error(`Error al auditar archivo ${filePath}:`, error);
      this.summary.potentialIssues.push({
        file: filePath,
        error: error.message,
      });
    }
  }

  async auditDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (this.shouldIgnore(fullPath)) {
          logger.debug(`Ignorando: ${fullPath}`);
          continue;
        }

        if (entry.isDirectory()) {
          await this.auditDirectory(fullPath);
        } else if (FILE_EXTENSIONS.includes(path.extname(entry.name))) {
          await this.auditFile(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Error al auditar directorio ${dirPath}:`, error);
    }
  }

  generateSummary() {
    logger.info('Resumen de la auditoría', {
      summary: this.summary,
      filesWithIssues: this.filesWithIssues,
    });

    // Generar reporte en formato markdown
    const markdownReport = `
# Reporte de Auditoría de Código

## Resumen
- Total de archivos: ${this.summary.totalFiles}
- Total de líneas: ${this.summary.totalLines}
- Tipos de archivo encontrados: ${JSON.stringify(this.summary.fileTypes, null, 2)}

## Archivos con Problemas Potenciales
${this.filesWithIssues
    .map(
      (file) => `
### ${file.file}
${file.issues.map((issue) => `- Línea ${issue.line}: ${issue.type} - ${issue.content}`).join('\n')}
`,
    )
    .join('\n')}

## Recomendaciones
1. Revisar los console.log en archivos de producción
2. Atender los TODOs y FIXMEs pendientes
3. Verificar los archivos con errores de lectura

Generado el: ${new Date().toISOString()}
`;

    return fs.writeFile('audit-report.md', markdownReport);
  }
}

// Ejecutar la auditoría
async function runAudit() {
  const auditor = new CodeAuditor();

  logger.info('Iniciando auditoría de código');

  try {
    await auditor.auditDirectory(process.cwd());
    await auditor.generateSummary();
    logger.info('Auditoría completada exitosamente');
  } catch (error) {
    logger.error('Error durante la auditoría:', error);
    process.exit(1);
  }
}

runAudit();
