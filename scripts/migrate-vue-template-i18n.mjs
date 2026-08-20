import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

import { parse } from 'vue/compiler-sfc'

// ========= 变量 =========

/** 命令行指定或默认使用的 Vue 源码目录。 */
const SOURCE_ARGUMENT = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? 'src/renderer'

/** 待迁移 Vue 源码目录的绝对路径。 */
const SOURCE_ROOT = join(process.cwd(), SOURCE_ARGUMENT)

/** 是否仅报告变更而不写入文件。 */
const DRY_RUN = process.argv.includes('--dry-run')

/** 是否从当前 HEAD 读取原始文件后重新生成。 */
const SOURCE_FROM_HEAD = process.argv.includes('--from-head')

/** 是否迁移包含中文字符串字面量的模板插值与绑定表达式。 */
const MIGRATE_DYNAMIC_EXPRESSIONS = process.argv.includes('--dynamic')

/** 汉字检测表达式。 */
const HAN_PATTERN = /\p{Script=Han}/u

/** 不应作为用户展示文案翻译的静态属性。 */
const IGNORED_ATTRIBUTES = new Set([
  'class',
  'id',
  'key',
  'name',
  'value',
  'href',
  'src',
  'to'
])

/** 本次迁移处理的 Vue 文件数。 */
let changedFileCount = 0

/** 本次迁移生成的模板替换数。 */
let replacementCount = 0

// ========= 函数 =========

/** 递归列出目录中的 Vue 单文件组件。 */
function listVueFiles(directory) {
  /** 当前目录下发现的 Vue 文件。 */
  const files = []
  for (const entry of readdirSync(directory)) {
    /** 当前目录项的绝对路径。 */
    const absolutePath = join(directory, entry)
    if (statSync(absolutePath).isDirectory()) {
      files.push(...listVueFiles(absolutePath))
      continue
    }
    if (extname(entry) === '.vue') files.push(absolutePath)
  }
  return files
}

/** 判断静态属性是否属于可展示文案。 */
function isTranslatableAttribute(name) {
  return !IGNORED_ATTRIBUTES.has(name) && !name.startsWith('data-')
}

/** 创建保留排版空白的 Vue 文本节点翻译表达式。 */
function createTextReplacement(content) {
  /** 文本节点的前导排版空白。 */
  const leadingWhitespace = content.match(/^\s*/u)?.[0] ?? ''
  /** 文本节点的尾部排版空白。 */
  const trailingWhitespace = content.match(/\s*$/u)?.[0] ?? ''
  /** 去除排版空白后的用户可见文案。 */
  const normalizedContent = content.slice(
    leadingWhitespace.length,
    content.length - trailingWhitespace.length
  )
  return `${leadingWhitespace}{{ $tSource(${JSON.stringify(normalizedContent)}) }}${trailingWhitespace}`
}

/** 把固定文案序列化为可嵌入双引号 Vue 属性的单引号脚本字符串。 */
function createSingleQuotedScriptString(content) {
  return `'${content
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')}'`
}

/** 统一修复旧迁移结果中不符合 Vue HTML 双引号约定的属性。 */
function normalizeTranslatedAttributeQuotes(source) {
  /** 已完成引号规范化的属性数量。 */
  let normalizedCount = 0
  /** 旧版单引号属性迁移结果。 */
  const normalizedSource = source.replace(
    /:([A-Za-z][\w:-]*)='\$tSource\(("(?:\\.|[^"\\])*")\)'/gu,
    (_match, attributeName, jsonSource) => {
      normalizedCount += 1
      return `:${attributeName}="$tSource(${createSingleQuotedScriptString(JSON.parse(jsonSource))})"`
    }
  )
  return { source: normalizedSource, count: normalizedCount }
}

/** 把动态模板表达式的最终展示结果交给源文案翻译器。 */
function createDynamicReplacement(content) {
  return `$tSource(${content.trim()})`
}

/** 判断表达式是否仍包含需要迁移的中文且尚未整体本地化。 */
function isTranslatableDynamicExpression(content) {
  /** 去除排版空白后用于判断表达式结果类型的源码。 */
  const normalizedContent = content.trimStart()
  return HAN_PATTERN.test(content)
    && !normalizedContent.startsWith('$tSource(')
    && !normalizedContent.includes('$tSource(')
    && !normalizedContent.includes('translatePublicError(')
    && !normalizedContent.includes('translateCaughtError(')
    && !normalizedContent.startsWith('[')
    && !normalizedContent.startsWith('{')
}

