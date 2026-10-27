<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import ScTcEditorLab from '../../../components/Text/ScTcEditorLab.vue'
import { request } from '../../../services/request.js'
import { MACHINE_SC, MACHINE_TC, packPair, unpackPair } from '../../../utils/scTcLab.js'
import { useUserSettings } from '../../../utils/userSettings.js'

const route = useRoute()
const dialect = computed(() => String(route.params.dialect))
const settings = useUserSettings()
const sizes = [
  { value: 'large', label: '大' },
  { value: 'middle', label: '中' },
  { value: 'small', label: '小·词语' },
  { value: 'small-sentence', label: '小·句子' }
]
const pair = ref({ sc: '', tc: '' })
const size = ref('large')
const width = ref(100)
const editor = ref(null)
const busy = ref(false)
const notice = ref('')
const error = ref('')
const liveDraft = ref({ sc: '', tc: '' })

function readableOriginal(value) {
  return JSON.stringify(String(value ?? ''))
}
function setPair(value) {
  const parsed = unpackPair(value)
  pair.value = packPair(parsed, parsed.machineSide)
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
    if (editor.value?.hasPendingChanges()) {
      const ok = await editor.value.synchronize()
      if (!ok) return
    }
    const parsed = unpackPair(pair.value)
    const checked = packPair({ sc: parsed.sc, tc: parsed.tc }, parsed.machineSide)
    await request('/api/edit/sc-tc-lab', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checked)
    })
    notice.value = '测试数据已写入 KVS'
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}

read()
</script>

