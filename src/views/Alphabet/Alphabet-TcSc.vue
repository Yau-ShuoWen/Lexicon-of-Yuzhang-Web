<script setup>

import {computed, ref} from 'vue'
import {useRoute} from 'vue-router'
import {showError} from '../../services/ToastService.js'

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

/* ======== 四种语言（正方形四角） ======== */

// pos 为 SVG viewBox 100x100 里的角坐标
const LANGS = [
  {key: 'sc', label: '简', name: '简体', pos: {x: 10, y: 10}},   // 左上
  {key: 'tc', label: '繁', name: '通用繁体', pos: {x: 90, y: 10}},   // 右上
  {key: 'hk', label: '港', name: '香港繁体', pos: {x: 10, y: 90}},   // 左下
  {key: 'tw', label: '台', name: '台湾繁体', pos: {x: 90, y: 90}},   // 右下
]

const langOf = key => LANGS.find(l => l.key === key)

/* ======== 转换方向 ======== */

// 点击三态循环：起点 → 终点 → 下一次的起点 → 终点 → …
const from = ref(null)
const to = ref(null)
const input = ref('')
const output = ref('')
const loading = ref(false)

let convertTimer = null

const fromLang = computed(() => (from.value ? langOf(from.value) : null))
const toLang = computed(() => (to.value ? langOf(to.value) : null))
const hasDir = computed(() => !!from.value && !!to.value)

/* ======== 箭头 ======== */

// 按两个角的坐标算线段，两端各缩进一点避免盖住角按钮
const arrow = computed(() => {
  if (!hasDir.value) return null

  const a = langOf(from.value).pos
  const b = langOf(to.value).pos
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const inset = 20
  const ux = dx / len
  const uy = dy / len

  return {
    x1: a.x + ux * inset,
    y1: a.y + uy * inset,
    x2: b.x - ux * inset,
    y2: b.y - uy * inset,
  }
})

/* 点击顶点：
 * 没起点     → 设为起点
 * 有起点     → 设为终点（并转换）
 * 有起终点   → 该点成为下一次的起点，重新选终点
 */
function clickCorner(key) {
  if (!from.value) {
    from.value = key
    return
  }
  if (!to.value) {
    if (key === from.value) return
    to.value = key
    convert()
    return
  }
  from.value = key
  to.value = null
  output.value = ''
}

/* ======== 重置 ======== */

// 去掉所有点击状态：清空起点、终点、箭头与输出
function reset() {
  from.value = null
  to.value = null
  output.value = ''
}

/* ======== 转换 ======== */

