<script setup>
import {computed, onMounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {useHead} from '@vueuse/head'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'
import RichText from '../../../components/Text/RichText.vue'
import {getToken} from '../../../utils/auth.js'
import {showError, showSuccess} from '../../../services/ToastService.js'

const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const groups = ref([])
const activeChapterId = ref(null)
const selectedIds = ref(new Set())
const draggedIds = ref([])
const managing = ref(false)
const loading = ref(true)
const loaded = ref(false)
const refreshing = ref(false)
const savingOrder = ref(false)
const deleting = ref(false)
const editorVisible = ref(false)
const editorIsNew = ref(false)
const editorChapterId = ref(null)
const editorForm = ref(null)
const savingCard = ref(false)

useHead({title: '學習詞卡管理'})

const boardUrl = () => `/api/study/curriculum/manage/${dialect.value}/word-cards?t=${encodeURIComponent(getToken() || '')}`
const apiRoot = () => boardUrl().replace(/\?.*$/, '')
const emptyForm = () => ({id: null, putonghua: {sc: '', tc: ''}, word: {sc: '', tc: ''}, pinyin: ''})
const clone = value => JSON.parse(JSON.stringify(value))
const display = value => value?.[language.value] || value?.tc || value?.sc || ''
const activeGroup = computed(() => groups.value.find(group => group.chapterId === activeChapterId.value) || null)
const selectedCount = computed(() => selectedIds.value.size)
const totalCards = computed(() => groups.value.reduce((sum, group) => sum + group.wordCards.length, 0))
const folderTone = index => `tone-${index % 6}`
const cardTone = card => `tone-${Math.abs(Number(card.id) || 0) % 6}`

const load = async () => {
  if (loaded.value) refreshing.value = true
  else loading.value = true
  try {
    const response = await fetch(boardUrl())
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '載入失敗')
    groups.value = result.data || []
    selectedIds.value = new Set()
    if (activeChapterId.value && !groups.value.some(group => group.chapterId === activeChapterId.value)) activeChapterId.value = null
  } catch (error) {
    showError(`載入詞卡失敗：${error.message}`)
  } finally {
    loading.value = false
    refreshing.value = false
    loaded.value = true
  }
}

const openFolder = chapterId => {
  activeChapterId.value = chapterId
  selectedIds.value = new Set()
  managing.value = false
}

const closeFolder = () => {
  activeChapterId.value = null
  selectedIds.value = new Set()
  managing.value = false
}

const toggleManage = () => {
  managing.value = !managing.value
  if (!managing.value) selectedIds.value = new Set()
}

const toggleSelected = cardId => {
  const next = new Set(selectedIds.value)
  next.has(cardId) ? next.delete(cardId) : next.add(cardId)
  selectedIds.value = next
}

const selectAll = () => {
  if (!activeGroup.value) return
  const ids = activeGroup.value.wordCards.map(card => card.id)
  selectedIds.value = selectedIds.value.size === ids.length ? new Set() : new Set(ids)
}

const startDrag = (event, card) => {
  draggedIds.value = selectedIds.value.has(card.id)
    ? groups.value.flatMap(group => group.wordCards).filter(item => selectedIds.value.has(item.id)).map(item => item.id)
    : [card.id]
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', draggedIds.value.join(','))
}

const finishDrag = () => { draggedIds.value = [] }

const dropCards = (targetGroup, targetCardId = null) => {
  if (!draggedIds.value.length) return
  const movingIds = new Set(draggedIds.value)
  if (targetCardId != null && movingIds.has(targetCardId)) return finishDrag()
  const cardsById = new Map()
  groups.value.forEach(group => group.wordCards.forEach(card => cardsById.set(card.id, card)))
  const movingCards = draggedIds.value.map(id => cardsById.get(id)).filter(Boolean)
  groups.value.forEach(group => { group.wordCards = group.wordCards.filter(card => !movingIds.has(card.id)) })
  const targetIndex = targetCardId == null ? targetGroup.wordCards.length : Math.max(0, targetGroup.wordCards.findIndex(card => card.id === targetCardId))
  targetGroup.wordCards.splice(targetIndex, 0, ...movingCards)
  selectedIds.value = new Set(draggedIds.value)
  finishDrag()
}

