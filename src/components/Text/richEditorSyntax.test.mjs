import test from 'node:test'
import assert from 'node:assert/strict'
import { Schema } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { isAtFormattedJoin, listTypeForInput, mergeFormattedParagraphs, parseListLine, parseRichEditorText, serializeRichEditorText, serializeSelectedRichText } from './richEditorSyntax.js'

const schema = new Schema({
  nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'inline*', attrs: { listType: { default: null } } }, text: { group: 'inline' },
    formatBoundary: { group: 'inline', inline: true, atom: true, attrs: { side: {}, tag: {} } },
    listMarker: { group: 'inline', inline: true, atom: true, attrs: { listType: {} } } },
  marks: { richFormat: { attrs: { tag: {} }, inclusive: true } }
})
const documentOf = text => schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content: parseRichEditorText(text) }] })
const sourceOf = doc => doc.firstChild.content.content.map(node => serializeRichEditorText(node.toJSON())).join('')
const boundaryPositions = doc => {
  const result = []
  doc.descendants((node, at) => { if (node.type.name === 'formatBoundary' && node.attrs.tag === 'code') result.push(at) })
  return result
}

test('七种格式的原文可往返，代码条文字仍是普通可编辑文本', () => {
  const source = '与{b 粗}{i 斜}{d 删}{h1 标题}{h 大字}{dot 着重}{code 代码条1}。'
  const doc = documentOf(source)
  assert.equal(doc.textContent, '与粗斜删标题大字着重代码条1。')
  assert.equal(sourceOf(doc), source)
  const [start, end] = boundaryPositions(doc)
  assert.equal(doc.nodeAt(start + 1).type.name, 'text')
  assert.equal(doc.nodeAt(end).attrs.side, 'end')
})

test('左右边界分别提供框外与框内位置，输入结果不同', () => {
  const doc = documentOf('与{code 代码条}。')
  const [start, end] = boundaryPositions(doc)
  const codeMark = schema.marks.richFormat.create({ tag: 'code' })
  for (const [position, marks, expected] of [
    [start, [], '与外{code 代码条}。'],
    [start + 1, [codeMark], '与{code 内代码条}。'],
    [end, [codeMark], '与{code 代码条内}。'],
    [end + 1, [], '与{code 代码条}外。']
  ]) {
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, position) })
    const inserted = expected.includes('内') ? '内' : '外'
    assert.equal(sourceOf(state.apply(state.tr.setStoredMarks(marks).insertText(inserted)).doc), expected)
  }
})

test('删除代码条首尾字符不损坏边界', () => {
  const doc = documentOf('与{code 代码条1}。')
  const [start, end] = boundaryPositions(doc)
  const state = EditorState.create({ schema, doc })
  assert.equal(sourceOf(state.apply(state.tr.delete(end - 1, end)).doc), '与{code 代码条}。')
  assert.equal(sourceOf(state.apply(state.tr.delete(start + 1, start + 2)).doc), '与{code 码条1}。')
})

test('文字格式和着重号都有独立边界，标题末尾继续输入标题文字', () => {
  for (const tag of ['b', 'i', 'd', 'h', 'dot']) {
    const doc = documentOf(`前{${tag} 文字}后`)
    const boundaries = []
    doc.descendants((node, at) => { if (node.type.name === 'formatBoundary') boundaries.push([at, node.attrs]) })
    assert.deepEqual(boundaries.map(([, attrs]) => [attrs.tag, attrs.side]), [[tag, 'start'], [tag, 'end']])
    assert.equal(sourceOf(doc), `前{${tag} 文字}后`)
  }
  const heading = documentOf('{h1 标题}')
  const atEnd = heading.firstChild.content.size
  const state = EditorState.create({ schema, doc: heading, selection: TextSelection.create(heading, atEnd + 1) })
  assert.equal(sourceOf(state.apply(state.tr.insertText('续')).doc), '{h1 标题续}')
})

test('删除两段格式之间的换行时保留外侧边界并合并文字', () => {
  const doc = schema.node('doc', null, [
    schema.nodeFromJSON({ type: 'paragraph', content: parseRichEditorText('{b 前}') }),
    schema.nodeFromJSON({ type: 'paragraph', content: parseRichEditorText('{b 后}') })
  ])
  const state = EditorState.create({ schema, doc })
  const merged = mergeFormattedParagraphs(state, 0)
  assert.ok(merged)
  assert.equal(merged.tag, 'b')
  assert.equal(merged.cursor, 3)
  assert.equal(merged.tr.doc.childCount, 1)
  assert.equal(sourceOf(merged.tr.doc), '{b 前后}')
})

