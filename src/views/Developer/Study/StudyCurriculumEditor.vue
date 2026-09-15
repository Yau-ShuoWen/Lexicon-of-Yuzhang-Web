<script setup>
import { computed, onMounted, ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute } from 'vue-router'
import { getToken } from '../../../utils/auth.js'
import { showError, showSuccess } from '../../../services/ToastService.js'
import LoadingIcon from '../../../components/Status/LoadingIcon.vue'

const route = useRoute()
const dialect = computed(() => route.params.dialect)
const parts = ref([])
const selectedPart = ref(null)
const selectedLevel = ref(null)
const loading = ref(true)
const saving = ref(false)
const cardIdsText = ref('')

useHead({title: '關卡編輯器'})

const emptyPart = () => ({id: null, partOrder: 1, title: {sc: '', tc: ''}, description: {sc: '', tc: ''}, status: 0})
const emptyLevel = (partId) => ({id: null, partId, levelOrder: 1, title: {sc: '', tc: ''}, description: {sc: '', tc: ''}, questionType: 'match_pair', questionCount: 3, pairCount: 5, cardIds: [], status: 0})

const clone = value => JSON.parse(JSON.stringify(value))
const manageUrl = (path = '') => `/api/study/curriculum/manage/${dialect.value}${path}`
const authQuery = () => `?t=${encodeURIComponent(getToken() || '')}`

const load = async () => {
  loading.value = true
  try {
    const response = await fetch(`${manageUrl('/parts')}${authQuery()}`)
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '加载部分失败')
    parts.value = result.data || []
    selectPart(parts.value[0])
  } catch (error) {
    showError(`加载学习部分失败：${error.message}`)
  } finally {
    loading.value = false
  }
}

const selectPart = (part) => {
  selectedPart.value = part ? clone(part) : emptyPart()
  selectedLevel.value = null
  cardIdsText.value = ''
}

const selectLevel = async (level) => {
  try {
    const response = await fetch(`${manageUrl(`/level/${level.id}`)}${authQuery()}`)
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '加载关卡失败')
    selectedLevel.value = clone(result.data)
    cardIdsText.value = (selectedLevel.value.cardIds || []).join(', ')
  } catch (error) {
    showError(`加载关卡失败：${error.message}`)
  }
}

const newPart = () => {
  selectedPart.value = emptyPart()
  selectedLevel.value = null
  cardIdsText.value = ''
}

const newLevel = () => {
  selectedLevel.value = emptyLevel(selectedPart.value?.id)
  cardIdsText.value = ''
}

