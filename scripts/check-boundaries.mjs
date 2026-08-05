import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname, join, relative, sep } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const sourceExtensions = new Set(['.ts', '.vue'])
const violations = []

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(path)))
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(path)
    }
  }
  return files
}

function normalized(path) {
  return relative(root, path).split(sep).join('/')
}

function importedSpecifiers(content) {
  const matches = content.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gu)
  return [...matches].map((match) => match[1]).filter(Boolean)
}

function report(file, message) {
  violations.push(`${normalized(file)}: ${message}`)
}

for (const file of await filesUnder(sourceRoot)) {
  const path = normalized(file)
  const content = await readFile(file, 'utf8')
  const imports = importedSpecifiers(content)

  if (path.startsWith('src/renderer/')) {
    const forbiddenImports = imports.filter((specifier) =>
      /(?:^|\/)(?:main|preload|utility)(?:\/|$)|infrastructure\/(?:netease|credentials|persistence|shell)/u.test(
        specifier
      )
    )
    if (forbiddenImports.length > 0) {
      report(file, `Renderer 禁止导入 ${forbiddenImports.join(', ')}`)
    }
    if (/\brequire\s*\(|(?:^|[^'"\w])process(?:[^'"\w]|$)|globalThis\.process/u.test(content)) {
      report(file, 'Renderer 禁止访问 require/process')
    }
  }

  if (path.startsWith('src/domains/')) {
    const forbidden = imports.filter((specifier) =>
      /^(?:electron|vue|pinia|better-sqlite3|sqlite|@?[^/]*http)|infrastructure|netease/u.test(
        specifier
      )
    )
    if (forbidden.length > 0) {
      report(file, `Domain 禁止导入 ${forbidden.join(', ')}`)
    }
  }

  if (path.startsWith('src/shared/')) {
    const forbidden = imports.filter((specifier) =>
      /(?:^|\/)(?:main|preload|renderer|utility|infrastructure|domains)(?:\/|$)|^(?:electron|vue|pinia)$/u.test(
        specifier
      )
    )
    if (forbidden.length > 0) {
      report(file, `Shared 禁止导入 ${forbidden.join(', ')}`)
    }
  }

  if (path.startsWith('src/utility/')) {
    const forbidden = imports.filter((specifier) => /^(?:vue|pinia)$/u.test(specifier))
    if (forbidden.length > 0) {
      report(file, `Utility 禁止导入 ${forbidden.join(', ')}`)
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.info('Dependency boundaries: pass')
}
