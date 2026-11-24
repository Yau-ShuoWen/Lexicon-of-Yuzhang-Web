<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { InputRule, Mark, Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Paragraph from '@tiptap/extension-paragraph'
import Image from '@tiptap/extension-image'
import { Fragment, Slice } from '@tiptap/pm/model'
import { NodeSelection, Plugin, Selection, TextSelection } from '@tiptap/pm/state'
import { GapCursor } from '@tiptap/pm/gapcursor'
import { dropPoint } from '@tiptap/pm/transform'
import { closeHistory } from '@tiptap/pm/history'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { request } from '../../services/request.js'
import closeIcon from '../../assets/icons/close.svg'
import downloadIcon from '../../assets/icons/download.svg'
import zoomInIcon from '../../assets/icons/zoom-in.svg'
import zoomOutIcon from '../../assets/icons/zoom-out.svg'
import moveIcon from '../../assets/icons/move.svg'
import leftIcon from '../../assets/icons/to-left.svg'
import rightIcon from '../../assets/icons/to-right.svg'
import ungroupIcon from '../../assets/icons/ungroup.svg'
import plusIcon from '../../assets/icons/plus-white.svg'
import { renderDiaryBody } from '../../views/Diary/diaryBodyStyle.js'
import { isAtFormattedJoin, listTypeForInput, mergeFormattedParagraphs, parseListLine, parseRichEditorText, serializeRichEditorText, serializeSelectedRichText, synchronizeCommentMarks } from './richEditorSyntax.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  ownerId: { type: [String, Number], default: null },
  placeholder: { type: String, default: '' },
  imagesEnabled: { type: Boolean, default: true },
  localImages: { type: Boolean, default: false },
  images: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue', 'upload-state-change', 'image-added'])
// 旧版本数字 ID 仅兼容读取；新图片使用非连续的 UUID 标识。
const picturePattern = /^\{p (?:(.*?)=>)?([1-9][0-9]*|[0-9a-f-]{36})(?:~([0-9]{2,3}))?}$/
const embeddedPicturePattern = /\{p (?:(?:[^{}\r\n]*?)=>)?(?:[1-9][0-9]*|[0-9a-f-]{36})(?:~[0-9]{2,3})?}/g
const embeddedElementPattern = /\{pg (?:\{p [^{}]+})*}|\{p (?:(?:[^{}\r\n]*?)=>)?(?:[1-9][0-9]*|[0-9a-f-]{36})(?:~[0-9]{2,3})?}/g
const tableRowPattern = /^\s*\|(.+)\|\s*$/
const tableDividerPattern = /^:?-{2,}[!*+$]?:?$|^:?-{2,}:?[!*+$]?$/
function tableCells(line) { return line.trim().slice(1, -1).split('|').map(cell => cell.trim()) }
function tableCellParagraphs(source) {
  return source.split('\\\\').map(line => {
    const parsed = parseListLine(line)
    return { type: 'paragraph', attrs: { listType: parsed.listType },
      content: [...(parsed.listType ? [{ type: 'listMarker', attrs: { listType: parsed.listType } }] : []),
        ...parseRichEditorText(parsed.text)] }
  })
}
function tableFromLines(lines, start) {
  const first = lines[start]
  if (!tableRowPattern.test(first)) return null
  const firstCells = tableCells(first)
  const firstIsDivider = firstCells.every(cell => tableDividerPattern.test(cell))
  const second = lines[start + 1]
  const hasHeader = !firstIsDivider && tableRowPattern.test(second || '')
    && tableCells(second).every(cell => tableDividerPattern.test(cell))
  if (!firstIsDivider && !hasHeader) return null
  const divider = firstIsDivider ? firstCells : tableCells(second)
  const leftHeader = firstIsDivider && divider[0].includes('$')
  const columns = divider.map(cell => ({
    align: cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left',
    width: cell.includes('*') ? 'long' : cell.includes('+') ? 'normal' : 'nowrap',
    marker: cell.replace('$', '')
  }))
  const rows = []
  if (hasHeader) rows.push(firstCells)
  let end = start + (hasHeader ? 2 : 1)
  while (end < lines.length && tableRowPattern.test(lines[end])) rows.push(tableCells(lines[end++]))
  const columnCount = Math.max(columns.length, ...rows.map(row => row.length))
  while (columns.length < columnCount) columns.push({ align: 'left', width: 'nowrap' })
  return { end, node: { type: 'editorTable', attrs: { columns, hasHeader, leftHeader }, content: rows.map(row => ({
    type: 'editorTableRow', content: columns.map((_, index) => ({
      type: 'editorTableCell', content: tableCellParagraphs(row[index] || '')
    }))
  })) } }
}
function tableDivider(column) {
  if (column.marker) return column.marker
  const width = column.width === 'long' ? '*' : column.width === 'normal' ? '+' : ''
  return `${column.align === 'center' || column.align === 'left' && column.marker?.startsWith(':') ? ':' : ''}---${width}${column.align === 'center' || column.align === 'right' ? ':' : ''}`
}
const editor = shallowRef(null)
const fileInput = ref(null)
const insertMenu = ref(null)
const mobileInsertButton = ref(null)
let pendingInsertPosition = null
const uploading = ref(false)
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
let uploadCount = 0
function changeUpload(delta) {
  uploadCount += delta
  uploading.value = uploadCount > 0
  emit('upload-state-change', uploading.value)
}
const dragging = ref(false)
function onFileDragOver(event) {
  if (props.imagesEnabled && event.dataTransfer?.types?.includes('Files')) dragging.value = true
}
function onFileDragLeave(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (event.clientX <= rect.left || event.clientX >= rect.right || event.clientY <= rect.top || event.clientY >= rect.bottom) dragging.value = false
}
const previewId = ref(null)
const previewGroupIds = ref([])
const activeImagePosition = ref(null)
const activeImageWidth = ref(160)
const zoom = ref(1)
const viewer = ref(null)
const previewCanvas = ref(null)
const previewOffset = ref({ x: 0, y: 0 })
let previewDrag = null
const previewPointers = new Map()
let pinchDistance = 0
const recoveredImages = ref({})
const pendingImages = new Set()
const retryTimers = new Map()
const retryCounts = new Map()
const clipboardImages = new Map()
const localImageBlobs = new Map()
const pendingClipboardImages = new Map()
const emittedValues = new Set()
let internalDragActive = false
const editorHovered = ref(false)
const fullPreview = ref(false)
const fullPreviewBody = ref(null)

function renderFullPreview() {
  const body = fullPreviewBody.value
  if (!body || !fullPreview.value) return
  renderDiaryBody(body, { text: props.modelValue, images: { ...props.images, ...recoveredImages.value }, viewMode: 'self' })
  // Older diary pictures have no width suffix. The editor treats them as 160px;
  // match that size in the inline preview without changing the shared renderer.
  for (const image of body.querySelectorAll('.rt-picture img[data-image-id]')) {
    if (!image.style.width) image.style.width = '160px'
  }
}
function toggleFullPreview() {
  fullPreview.value = !fullPreview.value
  if (fullPreview.value) { closeInsertMenu(); nextTick(renderFullPreview) }
  else nextTick(() => editor.value?.commands.focus())
}
function openFullPreviewImage(event) {
  const image = event.target.closest?.('.rt-picture img[data-image-id]')
  if (image) openPreview(image.dataset.imageId)
}
function onFullPreviewContextMenu(event) {
  const image = event.target.closest?.('.rt-picture img[data-image-id]')
  if (!image) return
  event.preventDefault()
  const index = [...fullPreviewBody.value.querySelectorAll('.rt-picture img[data-image-id]')].indexOf(image)
  let count = 0
  let position = null
  editor.value?.state.doc.descendants((node, at) => {
    if (node.type.name === 'image' && count++ === index) position = at
  })
  if (position !== null) openImageMenu(position, event.clientX, event.clientY)
}

function imageFor(id) { return recoveredImages.value[id] || props.images[id] }
function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
async function readDiaryOriginal(id) {
  if (localImageBlobs.has(id)) return localImageBlobs.get(id)
  if (props.localImages) {
    const url = imageFor(id)?.url
    if (!url) throw new Error('本地图片已失效')
    return (await fetch(url)).blob()
  }
  const token = localStorage.getItem('auth-token')
  const response = await fetch(`/api/diary/edit/${props.ownerId}/image/${encodeURIComponent(id)}/original`, {
    headers: token ? { 'X-Auth-Token': token } : {}
  })
  if (!response.ok) throw new Error(`原图读取失败（${response.status}）`)
  return response.blob()
}
async function prepareClipboardImage(id, url) {
  if (!id || !url || String(id).startsWith('pending:')) return
  const cached = clipboardImages.get(id)
  if (cached?.url === url || pendingClipboardImages.has(id)) return
  const task = (async () => {
    const blob = await readDiaryOriginal(id)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) throw new Error('原图格式不受支持')
    clipboardImages.set(id, { url, blob, data: await blobDataUrl(blob) })
  })()
  pendingClipboardImages.set(id, task)
  try { await task }
  catch (error) { console.warn('图片剪贴板准备失败', id, error) }
  finally { pendingClipboardImages.delete(id) }
}
function copiedFragment(fragment) {
  return Fragment.fromArray(fragment.content.map(node => {
    if (node.type.name === 'image') {
      const prepared = clipboardImages.get(String(node.attrs.imageId))
      return node.type.create({ ...node.attrs, imageId: null, sourceImageId: String(node.attrs.imageId), src: prepared?.data || node.attrs.src })
    }
    return node.content.size ? node.copy(copiedFragment(node.content)) : node
  }))
}
function selectedPicture(view) {
  const selected = view.state.selection.node
  if (selected?.type.name === 'image') return selected
  const slice = view.state.selection.content()
  const pictures = []
  let hasText = false
  const inspect = node => {
    if (node.type.name === 'image') pictures.push(node)
    else if (node.isText && node.text?.trim()) hasText = true
    node.forEach(inspect)
  }
  slice.content.forEach(inspect)
  return pictures.length === 1 && !hasText ? pictures[0] : null
}
async function pngForClipboard(blob) {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    return await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片转换失败')), 'image/png'))
  } finally { bitmap.close() }
}
function copyPicture(node, event = null) {
  const id = String(node?.attrs.imageId || '')
  if (!/^([1-9][0-9]*|[0-9a-f-]{36})$/.test(id)) return false
  const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const source = imageFor(id)?.url || node.attrs.src || ''
  const html = `<img src="${escape(source)}" data-source-image-id="${escape(id)}" data-display-width="${Number(node.attrs.displayWidth) || 160}" alt="${escape(node.attrs.alt || '')}">`
  event?.clipboardData?.setData('text/html', html)
  event?.clipboardData?.setData('text/plain', textOf({ type: 'image', attrs: node.attrs }))
  event?.preventDefault()
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    alert('当前浏览器不支持复制图片到剪贴板')
    return true
  }
  const original = clipboardImages.get(id)?.blob || readDiaryOriginal(id)
  const png = Promise.resolve(original).then(pngForClipboard)
  try {
    navigator.clipboard.write([new ClipboardItem({
      'image/png': png,
      'text/html': new Blob([html], { type: 'text/html' })
    })]).catch(error => {
      console.warn('图片写入剪贴板失败', error)
      alert('复制图片失败，请检查浏览器剪贴板权限')
    })
  } catch (error) {
    console.warn('图片写入剪贴板失败', error)
    alert('复制图片失败，请检查浏览器剪贴板权限')
  }
  return true
}
function pictureToDocument(source) {
  const picture = source.match(picturePattern)
  if (!picture) return null
  return { type: 'image', attrs: { src: imageFor(picture[2])?.url || '', imageId: picture[2], alt: picture[1] || '', displayWidth: Number(picture[3]) || 160 } }
}
function toDocument(value) {
  const lines = value.replace(/\r/g, '').split('\n')
  let coveredUntil = 0
  return {
    type: 'doc',
    content: lines.flatMap((sourceLine, index) => {
      if (index < coveredUntil) return []
      const table = tableFromLines(lines, index)
      if (table) { coveredUntil = table.end; return [table.node] }
      const { listType, text: line } = parseListLine(sourceLine)
      const content = listType ? [{ type: 'listMarker', attrs: { listType } }] : []
      let offset = 0
      for (const match of props.imagesEnabled ? line.matchAll(embeddedElementPattern) : []) {
        if (match.index > offset) content.push(...parseRichEditorText(line.slice(offset, match.index)))
        if (match[0].startsWith('{pg ')) {
          const members = [...match[0].slice(4, -1).matchAll(embeddedPicturePattern)].map(member => pictureToDocument(member[0])).filter(Boolean)
          content.push({ type: 'imageGroup', attrs: { groupKey: crypto.randomUUID() }, content: members })
        } else {
          const picture = pictureToDocument(match[0])
          if (picture) content.push(picture)
        }
        offset = match.index + match[0].length
      }
      if (offset < line.length) content.push(...parseRichEditorText(line.slice(offset)))
      return [{ type: 'paragraph', attrs: { listType }, content }]
    })
  }
}
function textOf(node) {
  if (node.type === 'editorTable') {
    const rows = (node.content || []).map(row => `|${(row.content || []).map(cell => (cell.content || []).map(textOf).join('\\\\')).join('|')}|`)
    const divider = `|${(node.attrs?.columns || []).map((column, index) => `${tableDivider(column)}${node.attrs?.leftHeader && index === 0 ? '$' : ''}`).join('|')}|`
    rows.splice(node.attrs?.hasHeader ? 1 : 0, 0, divider)
    return rows.join('\n')
  }
  if (node.type === 'paragraph') {
    return (node.content || []).map(textOf).join('')
  }
  if (node.type === 'listMarker') return node.attrs?.listType === 'bullet' ? '- ' : '+ '
  if (node.type === 'text') return serializeRichEditorText(node)
  if (node.type === 'formatBoundary') return serializeRichEditorText(node)
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'image') {
    const id = String(node.attrs?.imageId || '')
    if (!/^([1-9][0-9]*|[0-9a-f-]{36})$/.test(id)) return ''
    const caption = String(node.attrs?.alt || '').replace(/[{}\r\n]/g, '').trim()
    const width = Number(node.attrs?.displayWidth)
    const suffix = width >= 80 && width <= 900 ? `~${width}` : '~160'
    return caption ? `{p ${caption}=>${id}${suffix}}` : `{p ${id}${suffix}}`
  }
  if (node.type === 'imageGroup') return `{pg ${(node.content || []).map(textOf).join('')}}`
  return (node.content || []).map(textOf).join('')
}
function plainFromSlice(slice) {
  return serializeSelectedRichText(slice.content.content.map(node => node.toJSON()), textOf)
}
function plainTextSlice(text, schema) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.some((_, index) => tableFromLines(lines, index))) {
    return new Slice(Fragment.fromArray(toDocument(text).content.map(node => schema.nodeFromJSON(node))), 0, 0)
  }
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n').map(line => {
    const parsed = parseListLine(line)
    return schema.nodeFromJSON({ type: 'paragraph', attrs: { listType: parsed.listType },
      content: [...(parsed.listType ? [{ type: 'listMarker', attrs: { listType: parsed.listType } }] : []),
        ...parseRichEditorText(parsed.text)] })
  })
  return new Slice(Fragment.fromArray(paragraphs), 1, 1)
}
function handlePlainClipboard(view, event, cut = false) {
  const selection = view.state.selection
  if (selection.empty || !event.clipboardData) return false
  const slice = selection.content()
  let hasImage = false
  slice.content.forEach(node => {
    if (node.type.name === 'image') hasImage = true
    node.descendants(child => { if (child.type.name === 'image') hasImage = true })
  })
  if (hasImage) return false
  event.clipboardData.setData('text/plain', plainFromSlice(slice).replace(/\n/g, '\r\n'))
  event.preventDefault()
  if (cut) view.dispatch(closeHistory(view.state.tr).delete(selection.from, selection.to))
  return true
}
function fromDocument() {
  return (editor.value?.getJSON().content || []).map(textOf).join('\n')
}
function updateModel() {
  const value = fromDocument()
  emittedValues.add(value)
  if (emittedValues.size > 100) emittedValues.delete(emittedValues.values().next().value)
  emit('update:modelValue', value)
}
function setImageInDocument(id, image, retry = false) {
  const instance = editor.value
  if (!instance || !image?.url) return
  const source = retry ? `${image.url}${image.url.includes('?') ? '&' : '?'}retry=${Date.now()}` : image.url
  let transaction = instance.state.tr
  instance.state.doc.descendants((node, position) => {
    if (node.type.name === 'image' && String(node.attrs.imageId) === String(id) && node.attrs.src !== source) {
      transaction = transaction.setNodeMarkup(position, undefined, { ...node.attrs, src: source })
    }
  })
  if (transaction.docChanged) instance.view.dispatch(transaction.setMeta('addToHistory', false))
}
function scheduleRetry(id) {
  if (retryTimers.has(id) || String(id).startsWith('pending:')) return
  const attempts = retryCounts.get(id) || 0
  if (attempts >= 3) {
    for (const node of document.querySelectorAll('.rich-image-editor__picture')) {
      if (node.dataset.imageId === String(id)) node.classList.add('rich-image-editor__picture--failed')
    }
    return
  }
  retryCounts.set(id, attempts + 1)
  retryTimers.set(id, setTimeout(() => {
    retryTimers.delete(id)
    if (editor.value?.state.doc) {
      let exists = false
      editor.value.state.doc.descendants(node => { if (node.type.name === 'image' && String(node.attrs.imageId) === String(id)) exists = true })
      if (exists) recoverImage(id, true)
    }
  }, 3000))
}
async function recoverImage(id, force = false) {
  if (props.localImages) return
  if (pendingImages.has(id) || (!force && imageFor(id)?.url)) return
  pendingImages.add(id)
  try {
    const image = await request(`/api/diary/edit/${props.ownerId}/image/${id}`, { timeout: 15000 })
    retryCounts.delete(id)
    recoveredImages.value = { ...recoveredImages.value, [id]: image }
    setImageInDocument(id, image, force)
  } catch (error) { console.warn('日记图片无法获取', id, error); scheduleRetry(id) }
  finally { pendingImages.delete(id) }
}
function openPreview(id) {
  const picture = [...(editor.value?.view.dom.querySelectorAll('.rich-image-editor__picture') || [])].find(node => node.dataset.imageId === id)
  const source = picture?.querySelector('img')
  if (!source?.naturalWidth) return
  if (!previewGroupIds.value.length) previewGroupIds.value = picture.closest('.rich-image-editor__group')
    ? [...picture.closest('.rich-image-editor__group').querySelectorAll('.rich-image-editor__picture[data-image-id]')].map(item => item.dataset.imageId)
    : [id]
  previewId.value = id
  zoom.value = 1
  previewOffset.value = { x: 0, y: 0 }
  nextTick(() => {
    const canvas = previewCanvas.value
    if (canvas) {
      canvas.width = source.naturalWidth
      canvas.height = source.naturalHeight
      canvas.getContext('2d').drawImage(source, 0, 0)
    }
    viewer.value?.focus()
  })
}
function closePreview() { previewDrag = null; previewPointers.clear(); pinchDistance = 0; previewId.value = null; previewGroupIds.value = [] }
function onViewerBackdropClick(event) {
  if (event.target.closest?.('canvas, button, a')) return
  closePreview()
}
function startPreviewDrag(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  previewPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (previewPointers.size === 2) {
    const [first, second] = [...previewPointers.values()]
    pinchDistance = Math.hypot(first.x - second.x, first.y - second.y)
    previewDrag = null
  }
  if (previewPointers.size === 1) previewDrag = { x: event.clientX - previewOffset.value.x, y: event.clientY - previewOffset.value.y }
  event.currentTarget.setPointerCapture(event.pointerId)
}
function movePreviewDrag(event) {
  if (!previewPointers.has(event.pointerId)) return
  previewPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (previewPointers.size === 2) {
    const [first, second] = [...previewPointers.values()]
    const distance = Math.hypot(first.x - second.x, first.y - second.y)
    if (pinchDistance) setZoom(zoom.value * distance / pinchDistance)
    pinchDistance = distance
    previewDrag = null
  } else if (previewDrag) previewOffset.value = { x: event.clientX - previewDrag.x, y: event.clientY - previewDrag.y }
}
function endPreviewDrag(event) { previewPointers.delete(event.pointerId); pinchDistance = 0; previewDrag = null }
function setZoom(value) { zoom.value = Math.min(4, Math.max(.25, value)) }
function groupPosition(key) {
  let found = null
  editor.value?.state.doc.descendants((node, position) => {
    if (node.type.name === 'imageGroup' && node.attrs.groupKey === key) found = position
  })
  return found
}
function insertEmptyGroup(position) {
  const instance = editor.value
  if (!instance) return false
  const key = crypto.randomUUID()
  const node = instance.state.schema.nodes.imageGroup.create({ groupKey: key })
  const slice = new Slice(Fragment.from(node), 0, 0)
  const target = dropPoint(instance.state.doc, position ?? instance.state.selection.from, slice)
  if (target == null) return false
  instance.view.dispatch(instance.state.tr.insert(target, node))
  return key
}
function closeInsertMenu() { insertMenu.value = null }
const textFormats = [
  { key: 'b', label: '粗体', glyph: '粗' },
  { key: 'i', label: '斜体', glyph: '斜' },
  { key: 'd', label: '删除线', glyph: '删' },
  { key: 'h1', label: '标题', glyph: '标题' },
  { key: 'h', label: '大字', glyph: '大字' },
  { key: 'code', label: '代码', glyph: '代码' },
  { key: 'dot', label: '着重号', glyph: '点' }
]
const formatBubble = ref(null)
let selectionPointerId = null
let selectionStartedOutsideTable = false
let tableCornerDrag = null
let formatBubbleFrame = 0
function tablePositionForFrame(view, frame) {
  let found = null
  view.state.doc.descendants((node, position) => {
    if (node.type.name === 'editorTable' && view.nodeDOM(position) === frame) found = position
  })
  return found
}
function scheduleFormatBubble() {
  cancelAnimationFrame(formatBubbleFrame)
  formatBubbleFrame = requestAnimationFrame(() => { formatBubbleFrame = 0; showFormatBubble() })
}
function selectedFormat(state) {
  const { from, to, empty } = state.selection
  if (empty) return null
  const start = state.doc.resolve(from)
  const end = state.doc.resolve(to)
  if (start.parent !== end.parent || !start.parent.isTextblock) return null
  const text = state.doc.textBetween(from, to, '\n')
  if (!text || /[{}\r\n]/.test(text) || to - from !== text.length) return null
  const tags = new Set()
  let hasPlain = false
  let hasOther = false
  state.doc.nodesBetween(from, to, node => {
    if (node.isText) {
      const mark = node.marks.find(item => item.type.name === 'richFormat')
      if (mark) tags.add(mark.attrs.tag)
      else hasPlain = true
    } else if (node.isInline) hasOther = true
  })
  if (hasOther || tags.size > 1 || (hasPlain && tags.size)) return { blocked: true }
  return { from, to, text, key: tags.values().next().value || null,
    wholeLine: start.parentOffset === 0 && end.parentOffset === start.parent.content.size }
}
function showFormatBubble() {
  const instance = editor.value
  if (!instance || fullPreview.value) return
  const selected = selectedFormat(instance.state)
  if (!selected || selected.blocked) { formatBubble.value = null; return }
  const selection = window.getSelection()
  const browserRect = selection?.rangeCount && !selection.isCollapsed && instance.view.dom.contains(selection.anchorNode)
    ? selection.getRangeAt(0).getClientRects()[0] : null
  const start = browserRect || instance.view.coordsAtPos(instance.state.selection.from)
  const end = browserRect || instance.view.coordsAtPos(instance.state.selection.to)
  const left = browserRect ? browserRect.left : start.left
  const right = browserRect ? browserRect.right : end.right
  const top = Math.min(start.top, end.top)
  const bottom = Math.max(start.bottom, end.bottom)
  formatBubble.value = {
    ...selected,
    x: Math.max(160, Math.min((left + right) / 2, window.innerWidth - 160)),
    y: top >= 52 ? top - 48 : Math.min(bottom + 8, window.innerHeight - 48)
  }
}
function onEditorPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) { formatBubble.value = null; return }
  if (!event.target.closest?.('.rich-image-editor__body')) return
  if (event.target.closest?.('.rich-image-editor__table-add')) return
  const frame = event.target.closest?.('.rich-image-editor__table-frame')
  const cell = event.target.closest?.('[data-editor-cell]')
  if (frame && !cell && editor.value) {
    const rect = frame.getBoundingClientRect()
    const topLeft = Math.abs(event.clientX - rect.left) < 14 && Math.abs(event.clientY - rect.top) < 14
    const bottomRight = Math.abs(event.clientX - rect.right) < 14 && Math.abs(event.clientY - rect.bottom) < 14
    if (topLeft || bottomRight) {
      const position = tablePositionForFrame(editor.value.view, frame)
      if (position != null) {
        tableCornerDrag = { pointerId: event.pointerId, position, fromTop: topLeft,
          x: event.clientX, y: event.clientY, moved: false }
        event.preventDefault()
        formatBubble.value = null
        return
      }
    }
  }
  selectionPointerId = event.pointerId
  selectionStartedOutsideTable = !frame
  formatBubble.value = null
}
function moveTableCornerDrag(event) {
  const drag = tableCornerDrag
  if (!drag || drag.pointerId !== event.pointerId || !editor.value) return
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true
  if (!drag.moved) return
  const view = editor.value.view
  const node = view.state.doc.nodeAt(drag.position)
  if (node?.type.name !== 'editorTable') return
  const frame = view.nodeDOM(drag.position)
  const rect = frame?.getBoundingClientRect()
  const inside = rect && event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom
  const anchor = drag.fromTop ? drag.position : drag.position + node.nodeSize
  const opposite = drag.fromTop ? drag.position + node.nodeSize : drag.position
  const mapped = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
  const head = inside || mapped == null || drag.position < mapped && mapped < drag.position + node.nodeSize
    ? opposite : mapped
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, head)))
}
function onSelectionPointerEnd(event) {
  if (tableCornerDrag?.pointerId === event.pointerId) {
    if (event.type === 'pointerup') moveTableCornerDrag(event)
    const drag = tableCornerDrag
    tableCornerDrag = null
    if (event.type === 'pointerup' && !drag.moved && editor.value) {
      editor.value.view.dispatch(editor.value.state.tr.setSelection(NodeSelection.create(editor.value.state.doc, drag.position)))
    }
    return
  }
  if (selectionPointerId !== event.pointerId) return
  selectionPointerId = null
  if (event.type === 'pointerup') {
    queueMicrotask(() => {
      if (editor.value) includeWholeTableInSelection(editor.value.view, true)
      scheduleFormatBubble()
    })
  }
}
function includeWholeTableInSelection(view, afterPointerUp = false) {
  if (!selectionStartedOutsideTable || selectionPointerId === null && !afterPointerUp) return false
  const { state } = view
  const { selection } = state
  if (selection.empty || !(selection instanceof TextSelection)) return false
  const { anchor, head } = selection
  let table = null
  state.doc.descendants((node, position) => {
    if (node.type.name === 'editorTable' && position < head && head < position + node.nodeSize) {
      table = { position, end: position + node.nodeSize }
    }
  })
  if (!table || table.position < anchor && anchor < table.end) return false
  const target = anchor < table.position ? table.end : table.position
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, anchor, target)))
  return true
}
const boundedFormats = new Set(['b', 'i', 'd', 'h', 'code', 'dot'])
function formatSelectedText(key) {
  const instance = editor.value
  const selected = insertMenu.value?.kind === 'format' ? insertMenu.value.selection : instance && selectedFormat(instance.state)
  if (!selected || selected.blocked) return
  if (key === 'h1' && !selected.wholeLine) return
  if (boundedFormats.has(key)) {
    const schema = instance.state.schema
    const tr = instance.state.tr
    if (selected.key === key) {
      const start = tr.doc.nodeAt(selected.from - 1)
      const end = tr.doc.nodeAt(selected.to)
      if (start?.type.name !== 'formatBoundary' || start.attrs.side !== 'start' || start.attrs.tag !== key
        || end?.type.name !== 'formatBoundary' || end.attrs.side !== 'end' || end.attrs.tag !== key) return
      tr.replaceWith(selected.from - 1, selected.to + 1, schema.text(selected.text))
    } else if (!selected.key) {
      const mark = schema.marks.richFormat.create({ tag: key })
      tr.replaceWith(selected.from, selected.to, [
        schema.nodes.formatBoundary.create({ side: 'start', tag: key }),
        schema.text(selected.text, [mark]),
        schema.nodes.formatBoundary.create({ side: 'end', tag: key })
      ])
    } else return
    instance.view.dispatch(tr)
  } else if (selected.key) {
    if (selected.key !== key) return
    instance.view.dispatch(instance.state.tr.removeMark(selected.from, selected.to, instance.state.schema.marks.richFormat))
  } else instance.view.dispatch(instance.state.tr.addMark(selected.from, selected.to,
    instance.state.schema.marks.richFormat.create({ tag: key })))
  formatBubble.value = null
  closeInsertMenu()
  instance.commands.focus()
}
function selectFormatBoundary(view, event) {
  if (event.button !== 0) return false
  const boundary = event.target.closest?.('.rich-image-editor__format-boundary')
  if (!boundary || !view.dom.contains(boundary)) return false
  const pos = view.posAtDOM(boundary.parentNode, [...boundary.parentNode.childNodes].indexOf(boundary))
  const node = view.state.doc.nodeAt(pos)
  if (node?.type.name !== 'formatBoundary') return false
  const rect = boundary.getBoundingClientRect()
  const after = event.clientX >= (rect.left + rect.right) / 2
  const position = pos + (after ? 1 : 0)
  const mark = view.state.schema.marks.richFormat.create({ tag: node.attrs.tag })
  const inside = node.attrs.side === 'start' ? after : !after
  event.preventDefault()
  view.focus()
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position))
    .setStoredMarks(inside ? [mark] : []))
  return true
}
function moveAcrossFormatBoundary(view, event) {
  if (!['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete'].includes(event.key)
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !view.state.selection.empty) return false
  const { $from } = view.state.selection
  const position = $from.pos
  const forward = event.key === 'ArrowRight' || event.key === 'Delete'
  const boundary = forward ? $from.nodeAfter : $from.nodeBefore
  if (boundary?.type.name !== 'formatBoundary') return false
  const target = position + (forward ? 1 : -1)
  const inside = boundary.attrs.side === (forward ? 'start' : 'end')
  const mark = view.state.schema.marks.richFormat.create({ tag: boundary.attrs.tag })
  event.preventDefault()
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target))
    .setStoredMarks(inside ? [mark] : []))
  return true
}
function splitOrMergeFormattedLine(view, event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !view.state.selection.empty) return false
  const { state } = view
  const { $from } = state.selection
  if (!$from.parent.isTextblock) return false
  const paragraph = $from.parent
  const paragraphStart = $from.before()
  const offset = $from.parentOffset
  if (event.key === 'Enter') {
    let start = null
    let pair = null
    paragraph.forEach((child, at) => {
      if (child.type.name !== 'formatBoundary') return
      if (child.attrs.side === 'start') start = { at, tag: child.attrs.tag }
      else if (start) {
        if (start.at + 1 <= offset && offset <= at && start.tag === child.attrs.tag) pair = { ...start, end: at }
        start = null
      }
    })
    if (pair) {
      const boundary = state.schema.nodes.formatBoundary
      const leftHasText = offset > pair.at + 1
      const rightHasText = offset < pair.end
      let left = paragraph.content.cut(0, offset)
      let right = paragraph.content.cut(offset, paragraph.content.size)
      left = leftHasText ? left.append(Fragment.from(boundary.create({ side: 'end', tag: pair.tag })))
        : left.cut(0, pair.at)
      right = rightHasText ? Fragment.from(boundary.create({ side: 'start', tag: pair.tag })).append(right)
        : right.cut(1)
      const tr = state.tr.replaceWith(paragraphStart, $from.after(), [
        paragraph.type.create(paragraph.attrs, left), paragraph.type.create(paragraph.attrs, right)
      ])
      const nextStart = paragraphStart + left.size + 3
      view.dispatch(tr.setSelection(TextSelection.create(tr.doc, nextStart + (rightHasText ? 1 : 0)))
        .setStoredMarks(rightHasText ? [state.schema.marks.richFormat.create({ tag: pair.tag })] : []))
      event.preventDefault()
      return true
    }
    if (paragraph.attrs.listType) {
      const tr = state.tr.split($from.pos, 1, [{ type: paragraph.type,
        attrs: { ...paragraph.attrs, listType: null } }])
      view.dispatch(tr.setSelection(TextSelection.create(tr.doc, $from.pos + 2)).setStoredMarks([]))
      event.preventDefault()
      return true
    }
    if ($from.marks().some(mark => mark.type.name === 'richFormat' && mark.attrs.tag === 'h1')) {
      const tr = state.tr.split($from.pos)
      const nextStart = $from.pos + 2
      tr.removeMark(nextStart, nextStart + tr.doc.nodeAt(nextStart - 1).content.size,
        state.schema.marks.richFormat)
      view.dispatch(tr.setStoredMarks([]))
      event.preventDefault()
      return true
    }
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (event.key === 'Backspace' && offset <= 1 && paragraph.attrs.listType
      && paragraph.firstChild?.type.name === 'listMarker') {
      const tr = state.tr.delete(paragraphStart + 1, paragraphStart + 2)
        .setNodeMarkup(paragraphStart, undefined, { ...paragraph.attrs, listType: null })
      view.dispatch(tr)
      event.preventDefault()
      return true
    }
    if (!isAtFormattedJoin(paragraph, offset, event.key)) return false
    const previous = event.key === 'Backspace' ? state.doc.resolve(paragraphStart).nodeBefore : null
    if (event.key === 'Backspace' && !previous) return false
    const firstStart = event.key === 'Backspace'
      ? paragraphStart - previous.nodeSize
      : paragraphStart
    const merged = mergeFormattedParagraphs(state, firstStart)
    if (!merged) return false
    const { tr, cursor, tag } = merged
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor))
      .setStoredMarks(tag ? [state.schema.marks.richFormat.create({ tag })] : []))
    event.preventDefault()
    return true
  }
  return false
}
function handleFormattedKeyDown(view, event) {
  if (handleTableArrow(view, event)) return true
  return splitOrMergeFormattedLine(view, event) || moveAcrossFormatBoundary(view, event)
}
let pendingTableExit = null
function handleTableArrow(view, event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    || event.ctrlKey || event.metaKey || event.shiftKey || !view.state.selection.empty) return false
  const { state } = view
  const { $from } = state.selection
  let cellDepth = -1
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'editorTableCell') { cellDepth = depth; break }
  }
  if (cellDepth < 0) return false
  if (event.altKey) { event.preventDefault(); return true }
  const rowDepth = cellDepth - 1
  const tableDepth = rowDepth - 1
  if (tableDepth < 1 || $from.node(tableDepth).type.name !== 'editorTable') return false
  const table = $from.node(tableDepth)
  let rowIndex = $from.index(tableDepth)
  let columnIndex = $from.index(rowDepth)
  const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
  if (horizontal) {
    const cell = $from.node(cellDepth)
    const atEdge = event.key === 'ArrowLeft'
      ? $from.index(cellDepth) === 0 && $from.parentOffset === 0
      : $from.index(cellDepth) === cell.childCount - 1 && $from.parentOffset === $from.parent.content.size
    if (!atEdge) return false
  }
  if (!horizontal) {
    const cellDOM = view.nodeDOM($from.before(cellDepth))
    const range = document.createRange()
    if (cellDOM) range.selectNodeContents(cellDOM)
    const lineTops = cellDOM ? new Set([...range.getClientRects()].filter(rect => rect.width || rect.height)
      .map(rect => Math.round(rect.top))) : new Set()
    if (lineTops.size > 1) return false
  }
  event.preventDefault()
  if (event.key === 'ArrowLeft') {
    columnIndex--
    if (columnIndex < 0) { rowIndex--; if (rowIndex >= 0) columnIndex = table.child(rowIndex).childCount - 1 }
  }
  if (event.key === 'ArrowRight') {
    columnIndex++
    if (columnIndex >= table.child(rowIndex).childCount) { rowIndex++; columnIndex = 0 }
  }
  if (event.key === 'ArrowUp') rowIndex--
  if (event.key === 'ArrowDown') rowIndex++
  if (rowIndex < 0 || rowIndex >= table.childCount) {
    const now = performance.now()
    const samePress = pendingTableExit?.key === event.key
      && pendingTableExit.position === $from.pos && now - pendingTableExit.time < 500
    pendingTableExit = event.repeat ? null : { key: event.key, position: $from.pos, time: now }
    if (!samePress || event.repeat) return true
    pendingTableExit = null
    const direction = rowIndex < 0 ? -1 : 1
    const boundary = rowIndex < 0 ? $from.before(tableDepth) : $from.after(tableDepth)
    const $boundary = state.doc.resolve(boundary)
    const outside = GapCursor.valid($boundary) ? new GapCursor($boundary)
      : Selection.near($boundary, direction)
    view.dispatch(state.tr.setSelection(outside))
    return true
  }
  pendingTableExit = null
  let target = $from.start(tableDepth)
  for (let index = 0; index < rowIndex; index++) target += table.child(index).nodeSize
  target++
  for (let index = 0; index < columnIndex; index++) target += table.child(rowIndex).child(index).nodeSize
  const cell = table.child(rowIndex).child(columnIndex)
  const atEnd = event.key === 'ArrowLeft'
  const firstText = target + 2
  const lastText = target + cell.content.size
  let cursor = atEnd ? lastText : firstText
  if (!horizontal && cell.content.size) {
    const sourceX = view.coordsAtPos($from.pos).left
    const cellRect = view.nodeDOM(target)?.getBoundingClientRect()
    const firstLine = view.coordsAtPos(firstText)
    const x = cellRect ? Math.max(cellRect.left + 2, Math.min(sourceX, cellRect.right - 2)) : sourceX
    const nearby = view.posAtCoords({ left: x, top: (firstLine.top + firstLine.bottom) / 2 })?.pos
    if (nearby != null) cursor = Math.max(firstText, Math.min(nearby, lastText))
  }
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, cursor)))
  return true
}
function openInsertMenuAt(position, x, y) {
  const instance = editor.value
  if (!instance || position == null) return
  pendingInsertPosition = Math.max(0, Math.min(position, instance.state.doc.content.size))
  insertMenu.value = {
    x: Math.max(8, Math.min(x, window.innerWidth - 168)),
    y: Math.max(8, Math.min(y, window.innerHeight - 100))
  }
}
function onEditorContextMenu(view, event) {
  if (event.target.closest?.('.rich-image-editor__picture, .rich-image-editor__group')) return false
  formatBubble.value = null
  const cell = event.target.closest?.('[data-editor-cell]')
  if (cell) {
    const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
    if (position != null) {
      const $position = view.state.doc.resolve(position)
      for (let depth = $position.depth; depth > 0; depth--) {
        if ($position.node(depth).type.name !== 'editorTable') continue
        const table = $position.node(depth)
        const row = cell.parentElement
        const columnIndex = [...row.children].indexOf(cell)
        event.preventDefault()
        insertMenu.value = { kind: 'table-column', position: $position.before(depth), columnIndex,
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 230)) }
        return true
      }
    }
  }
  const selected = selectedFormat(view.state)
  if (selected && !selected.blocked) {
    event.preventDefault()
    insertMenu.value = { kind: 'format', selection: selected,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 168)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 240)) }
    return true
  }
  const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
  if (position == null) return false
  event.preventDefault()
  openInsertMenuAt(position, event.clientX, event.clientY)
  return true
}
function selectTableFrame(view, event) {
  if (event.button !== 0) return false
  const frame = event.target.closest?.('.rich-image-editor__table-frame')
  if (!frame || event.target.closest('[data-editor-cell]')) return false
  const position = tablePositionForFrame(view, frame)
  if (position == null) return false
  event.preventDefault()
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position)))
  view.focus()
  return true
}
function updateTableColumn(key, value) {
  const menu = insertMenu.value
  const instance = editor.value
  if (!menu || menu.kind !== 'table-column' || !instance) return
  const node = instance.state.doc.nodeAt(menu.position)
  if (node?.type.name !== 'editorTable') return
  const columns = node.attrs.columns.map((column, index) => index === menu.columnIndex
    ? { ...column, [key]: value, marker: null } : column)
  instance.view.dispatch(instance.state.tr.setNodeMarkup(menu.position, undefined, { ...node.attrs, columns }))
}
function openTableDraft() {
  const menu = insertMenu.value
  if (!menu) return
  insertMenu.value = { kind: 'table-create', rows: 3, columns: 2, hasHeader: false, leftHeader: false,
    position: pendingInsertPosition,
    x: Math.max(8, Math.min(menu.x, window.innerWidth - 250)),
    y: Math.max(8, Math.min(menu.y, window.innerHeight - 260)) }
}
function adjustTableDraft(field, delta) {
  const draft = insertMenu.value
  if (draft?.kind !== 'table-create') return
  const max = field === 'rows' ? 30 : 12
  draft[field] = Math.max(1, Math.min(max, (Number(draft[field]) || 1) + delta))
}
function createTable() {
  const draft = insertMenu.value
  if (draft?.kind !== 'table-create' || !editor.value) return
  const rowCount = Math.max(1, Math.min(30, Number(draft.rows) || 1))
  const columnCount = Math.max(1, Math.min(12, Number(draft.columns) || 1))
  const columns = Array.from({ length: columnCount }, () => ({ align: 'left', width: 'nowrap' }))
  const content = Array.from({ length: rowCount }, () => ({ type: 'editorTableRow',
    content: Array.from({ length: columnCount }, () => ({ type: 'editorTableCell',
      content: [{ type: 'paragraph' }] })) }))
  const position = draft.position
  closeInsertMenu()
  const instance = editor.value
  const $position = instance.state.doc.resolve(Math.min(position ?? instance.state.selection.from, instance.state.doc.content.size))
  const emptyParagraph = $position.depth && $position.node(1).type.name === 'paragraph'
    && !$position.node(1).content.size && !$position.node(1).attrs.listType
  const insertAt = $position.depth ? $position.after(1) : $position.pos
  const range = emptyParagraph ? { from: $position.before(1), to: insertAt } : insertAt
  instance.commands.insertContentAt(range, { type: 'editorTable', attrs: { columns, hasHeader: draft.hasHeader, leftHeader: draft.leftHeader }, content })
}
function updateMobileInsertButton(view) {
  if (!props.imagesEnabled || !isMobile || !view.hasFocus() || !view.state.selection.empty) { mobileInsertButton.value = null; return }
  const position = view.state.selection.from
  const coords = view.coordsAtPos(position)
  mobileInsertButton.value = {
    position,
    x: Math.max(8, Math.min(coords.left - 42, window.innerWidth - 42)),
    y: Math.max(8, Math.min(coords.top, window.innerHeight - 42))
  }
}
function openMobileInsertMenu() {
  const button = mobileInsertButton.value
  if (button) openInsertMenuAt(button.position, button.x, button.y + 38)
}
function insertGroupFromMenu() {
  insertEmptyGroup(pendingInsertPosition)
  closeInsertMenu()
}
function insertImageFromMenu() {
  closeInsertMenu()
  chooseImage(pendingInsertPosition)
}
function onOutsideInsertMenu(event) {
  if (!event.target.closest?.('.rich-image-editor__insert-menu, .rich-image-editor__mobile-insert')) closeInsertMenu()
  if (!event.target.closest?.('.rich-image-editor__format-bubble, .rich-image-editor__body')) formatBubble.value = null
}
function onInsertMenuKeydown(event) { if (event.key === 'Escape') closeInsertMenu() }
function refreshMobileInsertButton() { if (editor.value) updateMobileInsertButton(editor.value.view) }
function removeGroup(key, keepImages = false) {
  const instance = editor.value
  const position = groupPosition(key)
  const node = position == null ? null : instance?.state.doc.nodeAt(position)
  if (node?.type.name !== 'imageGroup') return
  instance.view.dispatch(keepImages
    ? instance.state.tr.replaceWith(position, position + node.nodeSize, node.content)
    : instance.state.tr.delete(position, position + node.nodeSize))
}
function moveNode(source, target) {
  const instance = editor.value
  const node = source == null ? null : instance?.state.doc.nodeAt(source)
  if (!node || target == null || target >= source && target <= source + node.nodeSize) return false
  let transaction = instance.state.tr.delete(source, source + node.nodeSize)
  const slice = new Slice(Fragment.from(node), 0, 0)
  const insertAt = dropPoint(transaction.doc, transaction.mapping.map(target), slice)
  if (insertAt == null) return false
  instance.view.dispatch(transaction.insert(insertAt, node))
  return true
}
let boxDrag = null
function finishBoxDrag(keepPreview = false) {
  window.removeEventListener('pointermove', moveBoxDrag)
  window.removeEventListener('pointerup', releaseBoxDrag)
  window.removeEventListener('pointercancel', cancelBoxDrag)
  boxDrag?.element.classList.remove('rich-image-editor__drag-source')
  if (!keepPreview) boxDrag?.preview?.remove()
  boxDrag = null
}
function startBoxDrag(event, kind, element, getPos = null) {
  if (event.button !== 0 || !editor.value) return
  event.preventDefault()
  event.stopPropagation()
  finishBoxDrag()
  boxDrag = { kind, element, getPos, pointerId: event.pointerId, x: event.clientX, y: event.clientY, preview: null,
    key: kind === 'group' ? element.dataset.groupKey : element.dataset.imageId }
  window.addEventListener('pointermove', moveBoxDrag)
  window.addEventListener('pointerup', releaseBoxDrag)
  window.addEventListener('pointercancel', cancelBoxDrag)
}
function moveBoxDrag(event) {
  const drag = boxDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) { finishBoxDrag(); return }
  if (!drag.preview) {
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    const rect = drag.element.getBoundingClientRect()
    drag.offsetX = drag.x - rect.left
    drag.offsetY = drag.y - rect.top
    drag.preview = drag.element.cloneNode(true)
    drag.preview.classList.add('rich-image-editor__drag-preview')
    Object.assign(drag.preview.style, { width: `${rect.width}px`, height: `${rect.height}px` })
    drag.element.closest('.rich-image-editor').append(drag.preview)
    if (drag.kind !== 'new') drag.element.classList.add('rich-image-editor__drag-source')
    window.getSelection()?.removeAllRanges()
  }
  drag.preview.style.left = `${event.clientX - drag.offsetX}px`
  drag.preview.style.top = `${event.clientY - drag.offsetY}px`
}
function releaseBoxDrag(event) {
  const drag = boxDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  const instance = editor.value
  const targetElement = document.elementFromPoint(event.clientX, event.clientY)
  const insideEditor = instance?.view.dom.contains(targetElement)
  let target = insideEditor ? instance.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos : null
  const sourceGroup = drag.kind === 'image' ? drag.element.closest('.rich-image-editor__group') : null
  if (sourceGroup && !sourceGroup.contains(targetElement) && target != null) {
    const position = groupPosition(sourceGroup.dataset.groupKey)
    const groupNode = position == null ? null : instance.state.doc.nodeAt(position)
    if (groupNode && target > position && target < position + groupNode.nodeSize) {
      const rect = sourceGroup.getBoundingClientRect()
      target = event.clientX >= rect.right || event.clientY >= rect.bottom
        ? position + groupNode.nodeSize : position
    }
  }
  let keepPreview = false
  if (!drag.preview && drag.kind === 'new') insertEmptyGroup(instance.state.selection.from)
  else if (drag.preview && target != null) {
    const oldRects = new Map([...instance.view.dom.querySelectorAll('[data-image-id], [data-group-key]')]
      .map(element => [element.dataset.groupKey || element.dataset.imageId, element.getBoundingClientRect()]))
    const result = drag.kind === 'new' ? insertEmptyGroup(target) : moveNode(drag.getPos(), target)
    if (result) {
      keepPreview = true
      nextTick(() => {
      for (const element of instance.view.dom.querySelectorAll('[data-image-id], [data-group-key]')) {
        const old = oldRects.get(element.dataset.groupKey || element.dataset.imageId)
        if (!old) continue
        const now = element.getBoundingClientRect()
        const dx = old.left - now.left, dy = old.top - now.top
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) element.animate([
          { transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }
        ], { duration: 180, easing: 'ease-out' })
      }
      const moved = drag.kind === 'group' || drag.kind === 'new'
        ? instance.view.dom.querySelector(`[data-group-key="${drag.kind === 'new' ? result : drag.key}"]`)
        : [...instance.view.dom.querySelectorAll('[data-image-id]')].find(element => element.dataset.imageId === drag.key)
      if (moved && drag.preview) {
        const old = drag.preview.getBoundingClientRect(), now = moved.getBoundingClientRect()
        setTimeout(() => drag.preview.remove(), 240)
        drag.preview.animate([{ transform: 'translate(0, 0)', opacity: .75 },
          { transform: `translate(${now.left - old.left}px, ${now.top - old.top}px)`, opacity: 0 }],
        { duration: 160, easing: 'ease-out' }).finished.finally(() => drag.preview.remove())
      } else drag.preview?.remove()
      })
    }
  }
  finishBoxDrag(keepPreview)
}
function cancelBoxDrag(event) { if (boxDrag?.pointerId === event.pointerId) finishBoxDrag() }
function selectImage(position) {
  const node = editor.value?.state.doc.nodeAt(position)
  if (node?.type.name !== 'image') return
  activeImagePosition.value = position
  activeImageWidth.value = Number(node.attrs.displayWidth) || 160
  editor.value.commands.setNodeSelection(position)
}
function openImageMenu(position, x, y) {
  selectImage(position)
  insertMenu.value = {
    kind: 'image',
    position,
    x: Math.max(8, Math.min(x, window.innerWidth - 218)),
    y: Math.max(8, Math.min(y, window.innerHeight - 184))
  }
}
function resizeSelectedImage(width) {
  const instance = editor.value
  const position = activeImagePosition.value
  const node = position == null ? null : instance?.state.doc.nodeAt(position)
  if (node?.type.name !== 'image') return
  const value = Math.min(900, Math.max(80, Math.round(Number(width) / 10) * 10))
  activeImageWidth.value = value
  const transaction = instance.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, displayWidth: value })
  instance.view.dispatch(transaction.setSelection(NodeSelection.create(transaction.doc, position)))
  if (fullPreview.value) nextTick(renderFullPreview)
}
function deleteSelectedImage() {
  const instance = editor.value
  const position = activeImagePosition.value
  const node = position == null ? null : instance?.state.doc.nodeAt(position)
  if (node?.type.name !== 'image') return
  activeImagePosition.value = null
  closeInsertMenu()
  instance.view.dispatch(instance.state.tr.delete(position, position + node.nodeSize))
}
function copySelectedImage() {
  const instance = editor.value
  const position = insertMenu.value?.kind === 'image' ? insertMenu.value.position : activeImagePosition.value
  const node = position == null ? null : instance?.state.doc.nodeAt(position)
  if (node?.type.name !== 'image') return
  instance.commands.setNodeSelection(position)
  instance.view.focus()
  if (!document.execCommand('copy')) copyPicture(node)
}
const pictures = computed(() => [...props.modelValue.matchAll(/\{p (?:(.*?)=>)?([1-9][0-9]*|[0-9a-f-]{36})(?:~[0-9]{2,3})?}/g)].map(match => ({ id: match[2], caption: match[1] || '' })))
const activePicture = computed(() => pictures.value.find(picture => picture.id === previewId.value))
const activeImage = computed(() => activePicture.value && imageFor(activePicture.value.id))
function movePreview(step) {
  const ids = previewGroupIds.value
  const index = ids.indexOf(previewId.value)
  if (index >= 0 && ids.length > 1) openPreview(ids[(index + step + ids.length) % ids.length])
}
function onViewerKeydown(event) {
  if (event.key === 'Escape') closePreview()
  else if (event.key === 'ArrowLeft') movePreview(-1)
  else if (event.key === 'ArrowRight') movePreview(1)
  else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom.value + .1) }
  else if (event.key === '-') { event.preventDefault(); setZoom(zoom.value - .1) }
}
function onPreviewShortcut(event) {
  if (event.key !== 'F2' || event.repeat || previewId.value || !editorHovered.value) return
  event.preventDefault()
  toggleFullPreview()
}

