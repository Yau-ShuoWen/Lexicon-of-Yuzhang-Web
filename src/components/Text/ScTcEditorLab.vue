<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { request } from '../../services/request.js'
import RichText from './RichText.vue'
import { MACHINE_SC, MACHINE_TC, packPair, retainTranslated, unpackPair } from '../../utils/scTcLab.js'
import { actionsExpanded } from '../../utils/scTcEditorPreferences.js'
import { useUserSettings } from '../../utils/userSettings.js'
import writingIcon from '../../assets/书写.svg'
import expandIcon from '../../assets/icons/to-down.svg'
import collapseIcon from '../../assets/icons/to-up.svg'
import eyeIcon from '../../assets/icons/eye-open.svg'

const props = defineProps({
  pair: { type: Object, required: true },
  dialect: { type: String, required: true },
  mode: { type: String, default: '' },
  layout: { type: String, default: 'large' },
  richText: { type: Boolean, default: true }
})
const emit = defineEmits(['update:pair', 'draft-change'])
const settings = useUserSettings()
const effectiveMode = computed(() => props.mode || settings.editorLanguage)
const saved = ref({ sc: '', tc: '' })
const draft = ref({ sc: '', tc: '' })
const machineSide = ref('')
const busy = ref(false)
const error = ref('')
const hovered = ref(false)
const previewVisible = ref(false)
const previewHeld = ref(false)
const previewPointerHeld = ref(false)
const previewError = ref('')
const previewData = ref({ sc: '', tc: '' })
const previewMode = ref('pair')
let previewVersion = 0
const tcBox = ref(null)
const scBox = ref(null)
const mobile = ref(false)
const isWordLayout = computed(() => props.layout === 'small')
const isSentenceLayout = computed(() => props.layout === 'small-sentence')
const usesInput = computed(() => isWordLayout.value || (isSentenceLayout.value && !mobile.value))
const showActions = computed(() => isWordLayout.value || actionsExpanded.value)
const rows = computed(() => {
  if (isWordLayout.value) return 1
  if (isSentenceLayout.value) return mobile.value ? 3 : 1
  return mobile.value ? (props.layout === 'middle' ? 3 : 5) : (props.layout === 'middle' ? 7 : 12)
})
let heightObserver = null
let mirroredScroll = null
let mobileQuery = null

function syncScroll(event, target) {
  if (effectiveMode.value !== 'pair' || isWordLayout.value || !target) return
  const source = event.currentTarget
  if (mirroredScroll?.element === source && mirroredScroll.top === source.scrollTop) {
    mirroredScroll = null
    return
  }
  mirroredScroll = null
  if (target.scrollTop === source.scrollTop) return
  target.scrollTop = source.scrollTop
  mirroredScroll = { element: target, top: target.scrollTop }
}

watch([tcBox, scBox, rows], ([tc, sc]) => {
  heightObserver?.disconnect()
  heightObserver = null
  if (tc) tc.style.height = ''
  if (sc) sc.style.height = ''
  if (!tc || !sc) return

  const height = Math.max(tc.getBoundingClientRect().height, sc.getBoundingClientRect().height)
  tc.style.height = `${height}px`
  sc.style.height = `${height}px`
  heightObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const source = entry.target
      const target = source === tc ? sc : tc
      const nextHeight = source.getBoundingClientRect().height
      if (Math.abs(target.getBoundingClientRect().height - nextHeight) >= 1) {
        target.style.height = `${nextHeight}px`
      }
    }
  })
  heightObserver.observe(tc)
  heightObserver.observe(sc)
}, { flush: 'post' })
const changed = computed(() => draft.value.sc !== saved.value.sc || draft.value.tc !== saved.value.tc)
const tcDirty = computed(() => draft.value.tc !== saved.value.tc)
const scDirty = computed(() => draft.value.sc !== saved.value.sc)
const isMachine = language => machineSide.value === (language === 'sc' ? MACHINE_SC : MACHINE_TC)
const isEditing = language => language === 'sc' ? scDirty.value : tcDirty.value
const isChecked = computed(() => !tcDirty.value && !scDirty.value && !machineSide.value)

