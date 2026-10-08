<script setup>
import {computed, onMounted, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import LoadingIcon from '../../../components/Status/LoadingIcon.vue'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'
import DraggableList from '../../../components/Layout/DraggableList.vue'
import DraggableGrid from '../../../components/Layout/DraggableGrid.vue'
import RichText from '../../../components/Text/RichText.vue'
import {showError, showSuccess} from '../../../services/ToastService.js'
import {getToken} from '../../../utils/auth.js'

const route = useRoute()
const router = useRouter()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = id => `/${language.value}/${dialect.value}/dev/hanzi-editor/${id}`

const emptyData = () => ({
  id: null,
  hanzi: {sc: '', tc: ''},
  pinyin: [],
  special: 0,
  similar: [],
  note: [],
  status: 1
})

const updateData = ref(emptyData())
const mandarinOptions = ref([])
const wordSuggestions = ref([])
const suggestionsLoading = ref(false)
const suggestionsFailed = ref(false)
const prevId = ref(null)
const nextId = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)

const tagOptions = [
  {sc: '待定', tc: '待定'}, {sc: '文读', tc: '文讀'}, {sc: '白读', tc: '白讀'},
  {sc: '老派', tc: '老派'}, {sc: '新派', tc: '新派'}, {sc: '普化音', tc: '普化音'},
  {sc: '理论读音', tc: '理論讀音'}, {sc: '连读音', tc: '連讀音'}, {sc: '语流音变', tc: '語流音變'}
]

const noteTags = [
  {code: 'usage', name: '用法說明'},
  {code: 'pronun', name: '讀音說明'},
  {code: 'struct', name: '詞語結構'},
  {code: 'source', name: '字源考證'},
  {code: 'history', name: '歷史演變'},
  {code: 'proverb', name: '相關俗語'}
]

const isKnownNoteTag = value => noteTags.some(tag => tag.code === value)

const isAutomaticMapping = computed(() =>
    updateData.value.pinyin.length === 1 && mandarinOptions.value.length === 1)

const loadMandarinOptions = async () => {
  const {sc, tc} = updateData.value.hanzi
  if (!sc || !tc) return
  const response = await fetch(`/api/edit/hanzi/get-mandarin/${dialect.value}?sc=${encodeURIComponent(sc)}&tc=${encodeURIComponent(tc)}`, {
    headers: {'X-Auth-Token': getToken() || ''}
  })
  if (!response.ok) throw new Error('普通话读音加载失败')
  mandarinOptions.value = await response.json()
}

const loadNearBy = async id => {
  const response = await fetch(`/api/edit/hanzi/get-nearby/${dialect.value}?id=${id}`, {
    headers: {'X-Auth-Token': getToken() || ''}
  })
  const json = await response.json()
  if (!response.ok || !json.success) throw new Error(json?.message || '加载上下条失败')
  prevId.value = json.data.left.empty ? null : json.data.left.value
  nextId.value = json.data.right.empty ? null : json.data.right.value
}

const loadWordSuggestions = async id => {
  suggestionsLoading.value = true
  suggestionsFailed.value = false
  try {
    const response = await fetch(`/api/edit/hanzi/get-word-suggestions/${dialect.value}?id=${encodeURIComponent(id)}&language=${language.value}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.success) throw new Error(json?.message || '建议加载失败')
    wordSuggestions.value = json.data ?? []
  } catch (error) {
    wordSuggestions.value = []
    suggestionsFailed.value = true
    console.error('词语读音建议加载失败', error)
  } finally {
    suggestionsLoading.value = false
  }
}

const loadHanzi = async id => {
  isLoading.value = true
  try {
    const response = await fetch(`/api/edit/hanzi/get-info/${dialect.value}?id=${id}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.success) throw new Error(json?.message || '加载失败')
    if (json.data.empty) throw new Error('未找到数据')
    updateData.value = json.data.value
    updateData.value.pinyin ??= []
    updateData.value.pinyin.forEach(item => item.mandarin ??= [])
    await Promise.all([loadMandarinOptions(), loadNearBy(id), loadWordSuggestions(id)])
  } catch (error) {
    showError('加载失败：' + error.message)
  } finally {
    isLoading.value = false
  }
}