const saveOrder = async () => {
  savingOrder.value = true
  try {
    const payload = groups.value.map(group => ({chapterId: group.chapterId, wordCardIds: group.wordCards.map(card => card.id)}))
    const response = await fetch(boardUrl(), {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)})
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '保存失敗')
    groups.value = result.data || []
    selectedIds.value = new Set()
    showSuccess('詞卡排列已保存')
  } catch (error) {
    showError(`保存詞卡排列失敗：${error.message}`)
  } finally {
    savingOrder.value = false
  }
}

const openNew = chapterId => {
  editorIsNew.value = true
  editorChapterId.value = chapterId
  editorForm.value = emptyForm()
  editorVisible.value = true
}

const openEdit = card => {
  if (managing.value) return toggleSelected(card.id)
  editorIsNew.value = false
  editorChapterId.value = null
  editorForm.value = clone(card)
  editorVisible.value = true
}

const closeEditor = () => {
  editorVisible.value = false
  editorForm.value = null
}

const saveCard = async () => {
  savingCard.value = true
  const wasNew = editorIsNew.value
  try {
    const target = wasNew ? `${apiRoot()}/${editorChapterId.value}?t=${encodeURIComponent(getToken() || '')}` : `${apiRoot()}/edit?t=${encodeURIComponent(getToken() || '')}`
    const response = await fetch(target, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(editorForm.value)})
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '保存失敗')
    closeEditor()
    await load()
    showSuccess(wasNew ? '詞卡已新增' : '詞卡已更新')
  } catch (error) {
    showError(`保存詞卡失敗：${error.message}`)
  } finally {
    savingCard.value = false
  }
}

