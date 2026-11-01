<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {request} from '../../../services/request.js'
import {showError, showSuccess} from '../../../services/ToastService.js'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'
import ScTcEditorLab from '../../../components/Text/ScTcEditorLab.vue'
import RichText from '../../../components/Text/RichText.vue'
import confirmIcon from '../../../assets/icons/LanguageAndDialect/yes.svg'
import cancelIcon from '../../../assets/icons/close.svg'
import plusIcon from '../../../assets/icons/plus-white.svg'
import {ensureNoteLabels, fromLegacy, getNoteLabelUsages, mergeMissingLegacyChildren, mergeNoteLabel, syncItemKeys} from '../../../utils/pinyinDocument.js'

const route = useRoute()
const router = useRouter()
const dialect = computed(() => route.params.dialect)
const language = computed(() => route.params.language === 'tc' ? 'tc' : 'sc')
const documentData = ref(null)
const loading = ref(true)
const editingId = ref(null)
const editingName = ref({sc: '', tc: ''})
const editingOriginalName = ref({sc: '', tc: ''})
const nameEditor = ref(null)
let nameFinishPromise = null
const draggingId = ref(null)
const draggingKind = ref(null)
const selectedId = ref(null)
const selectedKind = ref(null)
const savedSnapshot = ref('')
const saving = ref(false)
const editLevel = ref(route.params.level || 'section')
const editTabs = [
  {key: 'section', label: '区'}, {key: 'row', label: '行'},
  {key: 'group', label: '组'}, {key: 'item', label: '单'}, {key: 'faq', label: '问答'}
]
const activeEditTabIndex = computed(() => editTabs.findIndex(tab => tab.key === editLevel.value))
const openedItemId = ref(null)
const openedChildId = ref(null)
const editingItemTitle = ref(false)
const itemTitleDraft = ref('')
const editingChildTitle = ref(false)
const titleInput = ref(null)
function setChildTitleInput(element) {
  if (element) titleInput.value = element
}
const isUnplacedEditor = computed(() => openedItemId.value === '__unplaced__')
const labelsOpen = ref(false)
const mergeTargets = ref({})
const focusedUnplacedId = ref(null)
const repairIds = ref(new Set())
const faqDragId = ref(null)
const openedFaqId = ref(null)
const faqDraft = ref(null)
const pairEditors = new Map()
const draggingChildId = ref(null)
const openedItem = computed(() => isUnplacedEditor.value
  ? {id: '__unplaced__', children: documentData.value?.unplaced || []}
  : documentData.value?.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items))).find(item => item.id === openedItemId.value))
const openedChild = computed(() => openedItem.value?.children.find(child => child.id === openedChildId.value)
  || (draggingChildId.value === openedChildId.value
    ? childPress?.currentList.find(child => child.id === openedChildId.value) : null))
const openedFaq = computed(() => documentData.value?.faq.find(entry => entry.id === openedFaqId.value))
const hasChanges = computed(() => documentData.value && JSON.stringify(documentData.value) !== savedSnapshot.value)
const labelUsages = computed(() => documentData.value ? getNoteLabelUsages(documentData.value) : new Map())
const duplicateLabelIds = computed(() => {
  const seen = new Map()
  const duplicates = new Set()
  for (const label of documentData.value?.noteLabels || []) {
    const key = `${label.text.sc?.trim().normalize('NFC')}\u0000${label.text.tc?.trim().normalize('NFC')}`
    if (seen.has(key)) { duplicates.add(seen.get(key)); duplicates.add(label.id) }
    else seen.set(key, label.id)
  }
  return duplicates
})
let press = null
let childPress = null
let notePress = null
let faqPress = null
const draggingNoteId = ref(null)
let suppressChildClick = false
let dragPreview = null

function removeDragPreview() {
  dragPreview?.remove()
  dragPreview = null
}

async function load() {
  loading.value = true
  try {
    const saved = await request(`/api/pinyin/document/${dialect.value}`)
    let legacy = null
    try { legacy = await request(`/api/edit/pinyin/legacy/${dialect.value}`) } catch (error) {
      if (!saved) throw error
    }
    documentData.value = saved || fromLegacy(legacy)
    documentData.value.faq ||= []
    savedSnapshot.value = JSON.stringify(documentData.value)
    if (legacy) mergeMissingLegacyChildren(documentData.value, legacy)
    ensureNoteLabels(documentData.value)
    repairIds.value = new Set([
      ...documentData.value.noteLabels.filter(label => !sameLength(label.text)).map(label => label.id)
    ])
  } catch (error) {
    showError(error.message)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (editingId.value) {
    if (!await finishName()) return
  }
  for (const editor of pairEditors.values()) {
    if (!await editor.synchronizeForSave()) return
  }
  try {
    syncItemKeys(documentData.value)
    const names = new Set()
    for (const label of documentData.value.noteLabels) {
      if (!label.text.sc?.trim() || !label.text.tc?.trim()) throw new Error('解释名称需要填写简体和繁体')
      const name = JSON.stringify(label.text)
      if (names.has(name)) throw new Error('解释名称重复，请更换使用它的解释后删除重复名称')
      names.add(name)
    }
  } catch (error) { showError(error.message); return }
  if (!hasChanges.value || saving.value) return
  const body = JSON.stringify(documentData.value, (key, value) => key === 'editState' ? undefined : value)
  const targetDialect = dialect.value
  saving.value = true
  try {
    await request(`/api/edit/pinyin/document/${targetDialect}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body
    })
    savedSnapshot.value = JSON.stringify(documentData.value)
    showSuccess('已保存')
  } catch (error) {
    showError(error.message, 8000)
  } finally {
    saving.value = false
  }
}

function sectionName(section) {
  return section.name?.[language.value] || section.name?.sc || ''
}

function unplacedReason(child) {
  if (child.migrationIssue) return '旧数据尚未归入新表格'
  return child.previousRoot ? '旧归属没有匹配的格子' : '尚未指定格子'
}

function isEmpty(section) {
  return section.rows.every(rowEmpty)
}

function rowEmpty(row) {
  return row.groups.every(group => group.items.length === 0)
}

function addRow(section) {
  section.rows.push({id: crypto.randomUUID(), name: {sc: '', tc: ''}, groups: []})
}

function removeRow(section, row) {
  if (!rowEmpty(row)) return
  section.rows.splice(section.rows.indexOf(row), 1)
}

function addGroup(row) {
  row.groups.push({id: crypto.randomUUID(), items: []})
}

function addItem(group) {
  group.items.push({id: crypto.randomUUID(), key: `empty-${crypto.randomUUID()}`, standard: '-', children: []})
}

function openItem(item) {
  if (editLevel.value !== 'item') return
  openedItemId.value = item.id
  openedChildId.value = item.children[0]?.id || null
  editingItemTitle.value = false
  editingChildTitle.value = false
  selectedId.value = null
  selectedKind.value = null
}

function openUnplacedChild(child) {
  if (editLevel.value !== 'item') return
  openedItemId.value = '__unplaced__'
  openedChildId.value = child.id
  focusedUnplacedId.value = child.id
}

function closeItem() {
  openedItemId.value = null
  openedChildId.value = null
  editingItemTitle.value = false
  editingChildTitle.value = false
}

async function editTitle(kind, child = null) {
  if (kind === 'item') {
    itemTitleDraft.value = openedItem.value.standard === '-' ? '（占位）' : openedItem.value.standard
    editingItemTitle.value = true
  } else {
    if (child) openedChildId.value = child.id
    editingChildTitle.value = true
  }
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}

function finishItemTitle(cancel = false) {
  if (!cancel && openedItem.value) {
    const title = itemTitleDraft.value.trim()
    openedItem.value.standard = !title || title === '（占位）' ? '-' : title
  }
  editingItemTitle.value = false
}

function selectChild(child) {
  if (suppressChildClick) return
  openedChildId.value = child.id
  editingChildTitle.value = false
}

function addChild() {
  const id = crypto.randomUUID()
  const child = {
    id, key: `child-${id}`, title: '', audioKey: id,
    notes: [
      {id: crypto.randomUUID(), label: {sc: '写法', tc: '寫法'}, value: {sc: '', tc: ''}},
      {id: crypto.randomUUID(), label: {sc: '输入', tc: '輸入'}, value: {sc: '', tc: ''}},
      {id: crypto.randomUUID(), label: {sc: '发音', tc: '發音'}, value: {sc: '', tc: ''}}
    ]
  }
  openedItem.value.children.push(child)
  ensureNoteLabels(documentData.value)
  openedChildId.value = id
}

function childPointerDown(event, list, child) {
  if (event.button !== 0 || event.target.closest('input, .item-remove')) return
  childPress = {id: child.id, list, currentList: list, originalIndex: list.findIndex(item => item.id === child.id),
    pointerId: event.pointerId, x: event.clientX, y: event.clientY, element: event.currentTarget}
  window.addEventListener('pointermove', childPointerMove)
  window.addEventListener('pointerup', childPointerUp)
  window.addEventListener('pointercancel', childPointerCancel)
}

function childPointerMove(event) {
  const drag = childPress
  if (!drag || event.pointerId !== drag.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) { finishChildDrag(); return }
  if (!draggingChildId.value) {
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    draggingChildId.value = drag.id
    suppressChildClick = true
    window.getSelection()?.removeAllRanges()
    const rect = drag.element.getBoundingClientRect()
    dragPreview = drag.element.cloneNode(true)
    dragPreview.classList.add('drag-preview')
    Object.assign(dragPreview.style, {width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`})
    window.document.body.appendChild(dragPreview)
    drag.offsetX = event.clientX - rect.left
    drag.offsetY = event.clientY - rect.top
  }
  dragPreview.style.left = `${event.clientX - drag.offsetX}px`
  dragPreview.style.top = `${event.clientY - drag.offsetY}px`
  if (drag.lastSwap && Math.hypot(event.clientX - drag.lastSwap.x, event.clientY - drag.lastSwap.y) < 12) return
  const target = childTargetAt(event.clientX, event.clientY)
  if (target) {
    const list = childListFor(target)
    if (list) {
      const targetIndex = list.findIndex(item => item.id === target.dataset.childId)
      const sourceIndex = drag.currentList.findIndex(item => item.id === drag.id)
      const side = list === drag.currentList && sourceIndex < targetIndex ? 'after' : 'before'
      if (moveDraggedChild(list, target.dataset.childId, side)) drag.lastSwap = {x: event.clientX, y: event.clientY}
    }
    return
  }
  const container = window.document.elementsFromPoint(event.clientX, event.clientY)
    .map(element => element.closest('[data-child-list]')).find(Boolean)
  const list = childListFor(container)
  if (list && (list !== drag.currentList || list.length === 0) && moveDraggedChild(list)) {
    drag.lastSwap = {x: event.clientX, y: event.clientY}
  }
}

