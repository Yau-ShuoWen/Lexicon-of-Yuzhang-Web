<script setup>
import { computed, onMounted, ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute } from 'vue-router'
import ScTcEditorLab from '../../../components/Text/ScTcEditorLab.vue'
import UnifiedModal from '../../../components/Window/UnifiedModal.vue'
import { Edit, Delete } from '@element-plus/icons-vue'
import saveIcon from '../../../assets/icons/save.svg'
import LoadingIcon from '../../../components/Status/LoadingIcon.vue'
import StudySortList from './StudySortList.vue'
import { getToken } from '../../../utils/auth.js'
import { request } from '../../../services/request.js'
import { showError, showSuccess } from '../../../services/ToastService.js'

const route = useRoute()
const dialect = computed(() => route.params.dialect)
const tabs = [{key: 'part', label: '部分'}, {key: 'chapter', label: '章节'}, {key: 'level', label: '关卡'}]
const tab = ref(tabs.some(item => item.key === route.query.tab) ? route.query.tab : 'part')
const activeTabIndex = computed(() => tabs.findIndex(item => item.key === tab.value))
const parts = ref([])
const chapters = ref([])
const levels = ref([])
const partId = ref(route.query.partId ? Number(route.query.partId) : null)
const editingKey = ref(null)
const editorVisible = ref(false)
const loading = ref(true)
const saving = ref(false)
const snapshot = ref('')
const editors = new Map()
const list = computed(() => tab.value === 'part' ? parts.value : tab.value === 'chapter' ? chapters.value : levels.value)
const editingItem = computed(() => list.value.find(item => keyOf(item) === editingKey.value) || null)
const changed = computed(() => JSON.stringify(comparableList()) !== snapshot.value)
const auth = () => `t=${encodeURIComponent(getToken() || '')}`
const base = () => `/api/study/curriculum/manage/${dialect.value}`
const keyOf = item => item.id || item.localKey

useHead({title: '關卡編輯器'})

function setEditor(key, editor) {
  if (editor) editors.set(key, editor)
  else editors.delete(key)
}

async function syncEditors() {
  for (const editor of editors.values()) {
    if (!await editor.synchronizeForSave()) return false
  }
  return true
}

const text = pair => pair?.sc || pair?.tc || ''
const cleanPair = pair => ({sc: pair?.sc || '', tc: pair?.tc || ''})
const comparableList = () => list.value.map(item => ({
  id: item.id,
  title: cleanPair(item.title),
  description: cleanPair(item.description),
  ...(tab.value === 'level' ? {status: item.status, questionCount: item.questionCount,
    pairCount: item.pairCount, cardIdsText: item.cardIdsText} : {})
}))
const create = async () => {
  if (!await syncEditors()) return
  const common = {id: null, localKey: crypto.randomUUID(), title: {sc: '', tc: ''}, description: {sc: '', tc: ''}}
  if (tab.value === 'part') parts.value.push({...common, partOrder: parts.value.length + 1, deletable: true})
  else if (tab.value === 'chapter') chapters.value.push({...common, chapterOrder: chapters.value.length + 1, deletable: true})
  else levels.value.push({...common, partId: partId.value, levelOrder: levels.value.length + 1,
    questionType: 'match_pair', questionCount: 3, pairCount: 5, cardIdsText: '', status: 0})
  editingKey.value = common.localKey
  editorVisible.value = true
}

function move(from, to) {
  const items = list.value
  items.splice(to, 0, items.splice(from, 1)[0])
}

async function edit(item) {
  editingKey.value = keyOf(item)
  editorVisible.value = true
}

async function loadParts() {
  const data = await request(`${base()}/parts?${auth()}`)
  parts.value = (data || []).map((item, index) => ({...item, partOrder: index + 1}))
  if (!parts.value.some(item => item.id === partId.value)) partId.value = parts.value[0]?.id || null
}

async function loadCurrent() {
  loading.value = true
  editors.clear()
  editingKey.value = null
  editorVisible.value = false
  try {
    if (tab.value === 'part') await loadParts()
    else if (!partId.value) {
      chapters.value = []
      levels.value = []
    } else if (tab.value === 'chapter') {
      chapters.value = await request(`${base()}/parts/${partId.value}/chapters?${auth()}`) || []
    } else {
      const data = await request(`${base()}/levels?partId=${partId.value}&${auth()}`)
      levels.value = (data || []).map(item => ({...item, cardIdsText: (item.cardIds || []).join(', ')}))
    }
    snapshot.value = JSON.stringify(comparableList())
  } catch (error) {
    showError(`加载失败：${error.message}`)
  } finally {
    loading.value = false
  }
}

