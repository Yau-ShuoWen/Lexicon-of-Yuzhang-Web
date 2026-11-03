<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Fragment, Slice } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { request } from '../../services/request.js'
import closeIcon from '../../assets/icons/close.svg'

const props = defineProps({
  modelValue: { type: String, default: '' },
  ownerId: { type: [String, Number], required: true },
  placeholder: { type: String, default: '' },
  images: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue', 'upload-state-change', 'image-added'])
const picturePattern = /^\{p (?:(.*?)=>)?([1-9][0-9]*)}$/
const editor = shallowRef(null)
const fileInput = ref(null)
const uploading = ref(false)
const dragging = ref(false)
const previewId = ref(null)
const zoom = ref(1)
const viewer = ref(null)
const recoveredImages = ref({})
const pendingImages = new Set()
const retryTimers = new Map()
const clipboardImages = new Map()
const pendingClipboardImages = new Map()
const emittedValues = new Set()

function imageFor(id) { return recoveredImages.value[id] || props.images[id] }
function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
async function prepareClipboardImage(id, url) {
  if (!id || !url || String(id).startsWith('pending:')) return
  const cached = clipboardImages.get(id)
  if (cached?.url === url || pendingClipboardImages.has(id)) return
  const task = (async () => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`图片读取失败：${response.status}`)
    const bitmap = await createImageBitmap(await response.blob())
    try {
      const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片转换失败')), 'image/png'))
      clipboardImages.set(id, { url, data: await blobDataUrl(blob) })
    } finally { bitmap.close() }
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
      return prepared?.data ? node.type.create({ ...node.attrs, src: prepared.data }) : node
    }
    return node.content.size ? node.copy(copiedFragment(node.content)) : node
  }))
}
function toDocument(value) {
  return {
    type: 'doc',
    content: value.replace(/\r/g, '').split('\n').map(line => {
      const picture = line.match(picturePattern)
      if (picture) return { type: 'image', attrs: { src: imageFor(picture[2])?.url || '', imageId: picture[2], alt: picture[1] || '' } }
      return { type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }
    })
  }
}
function textOf(node) {
  if (node.type === 'text') return node.text || ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content || []).map(textOf).join('')
}
function plainFromSlice(slice) {
  return slice.content.content.map(node => node.textBetween(0, node.content.size, '\n')).join('\n')
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
  return (editor.value?.getJSON().content || []).map(node => {
    if (node.type === 'image') {
      const id = String(node.attrs?.imageId || '')
      if (!/^[1-9][0-9]*$/.test(id)) return ''
      const caption = String(node.attrs?.alt || '').replace(/[{}\r\n]/g, '').trim()
      return caption ? `{p ${caption}=>${id}}` : `{p ${id}}`
    }
    return textOf(node)
  }).join('\n')
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
  retryTimers.set(id, setTimeout(() => {
    retryTimers.delete(id)
    if (editor.value?.getJSON().content?.some(node => String(node.attrs?.imageId) === String(id))) recoverImage(id, true)
  }, 3000))
}
async function recoverImage(id, force = false) {
  if (pendingImages.has(id) || (!force && imageFor(id)?.url)) return
  pendingImages.add(id)
  try {
    const image = await request(`/api/diary/edit/${props.ownerId}/image/${id}`)
    recoveredImages.value = { ...recoveredImages.value, [id]: image }
    setImageInDocument(id, image, force)
  } catch (error) { console.warn('日记图片无法获取', id, error); scheduleRetry(id) }
  finally { pendingImages.delete(id) }
}
function openPreview(id) { previewId.value = id; zoom.value = 1; nextTick(() => viewer.value?.focus()) }
function closePreview() { previewId.value = null }
function setZoom(value) { zoom.value = Math.min(4, Math.max(.25, value)) }
const pictures = computed(() => [...props.modelValue.matchAll(/^\{p (?:(.*?)=>)?([1-9][0-9]*)}$/gm)].map(match => ({ id: match[2], caption: match[1] || '' })))
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
}

const DiaryImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      imageId: {
        default: null,
        parseHTML: element => element.getAttribute('data-image-id'),
        renderHTML: attributes => attributes.imageId ? { 'data-image-id': attributes.imageId } : {}
      }
    }
  },
  addNodeView() {
    return ({ node, decorations }) => {
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
        prepareClipboardImage(dom.dataset.imageId, img.src)
      })
      img.addEventListener('error', () => { dom.classList.remove('rich-image-editor__picture--loaded'); scheduleRetry(dom.dataset.imageId) })
      dom.addEventListener('dblclick', () => openPreview(dom.dataset.imageId))
      dom.append(spinner, img)
      const update = (nextNode, nextDecorations = []) => {
        if (nextNode.type.name !== 'image') return false
        rangeSelected = nextDecorations.some(decoration => decoration.type?.attrs?.class?.includes('rich-image-editor__picture--selected'))
        showSelection()
        const id = String(nextNode.attrs.imageId || '')
        dom.dataset.imageId = id
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
async function savePastedImage(token, source, alt) {
  uploading.value = true
  emit('upload-state-change', true)
  try {
    const response = await fetch(source)
    if (!response.ok) throw new Error('图片读取失败')
    const blob = await response.blob()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 10 * 1024 * 1024) {
      throw new Error('粘贴的图片须为 JPEG、PNG 或 WebP，且不超过 10 MB')
    }
    const body = new FormData()
    body.append('file', blob, `pasted.${blob.type.split('/')[1]}`)
    const image = await request(`/api/diary/edit/${props.ownerId}/image`, { method: 'POST', body })
    const position = pendingPosition(token)
    if (position !== null) {
      const transaction = editor.value.state.tr.setNodeMarkup(position, undefined, {
        src: image.url, imageId: String(image.id), alt
      })
      editor.value.view.dispatch(transaction.setMeta('addToHistory', false))
      emit('image-added', image)
      updateModel()
    }
  } catch (error) {
    const position = pendingPosition(token)
    if (position !== null) editor.value.commands.deleteRange({ from: position, to: position + 1 })
    alert(error.message || '粘贴图片失败')
  } finally {
    uploading.value = false
    emit('upload-state-change', false)
  }
}
async function upload(file) {
  if (uploading.value || !file || !editor.value) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { alert('只支持 JPEG、PNG、WebP 图片'); return }
  if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10 MB'); return }
  const token = `pending:${crypto.randomUUID()}`
  editor.value.chain().focus().insertContent([{ type: 'image', attrs: { src: '', imageId: token, alt: '' } }, { type: 'paragraph' }]).run()
  uploading.value = true
  emit('upload-state-change', true)
  try {
    const body = new FormData()
    body.append('file', file)
    const image = await request(`/api/diary/edit/${props.ownerId}/image`, { method: 'POST', body })
    const position = pendingPosition(token)
    if (position !== null) {
      const transaction = editor.value.state.tr.setNodeMarkup(position, undefined, { src: image.url, imageId: String(image.id), alt: '' })
      editor.value.view.dispatch(transaction.setMeta('addToHistory', false))
    }
    emit('image-added', image)
    updateModel()
  } catch (error) {
    const position = pendingPosition(token)
    if (position !== null) editor.value.commands.deleteRange({ from: position, to: position + 1 })
    alert(error.message || '图片上传失败')
  } finally {
    uploading.value = false
    emit('upload-state-change', false)
    if (fileInput.value) fileInput.value.value = ''
  }
}
onMounted(() => {
  editor.value = new Editor({
    content: toDocument(props.modelValue),
    extensions: [StarterKit.configure({
      bold: false, blockquote: false, bulletList: false, code: false, codeBlock: false,
      heading: false, horizontalRule: false, italic: false, link: false,
      listItem: false, listKeymap: false, orderedList: false, strike: false,
      underline: false, trailingNode: false
    }), DiaryImage],
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
      transformCopied: slice => new Slice(copiedFragment(slice.content), slice.openStart, slice.openEnd),
      transformPasted: slice => {
        const pending = []
        const prepare = fragment => Fragment.fromArray(fragment.content.map(node => {
          if (node.type.name === 'image' && !/^[1-9][0-9]*$/.test(String(node.attrs.imageId || ''))) {
            const token = `pending:${crypto.randomUUID()}`
            pending.push({ token, source: node.attrs.src, alt: node.attrs.alt || '' })
            return node.type.create({ ...node.attrs, imageId: token })
          }
          return node.content.size ? node.copy(prepare(node.content)) : node
        }))
        const result = new Slice(prepare(slice.content), slice.openStart, slice.openEnd)
        if (pending.length) queueMicrotask(() => {
          for (const image of pending) savePastedImage(image.token, image.source, image.alt)
        })
        return result
      },
      clipboardTextParser: (text, context, plain, view) => {
        const schema = view.state.schema
        const paragraphs = text.replace(/\r\n?/g, '\n').split('\n').map(line =>
          schema.nodes.paragraph.create(null, line ? schema.text(line) : undefined))
        return new Slice(Fragment.fromArray(paragraphs), 0, 0)
      },
      handleDOMEvents: {
        copy: (view, event) => handlePlainClipboard(view, event),
        cut: (view, event) => {
          if (handlePlainClipboard(view, event, true)) return true
          view.dispatch(closeHistory(view.state.tr))
          return false
        }
      },
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData('text/html') || ''
        // Let ProseMirror keep the order of text and images in rich clipboard content.
        // The copied image carries its diary image ID in data-image-id.
        if (/<img\b/i.test(html)) {
          view.dispatch(closeHistory(view.state.tr))
          return false
        }
        const plainText = event.clipboardData?.getData('text/plain')
        if (plainText) {
          const paragraphs = plainText.replace(/\r\n?/g, '\n').split('\n').map(line =>
            view.state.schema.nodes.paragraph.create(null, line ? view.state.schema.text(line) : undefined))
          view.dispatch(closeHistory(view.state.tr).replaceSelection(new Slice(Fragment.fromArray(paragraphs), 0, 0)))
          return true
        }
        const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'))
        if (files.length !== 1 || event.clipboardData?.getData('text/html')) return false
        upload(files[0])
        return true
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files || [])]
        if (!files.length) return false
        if (files.length !== 1) { alert('一次只能上传一张图片'); return true }
        upload(files[0])
        return true
      }
    },
    onUpdate: updateModel
  })
})
onUnmounted(() => { for (const timer of retryTimers.values()) clearTimeout(timer); editor.value?.destroy() })
watch(() => props.modelValue, value => {
  if (emittedValues.has(value) || !editor.value || value === fromDocument()) return
  emittedValues.clear()
  editor.value.commands.setContent(toDocument(value), { emitUpdate: false })
})
watch(() => props.images, images => {
  for (const [id, image] of Object.entries(images)) setImageInDocument(id, image)
}, { deep: true })
</script>

