import test from 'node:test'
import assert from 'node:assert/strict'
import { Schema } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { isAtFormattedJoin, mergeFormattedParagraphs, parseRichEditorText, serializeRichEditorText } from './richEditorSyntax.js'

const schema = new Schema({
  nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'inline*' }, text: { group: 'inline' },
    formatBoundary: { group: 'inline', inline: true, atom: true, attrs: { side: {}, tag: {} } } },
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
