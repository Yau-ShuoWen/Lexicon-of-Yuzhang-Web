<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'
import ScTcEditorLab from '../../../components/Text/ScTcEditorLab.vue'
import RichText from '../../../components/Text/RichText.vue'
import eyeIcon from '../../../assets/icons/eye-open.svg'
import { request } from '../../../services/request.js'
import { MACHINE_SC, MACHINE_TC, packPair, unpackPair } from '../../../utils/scTcLab.js'

const route = useRoute()
const dialect = computed(() => String(route.params.dialect))
const modes = [
  { value: 'sc', label: '简体' },
  { value: 'tc', label: '繁体' },
  { value: 'pair', label: '简繁体对照' }
]
const mode = ref(localStorage.getItem('sc-tc-default-edit-language') || 'pair')
if (!modes.some(item => item.value === mode.value)) mode.value = 'pair'
watch(mode, value => localStorage.setItem('sc-tc-default-edit-language', value))
const pair = ref({ sc: '', tc: '' })
const legacy = ref({ sc: '', tc: '' })
const oldKey = ref(0)
const newKey = ref(0)
const editor = ref(null)
const busy = ref(false)
const notice = ref('')
const error = ref('')
const previewOpen = ref(false)
const previewBusy = ref(false)
const previewPair = ref({ sc: '', tc: '' })
const previewMode = ref('pair')
const liveDraft = ref({ sc: '', tc: '' })

function readableOriginal(value) {
  const raw = String(value ?? '')
  const marker = raw.endsWith(MACHINE_SC) ? MACHINE_SC : raw.endsWith(MACHINE_TC) ? MACHINE_TC : ''
  const body = marker ? raw.slice(0, -1) : raw
  const suffix = marker === MACHINE_SC ? ' ⟦U+E000：简体机翻⟧' : marker === MACHINE_TC ? ' ⟦U+E001：繁体机翻⟧' : ''
  return JSON.stringify(body) + suffix
}
const oldPending = computed(() => {
  try {
    const current = unpackPair(pair.value)
    return legacy.value.sc !== current.sc || legacy.value.tc !== current.tc
  } catch { return true }
})

function setPair(value) {
  const parsed = unpackPair(value)
  pair.value = { sc: value.sc, tc: value.tc }
  legacy.value = { sc: parsed.sc, tc: parsed.tc }
  oldKey.value++
  newKey.value++
}

async function read() {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const stored = await request('/api/edit/sc-tc-lab')
    setPair(stored ? JSON.parse(stored) : { sc: '', tc: '' })
    notice.value = stored ? '已读取测试数据' : '尚无测试数据，已清空编辑框'
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}

async function write() {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    if (oldPending.value) throw new Error('旧版本有未同步的修改，请先在旧框点击同步')
    if (editor.value?.hasPendingChanges()) {
      const ok = await editor.value.synchronize()
      if (!ok) return
    }
    const parsed = unpackPair(pair.value)
    const checked = packPair({ sc: parsed.sc, tc: parsed.tc }, parsed.marker)
    await request('/api/edit/sc-tc-lab', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checked)
    })
    notice.value = '测试数据已写入 KVS'
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}

async function openPreview() {
  error.value = ''
  previewBusy.value = true
  try {
    previewPair.value = await editor.value.previewPair()
    previewMode.value = mode.value
    previewOpen.value = true
  } catch (e) { error.value = e.message }
  finally { previewBusy.value = false }
}

function onLegacySynced(value) { setPair({ sc: value.sc, tc: value.tc }) }
function onLegacyClear() { setPair({ sc: '', tc: '' }) }

read()
</script>

