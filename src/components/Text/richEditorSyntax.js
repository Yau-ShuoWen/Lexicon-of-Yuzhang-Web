const formatPattern = /\{(b|i|d|h1|h|code) ([^{}\r\n]+)}/g

export function parseRichEditorText(value) {
  const content = []
  let offset = 0
  for (const match of value.matchAll(formatPattern)) {
    if (match.index > offset) content.push({ type: 'text', text: value.slice(offset, match.index) })
    if (match[1] === 'code') content.push({ type: 'codeBoundary', attrs: { side: 'start' } })
    content.push({ type: 'text', text: match[2], marks: [{ type: 'richFormat', attrs: { tag: match[1] } }] })
    if (match[1] === 'code') content.push({ type: 'codeBoundary', attrs: { side: 'end' } })
    offset = match.index + match[0].length
  }
  if (offset < value.length) content.push({ type: 'text', text: value.slice(offset) })
  return content
}

export function serializeRichEditorText(node) {
  if (node.type === 'codeBoundary') return node.attrs?.side === 'start' ? '{code ' : '}'
  const value = node.text || ''
  const tag = node.marks?.find(mark => mark.type === 'richFormat')?.attrs?.tag
  if (tag === 'code') return value
  return tag ? `{${tag} ${value}}` : value
}