function childTargetAt(x, y) {
  for (const element of window.document.querySelectorAll('[data-child-id]')) {
    if (element.dataset.childId === childPress.id || element.closest('.drag-preview')) continue
    const rect = element.getBoundingClientRect()
    const transform = window.getComputedStyle(element).transform
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform)
    const left = rect.left - (matrix?.m41 || 0)
    const top = rect.top - (matrix?.m42 || 0)
    if (x >= left && x < left + rect.width && y >= top && y < top + rect.height) return element
  }
  return null
}

function childListFor(element) {
  const container = element?.closest('[data-child-list]')
  if (!container) return null
  const id = container.dataset.childList
  if (id === 'unplaced') return documentData.value.unplaced
  if (id === 'opened') return openedItem.value?.children
  return documentData.value.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items)))
    .find(item => item.id === id)?.children
}

function moveDraggedChild(targetList, targetId = null, side = 'after') {
  const drag = childPress
  const sourceList = drag.currentList
  const sourceIndex = sourceList.findIndex(item => item.id === drag.id)
  if (sourceIndex < 0) return false
  const targetPosition = targetId ? targetList.findIndex(item => item.id === targetId) : targetList.length
  if (targetPosition < 0) return false
  const targetIndex = targetPosition + Number(Boolean(targetId) && side === 'after')
  const destination = targetList === sourceList && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  if (sourceList === targetList && sourceIndex === destination) return false
  const previous = new Map([...window.document.querySelectorAll('[data-child-id]')]
    .filter(element => element.dataset.childId !== drag.id && !element.closest('.drag-preview'))
    .map(element => [element.dataset.childId, element.getBoundingClientRect()]))
  const [child] = sourceList.splice(sourceIndex, 1)
  targetList.splice(destination, 0, child)
  drag.currentList = targetList
  nextTick(() => {
    if (childPress !== drag) return
    for (const element of window.document.querySelectorAll('[data-child-id]')) {
      const before = previous.get(element.dataset.childId)
      if (!before || element.closest('.drag-preview')) continue
      element.getAnimations().forEach(animation => animation.cancel())
      const after = element.getBoundingClientRect()
      const x = before.left - after.left
      const y = before.top - after.top
      if (Math.abs(x) >= 1 || Math.abs(y) >= 1) element.animate([
        {transform: `translate(${x}px, ${y}px)`}, {transform: 'translate(0, 0)'}
      ], {duration: 180, easing: 'ease-out'})
    }
  })
  return true
}

function childPointerUp(event) {
  if (childPress && event.pointerId === childPress.pointerId) finishChildDrag()
}

function childPointerCancel() {
  if (childPress && draggingChildId.value) {
    const index = childPress.currentList.findIndex(item => item.id === childPress.id)
    if (index >= 0) childPress.list.splice(childPress.originalIndex, 0, ...childPress.currentList.splice(index, 1))
  }
  finishChildDrag()
}

function finishChildDrag() {
  window.removeEventListener('pointermove', childPointerMove)
  window.removeEventListener('pointerup', childPointerUp)
  window.removeEventListener('pointercancel', childPointerCancel)
  removeDragPreview()
  childPress = null
  draggingChildId.value = null
  window.setTimeout(() => { suppressChildClick = false }, 0)
  if (openedItem.value && !openedItem.value.children.some(child => child.id === openedChildId.value)) {
    openedChildId.value = openedItem.value.children[0]?.id || null
  }
}

function childIsEmpty(child) {
  return !child.title?.trim() && child.notes.every(note =>
    !note.value?.sc?.trim() && !note.value?.tc?.trim())
}

function removeChild(child) {
  if (!childIsEmpty(child)) return
  const index = openedItem.value.children.indexOf(child)
  if (index < 0) return
  openedItem.value.children.splice(index, 1)
  if (openedChildId.value === child.id) openedChildId.value = openedItem.value.children[Math.min(index, openedItem.value.children.length - 1)]?.id || null
}

function addNote() {
  if (!documentData.value.noteLabels.length) addLabel()
  const label = documentData.value.noteLabels[0]
  openedChild.value.notes.push({id: crypto.randomUUID(), labelId: label.id, label: label.text, value: {sc: '', tc: ''}})
}

function notePointerDown(event, note) {
  if (event.button !== 0) return
  const list = openedChild.value.notes
  notePress = {id: note.id, list, originalIndex: list.findIndex(item => item.id === note.id),
    pointerId: event.pointerId, x: event.clientX, y: event.clientY, element: event.currentTarget.closest('.note-pair')}
  window.addEventListener('pointermove', notePointerMove)
  window.addEventListener('pointerup', notePointerUp)
  window.addEventListener('pointercancel', notePointerCancel)
}

