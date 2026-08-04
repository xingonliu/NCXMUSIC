'use strict'
const fs = require('fs')

function splitLines(text) {
  return text.split(/\r?\n/)
}

function upsertSection(filePath, markerLine, content) {
  const exists = fs.existsSync(filePath)
  const text = exists ? fs.readFileSync(filePath, 'utf8') : ''
  const lines = splitLines(text)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(markerLine)) {
      start = i
      break
    }
  }
  let end = lines.length
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) {
        end = i
        break
      }
    }
  }
  const body = content.split(/\r?\n/)
  const prefix = start >= 0 ? lines.slice(0, start) : (lines.length ? lines : [])
  if (start < 0 && prefix.length && prefix[prefix.length - 1] !== '') prefix.push('')
  const suffix = start >= 0 ? lines.slice(end) : []
  if (suffix.length && suffix[0] !== '') suffix.unshift('')
  fs.writeFileSync(filePath, [...prefix, ...body, ...suffix].join('\n'))
}

function stripPhaseSections(text, markers) {
  const lines = splitLines(text)
  const out = []
  let skipping = false
  for (const line of lines) {
    const isMarker = markers.some((m) => line.trim().startsWith(m))
    if (isMarker) {
      skipping = true
      continue
    }
    if (skipping && /^##\s/.test(line)) skipping = false
    if (!skipping) out.push(line)
  }
  return out.join('\n')
}

module.exports = { upsertSection, stripPhaseSections, splitLines }