test('不同格式之间删除换行时各自保留边界', () => {
  const doc = schema.node('doc', null, [
    schema.nodeFromJSON({ type: 'paragraph', content: parseRichEditorText('{b 前}') }),
    schema.nodeFromJSON({ type: 'paragraph', content: parseRichEditorText('{i 后}') })
  ])
  const merged = mergeFormattedParagraphs(EditorState.create({ schema, doc }), 0)
  assert.equal(merged.tag, null)
  assert.equal(sourceOf(merged.tr.doc), '{b 前}{i 后}')
})

test('光标在第二行首字符后时先删除字符，不合并换行', () => {
  const plain = schema.nodeFromJSON({ type: 'paragraph', content: [{ type: 'text', text: '2. xxxxx' }] })
  assert.equal(isAtFormattedJoin(plain, 1, 'Backspace'), false)
  assert.equal(isAtFormattedJoin(plain, 0, 'Backspace'), true)
  assert.equal(isAtFormattedJoin(plain, plain.content.size - 1, 'Delete'), false)
  const formatted = schema.nodeFromJSON({ type: 'paragraph', content: parseRichEditorText('{b xxxxx}') })
  assert.equal(isAtFormattedJoin(formatted, 1, 'Backspace'), true)
  assert.equal(isAtFormattedJoin(formatted, formatted.content.size - 1, 'Delete'), true)
})

test('行首减号或加号输入空格时立即成为列表，原文前缀保留', () => {
  for (const [marker, expected] of [['-', 'bullet'], ['+', 'ordered']]) {
    const paragraph = schema.node('paragraph', null, schema.text(marker))
    assert.equal(listTypeForInput(paragraph, 1, ' '), expected)
    assert.deepEqual(parseListLine(`${marker} 内容`), { listType: expected, text: '内容' })
    assert.equal(listTypeForInput(paragraph, 1, '字'), null)
  }
  assert.equal(listTypeForInput(schema.node('paragraph', null, schema.text('正文')), 1, ' '), null)
})

test('列表回车生成普通行，列表标记可单次取消', () => {
  const paragraph = schema.node('paragraph', { listType: 'bullet' }, [
    schema.node('listMarker', { listType: 'bullet' }), schema.text('内容')
  ])
  const doc = schema.node('doc', null, [paragraph])
  const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, paragraph.content.size + 1) })
  const tr = state.tr.split(state.selection.from, 1, [{ type: paragraph.type, attrs: { listType: null } }])
  assert.equal(tr.doc.child(0).attrs.listType, 'bullet')
  assert.equal(tr.doc.child(1).attrs.listType, null)
  const removedMarker = state.tr.delete(1, 2).setNodeMarkup(0, undefined, { listType: null })
  assert.equal(removedMarker.doc.child(0).attrs.listType, null)
  assert.equal(removedMarker.doc.child(0).textContent, '内容')
})

test('复制部分或完整格式文字时得到对应的富文本原文', () => {
  const doc = documentOf('前{b 加粗}后')
  const partial = doc.firstChild.content.cut(2, 4).content.map(node => node.toJSON())
  assert.equal(serializeSelectedRichText([{ type: 'paragraph', content: partial }]), '{b 加粗}')
  const whole = doc.firstChild.toJSON()
  assert.equal(serializeSelectedRichText([whole]), '前{b 加粗}后')
  const marker = { type: 'listMarker', attrs: { listType: 'ordered' } }
  const text = parseRichEditorText('{dot 着重}')
  const list = { type: 'paragraph', attrs: { listType: 'ordered' }, content: [marker, ...text] }
  const other = node => node.type === 'listMarker' ? '+ ' : ''
  assert.equal(serializeSelectedRichText([list], other), '+ {dot 着重}')
  assert.equal(serializeSelectedRichText([{ ...list, content: text }], other), '{dot 着重}')
  assert.equal(serializeSelectedRichText([marker], other), '+ ')
})
