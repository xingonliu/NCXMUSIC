'use strict'
const fs = require('fs')
const path = require('path')

const args = require('../lib/args.js')({
  pkgDir: { type: 'string', required: true },
  outDir: { type: 'string', required: true },
  repoDir: { type: 'string' },
})

const MODULE_DIR = path.join(args.pkgDir, 'module')
let files = fs
  .readdirSync(MODULE_DIR)
  .filter((f) => f.endsWith('.js'))
  .sort()
const fileSet = new Set(files)
if (args.repoDir) {
  const repoDir = path.join(args.repoDir, 'module')
  if (fs.existsSync(repoDir)) {
    for (const f of fs.readdirSync(repoDir).filter((f) => f.endsWith('.js'))) {
      if (!fileSet.has(f)) files.push(f)
    }
    files.sort()
  }
}

function analyze(name, src) {
  const titleMatch = src.match(/^\s*\/\/\s*(.+)$/m)
  const urlMatches = []
  for (const m of src.matchAll(/request\(\s*(`|'|")(\/[^`'"${}]+)\1/g)) {
    urlMatches.push(m[2])
  }
  const templated = []
  for (const m of src.matchAll(/request\(\s*`(\/[^`]*\$\{[^`]*)/g)) {
    templated.push(m[1])
  }
  const cryptoMatch = src.match(/createOption\(\s*query\s*,\s*'(weapi|eapi|xeapi|linuxapi)'/)
  const checkToken = /createOption\(\s*query\s*,\s*'[^']*'\s*,\s*true/.test(src) || /createOption\(\s*query\s*,\s*true/.test(src)
  const unblock = /query\.unblock/.test(src)
  const params = [...new Set([...src.matchAll(/\bquery\.([A-Za-z0-9_]+)\b/g)].map((m) => m[1]))]
  const defaults = []
  for (const m of src.matchAll(/query\.([A-Za-z0-9_]+)\s*=\s*query\.\1\s*\|\|\s*('([^']*)'|"([^"]*)"|(\d+))/g)) {
    defaults.push({ name: m[1], default: m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] })
  }
  for (const m of src.matchAll(/\b([A-Za-z0-9_]+)\s*:\s*query\.([A-Za-z0-9_]+)\s*\|\|\s*('([^']*)'|"([^"]*)"|(\d+))/g)) {
    defaults.push({ name: m[2], default: m[4] !== undefined ? m[4] : m[5] !== undefined ? m[5] : m[6] })
  }
  const paginationParams = params.filter((p) => /^(limit|offset|page|cursor|before|after|time|lasttime)$/.test(p))
  const hasCookie = /query\.cookie|\bcookie\b/.test(src) && /query\.cookie/.test(src)
  const writesSelf = /module\.exports\s*=\s*[^]*?result\.body\.code/.test(src)
  const asyncFn = /module\.exports\s*=\s*(async\s*)?\(/.test(src)
  const cryptoMode = cryptoMatch ? cryptoMatch[1] : null
  const localOnly = !/request\(/.test(src)
  return {
    moduleName: name,
    title: titleMatch ? titleMatch[1].trim() : null,
    urls: urlMatches,
    templatedUrls: templated,
    cryptoMode,
    checkToken,
    unblock,
    params,
    defaults,
    paginationParams,
    hasCookie,
    asyncFn,
    localOnly,
    sourceLen: src.length,
  }
}

const out = files.map((f) => {
  const pkgPath = path.join(MODULE_DIR, f)
  const filePath = fs.existsSync(pkgPath) ? pkgPath : path.join(args.repoDir, 'module', f)
  const src = fs.readFileSync(filePath, 'utf8')
  return analyze(path.basename(f, '.js'), src)
})

fs.mkdirSync(args.outDir, { recursive: true })
fs.writeFileSync(path.join(args.outDir, '02-static-analysis.json'), JSON.stringify(out, null, 2))
console.log('static analysis written:', path.join(args.outDir, '02-static-analysis.json'))
console.log('modules analyzed:', out.length)
console.log('local-only (no request call):', out.filter((m) => m.localOnly).map((m) => m.moduleName).join(', '))
