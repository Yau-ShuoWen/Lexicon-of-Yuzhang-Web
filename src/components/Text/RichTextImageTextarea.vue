<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Fragment, Slice } from '@tiptap/pm/model'
import { dropPoint } from '@tiptap/pm/transform'
import { closeHistory } from '@tiptap/pm/history'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { request } from '../../services/request.js'
import closeIcon from '../../assets/icons/close.svg'
import downloadIcon from '../../assets/icons/download.svg'
import zoomInIcon from '../../assets/icons/zoom-in.svg'
import zoomOutIcon from '../../assets/icons/zoom-out.svg'
import moveIcon from '../../assets/icons/move.svg'
import copyIcon from '../../assets/icons/copy.svg'
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
const embeddedElementPattern = /\{pg (?:\{p [^{}]+}){2,}}|\{p (?:(?:[^{}\r\n]*?)=>)?(?:[1-9][0-9]*|[0-9a-f-]{36})(?:~[0-9]{2,3})?}/g
const editor = shallowRef(null)
const fileInput = ref(null)
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
const fullPreviewDialog = ref(null)
const fullPreviewBody = ref(null)

function renderFullPreview() {
  const body = fullPreviewBody.value
  if (!body || !fullPreview.value) return
  renderDiaryBody(body, { text: props.modelValue, images: { ...props.images, ...recoveredImages.value }, viewMode: 'self' })
  for (const [index, img] of [...body.querySelectorAll('.rt-picture img[data-image-id]')].entries()) {
    if (img.closest('.rt-picture-group')) continue
    const controls = document.createElement('span')
    controls.className = 'diary-full-preview__size'
    for (const [label, step, icon] of [['缩小', -40, zoomOutIcon], ['放大', 40, zoomInIcon]]) {
      const button = document.createElement('button')
      button.type = 'button'
      button.title = label + '图片'
      button.setAttribute('aria-label', label + '图片')
      const graphic = document.createElement('img')
      graphic.src = icon
      graphic.alt = ''
      button.append(graphic)
      button.addEventListener('click', () => resizePreviewImage(index, img, step))
      controls.append(button)
    }
    const unit = document.createElement('span')
    unit.className = 'diary-full-preview__picture-unit'
    img.replaceWith(unit)
    unit.append(img, controls)
  }
}
function resizePreviewImage(index, img, step) {
  const instance = editor.value
  if (!instance) return
  let count = 0
  let target = null
  instance.state.doc.descendants((node, position) => {
    if (node.type.name !== 'image') return
    if (count++ === index) target = { node, position }
  })
  if (!target) return
  const current = Math.round(img.getBoundingClientRect().width) || Math.min(400, img.naturalWidth || 400)
  const width = Math.min(900, Math.max(80, current + step))
  instance.view.dispatch(instance.state.tr.setNodeMarkup(target.position, undefined, { ...target.node.attrs, displayWidth: width }))
  nextTick(renderFullPreview)
}
function openFullPreview() {
  fullPreview.value = true
  nextTick(() => { renderFullPreview(); fullPreviewDialog.value?.focus() })
}
function closeFullPreview() { fullPreview.value = false; editor.value?.commands.focus() }

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
function toDocument(value) {
  return {
    type: 'doc',
    content: value.replace(/\r/g, '').split('\n').map(line => {
      const content = []
      const group = line.match(/^\{pg ((?:\{p [^{}]+}){2,})}$/)
      if (group) {
        const members = [...group[1].matchAll(embeddedPicturePattern)]
        if (members.map(member => member[0]).join('') === group[1]) {
          const groupId = crypto.randomUUID()
          for (const member of members) {
            const picture = member[0].match(picturePattern)
            content.push({ type: 'image', attrs: { src: imageFor(picture[2])?.url || '', imageId: picture[2], alt: picture[1] || '', displayWidth: Number(picture[3]) || 160, groupId } })
          }
          return { type: 'paragraph', content }
        }
      }
      let offset = 0
      for (const match of line.matchAll(embeddedElementPattern)) {
        if (match.index > offset) content.push({ type: 'text', text: line.slice(offset, match.index) })
        const groupId = match[0].startsWith('{pg ') ? crypto.randomUUID() : null
        for (const member of match[0].matchAll(embeddedPicturePattern)) {
          const picture = member[0].match(picturePattern)
          content.push({ type: 'image', attrs: { src: imageFor(picture[2])?.url || '', imageId: picture[2], alt: picture[1] || '', displayWidth: Number(picture[3]) || 160, groupId } })
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
  if (node.type === 'paragraph') {
    let result = ''
    let group = []
    let currentGroup = null
    const flush = () => { if (group.length) result += group.length >= 2 ? `{pg ${group.join('')}}` : group.join(''); group = []; currentGroup = null }
    for (const child of node.content || []) {
      const groupId = child.type === 'image' ? child.attrs?.groupId : null
      if (groupId && groupId === currentGroup) group.push(textOf(child))
      else { flush(); if (groupId) { currentGroup = groupId; group.push(textOf(child)) } else result += textOf(child) }
    }
    flush()
    return result
  }
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
  const source = [...document.querySelectorAll('.rich-image-editor__picture')].find(node => node.dataset.imageId === id)?.querySelector('img')
  if (!source?.naturalWidth) return
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
function closePreview() { previewDrag = null; previewPointers.clear(); pinchDistance = 0; previewId.value = null }
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
function setSelectionGroup(grouped) {
  const instance = editor.value
  if (!instance) return
  const { from, to } = instance.state.selection
  const selected = []
  instance.state.doc.nodesBetween(from, to, (node, position) => {
    if (node.type.name === 'image' && position >= from && position < to) selected.push({ node, position })
  })
  if (selected.length < (grouped ? 2 : 1)) return
  const groupId = grouped ? crypto.randomUUID() : null
  let transaction = instance.state.tr
  for (const { node, position } of selected) transaction = transaction.setNodeMarkup(position, undefined, { ...node.attrs, groupId })
  instance.view.dispatch(transaction)
}
const pictures = computed(() => [...props.modelValue.matchAll(/\{p (?:(.*?)=>)?([1-9][0-9]*|[0-9a-f-]{36})(?:~[0-9]{2,3})?}/g)].map(match => ({ id: match[2], caption: match[1] || '' })))
const activePicture = computed(() => pictures.value.find(picture => picture.id === previewId.value))
const activeImage = computed(() => activePicture.value && imageFor(activePicture.value.id))
function movePreview(step) {
  const index = pictures.value.findIndex(picture => picture.id === previewId.value)
  if (index >= 0) previewId.value = pictures.value[(index + step + pictures.value.length) % pictures.value.length]?.id
}
function onViewerKeydown(event) {
  if (event.key === 'Escape') closePreview()
  else if (event.key === 'ArrowLeft') movePreview(-1)
  else if (event.key === 'ArrowRight') movePreview(1)
  else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom.value + .1) }
  else if (event.key === '-') { event.preventDefault(); setZoom(zoom.value - .1) }
}
function onPreviewShortcut(event) {
  if (event.key !== 'F2' || event.repeat || previewId.value || fullPreview.value || !editorHovered.value) return
  event.preventDefault()
  openFullPreview()
}

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
        renderHTML: attributes => ({ 'data-display-width': attributes.displayWidth || 160 }) },
      groupId: { default: null, parseHTML: element => element.getAttribute('data-group-id'),
        renderHTML: attributes => attributes.groupId ? { 'data-group-id': attributes.groupId } : {} }
    }
  },
  addNodeView() {
    return ({ node, decorations, editor: instance, getPos }) => {
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
      const controls = document.createElement('span')
      controls.className = 'rich-image-editor__controls'
      const legacyLabel = document.createElement('span')
      legacyLabel.className = 'rich-image-editor__legacy'
      legacyLabel.textContent = '旧图'
      legacyLabel.title = '复制这张图片并粘贴回正文，会重新上传原图并生成新标识'
      let pictureWidth = Number(node.attrs.displayWidth) || 160
      img.addEventListener('click', () => openPreview(dom.dataset.imageId))
      for (const [label, step, icon] of [['缩小', -40, zoomOutIcon], ['放大', 40, zoomInIcon]]) {
        const button = document.createElement('button')
        button.type = 'button'
        button.title = label
        button.setAttribute('aria-label', label + '图片')
        const iconImage = document.createElement('img')
        iconImage.src = icon
        iconImage.alt = ''
        button.append(iconImage)
        button.addEventListener('mousedown', event => event.preventDefault())
        button.addEventListener('click', event => {
          event.stopPropagation()
          pictureWidth = Math.min(900, Math.max(80, pictureWidth + step))
          const position = getPos()
          if (typeof position === 'number') instance.view.dispatch(instance.state.tr.setNodeMarkup(position, undefined, { ...instance.state.doc.nodeAt(position).attrs, displayWidth: pictureWidth }))
        })
        controls.append(button)
      }
      const copyButton = document.createElement('button')
      copyButton.type = 'button'
      copyButton.title = '复制原图'
      copyButton.setAttribute('aria-label', '复制原图')
      const copyGraphic = document.createElement('img')
      copyGraphic.src = copyIcon
      copyGraphic.alt = ''
      copyButton.append(copyGraphic)
      copyButton.addEventListener('mousedown', event => event.preventDefault())
      copyButton.addEventListener('click', event => {
        event.stopPropagation()
        const position = getPos()
        if (typeof position === 'number') copyPicture(instance.state.doc.nodeAt(position))
      })
      controls.append(copyButton)
      const moveButton = document.createElement('button')
      moveButton.type = 'button'
      moveButton.className = 'rich-image-editor__move'
      moveButton.title = '拖动图片'
      moveButton.setAttribute('aria-label', '拖动图片')
      const moveGraphic = document.createElement('img')
      moveGraphic.src = moveIcon
      moveGraphic.alt = ''
      moveButton.append(moveGraphic)
      let touchMove = null
      moveButton.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse') return
        event.preventDefault()
        const position = getPos()
        if (typeof position !== 'number') return
        touchMove = { pointerId: event.pointerId, source: position }
        moveButton.setPointerCapture(event.pointerId)
        dom.classList.add('rich-image-editor__picture--moving')
      })
      moveButton.addEventListener('pointerup', event => {
        if (!touchMove || touchMove.pointerId !== event.pointerId) return
        const { source } = touchMove
        touchMove = null
        dom.classList.remove('rich-image-editor__picture--moving')
        const target = instance.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        const draggedNode = instance.state.doc.nodeAt(source)
        if (target == null || !draggedNode || target >= source && target <= source + draggedNode.nodeSize) return
        let transaction = instance.state.tr.delete(source, source + draggedNode.nodeSize)
        const mapped = transaction.mapping.map(target)
        const insertAt = dropPoint(transaction.doc, mapped, new Slice(Fragment.from(draggedNode), 0, 0))
        if (insertAt == null) return
        instance.view.dispatch(transaction.insert(insertAt, draggedNode))
      })
      moveButton.addEventListener('pointercancel', () => {
        touchMove = null
        dom.classList.remove('rich-image-editor__picture--moving')
      })
      controls.append(moveButton)
      dom.append(spinner, img, legacyLabel, controls)
      const update = (nextNode, nextDecorations = []) => {
        if (nextNode.type.name !== 'image') return false
        rangeSelected = nextDecorations.some(decoration => decoration.type?.attrs?.class?.includes('rich-image-editor__picture--selected'))
        showSelection()
        const id = String(nextNode.attrs.imageId || '')
        pictureWidth = Number(nextNode.attrs.displayWidth) || 160
        dom.style.setProperty('--picture-width', `${pictureWidth}px`)
        dom.dataset.imageId = id
        legacyLabel.hidden = !/^[1-9][0-9]*$/.test(id)
        dom.classList.toggle('rich-image-editor__picture--grouped', Boolean(nextNode.attrs.groupId))
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
        deselectNode() { nodeSelected = false; showSelection() }
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
      const transaction = editor.value.state.tr.setNodeMarkup(position, undefined, { src: image.url, imageId: String(image.publicId || image.id), alt: '' })
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
  }
}
async function chooseImage() {
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
    if (handle) await upload(await handle.getFile(), true)
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
  editor.value = new Editor({
    content: toDocument(props.modelValue),
    extensions: [StarterKit.configure({
      bold: false, blockquote: false, bulletList: false, code: false, codeBlock: false,
      heading: false, horizontalRule: false, italic: false, link: false,
      listItem: false, listKeymap: false, orderedList: false, strike: false,
      underline: false, trailingNode: false
    }), DiaryImage.configure({ inline: true })],
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
    onUpdate: updateModel
  })
})
onUnmounted(() => { window.removeEventListener('keydown', onPreviewShortcut); for (const timer of retryTimers.values()) clearTimeout(timer); editor.value?.destroy() })
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
    <div class="rich-image-editor__head"><span>正文</span><span class="rich-image-editor__head-actions"><button type="button" @mousedown.prevent @click="setSelectionGroup(true)">组成图片组</button><button type="button" @mousedown.prevent @click="setSelectionGroup(false)">拆开图片组</button><button type="button" @click="chooseImage">{{ uploading ? '继续上传图片' : '上传图片' }}</button></span></div>
    <EditorContent :editor="editor" />
    <div class="rich-image-editor__hint">旧图可复制后粘贴为新图片；鼠标停在正文编辑框上按 F2 可预览整篇日记并调整图片大小。</div>
    <input ref="fileInput" type="file" accept="image/*" class="rich-image-editor__file-input" @change="upload($event.target.files[0], isMobile)" />
    <Teleport to="body">
      <div v-if="fullPreview" ref="fullPreviewDialog" class="diary-full-preview" role="dialog" aria-modal="true" aria-label="日记正文预览" tabindex="-1" @keydown.esc="closeFullPreview" @click.self="closeFullPreview">
        <div class="diary-full-preview__page"><div class="diary-full-preview__head"><span>日记正文预览</span><button type="button" aria-label="关闭预览" @click="closeFullPreview"><img :src="closeIcon" alt="" /></button></div><div ref="fullPreviewBody" class="diary-full-preview__body" /></div>
      </div>
      <div v-if="activePicture" ref="viewer" class="diary-image-viewer" role="dialog" aria-modal="true" aria-label="图片预览" tabindex="-1" @keydown="onViewerKeydown" @click.self="closePreview" @wheel.prevent="setZoom(zoom + ($event.deltaY < 0 ? .1 : -.1))">
        <div class="diary-image-viewer__image-wrap"><button type="button" class="diary-image-viewer__close" aria-label="关闭预览" @click="closePreview"><img :src="closeIcon" alt="" draggable="false" /></button><a v-if="activeImage?.url" class="diary-image-viewer__download" :href="activeImage.url" :download="`diary-image-${previewId}`" aria-label="下载原图" title="下载原图"><img :src="downloadIcon" alt="" draggable="false" /></a><div class="diary-image-viewer__zoom"><button type="button" aria-label="缩小预览" @click="setZoom(zoom - .1)"><img :src="zoomOutIcon" alt="" /></button><button type="button" aria-label="放大预览" @click="setZoom(zoom + .1)"><img :src="zoomInIcon" alt="" /></button></div><canvas ref="previewCanvas" :style="{ transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${zoom})` }" @pointerdown="startPreviewDrag" @pointermove="movePreviewDrag" @pointerup="endPreviewDrag" @pointercancel="endPreviewDrag" /></div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.rich-image-editor { width: 100%; }
