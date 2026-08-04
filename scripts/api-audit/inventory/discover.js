'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const args = require('../lib/args.js')({
  pkgDir: { type: 'string', required: true },
  repoDir: { type: 'string', required: true },
  outDir: { type: 'string', required: true },
})

const PKG_MODULE_DIR = path.join(args.pkgDir, 'module')
const REPO_MODULE_DIR = path.join(args.repoDir, 'module')

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function listModules(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => {
      const p = path.join(dir, f)
      const stat = fs.statSync(p)
      return {
        name: path.basename(f, '.js'),
        file: f,
        size: stat.size,
        sha256: sha256File(p),
      }
    })
}

const repoModules = listModules(REPO_MODULE_DIR)
const pkgModules = listModules(PKG_MODULE_DIR)

const moduleByName = new Map()
for (const m of repoModules) {
  moduleByName.set(m.name, { name: m.name, inRepo: true, repoSize: m.size, repoSha256: m.sha256, inPkg: false })
}
for (const m of pkgModules) {
  const rec = moduleByName.get(m.name) || { name: m.name, inRepo: false, inPkg: true }
  rec.inPkg = true
  rec.pkgSize = m.size
  rec.pkgSha256 = m.sha256
  if (rec.inRepo && rec.repoSha256 !== rec.pkgSha256) {
    rec.repoPkgChecksumDiffer = true
  }
  moduleByName.set(m.name, rec)
}

const modules = [...moduleByName.values()].sort((a, b) => a.name.localeCompare(b.name))

function parseTypes(dtsPath) {
  const out = []
  if (!fs.existsSync(dtsPath)) return out
  const src = fs.readFileSync(dtsPath, 'utf8')
  const re = /export\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:\s*Promise<Response>/g
  let m
  while ((m = re.exec(src))) {
    out.push({ name: m[1], paramSource: m[2].trim() })
  }
  return out
}

const typeDecls = parseTypes(path.join(args.pkgDir, 'interface.d.ts'))

