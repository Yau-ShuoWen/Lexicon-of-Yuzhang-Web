<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {useRoute} from 'vue-router'
import {request} from '../../../services/request.js'
import {showError, showSuccess} from '../../../services/ToastService.js'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'
import {ensureNoteLabels, fromLegacy, getNoteLabelUsages, mergeMissingLegacyChildren, mergeNoteLabel, syncItemKeys} from '../../../utils/pinyinDocument.js'

const route = useRoute()
const dialect = computed(() => route.params.dialect)
const language = computed(() => route.params.language === 'tc' ? 'tc' : 'sc')
const documentData = ref(null)
const loading = ref(true)
const editingId = ref(null)
const editingName = ref({sc: '', tc: ''})
const draggingId = ref(null)
const draggingKind = ref(null)
const dragOverId = ref(null)
const dropListId = ref(null)
const selectedId = ref(null)
const selectedKind = ref(null)
const savedSnapshot = ref('')
const saving = ref(false)
const editLevel = ref('section')
const openedItemId = ref(null)
const openedChildId = ref(null)
const editingItemTitle = ref(false)
const itemTitleDraft = ref('')
const editingChildTitle = ref(false)
const titleInput = ref(null)
const childListRef = ref(null)
const selectedEditorRef = ref(null)
const childConnectorX = ref(28)
const isUnplacedEditor = computed(() => openedItemId.value === '__unplaced__')
const labelsOpen = ref(false)
const mergeTargets = ref({})
const focusedUnplacedId = ref(null)
const repairIds = ref(new Set())
const childDrag = ref(null)
const childDropTarget = ref(null)
const openedItem = computed(() => isUnplacedEditor.value
  ? {id: '__unplaced__', children: documentData.value?.unplaced || []}
  : documentData.value?.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items))).find(item => item.id === openedItemId.value))