const RichFormat = Mark.create({
  name: 'richFormat',
  inclusive: true,
  excludes: 'richFormat',
  addInputRules() {
    return [new InputRule({
      find: /\{(b|i|d|h1|h|code|dot) ([^{}\r\n]+)}$/,
      handler: ({ range, match, commands }) => {
        commands.insertContentAt(range, parseRichEditorText(match[0]))
      }
    })]
  },
  addAttributes() {
    return { tag: {
      default: 'b',
      parseHTML: element => element.getAttribute('data-rich-format'),
      renderHTML: attributes => ({ 'data-rich-format': attributes.tag })
    } }
  },
  parseHTML() { return [{ tag: 'span[data-rich-format]' }] },
  renderHTML({ HTMLAttributes }) {
    const name = { b: 'bold', i: 'italic', d: 'strike', h1: 'heading', h: 'large', code: 'code', dot: 'dot' }[HTMLAttributes['data-rich-format']]
    return ['span', { ...HTMLAttributes, class: `rich-image-editor__format--${name || 'bold'}` }, 0]
  }
})

const RichComment = Mark.create({
  name: 'richComment',
  inclusive: false,
  parseHTML() { return [{ tag: 'span[data-rich-comment]' }] },
  renderHTML() { return ['span', { 'data-rich-comment': '', class: 'rich-image-editor__comment' }, 0] },
  addInputRules() {
    return [new InputRule({
      find: /\/\*[^\r\n]*?\*\/$/,
      handler: ({ range, match, commands }) => {
        commands.insertContentAt(range, { type: 'text', text: match[0], marks: [{ type: 'richComment' }] })
      }
    })]
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, newState) {
        return transactions.some(tr => tr.docChanged) ? synchronizeCommentMarks(newState) : null
      }
    })]
  }
})

