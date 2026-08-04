'use strict'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const args = require('../lib/args.js')({
  workDir: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
  phase: { type: 'string', default: '0' },
})

const errors = []

function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const discovery = JSON.parse(fs.readFileSync(path.join(args.workDir, '01-discovery-universe.json'), 'utf8'))
const inventoryJson = JSON.parse(fs.readFileSync(path.join(args.reportDir, '01-api-inventory.json'), 'utf8'))
const inventory = inventoryJson.inventory
const invIds = new Set(inventory.map((r) => r.apiAuditId))
const uniIds = new Set(discovery.universe.map((u) => u.apiAuditId))

assert(invIds.size === uniIds.size, 'inventory count != universe count')
for (const id of uniIds) {
  assert(invIds.has(id), 'universe - inventory not empty: ' + id)
}
for (const id of invIds) {
  assert(uniIds.has(id), 'inventory - universe not empty: ' + id)
}

const endpointsDir = path.join(args.reportDir, 'endpoints')
const repIds = new Set()
if (fs.existsSync(endpointsDir)) {
  for (const f of fs.readdirSync(endpointsDir)) {
    if (f.endsWith('.md')) repIds.add(f.slice(0, -'.md'.length))
  }
}
for (const id of invIds) {
  assert(repIds.has(id), 'inventory - endpointReports not empty: ' + id)
}
for (const id of repIds) {
  assert(invIds.has(id), 'endpointReports - inventory not empty: ' + id)
}

const phase0 = args.phase === '0'
let withStatus = 0
for (const r of inventory) {
  if (r.terminalStatus) withStatus++
  if (r.plannedCaseCount < 1) assert(false, 'plannedCaseCount < 1: ' + r.apiAuditId)
}
if (!phase0) {
  assert(withStatus === inventory.length, 'terminal statuses missing for ' + (inventory.length - withStatus) + ' APIs')
} else {
  console.log('phase 0: terminalStatus assignment deferred to runtime phases (' + withStatus + '/' + inventory.length + ' assigned)')
}

try {
  execFileSync(process.execPath, [
    path.join(__dirname, '..', 'redaction', 'secret-scan.js'),
    '--scanDir', args.reportDir,
  ], { stdio: 'inherit' })
} catch (e) {
  errors.push('secret scan on reportDir failed')
}

try {
  execFileSync(process.execPath, [
    path.join(__dirname, '..', 'redaction', 'secret-scan.js'),
    '--scanDir', path.join(__dirname, '..'),
  ], { stdio: 'inherit' })
} catch (e) {
  errors.push('secret scan on scripts dir failed')
}

if (errors.length) {
  console.error('SELF-CHECK FAILED:')
  for (const e of errors) console.error(' - ' + e)
  process.exit(1)
}
console.log('SELF-CHECK PASSED (phase ' + args.phase + '): universe=' + uniIds.size + ' inventory=' + invIds.size + ' reports=' + repIds.size)