async function selectTab(next) {
  if (next === tab.value) return
  if (changed.value) return showError('请先保存当前修改')
  tab.value = next
  await loadCurrent()
}

async function selectPart(event) {
  const next = Number(event.target.value)
  event.target.value = String(partId.value || '')
  if (changed.value) return showError('请先保存当前修改')
  partId.value = next
  await loadCurrent()
}

async function save() {
  if (saving.value || !await syncEditors()) return
  if (tab.value !== 'part' && !partId.value) return showError('请先保存部分')
  saving.value = true
  try {
    let url
    let payload
    if (tab.value === 'part') {
      url = `${base()}/parts?${auth()}`
      payload = parts.value.map((item, index) => ({id: item.id, partOrder: index + 1,
        title: cleanPair(item.title), description: cleanPair(item.description)}))
    } else if (tab.value === 'chapter') {
      url = `${base()}/parts/${partId.value}/chapters?${auth()}`
      payload = chapters.value.map((item, index) => ({id: item.id, chapterOrder: index + 1,
        title: cleanPair(item.title), description: cleanPair(item.description)}))
    } else {
      url = `${base()}/levels?partId=${partId.value}&${auth()}`
      payload = levels.value.map((item, index) => ({id: item.id, partId: partId.value, levelOrder: index + 1,
        title: cleanPair(item.title), description: cleanPair(item.description), questionType: 'match_pair',
        questionCount: item.questionCount, pairCount: item.pairCount, status: item.status,
        cardIds: item.cardIdsText.split(',').map(value => Number(value.trim())).filter(value => Number.isInteger(value) && value > 0)}))
    }
    await request(url, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)})
    showSuccess('保存成功')
    editorVisible.value = false
    await loadCurrent()
  } catch (error) {
    showError(`保存失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

async function remove(item) {
  if (!await syncEditors()) return
  if (item.id && changed.value) return showError('请先保存当前修改')
  if (!item.id) {
    list.value.splice(list.value.indexOf(item), 1)
    editingKey.value = null
    return
  }
  if (!item.deletable || tab.value === 'level') return showError('当前内容不能删除')
  if (!window.confirm('确定删除这个空内容吗？')) return
  const url = tab.value === 'part'
    ? `${base()}/parts/${item.id}?${auth()}`
    : `${base()}/parts/${partId.value}/chapters/${item.id}?${auth()}`
  try {
    await request(url, {method: 'DELETE'})
    showSuccess('删除成功')
    await loadCurrent()
  } catch (error) {
    showError(`删除失败：${error.message}`)
  }
}

onMounted(async () => {
  if (tab.value !== 'part') {
    try { await loadParts() }
    catch (error) { showError(`加载部分失败：${error.message}`) }
  }
  await loadCurrent()
})
</script>

<template>
  <main class="curriculum-editor">
    <header class="editor-actions">
      <div class="level-picker" role="tablist" aria-label="选择编辑内容">
        <span class="level-picker-indicator" :style="{transform: `translateX(${activeTabIndex * 100}%)`}" aria-hidden="true" />
        <button v-for="item in tabs" :key="item.key" type="button" role="tab"
                :class="{active: tab === item.key}" :aria-selected="tab === item.key"
                @click="selectTab(item.key)">{{ item.label }}</button>
      </div>
      <button class="save-button" type="button" :disabled="saving || loading || !changed" @click="save">
        <img :src="saveIcon" alt="" aria-hidden="true" />{{ saving ? '保存中…' : '保存' }}
      </button>
    </header>

    <LoadingIcon v-if="loading" :show-text="true" />
    <template v-else>
      <div v-if="tab !== 'part'" class="part-selector">
        <label for="editor-part">所属部分</label>
        <select id="editor-part" :value="partId || ''" @change="selectPart">
          <option v-for="part in parts" :key="part.id" :value="part.id">{{ text(part.title) }}</option>
        </select>
      </div>
      <button class="add-button" type="button" :disabled="tab !== 'part' && !partId" @click="create">
        新增{{ tabs.find(item => item.key === tab)?.label }}
      </button>

      <StudySortList :items="list" @move="move">
        <template #default="{item, index}">
          <div class="summary">
            <span class="item-order">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="item-copy"><strong>{{ text(item.title) || '未命名' }}</strong><p>{{ text(item.description) }}</p></div>
            <span v-if="tab === 'level'" class="item-status">{{ item.status === 1 ? '已发布' : '草稿' }}</span>
            <button type="button" class="icon-button" aria-label="编辑" title="编辑" @click="edit(item)"><Edit /></button>
            <button v-if="tab !== 'level'" type="button" class="icon-button" aria-label="删除" title="删除"
                    :disabled="item.id && !item.deletable" @click="remove(item)"><Delete /></button>
          </div>
        </template>
      </StudySortList>
    </template>
    <UnifiedModal v-model="editorVisible" :title="`编辑${tabs.find(item => item.key === tab)?.label || '内容'}`"
                  size="large" :content-max-height="650">
      <div v-if="editingItem" class="edit-form">
        <label>标题</label>
        <ScTcEditorLab :ref="el => setEditor(`${keyOf(editingItem)}-title`, el)" :pair="editingItem.title" :dialect="dialect"
                       layout="small-sentence" :rich-text="false" @update:pair="editingItem.title = $event" />
        <label>说明</label>
        <ScTcEditorLab :ref="el => setEditor(`${keyOf(editingItem)}-description`, el)" :pair="editingItem.description" :dialect="dialect"
                       layout="middle" :rich-text="false" @update:pair="editingItem.description = $event" />
        <div v-if="tab === 'level'" class="level-fields">
          <label>状态<select v-model.number="editingItem.status"><option :value="0">草稿</option><option :value="1">发布</option></select></label>
          <label>题目数量<input v-model.number="editingItem.questionCount" type="number" min="1" max="50" /></label>
          <label>每题词卡<input v-model.number="editingItem.pairCount" type="number" min="2" max="20" /></label>
          <label class="wide">指定词卡 ID<input v-model="editingItem.cardIdsText" placeholder="留空则随机取词卡" /></label>
        </div>
      </div>
    </UnifiedModal>
  </main>
</template>

<style scoped>
.curriculum-editor { max-width: 1000px; margin: 0 auto; padding: 105px 24px 70px; color: #293e2e; }
.editor-actions { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 25px; }
.level-picker { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 4px; border: 1px solid #cbdccd; border-radius: 12px; background: #f5faf5; }
.level-picker-indicator { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3); border-radius: 9px; background: #c7e4ca; transition: transform .25s ease; }
.level-picker button { position: relative; z-index: 1; padding: 9px 18px; border: 0; border-radius: 9px; color: #536758; background: transparent; font: inherit; cursor: pointer; }
.level-picker button.active { color: #20562b; font-weight: 700; }
.save-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 90px; padding: 10px 20px; border: 0; border-radius: 8px; color: #fff; background: #2e7d32; font: inherit; cursor: pointer; }
.save-button img { width: 16px; height: 16px; }
.save-button:disabled { opacity: .5; cursor: default; }
.part-selector { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.part-selector select, .level-fields input, .level-fields select { padding: 9px 10px; border: 1px solid #cbdccd; border-radius: 7px; background: #fff; font: inherit; }
.add-button { margin-bottom: 18px; padding: 9px 16px; border: 1px solid #a8cbaa; border-radius: 8px; color: #285c33; background: #fff; font: inherit; cursor: pointer; }
.add-button:disabled { opacity: .5; cursor: default; }
.summary { display: flex; align-items: center; gap: 14px; min-height: 50px; }
.item-order { color: #4d8758; font-weight: 700; }
.item-copy { flex: 1; min-width: 0; }.item-copy strong { color: #345a3b; }.item-copy p { margin: 4px 0 0; color: #718575; font-size: .84rem; }
.item-status { color: #718575; font-size: .8rem; }
.summary button, .edit-heading button { padding: 7px 12px; border: 1px solid #b8d2bc; border-radius: 7px; color: #356e40; background: #fff; font: inherit; cursor: pointer; }
.summary button:disabled { opacity: .45; cursor: default; }
.icon-button { display: grid; place-items: center; width: 34px; height: 34px; padding: 6px !important; }
.icon-button svg { width: 18px; height: 18px; }
.edit-form { padding: 4px 0 10px; }
.edit-form > label { display: block; margin: 18px 0 8px; color: #496a50; font-weight: 700; }
.level-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }.level-fields label { display: flex; flex-direction: column; gap: 6px; }.level-fields .wide { grid-column: 1 / -1; }
@media (max-width: 640px) { .curriculum-editor { padding: 88px 12px 50px; }.editor-actions { align-items: flex-start; }.level-picker button { padding: 9px 12px; }.summary { flex-wrap: wrap; }.item-copy { flex-basis: calc(100% - 70px); }.level-fields { grid-template-columns: 1fr; }.level-fields .wide { grid-column: auto; } }
</style>