const EditorParagraph = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), listType: {
      default: null,
      parseHTML: element => element.getAttribute('data-list-type'),
      renderHTML: attrs => attrs.listType ? { 'data-list-type': attrs.listType } : {}
    } }
  }
})

function tableIsCompact(node) {
  return node.attrs.columns.length > 0 && node.attrs.columns.every(column => column.width === 'nowrap')
}
function appendTableRow(position) {
  const instance = editor.value
  const table = instance?.state.doc.nodeAt(position)
  if (table?.type.name !== 'editorTable' || table.childCount >= 30) return
  const { editorTableRow, editorTableCell } = instance.state.schema.nodes
  const cells = Array.from({ length: table.attrs.columns.length }, () =>
    editorTableCell.create(null, instance.state.schema.nodes.paragraph.create()))
  instance.view.dispatch(instance.state.tr.insert(position + table.nodeSize - 1, editorTableRow.create(null, cells)))
}
function appendTableColumn(position) {
  const instance = editor.value
  const table = instance?.state.doc.nodeAt(position)
  if (table?.type.name !== 'editorTable' || table.attrs.columns.length >= 12) return
  const tr = instance.state.tr
  const rowEnds = []
  table.forEach((row, offset) => rowEnds.push(position + 1 + offset + row.nodeSize - 1))
  for (const end of rowEnds.reverse()) tr.insert(end,
    instance.state.schema.nodes.editorTableCell.create(null, instance.state.schema.nodes.paragraph.create()))
  tr.setNodeMarkup(position, undefined, { ...table.attrs,
    columns: [...table.attrs.columns, { align: 'left', width: 'nowrap' }] })
  instance.view.dispatch(tr)
}