const usedByOther = (mandarinId, currentIndex) => updateData.value.pinyin.some(
    (item, index) => index !== currentIndex && item.mandarin?.includes(mandarinId))

const saveData = async () => {
  isSaving.value = true
  try {
    if (isAutomaticMapping.value) updateData.value.pinyin[0].mandarin = []
    const response = await fetch(`/api/edit/hanzi/submit/${dialect.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Auth-Token': getToken() || ''},
      body: JSON.stringify(updateData.value)
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.success) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    showSuccess('保存成功！')
    await loadHanzi(route.params.id)
  } catch (error) {
    showError(error.message)
  } finally {
    isSaving.value = false
  }
}

watch(() => route.params.id, id => id && loadHanzi(id))
watch([() => updateData.value.hanzi.sc, () => updateData.value.hanzi.tc], () => {
  loadMandarinOptions().catch(error => showError(error.message))
})
onMounted(() => loadHanzi(route.params.id))
</script>

<template>
  <div class="broaden-layout">
    <div class="nav-buttons">
      <button :disabled="!prevId" class="dev-nav-button dev-btn dev-btn-small" @click="router.replace(getPath(prevId))">
        {{ prevId ? '上一条' : '第一条' }}
      </button>
      <button :disabled="!nextId" class="dev-nav-button dev-btn-small" @click="router.replace(getPath(nextId))">
        {{ nextId ? '下一条' : '最后一条' }}
      </button>
      <button :disabled="isSaving" class="dev-add-btn dev-btn-small" @click="saveData">
        {{ isSaving ? '保存中...' : '保存修改' }}
      </button>
    </div>

    <LoadingIcon v-if="isLoading" :show-text="true"/>
    <div v-else class="edit-form">
      <div class="form-section form-grid">
        <div><h4>繁體：{{ updateData.hanzi.tc }}</h4><h4>簡體：{{ updateData.hanzi.sc }}</h4></div>
        <div class="form-field">
          <label>特殊性標記</label>
          <select v-model.number="updateData.special" class="short-input">
            <option :value="0">普通漢字</option><option :value="1">特殊方言字</option>
            <option :value="2">罕見漢字</option><option :value="3">不使用漢字</option>
            <option :value="4">迁移冲突待处理</option>
          </select>
        </div>
        <div class="form-field">
          <label>词条状态</label>
          <select v-model.number="updateData.status" class="short-input">
            <option :value="1">刚刚创建词条</option><option :value="2">需要补充内容</option>
            <option :value="3">基本完成</option><option :value="4">存疑</option>
          </select>
        </div>
      </div>

      <div class="form-section">
        <h3>拼音</h3>
        <DraggableGrid v-model="updateData.pinyin"
          :createItem="() => ({tag:{sc:'待定',tc:'待定'},pinyin:'',code:null,mandarin:[]})">
          <template #default="{item,index}">
            <div class="pinyin-item">
              <div class="array-item">
                <select class="form-control small-input" :value="JSON.stringify(item.tag)"
                        @change="e => item.tag=JSON.parse(e.target.value)">
                  <option v-for="opt in tagOptions" :key="opt.sc" :value="JSON.stringify(opt)">{{ opt.tc }}</option>
                </select>
                <input v-model="item.pinyin" class="form-control small-input" type="text">
                <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                          :model-value="item.pinyin"/>
              </div>

              <div class="mandarin-line">
                <span class="mandarin-label">普通話：</span>
                <div v-if="isAutomaticMapping" class="gray-text compact-hint">
                  <span v-formatted-text="mandarinOptions[0].info"/>（自动）
                </div>
                <div v-else-if="mandarinOptions.length" class="mandarin-options">
                  <label v-for="option in mandarinOptions" :key="option.mandarinId" class="checkbox-item">
                    <input v-model="item.mandarin" type="checkbox" :value="option.mandarinId"
                           :disabled="usedByOther(option.mandarinId,index)" class="big-check">
                    <span v-formatted-text="option.info"/>
                  </label>
                </div>
                <div v-else class="gray-text compact-hint">暂无</div>
              </div>
            </div>
          </template>
        </DraggableGrid>

        <div class="word-suggestions">
          <h4>词语中的未收录读音</h4>
          <p class="suggestion-hint">这里只提供建议，不会修改或保存到汉字数据。</p>
          <div v-if="suggestionsLoading" class="gray-text compact-hint">正在检查词语读音……</div>
          <div v-else-if="suggestionsFailed" class="gray-text compact-hint">暂时无法加载建议，不影响编辑和保存。</div>
          <div v-else-if="wordSuggestions.length" class="suggestion-list">
            <div v-for="suggestion in wordSuggestions" :key="suggestion.pinyin" class="suggestion-item">
              <strong v-formatted-text="suggestion.pinyin"/>
              <div class="suggestion-words">
                <span v-for="word in suggestion.words" :key="word.id" class="suggestion-word">
                  <span v-formatted-text="word.word"/>
                  <small v-formatted-text="word.pinyin"/>
                </span>
              </div>
            </div>
          </div>
          <div v-else class="gray-text compact-hint">暂无未收录读音</div>
        </div>
      </div>

      <div class="form-section">
        <h3>相似漢字</h3>
        <DraggableList v-model="updateData.similar" :createItem="() => ({text:{sc:'',tc:''}})" :draggable="false">
          <template #default="{item}">
            <div class="array-item"><ScAndTcText v-model:traditionalText="item.text.tc"
              v-model:simplifiedText="item.text.sc" layout="small" :dialect="dialect.toString()"/></div>
          </template>
        </DraggableList>
      </div>

      <div class="form-section">
        <h3>註釋</h3>
        <DraggableList v-model="updateData.note"
          :createItem="() => ({left:'usage',right:{sc:'',tc:''}})">
          <template #default="{item}">
            <div class="array-item complex-item">
              <select v-model="item.left" class="short-input">
                <option v-if="!isKnownNoteTag(item.left)" :value="item.left">
                  待處理：{{ item.left || '空標籤' }}
                </option>
                <option v-for="tag in noteTags" :key="tag.code" :value="tag.code">{{ tag.name }}</option>
              </select>
              <ScAndTcText v-model:traditionalText="item.right.tc" v-model:simplifiedText="item.right.sc"
                           layout="large" :dialect="dialect.toString()"  rows="10"/>
              <h4>预览</h4>
              <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                        :model-value="item.right.tc"/>
            </div>
          </template>
        </DraggableList>
      </div>
    </div>
  </div>
</template>

<style>
.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px}
.form-field{display:flex;flex-direction:column;gap:6px}
.short-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 120px;
  min-width: 120px;
}
.pinyin-item{min-width:0}
.array-item{display:flex;gap:8px;margin-bottom:10px;align-items:center}.array-item input{padding:6px 8px}
.complex-item{flex-direction:column;align-items:stretch}
.mandarin-line{display:flex;align-items:center;gap:8px;min-height:28px;flex-wrap:wrap}
.mandarin-label{font-size:14px;color:var(--color-text-light);white-space:nowrap}
.compact-hint{font-size:14px}.mandarin-options{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.checkbox-group{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.checkbox-item{display:flex;align-items:center;gap:6px}.big-check{transform:scale(1.3)}
.word-suggestions{margin-top:18px;padding:14px 16px;border:1px dashed var(--color-border);border-radius:var(--border-radius-md);background:rgba(255,255,255,.45)}
.word-suggestions h4{margin:0 0 4px}.suggestion-hint{margin:0 0 12px;font-size:13px;color:var(--color-text-light)}
.suggestion-list{display:flex;flex-direction:column;gap:10px}.suggestion-item{display:flex;align-items:flex-start;gap:14px;padding:10px 12px;border-radius:8px;background:var(--color-background)}
.suggestion-item>strong{min-width:72px;color:var(--color-primary-dark)}.suggestion-words{display:flex;flex-wrap:wrap;gap:8px}.suggestion-word{display:inline-flex;align-items:baseline;gap:5px}.suggestion-word small{color:var(--color-text-light)}
@media(max-width:560px){.array-item{align-items:stretch;flex-direction:column}.mandarin-line{align-items:flex-start}}
</style>