const savePart = async () => {
  saving.value = true
  try {
    const response = await fetch(`${manageUrl('/part')}${authQuery()}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(selectedPart.value)})
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '保存部分失败')
    showSuccess('部分保存成功')
    await load()
  } catch (error) { showError(`保存部分失败：${error.message}`) } finally { saving.value = false }
}

const saveLevel = async () => {
  if (!selectedLevel.value?.partId) return showError('请先保存部分，再新增关卡。')
  saving.value = true
  try {
    const payload = {...selectedLevel.value, cardIds: cardIdsText.value.split(',').map(item => Number(item.trim())).filter(Number.isInteger)}
    const response = await fetch(`${manageUrl('/level')}${authQuery()}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)})
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '保存关卡失败')
    showSuccess('关卡保存成功')
    selectedLevel.value = clone(result.data)
    cardIdsText.value = (selectedLevel.value.cardIds || []).join(', ')
    await load()
    const part = parts.value.find(item => item.id === selectedLevel.value.partId)
    if (part) await selectPart(part)
    await selectLevel(selectedLevel.value)
  } catch (error) { showError(`保存关卡失败：${error.message}`) } finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <main class="curriculum-editor">
    <header class="curriculum-toolbar">
      <div><h1>關卡編輯器</h1></div>
      <button class="curriculum-primary" @click="newPart">新增部分</button>
    </header>

    <LoadingIcon v-if="loading" :show-text="true" />
    <div v-else class="curriculum-layout">
      <aside class="curriculum-sidebar">
        <div class="curriculum-sidebar-title"><span>部分列表</span><b>{{ parts.length }}</b></div>
        <button v-for="part in parts" :key="part.id" class="curriculum-part-item" :class="{active: selectedPart?.id === part.id}" @click="selectPart(part)">
          <span>{{ String(part.partOrder).padStart(2, '0') }}</span><strong>{{ part.title?.tc || part.title?.sc }}</strong><small>{{ part.status === 1 ? '已发布' : '草稿' }}</small>
        </button>
        <p v-if="!parts.length" class="curriculum-empty">还没有部分。</p>
      </aside>

      <section class="curriculum-workspace">
        <div class="curriculum-section-heading"><div><span>PART</span><h2>部分设置</h2></div><button class="curriculum-save" :disabled="saving" @click="savePart">{{ saving ? '保存中…' : '保存部分' }}</button></div>
        <div class="curriculum-form-grid">
          <label>顺序<input v-model.number="selectedPart.partOrder" type="number" min="1" /></label>
          <label>状态<select v-model.number="selectedPart.status"><option :value="0">草稿</option><option :value="1">发布</option></select></label>
          <label>简体标题<input v-model="selectedPart.title.sc" placeholder="例如：完成入门" /></label>
          <label>繁体标题<input v-model="selectedPart.title.tc" placeholder="例如：完成入門" /></label>
          <label class="wide">简体描述<textarea v-model="selectedPart.description.sc" rows="2" /></label>
          <label class="wide">繁体描述<textarea v-model="selectedPart.description.tc" rows="2" /></label>
        </div>

        <div class="curriculum-section-heading level-heading"><div><span>LEVELS</span><h2>关卡编辑</h2></div><button class="curriculum-outline" :disabled="!selectedPart.id" @click="newLevel">新增关卡</button></div>
        <div class="curriculum-levels">
          <button v-for="level in (selectedPart.levels || [])" :key="level.id" class="curriculum-level-item" :class="{active: selectedLevel?.id === level.id}" @click="selectLevel(level)"><span>{{ level.levelOrder }}</span><strong>{{ level.title?.tc || level.title?.sc }}</strong><small>{{ level.status === 1 ? '已发布' : '草稿' }}</small></button>
          <p v-if="selectedPart.id && !(selectedPart.levels || []).length" class="curriculum-empty">这个部分还没有关卡。</p>
        </div>

        <div v-if="selectedLevel" class="curriculum-level-form">
          <div class="curriculum-section-heading"><div><span>LEVEL {{ selectedLevel.levelOrder }}</span><h2>{{ selectedLevel.id ? '编辑关卡' : '新增关卡' }}</h2></div><button class="curriculum-save" :disabled="saving" @click="saveLevel">{{ saving ? '保存中…' : '保存关卡' }}</button></div>
          <div class="curriculum-form-grid">
            <label>顺序<input v-model.number="selectedLevel.levelOrder" type="number" min="1" /></label>
            <label>状态<select v-model.number="selectedLevel.status"><option :value="0">草稿</option><option :value="1">发布</option></select></label>
            <label>简体标题<input v-model="selectedLevel.title.sc" /></label>
            <label>繁体标题<input v-model="selectedLevel.title.tc" /></label>
            <label class="wide">简体描述<textarea v-model="selectedLevel.description.sc" rows="2" /></label>
            <label class="wide">繁体描述<textarea v-model="selectedLevel.description.tc" rows="2" /></label>
            <label>题目数量<input v-model.number="selectedLevel.questionCount" type="number" min="1" max="50" /></label>
            <label>每题词卡<input v-model.number="selectedLevel.pairCount" type="number" min="2" max="20" /></label>
            <label class="wide">指定词卡 ID<input v-model="cardIdsText" placeholder="留空随机取词卡，例如：1, 2, 3, 4, 5" /></label>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.curriculum-editor { max-width: 1180px; margin: 0 auto; padding: 105px 24px 60px; color: #24392a; }.curriculum-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 27px; }.curriculum-kicker { margin: 0 0 7px; color: var(--color-primary); font-family: var(--font-family-mono); font-size: .67rem; font-weight: 700; letter-spacing: .16em; }.curriculum-toolbar h1, .curriculum-toolbar p { margin: 0; }.curriculum-toolbar h1 { color: var(--color-primary-dark); font-size: 2.2rem; }.curriculum-toolbar p:last-child { margin-top: 8px; color: var(--color-text-light); font-size: .83rem; }.curriculum-primary, .curriculum-save, .curriculum-outline { padding: 10px 16px; border-radius: 999px; font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer; }.curriculum-primary, .curriculum-save { border: 0; color: #fff; background: var(--color-primary); }.curriculum-outline { border: 1px solid #9fc6a2; color: var(--color-primary-dark); background: #fff; }.curriculum-primary:disabled, .curriculum-save:disabled, .curriculum-outline:disabled { opacity: .45; cursor: default; }.curriculum-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 18px; align-items: start; }.curriculum-sidebar, .curriculum-workspace { border: 1px solid #d8e8d9; border-radius: 20px; background: #ffffffe6; box-shadow: 0 12px 30px #3674450c; }.curriculum-sidebar { padding: 14px; }.curriculum-sidebar-title { display: flex; justify-content: space-between; padding: 5px 5px 12px; color: #54725a; font-size: .78rem; font-weight: 700; }.curriculum-sidebar-title b { color: #8fa593; font-size: .7rem; }.curriculum-part-item, .curriculum-level-item { display: grid; grid-template-columns: 35px 1fr auto; align-items: center; gap: 8px; width: 100%; border: 1px solid transparent; border-radius: 12px; background: transparent; text-align: left; cursor: pointer; }.curriculum-part-item { padding: 12px 8px; }.curriculum-part-item:hover, .curriculum-part-item.active, .curriculum-level-item.active { border-color: #b9d8bb; background: #eff8ef; }.curriculum-part-item > span, .curriculum-level-item > span { color: #72a078; font-size: .7rem; font-weight: 700; }.curriculum-part-item strong, .curriculum-level-item strong { overflow: hidden; color: #3f6546; font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }.curriculum-part-item small, .curriculum-level-item small { color: #96a898; font-size: .63rem; }.curriculum-empty { padding: 20px 8px; color: #94a498; font-size: .76rem; text-align: center; }.curriculum-workspace { padding: 24px; }.curriculum-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 16px; }.curriculum-section-heading span { color: #70a077; font-family: var(--font-family-mono); font-size: .63rem; font-weight: 700; letter-spacing: .12em; }.curriculum-section-heading h2 { margin: 4px 0 0; color: #355d3d; font-size: 1.25rem; }.curriculum-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; padding: 17px; border: 1px solid #e0ece1; border-radius: 15px; background: #fafffa; }.curriculum-form-grid label { display: flex; flex-direction: column; gap: 6px; color: #6e866f; font-size: .72rem; }.curriculum-form-grid input, .curriculum-form-grid select, .curriculum-form-grid textarea { width: 100%; padding: 10px 11px; border: 1px solid #d4e4d5; border-radius: 9px; outline: none; color: #385a3d; background: #fff; font: inherit; font-size: .8rem; }.curriculum-form-grid textarea { resize: vertical; }.curriculum-form-grid input:focus, .curriculum-form-grid select:focus, .curriculum-form-grid textarea:focus { border-color: #82b488; box-shadow: 0 0 0 3px #7fb2861c; }.wide { grid-column: 1 / -1; }.level-heading { margin-top: 30px; }.curriculum-levels { display: flex; flex-wrap: wrap; gap: 8px; }.curriculum-level-item { grid-template-columns: 25px 1fr auto; width: auto; min-width: 150px; padding: 10px 12px; }.curriculum-level-form { margin-top: 25px; padding-top: 23px; border-top: 1px solid #e0ece1; }.curriculum-level-form .curriculum-form-grid { background: #fffdf9; border-color: #eee4d6; }
@media (max-width: 760px) { .curriculum-editor { padding: 88px 12px 40px; }.curriculum-toolbar { align-items: flex-start; flex-direction: column; }.curriculum-layout { grid-template-columns: 1fr; }.curriculum-sidebar { order: 2; }.curriculum-workspace { order: 1; padding: 16px; }.curriculum-form-grid { grid-template-columns: 1fr; padding: 13px; }.wide { grid-column: auto; }.curriculum-level-item { min-width: 135px; }.curriculum-section-heading h2 { font-size: 1.1rem; } }
</style>
