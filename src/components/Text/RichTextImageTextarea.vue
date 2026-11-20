<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Fragment, Slice } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
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
import { renderDiaryBody } from '../../views/Diary/diaryBodyStyle.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  ownerId: { type: [String, Number], required: true },
  placeholder: { type: String, default: '' },
  images: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue', 'upload-state-change', 'image-added'])
// 旧版本数字 ID 仅兼容读取；新图片使用非连续的 UUID 标识。
const picturePattern = /^\{p (?:(.*?)=>)?([1-9][0-9]*|[0-9a-f-]{36})(?:~([0-9]{2,3}))?}$/
const embeddedPicturePattern = /\{p (?:(?:[^{}\r\n]*?)=>)?(?:[1-9][0-9]*|[0-9a-f-]{36})(?:~[0-9]{2,3})?}/g
const embeddedElementPattern = /\{pg (?:\{p [^{}]+})*}|\{p (?:(?:[^{}\r\n]*?)=>)?(?:[1-9][0-9]*|[0-9a-f-]{36})(?:~[0-9]{2,3})?}/g
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
  return {
    type: 'doc',
    content: value.replace(/\r/g, '').split('\n').map(line => {
      const content = []
      let offset = 0
      for (const match of line.matchAll(embeddedElementPattern)) {
        if (match.index > offset) content.push({ type: 'text', text: line.slice(offset, match.index) })
        if (match[0].startsWith('{pg ')) {
          const members = [...match[0].slice(4, -1).matchAll(embeddedPicturePattern)].map(member => pictureToDocument(member[0])).filter(Boolean)
          content.push({ type: 'imageGroup', attrs: { groupKey: crypto.randomUUID() }, content: members })
        } else {
          const picture = pictureToDocument(match[0])
          if (picture) content.push(picture)
        }
        offset = match.index + match[0].length
      }
      if (offset < line.length) content.push({ type: 'text', text: line.slice(offset) })
      return { type: 'paragraph', content }
    })
  }
}
function textOf(node) {
  if (node.type === 'text') return node.text || ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'image') {
    const id = String(node.attrs?.imageId || '')
    if (!/^([1-9][0-9]*|[0-9a-f-]{36})$/.test(id)) return ''
    const caption = String(node.attrs?.alt || '').replace(/[{}\r\n]/g, '').trim()
    const width = Number(node.attrs?.displayWidth)
    const suffix = width !== 160 && width >= 80 && width <= 900 ? `~${width}` : ''
    return caption ? `{p ${caption}=>${id}${suffix}}` : `{p ${id}${suffix}}`
  }
  if (node.type === 'imageGroup') return `{pg ${(node.content || []).map(textOf).join('')}}`
  return (node.content || []).map(textOf).join('')
}
function plainFromSlice(slice) {
  return slice.content.content.map(node => node.textBetween(0, node.content.size, '\n')).join('\n')
}
function plainTextSlice(text, schema) {
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n').map(line =>
    schema.nodes.paragraph.create(null, line ? schema.text(line) : undefined))
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
  if (!view.state.selection.empty) return false
  const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
  if (position == null) return false
  event.preventDefault()
  openInsertMenuAt(position, event.clientX, event.clientY)
  return true
}
function updateMobileInsertButton(view) {
  if (!isMobile || !view.hasFocus() || !view.state.selection.empty) { mobileInsertButton.value = null; return }
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
  const node = editor.value?.state.doc.nodeAt(activeImagePosition.value)
  if (node?.type.name === 'image') copyPicture(node)
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

const DiaryImageGroup = Node.create({
  name: 'imageGroup',
  group: 'inline',
  inline: true,
  content: 'image*',
  draggable: true,
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
    const body = new FormData()
    body.append('file', blob, `pasted.${blob.type.split('/')[1]}`)
    const image = await request(`/api/diary/edit/${props.ownerId}/image`, { method: 'POST', body, timeout: 60000 })
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
    const body = new FormData()
    body.append('file', file)
    const image = await request(`/api/diary/edit/${props.ownerId}/image`, { method: 'POST', body, timeout: 60000 })
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
  editor.value = new Editor({
    content: toDocument(props.modelValue),
    extensions: [StarterKit.configure({
      bold: false, blockquote: false, bulletList: false, code: false, codeBlock: false,
      heading: false, horizontalRule: false, italic: false, link: false,
      listItem: false, listKeymap: false, orderedList: false, strike: false,
      underline: false, trailingNode: false
    }), DiaryImageGroup, DiaryImage.configure({ inline: true })],
    editorProps: {
      attributes: { class: 'rich-image-editor__body', 'aria-label': props.placeholder, spellcheck: 'false' },
      decorations: state => {
        if (state.selection.empty) return null
        const selected = []
        state.doc.nodesBetween(state.selection.from, state.selection.to, (node, position) => {
          if (node.type.name === 'image' && state.selection.from <= position && state.selection.to >= position + node.nodeSize) {
            selected.push(Decoration.node(position, position + node.nodeSize, { class: 'rich-image-editor__picture--selected' }))
          }
        })
        return DecorationSet.create(state.doc, selected)
      },
      clipboardTextSerializer: plainFromSlice,
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
        if (/<img\b/i.test(html)) {
          view.dispatch(closeHistory(view.state.tr))
          return false
        }
        const plainText = event.clipboardData?.getData('text/plain')
        if (plainText) {
          view.dispatch(closeHistory(view.state.tr).replaceSelection(plainTextSlice(plainText, view.state.schema)))
          return true
        }
        const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'))
        if (files.length !== 1 || event.clipboardData?.getData('text/html')) return false
        upload(files[0], false, { from: view.state.selection.from, to: view.state.selection.to })
        return true
      },
      handleDrop: (view, event) => {
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
      updateMobileInsertButton(instance.view)
      if (insertMenu.value?.kind !== 'image' || selection.node?.type.name !== 'image') closeInsertMenu()
      const selection = instance.state.selection
      if (selection.node?.type.name === 'image') {
        activeImagePosition.value = selection.from
        activeImageWidth.value = Number(selection.node.attrs.displayWidth) || 160
      } else { activeImagePosition.value = null }
    }
  })
  if (isMobile) nextTick(() => updateMobileInsertButton(editor.value.view))
})
onUnmounted(() => { finishBoxDrag(); window.removeEventListener('keydown', onPreviewShortcut); window.removeEventListener('keydown', onInsertMenuKeydown); window.removeEventListener('scroll', refreshMobileInsertButton, true); document.removeEventListener('pointerdown', onOutsideInsertMenu); for (const timer of retryTimers.values()) clearTimeout(timer); editor.value?.destroy() })
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
  <div class="rich-image-editor" :class="{ 'rich-image-editor--dragging': dragging }" @pointerenter="editorHovered = true" @pointerleave="editorHovered = false" @dragover="dragging = true" @dragleave="dragging = false" @drop="dragging = false">
    <div class="rich-image-editor__head"><span>正文</span><span class="rich-image-editor__head-actions"><button type="button" @click="toggleFullPreview">{{ fullPreview ? '继续编辑' : '预览正文' }}</button><button v-if="!fullPreview" type="button" @click="chooseImage">{{ uploading ? '继续上传图片' : '上传图片' }}</button></span></div>
    <div v-show="!fullPreview" class="rich-image-editor__workarea"><EditorContent :editor="editor" /></div>
    <div v-show="fullPreview" ref="fullPreviewBody" class="diary-inline-preview" aria-label="日记正文预览" @click="openFullPreviewImage" @contextmenu="onFullPreviewContextMenu" />
    <div class="rich-image-editor__hint">{{ fullPreview ? (isMobile ? '点击继续编辑返回正文。' : '右键图片可调整大小；按 F2 或点击继续编辑返回正文。') : isMobile ? '在正文光标旁点＋插入图片或图片组；双击图片调整大小或删除。' : '在正文中右键插入图片或图片组，右键图片可调整大小或删除；单击图片预览。按 F2 可切换预览。' }}</div>
    <input ref="fileInput" type="file" accept="image/*" class="rich-image-editor__file-input" @change="upload($event.target.files[0], isMobile && pendingInsertPosition === null, pendingInsertPosition)" />
    <Teleport to="body">
      <button v-if="mobileInsertButton && !insertMenu && !fullPreview" type="button" class="rich-image-editor__mobile-insert" :style="{ left: `${mobileInsertButton.x}px`, top: `${mobileInsertButton.y}px` }" aria-label="插入图片或图片组" @pointerdown.prevent @click="openMobileInsertMenu">＋</button>
      <div v-if="insertMenu" class="rich-image-editor__insert-menu" :style="{ left: `${insertMenu.x}px`, top: `${insertMenu.y}px` }" role="menu" :aria-label="insertMenu.kind === 'image' ? '图片操作' : '插入内容'">
        <template v-if="insertMenu.kind === 'image'">
          <div class="rich-image-editor__menu-heading">图片大小 <span>{{ activeImageWidth }}px</span></div>
          <div class="rich-image-editor__menu-size"><button type="button" aria-label="缩小图片" @click="resizeSelectedImage(activeImageWidth - 40)">−</button><input type="range" min="80" max="900" step="10" :value="activeImageWidth" aria-label="图片大小" @input="resizeSelectedImage($event.target.value)" /><button type="button" aria-label="放大图片" @click="resizeSelectedImage(activeImageWidth + 40)">＋</button></div>
          <div class="rich-image-editor__menu-divider"></div>
          <button type="button" role="menuitem" @click="copySelectedImage(); closeInsertMenu()">复制原图</button>
          <button type="button" role="menuitem" @click="deleteSelectedImage">删除图片</button>
        </template>
        <template v-else>
          <button type="button" role="menuitem" @click="insertImageFromMenu">插入图片</button>
          <button type="button" role="menuitem" @click="insertGroupFromMenu">插入图片组</button>
        </template>
      </div>
      <div v-if="activePicture" ref="viewer" class="diary-image-viewer" role="dialog" aria-modal="true" aria-label="图片预览" tabindex="-1" @keydown="onViewerKeydown" @click.self="closePreview" @wheel.prevent="setZoom(zoom + ($event.deltaY < 0 ? .1 : -.1))">
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
.rich-image-editor__workarea { min-width: 0; }
.rich-image-editor__workarea > div { min-width: 0; }
.rich-image-editor__insert-menu { position: fixed; z-index: 3000; display: grid; min-width: 168px; padding: 4px; border: 1px solid #d5d9d5; border-radius: 7px; background: #fff; box-shadow: 0 4px 14px rgba(0, 0, 0, .15); color: #252a31; font-size: 13px; line-height: 1.35; }
.rich-image-editor__insert-menu button { min-height: 29px; padding: 5px 12px; border: 0; border-radius: 3px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.rich-image-editor__insert-menu button:hover, .rich-image-editor__insert-menu button:focus-visible { background: #edf3ee; }
.rich-image-editor__menu-heading { display: flex; justify-content: space-between; gap: 12px; padding: 7px 12px 3px; color: #515b54; }
.rich-image-editor__menu-size { display: flex; align-items: center; gap: 3px; padding: 0 5px 5px; }
.rich-image-editor__menu-size button { flex: none; width: 26px; padding: 0; text-align: center; }
.rich-image-editor__menu-size input { width: 132px; accent-color: #417a51; }
.rich-image-editor__menu-divider { height: 1px; margin: 4px -4px; background: #e4e9e4; }
.rich-image-editor__mobile-insert { position: fixed; z-index: 2999; width: 36px; height: 36px; padding: 0; border: 1px solid #9db5a2; border-radius: 50%; background: #fff; color: #254d34; font-size: 24px; line-height: 1; box-shadow: 0 2px 8px rgba(0, 0, 0, .12); }
.rich-image-editor button, .diary-image-viewer button { padding: 5px 10px; border: 1px solid #cad8cc; border-radius: 6px; background: #fff; color: var(--color-text); cursor: pointer; }
.rich-image-editor :deep(.rich-image-editor__body) { box-sizing: border-box; min-height: 360px; padding: 14px; border: 1px solid #cad8cc; border-radius: 8px; background: #fff; color: #252a31; line-height: 1.55; overflow-wrap: anywhere; outline: none; }
.rich-image-editor :deep(.rich-image-editor__body:focus) { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(46, 125, 50, .1); }
.rich-image-editor :deep(.rich-image-editor__body p) { margin: 0; min-height: 1.55em; }
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
