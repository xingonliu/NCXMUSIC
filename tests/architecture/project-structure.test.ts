import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const requiredDirectories = [
  'src/main',
  'src/preload',
  'src/renderer',
  'src/utility',
  'src/input-hook',
  'src/domains/player',
  'src/domains/music',
  'src/domains/agent',
  'src/domains/security',
  'src/domains/memory',
  'src/domains/profile',
  'src/shared/contracts',
  'src/shared/schemas',
  'src/shared/errors',
  'src/infrastructure/electron',
  'src/infrastructure/netease',
  'src/infrastructure/persistence',
  'src/infrastructure/credentials',
  'src/infrastructure/extensions',
  'src/infrastructure/media',
  'src/infrastructure/shell',
  'src/infrastructure/voice',
  'tests/unit',
  'tests/contract',
  'tests/component',
  'tests/integration',
  'tests/e2e'
] as const

describe('project structure', () => {
  it.each(requiredDirectories)('tracks %s', (directory) => {
    expect(existsSync(resolve(directory))).toBe(true)
  })
})
