const formatPattern = /\/\*[^\r\n]*?\*\/|\{(b|i|d|h1|h|code|dot) ([^{}\r\n]+)}/g
const boundedFormats = new Set(['b', 'i', 'd', 'h', 'code', 'dot'])

export function parseListLine(line) {
  if (line.startsWith('- ')) return { listType: 'bullet', text: line.slice(2) }
  if (line.startsWith('+ ')) return { listType: 'ordered', text: line.slice(2) }
  return { listType: null, text: line }
}

export function listTypeForInput(paragraph, offset, text) {
  if (text !== ' ' || paragraph.attrs.listType || offset !== 1) return null
  return paragraph.textContent === '-' ? 'bullet' : paragraph.textContent === '+' ? 'ordered' : null
}

export function parseRichEditorText(value) {
  const content = []
  let offset = 0
  for (const match of value.matchAll(formatPattern)) {
    if (match.index > offset) content.push({ type: 'text', text: value.slice(offset, match.index) })
    if (match[0].startsWith('/*')) {
      const inner = parseRichEditorText(match[0].slice(2, -2))
      content.push({ type: 'text', text: '/*', marks: [{ type: 'richComment' }] })
      content.push(...inner.map(node => node.type === 'text'
        ? { ...node, marks: [...(node.marks || []), { type: 'richComment' }] } : node))
      content.push({ type: 'text', text: '*/', marks: [{ type: 'richComment' }] })
      offset = match.index + match[0].length
      continue
    }
    if (boundedFormats.has(match[1])) content.push({ type: 'formatBoundary', attrs: { side: 'start', tag: match[1] } })
    content.push({ type: 'text', text: match[2], marks: [{ type: 'richFormat', attrs: { tag: match[1] } }] })
    if (boundedFormats.has(match[1])) content.push({ type: 'formatBoundary', attrs: { side: 'end', tag: match[1] } })
    offset = match.index + match[0].length
  }
  if (offset < value.length) content.push({ type: 'text', text: value.slice(offset) })
  return content
}

export function synchronizeCommentMarks(state) {
  const mark = state.schema.marks.richComment.create()
  const tr = state.tr
  state.doc.descendants((paragraph, position) => {
    if (!paragraph.isTextblock) return
    const parts = []
    let text = ''
    paragraph.forEach((node, offset) => {
      if (!node.isText) return
      parts.push({ node, position: position + 1 + offset, offset: text.length })
      text += node.text
    })
    const ranges = [...text.matchAll(/\/\*[^\r\n]*?\*\//g)]
      .map(match => [match.index, match.index + match[0].length])
    for (const part of parts) {
      const cuts = new Set([0, part.node.text.length])
      for (const [start, end] of ranges) {
        cuts.add(Math.max(0, Math.min(part.node.text.length, start - part.offset)))
        cuts.add(Math.max(0, Math.min(part.node.text.length, end - part.offset)))
      }
      const points = [...cuts].sort((a, b) => a - b)
      for (let index = 0; index < points.length - 1; index++) {
        const from = points[index]
        const to = points[index + 1]
        const inside = ranges.some(([start, end]) => part.offset + from >= start && part.offset + to <= end)
        const marked = !!mark.isInSet(part.node.marks)
        if (inside && !marked) tr.addMark(part.position + from, part.position + to, mark)
        if (!inside && marked) tr.removeMark(part.position + from, part.position + to, mark)
      }
    }
  })
  return tr.steps.length ? tr : null
}

export function serializeRichEditorText(node) {
  if (node.type === 'formatBoundary') return node.attrs?.side === 'start' ? `{${node.attrs.tag} ` : '}'
  const value = node.text || ''
  const tag = node.marks?.find(mark => mark.type === 'richFormat')?.attrs?.tag
  if (boundedFormats.has(tag)) return value
  return tag ? `{${tag} ${value}}` : value
}

export function serializeSelectedRichText(paragraphs, serializeOther = () => '') {
  return paragraphs.map(paragraph => {
    if (paragraph.type !== 'paragraph') return paragraph.type === 'text'
      ? serializeSelectedRichText([{ type: 'paragraph', content: [paragraph] }], serializeOther)
      : serializeOther(paragraph)
    let result = ''
    let activeTag = null
    let activeText = ''
    const flush = () => {
      if (activeTag) result += `{${activeTag} ${activeText}}`
      else result += activeText
      activeText = ''
    }
    for (const node of paragraph.content || []) {
      if (node.type === 'formatBoundary') continue
      if (node.type !== 'text') {
        flush()
        activeTag = null
        result += serializeOther(node)
        continue
      }
      const tag = node.marks?.find(mark => mark.type === 'richFormat')?.attrs?.tag || null
      if (tag !== activeTag) {
        flush()
        activeTag = tag
      }
      activeText += node.text || ''
    }
    flush()
    return result
  }).join('\n')
}

export function mergeFormattedParagraphs(state, firstStart) {
  const first = state.doc.nodeAt(firstStart)
  const second = first && state.doc.nodeAt(firstStart + first.nodeSize)
  const end = first?.lastChild
  const begin = second?.firstChild
  if (!first?.isTextblock || !second?.isTextblock) return null
  const hasBoundary = [...first.content.content, ...second.content.content]
    .some(node => node.type.name === 'formatBoundary')
  if (!hasBoundary) return null
  const sameFormat = end?.type.name === 'formatBoundary' && end.attrs.side === 'end'
    && begin?.type.name === 'formatBoundary' && begin.attrs.side === 'start'
    && end.attrs.tag === begin.attrs.tag
  const joined = (sameFormat ? first.content.cut(0, first.content.size - 1) : first.content)
    .append(sameFormat ? second.content.cut(1, second.content.size) : second.content)
  const tr = state.tr.replaceWith(firstStart, firstStart + first.nodeSize + second.nodeSize,
    first.type.create(first.attrs, joined))
  return { tr, cursor: firstStart + first.content.size + (sameFormat ? 0 : 1), tag: sameFormat ? end.attrs.tag : null }
}

export function isAtFormattedJoin(paragraph, offset, key) {
  if (key === 'Backspace') return offset === 0
    || (offset === 1 && paragraph.firstChild?.type.name === 'formatBoundary'
      && paragraph.firstChild.attrs.side === 'start')
  if (key === 'Delete') return offset === paragraph.content.size
    || (offset === paragraph.content.size - 1 && paragraph.lastChild?.type.name === 'formatBoundary'
      && paragraph.lastChild.attrs.side === 'end')
  return false
}
