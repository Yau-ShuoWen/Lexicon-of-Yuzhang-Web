<script setup>

import {computed, ref} from 'vue'
import {useRoute} from 'vue-router'
import {showError} from '../../services/ToastService.js'

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

/* ======== 四种语言配置 ======== */
// pos 为按钮在 100x100 坐标系中的中心点百分比
const LANGS = [
  { key: 'sc', label: '简', name: '大陆简体', pos: { x: 17.5, y: 17.5 } },    // 左上
  { key: 'tc', label: '繁', name: '大陆繁体', pos: { x: 82.5, y: 17.5 } },  // 右上
  { key: 'hk', label: '港', name: '香港繁体', pos: { x: 17.5, y: 82.5 } },  // 左下
  { key: 'tw', label: '台', name: '台湾繁体', pos: { x: 82.5, y: 82.5 } }, // 右下
]

const langOf = key => LANGS.find(l => l.key === key)

/* ======== 转换状态管理 ======== */
const from = ref(null)
const to = ref(null)
const input = ref('')
const output = ref('')
const loading = ref(false)
let convertTimer = null

const fromLang = computed(() => langOf(from.value))
const toLang = computed(() => langOf(to.value))
const hasDir = computed(() => !!from.value && !!to.value)

/* ======== 箭头路径计算 ======== */
const arrow = computed(() => {
  if (!hasDir.value) return null
  const a = fromLang.value.pos
  const b = toLang.value.pos
  
  // 计算角度
  const dx = b.x - a.x
  const dy = b.y - a.y
  const angle = Math.atan2(dy, dx)
  
  // 缩进量（基于 100x100 坐标系）
  // 按钮半径约为 13.3-14%，缩进 16% 可确保箭头不触碰按钮边缘
  const inset = 16 
  
  return {
    x1: a.x + Math.cos(angle) * inset,
    y1: a.y + Math.sin(angle) * inset,
    x2: b.x - Math.cos(angle) * inset,
    y2: b.y - Math.sin(angle) * inset,
  }
})

/**
 * 点击角块逻辑：
 * 1. 如果没选起点，设为起点
 * 2. 如果选了起点但没选终点：
 *    - 点击同一个点：取消起点
 *    - 点击不同点：设为终点并执行转换
 * 3. 如果已选起终点：
 *    - 点击已有点：切换起点/终点逻辑（这里简化为重新选起点）
 *    - 点击新点：设为起点，清空终点
 */
function clickCorner(key) {
  if (!from.value) {
    from.value = key
  } else if (!to.value) {
    if (from.value === key) {
      from.value = null
    } else {
      to.value = key
      convert()
    }
  } else {
    // 已有方向，点击任何点都视为开启新的选择（以该点为起点）
    from.value = key
    to.value = null
    output.value = ''
  }
}

/* ======== 功能操作 ======== */
function swapDir() {
  if (!hasDir.value) return
  const temp = from.value
  from.value = to.value
  to.value = temp
  convert()
}

function reset() {
  from.value = null
  to.value = null
  output.value = ''
  input.value = ''
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
    <div class="dial-wrapper">
      <div class="dial">
        <!-- SVG 连线 -->
        <svg v-if="arrow" class="dial-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="arrowHead" viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-primary)"/>
            </marker>
          </defs>
          <line
              class="dir-arrow"
              :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2"
              stroke="var(--color-primary)"
              stroke-width="3"
              stroke-linecap="round"
              marker-end="url(#arrowHead)"
          />
        </svg>

        <!-- 四角顶点 -->
        <button
            v-for="l in LANGS"
            :key="l.key"
            class="corner"
            :class="[`corner--${l.key}`, { 'is-from': from === l.key, 'is-to': to === l.key }]"
            @click="clickCorner(l.key)"
        >
          <span class="corner-label">{{ l.label }}</span>
          <span class="corner-name">{{ l.name }}</span>
        </button>

        <!-- 中心控制区 -->
        <div class="dial-center">
          <div class="dir-display">
            <template v-if="hasDir">
              <span class="dir-name">{{ fromLang.name }}</span>
              <span class="dir-arrow-icon">→</span>
              <span class="dir-name">{{ toLang.name }}</span>
            </template>
            <p v-else-if="from" class="dir-tip">请选择目标语言</p>
            <p v-else class="dir-tip">请选择起始语言</p>
          </div>
        </div>
      </div>

      <!-- 侧边/下方控制区 -->
      <div class="dial-controls">
        <button class="control-btn swap" :disabled="!hasDir" title="交换方向" @click="swapDir">
          <el-icon><Switch /></el-icon>
          <span class="btn-text">交换</span>
        </button>
        <button class="control-btn reset" title="重置选择" @click="reset">
          <el-icon><Refresh /></el-icon>
          <span class="btn-text">重置</span>
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

/* ===== 方向盘容器 ===== */

.dial-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  padding: 40px 0;
  margin-bottom: 20px;
}

