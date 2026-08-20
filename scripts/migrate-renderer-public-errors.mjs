import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'

import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

// ========= 变量 =========

/** 渲染进程源码根目录。 */
const RENDERER_ROOT = join(process.cwd(), 'src/renderer')

/** 稳定本地化模块路径。 */
const I18N_MODULE_PATH = join(RENDERER_ROOT, 'i18n')

/** 是否仅报告待变更文件。 */
const DRY_RUN = process.argv.includes('--dry-run')

/** 公共响应错误消息访问表达式。 */
const PUBLIC_ERROR_MESSAGE_PATTERN = /\b([A-Za-z_$][\w$]*)\.error\.message\b/gu

/** 已处理文件数。 */
let changedFileCount = 0

/** 已替换错误访问数。 */
let replacementCount = 0

// ========= 函数 =========

/** 递归列出渲染进程中的 TypeScript 与 Vue 文件。 */
function listSourceFiles(directory) {
  /** 当前目录收集到的源码文件。 */
  const files = []
  for (const entry of readdirSync(directory)) {
    /** 当前目录项路径。 */
    const absolutePath = join(directory, entry)
    if (statSync(absolutePath).isDirectory()) {
      if (entry !== 'locales') files.push(...listSourceFiles(absolutePath))
      continue
    }
    if (['.ts', '.vue'].includes(extname(entry)) && entry !== 'i18n.ts' && entry !== 'smoke.ts') {
      files.push(absolutePath)
    }
  }
  return files
}

/** 计算源码文件到本地化模块的相对导入路径。 */
function resolveI18nImportPath(filePath) {
  /** 使用正斜线的模块相对路径。 */
  const modulePath = relative(dirname(filePath), I18N_MODULE_PATH).replaceAll('\\', '/')
  return modulePath.startsWith('.') ? modulePath : `./${modulePath}`
}

/** 为 TypeScript 脚本补充 translatePublicError 命名导入。 */
function ensureErrorImport(scriptSource, importPath) {
  /** 当前脚本的 TypeScript AST。 */
  const sourceFile = ts.createSourceFile('migration.ts', scriptSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  /** 已存在的本地化模块导入。 */
  const existingImport = sourceFile.statements.find((statement) => ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === importPath)

  if (
    existingImport?.importClause?.namedBindings
    && ts.isNamedImports(existingImport.importClause.namedBindings)
    && existingImport.importClause.namedBindings.elements.some((element) => element.name.text === 'translatePublicError')
  ) return scriptSource

  if (existingImport && existingImport.importClause?.namedBindings && ts.isNamedImports(existingImport.importClause.namedBindings)) {
    /** 现有命名导入右花括号的位置。 */
    const insertAt = existingImport.importClause.namedBindings.end - 1
    /** 是否沿用多行命名导入格式。 */
    const separator = existingImport.getText(sourceFile).includes('\n') ? ',\n  ' : ', '
    return `${scriptSource.slice(0, insertAt)}${separator}translatePublicError${scriptSource.slice(insertAt)}`
  }

  /** 最后一个 import 声明的结束位置。 */
  const lastImportEnd = sourceFile.statements
    .filter(ts.isImportDeclaration)
    .at(-1)?.end ?? 0
  /** 新增本地化导入声明。 */
  const importStatement = `import { translatePublicError } from '${importPath}'`
  if (lastImportEnd === 0) return `${importStatement}\n\n${scriptSource}`
  return `${scriptSource.slice(0, lastImportEnd)}\n${importStatement}${scriptSource.slice(lastImportEnd)}`
}

/** 迁移一段 TypeScript 脚本中的公共错误消息访问。 */
function migrateScript(scriptSource, importPath) {
  /** 当前脚本替换的错误访问数。 */
  let scriptReplacementCount = 0
  /** 使用稳定错误码翻译器后的脚本。 */
  const migratedSource = scriptSource.replace(PUBLIC_ERROR_MESSAGE_PATTERN, (_match, owner) => {
    scriptReplacementCount += 1
    return `translatePublicError(${owner}.error)`
  })
  if (scriptReplacementCount === 0) return { source: scriptSource, count: 0 }
  return {
    source: ensureErrorImport(migratedSource, importPath),
    count: scriptReplacementCount
  }
}

/** 迁移单个渲染进程源码文件。 */
function migrateSourceFile(filePath) {
  /** 文件 UTF-8 源码。 */
  const source = readFileSync(filePath, 'utf8')
  /** 当前文件使用的本地化模块路径。 */
  const importPath = resolveI18nImportPath(filePath)
  /** 当前文件的迁移结果。 */
  let migration

  if (extname(filePath) === '.vue') {
    /** Vue SFC 的 script setup 描述。 */
    const scriptSetup = parse(source, { filename: filePath }).descriptor.scriptSetup
    if (!scriptSetup) return
    /** script setup 内容在完整文件中的起点。 */
    const scriptStart = source.indexOf(scriptSetup.content)
    /** script setup 迁移结果。 */
    const scriptMigration = migrateScript(scriptSetup.content, importPath)
    migration = scriptMigration.count === 0
      ? { source, count: 0 }
      : {
          source: `${source.slice(0, scriptStart)}${scriptMigration.source}${source.slice(scriptStart + scriptSetup.content.length)}`,
          count: scriptMigration.count
        }
  } else {
    migration = migrateScript(source, importPath)
  }

  if (migration.count === 0) return
  changedFileCount += 1
  replacementCount += migration.count
  console.log(`${relative(process.cwd(), filePath)}: ${migration.count}`)
  if (!DRY_RUN) writeFileSync(filePath, migration.source, 'utf8')
}

// ========= 执行 =========

for (const filePath of listSourceFiles(RENDERER_ROOT)) migrateSourceFile(filePath)
console.log(`FILES=${changedFileCount} REPLACEMENTS=${replacementCount} DRY_RUN=${DRY_RUN}`)