watch(() => [draft.value.sc, draft.value.tc], ([sc, tc]) => {
  emit('draft-change', { sc, tc })
}, { immediate: true })

watch(() => props.pair, value => {
  try {
    const parsed = unpackPair(value)
    saved.value = { sc: parsed.sc, tc: parsed.tc }
    draft.value = { ...saved.value }
    machineSide.value = parsed.machineSide
    error.value = ''
  } catch (e) { error.value = e.message }
}, { immediate: true, deep: false })

async function synchronize() {
  if (busy.value) return false
  error.value = ''
  const source = effectiveMode.value === 'sc' ? 'sc' : 'tc'
  const target = source === 'sc' ? 'tc' : 'sc'
  if (effectiveMode.value === 'pair') {
    if (!changed.value) {
      if (!machineSide.value) return true
      machineSide.value = ''
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
      machineSide.value = ''
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
  machineSide.value = ''
  error.value = ''
  emit('update:pair', packPair(saved.value))
}

async function previewPair() {
  if (effectiveMode.value !== 'pair' || !tcDirty.value) return { ...draft.value }
  const snapshot = draft.value.tc
  const machine = await request('/api/proofread/translate?from=tc&to=sc', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: snapshot
  })
  if (draft.value.tc !== snapshot) throw new Error('输入已变化，请重新打开预览')
  const translated = retainTranslated(saved.value.tc, snapshot, saved.value.sc, machine)
  return { ...draft.value, sc: translated }
}

async function openPreview() {
  const version = ++previewVersion
  previewMode.value = effectiveMode.value
  previewData.value = { ...draft.value }
  previewVisible.value = true
  previewError.value = ''
  try {
    const pair = await previewPair()
    if (version === previewVersion && previewVisible.value) previewData.value = pair
  } catch (e) {
    if (version === previewVersion && previewVisible.value) previewError.value = e.message || '预览失败'
  }
}

function closePreview() {
  previewVersion++
  previewVisible.value = false
  previewHeld.value = false
  previewPointerHeld.value = false
}

function onPreviewPointerDown(event) {
  if (event.button !== 0 || previewPointerHeld.value) return
  event.preventDefault()
  previewPointerHeld.value = true
  if (!previewVisible.value) openPreview()
}

function onPreviewPointerUp() {
  if (!previewPointerHeld.value) return
  previewPointerHeld.value = false
  if (!previewHeld.value) closePreview()
}

function onPreviewKeydown(event) {
  if (!props.richText) return
  if (event.key === 'Escape' && previewVisible.value) { closePreview(); return }
  if (event.key !== 'F2' || !hovered.value || event.repeat || previewHeld.value) return
  event.preventDefault()
  previewHeld.value = true
  if (!previewVisible.value) openPreview()
}

function onPreviewKeyup(event) {
  if (event.key !== 'F2' || !previewHeld.value) return
  previewHeld.value = false
  if (!previewPointerHeld.value) closePreview()
}

function onPointerLeave() {
  hovered.value = false
  if (previewHeld.value || previewPointerHeld.value) closePreview()
}

function onWindowBlur() {
  if (previewHeld.value || previewPointerHeld.value) closePreview()
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 640px)')
  mobile.value = mobileQuery.matches
  mobileQuery.addEventListener('change', onMobileChange)
  window.addEventListener('keydown', onPreviewKeydown)
  window.addEventListener('keyup', onPreviewKeyup)
  window.addEventListener('pointerup', onPreviewPointerUp)
  window.addEventListener('pointercancel', onPreviewPointerUp)
  window.addEventListener('blur', onWindowBlur)
})
onUnmounted(() => {
  heightObserver?.disconnect()
  mobileQuery?.removeEventListener('change', onMobileChange)
  window.removeEventListener('keydown', onPreviewKeydown)
  window.removeEventListener('keyup', onPreviewKeyup)
  window.removeEventListener('pointerup', onPreviewPointerUp)
  window.removeEventListener('pointercancel', onPreviewPointerUp)
  window.removeEventListener('blur', onWindowBlur)
  previewVersion++
})

function onMobileChange(event) {
  mobile.value = event.matches
}

