'use strict'
const fs = require('fs')
const path = require('path')

const args = require('../lib/args.js')({
  reportDir: { type: 'string', required: true },
  runId: { type: 'string', required: true },
})

const { renderEndpointMd } = require('../lib/endpoint-facts.js')

const endpointsDir = path.join(args.reportDir, 'endpoints')
let n = 0
for (const f of fs.readdirSync(endpointsDir).filter((x) => x.endsWith('.json'))) {
  const jsonPath = path.join(endpointsDir, f)
  const mdPath = jsonPath.replace(/\.json$/, '.md')
  if (!fs.existsSync(mdPath)) continue
  renderEndpointMd(mdPath, jsonPath, args.runId)
  n++
}
console.log('rendered', n, 'endpoint mds')
