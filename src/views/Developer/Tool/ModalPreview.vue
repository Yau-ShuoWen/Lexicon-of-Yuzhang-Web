<script setup>
import { ref } from 'vue'
import UnifiedModal from '../../../components/Window/UnifiedModal.vue'

const open = ref(false)
const size = ref('medium')
const backdropBlur = ref(true)
const busy = ref(false)
const longContent = ref(false)
const loading = ref(false)
const lastCloseReason = ref('尚未關閉')
let requestTimer = null

function openModal() {
  lastCloseReason.value = '彈窗已開啟'
  open.value = true
}

function handleClose(reason) {
  const labels = {
    backdrop: '點擊遮罩',
    escape: '按下 Esc',
    button: '點擊右上角關閉按鈕',
    cancel: '點擊取消',
    confirm: '點擊確認'
  }
  lastCloseReason.value = labels[reason] || '彈窗已關閉'
}

function closeFromAction(reason) {
  if (busy.value || loading.value) return
  open.value = false
  handleClose(reason)
}

function simulateRequest(duration) {
  window.clearTimeout(requestTimer)
  loading.value = true
  lastCloseReason.value = duration < 180 ? '模拟快速请求' : '模拟较慢请求'
  requestTimer = window.setTimeout(() => {
    loading.value = false
    lastCloseReason.value = '请求完成，内容已显示'
  }, duration)
}
</script>

<template>
  <div class="modal-preview-page">
    <section class="preview-panel">
      <div class="preview-heading">
        <div>
          <p class="eyebrow">彈窗體驗頁</p>
          <h1>統一彈窗候選樣式</h1>
          <p>這個彈窗目前沒有接入任何正式功能，可直接調整各項行為並反覆體驗。</p>
        </div>
        <button class="primary-button" type="button" @click="openModal">開啟彈窗</button>
      </div>

      <div class="settings-grid">
        <fieldset>
          <legend>彈窗寬度</legend>
          <label v-for="item in [{value:'small', label:'小'}, {value:'medium', label:'中'}, {value:'large', label:'大'}]" :key="item.value">
            <input v-model="size" type="radio" name="modal-size" :value="item.value">
            <span>{{ item.label }}</span>
          </label>
        </fieldset>

        <div class="switch-list">
          <label><input v-model="backdropBlur" type="checkbox"><span>遮罩背景模糊</span></label>
          <label><input v-model="busy" type="checkbox"><span>處理中，不允許關閉</span></label>
          <label><input v-model="longContent" type="checkbox"><span>顯示長內容</span></label>
        </div>
      </div>

      <div class="request-actions">
        <button class="secondary-button" type="button" @click="openModal(); simulateRequest(100)">体验快速请求</button>
        <button class="secondary-button" type="button" @click="openModal(); simulateRequest(1200)">体验较慢请求</button>
      </div>

      <p class="result-line">最近狀態：{{ lastCloseReason }}</p>
    </section>

    <UnifiedModal
      v-model="open"
      title="編輯內容"
      description="請確認內容無誤後再保存。未保存的修改在關閉後不會保留。"
      :size="size"
      :backdrop-blur="backdropBlur"
      :busy="busy || loading"
      :loading="loading"
      loading-text="正在读取内容…"
      @close="handleClose"
    >
      <div class="demo-form">
        <label>
          <span>標題</span>
          <input type="text" value="示例標題">
        </label>
        <label>
          <span>說明</span>
          <textarea rows="4">這裡用來體驗輸入框、鍵盤焦點以及彈窗內容的間距。</textarea>
        </label>

        <div v-if="longContent" class="long-content">
          <h3>較長內容展示</h3>
          <p v-for="index in 7" :key="index">第 {{ index }} 段示例內容，用來確認彈窗內部捲動時，標題、正文與操作區域的視覺效果。</p>
        </div>
      </div>

      <template #footer>
        <button class="secondary-button" type="button" :disabled="busy || loading" @click="closeFromAction('cancel')">取消</button>
        <button class="primary-button" type="button" :disabled="busy || loading" @click="closeFromAction('confirm')">
          {{ busy || loading ? '處理中…' : '確認保存' }}
        </button>
      </template>
    </UnifiedModal>
  </div>
