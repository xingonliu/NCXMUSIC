'use strict'
const fs = require('fs')
const path = require('path')

const args = require('../lib/args.js')({
  scanDir: { type: 'string', required: true },
})

const FIELD_PATTERNS = [
  /(?:cookie|music_u|__csrf|csrf|token|access_token|refresh_token|sessionid|deviceid|device_id|signature|sig|secret|apikey|api_key)(?:\s*[:=]\s*)(['"])([^'"`,\s]{4,})\1/gi,
  /\bMUSIC_U=[0-9a-f]{20,}\b/i,
  /\b__csrf=[0-9a-f]{8,}\b/i,
  /\bphone(?:\s*[:=]\s*)(['"]?)(1\d{10})\1/,
  /\bemail(?:\s*[:=]\s*)(['"]?)([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\1/,
  /\bpassword(?:\s*[:=]\s*)(['"])([^'"\s]{4,})\1/i,
  /\bmd5_password(?:\s*[:=]\s*)(['"])([0-9a-f]{32})\1/i,
  /(?:https?:\/\/[^\s"'`]+)\?(?:[^"'`]*)(?:MUSIC_U|csrf|token|signature|phone|email|password)=/i,
]

const REGEX_LITERAL_MARKERS = [/\b\\b\b/, /\{\d+\}/, /\(\?:/, /\\d/, /\\s/]

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const findings = []
  const lines = src.split('\n')
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (REGEX_LITERAL_MARKERS.some((m) => m.test(line))) continue
    for (const re of FIELD_PATTERNS) {
      const re2 = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
      let m
      while ((m = re2.exec(line))) {
        const start = Math.max(0, m.index - 20)
        const snippet = line.slice(start, m.index + 60)
        findings.push({ file, line: li + 1, pattern: re.source.slice(0, 60), offset: m.index, snippet })
      }
    }
  }
  return findings
}

function walk(dir) {
  const out = []
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const files = walk(args.scanDir).filter((f) => {
  const base = path.basename(f)
  return /\.(md|json|csv|txt|js|ts|yaml|yml)$/.test(base) && !base.includes('package-lock')
})

const all = []
for (const f of files) all.push(...checkFile(f))
if (all.length) {
  console.error('SECRET SCAN FAILED: ' + all.length + ' finding(s)')
  for (const x of all) {
    console.error(' -', x.file)
    console.error('   ' + x.snippet)
  }
  process.exit(1)
}
console.log('secret scan PASSED on', files.length, 'files in', args.scanDir)
