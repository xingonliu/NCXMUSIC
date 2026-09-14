import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// -- Tests
  it('uses the supplied renderer without changing its shaders', () => {
    const source = readFileSync('src/renderer/design-system/materials/demo/renderer.js', 'utf8')
      .replace(/\r\n/g, '\n').replace(/\nexport \{ LiquidGlassRenderer \};\n$/, '')
    const provenance = JSON.parse(readFileSync('src/renderer/design-system/materials/demo/source-hashes.json', 'utf8'))
    expect(createHash('sha256').update(source).digest('hex')).toBe(provenance.rendererNormalizedSha256)
  })