</template>

<style scoped>
.modal-preview-page {
  min-height: calc(100vh - 120px);
  padding: 48px 20px;
}

.preview-panel {
  box-sizing: border-box;
  width: min(860px, 100%);
  margin: 0 auto;
  padding: 30px;
  border: 1px solid #d9e7db;
  border-radius: 24px;
  background: rgba(255, 255, 255, .88);
  box-shadow: 0 20px 55px rgba(42, 78, 48, .11);
}

.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5eee6;
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--color-primary);
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .12em;
}

h1 { margin: 0; color: var(--color-primary-dark); font-size: clamp(1.55rem, 4vw, 2.2rem); }
.preview-heading p:last-child { max-width: 560px; margin: 10px 0 0; color: var(--color-text-light); line-height: 1.75; }

.settings-grid {
  display: grid;
  grid-template-columns: minmax(240px, .8fr) minmax(280px, 1.2fr);
  gap: 28px;
  padding: 28px 0;
}

fieldset {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 16px;
  border: 1px solid #d9e7db;
  border-radius: 16px;
}

legend { padding: 0 7px; color: #49694f; font-size: .82rem; font-weight: 700; }
fieldset label { flex: 1; cursor: pointer; }
fieldset input { position: absolute; opacity: 0; pointer-events: none; }
fieldset span { display: grid; place-items: center; min-height: 40px; border: 1px solid #cdddcf; border-radius: 10px; color: #58715d; }
fieldset input:checked + span { border-color: var(--color-primary); color: var(--color-primary-dark); background: #edf6ee; box-shadow: inset 0 0 0 1px var(--color-primary); }
fieldset input:focus-visible + span { outline: 3px solid rgba(46, 125, 50, .2); }

.switch-list { display: grid; gap: 11px; }
.switch-list label { display: flex; align-items: center; gap: 10px; min-height: 28px; color: #49604e; cursor: pointer; }
.switch-list input { width: 17px; height: 17px; accent-color: var(--color-primary); }
.request-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: -5px 0 18px; }
.result-line { margin: 0; padding: 12px 15px; border-radius: 12px; color: #52705a; background: #f1f7f2; font-size: .85rem; }

.primary-button,
.secondary-button {
  min-height: 40px;
  padding: 9px 18px;
  border-radius: 999px;
  font: inherit;
  font-size: .86rem;
  font-weight: 700;
  cursor: pointer;
}

.primary-button { border: 1px solid var(--color-primary); color: #fff; background: var(--color-primary); box-shadow: 0 7px 18px rgba(46, 125, 50, .18); }
.secondary-button { border: 1px solid #c7d8ca; color: #4c6852; background: #fff; }
.primary-button:hover { background: var(--color-primary-dark); }
.secondary-button:hover { background: #f2f7f3; }
.primary-button:focus-visible, .secondary-button:focus-visible { outline: 3px solid rgba(46, 125, 50, .22); outline-offset: 2px; }
.primary-button:disabled, .secondary-button:disabled { opacity: .5; cursor: default; }

.demo-form { display: grid; gap: 18px; }
.demo-form label { display: grid; gap: 7px; color: #49604e; font-size: .84rem; font-weight: 700; }
.demo-form input, .demo-form textarea { box-sizing: border-box; width: 100%; padding: 11px 12px; border: 1px solid #cbd9cd; border-radius: 10px; color: var(--color-text); background: #fff; font: inherit; resize: vertical; outline: none; }
.demo-form input:focus, .demo-form textarea:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(46, 125, 50, .11); }
.long-content { color: var(--color-text-light); line-height: 1.75; }
.long-content h3 { color: var(--color-primary-dark); }

@media (max-width: 680px) {
  .modal-preview-page { padding: 28px 12px; }
  .preview-panel { padding: 22px 18px; border-radius: 20px; }
  .preview-heading { align-items: stretch; flex-direction: column; gap: 18px; }
  .settings-grid { grid-template-columns: 1fr; gap: 22px; }
}
</style>