<template>
  <div class="rich-image-editor" :class="{ 'rich-image-editor--dragging': dragging }" @dragover="dragging = true" @dragleave="dragging = false" @drop="dragging = false">
    <div class="rich-image-editor__head"><span>正文</span><button type="button" :disabled="uploading" @click="fileInput.click()">{{ uploading ? '上传中……' : '上传图片' }}</button></div>
    <EditorContent :editor="editor" />
    <div class="rich-image-editor__hint">可在正文中输入文字、复制粘贴或拖入图片；双击图片可预览。</div>
    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="upload($event.target.files[0])" />
    <Teleport to="body">
      <div v-if="activePicture" ref="viewer" class="diary-image-viewer" role="dialog" aria-modal="true" aria-label="图片预览" tabindex="-1" @keydown="onViewerKeydown" @click.self="closePreview">
        <div class="diary-image-viewer__panel">
          <header class="diary-image-viewer__toolbar"><span>图片 {{ pictures.findIndex(picture => picture.id === previewId) + 1 }} / {{ pictures.length }}</span><div class="diary-image-viewer__controls"><button type="button" aria-label="缩小" :disabled="zoom <= .25" @click="setZoom(zoom - .25)">−</button><span>{{ Math.round(zoom * 100) }}%</span><button type="button" aria-label="放大" :disabled="zoom >= 4" @click="setZoom(zoom + .25)">＋</button><button type="button" @click="setZoom(1)">重置</button></div></header>
          <div class="diary-image-viewer__stage" @wheel.prevent="setZoom(zoom + ($event.deltaY < 0 ? .1 : -.1))"><div class="diary-image-viewer__image-wrap"><button type="button" class="diary-image-viewer__close" aria-label="关闭预览" @click="closePreview"><img :src="closeIcon" alt="" /></button><img v-if="activeImage?.url" :src="activeImage.url" :alt="activePicture.caption" :style="{ zoom }" /><div v-else>图片加载中</div></div></div>
          <footer class="diary-image-viewer__footer"><button type="button" :disabled="pictures.length < 2" @click="movePreview(-1)">上一张</button><a v-if="activeImage?.url" :href="activeImage.url" target="_blank" rel="noopener noreferrer">打开图片 URL</a><button type="button" :disabled="pictures.length < 2" @click="movePreview(1)">下一张</button></footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.rich-image-editor { width: 100%; }
.rich-image-editor__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; color: var(--color-text); font-weight: 600; }
.rich-image-editor button, .diary-image-viewer button { padding: 5px 10px; border: 1px solid #cad8cc; border-radius: 6px; background: #fff; color: var(--color-text); cursor: pointer; }
.rich-image-editor :deep(.rich-image-editor__body) { box-sizing: border-box; min-height: 360px; padding: 14px; border: 1px solid #cad8cc; border-radius: 8px; background: #fff; color: #252a31; line-height: 1.55; overflow-wrap: anywhere; outline: none; }
.rich-image-editor :deep(.rich-image-editor__body:focus) { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(46, 125, 50, .1); }
.rich-image-editor :deep(.rich-image-editor__body p) { margin: 0; min-height: 1.55em; }
.rich-image-editor :deep(.rich-image-editor__picture) { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: min(160px, 100%); height: 110px; margin: 8px auto 8px 0; border: 1px solid #b8c8bb; border-radius: 4px; background: #f7faf7; cursor: zoom-in; }
.rich-image-editor :deep(.rich-image-editor__picture--selected) { border-color: #2f6fed; outline: 2px solid #2f6fed; outline-offset: 2px; background: #eaf1ff; }
.rich-image-editor :deep(.rich-image-editor__picture img) { display: none; max-width: 148px; max-height: 98px; object-fit: contain; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded img) { display: block; }
.rich-image-editor :deep(.rich-image-editor__spinner) { width: 22px; height: 22px; border: 2px solid #cbd8cd; border-top-color: var(--color-primary); border-radius: 50%; animation: rich-image-spin .8s linear infinite; }
.rich-image-editor :deep(.rich-image-editor__picture--loaded .rich-image-editor__spinner) { display: none; }
@keyframes rich-image-spin { to { transform: rotate(360deg); } }
.rich-image-editor__hint { margin-top: 8px; color: var(--color-text-light); font-size: .75rem; }
.rich-image-editor--dragging :deep(.rich-image-editor__body) { outline: 2px dashed var(--color-primary); }
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
</style>