function notePointerMove(event) {
  const drag = notePress
  if (!drag || event.pointerId !== drag.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) { finishNoteDrag(); return }
  if (!draggingNoteId.value) {
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    draggingNoteId.value = drag.id
    window.getSelection()?.removeAllRanges()
    const rect = drag.element.getBoundingClientRect()
    dragPreview = drag.element.cloneNode(true)
    dragPreview.classList.add('drag-preview')
    Object.assign(dragPreview.style, {width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`})
    window.document.body.appendChild(dragPreview)
    drag.offsetX = event.clientX - rect.left
    drag.offsetY = event.clientY - rect.top
  }
  dragPreview.style.left = `${event.clientX - drag.offsetX}px`
  dragPreview.style.top = `${event.clientY - drag.offsetY}px`
  if (drag.lastSwap && Math.hypot(event.clientX - drag.lastSwap.x, event.clientY - drag.lastSwap.y) < 12) return
  for (const element of window.document.querySelectorAll('.note-list [data-note-id]')) {
    if (element.dataset.noteId === drag.id) continue
    const rect = element.getBoundingClientRect()
    const transform = window.getComputedStyle(element).transform
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform)
    const top = rect.top - (matrix?.m42 || 0)
    if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < top || event.clientY >= top + rect.height) continue
    const sourceIndex = drag.list.findIndex(item => item.id === drag.id)
    const targetIndex = drag.list.findIndex(item => item.id === element.dataset.noteId)
    if (targetIndex < 0) break
    const destination = targetIndex
    if (sourceIndex === destination) break
    const previous = new Map([...window.document.querySelectorAll('.note-list [data-note-id]')]
      .filter(row => row.dataset.noteId !== drag.id)
      .map(row => [row.dataset.noteId, row.getBoundingClientRect()]))
    drag.list.splice(destination, 0, ...drag.list.splice(sourceIndex, 1))
    drag.lastSwap = {x: event.clientX, y: event.clientY}
    nextTick(() => {
      if (notePress !== drag) return
      for (const row of window.document.querySelectorAll('.note-list [data-note-id]')) {
        const before = previous.get(row.dataset.noteId)
        if (!before) continue
        row.getAnimations().forEach(animation => animation.cancel())
        const after = row.getBoundingClientRect()
        const y = before.top - after.top
        if (Math.abs(y) >= 1) row.animate([{transform: `translateY(${y}px)`}, {transform: 'translateY(0)'}],
          {duration: 180, easing: 'ease-out'})
      }
    })
    break
  }
}

function notePointerUp(event) {
  if (notePress && event.pointerId === notePress.pointerId) finishNoteDrag()
}

function notePointerCancel() {
  if (notePress && draggingNoteId.value) {
    const index = notePress.list.findIndex(item => item.id === notePress.id)
    if (index >= 0) notePress.list.splice(notePress.originalIndex, 0, ...notePress.list.splice(index, 1))
  }
  finishNoteDrag()
}

function finishNoteDrag() {
  window.removeEventListener('pointermove', notePointerMove)
  window.removeEventListener('pointerup', notePointerUp)
  window.removeEventListener('pointercancel', notePointerCancel)
  removeDragPreview()
  notePress = null
  draggingNoteId.value = null
}

function addLabel() {
  documentData.value.noteLabels.push({id: crypto.randomUUID(), text: {sc: '', tc: ''}})
  labelsOpen.value = true
}

function sameLength(pair) {
  return Array.from(pair?.sc || '').length === Array.from(pair?.tc || '').length
}

function addFaq() {
  const id = crypto.randomUUID()
  documentData.value.faq.push({
    id,
    question: {sc: '', tc: ''},
    answer: {sc: '', tc: ''}
  })
  openFaq(documentData.value.faq.at(-1))
}

function openFaq(entry) {
  faqDraft.value = {question: JSON.parse(JSON.stringify(entry.question)), answer: JSON.parse(JSON.stringify(entry.answer))}
  openedFaqId.value = entry.id
}

function closeFaq() {
  const entry = documentData.value?.faq.find(item => item.id === openedFaqId.value)
  if (entry && faqDraft.value) {
    entry.question = faqDraft.value.question
    entry.answer = faqDraft.value.answer
  }
  openedFaqId.value = null
  faqDraft.value = null
}

function setPairEditor(id, editor) {
  if (editor) pairEditors.set(id, editor)
  else pairEditors.delete(id)
}

function faqPointerDown(event, entry) {
  if (event.button !== 0) return
  const list = documentData.value.faq
  faqPress = {id: entry.id, list, originalIndex: list.findIndex(item => item.id === entry.id),
    pointerId: event.pointerId, x: event.clientX, y: event.clientY, element: event.currentTarget.closest('.faq-editor__entry')}
  window.addEventListener('pointermove', faqPointerMove)
  window.addEventListener('pointerup', faqPointerUp)
  window.addEventListener('pointercancel', faqPointerCancel)
}

function faqPointerMove(event) {
  const drag = faqPress
  if (!drag || event.pointerId !== drag.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) { finishFaqDrag(); return }
  if (!faqDragId.value) {
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    faqDragId.value = drag.id
    window.getSelection()?.removeAllRanges()
    const rect = drag.element.getBoundingClientRect()
    dragPreview = drag.element.cloneNode(true)
    dragPreview.classList.add('drag-preview')
    Object.assign(dragPreview.style, {width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`})
    window.document.body.appendChild(dragPreview)
    drag.offsetX = event.clientX - rect.left
    drag.offsetY = event.clientY - rect.top
  }
  dragPreview.style.left = `${event.clientX - drag.offsetX}px`
  dragPreview.style.top = `${event.clientY - drag.offsetY}px`
  if (drag.lastSwap && Math.hypot(event.clientX - drag.lastSwap.x, event.clientY - drag.lastSwap.y) < 12) return
  for (const element of window.document.querySelectorAll('.faq-editor__entry[data-faq-id]')) {
    if (element.dataset.faqId === drag.id) continue
    const rect = element.getBoundingClientRect()
    const transform = window.getComputedStyle(element).transform
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform)
    const top = rect.top - (matrix?.m42 || 0)
    if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < top || event.clientY >= top + rect.height) continue
    const sourceIndex = drag.list.findIndex(item => item.id === drag.id)
    const targetIndex = drag.list.findIndex(item => item.id === element.dataset.faqId)
    if (targetIndex < 0 || sourceIndex === targetIndex) break
    const previous = new Map([...window.document.querySelectorAll('.faq-editor__entry[data-faq-id]')]
      .filter(row => row.dataset.faqId !== drag.id)
      .map(row => [row.dataset.faqId, row.getBoundingClientRect()]))
    drag.list.splice(targetIndex, 0, ...drag.list.splice(sourceIndex, 1))
    drag.lastSwap = {x: event.clientX, y: event.clientY}
    nextTick(() => {
      if (faqPress !== drag) return
      for (const row of window.document.querySelectorAll('.faq-editor__entry[data-faq-id]')) {
        const before = previous.get(row.dataset.faqId)
        if (!before) continue
        row.getAnimations().forEach(animation => animation.cancel())
        const after = row.getBoundingClientRect()
        const y = before.top - after.top
        if (Math.abs(y) >= 1) row.animate([{transform: `translateY(${y}px)`}, {transform: 'translateY(0)'}],
          {duration: 180, easing: 'ease-out'})
      }
    })
    break
  }
}

function faqPointerUp(event) {
  if (faqPress && event.pointerId === faqPress.pointerId) finishFaqDrag()
}

function faqPointerCancel() {
  if (faqPress && faqDragId.value) {
    const index = faqPress.list.findIndex(item => item.id === faqPress.id)
    if (index >= 0) faqPress.list.splice(faqPress.originalIndex, 0, ...faqPress.list.splice(index, 1))
  }
  finishFaqDrag()
}

function finishFaqDrag() {
  window.removeEventListener('pointermove', faqPointerMove)
  window.removeEventListener('pointerup', faqPointerUp)
  window.removeEventListener('pointercancel', faqPointerCancel)
  removeDragPreview()
  faqPress = null
  faqDragId.value = null
}

function finishPairRepair(id, pair) {
  if (!sameLength(pair)) { showError('简繁长度仍不一致'); return }
  const next = new Set(repairIds.value)
  next.delete(id)
  repairIds.value = next
}

function selectLabel(note, id) {
  const label = documentData.value.noteLabels.find(label => label.id === id)
  if (!label) return
  note.labelId = label.id
  note.label = label.text
}

function removeLabel(label) {
  const used = [...documentData.value.unplaced, ...documentData.value.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items.flatMap(item => item.children))))]
    .some(child => child.notes?.some(note => note.labelId === label.id))
  if (used) { showError('这个名称正在使用，先为解释选择其他名称'); return }
  documentData.value.noteLabels.splice(documentData.value.noteLabels.indexOf(label), 1)
}

function mergeLabel(label) {
  const targetId = mergeTargets.value[label.id] || documentData.value.noteLabels.find(other => other.id !== label.id && other.text.sc?.trim() === label.text.sc?.trim() && other.text.tc?.trim() === label.text.tc?.trim())?.id
  if (!targetId) { showError('请选择要合并到的名称'); return }
  if (mergeNoteLabel(documentData.value, label.id, targetId)) delete mergeTargets.value[label.id]
}

function usageDescription(usage) {
  const child = usage.itemId
    ? documentData.value.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items.flatMap(item => item.children)))).find(child => child.id === usage.childId)
    : documentData.value.unplaced.find(child => child.id === usage.childId)
  if (!usage.itemId) return `未归类 · ${child?.title || '未填写标题'}`
  const section = documentData.value.sections.find(section => section.id === usage.sectionId)
  const item = section?.rows.flatMap(row => row.groups.flatMap(group => group.items)).find(item => item.id === usage.itemId)
  return `${sectionName(section)} · ${item?.standard || '空格'} · ${child?.title || '未填写标题'}`
}

function locateUsage(usage) {
  labelsOpen.value = false
  editLevel.value = 'item'
  void router.push({name: 'PinyinEditor', params: {...route.params, level: 'item'}})
  if (usage.itemId) {
    openedItemId.value = usage.itemId
    openedChildId.value = usage.childId
    nextTick(() => window.document.querySelector(`[data-note-id="${usage.noteId}"]`)?.scrollIntoView({block: 'center'}))
  } else {
    openedItemId.value = '__unplaced__'
    openedChildId.value = usage.childId
    focusedUnplacedId.value = usage.childId
    nextTick(() => window.document.querySelector(`[data-note-id="${usage.noteId}"]`)?.scrollIntoView({block: 'center'}))
  }
}

function removeItem(group, item) {
  if (item.children?.length) return
  group.items.splice(group.items.indexOf(item), 1)
}

async function selectLevel(level) {
  if (editingId.value && !await finishName()) return
  if (openedFaqId.value) closeFaq()
  closeItem()
  editLevel.value = level
  selectedId.value = null
  selectedKind.value = null
  pointerCancel()
  await router.push({name: 'PinyinEditor', params: {...route.params, level}})
}

function removeGroup(row, group) {
  if (group.items.length) return
  row.groups.splice(row.groups.indexOf(group), 1)
}

async function editName(target) {
  if (draggingId.value) return
  if (editingId.value && editingId.value !== target.id && !await finishName()) return
  editingId.value = target.id
  editingName.value = {...(target.name || {sc: '', tc: ''})}
  editingOriginalName.value = {...editingName.value}
}

function finishName(cancel = false) {
  if (nameFinishPromise) return nameFinishPromise
  const pending = completeName(cancel)
  nameFinishPromise = pending
  pending.finally(() => { if (nameFinishPromise === pending) nameFinishPromise = null })
  return pending
}

