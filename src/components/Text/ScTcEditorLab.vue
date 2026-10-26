<script setup>
import { computed, ref, watch } from 'vue'
import { request } from '../../services/request.js'
import { MACHINE_SC, MACHINE_TC, packPair, retainTranslated, unpackPair } from '../../utils/scTcLab.js'
import { actionsExpanded } from '../../utils/scTcEditorPreferences.js'
import writingIcon from '../../assets/书写.svg'
import expandIcon from '../../assets/icons/to-down.svg'
import collapseIcon from '../../assets/icons/to-up.svg'

const props = defineProps({ pair: { type: Object, required: true }, dialect: { type: String, required: true }, mode: { type: String, required: true } })
const emit = defineEmits(['update:pair', 'draft-change'])
const saved = ref({ sc: '', tc: '' })
const draft = ref({ sc: '', tc: '' })
const marker = ref('')
const busy = ref(false)
const error = ref('')
const changed = computed(() => draft.value.sc !== saved.value.sc || draft.value.tc !== saved.value.tc)
const tcDirty = computed(() => draft.value.tc !== saved.value.tc)
const scDirty = computed(() => draft.value.sc !== saved.value.sc)
const isMachine = language => marker.value === (language === 'sc' ? MACHINE_SC : MACHINE_TC)
const isEditing = language => language === 'sc' ? scDirty.value : tcDirty.value
const isChecked = computed(() => !tcDirty.value && !scDirty.value && !marker.value)

watch(() => [draft.value.sc, draft.value.tc], ([sc, tc]) => {
  emit('draft-change', { sc, tc })
}, { immediate: true })

watch(() => props.pair, value => {
  try {
    const parsed = unpackPair(value)
    saved.value = { sc: parsed.sc, tc: parsed.tc }
    draft.value = { ...saved.value }
    marker.value = parsed.marker
    error.value = ''
  } catch (e) { error.value = e.message }
}, { immediate: true, deep: false })

async function synchronize() {
  if (busy.value) return false
  error.value = ''
  const source = props.mode === 'sc' ? 'sc' : 'tc'
  const target = source === 'sc' ? 'tc' : 'sc'
  if (props.mode === 'pair') {
    if (!changed.value) {
      if (!marker.value) return true
      marker.value = ''
      emit('update:pair', packPair(saved.value))
      return true
    }
    if (tcDirty.value && scDirty.value) {
      error.value = '简体和繁体都有待同步修改，请先恢复一侧'
      return false
    }
    // 双栏只改繁体时仍增量生成简体；只改简体时沿用旧框的校对流程。
    if (draft.value.tc !== saved.value.tc && draft.value.sc === saved.value.sc) {
      return synchronizeTranslation('tc', '')
    }
    if (Array.from(draft.value.sc).length !== Array.from(draft.value.tc).length) {
      error.value = '简繁字数不一致，请检查双栏内容'
      return false
    }
    try {
      const pair = packPair(draft.value)
      saved.value = { ...draft.value }
      marker.value = ''
      emit('update:pair', pair)
      return true
    } catch (e) { error.value = e.message; return false }
  }
  if (draft.value[target] !== saved.value[target]) {
    error.value = '另一栏有未同步的修改，请先切到简繁体对照处理'
    return false
  }
  if (!changed.value) return true
  return synchronizeTranslation(source, source === 'tc' ? MACHINE_SC : MACHINE_TC)
}

function restore() {
  draft.value = { ...saved.value }
  error.value = ''
}

function clearAll() {
  if (busy.value) return
  saved.value = { sc: '', tc: '' }
  draft.value = { ...saved.value }
  marker.value = ''
  error.value = ''
  emit('update:pair', packPair(saved.value))
}

async function previewPair() {
  const source = props.mode === 'sc' ? 'sc' : 'tc'
  if (props.mode === 'pair' && !tcDirty.value) return { ...draft.value }
  if (props.mode !== 'pair' && !changed.value) return { ...draft.value }
  const target = source === 'sc' ? 'tc' : 'sc'
  const snapshot = draft.value[source]
  const machine = await request('/api/proofread/translate?from=' + source + '&to=' + target, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: snapshot
  })
  if (draft.value[source] !== snapshot) throw new Error('输入已变化，请重新打开预览')
  const translated = retainTranslated(saved.value[source], snapshot, saved.value[target], machine)
  return { ...draft.value, [target]: translated }
}

async function synchronizeTranslation(source, nextMarker) {
  const target = source === 'sc' ? 'tc' : 'sc'
  const snapshot = draft.value[source]
  busy.value = true
  try {
    const machine = await request('/api/proofread/translate?from=' + source + '&to=' + target, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: snapshot
    })
    if (draft.value[source] !== snapshot) throw new Error('输入已变化，请重新同步')
    const translated = retainTranslated(saved.value[source], snapshot, saved.value[target], machine)
    const next = { ...saved.value, [source]: snapshot, [target]: translated }
    const pair = packPair(next, nextMarker)
    saved.value = next
    draft.value = { ...next }
    marker.value = nextMarker
    emit('update:pair', pair)
    return true
  } catch (e) { error.value = e.message || '同步失败'; return false }
  finally { busy.value = false }
}

