'use strict'

function typeOf(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) {
    if (v.length === 0) return 'array<unknown>'
    const elemTypes = [...new Set(v.map((x) => typeOf(x)))]
    return 'array<' + (elemTypes.length === 1 ? elemTypes[0] : 'union<' + elemTypes.join('|') + '>') + '>'
  }
  const t = typeof v
  if (t === 'object') return 'object'
  return t
}

function walk(node, base, out, caseRef, auth) {
  if (Array.isArray(node)) {
    if (node.length === 0) {
      out.push({ jsonPath: base, rawType: 'array<unknown>', caseRef, auth, empty: true })
    } else {
      for (let i = 0; i < Math.min(node.length, 3); i++) {
        walk(node[i], base + '[]', out, caseRef, auth)
      }
    }
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      walk(v, base ? base + '.' + k : k, out, caseRef, auth)
    }
    return
  }
  out.push({ jsonPath: base, rawType: typeOf(node), caseRef, auth, empty: false, value: node })
}

function analyze(body, caseRef, auth) {
  const rows = []
  walk(body, '', rows, caseRef, auth)
  return rows
}

module.exports = { analyze, typeOf }