function parseDocs(homeMdPath) {
  const out = []
  if (!fs.existsSync(homeMdPath)) return out
  const src = fs.readFileSync(homeMdPath, 'utf8')
  const idx = src.indexOf('## 接口文档')
  if (idx < 0) return out
  const tail = src.slice(idx)
  const secRe = /^### (.+)$/gm
  let m
  const sections = []
  let last
  while ((m = secRe.exec(tail))) {
    if (last) last.end = m.index
    last = { title: m[1].trim(), start: m.index }
    sections.push(last)
  }
  if (last) last.end = tail.length
  for (const s of sections) {
    const body = tail.slice(s.start, s.end)
    const addr = body.match(/接口地址\s*:\*+\s*`([^`]+)`/)
    const method = body.match(/(GET|POST)\s+/)
    out.push({
      title: s.title,
      route: addr ? addr[1].trim() : null,
      method: method ? method[1] : null,
    })
  }
  return out
}

const docEntries = parseDocs(path.join(args.repoDir, 'public', 'docs', 'home.md'))

function routeToModule(route) {
  const r = route.replace(/^\//, '')
  return r.split('?')[0].split('/').join('_').replace(/-/g, '_')
}

function scanTests(repoDir) {
  const tokens = new Set()
  const routes = new Set()
  const files = []
  for (const rel of [
    'test',
    'module_example',
    'examples',
  ]) {
    const dir = path.join(repoDir, rel)
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.js') || f.endsWith('.ts')) files.push(path.join(dir, f))
      }
    }
  }
  for (const f of ['main.test.js', 'server.test.js']) {
    const p = path.join(repoDir, f)
    if (fs.existsSync(p)) files.push(p)
  }
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    for (const m of src.matchAll(/`\/([a-z0-9_/.\-]+)`/g)) routes.add('/' + m[1])
    for (const m of src.matchAll(/(?:require\([^)]*module\/([a-z0-9_]+)|typeof main\.([a-z][a-z0-9_]*)|\.([a-z][a-z0-9_]*)\s*=\s*\(\s*\)\s*=>)/g)) {
      if (m[1]) tokens.add(m[1])
      if (m[2]) tokens.add(m[2])
      if (m[3]) tokens.add(m[3])
    }
  }
  return { files: files.map((f) => path.relative(repoDir, f)), tokens: [...tokens], routes: [...routes] }
}

const testScan = scanTests(args.repoDir)
const testTokenSet = new Set(testScan.tokens)
const testRouteSet = new Set(testScan.routes)
const docRouteSet = new Set(docEntries.map((d) => d.route).filter(Boolean))
const typeNameSet = new Set(typeDecls.map((t) => t.name))

const universe = modules.map((mod) => {
  const discoveredFrom = []
  if (mod.inRepo) discoveredFrom.push('repo-module')
  if (mod.inPkg) discoveredFrom.push('pkg-module')
  const typeDecl = typeDecls.find((t) => t.name === mod.name)
  if (typeDecl) {
    discoveredFrom.push('types')
  } else if (mod.inPkg && typeNameSet.size > 0) {
    discoveredFrom.push('types-missing')
  }
  const docByRoute = docEntries.filter((d) => d.route && routeToModule(d.route) === mod.name.replace(/-/g, '_'))
  const docsMatched = docByRoute.length ? docByRoute.map((d) => d.route) : []
  if (docsMatched.length) {
    discoveredFrom.push('docs:' + docsMatched.join(','))
  } else {
    discoveredFrom.push('docs-missing')
  }
  if (testTokenSet.has(mod.name)) discoveredFrom.push('tests')
  return {
    apiAuditId: 'ncm.' + mod.name,
    moduleName: mod.name,
    exportName: mod.name,
    inRepo: mod.inRepo,
    inPkg: mod.inPkg,
    repoSha256: mod.repoSha256 || null,
    pkgSha256: mod.pkgSha256 || null,
    repoPkgChecksumDiffer: mod.repoPkgChecksumDiffer || false,
    discoveredFrom,
  }
})

const moduleNameSet = new Set(modules.map((m) => m.name))
const typeOnlyEntries = typeDecls
  .filter((t) => !moduleNameSet.has(t.name))
  .map((t) => {
    const discoveredFrom = ['types']
    const docByRoute = docEntries.filter((d) => d.route && routeToModule(d.route) === t.name)
    const docsMatched = docByRoute.length ? docByRoute.map((d) => d.route) : []
    if (docsMatched.length) {
      discoveredFrom.push('docs:' + docsMatched.join(','))
    } else {
      discoveredFrom.push('docs-missing')
    }
    return {
      apiAuditId: 'ncm.' + t.name,
      moduleName: t.name,
      exportName: t.name,
      inRepo: false,
      inPkg: false,
      repoSha256: null,
      pkgSha256: null,
      repoPkgChecksumDiffer: false,
      moduleMissing: true,
      discoveredFrom,
    }
  })

const universeAll = [...universe, ...typeOnlyEntries]

const moduleNames = new Set(modules.map((m) => m.name))
const typeOnly = typeDecls
  .filter((t) => !moduleNames.has(t.name))
  .map((t) => t.name)
const docOnly = docEntries
  .map((d) => d.route && routeToModule(d.route))
  .filter((x) => x && !moduleNames.has(x) && !typeOnly.includes(x))
const testOnly = testScan.tokens.filter((t) => !moduleNames.has(t))

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sources: {
    repoModuleCount: repoModules.length,
    pkgModuleCount: pkgModules.length,
    typeDeclCount: typeDecls.length,
    docSectionCount: docEntries.length,
    docRoutedCount: docEntries.filter((d) => d.route).length,
    testFileCount: testScan.files.length,
  },
  moduleDiff: {
    inRepoNotPkg: modules.filter((m) => m.inRepo && !m.inPkg).map((m) => m.name),
    inPkgNotRepo: modules.filter((m) => m.inPkg && !m.inRepo).map((m) => m.name),
    checksumDiffer: modules.filter((m) => m.repoPkgChecksumDiffer).map((m) => m.name),
  },
  typeOnlyDecls: typeOnly,
  docOnlyRoutes: docOnly,
  testOnlyTokens: testOnly,
  docs: docEntries,
  tests: testScan,
  universe: universeAll,
}

const outFile = path.resolve(args.outDir, '01-discovery-universe.json')
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
console.log('discovery written:', outFile)
console.log('repo modules:', repoModules.length, '| pkg modules:', pkgModules.length)
console.log('types:', typeDecls.length, '| docs sections:', docEntries.length, '| docs routed:', docEntries.filter((d) => d.route).length)
console.log('universe size:', universe.length)
