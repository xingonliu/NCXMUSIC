'use strict'
function parseArgs(spec) {
  const argv = process.argv.slice(2)
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const eq = key.indexOf('=')
    let name = key
    let value = null
    if (eq >= 0) {
      name = key.slice(0, eq)
      value = key.slice(eq + 1)
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      value = argv[++i]
    }
    opts[name] = value === null ? true : value
  }
  const out = {}
  for (const [name, conf] of Object.entries(spec)) {
    let v = opts[name]
    if (v === undefined && process.env[name.toUpperCase()]) v = process.env[name.toUpperCase()]
    if (v === undefined || v === '') {
      if (conf.default !== undefined) v = conf.default
      else if (conf.required) throw new Error('missing required arg: --' + name)
    }
    if (conf.type === 'int' && v !== undefined) v = parseInt(v, 10)
    if (conf.type === 'bool' && v !== undefined) v = v === 'true' || v === true
    out[name] = v
  }
  return out
}
module.exports = parseArgs
