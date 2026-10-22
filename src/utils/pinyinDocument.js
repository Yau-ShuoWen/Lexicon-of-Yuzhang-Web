const id = () => crypto.randomUUID()
const text = (sc = '', tc = sc) => ({sc, tc})

function legacyRows(raw) {
  const normalized = String(raw || '').replace(/\\n/g, '\n').replace(/\\\|/g, '|')
  const rows = []
  const plain = []
  for (const line of normalized.split('\n')) {
    const match = line.match(/^\|([^|]+)\|([^|]*)\|$/)
    if (match && !/^[-!: ]+$/.test(match[1]) && !/^[-!: ]+$/.test(match[2])) {
      rows.push({key: match[1], value: match[2]})
    } else if (line.trim() && !/^\|[-!:| ]+\|$/.test(line)) {
      plain.push(line)
    }
  }
  if (plain.length) rows.unshift({key: '说明', value: plain.join('\n')})
  return rows
}

function notesFromLegacy(raw) {
  let values = {}
  try { values = typeof raw === 'string' ? JSON.parse(raw) || {} : raw || {} } catch { values = {sc: raw, tc: raw} }
  const sc = legacyRows(values.sc)
  const tc = legacyRows(values.tc)
  return Array.from({length: Math.max(sc.length, tc.length)}, (_, index) => ({
    id: id(),
    label: text(sc[index]?.key || '', tc[index]?.key || ''),
    value: text(sc[index]?.value || '', tc[index]?.value || '')
  }))
}

export function fromLegacy(source) {
  const layout = JSON.parse(source.layout || '[]')
  const entries = source.entries || []
  const byRoot = new Map()
  for (const entry of entries) {
    const root = entry.rootKey || entry.root_key
    if (!byRoot.has(root)) byRoot.set(root, [])
    byRoot.get(root).push(entry)
  }
  const sections = layout.map(pair => {
    const meta = Array.isArray(pair) ? pair[0] : pair.left
    const lines = Array.isArray(pair) ? pair[1] : pair.right
    return ({
    id: id(), code: meta.code, name: text(meta['name-sc'] || '', meta['name-tc'] || meta['name-sc'] || ''),
    rows: lines.map(groups => ({
      id: id(), groups: groups.map(standards => ({
        id: id(), items: standards.map(standard => {
          const key = standard === '-' ? `empty-${id()}` : `${meta.code}-${standard}`
          const children = (byRoot.get(key) || []).map(entry => ({
            id: id(), key: entry.key, title: entry.title || '', audioKey: entry.key,
            notes: notesFromLegacy(entry.note)
          }))
          byRoot.delete(key)
          return {id: id(), key, standard, children}
        })
      }))
    }))
    })
  })
  const unplaced = [...byRoot.entries()].flatMap(([root, children]) => children.map(entry => ({
    id: id(), key: entry.key, title: entry.title || '', audioKey: entry.key,
    notes: notesFromLegacy(entry.note), previousRoot: root
  })))
  return {version: 2, sections, unplaced}
}

export function allItems(document) {
  return document.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items)))
}

export function ensureNoteLabels(document) {
  document.noteLabels ||= []
  const byId = new Map(document.noteLabels.map(label => [label.id, label]))
  const byText = new Map(document.noteLabels.map(label => [JSON.stringify(label.text), label]))
  const children = [...document.unplaced, ...allItems(document).flatMap(item => item.children)]
  for (const child of children) for (const note of child.notes || []) {
    let label = byId.get(note.labelId)
    if (!label) {
      const value = {sc: note.label?.sc || '', tc: note.label?.tc || ''}
      const key = JSON.stringify(value)
      label = byText.get(key)
      if (!label) {
        label = {id: id(), text: value}
        document.noteLabels.push(label)
        byId.set(label.id, label)
        byText.set(key, label)
      }
      note.labelId = label.id
    }
    note.label = label.text
  }
}

export function getNoteLabelUsages(document) {
  const usages = new Map((document.noteLabels || []).map(label => [label.id, []]))
  const add = (child, item, section) => {
    for (const note of child.notes || []) {
      if (!usages.has(note.labelId)) usages.set(note.labelId, [])
      usages.get(note.labelId).push({childId: child.id, itemId: item?.id || null, sectionId: section?.id || null, noteId: note.id})
    }
  }
  for (const section of document.sections) for (const row of section.rows) for (const group of row.groups) for (const item of group.items)
    for (const child of item.children) add(child, item, section)
  for (const child of document.unplaced) add(child, null, null)
  return usages
}

export function mergeNoteLabel(document, sourceId, targetId) {
  if (sourceId === targetId) return false
  const sourceIndex = document.noteLabels.findIndex(label => label.id === sourceId)
  const target = document.noteLabels.find(label => label.id === targetId)
  if (sourceIndex < 0 || !target) return false
  const children = [...document.unplaced, ...allItems(document).flatMap(item => item.children)]
  for (const child of children) for (const note of child.notes || []) if (note.labelId === sourceId) {
    note.labelId = target.id
    note.label = target.text
  }
  document.noteLabels.splice(sourceIndex, 1)
  return true
}

export function syncItemKeys(document) {
  const updates = []
  const seen = new Set()
  for (const section of document.sections) for (const row of section.rows) for (const group of row.groups) for (const item of group.items) {
    const standard = item.standard?.trim()
    if (!standard) throw new Error('请填写单格的显示文字')
    const key = standard === '-' ? (item.key?.startsWith('empty-') ? item.key : `empty-${item.id}`) : `${section.code}-${standard}`
    if (seen.has(key)) throw new Error(`同一区域中“${standard}”重复，请修改后保存`)
    seen.add(key)
    updates.push([item, key])
  }
  for (const [item, key] of updates) item.key = key
}

export function mergeMissingLegacyChildren(document, legacy) {
  const converted = fromLegacy(legacy)
  const oldChildren = [
    ...converted.unplaced,
    ...allItems(converted).flatMap(item => item.children.map(child => ({...child, previousRoot: item.key})))
  ]
  const known = new Set([
    ...document.unplaced.map(child => child.audioKey || child.key),
    ...allItems(document).flatMap(item => item.children.map(child => child.audioKey || child.key))
  ])
  const processed = new Set(document.migratedLegacyKeys || [])
  let added = 0
  for (const child of oldChildren) {
    if (known.has(child.key) || processed.has(child.key)) continue
    document.unplaced.push({...child, migrationIssue: '旧表有此子项，新表缺失'})
    known.add(child.key)
    added++
  }
  document.migratedLegacyKeys = [...new Set([...processed, ...oldChildren.map(child => child.key)])]
  return added
}

export function tableFromDocument(document, language) {
  return document.sections.map(section => ({
    id: section.id,
    code: section.code,
    name: section.name?.[language] || section.name?.sc || '',
    line: section.rows.map(row => ({id: row.id, group: row.groups.map(group => ({
      id: group.id, item: group.items.map(item => ({
        id: item.key, standard: item.standard === '-' ? '' : ` [${item.standard}] `,
        exist: item.standard !== '-', children: item.children
      }))
    }))}))
  }))
}