/** 收集单个 Vue 模板节点需要执行的源码替换。 */
function collectTemplateReplacements(node, templateOffset, replacements) {
  if (
    MIGRATE_DYNAMIC_EXPRESSIONS
    && node.type === 5
    && isTranslatableDynamicExpression(node.content.content)
  ) {
    replacements.push({
      start: templateOffset + node.content.loc.start.offset,
      end: templateOffset + node.content.loc.end.offset,
      value: createDynamicReplacement(node.content.content)
    })
  }

  if (node.type === 2 && HAN_PATTERN.test(node.content)) {
    replacements.push({
      start: templateOffset + node.loc.start.offset,
      end: templateOffset + node.loc.end.offset,
      value: createTextReplacement(node.content)
    })
  }

  if (Array.isArray(node.props)) {
    for (const prop of node.props) {
      if (
        MIGRATE_DYNAMIC_EXPRESSIONS
        && prop.type === 7
        && prop.name === 'bind'
        && prop.exp?.type === 4
        && isTranslatableDynamicExpression(prop.exp.content)
      ) {
        replacements.push({
          start: templateOffset + prop.exp.loc.start.offset,
          end: templateOffset + prop.exp.loc.end.offset,
          value: createDynamicReplacement(prop.exp.content)
        })
      }
      if (prop.type !== 6 || !prop.value?.content || !HAN_PATTERN.test(prop.value.content)) continue
      if (!isTranslatableAttribute(prop.name)) continue
      replacements.push({
        start: templateOffset + prop.loc.start.offset,
        end: templateOffset + prop.loc.end.offset,
        value: `:${prop.name}="$tSource(${createSingleQuotedScriptString(prop.value.content)})"`
      })
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectTemplateReplacements(child, templateOffset, replacements)
    }
  }
}

/** 从后向前应用不重叠的模板源码替换。 */
function applyReplacements(source, replacements) {
  /** 按源码起点倒序排列的替换项。 */
  const orderedReplacements = [...replacements].sort((left, right) => right.start - left.start)
  /** 逐步完成替换的 Vue SFC 源码。 */
  let nextSource = source
  for (const replacement of orderedReplacements) {
    nextSource = `${nextSource.slice(0, replacement.start)}${replacement.value}${nextSource.slice(replacement.end)}`
  }
  return nextSource
}

/** 迁移单个 Vue 文件中的静态模板中文。 */
function migrateVueFile(filePath) {
  /** 当前文件相对于仓库根目录的标准化路径。 */
  const repositoryPath = relative(process.cwd(), filePath).replaceAll('\\', '/')
  /** 当前 Vue SFC 的 UTF-8 源码。 */
  const source = SOURCE_FROM_HEAD
    ? execFileSync('git', ['show', `HEAD:${repositoryPath}`], { encoding: 'utf8' })
    : readFileSync(filePath, 'utf8')
  /** 当前 Vue SFC 的解析结果。 */
  const descriptor = parse(source, { filename: filePath }).descriptor
  if (!descriptor.template?.ast) return

  /** 当前模板中需要执行的源码替换。 */
  const replacements = []
  collectTemplateReplacements(
    descriptor.template.ast,
    0,
    replacements
  )
  /** 应用模板表达式替换后的源码。 */
  const migratedSource = applyReplacements(source, replacements)
  /** 规范化历史静态属性迁移结果。 */
  const normalizedMigration = normalizeTranslatedAttributeQuotes(migratedSource)
  /** 当前文件全部迁移数量。 */
  const fileReplacementCount = replacements.length + normalizedMigration.count
  if (fileReplacementCount === 0) return

  changedFileCount += 1
  replacementCount += fileReplacementCount
  console.log(`${repositoryPath}: ${fileReplacementCount}`)
  if (!DRY_RUN) writeFileSync(filePath, normalizedMigration.source, 'utf8')
}

// ========= 执行 =========

for (const filePath of listVueFiles(SOURCE_ROOT)) migrateVueFile(filePath)
console.log(`FILES=${changedFileCount} REPLACEMENTS=${replacementCount} DRY_RUN=${DRY_RUN}`)