const openedChild = computed(() => openedItem.value?.children.find(child => child.id === openedChildId.value))
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
    savedSnapshot.value = JSON.stringify(documentData.value)
    if (legacy) mergeMissingLegacyChildren(documentData.value, legacy)
    ensureNoteLabels(documentData.value)
    const children = [...documentData.value.unplaced, ...documentData.value.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items.flatMap(item => item.children))))]
    repairIds.value = new Set([
      ...documentData.value.noteLabels.filter(label => !sameLength(label.text)).map(label => label.id),
      ...children.flatMap(child => child.notes?.filter(note => !sameLength(note.value)).map(note => note.id) || [])
    ])
  } catch (error) {
    showError(error.message)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (editingId.value) {
    if (!finishName()) return
  }
  try {
    syncItemKeys(documentData.value)
    const names = new Set()
    for (const label of documentData.value.noteLabels) {
      if (!label.text.sc?.trim() || !label.text.tc?.trim() || !sameLength(label.text)) throw new Error('解释名称需要填写等长的简体和繁体')
      const name = JSON.stringify(label.text)
      if (names.has(name)) throw new Error('解释名称重复，请更换使用它的解释后删除重复名称')
      names.add(name)
    }
    const children = [...documentData.value.unplaced, ...documentData.value.sections.flatMap(section => section.rows.flatMap(row => row.groups.flatMap(group => group.items.flatMap(item => item.children))))]
    if (children.some(child => child.notes?.some(note => !sameLength(note.value)))) throw new Error('解释内容的简繁长度不同，请先核对')
  } catch (error) { showError(error.message); return }
  if (!hasChanges.value || saving.value) return
  const body = JSON.stringify(documentData.value)
  const targetDialect = dialect.value
  saving.value = true
  try {
    await request(`/api/edit/pinyin/document/${targetDialect}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body
    })
    savedSnapshot.value = body
    showSuccess('已保存')
  } catch (error) {
    showError(error.message)
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
  openedChildId.value = null
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
  nextTick(updateChildConnector)
}

function closeItem() {
  openedItemId.value = null
  openedChildId.value = null
  editingItemTitle.value = false
  editingChildTitle.value = false
}

async function editTitle(kind) {
  if (kind === 'item') {
    itemTitleDraft.value = openedItem.value.standard === '-' ? '（占位）' : openedItem.value.standard
    editingItemTitle.value = true
  } else editingChildTitle.value = true
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
  openedChildId.value = child.id
  editingChildTitle.value = false
  nextTick(updateChildConnector)
}

function updateChildConnector() {
  const child = Array.from(childListRef.value?.querySelectorAll('[data-child-id]') || [])
    .find(element => element.dataset.childId === openedChildId.value)
  if (!child || !selectedEditorRef.value) return
  const source = child.getBoundingClientRect()
  const target = selectedEditorRef.value.getBoundingClientRect()
  childConnectorX.value = Math.max(18, Math.min(target.width - 18, source.left + source.width / 2 - target.left))
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
  nextTick(updateChildConnector)
}

function startChildDrag(event, fromList, child) {
  childDrag.value = {fromList, id: child.id}
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', child.id)
}

function dropChild(event, toList, index = toList.length, targetId = null) {
  event.preventDefault()
  event.stopPropagation()
  const drag = childDrag.value
  if (!drag) return
  const fromIndex = drag.fromList.findIndex(child => child.id === drag.id)
  if (fromIndex < 0) return
  const [child] = drag.fromList.splice(fromIndex, 1)
  const destination = drag.fromList === toList && fromIndex < index ? index - 1 : index
  toList.splice(Math.max(0, destination), 0, child)
  childDrag.value = null
  childDropTarget.value = null
  if (openedItem.value) openedChildId.value = toList === openedItem.value.children ? child.id : openedItem.value.children[0]?.id || null
  if (targetId) selectedId.value = targetId
  nextTick(updateChildConnector)
}

function dropOnChild(event, list, index) {
  const rect = event.currentTarget.getBoundingClientRect()
  dropChild(event, list, index + Number(event.clientY >= rect.top + rect.height / 2))
}

function endChildDrag() {
  childDrag.value = null
  childDropTarget.value = null
}

function removeChild(child) {
  if (!window.confirm('确定删除这个子项及其解释吗？')) return
  openedItem.value.children.splice(openedItem.value.children.indexOf(child), 1)
  openedChildId.value = openedItem.value.children[0]?.id || null
  nextTick(updateChildConnector)
}

function addNote() {
  if (!documentData.value.noteLabels.length) addLabel()
  const label = documentData.value.noteLabels[0]
  openedChild.value.notes.push({id: crypto.randomUUID(), labelId: label.id, label: label.text, value: {sc: '', tc: ''}})
}

function addLabel() {
  documentData.value.noteLabels.push({id: crypto.randomUUID(), text: {sc: '', tc: ''}})
  labelsOpen.value = true
}

function sameLength(pair) {
  return Array.from(pair?.sc || '').length === Array.from(pair?.tc || '').length
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

function selectLevel(level) {
  if (editingId.value) finishName()
  closeItem()
  editLevel.value = level
  selectedId.value = null
  selectedKind.value = null
  pointerCancel()
}

function removeGroup(row, group) {
  if (group.items.length) return
  row.groups.splice(row.groups.indexOf(group), 1)
}

function editName(target) {
  if (draggingId.value) return
  editingId.value = target.id
  editingName.value = {...(target.name || {sc: '', tc: ''})}
}

function finishName(cancel = false) {
  const target = documentData.value.sections.flatMap(section => [section, ...section.rows])
    .find(entry => entry.id === editingId.value)
  if (!target) return false
  if (!cancel && (!editingName.value.sc.trim() || !editingName.value.tc.trim())) {
    showError('请填写简体和繁体标题')
    return false
  }
  if (!cancel) target.name = {sc: editingName.value.sc.trim(), tc: editingName.value.tc.trim()}
  editingId.value = null
  return true
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
  press = {kind, list, id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, element: event.currentTarget}
  selectedId.value = id
  selectedKind.value = kind
  window.addEventListener('pointermove', pointerMove)
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('pointercancel', pointerCancel)
}

function pointerMove(event) {
  if (!press || event.pointerId !== press.pointerId) return
  if (!draggingId.value) {
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return
    draggingId.value = press.id
    draggingKind.value = press.kind
    window.getSelection()?.removeAllRanges()
    const rect = press.element.getBoundingClientRect()
    dragPreview = press.element.cloneNode(true)
    dragPreview.removeAttribute('id')
    dragPreview.classList.remove('sort-dragging', 'sort-selected', 'drop-target')
    dragPreview.classList.add('drag-preview')
    Object.assign(dragPreview.style, {width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`})
    window.document.body.appendChild(dragPreview)
    press.offsetX = event.clientX - rect.left
    press.offsetY = event.clientY - rect.top
  }
  dragPreview.style.left = `${event.clientX - press.offsetX}px`
  dragPreview.style.top = `${event.clientY - press.offsetY}px`
  const target = window.document.elementFromPoint(event.clientX, event.clientY)
    ?.closest(`[data-sort-kind="${press.kind}"]`)
  const id = target?.dataset.sortId
  dragOverId.value = id && id !== press.id ? id : null
  const listTarget = window.document.elementFromPoint(event.clientX, event.clientY)
    ?.closest(`[data-drop-list-kind="${press.kind}"]`)
  dropListId.value = listTarget?.dataset.dropListId || null
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
  if (draggingId.value && (dragOverId.value || dropListId.value)) {
    const source = press.list.findIndex(item => item.id === press.id)
    const targetList = dragOverId.value ? sortList(press.kind, dragOverId.value) : destinationList(press.kind, dropListId.value)
    if (source >= 0 && targetList) {
      const targetIndex = dragOverId.value ? targetList.findIndex(item => item.id === dragOverId.value) : targetList.length
      const [moved] = press.list.splice(source, 1)
      const destination = targetList === press.list && source < targetIndex ? targetIndex - 1 : targetIndex
      targetList.splice(Math.max(0, destination), 0, moved)
    }
  }
  removePointerListeners()
  removeDragPreview()
  press = null
  draggingId.value = null
  draggingKind.value = null
  dragOverId.value = null
  dropListId.value = null
}

