import test from 'node:test'
import assert from 'node:assert/strict'
import { Schema } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { parseRichEditorText, serializeRichEditorText } from './richEditorSyntax.js'

const schema = new Schema({
  nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'inline*' }, text: { group: 'inline' },
    codeBoundary: { group: 'inline', inline: true, atom: true, attrs: { side: {} } } },
  marks: { richFormat: { attrs: { tag: {} }, inclusive: false } }
})
const documentOf = text => schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content: parseRichEditorText(text) }] })
const sourceOf = doc => doc.firstChild.content.content.map(node => serializeRichEditorText(node.toJSON())).join('')
const boundaryPositions = doc => {
  const result = []
  doc.descendants((node, at) => { if (node.type.name === 'codeBoundary') result.push(at) })
  return result
}

test('六种格式的原文可往返，代码条文字仍是普通可编辑文本', () => {
  const source = '与{b 粗}{i 斜}{d 删}{h1 标题}{h 大字}{code 代码条1}。'
  const doc = documentOf(source)
  assert.equal(doc.textContent, '与粗斜删标题大字代码条1。')
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
