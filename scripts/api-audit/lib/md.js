'use strict'
const fs = require('fs')

function splitLines(text) {
  return text.split(/\r?\n/)
}

function upsertSection(filePath, markerLine, content) {
  const exists = fs.existsSync(filePath)
  const text = exists ? fs.readFileSync(filePath, 'utf8') : ''
  const lines = splitLines(text)
  const starts = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(markerLine)) starts.push(i)
  }
  let end = lines.length
  if (starts.length) {
    const first = starts[0]
    const last = starts[starts.length - 1]
    for (let i = last + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) {
        end = i
        break
      }
    }
    const prefix = lines.slice(0, first)
    const suffix = lines.slice(end)
    if (suffix.length && suffix[0] !== '') suffix.unshift('')
    fs.writeFileSync(filePath, [...prefix, ...content.split(/\r?\n/), ...suffix].join('\n'))
    return
  }
  const prefix = lines.length ? lines : []
  if (prefix.length && prefix[prefix.length - 1] !== '') prefix.push('')
  fs.writeFileSync(filePath, [...prefix, ...content.split(/\r?\n/)].join('\n'))
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