const deleteIds = async ids => {
  const cards = groups.value.flatMap(group => group.wordCards).filter(card => ids.includes(card.id))
  const label = cards.length === 1 ? `「${display(cards[0].word)}」` : `選取的 ${cards.length} 張詞卡`
  if (!cards.length || !window.confirm(`確定刪除${label}嗎？此操作無法復原。`)) return
  deleting.value = true
  try {
    for (const card of cards) {
      const response = await fetch(`${apiRoot()}/${card.id}?t=${encodeURIComponent(getToken() || '')}`, {method: 'DELETE'})
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.message || `刪除「${display(card.word)}」失敗`)
    }
    await load()
    showSuccess(cards.length === 1 ? '詞卡已刪除' : `${cards.length} 張詞卡已刪除`)
  } catch (error) {
    showError(`刪除詞卡失敗：${error.message}`)
    await load()
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="word-home-page">
    <div class="phone-shell">
      <header class="top-bar">
        <div>
          <button v-if="activeGroup" type="button" class="back-button" aria-label="返回主頁" @click="closeFolder"><span>‹</span> 主頁</button>
          <template v-else><p class="eyebrow">學習詞卡</p><h1>詞卡主頁</h1></template>
        </div>
        <div class="top-actions">
          <button v-if="activeGroup" type="button" class="plain-button" @click="toggleManage">{{ managing ? '完成' : '管理' }}</button>
          <button type="button" class="save-button" :disabled="savingOrder || loading || refreshing" @click="saveOrder">{{ savingOrder ? '保存中…' : '保存排列' }}</button>
        </div>
      </header>

      <section v-if="loading" class="folder-grid initial-skeleton" aria-label="正在載入詞卡">
        <div v-for="item in 8" :key="item" class="folder-skeleton">
          <span></span><i></i><i></i>
        </div>
      </section>
      <div v-else-if="!groups.length" class="empty-state">
        <div class="empty-icon">＋</div><h2>還沒有文件夾</h2><p>請先在關卡編輯器中建立部分和章節。</p>
      </div>

      <template v-else-if="!activeGroup">
        <section class="home-summary">
          <div><strong>{{ groups.length }}</strong><span>個文件夾</span></div>
          <div><strong>{{ totalCards }}</strong><span>張詞卡</span></div>
        </section>
        <section class="folder-grid" :class="{'is-refreshing': refreshing}" :aria-busy="refreshing" aria-label="詞卡文件夾">
          <button v-for="(group, index) in groups" :key="group.chapterId" type="button" class="folder-item" @click="openFolder(group.chapterId)">
            <span class="folder" :class="folderTone(index)">
              <span class="folder-preview">
                <i v-for="card in group.wordCards.slice(0, 4)" :key="card.id">{{ display(card.word).slice(0, 1) || '字' }}</i>
                <i v-if="!group.wordCards.length" class="folder-placeholder">空</i>
              </span>
            </span>
            <strong>{{ display(group.chapterTitle) || `第 ${group.chapterOrder} 章` }}</strong>
            <small>第 {{ group.partOrder }} 部分 · {{ group.wordCards.length }} 張</small>
          </button>
        </section>
      </template>

      <template v-else>
        <section class="folder-heading">
          <div><p>第 {{ activeGroup.partOrder }} 部分 · 第 {{ activeGroup.chapterOrder }} 章</p><h1>{{ display(activeGroup.chapterTitle) || '未命名文件夾' }}</h1></div>
          <button type="button" class="add-card-button" @click="openNew(activeGroup.chapterId)"><span>＋</span> 新增詞卡</button>
        </section>

        <section v-if="managing" class="manage-bar">
          <button type="button" @click="selectAll">{{ selectedCount === activeGroup.wordCards.length && selectedCount ? '取消全選' : '全選' }}</button>
          <span>已選取 {{ selectedCount }} 張</span>
          <button type="button" class="danger-button" :disabled="!selectedCount || deleting" @click="deleteIds([...selectedIds])">{{ deleting ? '刪除中…' : '刪除' }}</button>
        </section>

        <section class="app-grid" :class="{managing, 'is-refreshing': refreshing}" :aria-busy="refreshing" aria-label="文件夾內的詞卡" @dragover.prevent @drop="dropCards(activeGroup)">
          <button
            v-for="card in activeGroup.wordCards" :key="card.id" type="button" class="app-item"
            :class="{selected: selectedIds.has(card.id), dragging: draggedIds.includes(card.id)}" draggable="true"
            @click="openEdit(card)" @dragstart="startDrag($event, card)" @dragend="finishDrag"
            @dragover.prevent.stop @drop.stop="dropCards(activeGroup, card.id)"
          >
            <span v-if="managing" class="select-dot">{{ selectedIds.has(card.id) ? '✓' : '' }}</span>
            <span class="app-icon" :class="cardTone(card)"><b>{{ display(card.word).slice(0, 2) || '詞' }}</b></span>
            <span class="app-name">{{ display(card.word) || '未命名詞卡' }}</span>
          </button>
          <button type="button" class="app-item add-app" @click="openNew(activeGroup.chapterId)"><span class="app-icon">＋</span><span class="app-name">新增詞卡</span></button>
        </section>
        <p v-if="!activeGroup.wordCards.length" class="folder-empty">這個文件夾是空的，點擊「新增詞卡」開始建立。</p>

        <section v-if="groups.length > 1" class="folder-dock">
          <p>拖到其他文件夾即可移動</p>
          <div>
            <button v-for="(group, index) in groups.filter(item => item.chapterId !== activeGroup.chapterId)" :key="group.chapterId" type="button" @dragover.prevent @drop.stop="dropCards(group)" @click="openFolder(group.chapterId)">
              <span class="mini-folder" :class="folderTone(index)"></span><span>{{ display(group.chapterTitle) || `第 ${group.chapterOrder} 章` }}</span>
            </button>
          </div>
        </section>
      </template>
    </div>

    <div v-if="editorVisible" class="modal-backdrop" @click.self="closeEditor">
      <section class="word-card-modal" role="dialog" aria-modal="true">
        <header><h2>{{ editorIsNew ? '新增詞卡' : '編輯詞卡' }}</h2><button type="button" aria-label="關閉" @click="closeEditor">×</button></header>
        <div class="modal-body">
          <h3>普通話</h3>
          <ScAndTcText v-model:traditional-text="editorForm.putonghua.tc" v-model:simplified-text="editorForm.putonghua.sc" layout="small" :dialect="dialect" />
          <h3>方言詞語</h3>
          <ScAndTcText v-model:traditional-text="editorForm.word.tc" v-model:simplified-text="editorForm.word.sc" layout="small" :dialect="dialect" />
          <h3>方言拼音</h3>
          <div class="pinyin-row">
            <input v-model="editorForm.pinyin" class="pinyin-input" placeholder="例如：go3 liak6">
            <div class="pinyin-preview" :class="{'is-empty': !editorForm.pinyin}">
              <span v-if="!editorForm.pinyin">預覽</span>
              <RichText v-else :language="language" :dialect="dialect" :model-value="editorForm.pinyin" :all-pinyin="true" />
            </div>
          </div>
        </div>
        <footer><button type="button" @click="closeEditor">取消</button><button type="button" :disabled="savingCard" @click="saveCard">{{ savingCard ? '保存中…' : '保存' }}</button></footer>
      </section>
    </div>
  </main>
</template>

<style scoped>
.word-home-page{min-height:100vh;padding:88px 20px 64px;color:#203329;background:radial-gradient(circle at 15% 15%,rgba(210,237,211,.72),transparent 26%),radial-gradient(circle at 88% 8%,rgba(255,231,181,.52),transparent 24%),linear-gradient(155deg,#f5faf2,#edf5eb 48%,#f7f5ea)}
.phone-shell{box-sizing:border-box;width:min(1120px,100%);min-height:720px;margin:auto;padding:28px 34px 32px;overflow:hidden;border:1px solid rgba(255,255,255,.82);border-radius:34px;background:rgba(255,255,255,.55);box-shadow:0 28px 80px rgba(52,84,58,.14),inset 0 1px rgba(255,255,255,.9);backdrop-filter:blur(20px)}
.top-bar{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:62px}.eyebrow,.folder-heading p{margin:0 0 4px;color:#78907c;font-size:.72rem;font-weight:800;letter-spacing:.14em}.top-bar h1,.folder-heading h1{margin:0;color:#274c32;font-size:clamp(1.45rem,3vw,2rem);letter-spacing:-.04em}.top-actions{display:flex;align-items:center;gap:9px}.top-actions button,.add-card-button,.manage-bar button{border:0;font:inherit;font-size:.78rem;font-weight:800;cursor:pointer}.plain-button{padding:10px 15px;color:#45634b;background:transparent}.save-button,.add-card-button{padding:10px 17px;border-radius:999px!important;color:#fff;background:#3d7950;box-shadow:0 8px 18px rgba(61,121,80,.2)}.save-button:disabled,.manage-bar button:disabled{opacity:.45;cursor:not-allowed}.back-button{padding:8px 10px 8px 0;border:0;color:#376543;background:transparent;font:inherit;font-weight:800;cursor:pointer}.back-button span{display:inline-block;margin-right:4px;font-size:1.8rem;line-height:.5;vertical-align:-2px}
.home-summary{display:flex;gap:12px;margin:26px 0 32px}.home-summary div{display:flex;align-items:baseline;gap:7px;padding:11px 15px;border:1px solid rgba(112,145,117,.16);border-radius:15px;background:rgba(255,255,255,.56)}.home-summary strong{color:#386144;font-size:1.1rem}.home-summary span{color:#829086;font-size:.72rem}.folder-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:32px 24px}.folder-item,.app-item{min-width:0;padding:0;border:0;color:inherit;background:transparent;font:inherit;text-align:center;cursor:pointer}.folder-item{display:flex;align-items:center;flex-direction:column;transition:transform .2s}.folder-item:hover{transform:translateY(-5px)}
.folder{position:relative;display:grid;place-items:center;width:118px;height:82px;margin:12px 0 14px;border-radius:14px 18px 18px 18px;background:#e8bd65;box-shadow:0 13px 26px rgba(91,79,44,.17),inset 0 1px rgba(255,255,255,.35)}.folder:before{content:'';position:absolute;top:-10px;left:0;width:48px;height:19px;border-radius:10px 13px 0 0;background:inherit}.folder-preview{position:absolute;inset:10px 8px 8px;display:grid;grid-template-columns:repeat(2,1fr);gap:4px;padding:7px;border-radius:10px;background:rgba(255,255,255,.28)}.folder-preview i{display:grid;place-items:center;border-radius:6px;color:rgba(53,61,39,.65);background:rgba(255,255,255,.52);font-size:.63rem;font-style:normal;font-weight:800}.folder-preview .folder-placeholder{grid-column:1/-1}.folder-item strong{width:100%;overflow:hidden;color:#304b37;font-size:.88rem;text-overflow:ellipsis;white-space:nowrap}.folder-item small{margin-top:4px;color:#849087;font-size:.66rem}.tone-0{background:#e7bd67!important}.tone-1{background:#8bb7a1!important}.tone-2{background:#d49a87!important}.tone-3{background:#92aada!important}.tone-4{background:#b59bc8!important}.tone-5{background:#84bdc3!important}
.initial-skeleton{margin-top:74px}.folder-skeleton{display:flex;align-items:center;flex-direction:column;gap:8px}.folder-skeleton span,.folder-skeleton i,.is-refreshing .folder,.is-refreshing .app-icon,.is-refreshing .folder-item strong,.is-refreshing .folder-item small,.is-refreshing .app-name{background:linear-gradient(100deg,#e2e9e2 25%,#f4f7f3 43%,#e2e9e2 62%)!important;background-size:300% 100%!important;animation:skeleton-wave 1.25s ease-in-out infinite!important}.folder-skeleton span{width:118px;height:82px;margin:12px 0 6px;border-radius:14px 18px 18px}.folder-skeleton i{display:block;width:82px;height:12px;border-radius:6px}.folder-skeleton i:last-child{width:58px;height:9px}.is-refreshing{pointer-events:none}.is-refreshing .folder,.is-refreshing .app-icon{border-color:transparent!important;box-shadow:none!important}.is-refreshing .folder:before{background:#e2e9e2}.is-refreshing .folder-preview,.is-refreshing .app-icon b{visibility:hidden}.is-refreshing .folder-item strong,.is-refreshing .folder-item small,.is-refreshing .app-name{color:transparent!important;border-radius:6px}.is-refreshing .folder-item strong{width:82px;height:13px}.is-refreshing .folder-item small{width:58px;height:9px}.is-refreshing .app-name{height:11px}.is-refreshing .add-app{display:none}
.folder-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:26px 0 24px;padding-bottom:20px;border-bottom:1px solid rgba(95,126,101,.14)}.add-card-button span{margin-right:3px;font-size:1rem}.manage-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:20px;padding:10px 13px;border-radius:16px;background:rgba(255,255,255,.65);box-shadow:0 7px 20px rgba(63,89,67,.07)}.manage-bar button{justify-self:start;padding:8px 11px;color:#3b6946;background:transparent}.manage-bar span{color:#6d7f70;font-size:.73rem;font-weight:700}.manage-bar .danger-button{justify-self:end;color:#aa5353}
.app-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));align-content:start;gap:28px 18px;min-height:205px;padding:8px 2px 30px}.app-item{position:relative;display:flex;align-items:center;flex-direction:column;gap:9px;border-radius:18px;transition:transform .18s,opacity .18s}.app-item:hover{transform:translateY(-4px)}.app-item.dragging{opacity:.4}.managing .app-item:not(.add-app){animation:wiggle .24s ease-in-out infinite alternate}.app-icon{box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-direction:column;width:72px;height:72px;padding:8px;overflow:hidden;border:1px solid rgba(255,255,255,.55);border-radius:19px;color:#fff;background:#6fa280;box-shadow:0 10px 21px rgba(48,79,57,.19),inset 0 1px rgba(255,255,255,.35)}.app-icon b{max-width:100%;overflow:hidden;font-size:1.15rem;letter-spacing:.04em;text-overflow:ellipsis;white-space:nowrap}.app-name{width:96px;overflow:hidden;color:#35483a;font-size:.73rem;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.select-dot{position:absolute;z-index:2;top:-7px;right:calc(50% - 43px);display:grid;place-items:center;width:21px;height:21px;border:2px solid #fff;border-radius:50%;color:#fff;background:#b8c2ba;box-shadow:0 3px 9px rgba(49,69,53,.22);font-size:.7rem;font-weight:900}.app-item.selected .select-dot{background:#397b4b}.add-app .app-icon{border:1px dashed #9db3a1;color:#5f7f66;background:rgba(255,255,255,.42)!important;box-shadow:none;font-size:1.7rem}.folder-empty{margin:-95px 0 90px;color:#849287;font-size:.76rem;text-align:center}
.folder-dock{margin-top:20px;padding:17px;border:1px solid rgba(255,255,255,.7);border-radius:20px;background:rgba(235,243,233,.72)}.folder-dock>p{margin:0 0 12px;color:#78877b;font-size:.67rem;font-weight:700}.folder-dock>div{display:flex;gap:10px;overflow-x:auto}.folder-dock button{display:flex;align-items:center;gap:8px;flex:0 0 auto;max-width:155px;padding:8px 11px;border:1px solid rgba(107,138,111,.16);border-radius:12px;color:#49604e;background:rgba(255,255,255,.68);font:inherit;font-size:.68rem;font-weight:700;cursor:pointer}.folder-dock button span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mini-folder{position:relative;width:24px;height:17px;border-radius:3px;background:#e7bd67}.mini-folder:before{content:'';position:absolute;top:-3px;left:0;width:10px;height:5px;border-radius:2px 2px 0 0;background:inherit}
.empty-state{display:grid;place-items:center;padding:120px 20px;color:#718276;text-align:center}.empty-icon{display:grid;place-items:center;width:72px;height:72px;border:1px dashed #9eb2a1;border-radius:22px;color:#719078;font-size:2rem}.empty-state h2{margin:18px 0 6px;color:#405e47}.empty-state p{margin:0;font-size:.8rem}.modal-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:20px;background:rgba(25,45,30,.4);backdrop-filter:blur(7px)}.word-card-modal{width:min(820px,100%);max-height:calc(100vh - 40px);overflow:auto;border:1px solid rgba(255,255,255,.8);border-radius:24px;background:#f8fff8;box-shadow:0 24px 70px rgba(22,61,27,.28)}.word-card-modal>header,.word-card-modal>footer{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #d7e8d8}.word-card-modal h2{margin:0;color:#355d3d}.word-card-modal>header button{border:0;background:transparent;font-size:1.5rem;cursor:pointer}.modal-body{padding:18px 20px}.modal-body h3{margin:16px 0 9px;color:#4f6f55;font-size:.86rem}.pinyin-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.65fr);align-items:stretch;gap:12px}.pinyin-input{box-sizing:border-box;width:100%;min-height:48px;padding:10px 13px;border:2px solid #8baa91;border-radius:9px;background:#fff;box-shadow:0 0 0 3px rgba(87,139,98,.08);font:inherit;outline:none;transition:border-color .2s,box-shadow .2s}.pinyin-input:focus{border-color:#397b4b;box-shadow:0 0 0 4px rgba(57,123,75,.15)}.pinyin-preview{display:flex;align-items:stretch;min-width:0}.pinyin-preview.is-empty{align-items:center;padding:0 15px;border:1px dashed #bacabd;border-radius:9px;color:#96a299;background:rgba(255,255,255,.48);font-size:.76rem}.pinyin-preview :deep(.result){box-sizing:border-box;display:flex;align-items:center;width:100%;min-height:48px;margin:0}.word-card-modal>footer{justify-content:flex-end;gap:9px;border-top:1px solid #d7e8d8;border-bottom:0}.word-card-modal>footer button{padding:8px 14px;border:1px solid #b9d2bc;border-radius:999px;color:#47784f;background:#fff;cursor:pointer}.word-card-modal>footer button:last-child{color:#fff;background:#3d7950}@keyframes wiggle{from{transform:rotate(-.7deg)}to{transform:rotate(.7deg)}}@keyframes skeleton-wave{0%{background-position:100% 0}100%{background-position:0 0}}
@media(max-width:720px){.word-home-page{padding:76px 8px 24px}.phone-shell{min-height:calc(100vh - 88px);padding:20px 15px 25px;border-radius:26px}.top-bar{align-items:flex-start}.top-actions{gap:2px}.plain-button{padding-inline:8px}.save-button{padding:9px 12px}.folder-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:27px 8px}.folder{width:86px;height:64px}.folder-preview{inset:8px 6px 6px;padding:5px}.folder-item strong{font-size:.76rem}.folder-item small{font-size:.58rem}.folder-heading{align-items:flex-start}.add-card-button{padding:9px 12px}.app-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 4px}.app-icon{width:62px;height:62px;border-radius:17px}.app-name{width:72px;font-size:.66rem}.select-dot{right:calc(50% - 36px)}.folder-dock{margin-top:10px}.word-card-modal{border-radius:20px}.pinyin-row{grid-template-columns:1fr}}
@media(max-width:390px){.folder-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.app-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>