function onKeydown(event) {
  if (props.mode !== 'pair') return
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    synchronize()
  }
}

defineExpose({ synchronize, previewPair, hasPendingChanges: () => changed.value })
</script>

<template>
  <div class="lab-editor">
    <p v-if="mode === 'pair' && tcDirty && scDirty" class="lab-invalid" role="status">简体和繁体都有待同步修改</p>
    <div class="lab-fields">
      <label v-if="mode !== 'sc'" class="lab-field">
        <span class="lab-field__title">繁体
          <img v-if="isEditing('tc')" class="lab-writing" :src="writingIcon" alt="繁体编辑中" />
          <svg v-if="isMachine('tc')" class="lab-status lab-status--machine" viewBox="0 0 24 24" role="img" aria-label="繁体机翻待检查"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.8-1.7 1.2-1.7 2.6M12 17h.01"/></svg>
          <svg v-if="isChecked" class="lab-status lab-status--checked" viewBox="0 0 24 24" role="img" aria-label="繁体已确定"><path d="m5 12 4.5 4.5L19 7"/></svg>
        </span>
        <textarea v-model="draft.tc" :disabled="busy || (mode === 'pair' && scDirty)" rows="7" @keydown="onKeydown" />
      </label>
      <label v-if="mode !== 'tc'" class="lab-field">
        <span class="lab-field__title">简体
          <img v-if="isEditing('sc')" class="lab-writing" :src="writingIcon" alt="简体编辑中" />
          <svg v-if="isMachine('sc')" class="lab-status lab-status--machine" viewBox="0 0 24 24" role="img" aria-label="简体机翻待检查"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.8-1.7 1.2-1.7 2.6M12 17h.01"/></svg>
          <svg v-if="isChecked" class="lab-status lab-status--checked" viewBox="0 0 24 24" role="img" aria-label="简体已确定"><path d="m5 12 4.5 4.5L19 7"/></svg>
        </span>
        <textarea v-model="draft.sc" :disabled="busy || (mode === 'pair' && tcDirty)" rows="7" @keydown="onKeydown" />
      </label>
    </div>
    <div class="lab-tools">
      <button type="button" class="lab-tools__toggle" :aria-expanded="actionsExpanded" @click="actionsExpanded = !actionsExpanded">{{ actionsExpanded ? '收起操作' : '展开操作' }}<img :src="actionsExpanded ? collapseIcon : expandIcon" alt="" /></button>
      <div v-if="actionsExpanded" class="lab-tools__actions">
        <button v-if="mode === 'pair'" type="button" class="lab-action lab-action--primary" :disabled="busy" @click="synchronize" title="同步或确认检查">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h16m-5-4 5 4-5 4M3 17h16m-5-4 5 4-5 4"/></svg>{{ busy ? '同步中…' : '手动同步（Ctrl/⌘+Enter）' }}
        </button>
        <button type="button" class="lab-action" :disabled="busy || !changed" @click="restore" title="恢复尚未同步的输入">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 4 11l5 5M4 11h11a5 5 0 0 1 0 10"/></svg>恢复
        </button>
        <button type="button" class="lab-action" :disabled="busy" @click="clearAll" title="清空简体和繁体">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg>清空
        </button>
      </div>
    </div>
    <p v-if="error" class="lab-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.lab-editor { padding: 24px; border: 1px solid #d8ded9; border-radius: 16px; background: #fff; box-shadow: 0 8px 26px rgba(26, 52, 34, .06); }
.lab-invalid { margin: 0 0 14px; color: #ad4a34; font-size: .88rem; }
.lab-fields { display: flex; gap: 18px; flex-wrap: wrap; }
.lab-field { display: grid; gap: 9px; flex: 1; min-width: 230px; color: #294535; font-weight: 650; }
.lab-field__title { display: inline-flex; align-items: center; gap: 8px; }
.lab-status { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.lab-writing { width: 18px; height: 18px; object-fit: contain; }
.lab-status--machine { color: #a66a27; }
.lab-status--checked { color: #34784c; }
.lab-field textarea { box-sizing: border-box; width: 100%; resize: vertical; border: 1px solid #c8d2ca; border-radius: 10px; background: #fbfcfa; color: #203228; font: inherit; font-weight: 400; line-height: 1.6; padding: 12px 14px; outline: none; }
.lab-field textarea:focus { border-color: #37744d; box-shadow: 0 0 0 3px rgba(55, 116, 77, .11); }
.lab-field textarea:disabled { color: #89958c; background: #f0f3f0; }
.lab-tools { margin-top: 15px; }
.lab-tools__toggle { border: 0; background: transparent; color: #52675a; font-size: .85rem; cursor: pointer; padding: 4px 0; }
.lab-tools__toggle img { width: 11px; height: 11px; margin-left: 7px; vertical-align: middle; }
.lab-tools__actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.lab-action { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #b8c9bc; border-radius: 8px; background: white; color: #315e40; padding: 8px 13px; cursor: pointer; }
.lab-action--primary { border-color: #315e40; background: #315e40; color: white; }
.lab-action:disabled { opacity: .5; cursor: not-allowed; }
.lab-action svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.lab-error { color: #b42318; margin: 12px 0 0; }
</style>
