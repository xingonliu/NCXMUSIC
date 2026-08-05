import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const expectedArtifacts = [
  'out/main/index.js',
  'out/main/utility.js',
  'out/preload/index.js',
  'out/renderer/index.html'
]

const missingArtifacts = expectedArtifacts.filter((path) => !existsSync(resolve(path)))

if (missingArtifacts.length > 0) {
  console.error(`缺少构建产物：\n${missingArtifacts.map((path) => `- ${path}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.info('Build artifacts: OK')
}