async function synchronizeTranslation(source, nextMachineSide) {
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
    const pair = packPair(next, nextMachineSide)
    saved.value = next
    draft.value = { ...next }
    machineSide.value = nextMachineSide
    emit('update:pair', pair)
    return true
  } catch (e) { error.value = e.message || '同步失败'; return false }
  finally { busy.value = false }
}

function onKeydown(event) {
  if (event.key !== 'Enter' || event.isComposing) return
  if (effectiveMode.value === 'pair' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    synchronize()
  } else if (isWordLayout.value || isSentenceLayout.value) {
    event.preventDefault()
  }
}

function onSentencePaste(event) {
  const pasted = event.clipboardData?.getData('text/plain')
  if (!pasted || !/[\r\n]/.test(pasted)) return
  event.preventDefault()
  const box = event.currentTarget
  box.setRangeText(pasted.replace(/\s*[\r\n]+\s*/g, ' '), box.selectionStart, box.selectionEnd, 'end')
  box.dispatchEvent(new Event('input', { bubbles: true }))
}

defineExpose({ synchronize, hasPendingChanges: () => changed.value })
</script>

<template>
  <div class="lab-editor" :class="[`lab-editor--${layout}`, { 'lab-editor--plain': !richText }]" @mouseenter="hovered = true" @mouseleave="onPointerLeave">
    <p v-if="effectiveMode === 'pair' && tcDirty && scDirty" class="lab-invalid" role="status">简体和繁体都有待同步修改</p>
    <div class="lab-fields">
      <label v-if="effectiveMode !== 'sc'" class="lab-field">
        <span v-if="effectiveMode === 'pair' && !isWordLayout" class="lab-field__title">繁体
          <img v-if="isEditing('tc')" class="lab-writing" :src="writingIcon" alt="繁体编辑中" />
          <svg v-if="isMachine('tc')" class="lab-status lab-status--machine" viewBox="0 0 24 24" role="img" aria-label="繁体机翻待检查"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.8-1.7 1.2-1.7 2.6M12 17h.01"/></svg>
          <svg v-if="isChecked" class="lab-status lab-status--checked" viewBox="0 0 24 24" role="img" aria-label="繁体已确定"><path d="m5 12 4.5 4.5L19 7"/></svg>
        </span>
        <input v-if="usesInput" ref="tcBox" v-model="draft.tc" type="text" :placeholder="effectiveMode === 'pair' && isWordLayout ? '繁体' : ''" :aria-label="effectiveMode === 'pair' ? '繁体内容' : '输入内容'" :disabled="busy || (effectiveMode === 'pair' && scDirty)" @keydown="onKeydown" />
        <textarea v-else ref="tcBox" v-model="draft.tc" :aria-label="effectiveMode === 'pair' ? '繁体内容' : '输入内容'" :disabled="busy || (effectiveMode === 'pair' && scDirty)" :rows="rows" @keydown="onKeydown" @paste="isSentenceLayout && onSentencePaste($event)" @scroll="syncScroll($event, scBox)" />
      </label>
      <label v-if="effectiveMode !== 'tc'" class="lab-field">
        <span v-if="effectiveMode === 'pair' && !isWordLayout" class="lab-field__title">简体
          <img v-if="isEditing('sc')" class="lab-writing" :src="writingIcon" alt="简体编辑中" />
          <svg v-if="isMachine('sc')" class="lab-status lab-status--machine" viewBox="0 0 24 24" role="img" aria-label="简体机翻待检查"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.8-1.7 1.2-1.7 2.6M12 17h.01"/></svg>
          <svg v-if="isChecked" class="lab-status lab-status--checked" viewBox="0 0 24 24" role="img" aria-label="简体已确定"><path d="m5 12 4.5 4.5L19 7"/></svg>
        </span>
        <input v-if="usesInput" ref="scBox" v-model="draft.sc" type="text" :placeholder="effectiveMode === 'pair' && isWordLayout ? '简体' : ''" :aria-label="effectiveMode === 'pair' ? '简体内容' : '输入内容'" :disabled="busy || (effectiveMode === 'pair' && tcDirty)" @keydown="onKeydown" />
        <textarea v-else ref="scBox" v-model="draft.sc" :aria-label="effectiveMode === 'pair' ? '简体内容' : '输入内容'" :disabled="busy || (effectiveMode === 'pair' && tcDirty)" :rows="rows" @keydown="onKeydown" @paste="isSentenceLayout && onSentencePaste($event)" @scroll="syncScroll($event, tcBox)" />
      </label>
    </div>
    <div v-if="richText" class="lab-tools">
      <button v-if="!isWordLayout" type="button" class="lab-action" :aria-label="actionsExpanded ? '收起' : '展开'" :aria-expanded="actionsExpanded" @click="actionsExpanded = !actionsExpanded"><img :src="actionsExpanded ? collapseIcon : expandIcon" alt="" /></button>
      <div v-if="showActions" :class="isWordLayout ? 'lab-tools__inline' : 'lab-tools__menu'">
        <button type="button" class="lab-action" aria-label="按住预览" @pointerdown="onPreviewPointerDown"><img :src="eyeIcon" alt="" /></button>
        <button v-if="effectiveMode === 'pair'" type="button" class="lab-action lab-action--primary" :aria-label="busy ? '同步中' : '同步'" :disabled="busy" @click="synchronize"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h16m-5-4 5 4-5 4M3 17h16m-5-4 5 4-5 4"/></svg></button>
        <button type="button" class="lab-action" aria-label="恢复" :disabled="busy || !changed" @click="restore"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 4 11l5 5M4 11h11a5 5 0 0 1 0 10"/></svg></button>
        <button type="button" class="lab-action" aria-label="清空" :disabled="busy" @click="clearAll"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg></button>
      </div>
    </div>
    <p v-if="error" class="lab-error" role="alert">{{ error }}</p>
    <div v-if="richText && previewVisible" class="lab-preview-overlay" role="dialog" aria-label="文本预览">
      <p v-if="previewError" class="lab-error" role="alert">{{ previewError }}</p>
      <div class="lab-preview-content" :class="{ 'lab-preview-content--single': previewMode !== 'pair' }">
        <section v-if="previewMode !== 'sc'"><h3 v-if="previewMode === 'pair'">繁体</h3><div class="lab-preview-text"><RichText :model-value="previewData.tc" language="tc" :dialect="dialect" plain /></div></section>
        <section v-if="previewMode !== 'tc'"><h3 v-if="previewMode === 'pair'">简体</h3><div class="lab-preview-text"><RichText :model-value="previewData.sc" language="sc" :dialect="dialect" plain /></div></section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-editor { position: relative; box-sizing: border-box; container-type: inline-size; padding: 24px; border: 1px solid #d8ded9; border-radius: 16px; background: #fff; box-shadow: 0 8px 26px rgba(26, 52, 34, .06); }
.lab-editor--middle { padding: 18px; }
.lab-editor--small, .lab-editor--small-sentence { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; container-type: normal; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; vertical-align: middle; }
.lab-editor--small-sentence { width: 100%; align-items: flex-end; container-type: inline-size; }
.lab-invalid { margin: 0 0 14px; color: #ad4a34; font-size: .88rem; }
.lab-fields { display: flex; align-items: flex-start; gap: 18px; flex-wrap: wrap; }
.lab-field { display: flex; flex-direction: column; align-items: stretch; gap: 9px; flex: 1; min-width: 230px; color: #294535; font-weight: 650; }
.lab-field__title { display: inline-flex; align-items: center; gap: 8px; }
.lab-status { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.lab-writing { width: 18px; height: 18px; object-fit: contain; }
.lab-status--machine { color: #a66a27; }
.lab-status--checked { color: #34784c; }
.lab-field textarea { box-sizing: border-box; width: 100%; resize: vertical; border: 1px solid #c8d2ca; border-radius: 10px; background: #fbfcfa; color: #203228; font: inherit; font-weight: 400; line-height: 1.6; padding: 12px 14px; outline: none; }
.lab-field textarea:focus { border-color: #37744d; box-shadow: 0 0 0 3px rgba(55, 116, 77, .11); }
.lab-field textarea:disabled { color: #89958c; background: #f0f3f0; }
.lab-editor--small .lab-fields { gap: 6px; flex-wrap: nowrap; }
.lab-editor--small .lab-field { flex: 0 1 130px; min-width: 0; width: 130px; }
.lab-editor--small-sentence .lab-fields { flex: 1 1 auto; min-width: 0; flex-direction: column; align-items: stretch; gap: 8px; }
.lab-editor--small-sentence .lab-field { flex-direction: row; align-items: center; width: 100%; min-width: 0; gap: 10px; }
.lab-editor--small-sentence .lab-field__title { flex: 0 0 72px; }
.lab-editor--small .lab-field input, .lab-editor--small-sentence .lab-field input { box-sizing: border-box; width: 100%; height: 34px; padding: 4px 9px; border: 1px solid #c8d2ca; border-radius: 6px; background: #fff; color: #203228; font: inherit; font-weight: 400; outline: none; }
.lab-editor--small .lab-field input:focus, .lab-editor--small-sentence .lab-field input:focus { border-color: #37744d; box-shadow: 0 0 0 2px rgba(55, 116, 77, .11); }
.lab-editor--small .lab-field input:disabled, .lab-editor--small-sentence .lab-field input:disabled { color: #89958c; background: #f0f3f0; }
.lab-editor--small-sentence .lab-field textarea, .lab-editor--small-sentence .lab-field input { flex: 1 1 auto; min-width: 0; width: auto; }
.lab-tools { position: relative; width: max-content; margin-top: 14px; }
.lab-editor--small .lab-tools, .lab-editor--small-sentence .lab-tools { flex: none; margin-top: 0; }
.lab-tools__menu { position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 2; display: grid; grid-template-columns: repeat(2, 36px); gap: 8px; padding: 8px; border: 1px solid #d8ded9; border-radius: 10px; background: white; box-shadow: 0 8px 22px rgba(26, 52, 34, .14); }
.lab-tools__inline { display: flex; gap: 8px; }
.lab-editor--small-sentence .lab-tools__menu { right: 0; left: auto; }
.lab-action { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid #b8c9bc; border-radius: 8px; background: white; color: #315e40; padding: 8px; cursor: pointer; }
.lab-action--primary { border-color: #315e40; background: #315e40; color: white; }
.lab-action:disabled { opacity: .5; cursor: not-allowed; }
.lab-action svg, .lab-action img { width: 18px; height: 18px; flex: none; }
.lab-action svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.lab-error { color: #b42318; margin: 12px 0 0; }
.lab-preview-overlay { position: absolute; inset: 0; z-index: 3; overflow: auto; padding: 24px; border-radius: 16px; background: #fff; box-shadow: 0 10px 28px rgba(26, 52, 34, .13); }
.lab-preview-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.lab-preview-content--single { grid-template-columns: 1fr; }
.lab-preview-content section { min-width: 0; }
.lab-preview-content:not(.lab-preview-content--single) section + section { position: relative; }
.lab-preview-content:not(.lab-preview-content--single) section + section::before { position: absolute; top: 0; bottom: 0; left: -9px; border-left: 1px solid #bdcdbf; content: ''; }
.lab-preview-content h3 { margin: 0 0 9px; color: #294535; font-size: 1rem; line-height: 20px; }
.lab-preview-text { padding: 12px 14px; line-height: 1.6; }
@container (max-width: 520px) {
  .lab-editor:not(.lab-editor--small) .lab-fields { flex-direction: column; align-items: stretch; }
  .lab-editor:not(.lab-editor--small) .lab-field { width: 100%; min-width: 0; }
  .lab-preview-content { grid-template-columns: 1fr; }
  .lab-preview-content:not(.lab-preview-content--single) section + section::before { top: -9px; right: 0; bottom: auto; left: 0; border-left: 0; border-top: 1px solid #bdcdbf; }
}
@media (max-width: 640px) {
  .lab-editor--small { display: flex; flex-direction: column; align-items: stretch; width: 100%; }
  .lab-editor--small .lab-fields { width: 100%; }
  .lab-editor--small .lab-field { flex: 1 1 0; width: auto; }
}
</style>