const EditorTable = Node.create({
  name: 'editorTable', group: 'block', content: 'editorTableRow*', isolating: true, selectable: true,
  addAttributes() { return { columns: { default: [] }, hasHeader: { default: false }, leftHeader: { default: false } } },
  parseHTML() { return [{ tag: 'div[data-editor-table]' }] },
  renderHTML({ node }) { return ['div', { 'data-editor-table': '', class: `rich-image-editor__table-frame${tableIsCompact(node) ? ' rich-image-editor__table-frame--compact' : ''}` },
    ['div', { class: 'rich-image-editor__table-scroll' }, ['table', { 'data-has-header': String(node.attrs.hasHeader),
      class: `rich-image-editor__table${tableIsCompact(node) ? ' rich-image-editor__table--compact' : ''}` }, ['tbody', 0]]]] },
  addNodeView() {
    return ({ node, getPos }) => {
      const frame = document.createElement('div')
      frame.dataset.editorTable = ''
      const scroll = document.createElement('div')
      scroll.className = 'rich-image-editor__table-scroll'
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      table.append(tbody)
      scroll.append(table)
      frame.append(scroll)
      const addButton = (kind, label, action) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `rich-image-editor__table-add rich-image-editor__table-add--${kind}`
        button.setAttribute('aria-label', label)
        button.title = label
        const icon = document.createElement('img')
        icon.src = plusIcon
        icon.alt = ''
        button.append(icon)
        button.contentEditable = 'false'
        button.addEventListener('mousedown', event => event.preventDefault())
        button.addEventListener('click', event => { event.preventDefault(); action(getPos()) })
        frame.append(button)
        return button
      }
      const addColumn = addButton('column', '在右侧增加一列', appendTableColumn)
      const addRow = addButton('row', '在下方增加一行', appendTableRow)
      const placeButtons = () => {
        const firstRow = tbody.firstElementChild?.getBoundingClientRect()
        const firstCell = tbody.firstElementChild?.firstElementChild?.getBoundingClientRect()
        const bounds = frame.getBoundingClientRect()
        if (firstRow) addColumn.style.top = `${firstRow.top + firstRow.height / 2 - bounds.top}px`
        if (firstCell) addRow.style.left = `${firstCell.left + firstCell.width / 2 - bounds.left}px`
      }
      const observer = new ResizeObserver(placeButtons)
      observer.observe(table)
      const update = current => {
        if (current.type.name !== 'editorTable') return false
        const compact = tableIsCompact(current)
        frame.className = `rich-image-editor__table-frame${compact ? ' rich-image-editor__table-frame--compact' : ''}`
        table.className = `rich-image-editor__table${compact ? ' rich-image-editor__table--compact' : ''}`
        table.dataset.hasHeader = String(current.attrs.hasHeader)
        table.dataset.leftHeader = String(current.attrs.leftHeader)
        addColumn.disabled = current.attrs.columns.length >= 12
        addRow.disabled = current.childCount >= 30
        requestAnimationFrame(() => { if (frame.isConnected) placeButtons() })
        return true
      }
      update(node)
      return { dom: frame, contentDOM: tbody, update,
        stopEvent: event => !!event.target.closest?.('.rich-image-editor__table-add'),
        ignoreMutation: mutation => mutation.type !== 'selection' && !tbody.contains(mutation.target),
        destroy: () => observer.disconnect() }
    }
  }
})
const EditorTableRow = Node.create({
  name: 'editorTableRow', content: 'editorTableCell+', isolating: true,
  parseHTML() { return [{ tag: 'tr[data-editor-row]' }] },
  renderHTML() { return ['tr', { 'data-editor-row': '' }, 0] }
})
const EditorTableCell = Node.create({
  name: 'editorTableCell', content: 'paragraph+', isolating: true,
  parseHTML() { return [{ tag: 'td[data-editor-cell]' }] },
  renderHTML() { return ['td', { 'data-editor-cell': '' }, 0] }
})