.rich-image-editor__file-input { position: absolute; width: 1px; height: 1px; padding: 0; opacity: 0; overflow: hidden; pointer-events: none; }
.rich-image-editor__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; color: var(--color-text); font-weight: 600; }
.rich-image-editor__head-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.rich-image-editor button, .diary-image-viewer button { padding: 5px 10px; border: 1px solid #cad8cc; border-radius: 6px; background: #fff; color: var(--color-text); cursor: pointer; }
.rich-image-editor :deep(.rich-image-editor__body) { box-sizing: border-box; min-height: 360px; padding: 14px; border: 1px solid #cad8cc; border-radius: 8px; background: #fff; color: #252a31; line-height: 1.55; overflow-wrap: anywhere; outline: none; }
.rich-image-editor :deep(.rich-image-editor__body:focus) { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(46, 125, 50, .1); }
.rich-image-editor :deep(.rich-image-editor__body p) { margin: 0; min-height: 1.55em; }
.rich-image-editor :deep(.rich-image-editor__picture) { --picture-controls-width: 105px; position: relative; display: inline-flex; vertical-align: middle; align-items: center; justify-content: flex-start; box-sizing: border-box; width: min(calc(var(--picture-width, 160px) + var(--picture-controls-width)), 100%); min-height: 48px; height: auto; margin: 8px 0; border: 1px solid #b8c8bb; border-radius: 4px; background: #f7faf7; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded) { min-height: 0; }
.rich-image-editor :deep(.rich-image-editor__picture--grouped) { width: min(calc(96px + var(--picture-controls-width)), 100%); }
.rich-image-editor :deep(.rich-image-editor__controls) { flex: none; display: inline-flex; align-items: center; flex-direction: row; gap: 4px; margin-left: 6px; }
.rich-image-editor :deep(.rich-image-editor__controls button) { display: grid; place-items: center; width: 29px; height: 29px; padding: 4px; }
.rich-image-editor :deep(.rich-image-editor__controls button img) { display: block; width: 17px; height: 17px; }
.rich-image-editor :deep(.rich-image-editor__controls .rich-image-editor__move) { touch-action: none; cursor: grab; }
.rich-image-editor :deep(.rich-image-editor__picture--moving) { outline: 2px solid var(--color-primary); opacity: .75; }
.rich-image-editor :deep(.rich-image-editor__legacy:not([hidden])) { position: absolute; left: 0; bottom: 0; display: block; max-width: 100%; padding: 3px 5px; background: rgba(255, 248, 224, .95); color: #6e4a15; font-size: 11px; line-height: 1.25; }
.rich-image-editor :deep(.rich-image-editor__picture--selected) { border-color: #2f6fed; outline: 2px solid #2f6fed; outline-offset: 2px; background: #eaf1ff; }
.rich-image-editor :deep(.rich-image-editor__picture > img) { display: none; width: min(var(--picture-width, 160px), calc(100% - var(--picture-controls-width))); height: auto; object-fit: contain; cursor: zoom-in; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded > img) { display: block; }
.rich-image-editor :deep(.rich-image-editor__spinner) { width: 22px; height: 22px; border: 2px solid #cbd8cd; border-top-color: var(--color-primary); border-radius: 50%; animation: rich-image-spin .8s linear infinite; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded .rich-image-editor__spinner) { display: none; }
.rich-image-editor :deep(.rich-image-editor__picture--failed .rich-image-editor__spinner) { display: none; }
.rich-image-editor :deep(.rich-image-editor__picture--failed::before) { content: '图片加载失败'; color: var(--color-text-light); font-size: 12px; }
@keyframes rich-image-spin { to { transform: rotate(360deg); } }
.rich-image-editor__hint { margin-top: 8px; color: var(--color-text-light); font-size: .75rem; }
.rich-image-editor--dragging :deep(.rich-image-editor__body) { outline: 2px dashed var(--color-primary); }
.diary-full-preview { position: fixed; z-index: 3100; inset: 0; overflow: auto; padding: 28px 14px; background: rgba(0, 0, 0, .55); outline: none; }
.diary-full-preview__page { box-sizing: border-box; width: min(960px, 100%); min-height: 70vh; margin: auto; padding: 24px; background: var(--color-background, #fff); color: var(--color-text); }
.diary-full-preview__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #cad8cc; font-size: 18px; font-weight: 600; }
.diary-full-preview__head button { display: grid; place-items: center; width: 32px; height: 32px; padding: 6px; border: 1px solid #cad8cc; background: #fff; cursor: pointer; }
.diary-full-preview__head img { width: 16px; height: 16px; }
.diary-full-preview__body { padding-top: 22px; font-size: 17px; line-height: 1.8; overflow-wrap: anywhere; }
.diary-full-preview__body :deep(.rt-picture) { margin: 12px 0; text-align: left; }
.diary-full-preview__body :deep(.rt-picture img[data-image-id]) { display: inline-block; height: auto; max-width: 100%; margin: 0; vertical-align: middle; }
.diary-full-preview__body :deep(.rt-picture-group) { display: inline-flex; flex-wrap: wrap; gap: 6px; vertical-align: middle; }
.diary-full-preview__body :deep(.rt-picture-group .rt-picture) { display: inline-block; margin: 0; }
.diary-full-preview__body :deep(.rt-picture-group .rt-picture img[data-image-id]) { width: auto; max-width: 88px !important; max-height: 88px; object-fit: contain; }
.diary-full-preview__body :deep(.diary-full-preview__picture-unit) { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; vertical-align: middle; white-space: nowrap; }
.diary-full-preview__body :deep(.diary-full-preview__picture-unit > img) { min-width: 0; }
.diary-full-preview__body :deep(.rt-table .rt-picture) { display: inline-block; margin: 0; vertical-align: middle; }
.diary-full-preview__body :deep(.rt-table .diary-full-preview__picture-unit) { max-width: none; }
.diary-full-preview__body :deep(.rt-table .diary-full-preview__picture-unit > img) { flex: none; max-width: none !important; }
.diary-full-preview__body :deep(.rt-table .rt-picture img[data-image-id]:not([data-display-width])) { width: 96px; height: auto; }
.diary-full-preview__body :deep(.diary-full-preview__size) { flex: none; display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; }
.diary-full-preview__body :deep(.diary-full-preview__size button) { display: grid; place-items: center; width: 28px; height: 28px; padding: 4px; border: 1px solid #cad8cc; border-radius: 4px; background: #fff; cursor: pointer; }
.diary-full-preview__body :deep(.diary-full-preview__size img) { display: block; width: 17px; height: 17px; margin: 0; }
@media (max-width: 600px) { .diary-full-preview__page { padding: 16px; } }
@media (pointer: coarse) { .rich-image-editor :deep(.rich-image-editor__picture) { --picture-controls-width: 138px; } }
@media (pointer: fine) { .rich-image-editor :deep(.rich-image-editor__controls .rich-image-editor__move) { display: none; } }
.diary-image-viewer { position: fixed; z-index: 3000; inset: 0; display: grid; place-items: center; padding: 18px; background: rgba(0, 0, 0, .55); outline: none; }
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
