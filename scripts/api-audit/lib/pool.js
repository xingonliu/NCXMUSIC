'use strict'

const ENTITY_BY_PARENT = {
  song: 'songId',
  songs: 'songId',
  track: 'songId',
  tracks: 'songId',
  artist: 'artistId',
  artists: 'artistId',
  album: 'albumId',
  albums: 'albumId',
  playlist: 'playlistId',
  playlists: 'playlistId',
  sheet: 'playlistId',
  sheets: 'playlistId',
  toplist: 'toplistId',
  topList: 'toplistId',
  mv: 'mvId',
  mvs: 'mvId',
  video: 'videoId',
  videos: 'videoId',
  dj: 'djId',
  djRadio: 'djId',
  djRadios: 'djId',
  program: 'programId',
  programs: 'programId',
  user: 'userId',
  users: 'userId',
  userprofile: 'userId',
  userprofiles: 'userId',
  event: 'eventId',
  events: 'eventId',
}

function parentOf(context) {
  const seg = context.replace(/\[\]$/, '').split('.').pop()
  return seg || ''
}

const EXCLUDE_KEY = /trackIds|alias|albumName|artistName|songName|playlistName|transNames|tags|genre|desc|comment/i

function collect(node, base, out) {
  if (Array.isArray(node)) {
    for (const x of node) collect(x, base + '[]', out)
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (EXCLUDE_KEY.test(k)) continue
      if (k === 'id' && (typeof v === 'number' || /^\d+$/.test(String(v)))) {
        out.push({ entityType: null, id: String(v), jsonPath: base + '.id', context: base })
        continue
      }
      collect(v, base ? base + '.' + k : k, out)
    }
  }
}

function extract(body, apiAuditId, caseId) {
  const raw = []
  collect(body, '', raw)
  const out = []
  for (const f of raw) {
    let entity = ENTITY_BY_PARENT[parentOf(f.context)] || null
    if (!entity && /^list(\[\])?$/i.test(parentOf(f.context) || '') && /^ncm\.(toplist|top_list|toplist_)/i.test(apiAuditId)) {
      entity = 'toplistId'
    }
    if (entity) out.push({ entityType: entity, id: f.id, jsonPath: f.jsonPath, producerApi: apiAuditId, producerCase: caseId })
  }
  return out
}

class FixturePool {
  constructor() {
    this.byEntity = new Map()
    this.byKey = new Map()
  }

  add(entries, capPerEntity = 100) {
    for (const e of entries) {
      const key = e.entityType + ':' + e.id
      if (this.byKey.has(key)) continue
      const arr = this.byEntity.get(e.entityType) || []
      if (arr.length >= capPerEntity) continue
      arr.push(e)
      this.byEntity.set(e.entityType, arr)
      this.byKey.set(key, true)
    }
  }

  resolve(template) {
    const s = String(template)
    if (!s.includes('{{pool:')) return { value: template, lineage: null }
    const lineages = []
    let missing = null
    const value = s.replace(/\{\{pool:([a-zA-Z]+):(\d+)\}\}/g, (_, entity, idx) => {
      const arr = this.byEntity.get(entity) || []
      const i = parseInt(idx, 10)
      if (i >= arr.length) {
        missing = entity + ':' + idx
        return ''
      }
      const e = arr[i]
      lineages.push({ entityType: e.entityType, producerApi: e.producerApi, producerCase: e.producerCase, jsonPath: e.jsonPath })
      return e.id
    })
    if (missing) return { value: null, lineage: { missing } }
    return { value, lineage: lineages }
  }

  dump() {
    const out = {}
    for (const [entity, arr] of this.byEntity) out[entity] = arr
    return out
  }
}

module.exports = { FixturePool, extract }