const ListMarker = Node.create({
  name: 'listMarker',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() { return { listType: {
    default: 'bullet',
    parseHTML: element => element.getAttribute('data-list-marker'),
    renderHTML: attrs => ({ 'data-list-marker': attrs.listType })
  } } },
  parseHTML() { return [{ tag: 'span[data-list-marker]' }] },
  renderHTML({ node }) { return ['span', {
    'data-list-marker': node.attrs.listType,
    class: 'rich-image-editor__list-marker', contenteditable: 'false'
  }, '\u200b'] },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some(tr => tr.docChanged)) return null
        const tr = newState.tr
        newState.doc.forEach((paragraph, position) => {
          if (!paragraph.isTextblock) return
          const listType = paragraph.firstChild?.type.name === 'listMarker'
            ? paragraph.firstChild.attrs.listType : null
          if (paragraph.attrs.listType !== listType) {
            tr.setNodeMarkup(position, undefined, { ...paragraph.attrs, listType })
          }
        })
        return tr.steps.length ? tr : null
      }
    })]
  }
})

const FormatBoundary = Node.create({
  name: 'formatBoundary',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() { return {
    side: { default: 'start', parseHTML: element => element.getAttribute('data-format-boundary') },
    tag: { default: 'code', parseHTML: element => element.getAttribute('data-format-tag') }
  } },
  parseHTML() { return [{ tag: 'span[data-format-boundary]' }] },
  renderHTML({ node }) { return ['span', { 'data-format-boundary': node.attrs.side, 'data-format-tag': node.attrs.tag,
    class: `rich-image-editor__format-boundary rich-image-editor__format-boundary--${node.attrs.side} rich-image-editor__format-boundary--${node.attrs.tag}`, contenteditable: 'false' }, '\u200b'] },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some(tr => tr.docChanged)) return null
        const invalid = []
        const tr = newState.tr
        newState.doc.descendants((node, pos) => {
          if (!node.isTextblock) return
          let open = null
          node.forEach((child, offset) => {
            if (child.type.name !== 'formatBoundary') return
            const at = pos + 1 + offset
            if (child.attrs.side === 'start') {
              if (open !== null) invalid.push([open.at, open.at + 1])
              open = { at, tag: child.attrs.tag }
            } else if (open === null) invalid.push([at, at + 1])
            else {
              if (at === open.at + 1 || child.attrs.tag !== open.tag) {
                invalid.push([open.at, open.at + 1], [at, at + 1])
              }
              else newState.doc.nodesBetween(open.at + 1, at, (inner, innerPos) => {
                const mark = newState.schema.marks.richFormat.create({ tag: open.tag })
                if (inner.isText && !mark.isInSet(inner.marks)) {
                  tr.addMark(innerPos, innerPos + inner.nodeSize, mark)
                }
              })
              open = null
            }
          })
          if (open !== null) invalid.push([open.at, open.at + 1])
        })
        for (const [from, to] of invalid.reverse()) tr.delete(from, to)
        return tr.steps.length ? tr : null
      }
    })]
  }
})

const DiaryImageGroup = Node.create({
  name: 'imageGroup',
  group: 'inline',
  inline: true,
  content: 'image*',
  // 图片组只通过边框的指针手势移动，避免同时触发浏览器原生拖放。
  draggable: false,
  selectable: true,
  isolating: true,
  addAttributes() {
    return { groupKey: { default: null, parseHTML: element => element.getAttribute('data-group-key'),
      renderHTML: attributes => attributes.groupKey ? { 'data-group-key': attributes.groupKey } : {} } }
  },
  parseHTML() { return [{ tag: 'span[data-diary-image-group]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', { ...HTMLAttributes, 'data-diary-image-group': '' }, 0] },
  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement('span')
      dom.className = 'rich-image-editor__group'
      dom.dataset.groupKey = node.attrs.groupKey || crypto.randomUUID()
      const border = document.createElement('span')
      border.className = 'rich-image-editor__group-border'
      border.contentEditable = 'false'
      const handle = document.createElement('button')
      handle.type = 'button'
      handle.title = '拖动整个图片组'
      handle.setAttribute('aria-label', '拖动整个图片组')
      const handleImage = document.createElement('img')
      handleImage.src = moveIcon
      handleImage.alt = ''
      handle.append(handleImage)
      handle.addEventListener('pointerdown', event => startBoxDrag(event, 'group', dom, getPos))
      border.addEventListener('pointerdown', event => {
        if (!event.target.closest('button')) startBoxDrag(event, 'group', dom, getPos)
      })
      const dissolve = document.createElement('button')
      dissolve.type = 'button'
      dissolve.title = '解散图片组，保留图片'
      dissolve.setAttribute('aria-label', '解散图片组，保留图片')
      const dissolveImage = document.createElement('img')
      dissolveImage.src = ungroupIcon
      dissolveImage.alt = ''
      dissolve.append(dissolveImage)
      dissolve.addEventListener('mousedown', event => event.preventDefault())
      dissolve.addEventListener('click', event => { event.stopPropagation(); removeGroup(dom.dataset.groupKey, true) })
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.title = '删除图片组'
      remove.setAttribute('aria-label', '删除图片组')
      const removeImage = document.createElement('img')
      removeImage.src = closeIcon
      removeImage.alt = ''
      remove.append(removeImage)
      remove.addEventListener('mousedown', event => event.preventDefault())
      remove.addEventListener('click', event => { event.stopPropagation(); removeGroup(dom.dataset.groupKey) })
      border.append(handle, dissolve, remove)
      const contentDOM = document.createElement('span')
      contentDOM.className = 'rich-image-editor__group-content'
      dom.append(border, contentDOM)
      return {
        dom, contentDOM,
        update(nextNode) {
          if (nextNode.type.name !== 'imageGroup') return false
          dom.dataset.groupKey = nextNode.attrs.groupKey || dom.dataset.groupKey
          return true
        },
        stopEvent: event => Boolean(event.target.closest('button')),
        selectNode() { dom.classList.add('rich-image-editor__group--selected') },
        deselectNode() { dom.classList.remove('rich-image-editor__group--selected') }
      }
    }
  }
})

const DiaryImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      imageId: {
        default: null,
        parseHTML: element => element.getAttribute('data-image-id'),
        renderHTML: attributes => attributes.imageId ? { 'data-image-id': attributes.imageId } : {}
      },
      sourceImageId: { default: null, parseHTML: element => element.getAttribute('data-source-image-id'),
        renderHTML: attributes => attributes.sourceImageId ? { 'data-source-image-id': attributes.sourceImageId } : {} },
      displayWidth: { default: 160, parseHTML: element => Number(element.getAttribute('data-display-width')) || 160,
        renderHTML: attributes => ({ 'data-display-width': attributes.displayWidth || 160 }) }
    }
  },
  addNodeView() {
    return ({ node, decorations, getPos }) => {
      const dom = document.createElement('div')
      dom.className = 'rich-image-editor__picture'
      dom.contentEditable = 'false'
      let nodeSelected = false
      let rangeSelected = false
      const showSelection = () => dom.classList.toggle('rich-image-editor__picture--selected', nodeSelected || rangeSelected)
      const spinner = document.createElement('span')
      spinner.className = 'rich-image-editor__spinner'
      spinner.setAttribute('aria-label', '图片加载中')
      const img = document.createElement('img')
      img.alt = ''
      img.draggable = false
      img.addEventListener('load', () => {
        dom.classList.add('rich-image-editor__picture--loaded')
        dom.classList.remove('rich-image-editor__picture--failed')
        prepareClipboardImage(dom.dataset.imageId, img.src)
      })
      img.addEventListener('error', () => { dom.classList.remove('rich-image-editor__picture--loaded'); scheduleRetry(dom.dataset.imageId) })
      const legacyLabel = document.createElement('span')
      legacyLabel.className = 'rich-image-editor__legacy'
      legacyLabel.textContent = '旧图'
      legacyLabel.title = '复制这张图片并粘贴回正文，会重新上传原图并生成新标识'
      let clickTimer = null
      img.addEventListener('click', event => {
        event.stopPropagation()
        if (event.detail > 1) { clearTimeout(clickTimer); return }
        clickTimer = setTimeout(() => openPreview(dom.dataset.imageId), 230)
      })
      dom.addEventListener('contextmenu', event => {
        event.preventDefault()
        event.stopPropagation()
        clearTimeout(clickTimer)
        const position = getPos()
        if (typeof position === 'number') openImageMenu(position, event.clientX, event.clientY)
      })
      if (isMobile) img.addEventListener('dblclick', event => {
        event.preventDefault()
        event.stopPropagation()
        clearTimeout(clickTimer)
        const position = getPos()
        if (typeof position === 'number') {
          const rect = dom.getBoundingClientRect()
          openImageMenu(position, rect.left, rect.bottom)
        }
      })
      const controls = document.createElement('span')
      controls.className = 'rich-image-editor__controls'
      const moveButton = document.createElement('button')
      moveButton.type = 'button'
      moveButton.className = 'rich-image-editor__move'
      moveButton.title = '拖动图片'
      moveButton.setAttribute('aria-label', '拖动图片')
      const moveGraphic = document.createElement('img')
      moveGraphic.src = moveIcon
      moveGraphic.alt = ''
      moveButton.append(moveGraphic)
      moveButton.addEventListener('pointerdown', event => startBoxDrag(event, 'image', dom, getPos))
      controls.append(moveButton)
      dom.append(spinner, img, legacyLabel, controls)
      const update = (nextNode, nextDecorations = []) => {
        if (nextNode.type.name !== 'image') return false
        rangeSelected = nextDecorations.some(decoration => decoration.type?.attrs?.class?.includes('rich-image-editor__picture--selected'))
        showSelection()
        const id = String(nextNode.attrs.imageId || '')
        dom.style.setProperty('--picture-width', `${Number(nextNode.attrs.displayWidth) || 160}px`)
        dom.dataset.imageId = id
        legacyLabel.hidden = !/^[1-9][0-9]*$/.test(id)
        if (nextNode.attrs.src) {
          if (img.getAttribute('src') !== nextNode.attrs.src) {
            dom.classList.remove('rich-image-editor__picture--loaded')
            img.src = nextNode.attrs.src
          }
        } else if (!id.startsWith('pending:')) nextTick(() => recoverImage(id))
        return true
      }
      update(node, decorations)
      return {
        dom,
        update,
        selectNode() { nodeSelected = true; showSelection() },
        deselectNode() { nodeSelected = false; showSelection() },
        destroy() { clearTimeout(clickTimer) }
      }
    }
  }
})