async function convert() {
  if (!input.value.trim() || !hasDir.value) return

  loading.value = true
  try {
    const res = await fetch(
        `/api/proofread/translate?from=${from.value}&to=${to.value}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'text/plain;charset=UTF-8'},
          body: input.value,
        }
    )
    const data = await res.json()
    if (!data.success) throw new Error(data.message || '转换失败')
    output.value = data.data ?? ''
  } catch (e) {
    console.error(e)
    showError(e.message || '转换失败')
  } finally {
    loading.value = false
  }
}

// 输入防抖
function onInput() {
  clearTimeout(convertTimer)
  convertTimer = setTimeout(convert, 250)
}

</script>

<template>

  <div class="broaden-layout tcsc-page">

    <!-- ====== 标题 ====== -->
    <header class="tcsc-hero">
      <h1 class="tcsc-title">简体繁体转换</h1>
      <p class="tcsc-sub">点一个顶点为起点，再点一个为终点</p>
    </header>

    <!-- ====== 方向盘 ====== -->
    <div class="dial">

      <svg v-if="arrow" class="dial-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id="arrowHead" viewBox="0 0 10 10" refX="7" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-primary)"/>
          </marker>
        </defs>
        <line
            class="dir-arrow"
            :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2"
            stroke="var(--color-primary)"
            stroke-width="2.5"
            stroke-linecap="round"
            marker-end="url(#arrowHead)"
        />
      </svg>

      <!-- 四角顶点 -->
      <button
          v-for="l in LANGS"
          :key="l.key"
          class="corner"
          :class="[`corner--${l.key}`, {from: from === l.key, to: to === l.key}]"
          @click="clickCorner(l.key)"
      >
        <span class="corner-label">{{ l.label }}</span>
      </button>

      <!-- 中心：方向文字 + 重置 -->
      <div class="dial-center">
        <p v-if="hasDir" class="dir-text">
          {{ fromLang.name }} → {{ toLang.name }}
        </p>
        <p v-else class="dir-tip">先点起点，再点终点</p>

        <button class="reset-btn" title="去掉所有点击" @click="reset">
          重置
        </button>
      </div>

    </div>

    <!-- ====== 输入 / 输出 ====== -->
    <div class="edit-row">

      <div class="edit-col">
        <textarea
            v-model="input"
            class="tcsc-box tcsc-input"
            rows="10"
            placeholder="在这里输入要转换的文字…"
            @input="onInput"
        />
      </div>

      <div class="edit-col">
        <div class="tcsc-box tcsc-output">
          <span v-if="loading" class="output-hint">转换中…</span>
          <template v-else-if="output">{{ output }}</template>
          <span v-else class="output-hint">
            {{ hasDir ? '转换结果会显示在这里' : '先在上面选择转换方向' }}
          </span>
        </div>
      </div>

    </div>

  </div>

</template>

<style scoped>

/* ===== 页面 ===== */

.tcsc-page {
  min-height: 60vh;
}

.tcsc-hero {
  text-align: center;
  padding: 16px 10px 20px;
}

.tcsc-title {
  margin: 0;
  font-size: clamp(1.6rem, 4.5vw, 2.2rem);
  font-weight: 800;
  color: var(--color-text);
}

.tcsc-sub {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--color-text-light);
}

/* ===== 方向盘 ===== */

.dial {
  position: relative;
  width: min(78vw, 180px);
  aspect-ratio: 1 / 1;
  margin: 0 auto 26px;
  border: 1px dashed var(--color-border);
  border-radius: 14px;
}

.dial-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

/* ===== 四角顶点 ===== */

.corner {
  position: absolute;
  z-index: 2;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  background: #fff;
  color: var(--color-primary);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .1);
  user-select: none;
}

.corner--sc { top: 0; left: 0; transform: translate(-28%, -28%); }
.corner--tc { top: 0; right: 0; transform: translate(28%, -28%); }
.corner--hk { bottom: 0; left: 0; transform: translate(-28%, 28%); }
.corner--tw { bottom: 0; right: 0; transform: translate(28%, 28%); }

/* 起点：实心 */
.corner.from {
  background: var(--color-primary);
  color: #fff;
}

/* 终点：粗边 */
.corner.to {
  border-width: 4px;
}

.corner-label {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}

.corner-name {
  font-size: 12px;
  opacity: .85;
}

/* ===== 中心 ===== */

.dial-center {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  pointer-events: none;
}

.dir-text {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.dir-tip {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-light);
}

.reset-btn {
  pointer-events: auto;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-text-light);
  border-radius: 999px;
  padding: 3px 14px;
  font-size: 13px;
  cursor: pointer;
}

.reset-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* ===== 输入 / 输出 ===== */

.edit-row {
  display: flex;
  gap: 14px;
  align-items: stretch;
}

.edit-col {
  flex: 1;
  min-width: 0;
  display: flex;
}

.tcsc-box {
  flex: 1;
  width: 100%;
  min-height: 260px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: var(--card-bg-color);
  padding: 14px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--color-text);
}

.tcsc-input {
  resize: vertical;
  font-family: inherit;
  outline: none;
}

.tcsc-input:focus {
  border-color: var(--color-primary);
}

.tcsc-output {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}

.output-hint {
  color: var(--color-text-light);
}

/* ===== mobile ===== */

@media (max-width: 640px) {
  .edit-row {
    flex-direction: column;
    gap: 10px;
  }

  .tcsc-box {
    min-height: 140px;
  }

  .corner {
    width: 72px;
    height: 72px;
  }

  .corner-label {
    font-size: 22px;
  }
}

</style>
