import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

// ========= 变量 =========

/** 命令行指定或默认使用的源代码根目录。 */
const SOURCE_ARGUMENT = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? 'src'

/** 需要审计的源代码根目录。 */
const SOURCE_ROOT = join(process.cwd(), SOURCE_ARGUMENT)

/** 是否只审计 Vue 模板中的直接展示文案。 */
const TEMPLATE_ONLY = process.argv.includes('--template-only')

/** 是否只审计 Vue 脚本中的运行时字符串。 */
const SCRIPT_ONLY = process.argv.includes('--script-only')

/** 是否仅输出待翻译文案，不输出来源位置。 */
const VALUES_ONLY = process.argv.includes('--values-only')

/** 是否只输出尚未进入英语兼容目录的文案。 */
const UNMAPPED_ONLY = process.argv.includes('--unmapped')

/** 汉字检测表达式。 */
const HAN_PATTERN = /\p{Script=Han}/u

/** 不属于应用可本地化界面的上游源码目录。 */
const IGNORED_PATH_PARTS = [
  'src\\renderer\\features\\music\\lyrics-engine\\',
  'src/renderer/features/music/lyrics-engine/',
  'src\\renderer\\locales\\',
  'src/renderer/locales/'
]

/** 审计命中的运行时字符串及其来源位置。 */
const occurrences = new Map()

/** 已进入英语兼容目录的中文源文案。 */
const translatedSources = new Set()

/** 有意使用目标语言自身名称展示且不应翻译的文本。 */
const NON_TRANSLATABLE_SOURCE_TEXTS = new Set(['简体中文'])

// ========= 函数 =========

/** 递归列出需要审计的 TypeScript 与 Vue 文件。 */
function listSourceFiles(directory) {
  /** 当前目录下发现的源文件。 */
  const files = []
  for (const entry of readdirSync(directory)) {
    /** 当前目录项的绝对路径。 */
    const absolutePath = join(directory, entry)
    if (statSync(absolutePath).isDirectory()) {
      files.push(...listSourceFiles(absolutePath))
      continue
    }
    if (extname(entry) === '.ts' || extname(entry) === '.vue') files.push(absolutePath)
  }
  return files
}

/** 记录包含汉字的运行时字符串。 */
function recordOccurrence(value, filePath, line) {
  /** 去除纯排版空白后的候选字符串。 */
  const normalizedValue = value.trim()
  if (!normalizedValue || !HAN_PATTERN.test(normalizedValue)) return
  /** 候选字符串已有的来源位置。 */
  const locations = occurrences.get(normalizedValue) ?? []
  locations.push(`${relative(process.cwd(), filePath)}:${line}`)
  occurrences.set(normalizedValue, locations)
}

/** 把模板字符串标准化为带数字占位符的可翻译源文案。 */
function normalizeTemplateExpression(node) {
  /** 模板字符串的静态头部。 */
  let value = node.head.text
  node.templateSpans.forEach((span, index) => {
    value += `{${index}}${span.literal.text}`
  })
  return value
}

/** 判断字符串是否仅用于 Renderer 控制台诊断而不会展示给用户。 */
function isConsoleDiagnosticString(node) {
  /** 从字符串向上找到的首个调用表达式。 */
  let currentNode = node.parent
  while (currentNode && !ts.isCallExpression(currentNode)) currentNode = currentNode.parent
  if (!currentNode || !ts.isPropertyAccessExpression(currentNode.expression)) return false
  return ts.isIdentifier(currentNode.expression.expression)
    && currentNode.expression.expression.text === 'console'
}