function pendingPosition(token) {
  let found = null
  editor.value?.state.doc.descendants((node, position) => {
    if (node.type.name === 'image' && node.attrs.imageId === token) found = position
  })
  return found
}
async function savePastedImage(token, source, alt, sourceImageId = null) {
  changeUpload(1)
  try {
    const blob = sourceImageId ? await readDiaryOriginal(sourceImageId) : await (async () => {
      const response = await fetch(source)
      if (!response.ok) throw new Error('图片读取失败')
      return response.blob()
    })()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 10 * 1024 * 1024) {
      throw new Error('粘贴的图片须为 JPEG、PNG 或 WebP，且不超过 10 MB')
    }
    let image
    if (props.localImages) {
      const id = crypto.randomUUID()
      localImageBlobs.set(id, blob)
      image = { publicId: id, url: await blobDataUrl(blob) }
      recoveredImages.value = { ...recoveredImages.value, [id]: image }
    } else {
      const body = new FormData()
      body.append('file', blob, `pasted.${blob.type.split('/')[1]}`)
      image = await request(`/api/diary/edit/${props.ownerId}/image`, { method: 'POST', body, timeout: 60000 })
    }
    const position = pendingPosition(token)
    if (position !== null) {
      const transaction = editor.value.state.tr.setNodeMarkup(position, undefined, {
        ...editor.value.state.doc.nodeAt(position).attrs,
        src: image.url, imageId: String(image.publicId || image.id), sourceImageId: null, alt
      })
      editor.value.view.dispatch(transaction.setMeta('addToHistory', false))
      emit('image-added', image)
      updateModel()
    }
  } catch (error) {
    const position = pendingPosition(token)
    if (position !== null) editor.value.commands.deleteRange({ from: position, to: position + 1 })
    alert(error instanceof TypeError ? '无法读取图片原图，请从本地文件重新上传' : (error.message || '粘贴图片失败'))
  } finally {
    changeUpload(-1)
  }
}
async function upload(file, appendToEnd = false, position = null) {
  if (!file || !editor.value) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { alert('只支持 JPEG、PNG、WebP 图片'); return }
  if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10 MB'); return }
  const token = `pending:${crypto.randomUUID()}`
  const target = appendToEnd ? editor.value.state.doc.content.size - 1 : position
  const placeholder = { type: 'image', attrs: { src: '', imageId: token, alt: '' } }
  if (target === null) editor.value.commands.insertContent(placeholder)
  else editor.value.commands.insertContentAt(target, placeholder)
  changeUpload(1)
  try {
    let image
    if (props.localImages) {
      const id = crypto.randomUUID()
      localImageBlobs.set(id, file)
      image = { publicId: id, url: await blobDataUrl(file) }
      recoveredImages.value = { ...recoveredImages.value, [id]: image }
    } else {
      const body = new FormData()
      body.append('file', file)
      image = await request(`/api/diary/edit/${props.ownerId}/image`, { method: 'POST', body, timeout: 60000 })
    }
    const position = pendingPosition(token)
    if (position !== null) {
      const transaction = editor.value.state.tr.setNodeMarkup(position, undefined, { ...editor.value.state.doc.nodeAt(position).attrs, src: image.url, imageId: String(image.publicId || image.id), alt: '' })
      editor.value.view.dispatch(transaction.setMeta('addToHistory', false))
    }
    emit('image-added', image)
    updateModel()
  } catch (error) {
    const position = pendingPosition(token)
    if (position !== null) editor.value.commands.deleteRange({ from: position, to: position + 1 })
    alert(error.message || '图片上传失败')
  } finally {
    changeUpload(-1)
    if (fileInput.value) fileInput.value.value = ''
    pendingInsertPosition = null
  }
}
async function chooseImage(position = null) {
  pendingInsertPosition = typeof position === 'number' ? position : null
  if (!/Android/i.test(navigator.userAgent) || typeof window.showOpenFilePicker !== 'function') {
    fileInput.value?.click()
    return
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: '图片', accept: {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp']
      } }],
      excludeAcceptAllOption: true
    })
    if (handle) await upload(await handle.getFile(), pendingInsertPosition === null, pendingInsertPosition)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.warn('系统文件选择器无法打开', error)
      fileInput.value?.click()
    }
  }
}
function insertExistingImage(image) {
  if (!image?.publicId || !image.objectName?.startsWith(`image/diary/${props.ownerId}/`)) return
  editor.value?.chain().focus().insertContent({ type: 'image', attrs: {
    src: image.url, imageId: image.publicId, alt: '', displayWidth: 160
  } }).run()
  emit('image-added', image)
}
defineExpose({ chooseImage, insertExistingImage })
onMounted(() => {
  window.addEventListener('keydown', onPreviewShortcut)
  window.addEventListener('keydown', onInsertMenuKeydown)
  window.addEventListener('scroll', refreshMobileInsertButton, true)
  document.addEventListener('pointerdown', onOutsideInsertMenu)
  window.addEventListener('pointerup', onSelectionPointerEnd)
  window.addEventListener('pointermove', moveTableCornerDrag)
  window.addEventListener('pointercancel', onSelectionPointerEnd)
  editor.value = new Editor({
    content: toDocument(props.modelValue),
    extensions: [StarterKit.configure({
      bold: false, blockquote: false, bulletList: false, code: false, codeBlock: false,
      dropcursor: false,
      heading: false, horizontalRule: false, italic: false, link: false,
      listItem: false, listKeymap: false, orderedList: false, strike: false,
      underline: false, trailingNode: false, paragraph: false
    }), EditorParagraph, EditorTable, EditorTableRow, EditorTableCell, ListMarker, RichFormat, RichComment, FormatBoundary, ...(props.imagesEnabled ? [DiaryImageGroup, DiaryImage.configure({ inline: true })] : [])],
    editorProps: {
      attributes: { class: 'rich-image-editor__body', 'aria-label': props.placeholder, spellcheck: 'false' },
      decorations: state => {
        const selected = []
        state.doc.nodesBetween(state.selection.from, state.selection.to, (node, position) => {
          if (node.type.name === 'image' && state.selection.from <= position && state.selection.to >= position + node.nodeSize) {
            selected.push(Decoration.node(position, position + node.nodeSize, { class: 'rich-image-editor__picture--selected' }))
          }
          if (node.type.name === 'listMarker' && state.selection.from <= position
            && state.selection.to >= position + node.nodeSize) {
            selected.push(Decoration.node(position, position + node.nodeSize, { class: 'rich-image-editor__list-marker--selected' }))
          }
        })
        state.doc.descendants((node, position) => {
          if (node.type.name === 'editorTable') {
            if (state.selection.from <= position && state.selection.to >= position + node.nodeSize) {
              selected.push(Decoration.node(position, position + node.nodeSize, { class: 'rich-image-editor__table-frame--selected' }))
            }
            node.forEach((row, rowOffset) => row.forEach((cell, cellOffset, columnIndex) => {
              const setting = node.attrs.columns[columnIndex] || {}
              const width = setting.width || 'normal'
              selected.push(Decoration.node(position + 1 + rowOffset + 1 + cellOffset,
                position + 1 + rowOffset + 1 + cellOffset + cell.nodeSize,
                { class: `rich-image-editor__cell--${width}`, style: `text-align:${setting.align || 'left'}` }))
            }))
          }
          if (!node.isTextblock || !node.lastChild || node.lastChild.type.name !== 'formatBoundary'
            || node.lastChild.attrs.side !== 'end') return
          selected.push(Decoration.widget(position + node.nodeSize - 1, () => {
            const landing = document.createElement('span')
            landing.className = 'rich-image-editor__cursor-landing'
            landing.contentEditable = 'false'
            landing.textContent = '\u200b'
            return landing
          }, { side: 1, key: `format-end-${position}` }))
        })
        return DecorationSet.create(state.doc, selected)
      },
      clipboardTextSerializer: plainFromSlice,
      handleTextInput: (view, from, to, text) => {
        if (from !== to) return false
        const $from = view.state.doc.resolve(from)
        if (!$from.parent.isTextblock) return false
        if (text === '\\' && $from.parentOffset > 0
          && $from.parent.textBetween($from.parentOffset - 1, $from.parentOffset) === '\\'
          && Array.from({ length: $from.depth }, (_, index) => $from.node(index + 1))
            .some(node => node.type.name === 'editorTableCell')) {
          const splitAt = from - 1
          const tr = view.state.tr.delete(splitAt, from).split(splitAt)
          view.dispatch(tr.setSelection(TextSelection.create(tr.doc, splitAt + 2)))
          return true
        }
        if (text !== ' ') return false
        const listType = listTypeForInput($from.parent, $from.parentOffset, text)
        if (!listType) return false
        const tr = view.state.tr.delete(from - 1, from)
        tr.setNodeMarkup($from.before(), undefined, {
          ...$from.parent.attrs, listType
        })
        tr.insert($from.before() + 1, view.state.schema.nodes.listMarker.create({ listType }))
        view.dispatch(tr)
        return true
      },
      handleKeyDown: handleFormattedKeyDown,
      transformCopied: slice => internalDragActive
        ? slice
        : new Slice(copiedFragment(slice.content), slice.openStart, slice.openEnd),
      transformPasted: (slice, view) => {
        // ProseMirror also calls this hook for drag-and-drop. Moving an image inside
        // the editor must keep its existing image ID and must not fetch/upload it.
        if (view.dragging || internalDragActive) return slice
        const pending = []
        const prepare = fragment => Fragment.fromArray(fragment.content.map(node => {
          if (node.type.name === 'image') {
            const token = `pending:${crypto.randomUUID()}`
            pending.push({ token, source: node.attrs.src, sourceImageId: node.attrs.sourceImageId, alt: node.attrs.alt || '' })
            return node.type.create({ ...node.attrs, imageId: token })
          }
          return node.content.size ? node.copy(prepare(node.content)) : node
        }))
        const result = new Slice(prepare(slice.content), slice.openStart, slice.openEnd)
        if (pending.length) queueMicrotask(() => {
          for (const image of pending) savePastedImage(image.token, image.source, image.alt, image.sourceImageId)
        })
        return result
      },
      clipboardTextParser: (text, context, plain, view) => {
        return plainTextSlice(text, view.state.schema)
      },
      handleDOMEvents: {
        mousedown: (view, event) => selectTableFrame(view, event) || selectFormatBoundary(view, event),
        contextmenu: onEditorContextMenu,
        focus: () => { queueMicrotask(refreshMobileInsertButton); return false },
        blur: () => { mobileInsertButton.value = null; return false },
        dragstart: () => { internalDragActive = true; return false },
        dragend: () => { internalDragActive = false; return false },
        drop: () => { setTimeout(() => { internalDragActive = false }, 0); return false },
        copy: (view, event) => {
          const picture = selectedPicture(view)
          return picture ? copyPicture(picture, event) : handlePlainClipboard(view, event)
        },
        cut: (view, event) => {
          if (handlePlainClipboard(view, event, true)) return true
          view.dispatch(closeHistory(view.state.tr))
          return false
        }
      },
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData('text/html') || ''
        // Let ProseMirror keep the order of text and images in rich clipboard content.
        // Copied images have their ID removed so paste uploads the original again.
        if (props.imagesEnabled && /<img\b/i.test(html)) {
          view.dispatch(closeHistory(view.state.tr))
          return false
        }
        const plainText = event.clipboardData?.getData('text/plain')
        if (plainText) {
          view.dispatch(closeHistory(view.state.tr).replaceSelection(plainTextSlice(plainText, view.state.schema)))
          return true
        }
        const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'))
        if (!props.imagesEnabled) return files.length > 0
        if (files.length !== 1 || event.clipboardData?.getData('text/html')) return false
        upload(files[0], false, { from: view.state.selection.from, to: view.state.selection.to })
        return true
      },
      handleDrop: (view, event) => {
        if (!props.imagesEnabled) return !!event.dataTransfer?.files?.length
        const files = [...(event.dataTransfer?.files || [])]
        if (!files.length) return false
        if (files.length !== 1) { alert('一次只能上传一张图片'); return true }
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        upload(files[0], false, position ?? view.state.selection.from)
        return true
      }
    },
    onUpdate: updateModel,
    onSelectionUpdate: ({ editor: instance }) => {
      if (includeWholeTableInSelection(instance.view)) return
      updateMobileInsertButton(instance.view)
      const selection = instance.state.selection
      if (selectionPointerId !== null) formatBubble.value = null
      else if (formatBubble.value) scheduleFormatBubble()
      if (insertMenu.value?.kind === 'image' && selection.node?.type.name !== 'image') closeInsertMenu()
      if (selection.node?.type.name === 'image') {
        activeImagePosition.value = selection.from
        activeImageWidth.value = Number(selection.node.attrs.displayWidth) || 160
      } else { activeImagePosition.value = null }
    }
  })
  if (isMobile) nextTick(() => updateMobileInsertButton(editor.value.view))
})
onUnmounted(() => { finishBoxDrag(); cancelAnimationFrame(formatBubbleFrame); window.removeEventListener('keydown', onPreviewShortcut); window.removeEventListener('keydown', onInsertMenuKeydown); window.removeEventListener('scroll', refreshMobileInsertButton, true); window.removeEventListener('pointermove', moveTableCornerDrag); window.removeEventListener('pointerup', onSelectionPointerEnd); window.removeEventListener('pointercancel', onSelectionPointerEnd); document.removeEventListener('pointerdown', onOutsideInsertMenu); for (const timer of retryTimers.values()) clearTimeout(timer); editor.value?.destroy() })
watch(() => props.modelValue, value => {
  if (emittedValues.has(value) || !editor.value || value === fromDocument()) return
  emittedValues.clear()
  editor.value.commands.setContent(toDocument(value), { emitUpdate: false })
})
watch(() => props.images, images => {
  for (const [id, image] of Object.entries(images)) setImageInDocument(id, image)
}, { deep: true })
watch([() => props.modelValue, () => props.images], () => { if (fullPreview.value) nextTick(renderFullPreview) }, { deep: true })
</script>

