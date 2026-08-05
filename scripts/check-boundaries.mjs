import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const projectRoot = process.cwd()
const sourceRoot = resolve(projectRoot, 'src')
const sourceExtensions = new Set(['.ts', '.vue'])
const importPattern = /(?:from\s+|import\s*\()(['"])([^'"]+)\1/g
const violations = []

function extensionOf(path) {
  const index = path.lastIndexOf('.')
  return index === -1 ? '' : path.slice(index)
}

function visit(directory) {
  for (const entry of readdirSync(directory)) {
    const absolutePath = resolve(directory, entry)
    if (statSync(absolutePath).isDirectory()) {
      visit(absolutePath)
      continue
    }
    if (sourceExtensions.has(extensionOf(entry))) inspect(absolutePath)
  }
}

function report(file, specifier, reason) {
  violations.push(`${relative(projectRoot, file)} -> ${specifier}: ${reason}`)
}

function inspect(file) {
  const normalizedFile = relative(projectRoot, file).replaceAll('\\', '/')
  const contents = readFileSync(file, 'utf8')

  for (const match of contents.matchAll(importPattern)) {
    const specifier = match[2]
    if (!specifier) continue

    if (normalizedFile.startsWith('src/domains/')) {
      if (
        /^(electron|vue|pinia)$/.test(specifier) ||
        /(?:^@|\.\.\/)(?:main|preload|renderer|utility|infrastructure)(?:\/|$)/.test(specifier)
      ) {
        report(file, specifier, '领域层只能依赖领域层与 shared')
      }
    }

    if (normalizedFile.startsWith('src/shared/')) {
      if (
        /^(electron|vue|pinia)$/.test(specifier) ||
        /(?:^@|\.\.\/)(?:main|preload|renderer|utility|infrastructure)(?:\/|$)/.test(specifier)
      ) {
        report(file, specifier, 'shared 不能依赖进程入口或基础设施')
      }
    }

    if (normalizedFile.startsWith('src/renderer/')) {
      if (
        /(?:^@|\.\.\/)(?:main|preload|utility)(?:\/|$)/.test(specifier) ||
        /infrastructure\/(?:credentials|netease|persistence|shell)(?:\/|$)/.test(specifier)
      ) {
        report(file, specifier, 'Renderer 不能访问受保护进程或基础设施')
      }
    }

    if (
      (normalizedFile.startsWith('src/renderer/') ||
        normalizedFile.startsWith('src/preload/')) &&
      /shared\/contracts\/credential-lease(?:\.|\/|$)/.test(specifier)
    ) {
      report(file, specifier, 'Renderer 与 Preload 不得导入凭据租约控制面')
    }

    if (
      specifier === 'reka-ui' &&
      !normalizedFile.startsWith('src/renderer/design-system/primitives/reka/')
    ) {
      report(file, specifier, 'reka-ui 只能由 design-system/primitives/reka 导入')
    }
  }
}

visit(sourceRoot)

if (violations.length > 0) {
  console.error(['发现架构依赖越界：', ...violations.map((item) => `- ${item}`)].join('\n'))
  process.exitCode = 1
} else {
  console.info('Architecture boundaries: OK')
}