.dial {
  position: relative;
  width: 240px;
  height: 240px;
  display: grid;
  grid-template-columns: 64px 64px;
  grid-template-rows: 64px 64px;
  justify-content: space-between;
  align-content: space-between;
  padding: 10px;
  border: 2px dashed var(--color-border);
  border-radius: 24px;
  background: rgba(var(--color-primary-rgb), 0.02);
}

.dial-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  overflow: visible;
}

/* ===== 控制按钮区 (侧边/下方) ===== */

.dial-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  background: var(--card-bg-color);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
}

.control-btn:not(:disabled):hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.control-btn .el-icon {
  font-size: 20px;
}

.btn-text {
  font-size: 12px;
  font-weight: 600;
}

.control-btn.reset:not(:disabled):hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

/* ===== 四角顶点按钮 ===== */

.corner {
  position: relative;
  z-index: 10;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  border: 2px solid var(--color-border);
  background: var(--card-bg-color);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
}

.corner:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.corner.is-from {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.3);
}

.corner.is-to {
  border-color: var(--color-primary);
  border-width: 3px;
  background: rgba(var(--color-primary-rgb), 0.1);
  color: var(--color-primary);
  transform: scale(1.05);
}

.corner--sc { justify-self: start; align-self: start; }
.corner--tc { justify-self: end; align-self: start; }
.corner--hk { justify-self: start; align-self: end; }
.corner--tw { justify-self: end; align-self: end; }

.corner-label {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}

.corner-name {
  font-size: 10px;
  opacity: 0.7;
  margin-top: 2px;
}

.corner.is-from .corner-name {
  opacity: 0.9;
}

/* ===== 中心显示区 ===== */

.dial-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 5;
}

.dir-display {
  background: var(--card-bg-color);
  padding: 8px 16px;
  border-radius: 999px;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  min-height: 40px;
}

.dir-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.dir-arrow-icon {
  color: var(--color-primary);
  font-weight: bold;
}

.dir-tip {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-light);
  white-space: nowrap;
}

/* ===== 输入 / 输出 ===== */

.edit-row {
  display: flex;
  gap: 20px;
  align-items: stretch;
}

.edit-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tcsc-box {
  flex: 1;
  width: 100%;
  min-height: 300px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--card-bg-color);
  padding: 20px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--color-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.tcsc-input {
  resize: vertical;
  font-family: inherit;
  outline: none;
}

.tcsc-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
}

.tcsc-output {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
  background: var(--color-fill-1);
}

.output-hint {
  color: var(--color-text-light);
  font-style: italic;
}

/* ===== 响应式适配 ===== */

@media (max-width: 768px) {
  .dial-wrapper {
    flex-direction: column;
    padding: 20px 0;
    gap: 20px;
  }
  
  .dial {
    width: 200px;
    height: 200px;
  }
  
  .dial-controls {
    flex-direction: row;
    width: 100%;
    justify-content: center;
    gap: 20px;
  }

  .control-btn {
    width: 80px;
    height: 50px;
    flex-direction: row;
    gap: 8px;
  }

  .corner {
    width: 56px;
    height: 56px;
    border-radius: 14px;
  }
  
  .corner-label {
    font-size: 18px;
  }

  .edit-row {
    flex-direction: column;
  }

  .tcsc-box {
    min-height: 200px;
  }
}

</style>