<template>
  <div class="rich-image-editor" :class="{ 'rich-image-editor--dragging': dragging }" @pointerenter="editorHovered = true" @pointerleave="editorHovered = false" @pointerdown="onEditorPointerDown" @dragover="onFileDragOver" @dragleave="onFileDragLeave" @drop="dragging = false">
    <div class="rich-image-editor__head"><span>正文</span><span class="rich-image-editor__head-actions"><button type="button" @click="toggleFullPreview">{{ fullPreview ? '继续编辑' : '预览正文' }}</button><button v-if="imagesEnabled && !fullPreview" type="button" @click="chooseImage">{{ uploading ? '继续上传图片' : '上传图片' }}</button></span></div>
    <div v-show="!fullPreview" class="rich-image-editor__workarea"><EditorContent :editor="editor" /></div>
    <div v-show="fullPreview" ref="fullPreviewBody" class="diary-inline-preview" aria-label="日记正文预览" @click="openFullPreviewImage" @contextmenu="onFullPreviewContextMenu" />
    <div v-if="imagesEnabled" class="rich-image-editor__hint">{{ fullPreview ? (isMobile ? '点击继续编辑返回正文。' : '右键图片可调整大小；按 F2 或点击继续编辑返回正文。') : isMobile ? '在正文光标旁点＋插入图片或图片组；双击图片调整大小或删除。' : '在正文中右键插入图片或图片组，右键图片可调整大小或删除；单击图片预览。按 F2 可切换预览。' }}</div>
    <input v-if="imagesEnabled" ref="fileInput" type="file" accept="image/*" class="rich-image-editor__file-input" @change="upload($event.target.files[0], isMobile && pendingInsertPosition === null, pendingInsertPosition)" />
    <Teleport to="body">
      <div v-if="formatBubble && !fullPreview" class="rich-image-editor__format-bubble" :style="{ left: `${formatBubble.x}px`, top: `${formatBubble.y}px` }" role="toolbar" aria-label="文字格式" @mousedown.prevent>
        <button v-for="format in textFormats.filter(item => item.key !== 'h1' || formatBubble.wholeLine)" :key="format.key" type="button" :class="[`rich-image-editor__format-button--${format.key}`, { 'is-active': formatBubble.key === format.key }]" :aria-label="formatBubble.key === format.key ? `取消${format.label}` : format.label" :title="formatBubble.key === format.key ? `取消${format.label}` : format.label" :disabled="!!formatBubble.key && formatBubble.key !== format.key" @click="formatSelectedText(format.key)">{{ format.glyph }}</button>
      </div>
      <button v-if="imagesEnabled && mobileInsertButton && !insertMenu && !fullPreview" type="button" class="rich-image-editor__mobile-insert" :style="{ left: `${mobileInsertButton.x}px`, top: `${mobileInsertButton.y}px` }" aria-label="插入图片或图片组" @pointerdown.prevent @click="openMobileInsertMenu">＋</button>
      <div v-if="insertMenu" class="rich-image-editor__insert-menu" :style="{ left: `${insertMenu.x}px`, top: `${insertMenu.y}px` }" role="menu" :aria-label="insertMenu.kind === 'image' ? '图片操作' : '插入内容'">
        <template v-if="insertMenu.kind === 'image'">
          <div class="rich-image-editor__menu-heading">图片大小 <span>{{ activeImageWidth }}px</span></div>
          <div class="rich-image-editor__menu-size"><button type="button" aria-label="缩小图片" @click="resizeSelectedImage(activeImageWidth - 40)">−</button><input type="range" min="80" max="900" step="10" :value="activeImageWidth" aria-label="图片大小" @input="resizeSelectedImage($event.target.value)" /><button type="button" aria-label="放大图片" @click="resizeSelectedImage(activeImageWidth + 40)">＋</button></div>
          <div class="rich-image-editor__menu-divider"></div>
          <button type="button" role="menuitem" @click="copySelectedImage(); closeInsertMenu()">复制原图</button>
          <button type="button" role="menuitem" @click="deleteSelectedImage">删除图片</button>
        </template>
        <template v-else-if="insertMenu.kind === 'format'">
          <button v-for="format in textFormats.filter(item => item.key !== 'h1' || insertMenu.selection.wholeLine)" :key="format.key" type="button" role="menuitem" :disabled="!!insertMenu.selection.key && insertMenu.selection.key !== format.key" @mousedown.prevent @click="formatSelectedText(format.key)">{{ insertMenu.selection.key === format.key ? `取消${format.label}` : format.label }}</button>
        </template>
        <template v-else-if="insertMenu.kind === 'table-column'">
          <div class="rich-image-editor__menu-heading">第 {{ insertMenu.columnIndex + 1 }} 列</div>
          <label class="rich-image-editor__menu-field">宽度行为<select :value="editor?.state.doc.nodeAt(insertMenu.position)?.attrs.columns[insertMenu.columnIndex]?.width" @change="updateTableColumn('width', $event.target.value)"><option value="nowrap">按内容宽度</option><option value="normal">一般宽度</option><option value="long">长内容</option></select></label>
          <label class="rich-image-editor__menu-field">对齐<select :value="editor?.state.doc.nodeAt(insertMenu.position)?.attrs.columns[insertMenu.columnIndex]?.align" @change="updateTableColumn('align', $event.target.value)"><option value="left">靠左</option><option value="center">居中</option><option value="right">靠右</option></select></label>
        </template>
        <form v-else-if="insertMenu.kind === 'table-create'" class="rich-image-editor__table-create" @submit.prevent="createTable">
          <div class="rich-image-editor__menu-heading">创建竖向表格</div>
          <div class="rich-image-editor__menu-field rich-image-editor__table-count"><label for="rich-editor-table-rows">行数</label><div class="rich-image-editor__table-count-control"><button type="button" aria-label="减少一行" :disabled="insertMenu.rows <= 1" @click="adjustTableDraft('rows', -1)"><img :src="leftIcon" alt="" /></button><input id="rich-editor-table-rows" v-model.number="insertMenu.rows" type="number" min="1" max="30" required /><button type="button" aria-label="增加一行" :disabled="insertMenu.rows >= 30" @click="adjustTableDraft('rows', 1)"><img :src="rightIcon" alt="" /></button></div></div>
          <div class="rich-image-editor__menu-field rich-image-editor__table-count"><label for="rich-editor-table-columns">列数</label><div class="rich-image-editor__table-count-control"><button type="button" aria-label="减少一列" :disabled="insertMenu.columns <= 1" @click="adjustTableDraft('columns', -1)"><img :src="leftIcon" alt="" /></button><input id="rich-editor-table-columns" v-model.number="insertMenu.columns" type="number" min="1" max="12" required /><button type="button" aria-label="增加一列" :disabled="insertMenu.columns >= 12" @click="adjustTableDraft('columns', 1)"><img :src="rightIcon" alt="" /></button></div></div>
          <label class="rich-image-editor__menu-field rich-image-editor__menu-field--checkbox"><input v-model="insertMenu.hasHeader" type="checkbox" @change="insertMenu.leftHeader = false" /> 首行作为表头</label>
          <label class="rich-image-editor__menu-field rich-image-editor__menu-field--checkbox"><input v-model="insertMenu.leftHeader" type="checkbox" @change="insertMenu.hasHeader = false" /> 首列作为表头</label>
          <div class="rich-image-editor__table-create-actions"><button type="button" @click="closeInsertMenu">取消</button><button type="submit">创建</button></div>
        </form>
        <template v-else>
          <button type="button" role="menuitem" @click="openTableDraft">创建表格</button>
          <button v-if="imagesEnabled" type="button" role="menuitem" @click="insertImageFromMenu">插入图片</button>
          <button v-if="imagesEnabled" type="button" role="menuitem" @click="insertGroupFromMenu">插入图片组</button>
        </template>
      </div>
      <div v-if="activePicture" ref="viewer" class="diary-image-viewer" role="dialog" aria-modal="true" aria-label="图片预览" tabindex="-1" @keydown="onViewerKeydown" @click="onViewerBackdropClick" @wheel.prevent="setZoom(zoom + ($event.deltaY < 0 ? .1 : -.1))">
        <div class="diary-image-viewer__image-wrap"><button type="button" class="diary-image-viewer__close" aria-label="关闭预览" @click="closePreview"><img :src="closeIcon" alt="" draggable="false" /></button><a v-if="activeImage?.url" class="diary-image-viewer__download" :href="activeImage.url" :download="`diary-image-${previewId}`" aria-label="下载原图" title="下载原图"><img :src="downloadIcon" alt="" draggable="false" /></a><div class="diary-image-viewer__zoom"><button type="button" aria-label="缩小预览" @click="setZoom(zoom - .1)"><img :src="zoomOutIcon" alt="" /></button><button type="button" aria-label="放大预览" @click="setZoom(zoom + .1)"><img :src="zoomInIcon" alt="" /></button></div><button v-if="previewGroupIds.length > 1" type="button" class="diary-image-viewer__previous" aria-label="上一张图片" @click="movePreview(-1)"><img :src="leftIcon" alt="" /></button><canvas ref="previewCanvas" :style="{ transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${zoom})` }" @pointerdown="startPreviewDrag" @pointermove="movePreviewDrag" @pointerup="endPreviewDrag" @pointercancel="endPreviewDrag" /><button v-if="previewGroupIds.length > 1" type="button" class="diary-image-viewer__next" aria-label="下一张图片" @click="movePreview(1)"><img :src="rightIcon" alt="" /></button></div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.rich-image-editor { width: 100%; }