/** 使用 TypeScript AST 提取脚本中的字符串与模板字符串。 */
function collectScriptStrings(source, filePath, lineOffset = 0) {
  /** 当前脚本文本的 TypeScript AST。 */
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.vue') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

  /** 递归访问单个 TypeScript AST 节点。 */
  function visit(node) {
    /** 当前节点在原始脚本中的一基行号。 */
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 + lineOffset
    if (ts.isStringLiteralLike(node)) {
      if (!isConsoleDiagnosticString(node)) recordOccurrence(node.text, filePath, line)
      return
    }
    if (ts.isTemplateExpression(node)) {
      if (!isConsoleDiagnosticString(node)) {
        recordOccurrence(normalizeTemplateExpression(node), filePath, line)
      }
      for (const span of node.templateSpans) visit(span.expression)
      return
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

/** 递归提取 Vue 模板中的文本、静态属性与表达式字符串。 */
function collectTemplateStrings(node, filePath, lineOffset) {
  /** 当前模板节点的一基源文件行号。 */
  const line = (node.loc?.start?.line ?? 1) + lineOffset
  if (node.type === 2) recordOccurrence(node.content, filePath, line)
  if (node.type === 5 && node.content?.content) {
    collectScriptStrings(node.content.content, filePath, line - 1)
  }
  if (Array.isArray(node.props)) {
    for (const prop of node.props) {
      if (prop.type === 6 && prop.value?.content) {
        recordOccurrence(prop.value.content, filePath, (prop.loc?.start?.line ?? 1) + lineOffset)
      }
      if (prop.type === 7 && prop.exp?.content) {
        collectScriptStrings(prop.exp.content, filePath, (prop.loc?.start?.line ?? 1) + lineOffset - 1)
      }
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectTemplateStrings(child, filePath, lineOffset)
  }
}

/** 审计单个 Vue SFC 的脚本与模板运行时文案。 */
function auditVueFile(filePath, source) {
  /** Vue SFC 解析结果。 */
  const descriptor = parse(source, { filename: filePath }).descriptor
  if (!TEMPLATE_ONLY) {
    for (const scriptBlock of [descriptor.script, descriptor.scriptSetup]) {
      if (!scriptBlock) continue
      collectScriptStrings(scriptBlock.content, filePath, scriptBlock.loc.start.line - 1)
    }
  }
  if (!SCRIPT_ONLY && descriptor.template?.ast) {
    collectTemplateStrings(descriptor.template.ast, filePath, descriptor.template.loc.start.line - 1)
  }
}

/** 审计单个 TypeScript 或 Vue 源文件。 */
function auditFile(filePath) {
  /** 相对于仓库根目录的标准化路径。 */
  const repositoryPath = relative(process.cwd(), filePath)
  if (IGNORED_PATH_PARTS.some((part) => repositoryPath.includes(part))) return
  /** 当前文件的 UTF-8 源码。 */
  const source = readFileSync(filePath, 'utf8')
  if (filePath.endsWith('.vue')) auditVueFile(filePath, source)
  else if (!TEMPLATE_ONLY) collectScriptStrings(source, filePath)
}

/** 读取英语兼容目录中已经登记的中文源文案键。 */
function collectTranslatedSources() {
  /** 英语兼容目录的绝对路径。 */
  const catalogDirectory = join(process.cwd(), 'src', 'renderer', 'locales', 'en-US-source')
  for (const filePath of listSourceFiles(catalogDirectory)) {
    if (!filePath.endsWith('.ts')) continue
    /** 当前目录文件的 TypeScript AST。 */
    const sourceFile = ts.createSourceFile(
      filePath,
      readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    /** 递归读取对象字面量中的字符串属性名。 */
    function visit(node) {
      if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) {
        translatedSources.add(node.name.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
}

// ========= 执行 =========

for (const filePath of listSourceFiles(SOURCE_ROOT)) auditFile(filePath)
collectTranslatedSources()

/** 按文案排序后的审计结果。 */
const sortedOccurrences = [...occurrences.entries()]
  .filter(([value]) => !NON_TRANSLATABLE_SOURCE_TEXTS.has(value))
  .filter(([value]) => !UNMAPPED_ONLY || !translatedSources.has(value))
  .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
for (const [value, locations] of sortedOccurrences) {
  console.log(VALUES_ONLY ? JSON.stringify(value) : JSON.stringify({ value, locations }))
}
console.log(`TOTAL=${sortedOccurrences.length}`)