async function completeName(cancel) {
  const target = documentData.value.sections.flatMap(section => [section, ...section.rows])
    .find(entry => entry.id === editingId.value)
  if (!target) return false
  if (!cancel && !nameEditor.value?.hasPendingChanges() &&
      editingName.value.sc === editingOriginalName.value.sc && editingName.value.tc === editingOriginalName.value.tc &&
      editingName.value.machineSide === editingOriginalName.value.machineSide) {
    editingId.value = null
    return true
  }
  if (!cancel && nameEditor.value && !await nameEditor.value.synchronizeForSave()) return false
  if (!cancel && (!editingName.value.sc.trim() || !editingName.value.tc.trim())) {
    showError('请填写简体和繁体标题')
    return false
  }
  if (!cancel) target.name = { ...editingName.value }
  editingId.value = null
  return true
}

function setNameEditor(editor) {
  nameEditor.value = editor
}

function onDocumentPointerDown(event) {
  if (editingId.value && event.target instanceof Element && !event.target.closest('.name-inline, .lab-preview-overlay')) {
    void finishName()
  }
}

function addSection() {
  const section = {
    id: crypto.randomUUID(), code: `section-${crypto.randomUUID().slice(0, 8)}`,
    name: {sc: '新区域', tc: '新區域'}, rows: []
  }
  documentData.value.sections.push(section)
  editName(section)
}

function rowName(row) {
  return row.name?.[language.value] || row.name?.sc || '未命名行'
}

function removeSection(section) {
  if (!isEmpty(section)) return
  const index = documentData.value.sections.findIndex(item => item.id === section.id)
  if (index < 0) return
  documentData.value.sections.splice(index, 1)
}

function pointerDown(event, kind, list, id) {
  if (event.button !== 0 || editingId.value || openedItemId.value || (editLevel.value !== kind && !(editLevel.value === 'row' && kind === 'line'))) return
  if (event.target.closest('input, button')) return
  press = {kind, list, currentList: list, originalIndex: list.findIndex(item => item.id === id), id,
    pointerId: event.pointerId, x: event.clientX, y: event.clientY, element: event.currentTarget}
  selectedId.value = id
  selectedKind.value = kind
  window.addEventListener('pointermove', pointerMove)
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('pointercancel', pointerCancel)
}