.rich-image-editor__file-input { position: absolute; width: 1px; height: 1px; padding: 0; opacity: 0; overflow: hidden; pointer-events: none; }
.rich-image-editor__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; color: var(--color-text); font-weight: 600; }
.rich-image-editor__head-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.rich-image-editor__format-bubble { position: fixed; z-index: 3100; display: flex; gap: 2px; padding: 4px; border: 1px solid #cad8cc; border-radius: 7px; background: #fff; box-shadow: 0 4px 14px rgba(0, 0, 0, .15); transform: translateX(-50%); }
.rich-image-editor__format-bubble button { display: grid; place-items: center; width: 38px; height: 36px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #254d34; font-size: 19px; cursor: pointer; }
.rich-image-editor__format-bubble .rich-image-editor__format-button--b { font-weight: 700; }
.rich-image-editor__format-bubble .rich-image-editor__format-button--i { font-style: italic; }
.rich-image-editor__format-bubble .rich-image-editor__format-button--d { text-decoration: line-through; }
.rich-image-editor__format-bubble .rich-image-editor__format-button--h1,
.rich-image-editor__format-bubble .rich-image-editor__format-button--h { width: 60px; font-size: 21px; font-weight: 700; line-height: 1; }
.rich-image-editor__format-bubble .rich-image-editor__format-button--code { box-sizing: border-box; width: 56px; height: 32px; margin: 2px; border: 1px solid #d9e0da; background: #f1f3f5; color: #254d34; font-family: 'Microsoft JhengHei', 'HanaMinB', sans-serif; font-size: 19px; line-height: 1; }
.rich-image-editor__format-bubble button:hover, .rich-image-editor__format-bubble button.is-active { background: #edf3ee; }
.rich-image-editor__format-bubble button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.rich-image-editor__format-bubble button:disabled { opacity: .35; cursor: default; }
.rich-image-editor__workarea { min-width: 0; }
.rich-image-editor__workarea > div { min-width: 0; }
.rich-image-editor__insert-menu { position: fixed; z-index: 3000; display: grid; min-width: 168px; padding: 4px; border: 1px solid #d5d9d5; border-radius: 7px; background: #fff; box-shadow: 0 4px 14px rgba(0, 0, 0, .15); color: #252a31; font-size: 13px; line-height: 1.35; }
.rich-image-editor__insert-menu button { min-height: 29px; padding: 5px 12px; border: 0; border-radius: 3px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.rich-image-editor__insert-menu button:hover, .rich-image-editor__insert-menu button:focus-visible { background: #edf3ee; }
.rich-image-editor__insert-menu button:disabled { color: #9ca89e; cursor: default; }
.rich-image-editor__menu-heading { display: flex; justify-content: space-between; gap: 12px; padding: 7px 12px 3px; color: #515b54; }
.rich-image-editor__menu-size { display: flex; align-items: center; gap: 3px; padding: 0 5px 5px; }
.rich-image-editor__menu-size button { flex: none; width: 26px; padding: 0; text-align: center; }
.rich-image-editor__menu-size input { width: 132px; accent-color: #417a51; }
.rich-image-editor__menu-divider { height: 1px; margin: 4px -4px; background: #e4e9e4; }
.rich-image-editor__menu-field { display: grid; gap: 4px; padding: 6px 10px; }
.rich-image-editor__menu-field select { min-height: 29px; border: 1px solid #cad8cc; background: #fff; color: inherit; }
.rich-image-editor__table-create { display: grid; min-width: 210px; padding: 3px; }
.rich-image-editor__table-create .rich-image-editor__table-count { grid-template-columns: 42px 1fr; align-items: center; }
.rich-image-editor__table-count-control { display: flex; align-items: center; gap: 2px; }
.rich-image-editor__table-count-control button { display: grid; place-items: center; width: 27px; min-height: 27px; padding: 4px; }
.rich-image-editor__table-count-control button img { display: block; width: 12px; height: 12px; }
.rich-image-editor__table-create input[type="number"] { box-sizing: border-box; width: 50px; padding: 4px 2px; border: 1px solid #cad8cc; border-radius: 3px; font: inherit; text-align: center; appearance: textfield; }
.rich-image-editor__table-create input[type="number"]::-webkit-inner-spin-button, .rich-image-editor__table-create input[type="number"]::-webkit-outer-spin-button { margin: 0; appearance: none; }
.rich-image-editor__table-create .rich-image-editor__menu-field--checkbox { display: flex; justify-content: flex-start; gap: 7px; }
.rich-image-editor__table-create-actions { display: flex; justify-content: flex-end; gap: 4px; padding: 5px 3px 2px; }
.rich-image-editor__mobile-insert { position: fixed; z-index: 2999; width: 36px; height: 36px; padding: 0; border: 1px solid #9db5a2; border-radius: 50%; background: #fff; color: #254d34; font-size: 24px; line-height: 1; box-shadow: 0 2px 8px rgba(0, 0, 0, .12); }
.rich-image-editor button, .diary-image-viewer button { padding: 5px 10px; border: 1px solid #cad8cc; border-radius: 6px; background: #fff; color: var(--color-text); cursor: pointer; }
.rich-image-editor :deep(.rich-image-editor__body) { box-sizing: border-box; min-height: 360px; padding: 14px; border: 1px solid #cad8cc; border-radius: 8px; background: #fff; color: #252a31; font-size: 17px; line-height: 1.8; overflow-wrap: anywhere; outline: none; counter-reset: rich-editor-ordered; }
.rich-image-editor :deep(.rich-image-editor__body:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.rich-image-editor :deep(.rich-image-editor__body .ProseMirror-gapcursor::after) { top: -1px; width: 0; height: 1.5em; border-top: 0; border-left: 2px solid #316ac5; }
.rich-image-editor :deep(.rich-image-editor__body p) { margin: 0; min-height: 1.55em; }
.rich-image-editor :deep(.rich-image-editor__table-frame) { position: relative; box-sizing: border-box; width: 100%; max-width: 100%; margin: 12px 0; border: 1px solid #b9cdbb; border-radius: 8px; }
.rich-image-editor :deep(.rich-image-editor__table-frame--compact) { width: fit-content; }
.rich-image-editor :deep(.rich-image-editor__table-scroll) { max-width: 100%; overflow-x: auto; border-radius: 7px; }
.rich-image-editor :deep(.rich-image-editor__table-add) { position: absolute; z-index: 2; display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 1px solid #417a51; border-radius: 50%; background: #417a51; opacity: 0; pointer-events: auto; transform: translate(-50%, -50%); }
.rich-image-editor :deep(.rich-image-editor__table-add img) { display: block; width: 14px; height: 14px; }
.rich-image-editor :deep(.rich-image-editor__table-add--column) { top: 50%; left: 100%; }
.rich-image-editor :deep(.rich-image-editor__table-add--row) { top: 100%; left: 50%; }
.rich-image-editor :deep(.rich-image-editor__table-frame:hover .rich-image-editor__table-add:not(:disabled)), .rich-image-editor :deep(.rich-image-editor__table-add:hover), .rich-image-editor :deep(.rich-image-editor__table-add:focus-visible) { opacity: 1; }
.rich-image-editor :deep(.rich-image-editor__table-add:disabled) { display: none; }
.rich-image-editor :deep(.rich-image-editor__table-frame.ProseMirror-selectednode), .rich-image-editor :deep(.rich-image-editor__table-frame--selected) { outline: 2px solid #316ac5; outline-offset: 2px; }
.rich-image-editor :deep(.rich-image-editor__table-frame--selected *::selection), .rich-image-editor :deep(.rich-image-editor__table-frame.ProseMirror-selectednode *::selection) { color: inherit; background: transparent; }
.rich-image-editor :deep(.rich-image-editor__table) { width: 100%; border-collapse: collapse; table-layout: auto; }
.rich-image-editor :deep(.rich-image-editor__table--compact) { width: max-content; max-width: 100%; }
.rich-image-editor :deep(.rich-image-editor__table td) { padding: 8px 10px; border: 0; border-right: 1px solid #cbd9cd; border-bottom: 1px solid #cbd9cd; vertical-align: top; outline-offset: -2px; counter-reset: rich-editor-ordered; }
.rich-image-editor :deep(.rich-image-editor__table td p) { margin: 0; min-height: 1.5em; line-height: 1.5; }
.rich-image-editor :deep(.rich-image-editor__table td p:has(> .rich-image-editor__format--heading)) { margin-top: 0; }
.rich-image-editor :deep(.rich-image-editor__table tr > td:last-child) { border-right: 0; }
.rich-image-editor :deep(.rich-image-editor__table tr:last-child td) { border-bottom: 0; }
.rich-image-editor :deep(.rich-image-editor__table td.rich-image-editor__cell--nowrap) { width: 1%; min-width: 0; white-space: nowrap; }
.rich-image-editor :deep(.rich-image-editor__table td.rich-image-editor__cell--normal) { min-width: 7em; }
.rich-image-editor :deep(.rich-image-editor__table td.rich-image-editor__cell--long) { min-width: 16em; }
.rich-image-editor :deep(.rich-image-editor__table[data-has-header="true"] tr:first-child td) { font-weight: 600; background: #f5f8f5; }
.rich-image-editor :deep(.rich-image-editor__table[data-left-header="true"] tr td:first-child) { font-weight: 600; background: #f5f8f5; }
.rich-image-editor :deep(.rich-image-editor__body p:not([data-list-type="ordered"])) { counter-reset: rich-editor-ordered; }
.rich-image-editor :deep(.rich-image-editor__body p[data-list-type="ordered"]) { counter-increment: rich-editor-ordered; }
.rich-image-editor :deep(.rich-image-editor__list-marker) { display: inline-block; width: 1.1em; white-space: nowrap; vertical-align: baseline; }
.rich-image-editor :deep(.rich-image-editor__list-marker[data-list-marker="bullet"]::before) { content: '●'; position: relative; top: -4px; color: #1f6722; font-family: PMingLiU, sans-serif; font-size: 12px; }
.rich-image-editor :deep(.rich-image-editor__list-marker[data-list-marker="ordered"]::before) { content: counter(rich-editor-ordered) '.'; }
.rich-image-editor :deep(.rich-image-editor__list-marker--selected) { background: #316ac5; }
.rich-image-editor :deep(.rich-image-editor__list-marker--selected::before) { color: #fff !important; }
.rich-image-editor :deep(.rich-image-editor__body p:has(> .rich-image-editor__format--heading)) { margin-top: 1.6em; }
.rich-image-editor :deep(.rich-image-editor__body p:first-child:has(> .rich-image-editor__format--heading)) { margin-top: 0; }
.rich-image-editor :deep(.rich-image-editor__format--bold) { font-weight: 700; }
.rich-image-editor :deep(.rich-image-editor__format--italic) { font-style: italic; }
.rich-image-editor :deep(.rich-image-editor__format--strike) { text-decoration: line-through; }
.rich-image-editor :deep(.rich-image-editor__format--heading) { font-size: 1.4em; font-weight: 700; }
.rich-image-editor :deep(.rich-image-editor__format--large) { font-size: 1.4em; font-weight: 700; }
.rich-image-editor :deep(.rich-image-editor__format--code) { padding: 1px 0; border-top: 1.5px solid #e2e5ea; border-bottom: 1.5px solid #e2e5ea; background: #f1f3f5; color: #24292f; font-family: Consolas, 'Cascadia Mono', 'Courier New', 'Microsoft JhengHei', 'HanaMinB', monospace; font-size: .92em; line-height: 1.5; }
.rich-image-editor :deep(.rich-image-editor__format--dot) { text-emphasis: filled dot; -webkit-text-emphasis: filled dot; text-emphasis-position: under; -webkit-text-emphasis-position: under; }
.rich-image-editor :deep(.rich-image-editor__comment),
.rich-image-editor :deep(.rich-image-editor__comment *) { color: #777 !important; }
.rich-image-editor :deep(.rich-image-editor__format-boundary) { padding: 0 1px; color: transparent; }
.rich-image-editor :deep(.rich-image-editor__format-boundary--code) { padding: 1px 3px; border-top: 1.5px solid #e2e5ea; border-bottom: 1.5px solid #e2e5ea; background: #f1f3f5; font-family: Consolas, 'Cascadia Mono', 'Courier New', 'Microsoft JhengHei', 'HanaMinB', monospace; font-size: .92em; line-height: 1.5; }
.rich-image-editor :deep(.rich-image-editor__format-boundary--code.rich-image-editor__format-boundary--start) { border-left: 1.5px solid #e2e5ea; border-radius: 4px 0 0 4px; }
.rich-image-editor :deep(.rich-image-editor__format-boundary--code.rich-image-editor__format-boundary--end) { border-right: 1.5px solid #e2e5ea; border-radius: 0 4px 4px 0; }
.rich-image-editor :deep(.rich-image-editor__cursor-landing) { display: inline; width: 0; overflow: hidden; }
.rich-image-editor :deep(.rich-image-editor__group) { display: inline-flex; flex-direction: column; box-sizing: border-box; width: min(320px, 100%); min-height: 122px; margin: 8px 6px 12px 0; border: 2px solid #9db5a2; border-radius: 6px; background: #f8faf8; vertical-align: middle; }
.rich-image-editor :deep(.rich-image-editor__group--selected) { outline: 2px solid #2f6fed; outline-offset: 2px; }
.rich-image-editor :deep(.rich-image-editor__group-border) { display: flex; align-items: center; justify-content: flex-end; gap: 4px; min-height: 30px; padding: 2px 5px; border-bottom: 1px solid #cad8cc; background: #edf3ee; cursor: grab; touch-action: none; }
.rich-image-editor :deep(.rich-image-editor__group-border button) { display: grid; place-items: center; width: 26px; height: 26px; padding: 4px; }
.rich-image-editor :deep(.rich-image-editor__group-border button img) { width: 17px; height: 17px; }
.rich-image-editor :deep(.rich-image-editor__group-content) { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 6px; min-height: 86px; padding: 7px; }
.rich-image-editor :deep(.rich-image-editor__group-content:empty::before) { content: '把图片拖进这里'; align-self: center; width: 100%; color: var(--color-text-light); font-size: 12px; text-align: center; }
.rich-image-editor :deep(.rich-image-editor__picture) { position: relative; display: inline-flex; vertical-align: middle; align-items: center; justify-content: flex-start; box-sizing: border-box; width: min(var(--picture-width, 160px), 100%); min-height: 48px; height: auto; margin: 8px 6px 12px 0; border: 1px solid #b8c8bb; border-radius: 4px; background: #f7faf7; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded) { min-height: 0; }
.rich-image-editor :deep(.rich-image-editor__group-content .rich-image-editor__picture) { width: 88px; height: 88px; min-height: 0; margin: 0; }
.rich-image-editor :deep(.rich-image-editor__controls) { position: absolute; top: 4px; right: 4px; z-index: 1; display: inline-flex; gap: 3px; padding: 2px; border-radius: 4px; background: rgba(255, 255, 255, .92); }
.rich-image-editor :deep(.rich-image-editor__controls[hidden]), .rich-image-editor :deep(.rich-image-editor__controls button[hidden]) { display: none; }
.rich-image-editor :deep(.rich-image-editor__controls button) { display: grid; place-items: center; width: 29px; height: 29px; padding: 4px; }
.rich-image-editor :deep(.rich-image-editor__controls button img) { display: block; width: 17px; height: 17px; }
.rich-image-editor :deep(.rich-image-editor__controls .rich-image-editor__move) { touch-action: none; cursor: grab; }
.rich-image-editor :deep(.rich-image-editor__drag-source) { opacity: .25; }
.rich-image-editor :deep(.rich-image-editor__drag-preview), .rich-image-editor > .rich-image-editor__drag-preview { position: fixed !important; z-index: 10000; margin: 0 !important; pointer-events: none !important; opacity: .75; box-shadow: 0 3px 10px rgba(0, 0, 0, .16); }
.rich-image-editor :deep(.rich-image-editor__legacy:not([hidden])) { position: absolute; left: 0; bottom: 0; display: block; max-width: 100%; padding: 3px 5px; background: rgba(255, 248, 224, .95); color: #6e4a15; font-size: 11px; line-height: 1.25; }
.rich-image-editor :deep(.rich-image-editor__picture--selected) { border-color: #2f6fed; outline: 2px solid #2f6fed; outline-offset: 2px; background: #eaf1ff; }
.rich-image-editor :deep(.rich-image-editor__picture > img) { display: none; width: 100%; height: auto; object-fit: contain; cursor: zoom-in; }
.rich-image-editor :deep(.rich-image-editor__group-content .rich-image-editor__picture > img) { height: 100%; object-fit: cover; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded > img) { display: block; }
.rich-image-editor :deep(.rich-image-editor__spinner) { width: 22px; height: 22px; border: 2px solid #cbd8cd; border-top-color: var(--color-primary); border-radius: 50%; animation: rich-image-spin .8s linear infinite; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded .rich-image-editor__spinner) { display: none; }
.rich-image-editor :deep(.rich-image-editor__picture--failed .rich-image-editor__spinner) { display: none; }
.rich-image-editor :deep(.rich-image-editor__picture--failed::before) { content: '图片加载失败'; color: var(--color-text-light); font-size: 12px; }
@keyframes rich-image-spin { to { transform: rotate(360deg); } }
.rich-image-editor__hint { margin-top: 8px; color: var(--color-text-light); font-size: .75rem; }
.rich-image-editor--dragging :deep(.rich-image-editor__body) { outline: 2px dashed var(--color-primary); }
.diary-inline-preview { box-sizing: border-box; min-height: 360px; padding: 14px; border: 1px solid #cad8cc; border-radius: 8px; background: #fff; color: #252a31; font-size: 17px; line-height: 1.8; overflow-wrap: anywhere; }
.diary-inline-preview :deep(.rt-picture) { margin: 12px 0; text-align: left; }
.diary-inline-preview :deep(.rt-picture img[data-image-id]) { display: inline-block; height: auto; max-width: 100%; margin: 0; vertical-align: middle; cursor: zoom-in; }
.diary-inline-preview :deep(.rt-picture-group) { display: inline-flex; flex-wrap: wrap; gap: 6px; vertical-align: middle; }
.diary-inline-preview :deep(.rt-picture-group .rt-picture) { display: inline-block; margin: 0; }
.diary-inline-preview :deep(.rt-picture-group .rt-picture img[data-image-id]) { width: 96px !important; height: 96px !important; max-width: none !important; max-height: none !important; object-fit: cover; }
.diary-inline-preview :deep(.rt-table .rt-picture) { display: inline-block; margin: 0; vertical-align: middle; }
.diary-inline-preview :deep(.rt-table .rt-picture img[data-image-id]:not([data-display-width])) { width: 96px; height: auto; }
.diary-image-viewer { position: fixed; z-index: 3200; inset: 0; display: grid; place-items: center; padding: 18px; background: rgba(0, 0, 0, .55); outline: none; }
.diary-image-viewer__previous, .diary-image-viewer__next { position: fixed; top: 50%; z-index: 3; width: 42px; height: 42px; font-size: 30px; line-height: 1; transform: translateY(-50%); }
.diary-image-viewer__previous img, .diary-image-viewer__next img { width: 18px; height: 18px; }
.diary-image-viewer__previous { left: 12px; }
.diary-image-viewer__next { right: 12px; }
.diary-image-viewer__panel { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; color: #fff; }
.diary-image-viewer__toolbar, .diary-image-viewer__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; }
.diary-image-viewer__toolbar { border-bottom: 1px solid #454545; }
.diary-image-viewer__controls { display: flex; align-items: center; gap: 6px; }
.diary-image-viewer button { border-color: #666; background: #222; color: #fff; }
.diary-image-viewer button:disabled { opacity: .4; cursor: default; }
.diary-image-viewer__stage { box-sizing: border-box; flex: 1; min-height: 0; overflow: auto; display: flex; align-items: center; justify-content: center; padding-top: 40px; }
.diary-image-viewer__image-wrap { position: relative; width: fit-content; margin: auto; }
.diary-image-viewer__stage .diary-image-viewer__image-wrap > img { display: block; width: auto; height: auto; max-width: calc(100vw - 36px); max-height: calc(100vh - 220px); object-fit: contain; }
.diary-image-viewer .diary-image-viewer__close { position: absolute; z-index: 1; top: -40px; right: 0; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; background: rgba(255, 255, 255, .9); }
.diary-image-viewer__close img { width: 16px; height: 16px; filter: brightness(0); }
.diary-image-viewer__footer { border-top: 1px solid #454545; }
.diary-image-viewer__footer a { color: #fff; }
@media (max-width: 760px) { .diary-image-viewer__toolbar, .diary-image-viewer__footer, .diary-image-viewer__controls { flex-wrap: wrap; } }
.diary-image-viewer { display: flex; align-items: center; justify-content: center; overflow: auto; padding: 50px 18px 18px; }
.diary-image-viewer__image-wrap { position: relative; width: fit-content; margin: auto; }
.diary-image-viewer__image-wrap canvas { display: block; max-width: calc(100vw - 36px); max-height: calc(100vh - 88px); object-fit: contain; cursor: grab; touch-action: none; }
.diary-image-viewer__image-wrap canvas:active { cursor: grabbing; }
.diary-image-viewer .diary-image-viewer__close, .diary-image-viewer__download { position: absolute; z-index: 2; top: -40px; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: rgba(255, 255, 255, .9); user-select: none; }
.diary-image-viewer .diary-image-viewer__close { right: 0; }
.diary-image-viewer__download { right: 40px; }
.diary-image-viewer__download img { width: 18px; height: 18px; pointer-events: none; }
.diary-image-viewer__zoom { position: absolute; z-index: 2; top: -40px; left: 0; display: flex; gap: 6px; }
.diary-image-viewer__zoom button { display: grid; place-items: center; width: 32px; height: 32px; padding: 5px; border: 0; background: rgba(255, 255, 255, .9); }
.diary-image-viewer__zoom img { width: 20px; height: 20px; }
</style>