function pointerCancel() {
  removePointerListeners()
  removeDragPreview()
  press = null
  draggingId.value = null
  draggingKind.value = null
  dragOverId.value = null
  dropListId.value = null
}

function removePointerListeners() {
  window.removeEventListener('pointermove', pointerMove)
  window.removeEventListener('pointerup', pointerUp)
  window.removeEventListener('pointercancel', pointerCancel)
}

watch(dialect, load)
onMounted(load)
onUnmounted(pointerCancel)
</script>

<template>
  <main class="pinyin-section-editor">
    <div v-if="loading" class="status">正在加载拼音表…</div>
    <template v-else-if="documentData">
      <div class="editor-actions">
        <div class="level-picker" role="group" aria-label="选择编辑层级">
          <button v-for="level in [{key:'section', label:'区'}, {key:'row', label:'行'}, {key:'group', label:'组'}, {key:'item', label:'单'}]"
                  :key="level.key" type="button" :class="{active: editLevel === level.key}"
                  :aria-pressed="editLevel === level.key" @click="selectLevel(level.key)">{{ level.label }}</button>
        </div>
        <button class="manage-labels-button" type="button" @click="labelsOpen = true">管理解释名称</button>
        <button class="save-button" type="button" :disabled="saving || (!hasChanges && !editingId)" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
      <p class="editor-hint">
        <template v-if="editLevel === 'section'">拖动区域可排序，双击标题可编辑。为便于排序，下层内容已折叠；切换到行、组或单可查看和编辑。</template>
        <template v-else-if="editLevel === 'row'">拖动行可跨区域排序，双击标题可编辑。</template>
        <template v-else-if="editLevel === 'group'">拖动组可跨行排序。</template>
        <template v-else>拖动单格可跨组排序，双击单格可编辑文本。</template>
      </p>
      <section v-if="editLevel === 'item'" class="unplaced-panel"
               @dragover.prevent
               @drop="dropChild($event, documentData.unplaced)">
        <div class="modal-subheading"><h2>未归类子项 <small>{{ documentData.unplaced.length }}</small></h2></div>
        <div class="unplaced-list">
          <div v-for="child in documentData.unplaced" :key="child.id" class="unplaced-child" :data-unplaced-id="child.id"
               :class="{'located-child': focusedUnplacedId === child.id}" draggable="true"
               @dragstart="startChildDrag($event, documentData.unplaced, child)" @dragend="endChildDrag" @dblclick="openUnplacedChild(child)">
            <strong>{{ child.title || '未填写标题' }}</strong>
            <small>{{ unplacedReason(child) }}</small>
          </div>
          <p v-if="!documentData.unplaced.length" class="empty-hint">没有未归类子项</p>
        </div>
      </section>
      <div>
      <section
        v-for="(section, sectionIndex) in documentData.sections"
        :key="section.id"
        :data-section-id="section.id"
        data-sort-kind="section"
        :data-sort-id="section.id"
        class="section-card"
        :class="[`accent-${sectionIndex % 3}`, {'editable-level': editLevel === 'section', 'sort-selected': selectedKind === 'section' && selectedId === section.id, 'sort-dragging': draggingKind === 'section' && draggingId === section.id, 'drop-target': dragOverId === section.id}]"
        @pointerdown="editLevel === 'section' && pointerDown($event, 'section', documentData.sections, section.id)"
      >
        <header class="section-header">
          <span v-if="editLevel === 'section'" class="sort-handle" aria-hidden="true" />
          <h3
            class="section-name"
            @dblclick.stop="editLevel === 'section' && editName(section)"
          >{{ sectionName(section) }}</h3>
          <button v-if="editLevel === 'section' && isEmpty(section)" class="remove-button" type="button" aria-label="删除空区域" @click="removeSection(section)">删除</button>
        </header>
        <div v-if="editLevel !== 'section'" class="section-content" data-drop-list-kind="line" :data-drop-list-id="section.id"
             :class="{'list-drop-target': draggingKind === 'line' && dropListId === section.id && !dragOverId}">
          <div>
          <div
            v-for="row in section.rows"
            :key="row.id"
            class="pinyin-line"
            data-sort-kind="line"
            :data-sort-id="row.id"
            :class="{'editable-level': editLevel === 'row', 'sort-selected': selectedKind === 'line' && selectedId === row.id, 'sort-dragging': draggingKind === 'line' && draggingId === row.id, 'drop-target': dragOverId === row.id}"
            @pointerdown="editLevel === 'row' && pointerDown($event, 'line', section.rows, row.id)"
          >
            <div class="line-actions">
              <span v-if="editLevel === 'row'" class="structure-handle" aria-hidden="true">⋮⋮</span>
              <span class="row-name" @dblclick.stop="editLevel === 'row' && editName(row)">{{ rowName(row) }}</span>
              <button v-if="editLevel === 'group'" type="button" @click="addGroup(row)">＋ 添加组</button>
              <button v-if="editLevel === 'row' && rowEmpty(row)" type="button" class="remove-button" @click="removeRow(section, row)">删除空行</button>
            </div>
            <div class="line-groups">
              <div class="line-groups-inner" data-drop-list-kind="group" :data-drop-list-id="row.id"
                   :class="{'list-drop-target': draggingKind === 'group' && dropListId === row.id && !dragOverId}">
              <div
                v-for="group in row.groups"
                :key="group.id"
                class="pinyin-group"
                data-sort-kind="group"
                :data-sort-id="group.id"
                data-drop-list-kind="item"
                :data-drop-list-id="group.id"
                :class="{'editable-level': editLevel === 'group', 'sort-selected': selectedKind === 'group' && selectedId === group.id, 'sort-dragging': draggingKind === 'group' && draggingId === group.id, 'drop-target': dragOverId === group.id, 'list-drop-target': draggingKind === 'item' && dropListId === group.id && !dragOverId}"
                @pointerdown="editLevel === 'group' && pointerDown($event, 'group', row.groups, group.id)"
              >
                <span v-if="editLevel === 'group'" class="group-handle" aria-hidden="true">⋮</span>
                <div v-if="group.items.length" class="items-grid">
                  <div v-for="item in group.items" :key="item.id" class="item-box" data-sort-kind="item" :data-sort-id="item.id"
                       :class="{'invalid': item.standard === '-', 'editable-level': editLevel === 'item', 'sort-selected': selectedKind === 'item' && selectedId === item.id, 'sort-dragging': draggingKind === 'item' && draggingId === item.id, 'drop-target': dragOverId === item.id, 'child-drop-target': childDropTarget === item.id}"
                       @pointerdown="editLevel === 'item' && pointerDown($event, 'item', group.items, item.id)"
                       @dragover.prevent="childDropTarget = item.id" @dragleave="childDropTarget = null"
                       @drop="dropChild($event, item.children, item.children.length, item.id)"
                       @dblclick="openItem(item)">
                    <span v-if="item.standard !== '-'" v-formatted-text="` [${item.standard}] `" />
                    <small v-if="editLevel === 'item' && item.children.length" class="child-count">{{ item.children.length }}</small>
                    <button v-if="editLevel === 'item' && !item.children?.length" class="item-remove" type="button" aria-label="删除单格" @click.stop="removeItem(group, item)">×</button>
                  </div>
                </div>
                <button v-else-if="editLevel === 'group'" class="empty-group" type="button" @click="removeGroup(row, group)">空组 · 删除</button>
                <div v-else class="empty-group">空组</div>
                <button v-if="editLevel === 'item'" class="add-item" type="button" @click="addItem(group)">＋</button>
              </div>
              </div>
            </div>
          </div>
          </div>
          <button v-if="editLevel === 'row'" class="add-line" type="button" @click="addRow(section)">＋ 添加行</button>
        </div>
      </section>
      </div>
      <button v-if="editLevel === 'section'" class="add-section" type="button" @click="addSection">＋ 添加区域</button>
      <div v-if="editingId" class="modal-backdrop name-backdrop" @pointerdown.self="finishName(true)">
        <section class="item-modal name-modal" role="dialog" aria-modal="true" aria-label="编辑标题">
          <header class="modal-header"><h2>编辑标题</h2><button type="button" aria-label="关闭" @click="finishName(true)">×</button></header>
          <ScAndTcText v-model:traditional-text="editingName.tc" v-model:simplified-text="editingName.sc"
                       :dialect="dialect" layout="middle" />
          <footer class="modal-footer"><button type="button" @click="finishName()">完成</button></footer>
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
          <div class="modal-subheading"><h3>子项</h3><button v-if="!isUnplacedEditor" type="button" @click="addChild">＋ 添加子项</button></div>
          <div class="child-workspace" :class="{'unplaced-workspace': isUnplacedEditor}">
            <div ref="childListRef" class="child-list" :class="{'child-drop-target': childDropTarget === 'opened'}"
                 @dragover.prevent="childDropTarget = 'opened'" @drop="dropChild($event, openedItem.children)" @scroll="updateChildConnector">
              <div v-for="(child, index) in openedItem.children" :key="child.id" class="child-list-row" :data-child-id="child.id"
                   :class="{active: openedChildId === child.id, 'child-drop-target': childDropTarget === child.id}" draggable="true"
                   @dragstart="startChildDrag($event, openedItem.children, child)" @dragend="endChildDrag"
                   @dragover.prevent.stop="childDropTarget = child.id" @drop="dropOnChild($event, openedItem.children, index)">
                <span class="child-grip" aria-hidden="true">⋮⋮</span>
                <button type="button" @click="selectChild(child)">
                  <strong>{{ child.title || '未填写标题' }}</strong>
                </button>
              </div>
              <span v-if="!openedItem.children.length" class="empty-hint">暂无子项</span>
            </div>
            <div v-if="!isUnplacedEditor" class="overflow-drop" :class="{'child-drop-target': childDropTarget === 'modal-unplaced'}"
                 aria-label="拖到这里移出格子" @dragover.prevent="childDropTarget = 'modal-unplaced'"
                 @drop="dropChild($event, documentData.unplaced)">→</div>
          </div>
          <section v-if="openedChild" :key="openedChild.id" ref="selectedEditorRef" class="selected-child-editor"
                   :style="{'--connector-x': `${childConnectorX}px`}">
            <div class="selected-child-header">
              <input v-if="editingChildTitle" ref="titleInput" v-model="openedChild.title" class="inline-title-input"
                     aria-label="子项标题" @blur="editingChildTitle = false" @keydown.enter.prevent="editingChildTitle = false">
              <h3 v-else class="editable-title" @dblclick="editTitle('child')">{{ openedChild.title || '未填写标题' }}</h3>
              <button class="remove-button" type="button" @click="removeChild(openedChild)">删除子项</button>
            </div>
            <div class="modal-subheading">
              <h3>解释</h3>
              <button type="button" @click="labelsOpen = true">管理名称</button>
            </div>
            <div class="note-list">
              <div v-for="(note, index) in openedChild.notes" :key="note.id" class="note-pair" :data-note-id="note.id">
                <span class="note-number">{{ index + 1 }}</span>
                <div class="note-fields">
                  <label>
                    <select :value="note.labelId" @change="selectLabel(note, $event.target.value)">
                      <option v-for="label in documentData.noteLabels" :key="label.id" :value="label.id">{{ label.text[language] || label.text.sc || '未命名' }}</option>
                    </select>
                  </label>
                  <div>
                    <ScAndTcText v-if="!repairIds.has(note.id)" :key="note.id" v-model:traditional-text="note.value.tc"
                                 v-model:simplified-text="note.value.sc" :dialect="dialect" layout="middle" />
                    <div v-else class="pair-repair"><span>旧数据的简繁长度不同，请先核对：</span>
                      <textarea v-model="note.value.sc" rows="2" aria-label="简体内容"></textarea>
                      <textarea v-model="note.value.tc" rows="2" aria-label="繁体内容"></textarea>
                      <button type="button" @click="finishPairRepair(note.id, note.value)">完成核对</button>
                    </div>
                  </div>
                </div>
                <button type="button" class="remove-button" aria-label="删除这一行解释" @click="openedChild.notes.splice(index, 1)">删除</button>
              </div>
            </div>
            <div class="note-actions">
              <button type="button" @click="addNote">＋ 添加一行</button>
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
              <ScAndTcText v-if="!repairIds.has(label.id)" v-model:traditional-text="label.text.tc"
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
.level-picker { display: inline-flex; gap: 3px; padding: 4px; border: 1px solid #d7e5da; border-radius: 10px; background: #f4f7f4; }
.level-picker button { min-width: 43px; padding: 6px 10px; border: 0; border-radius: 7px; background: transparent; color: #68776c; cursor: pointer; }
.level-picker button.active { background: #2e7d32; color: white; font-weight: 700; box-shadow: 0 1px 4px #1c382033; }
.manage-labels-button { margin-left: auto; border: 1px solid #b7d1bc; border-radius: 7px; background: #fff; color: #326d3b; padding: 8px 12px; cursor: pointer; }
.section-card.editable-level { border-color: #8fba97; box-shadow: 0 0 0 2px #2e7d321a; }
.pinyin-line.editable-level, .pinyin-group.editable-level, .item-box.editable-level { border-color: #75ad80; background: #f3faf4; box-shadow: 0 0 0 2px #2e7d3218; }
.section-card.editable-level .section-name, .item-box.editable-level { cursor: text; }
.pinyin-section-editor, .pinyin-section-editor *:not(input):not(textarea) { user-select: none; -webkit-user-select: none; }
.section-card.editable-level, .pinyin-line.editable-level, .pinyin-group.editable-level, .item-box.editable-level { touch-action: none; cursor: grab; }
.sort-selected { box-shadow: 0 0 0 3px #e0a640 !important; }
.sort-dragging { opacity: .28; }
.drop-target { box-shadow: 0 0 0 3px #8bc6e4 !important; background-color: #f1f9fd !important; }
:global(.drag-preview) { position: fixed !important; z-index: 10000; margin: 0 !important; pointer-events: none !important; opacity: .78; box-shadow: 0 8px 20px #263b2933 !important; background: white !important; overflow: hidden; user-select: none; }
.item-box { position: relative; }
.item-remove { position: absolute; top: -8px; right: -8px; width: 19px; height: 19px; padding: 0; border: 0; border-radius: 50%; background: #b45d5d; color: white; cursor: pointer; font-size: 15px; line-height: 19px; }
.add-item { height: 35px; border: 1px dashed #75ad80; border-radius: 7px; background: white; color: #397447; cursor: pointer; }
.save-button { min-width: 92px; padding: 9px 20px; border: 0; border-radius: 8px; background: #2e7d32; color: #fff; font-size: 15px; cursor: pointer; }
.save-button:disabled { opacity: .5; cursor: default; }
.status { text-align: center; color: #687b70; padding: 48px; }
.section-card { background: #fff; border: 1px solid #e3e8e4; border-radius: 16px; padding: 20px; margin-bottom: 18px; box-shadow: 0 2px 5px #1c382012; }
.section-card.drop-target { outline: 3px solid #85b98d; outline-offset: 3px; }
.section-header { display: flex; align-items: center; gap: 10px; min-height: 34px; padding-bottom: 10px; margin-bottom: 16px; border-bottom: 2px solid #e8eae9; }
.sort-handle { box-sizing: border-box; width: 12px; height: 28px; flex: 0 0 12px; display: grid; place-items: center; padding: 0; border: 0; background: transparent; cursor: grab; touch-action: none; }
.sort-handle::before { content: ''; width: 6px; height: 22px; border-radius: 4px; background: #2e7d32; box-shadow: 0 2px 6px #2e7d324d; }
.accent-1 .sort-handle::before { background: #4a6fc8; box-shadow: 0 2px 6px #4a6fc84d; }
.accent-2 .sort-handle::before { background: #f36048; box-shadow: 0 2px 6px #f360484d; }
.sort-handle.held { cursor: grabbing; }
.section-name { margin: 0; flex: 1; color: #34495e; font-size: 19px; font-weight: 700; letter-spacing: 1px; user-select: none; }
.row-name { cursor: text; border-bottom: 1px dashed transparent; }
.pinyin-line.editable-level .row-name:hover, .section-card.editable-level .section-name:hover { border-bottom-color: #8fba97; }
.list-drop-target { outline: 2px dashed #8bc6e4; outline-offset: 3px; }
.remove-button { border: 0; background: transparent; color: #b45d5d; cursor: pointer; padding: 4px 6px; }
.pinyin-line { border: 1px solid #dde8df; border-radius: 12px; padding: 12px; margin-bottom: 12px; background: #fcfefc; }
.pinyin-line.drop-target, .pinyin-group.drop-target { outline: 2px solid #85b98d; outline-offset: 2px; }
.line-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; color: #657e69; font-size: 13px; }
.line-actions button:not(.structure-handle) { border: 0; background: transparent; color: #397447; cursor: pointer; padding: 4px; }
.line-actions .remove-button { margin-left: auto; color: #b45d5d !important; }
.structure-handle, .group-handle { border: 0; background: transparent; color: #789b7e; cursor: grab; touch-action: none; user-select: none; font-size: 18px; line-height: 1; }
.structure-handle { width: 26px; height: 26px; }
.line-groups { display: flex; flex-wrap: wrap; align-items: center; gap: 30px; min-height: 52px; }
.line-groups-inner { display: flex; flex-wrap: wrap; align-items: center; gap: 30px; min-width: 100px; min-height: 42px; }
.pinyin-group { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; padding: 5px; border: 1px solid transparent; border-radius: 9px; }
.pinyin-group.editable-level { border-color: #cee1d2; background: #f7fbf8; }
.pinyin-group.editable-level:hover { border-color: #94bea0; box-shadow: 0 2px 7px #294b2d14; }
.group-handle { width: 16px; height: 32px; padding: 0; }
.empty-group { width: 76px; height: 52px; border: 1px dashed #cbd8ce; border-radius: 10px; background: #f7faf7; color: #7b9280; cursor: pointer; }
.add-line { border: 1px dashed #c8ddcb; border-radius: 8px; background: #fff; color: #397447; padding: 8px 14px; cursor: pointer; }
.items-grid { display: grid; grid-auto-flow: column; grid-auto-columns: 76px; gap: 6px; }
.item-box { box-sizing: border-box; height: 52px; display: flex; align-items: center; justify-content: center; padding: 6px; background: linear-gradient(#fff, #f2f9f0); border: 1.5px solid #d6e6d2; border-radius: 10px; color: #333; font-family: Georgia, serif; font-size: 25px; }
.item-box.invalid { background: #f0f2f4; border: 1px dashed #d3d9df; }
.add-section { display: block; width: 100%; min-height: 52px; border: 1px dashed #bad3bc; border-radius: 14px; background: #fff; color: #326d3b; cursor: pointer; font-size: 16px; }
.add-section:hover { background: #f4faf4; }
.modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: #15281a80; }
.item-modal { box-sizing: border-box; width: min(760px, 100%); max-height: min(90vh, 900px); overflow: auto; border-radius: 16px; background: white; padding: 22px; box-shadow: 0 18px 50px #1126184d; }
.name-backdrop { z-index: 1002; }
.name-modal { width: min(600px, 100%); }
.name-modal :deep(.sc-tc-group) { margin-top: 18px; }
.modal-header, .modal-subheading, .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.modal-header { border-bottom: 1px solid #dfe8e1; padding-bottom: 12px; }
.modal-header h2, .modal-subheading h3 { margin: 0; color: #34495e; }
.modal-header button { border: 0; background: transparent; font-size: 25px; cursor: pointer; }
.note-pair label { display: grid; gap: 5px; flex: 1; min-width: 0; color: #607167; font-size: 13px; }
.editable-title { min-width: 80px; cursor: text; border-bottom: 1px dashed transparent; }
.editable-title:hover { border-bottom-color: #8fba97; }
.inline-title-input { flex: 1; min-width: 0; font-size: 21px !important; font-weight: 700; }
.selected-child-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.item-modal input, .item-modal textarea { box-sizing: border-box; width: 100%; border: 1px solid #cbd8ce; border-radius: 7px; padding: 8px 10px; color: #2a3a30; font-family: inherit; font-size: 15px; user-select: text; -webkit-user-select: text; }
.item-modal textarea { resize: vertical; }
.modal-subheading { margin: 20px 0 10px; }
.modal-subheading button, .note-actions button, .modal-footer button { border: 1px solid #b7d1bc; border-radius: 7px; background: #f5faf5; color: #326d3b; padding: 7px 11px; cursor: pointer; }
.unplaced-panel { margin: 0 0 18px; padding: 16px; border: 1px dashed #b9cabd; border-radius: 12px; background: #fafcfa; }
.unplaced-panel .modal-subheading { margin: 0 0 12px; }
.unplaced-panel h2 { margin: 0; font-size: 18px; }
.unplaced-list { display: flex; flex-wrap: wrap; gap: 8px; max-height: 220px; overflow: auto; }
.unplaced-child { display: grid; gap: 4px; min-width: 145px; max-width: 240px; padding: 9px 11px; border: 1px solid #d6e1d8; border-radius: 8px; background: #fff; cursor: grab; font-size: 13px; }
.unplaced-child.located-child { border-color: #d49a39; box-shadow: 0 0 0 2px #e0a64055; }
.unplaced-child small { color: #a06336; }
.child-drop-target { outline: 3px solid #8bc6e4 !important; background: #f1f9fd !important; }
.child-count { position: absolute; bottom: 2px; right: 5px; font: 11px sans-serif; color: #45804d; }
.child-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 52px; gap: 8px; }
.child-workspace.unplaced-workspace { grid-template-columns: 1fr; }
.child-list { display: flex; gap: 7px; overflow-x: auto; padding: 8px; border: 1px dashed #c6d7ca; border-radius: 9px; background: #fbfdfb; min-height: 48px; }
.overflow-drop { display: grid; place-items: center; border: 1px dashed #c6d7ca; border-radius: 9px; background: #fbfdfb; color: #809888; font-size: 25px; }
.child-list-row { display: flex; flex: 0 0 auto; align-items: center; gap: 7px; min-width: 88px; max-width: 180px; border: 1px solid #d4ded6; border-radius: 7px; background: white; cursor: grab; }
.child-list-row.active { border-color: #2e7d32; background: #f2faf3; }
.child-list-row button { display: grid; flex: 1; gap: 2px; border: 0; background: transparent; padding: 8px; text-align: left; cursor: pointer; }
.child-list-row small { color: #708077; }
.child-grip { padding-left: 8px; color: #809888; }
.empty-hint { color: #819187; padding: 8px 0; }
.selected-child-editor { position: relative; margin-top: 14px; padding: 14px; border: 1px solid #cbdcca; border-left: 3px solid #5eaa6b; border-radius: 9px; background: #fcfefc; }
.selected-child-editor::before { content: ''; position: absolute; top: -15px; left: var(--connector-x); height: 14px; border-left: 2px solid #9ac9a2; }
.selected-child-editor h3 { margin: 0; color: #34495e; font-size: 16px; }
.note-list { display: grid; gap: 9px; }
.note-pair { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border: 1px solid #e0e9e2; border-radius: 9px; background: white; }
.note-number { color: #748477; align-self: start; padding-top: 5px; }
.note-fields { display: grid; grid-template-columns: minmax(110px, 160px) minmax(0, 1fr); align-items: center; flex: 1; gap: 10px; }
.note-actions { display: flex; gap: 8px; margin-top: 10px; }
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
@media (max-width: 700px) { .pinyin-section-editor { padding: 14px 10px 40px; } .section-card { padding: 14px; } .pinyin-line { gap: 14px; } .items-grid { grid-auto-columns: 56px; } .item-box { height: 46px; font-size: 21px; } }
</style>