function pointerMove(event) {
  if (!press || event.pointerId !== press.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
    finishDrag()
    return
  }
  if (!draggingId.value) {
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return
    draggingId.value = press.id
    draggingKind.value = press.kind
    window.getSelection()?.removeAllRanges()
    const rect = press.element.getBoundingClientRect()
    dragPreview = press.element.cloneNode(true)
    dragPreview.removeAttribute('id')
    dragPreview.classList.remove('sort-dragging')
    dragPreview.classList.add('drag-preview')
    Object.assign(dragPreview.style, {width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`})
    window.document.body.appendChild(dragPreview)
    press.offsetX = event.clientX - rect.left
    press.offsetY = event.clientY - rect.top
  }
  dragPreview.style.left = `${event.clientX - press.offsetX}px`
  dragPreview.style.top = `${event.clientY - press.offsetY}px`
  // A shifting item can briefly pass under an almost stationary pointer.
  // Wait for a small deliberate movement before considering another target.
  if (press.lastSwap && Math.hypot(event.clientX - press.lastSwap.x, event.clientY - press.lastSwap.y) < 12) return
  if (press.kind === 'group') {
    const end = window.document.elementsFromPoint(event.clientX, event.clientY)
      .map(element => element.closest('[data-group-end-id]')).find(Boolean)
    if (end && moveDraggedItem(destinationList('group', end.dataset.groupEndId))) {
      press.lastSwap = {x: event.clientX, y: event.clientY}
      return
    }
  }
  const target = sortTargetAt(event.clientX, event.clientY)
  const id = target?.dataset.sortId
  if (id && id !== press.id) {
    const targetList = sortList(press.kind, id)
    const sourceIndex = press.currentList.findIndex(item => item.id === press.id)
    const targetIndex = targetList?.findIndex(item => item.id === id) ?? -1
    const side = targetList === press.currentList && sourceIndex < targetIndex ? 'after' : 'before'
    if (moveDraggedItem(targetList, id, side)) press.lastSwap = {x: event.clientX, y: event.clientY}
  } else if (!id) {
    const hits = window.document.elementsFromPoint(event.clientX, event.clientY)
    const listTarget = hits.map(element => element.closest(`[data-drop-list-kind="${press.kind}"]`)).find(Boolean)
    const list = destinationList(press.kind, listTarget?.dataset.dropListId)
    if (list && (list !== press.currentList || list.length === 0) && moveDraggedItem(list)) {
      press.lastSwap = {x: event.clientX, y: event.clientY}
    }
  }
}

function sortTargetAt(x, y) {
  for (const element of window.document.querySelectorAll(`[data-sort-kind="${press.kind}"]`)) {
    if (element.dataset.sortId === press.id || element.closest('.drag-preview')) continue
    const rect = element.getBoundingClientRect()
    // FLIP animates with translate; hit testing must use the final layout position.
    const transform = window.getComputedStyle(element).transform
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform)
    const left = rect.left - (matrix?.m41 || 0)
    const top = rect.top - (matrix?.m42 || 0)
    if (x >= left && x < left + rect.width && y >= top && y < top + rect.height) return element
  }
  return null
}

function moveDraggedItem(targetList, targetId = null, side = 'after') {
  if (!targetList) return false
  const sourceList = press.currentList
  const sourceIndex = sourceList.findIndex(item => item.id === press.id)
  if (sourceIndex < 0) return false
  const targetPosition = targetId ? targetList.findIndex(item => item.id === targetId) : targetList.length
  if (targetPosition < 0) return false
  const targetIndex = targetPosition + Number(Boolean(targetId) && side === 'after')
  const destination = targetList === sourceList && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  if (targetList === sourceList && sourceIndex === destination) return false
  const selector = `[data-sort-kind="${press.kind}"], [data-drag-follow="${press.kind}"]`
  const elementKey = element => element.dataset.dragFollowId || element.dataset.sortId
  const previousPositions = new Map([...window.document.querySelectorAll(selector)]
    .filter(element => element.dataset.sortId !== press.id && !element.closest('.drag-preview'))
    .map(element => [elementKey(element), element.getBoundingClientRect()]))
  const [moved] = sourceList.splice(sourceIndex, 1)
  targetList.splice(destination, 0, moved)
  press.currentList = targetList
  nextTick(() => {
    if (!press || draggingId.value !== moved.id) return
    for (const element of window.document.querySelectorAll(selector)) {
      const previous = previousPositions.get(elementKey(element))
      if (!previous) continue
      element.getAnimations().forEach(animation => animation.cancel())
      const current = element.getBoundingClientRect()
      const x = previous.left - current.left
      const y = previous.top - current.top
      if (Math.abs(x) < 1 && Math.abs(y) < 1) continue
      element.animate([
        {transform: `translate(${x}px, ${y}px)`},
        {transform: 'translate(0, 0)'}
      ], {duration: 180, easing: 'ease-out'})
    }
  })
  return true
}

function sortList(kind, id) {
  if (kind === 'section') return documentData.value.sections
  for (const section of documentData.value.sections) {
    if (kind === 'line' && section.rows.some(row => row.id === id)) return section.rows
    for (const row of section.rows) {
      if (kind === 'group' && row.groups.some(group => group.id === id)) return row.groups
      for (const group of row.groups) {
        if (kind === 'item' && group.items.some(item => item.id === id)) return group.items
      }
    }
  }
  return null
}

function destinationList(kind, id) {
  if (kind === 'line') return documentData.value.sections.find(section => section.id === id)?.rows
  for (const section of documentData.value.sections) for (const row of section.rows) {
    if (kind === 'group' && row.id === id) return row.groups
    for (const group of row.groups) if (kind === 'item' && group.id === id) return group.items
  }
  return null
}

function pointerUp(event) {
  if (!press || event.pointerId !== press.pointerId) return
  finishDrag()
}

function finishDrag() {
  removePointerListeners()
  removeDragPreview()
  press = null
  draggingId.value = null
  draggingKind.value = null
}

function releaseDragOnVisibilityChange() {
  if (window.document.hidden) {
    if (press) finishDrag()
    if (childPress) finishChildDrag()
    if (notePress) finishNoteDrag()
    if (faqPress) finishFaqDrag()
  }
}

function pointerCancel() {
  if (press && draggingId.value) {
    const index = press.currentList.findIndex(item => item.id === press.id)
    if (index >= 0) press.list.splice(press.originalIndex, 0, ...press.currentList.splice(index, 1))
  }
  removePointerListeners()
  removeDragPreview()
  press = null
  draggingId.value = null
  draggingKind.value = null
}

function removePointerListeners() {
  window.removeEventListener('pointermove', pointerMove)
  window.removeEventListener('pointerup', pointerUp)
  window.removeEventListener('pointercancel', pointerCancel)
}

watch(dialect, load)
watch(() => route.params.level, level => {
  if (openedFaqId.value) closeFaq()
  editLevel.value = level || 'section'
  closeItem()
  pointerCancel()
})
onMounted(() => {
  load()
  if (!route.params.level) void router.replace({name: 'PinyinEditor', params: {...route.params, level: 'section'}})
  window.document.addEventListener('pointerdown', onDocumentPointerDown, true)
  window.addEventListener('blur', finishDrag)
  window.addEventListener('blur', finishChildDrag)
  window.addEventListener('blur', finishNoteDrag)
  window.addEventListener('blur', finishFaqDrag)
  window.document.addEventListener('visibilitychange', releaseDragOnVisibilityChange)
})
onUnmounted(() => {
  pointerCancel()
  childPointerCancel()
  notePointerCancel()
  faqPointerCancel()
  window.document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('blur', finishDrag)
  window.removeEventListener('blur', finishChildDrag)
  window.removeEventListener('blur', finishNoteDrag)
  window.removeEventListener('blur', finishFaqDrag)
  window.document.removeEventListener('visibilitychange', releaseDragOnVisibilityChange)
})
</script>

<template>
  <main class="pinyin-section-editor">
    <div v-if="loading" class="status">正在加载拼音表…</div>
    <template v-else-if="documentData">
      <div class="editor-actions">
        <div class="level-picker" role="tablist" aria-label="选择编辑内容">
          <span class="level-picker__indicator" :style="{transform: `translateX(${activeEditTabIndex * 100}%)`}" aria-hidden="true"></span>
          <button v-for="level in editTabs" :key="level.key" type="button" role="tab"
                  :class="{active: editLevel === level.key}" :aria-selected="editLevel === level.key"
                  @click="selectLevel(level.key)">{{ level.label }}</button>
        </div>
        <button class="manage-labels-button" type="button" @click="labelsOpen = true">管理解释名称</button>
        <button class="save-button" type="button" :disabled="saving || (!hasChanges && !editingId)" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
      <p v-if="editLevel !== 'faq'" class="editor-hint">
        <template v-if="editLevel === 'section'">拖动区域可排序，双击标题可编辑。为便于排序，下层内容已折叠；切换到行、组或单可查看和编辑。</template>
        <template v-else-if="editLevel === 'row'">拖动行可跨区域排序，双击标题可编辑。</template>
        <template v-else-if="editLevel === 'group'">拖动组可跨行排序。</template>
        <template v-else>拖动单格可跨组排序，双击单格可编辑文本。</template>
      </p>
      <section v-if="editLevel === 'item'" class="unplaced-panel" data-child-list="unplaced">
        <div class="modal-subheading"><h2>未归类子项 <small>{{ documentData.unplaced.length }}</small></h2></div>
        <div class="unplaced-list">
          <div v-for="child in documentData.unplaced" :key="child.id" class="unplaced-child" :data-child-id="child.id"
               :class="{'located-child': focusedUnplacedId === child.id, 'sort-dragging': draggingChildId === child.id}"
               @pointerdown="childPointerDown($event, documentData.unplaced, child)" @dblclick="openUnplacedChild(child)">
            <strong>{{ child.title || '未填写标题' }}</strong>
            <small>{{ unplacedReason(child) }}</small>
          </div>
          <p v-if="!documentData.unplaced.length" class="empty-hint">没有未归类子项</p>
        </div>
      </section>
      <div v-if="editLevel !== 'faq'" class="section-list" :class="{'section-list--compact': editLevel === 'section'}">
      <section
        v-for="section in documentData.sections"
        :key="section.id"
        :data-section-id="section.id"
        data-sort-kind="section"
        :data-sort-id="section.id"
        class="section-card"
        :class="{'editable-level': editLevel === 'section', 'sort-dragging': draggingKind === 'section' && draggingId === section.id}"
        @pointerdown="editLevel === 'section' && pointerDown($event, 'section', documentData.sections, section.id)"
      >
        <header class="section-header">
          <div v-if="editingId === section.id" class="name-inline section-name-inline" @pointerdown.stop>
            <ScTcEditorLab :ref="setNameEditor" :pair="editingName" :dialect="dialect" layout="small" :rich-text="false" :request-backend="false"
                           @update:pair="editingName = $event" />
            <div class="name-inline-actions"><button type="button" aria-label="确认名称" title="确认" @click="finishName()"><img :src="confirmIcon" alt="" /></button><button type="button" aria-label="取消编辑名称" title="取消" @click="finishName(true)"><img :src="cancelIcon" alt="" /></button></div>
          </div>
          <h3 v-else class="section-name" @dblclick.stop="editLevel === 'section' && editName(section)">{{ sectionName(section) }}</h3>
          <button v-if="editLevel === 'section' && editingId !== section.id && isEmpty(section)" class="remove-button" type="button" aria-label="删除空区域" @click="removeSection(section)">删除</button>
        </header>
        <div v-if="editLevel !== 'section'" class="section-content" data-drop-list-kind="line" :data-drop-list-id="section.id">
          <div>
          <div
            v-for="row in section.rows"
            :key="row.id"
            class="pinyin-line"
            data-sort-kind="line"
            :data-sort-id="row.id"
            :class="{'editable-level': editLevel === 'row', 'sort-dragging': draggingKind === 'line' && draggingId === row.id}"
            @pointerdown="editLevel === 'row' && pointerDown($event, 'line', section.rows, row.id)"
          >
            <div class="line-actions">
              <div v-if="editingId === row.id" class="name-inline row-name-inline" @pointerdown.stop>
                <ScTcEditorLab :ref="setNameEditor" :pair="editingName" :dialect="dialect" layout="small" :rich-text="false" :request-backend="false"
                               @update:pair="editingName = $event" />
                <div class="name-inline-actions"><button type="button" aria-label="确认名称" title="确认" @click="finishName()"><img :src="confirmIcon" alt="" /></button><button type="button" aria-label="取消编辑名称" title="取消" @click="finishName(true)"><img :src="cancelIcon" alt="" /></button></div>
              </div>
              <span v-else class="row-name" @dblclick.stop="editLevel === 'row' && editName(row)">{{ rowName(row) }}</span>
              <button v-if="editLevel === 'row' && editingId !== row.id && rowEmpty(row)" type="button" class="remove-button" @click="removeRow(section, row)">删除空行</button>
            </div>
            <div class="line-groups">
              <div class="line-groups-inner" data-drop-list-kind="group" :data-drop-list-id="row.id">
              <div
                v-for="group in row.groups"
                :key="group.id"
                class="pinyin-group"
                data-sort-kind="group"
                :data-sort-id="group.id"
                data-drop-list-kind="item"
                :data-drop-list-id="group.id"
                :class="{'editable-level': editLevel === 'group', 'sort-dragging': draggingKind === 'group' && draggingId === group.id}"
                @pointerdown="editLevel === 'group' && pointerDown($event, 'group', row.groups, group.id)"
              >
                <div v-if="group.items.length" class="items-grid">
                  <div v-for="item in group.items" :key="item.id" class="item-box" data-sort-kind="item" :data-sort-id="item.id"
                       :class="{'invalid': item.standard === '-', 'editable-level': editLevel === 'item', 'sort-dragging': draggingKind === 'item' && draggingId === item.id}"
                       :data-child-list="item.id"
                       @pointerdown="editLevel === 'item' && pointerDown($event, 'item', group.items, item.id)"
                       @dblclick="openItem(item)">
                    <span v-if="item.standard !== '-'" v-formatted-text="` [${item.standard}] `" />
                    <small v-if="editLevel === 'item' && item.children.length" class="child-count">{{ item.children.length }}</small>
                    <button v-if="editLevel === 'item' && !item.children?.length" class="item-remove" type="button" aria-label="删除单格" @click.stop="removeItem(group, item)">×</button>
                  </div>
                </div>
                <button v-else-if="editLevel === 'group'" class="empty-group" type="button" @click="removeGroup(row, group)">空组 · 删除</button>
                <div v-else class="empty-group">空组</div>
                <button v-if="editLevel === 'item' && group === row.groups.at(-1)" class="add-structure" type="button" aria-label="添加单格" title="添加单格" data-drag-follow="item" :data-drag-follow-id="`item-add-${row.id}`" @click="addItem(group)"><img :src="plusIcon" alt="" /></button>
              </div>
              <button v-if="editLevel === 'group'" class="add-structure" type="button" aria-label="添加组" title="添加组" data-drag-follow="group" :data-drag-follow-id="`group-add-${row.id}`" @click="addGroup(row)"><img :src="plusIcon" alt="" /></button>
              <div v-if="draggingKind === 'group'" class="group-end-drop" :data-group-end-id="row.id"></div>
              </div>
            </div>
          </div>
          </div>
          <button v-if="editLevel === 'row'" class="add-structure" type="button" aria-label="添加行" title="添加行" data-drag-follow="line" :data-drag-follow-id="`line-add-${section.id}`" @click="addRow(section)"><img :src="plusIcon" alt="" /></button>
        </div>
      </section>
      <button v-if="editLevel === 'section'" class="add-structure" type="button" aria-label="添加区域" title="添加区域" data-drag-follow="section" data-drag-follow-id="section-add" @click="addSection"><img :src="plusIcon" alt="" /></button>
      </div>
      <section v-if="editLevel === 'faq'" class="faq-editor" aria-label="拼音表问答">
        <header class="faq-editor__header">
          <h2>问答</h2>
          <button type="button" class="faq-editor__add" aria-label="添加问答" title="添加问答" @click="addFaq"><img :src="plusIcon" alt="" /></button>
        </header>
        <div v-for="(entry, index) in documentData.faq" :key="entry.id" class="faq-editor__entry"
             :data-faq-id="entry.id" :class="{'sort-dragging': faqDragId === entry.id}">
          <button type="button" class="faq-editor__handle sort-handle" aria-label="拖动排序问答" title="拖动排序" @pointerdown="faqPointerDown($event, entry)"><svg viewBox="0 0 22 30" aria-hidden="true"><circle cx="7" cy="7" r="2"/><circle cx="15" cy="7" r="2"/><circle cx="7" cy="15" r="2"/><circle cx="15" cy="15" r="2"/><circle cx="7" cy="23" r="2"/><circle cx="15" cy="23" r="2"/></svg></button>
          <div class="faq-editor__content">
            <div class="faq-editor__actions">
              <button type="button" class="faq-editor__toggle" aria-label="打开问答编辑" @click="openFaq(entry)">编辑</button>
              <button type="button" class="faq-editor__remove" :aria-label="`删除第 ${index + 1} 条问答`" title="删除问答" @click="documentData.faq.splice(index, 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg></button>
            </div>
            <div v-if="openedFaqId !== entry.id" class="faq-editor__preview" role="button" tabindex="0" aria-label="打开问答编辑" @click="openFaq(entry)" @keydown.enter.prevent="openFaq(entry)" @keydown.space.prevent="openFaq(entry)">
              <div v-for="field in ['question', 'answer']" :key="field" class="faq-editor__preview-row">
                <span class="faq-editor__preview-label">{{ field === 'question' ? '题目' : '解答' }}</span>
                <span class="faq-editor__preview-text">
                  <RichText :model-value="entry[field][language] || ''" :language="language" :dialect="dialect" :request-backend="false" plain />
                </span>
              </div>
            </div>
          </div>
        </div>
        <p v-if="!documentData.faq.length" class="empty-hint">还没有问答</p>
      </section>
      <div v-if="openedFaq && faqDraft" class="modal-backdrop" @pointerdown.self="closeFaq" @keydown.esc="closeFaq">
        <section class="item-modal faq-modal" role="dialog" aria-modal="true" aria-label="编辑问答">
          <header class="modal-header"><h2>编辑问答</h2><button type="button" aria-label="关闭问答编辑" @click="closeFaq">×</button></header>
          <div class="faq-editor__field"><h3>题目</h3>
            <ScTcEditorLab :pair="faqDraft.question" :dialect="dialect" layout="small-sentence" :request-backend="false"
                           @update:pair="faqDraft.question = $event" />
          </div>
          <div class="faq-editor__field"><h3>解答</h3>
            <ScTcEditorLab :pair="faqDraft.answer" :dialect="dialect" layout="middle" :request-backend="false"
                           @update:pair="faqDraft.answer = $event" />
          </div>
          <footer class="modal-footer"><button type="button" @click="closeFaq">完成</button></footer>
        </section>
      </div>
      <div v-if="openedItem" class="modal-backdrop" @pointerdown.self="closeItem" @keydown.esc="closeItem">
        <section class="item-modal" role="dialog" aria-modal="true" aria-label="编辑拼音格子">
          <header class="modal-header">
            <h2 v-if="isUnplacedEditor">未归类子项</h2>
            <input v-else-if="editingItemTitle" ref="titleInput" v-model="itemTitleDraft" class="inline-title-input"
                   aria-label="单格标题" @blur="finishItemTitle()" @keydown.enter.prevent="finishItemTitle()"
                   @keydown.esc.stop.prevent="finishItemTitle(true)">
            <h2 v-else class="editable-title" @dblclick="editTitle('item')">{{ openedItem.standard === '-' ? '（占位）' : openedItem.standard || '未填写标题' }}</h2>
            <button type="button" aria-label="关闭弹窗" @click="closeItem">×</button>
          </header>
          <div class="child-workspace">
            <div class="child-list" data-child-list="opened">
              <div v-for="child in openedItem.children" :key="child.id" class="child-list-row" :data-child-id="child.id"
                   :class="{active: openedChildId === child.id, 'sort-dragging': draggingChildId === child.id}"
                   @pointerdown="childPointerDown($event, openedItem.children, child)" @dblclick="editTitle('child', child)">
                <svg v-if="openedChildId === child.id" class="child-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z" /></svg>
                <input v-if="editingChildTitle && openedChildId === child.id" :ref="setChildTitleInput" v-model="child.title" class="child-title-input"
                       aria-label="子项名称" @pointerdown.stop @blur="editingChildTitle = false" @keydown.enter.prevent="editingChildTitle = false">
                <button v-else type="button" @click="selectChild(child)">
                  <strong>{{ child.title || '未填写标题' }}</strong>
                </button>
                <button v-if="childIsEmpty(child) && !editingChildTitle" type="button" class="item-remove child-remove" aria-label="删除空子项" title="删除空子项" @click.stop="removeChild(child)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg></button>
              </div>
              <span v-if="!openedItem.children.length" class="empty-hint">暂无子项</span>
            </div>
            <button v-if="!isUnplacedEditor" type="button" class="child-add" data-child-list="unplaced"
                    aria-label="添加子项，拖入可移至未归类" title="添加子项；拖入可移至未归类" @click="addChild"><img :src="plusIcon" alt="" /></button>
          </div>
          <section v-if="openedChild" :key="openedChild.id" class="selected-child-editor">
            <div class="note-list">
              <div v-for="(note, index) in openedChild.notes" :key="note.id" class="note-pair" :data-note-id="note.id"
                   :class="{'sort-dragging': draggingNoteId === note.id}">
                <button type="button" class="note-handle sort-handle" aria-label="拖动排序解释" title="拖动排序" @pointerdown="notePointerDown($event, note)"><svg viewBox="0 0 22 30" aria-hidden="true"><circle cx="7" cy="7" r="2"/><circle cx="15" cy="7" r="2"/><circle cx="7" cy="15" r="2"/><circle cx="15" cy="15" r="2"/><circle cx="7" cy="23" r="2"/><circle cx="15" cy="23" r="2"/></svg></button>
                <div class="note-fields">
                  <label>
                    <select :value="note.labelId" @change="selectLabel(note, $event.target.value)">
                      <option v-for="label in documentData.noteLabels" :key="label.id" :value="label.id">{{ label.text[language] || label.text.sc || '未命名' }}</option>
                    </select>
                  </label>
                  <div>
                    <ScTcEditorLab :ref="editor => setPairEditor(note.id, editor)" :pair="note.value" :dialect="dialect" layout="small-sentence" :request-backend="false"
                                   @update:pair="note.value = $event" />
                  </div>
                </div>
                <button type="button" class="note-remove" aria-label="删除这一行解释" title="删除这一行解释" @click="openedChild.notes.splice(index, 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg></button>
              </div>
            </div>
            <div class="note-actions">
              <button type="button" class="note-add" aria-label="添加一行解释" title="添加一行解释" @click="addNote"><img :src="plusIcon" alt="" /></button>
            </div>
          </section>
          <footer class="modal-footer"><button type="button" @click="closeItem">完成</button></footer>
        </section>
      </div>
      <div v-if="labelsOpen" class="modal-backdrop label-backdrop" @pointerdown.self="labelsOpen = false">
        <section class="item-modal label-modal" role="dialog" aria-modal="true" aria-label="管理解释名称">
          <header class="modal-header"><h2>管理解释名称</h2><button type="button" aria-label="关闭" @click="labelsOpen = false">×</button></header>
          <div v-for="label in documentData.noteLabels" :key="label.id" class="label-entry">
            <div class="label-row">
              <ScAndTcText v-if="!repairIds.has(label.id) && sameLength(label.text)" v-model:traditional-text="label.text.tc"
                             v-model:simplified-text="label.text.sc" :dialect="dialect" layout="small" />
              <div v-else class="pair-repair"><span>简繁长度不同，请先核对：</span>
                <input v-model="label.text.sc" aria-label="简体名称"><input v-model="label.text.tc" aria-label="繁体名称">
                <button type="button" @click="finishPairRepair(label.id, label.text)">完成核对</button>
              </div>
              <strong class="usage-count">{{ labelUsages.get(label.id)?.length || 0 }} 处使用</strong>
              <span v-if="duplicateLabelIds.has(label.id)" class="duplicate-mark">重复</span>
              <button type="button" class="remove-button" @click="removeLabel(label)">删除</button>
            </div>
            <details v-if="labelUsages.get(label.id)?.length" class="label-usages">
              <summary>查看使用位置</summary>
              <div>
                <button v-for="usage in labelUsages.get(label.id)" :key="usage.noteId" type="button" @click="locateUsage(usage)">
                  {{ usageDescription(usage) }} · 定位
                </button>
              </div>
            </details>
            <div v-if="documentData.noteLabels.length > 1" class="merge-row">
              <select v-model="mergeTargets[label.id]" aria-label="合并目标">
                <option value="">选择合并目标</option>
                <option v-for="other in documentData.noteLabels.filter(other => other.id !== label.id)" :key="other.id" :value="other.id">
                  {{ other.text[language] || other.text.sc || '未命名' }}
                </option>
              </select>
              <button type="button" @click="mergeLabel(label)">合并到所选名称</button>
            </div>
          </div>
          <footer class="modal-footer"><button type="button" @click="addLabel">＋ 添加名称</button><button type="button" @click="labelsOpen = false">完成</button></footer>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
:global(.page-container:has(.pinyin-section-editor)) { max-width: 1400px; }
.pinyin-section-editor { box-sizing: border-box; width: 100%; max-width: 1600px; margin: 0 auto; padding: 24px 18px 60px; }
.editor-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.editor-hint { margin: -4px 0 16px; color: #718278; font-size: 13px; }
.level-picker { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 4px; border: 1px solid #cbdccd; border-radius: 17px; background: #f5faf5; box-shadow: 0 2px 6px #25542d0d, 0 12px 28px #25542d1c; }
.level-picker__indicator { position: absolute; top: 4px; bottom: 4px; left: 5px; width: calc((100% - 10px) / 5); border-radius: 13px; background: #c7e4ca; pointer-events: none; transition: transform .35s cubic-bezier(.22, 1, .36, 1); }
.level-picker button { position: relative; z-index: 1; min-width: 54px; padding: 10px 14px; border: 0; border-radius: 13px; background: transparent; color: #4b5c50; font: inherit; font-weight: 500; line-height: 1.2; cursor: pointer; transition: color .2s ease; }
.level-picker button:hover, .level-picker button.active { color: #1c5924; }
.level-picker button.active { font-weight: 650; }
.level-picker button:focus-visible { outline: 2px solid #2e7d32; outline-offset: -2px; }
.manage-labels-button { margin-left: auto; border: 1px solid #b7d1bc; border-radius: 7px; background: #fff; color: #326d3b; padding: 8px 12px; cursor: pointer; }
.section-card.editable-level { border-color: #8fba97; box-shadow: 0 0 0 2px #2e7d321a; }
.pinyin-line.editable-level, .pinyin-group.editable-level, .item-box.editable-level { border-color: #75ad80; background: #f3faf4; box-shadow: 0 0 0 2px #2e7d3218; }
.section-card.editable-level .section-name, .item-box.editable-level { cursor: text; }
.pinyin-section-editor, .pinyin-section-editor *:not(input):not(textarea) { user-select: none; -webkit-user-select: none; }
.section-card.editable-level, .pinyin-line.editable-level, .pinyin-group.editable-level, .item-box.editable-level { touch-action: none; cursor: grab; }
.sort-dragging, .sort-dragging * { pointer-events: none !important; }
.sort-dragging { opacity: 0; }
:global(.drag-preview) { position: fixed !important; z-index: 10000; margin: 0 !important; pointer-events: none !important; opacity: .72; mix-blend-mode: multiply; box-shadow: none !important; background: transparent !important; overflow: hidden; user-select: none; }
.item-box { position: relative; }
.item-remove { position: absolute; top: -8px; right: -8px; width: 19px; height: 19px; padding: 0; border: 0; border-radius: 50%; background: #b45d5d; color: white; cursor: pointer; font-size: 15px; line-height: 19px; }
.add-structure, .faq-editor__add, .child-add, .note-actions .note-add { display: inline-grid; place-items: center; padding: 0; border: 1px solid #58a869; border-radius: 10px; background: #58a869; cursor: pointer; }
.add-structure:hover, .faq-editor__add:hover, .child-add:hover, .note-actions .note-add:hover { background: #4c985c; border-color: #4c985c; }
.add-structure img, .faq-editor__add img, .child-add img, .note-actions .note-add img { display: block; width: 27px; height: 27px; }
.add-structure { flex: 0 0 52px; width: 52px; height: 52px; }
.save-button { min-width: 92px; padding: 9px 20px; border: 0; border-radius: 8px; background: #2e7d32; color: #fff; font-size: 15px; cursor: pointer; }
.save-button:disabled { opacity: .5; cursor: default; }
.status { text-align: center; color: #687b70; padding: 48px; }
.section-card { background: #fff; border: 1px solid #e3e8e4; border-radius: 16px; padding: 20px; margin-bottom: 18px; box-shadow: 0 2px 5px #1c382012; }
.section-list--compact { margin-bottom: 18px; }
.section-list--compact .section-card { box-sizing: border-box; width: 50%; min-width: 0; padding: 14px 16px; }
.section-list--compact .section-header { margin: 0; padding: 0; border: 0; }
.section-header { display: flex; align-items: center; gap: 10px; min-height: 34px; padding-bottom: 10px; margin-bottom: 16px; border-bottom: 2px solid #e8eae9; }
.section-name { margin: 0; flex: 1; color: #34495e; font-size: 19px; font-weight: 700; letter-spacing: 1px; user-select: none; }
.name-inline { display: inline-flex; align-items: center; justify-content: flex-start; flex: 0 1 auto; flex-wrap: wrap; gap: 4px; min-width: 0; max-width: 100%; margin-right: auto; cursor: default; touch-action: auto; }
.name-inline > :first-child { flex: 0 1 auto; min-width: 0; }
.section-name-inline { font-size: 16px; }
.row-name-inline { font-size: 18px; }
.name-inline :deep(.lab-editor--small) { gap: 6px; }
.name-inline :deep(.lab-editor--small .lab-field input) { height: 30px; }
.name-inline :deep(.lab-tools__inline) { gap: 4px; }
.name-inline :deep(.lab-action) { width: 30px; height: 30px; padding: 6px; border-radius: 6px; }
.name-inline :deep(.lab-action svg), .name-inline :deep(.lab-action img) { width: 16px; height: 16px; }
.name-inline-actions { display: inline-flex; gap: 2px; flex: 0 0 auto; }
.name-inline-actions button, .line-actions .name-inline-actions button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #326d3b; cursor: pointer; font-size: 19px; line-height: 1; }
.name-inline-actions button:hover { background: #edf6ef; }
.name-inline-actions button:last-child { color: #9b4d4d; }
.name-inline-actions img { display: block; width: 16px; height: 16px; }
.row-name { color: #34495e; font-size: 20px; font-weight: 650; line-height: 1.3; cursor: text; border-bottom: 1px dashed transparent; }
.pinyin-line.editable-level .row-name:hover, .section-card.editable-level .section-name:hover { border-bottom-color: #8fba97; }
.remove-button { border: 0; background: transparent; color: #b45d5d; cursor: pointer; padding: 4px 6px; }
.pinyin-line { border: 1px solid #dde8df; border-radius: 12px; padding: 12px; margin-bottom: 12px; background: #fcfefc; }
.line-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; color: #657e69; font-size: 13px; }
.line-actions button { border: 0; background: transparent; color: #397447; cursor: pointer; padding: 4px; }
.line-actions .name-inline-actions button { padding: 0; }
.line-actions .name-inline-actions button:hover { background: #edf6ef; }
.line-actions .remove-button { margin-left: auto; color: #b45d5d !important; }
.line-groups { display: flex; flex-wrap: wrap; align-items: center; gap: 30px; min-height: 52px; }
.line-groups-inner { display: flex; flex: 1 1 100%; flex-wrap: wrap; align-items: center; gap: 30px; min-width: 100px; min-height: 42px; }
.group-end-drop { flex: 1 0 44px; min-height: 52px; }
.pinyin-group { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; padding: 5px; border: 1px solid transparent; border-radius: 9px; }
.pinyin-group > .add-structure { margin-left: 24px; }
.pinyin-group.editable-level { border-color: #cee1d2; background: #f7fbf8; }
.pinyin-group.editable-level:hover { border-color: #94bea0; box-shadow: 0 2px 7px #294b2d14; }
.empty-group { width: 76px; height: 52px; border: 1px dashed #cbd8ce; border-radius: 10px; background: #f7faf7; color: #7b9280; cursor: pointer; }
.items-grid { display: grid; grid-auto-flow: column; grid-auto-columns: 76px; gap: 6px; }
.item-box { box-sizing: border-box; height: 52px; display: flex; align-items: center; justify-content: center; padding: 6px; background: linear-gradient(#fff, #f2f9f0); border: 1.5px solid #d6e6d2; border-radius: 10px; color: #333; font-family: Georgia, serif; font-size: 25px; }
.item-box.invalid { background: #f0f2f4; border: 1px dashed #d3d9df; }
.faq-editor { margin-top: 28px; }
.faq-editor__header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.faq-editor__header h2 { margin: 0; color: #34495e; font-size: 22px; }
.faq-editor__add { width: 58px; height: 58px; }
.faq-editor__entry { display: grid; grid-template-columns: 58px minmax(0, 1fr); margin-top: 10px; border: 1px solid #e2eae3; border-radius: 10px; background: #fff; }
.faq-editor__entry:hover { border-color: #b9d0bd; background: #fbfdfb; }
.faq-editor__handle { width: 58px; border-right: 1px solid #e5ece6; }
.sort-handle { display: grid; place-items: center; align-self: stretch; border: 0; background: transparent; color: #788d7d; cursor: grab; touch-action: none; }
.sort-handle svg { width: 22px; height: 30px; fill: currentColor; }
.sort-handle:active { cursor: grabbing; }
.sort-handle:focus-visible { outline: 2px solid #2e7d32; outline-offset: -3px; }
.faq-editor__content { position: relative; min-width: 0; padding: 8px 18px; }
.faq-editor__actions { position: absolute; top: 50%; right: 14px; display: flex; align-items: center; gap: 4px; transform: translateY(-50%); }
.faq-editor__toggle { min-width: 48px; height: 36px; padding: 0 7px; border: 0; border-radius: 8px; background: transparent; color: #326d3b; cursor: pointer; }
.faq-editor__toggle:hover { background: #edf6ef; }
.faq-editor__remove { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: #b45d5d; cursor: pointer; }
.faq-editor__remove:hover { background: #fff1f1; }
.faq-editor__remove svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.faq-editor__field + .faq-editor__field { margin-top: 22px; padding-top: 18px; border-top: 1px solid #e5ece6; }
.faq-editor__field h3 { margin: 0 44px 10px 0; color: #34495e; font-size: 16px; }
.faq-editor__field :deep(.lab-editor) { box-shadow: none; }
.faq-editor__field :deep(.lab-editor--middle) { padding: 0; border: 0; border-radius: 0; }
.faq-editor__field :deep(.lab-editor--small-sentence) { width: 100%; }
.faq-editor__preview { display: grid; gap: 3px; padding-right: 100px; cursor: pointer; }
.faq-editor__preview:focus-visible { outline: 2px solid #2e7d32; outline-offset: 2px; }
.faq-editor__preview-row { display: flex; align-items: flex-start; gap: 8px; min-width: 0; font-size: 14px; line-height: 1.5; }
.faq-editor__preview-label { flex: 0 0 40px; color: #64796a; font-weight: 650; }
.faq-editor__preview-text { display: block; flex: 1 1 0; min-width: 0; overflow-wrap: anywhere; }
.faq-modal .faq-editor__field { margin-top: 20px; }
.modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: #15281a80; }
.item-modal { box-sizing: border-box; width: min(1080px, 100%); max-height: min(90vh, 900px); overflow: auto; border-radius: 16px; background: white; padding: 28px; box-shadow: 0 18px 50px #1126184d; }
.modal-header, .modal-subheading, .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.modal-header { border-bottom: 1px solid #dfe8e1; padding-bottom: 12px; }
.modal-header h2, .modal-subheading h3 { margin: 0; color: #34495e; }
.modal-header button { border: 0; background: transparent; font-size: 25px; cursor: pointer; }
.note-pair label { display: grid; gap: 5px; flex: 1; min-width: 0; color: #607167; font-size: 13px; }
.editable-title { min-width: 80px; cursor: text; border-bottom: 1px dashed transparent; }
.editable-title:hover { border-bottom-color: #8fba97; }
.inline-title-input { flex: 1; min-width: 0; font-size: 21px !important; font-weight: 700; }
.item-modal input, .item-modal textarea { box-sizing: border-box; width: 100%; border: 1px solid #cbd8ce; border-radius: 7px; padding: 8px 10px; color: #2a3a30; font-family: inherit; font-size: 15px; user-select: text; -webkit-user-select: text; }
.item-modal textarea { resize: vertical; }
.modal-subheading { margin: 20px 0 10px; }
.modal-subheading button, .modal-footer button { border: 1px solid #b7d1bc; border-radius: 7px; background: #f5faf5; color: #326d3b; padding: 7px 11px; cursor: pointer; }
.unplaced-panel { margin: 0 0 18px; padding: 16px; border: 1px dashed #b9cabd; border-radius: 12px; background: #fafcfa; }
.unplaced-panel .modal-subheading { margin: 0 0 12px; }
.unplaced-panel h2 { margin: 0; font-size: 18px; }
.unplaced-list { display: flex; flex-wrap: wrap; gap: 8px; max-height: 220px; overflow: auto; }
.unplaced-child { display: grid; gap: 4px; min-width: 145px; max-width: 240px; padding: 9px 11px; border: 1px solid #d6e1d8; border-radius: 8px; background: #fff; cursor: grab; touch-action: none; font-size: 13px; }
.unplaced-child.located-child { border-color: #d49a39; box-shadow: 0 0 0 2px #e0a64055; }
.unplaced-child small { color: #a06336; }
.child-count { position: absolute; bottom: 2px; right: 5px; font: 11px sans-serif; color: #45804d; }
.child-workspace { display: flex; align-items: stretch; gap: 10px; margin-top: 16px; }
.child-list { position: relative; display: flex; flex: 1; gap: 10px; min-width: 0; overflow-x: auto; padding: 10px; border: 1px dashed #c6d7ca; border-radius: 12px; background: #fbfdfb; min-height: 52px; }
.child-add { flex: 0 0 64px; }
.child-list-row { position: relative; display: flex; flex: 0 0 92px; align-items: center; box-sizing: border-box; height: 52px; border: 1px solid #d4ded6; border-radius: 10px; background: white; cursor: grab; touch-action: none; }
.child-list-row.active { border-color: #2e7d32; background: #e5f3e7; }
.child-list-row > button:not(.item-remove) { display: grid; flex: 1; min-width: 0; gap: 2px; border: 0; background: transparent; padding: 14px 9px 8px; text-align: center; cursor: pointer; }
.child-list-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 19px; line-height: 1.25; }
.child-edit-icon { position: absolute; top: 4px; left: 5px; width: 14px; height: 14px; color: #2e7d32; pointer-events: none; }
.child-remove svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.item-modal .child-title-input { width: calc(100% - 12px); margin: 0 6px; padding: 3px 5px; font-size: 18px; text-align: center; }
.child-list-row small { color: #708077; }
.empty-hint { color: #819187; padding: 8px 0; }
.selected-child-editor { margin-top: 18px; padding-top: 20px; border-top: 2px solid #c8dccb; }
.note-list { display: grid; gap: 9px; }
.note-pair { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border: 1px solid #e0e9e2; border-radius: 9px; background: white; }
.note-pair:hover { border-color: #aacbb0; }
.note-handle { flex: 0 0 32px; }
.note-fields { display: grid; grid-template-columns: minmax(110px, 160px) minmax(0, 1fr); align-items: center; flex: 1; gap: 10px; }
.note-actions { display: flex; gap: 8px; margin-top: 14px; }
.note-actions .note-add { width: 68px; height: 68px; }
.note-remove { display: grid; place-items: center; flex: 0 0 38px; height: 38px; border: 0; border-radius: 8px; background: transparent; color: #b45d5d; cursor: pointer; }
.note-remove:hover { background: #fff1f1; }
.note-remove svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.modal-footer { border-top: 1px solid #e0e9e2; margin-top: 20px; padding-top: 14px; color: #748477; font-size: 13px; }
.label-backdrop { z-index: 1001; }
.label-modal { width: min(640px, 100%); }
.label-entry { padding: 10px 0; border-bottom: 1px solid #e4ebe5; }
.label-row { display: flex; align-items: center; gap: 10px; }
.label-row > :first-child { flex: 1; min-width: 0; }
.usage-count { white-space: nowrap; color: #607167; font-size: 12px; }
.duplicate-mark { border-radius: 5px; background: #fff2dc; color: #9a6522; padding: 4px 6px; font-size: 12px; }
.label-usages { margin-top: 8px; color: #607167; font-size: 13px; }
.label-usages summary { cursor: pointer; }
.label-usages > div { display: grid; gap: 5px; max-height: 160px; overflow: auto; margin-top: 7px; }
.label-usages button { width: 100%; border: 1px solid #dce7de; border-radius: 6px; background: #fbfdfb; padding: 6px 8px; text-align: left; cursor: pointer; }
.merge-row { display: flex; gap: 8px; margin-top: 8px; }
.merge-row select { flex: 1; min-width: 0; border: 1px solid #cbd8ce; border-radius: 6px; background: white; padding: 6px 8px; }
.merge-row button { border: 1px solid #b7d1bc; border-radius: 6px; background: #f5faf5; color: #326d3b; padding: 6px 9px; cursor: pointer; }
.note-fields select { width: 100%; padding: 8px 10px; border: 1px solid #cbd8ce; border-radius: 7px; background: #fff; color: #2a3a30; font-size: 15px; }
.note-fields > div { color: #607167; font-size: 13px; }
.note-fields :deep(.sc-tc-group) { min-width: 0; }
.note-fields :deep(.sc-tc-fields) { flex-direction: column; gap: 6px; }
.note-fields :deep(.sc-tc-input--middle) { box-sizing: border-box; width: 100%; max-width: none; flex: none; }
.pair-repair { display: grid; gap: 7px; color: #a06336; font-size: 13px; }
@media (max-width: 700px) { .note-pair { flex-wrap: wrap; } .note-fields { grid-template-columns: 1fr; } }
@media (max-width: 700px) { .faq-editor__entry { grid-template-columns: 42px minmax(0, 1fr); } .faq-editor__handle { width: 42px; } .faq-editor__content { padding: 16px 12px; } }
@media (max-width: 700px) { .pinyin-section-editor { padding: 14px 10px 40px; } .section-list--compact .section-card { width: 100%; } .section-card { padding: 14px; } .pinyin-line { gap: 14px; } .items-grid { grid-auto-columns: 56px; } .item-box { height: 46px; font-size: 21px; } }
</style>