<template>
  <main class="sc-tc-lab">
    <header class="lab-header">
      <div><h1>简繁转换框试验</h1><p>大、中在电脑端分别显示 12 行、7 行，手机端显示 5 行、3 行。小·词语的简繁输入并排，按钮直接放在右侧；小·句子在电脑端单行输入，手机端保留几行高度，不能输入换行。拖动滑块可调整外层宽度。</p>
        <p>小·词语直接显示操作按钮；其他尺寸展开后可预览、同步、恢复或清空。按住预览按钮或在框上按住 F2 可暂时查看；Ctrl/⌘+Enter 可同步。</p></div>
    </header>
    <div class="lab-toolbar">
      <span>当前编辑语言：{{ settings.editorLanguage === 'sc' ? '简体' : settings.editorLanguage === 'tc' ? '繁体' : '简繁体对照' }}</span>
      <div class="lab-actions">
        <button type="button" :disabled="busy" @click="read">读取</button>
        <button type="button" class="primary" :disabled="busy" @click="write">{{ busy ? '处理中…' : '写入' }}</button>
      </div>
    </div>
    <div class="lab-variants">
      <fieldset class="lab-mode"><legend>文本框尺寸</legend><div class="lab-mode-options">
        <button v-for="item in sizes" :key="item.value" type="button" :class="{ active: size === item.value }"
                :aria-pressed="size === item.value" @click="size = item.value">{{ item.label }}</button>
      </div></fieldset>
      <fieldset class="lab-mode lab-width"><legend>测试宽度</legend>
        <div class="lab-width__control">
          <input id="sc-tc-test-width" v-model.number="width" type="range" min="30" max="100" step="1" aria-label="测试宽度" />
          <output for="sc-tc-test-width">{{ width }}%</output>
        </div>
      </fieldset>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" class="lab-error" role="alert">{{ error }}</p>
    <section class="lab-section lab-stage">
      <div class="lab-section-heading"><h2>编辑框</h2><span>{{ sizes.find(item => item.value === size)?.label }} · {{ width }}%</span></div>
      <div class="lab-stage__frame" :style="{ width: `${width}%` }"><ScTcEditorLab ref="editor" :pair="pair" :dialect="dialect" :layout="size"
                     @update:pair="setPair" @draft-change="liveDraft = $event" />
      </div>
    </section>
    <section class="lab-section lab-raw">
      <div class="lab-section-heading"><h2>原字符串</h2><span>输入时实时更新，无须提交</span></div>
      <div class="lab-raw-grid">
        <div class="lab-raw-group"><h3>当前共同数据</h3>
          <p><span>繁体</span><code>{{ readableOriginal(pair.tc) }}</code></p>
          <p><span>简体</span><code>{{ readableOriginal(pair.sc) }}</code></p>
          <p><span>机翻状态</span><code>{{ pair.machineSide === MACHINE_SC ? '简体机翻' : pair.machineSide === MACHINE_TC ? '繁体机翻' : '已检查' }}</code></p>
        </div>
        <div class="lab-raw-group"><h3>当前输入</h3>
          <p><span>繁体</span><code>{{ readableOriginal(liveDraft.tc) }}</code></p>
          <p><span>简体</span><code>{{ readableOriginal(liveDraft.sc) }}</code></p>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.sc-tc-lab { max-width: 1080px; margin: 36px auto; padding: 0 24px 72px; color: #203228; }
.lab-header h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.2rem); }
.lab-header p { margin: 8px 0 0; color: #637267; }
.lab-toolbar { display: flex; align-items: end; justify-content: space-between; flex-wrap: wrap; gap: 18px; margin: 28px 0 22px; padding: 18px 20px; border: 1px solid #d8ded9; border-radius: 14px; background: #f8faf7; }
.lab-variants { display: flex; flex-wrap: wrap; gap: 22px; padding: 4px 2px; }
.lab-mode { margin: 0; padding: 0; border: 0; font-size: .85rem; font-weight: 650; color: #445b4b; }
.lab-mode legend { margin-bottom: 7px; padding: 0; }
.lab-mode-options { display: inline-flex; flex-wrap: wrap; gap: 3px; padding: 3px; border: 1px solid #c8d2ca; border-radius: 10px; background: #edf2ed; }
.lab-mode-options button { border: 0; border-radius: 7px; background: transparent; color: #526456; padding: 8px 12px; font: inherit; cursor: pointer; }
.lab-mode-options button.active { background: white; color: #285a3b; box-shadow: 0 1px 5px rgba(26, 52, 34, .12); }
.lab-width { min-width: min(280px, 100%); }
.lab-width__control { display: flex; align-items: center; gap: 12px; }
.lab-width__control input { flex: 1; min-width: 0; accent-color: #315e40; cursor: pointer; }
.lab-width__control output { min-width: 3.5em; text-align: right; font-variant-numeric: tabular-nums; }
.lab-actions { display: flex; gap: 9px; flex-wrap: wrap; }
.lab-actions button { border: 1px solid #b9c9bc; border-radius: 8px; background: white; color: #315e40; padding: 9px 18px; font-weight: 600; cursor: pointer; }
.lab-actions button.primary { background: #315e40; color: white; border-color: #315e40; }
.lab-actions button:disabled { opacity: .5; cursor: not-allowed; }
.lab-section { margin-top: 32px; }
.lab-section-heading { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.lab-section-heading h2 { margin: 0; font-size: 1.18rem; }
.lab-section-heading span { color: #738176; font-size: .85rem; }
.lab-stage { overflow: visible; }
.lab-stage__frame { box-sizing: border-box; min-width: min(280px, 100%); max-width: 100%; margin: 0 auto; }
.lab-error { color: #b42318; }
.lab-raw { padding: 20px; border: 1px solid #d8ded9; border-radius: 16px; background: #f8faf7; }
.lab-raw-grid { display: grid; gap: 14px; }
.lab-raw-group { padding: 14px 16px; border: 1px solid #e0e7e1; border-radius: 10px; background: white; }
.lab-raw-group h3 { margin: 0 0 10px; font-size: .92rem; }
.lab-raw-group p { display: flex; gap: 16px; align-items: baseline; margin: 7px 0; }
.lab-raw-group p span { flex: 0 0 2.5em; color: #68796c; font-size: .82rem; }
.lab-raw-group code { white-space: pre-wrap; overflow-wrap: anywhere; color: #254332; font-family: var(--font-family-mono, monospace); font-size: .85rem; }
@media (max-width: 640px) { .sc-tc-lab { padding-inline: 16px; } }
</style>