<template>
  <main class="sc-tc-lab">
    <header class="lab-header">
      <div><h1>简繁转换框试验</h1><p>两种编辑方式使用同一份测试数据。</p></div>
    </header>
    <div class="lab-toolbar">
      <fieldset class="lab-mode">
        <legend>默认编辑语言</legend>
        <div class="lab-mode-options">
          <button v-for="item in modes" :key="item.value" type="button" :class="{ active: mode === item.value }"
                  :aria-pressed="mode === item.value" @click="mode = item.value">{{ item.label }}</button>
        </div>
      </fieldset>
      <div class="lab-actions">
        <button type="button" :disabled="busy" @click="read">读取</button>
        <button type="button" class="primary" :disabled="busy" @click="write">{{ busy ? '处理中…' : '写入' }}</button>
        <button type="button" :disabled="previewBusy" @click="openPreview"><img :src="eyeIcon" alt="" />{{ previewBusy ? '准备预览…' : '预览' }}</button>
      </div>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" class="lab-error" role="alert">{{ error }}</p>
    <p v-if="oldPending">旧版本尚未同步</p>
    <section class="lab-section">
      <div class="lab-section-heading"><h2>新版本</h2><span>当前试验</span></div>
      <ScTcEditorLab :key="newKey" ref="editor" :pair="pair" :dialect="dialect" :mode="mode"
                     @update:pair="setPair" @draft-change="liveDraft = $event" />
    </section>
    <section class="lab-section">
      <div class="lab-section-heading"><h2>旧版本</h2><span>用于对照</span></div>
      <div class="lab-legacy"><ScAndTcText :key="oldKey" v-model:traditional-text="legacy.tc" v-model:simplified-text="legacy.sc"
                     :dialect="dialect" @synced="onLegacySynced" @clear="onLegacyClear" /></div>
    </section>
    <section class="lab-section lab-raw">
      <div class="lab-section-heading"><h2>原字符串</h2><span>输入时实时更新，无须提交</span></div>
      <div class="lab-raw-grid">
        <div class="lab-raw-group"><h3>当前共同数据</h3>
          <p><span>繁体</span><code>{{ readableOriginal(pair.tc) }}</code></p>
          <p><span>简体</span><code>{{ readableOriginal(pair.sc) }}</code></p>
        </div>
        <div class="lab-raw-group"><h3>新版本当前输入</h3>
          <p><span>繁体</span><code>{{ readableOriginal(liveDraft.tc) }}</code></p>
          <p><span>简体</span><code>{{ readableOriginal(liveDraft.sc) }}</code></p>
        </div>
        <div class="lab-raw-group"><h3>旧版本当前输入</h3>
          <p><span>繁体</span><code>{{ readableOriginal(legacy.tc) }}</code></p>
          <p><span>简体</span><code>{{ readableOriginal(legacy.sc) }}</code></p>
        </div>
      </div>
    </section>
    <el-dialog v-model="previewOpen" :title="previewMode === 'sc' ? '简体预览' : previewMode === 'tc' ? '繁体预览' : '简繁对照预览'"
               :width="previewMode === 'pair' ? 'min(860px, 94vw)' : 'min(560px, 94vw)'" append-to-body>
      <div class="lab-preview" :class="{ 'lab-preview--single': previewMode !== 'pair' }">
        <section v-if="previewMode !== 'sc'"><h3>繁体</h3><RichText :key="`tc-${previewPair.tc}`" :model-value="previewPair.tc" language="tc" :dialect="dialect" plain /></section>
        <section v-if="previewMode !== 'tc'"><h3>简体</h3><RichText :key="`sc-${previewPair.sc}`" :model-value="previewPair.sc" language="sc" :dialect="dialect" plain /></section>
      </div>
    </el-dialog>
  </main>
</template>

<style scoped>
.sc-tc-lab { max-width: 1080px; margin: 36px auto; padding: 0 24px 72px; color: #203228; }
.lab-header h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.2rem); }
.lab-header p { margin: 8px 0 0; color: #637267; }
.lab-toolbar { display: flex; align-items: end; justify-content: space-between; flex-wrap: wrap; gap: 18px; margin: 28px 0 22px; padding: 18px 20px; border: 1px solid #d8ded9; border-radius: 14px; background: #f8faf7; }
.lab-mode { margin: 0; padding: 0; border: 0; font-size: .85rem; font-weight: 650; color: #445b4b; }
.lab-mode legend { margin-bottom: 7px; padding: 0; }
.lab-mode-options { display: inline-flex; flex-wrap: wrap; gap: 3px; padding: 3px; border: 1px solid #c8d2ca; border-radius: 10px; background: #edf2ed; }
.lab-mode-options button { border: 0; border-radius: 7px; background: transparent; color: #526456; padding: 8px 12px; font: inherit; cursor: pointer; }
.lab-mode-options button.active { background: white; color: #285a3b; box-shadow: 0 1px 5px rgba(26, 52, 34, .12); }
.lab-actions { display: flex; gap: 9px; flex-wrap: wrap; }
.lab-actions button { border: 1px solid #b9c9bc; border-radius: 8px; background: white; color: #315e40; padding: 9px 18px; font-weight: 600; cursor: pointer; }
.lab-actions button img { width: 16px; height: 16px; margin-right: 7px; vertical-align: -3px; }
.lab-actions button.primary { background: #315e40; color: white; border-color: #315e40; }
.lab-actions button:disabled { opacity: .5; cursor: not-allowed; }
.lab-section { margin-top: 32px; }
.lab-section-heading { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.lab-section-heading h2 { margin: 0; font-size: 1.18rem; }
.lab-section-heading span { color: #738176; font-size: .85rem; }
.lab-legacy { padding: 24px; border: 1px solid #d8ded9; border-radius: 16px; background: white; }
.lab-error { color: #b42318; }
.lab-preview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.lab-preview--single { grid-template-columns: 1fr; }
.lab-preview section { min-width: 0; padding: 16px; border: 1px solid #d8ded9; border-radius: 10px; background: #fbfcfa; }
.lab-preview h3 { margin: 0 0 12px; font-size: 1rem; }
.lab-raw { padding: 20px; border: 1px solid #d8ded9; border-radius: 16px; background: #f8faf7; }
.lab-raw-grid { display: grid; gap: 14px; }
.lab-raw-group { padding: 14px 16px; border: 1px solid #e0e7e1; border-radius: 10px; background: white; }
.lab-raw-group h3 { margin: 0 0 10px; font-size: .92rem; }
.lab-raw-group p { display: flex; gap: 16px; align-items: baseline; margin: 7px 0; }
.lab-raw-group p span { flex: 0 0 2.5em; color: #68796c; font-size: .82rem; }
.lab-raw-group code { white-space: pre-wrap; overflow-wrap: anywhere; color: #254332; font-family: var(--font-family-mono, monospace); font-size: .85rem; }
@media (max-width: 640px) { .lab-preview { grid-template-columns: 1fr; } .sc-tc-lab { padding-inline: 16px; } }
</style>
