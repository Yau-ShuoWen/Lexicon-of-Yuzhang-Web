<script setup>
import {ref, computed, onMounted, watch} from 'vue'
import {useRoute} from 'vue-router'
import {formatRichText} from '../utils/textFormatter.js'
import PinyinProofreadText from "../components/Text/PinyinProofreadText.vue";
import LoadingIcon from "../components/Status/LoadingIcon.vue";


const route = useRoute()
const dialect = computed(() => route.params.dialect)

const pinyinData = ref([])
const loading = ref(true)
const selectedLast = ref(null)
const selectedLastDisplay = ref('')
const tonePreviewData = ref([])

// 声调
const toneItems = computed(() => {
  if (tonePreviewData.value?.length) return tonePreviewData.value
  return (pinyinData.value.find(g => g[0]?.attribute === 'tone') || [])
})

// 声母
const initialItems = computed(() => {
  return (pinyinData.value.find(g => g[0]?.attribute === 'initial') || [])
})

// 韵母
const finalGroups = computed(() => {
  return pinyinData.value
      .filter(g => g[0]?.attribute?.includes('last'))
      .map(group => ({
        attribute: group[0].attribute,
        title: getAttributeName(group[0].attribute),
        items: group
      }))
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  fetchPinyinTable()
})

/* ---------- 方法 ---------- */
async function fetchPinyinTable() {
  try {
    loading.value = true
    const res = await fetch(`/api/pinyin/${dialect.value}/table`)
    if (!res.ok) throw new Error(res.status)
    pinyinData.value = await res.json()
  } catch (e) {
    console.error(e)
    showError('加载拼音表失败')
  } finally {
    loading.value = false
  }
}

async function handleItemClick(item) {
  if (!item.valid) return
  if (!item.attribute?.includes('last')) return

  selectedLast.value = item.keyboard
  selectedLastDisplay.value = formatDisplayText(item)

  try {
    const last = extractKeyboardValue(item.keyboard)
    const res = await fetch(`/api/pinyin/${dialect.value}/get-tone-preview?last=${encodeURIComponent(last)}`)
    if (!res.ok) throw new Error(res.status)
    tonePreviewData.value = await res.json()
  } catch (e) {
    console.error(e)
    tonePreviewData.value = []
    showError('获取声调预览失败')
  }
}

function formatDisplay(item) {
  if (!item.valid) {
    return formatRichText(' - ')
  }

  const s = item.standard?.trim() || ''
  const k = item.keyboard?.trim() || ''

  const text = s;

  // /** 声调：固定两行布局 */
  // if (item.attribute === 'tone') {
  //   if (s === k) return formatRichText(`${s}\n`)
  //   else return formatRichText(`${s}\n${k}`)
  // }
  //
  // /** 其他（声母 / 韵母） */
  // const text = s === k ? s : `${s} / ${k}`

  try {
    return formatRichText(` ${text} `)
  } catch {
    return text
  }
}

function formatDisplayText(item) {
  const s = item.standard?.trim() || ''
  const k = item.keyboard?.trim() || ''
  return s === k ? s : `${s} / ${k}`
}

function extractKeyboardValue(keyboard) {
  return keyboard ? keyboard.replace(/[\[\]\s]/g, '') : ''
}

function getAttributeName(attr) {
  return {
    tone: '声调',
    initial: '声母',
    lastWithSingle: '单韵母',
    lastWithDouble: '双韵母',
    lastWithNasal: '鼻音韵母',
    lastWithShort: '入声韵母'
  }[attr] || attr
}

function isSelected(keyboard) {
  return selectedLast.value === keyboard
}

function showError(message) {
  const el = document.createElement('div')
  el.className = 'error-message'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

/* ---------- 监听路由变化 ---------- */
watch(dialect, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    selectedLast.value = null
    selectedLastDisplay.value = ''
    tonePreviewData.value = []
    fetchPinyinTable()
  }
})
</script>


<template>
  <LoadingIcon v-if="loading"/>

  <div v-else>
    <!-- 声母 -->
    <div class="attribute-group initial-group">
      <div class="group-header"><h3>声母</h3></div>
      <div class="items-grid">
        <div
            v-for="(item, i) in initialItems"
            :key="i"
            class="item-box initial-item"
            :class="{ invalid: !item.valid }"
        >
          <div class="main-display" v-html="formatDisplay(item)"/>
        </div>
      </div>
    </div>

    <!-- 声调 -->
    <div class="attribute-group tone-group">
      <div class="group-header"><h3>声调（点击韵母查看变化）</h3></div>
      <div class="items-grid">
        <div
            v-for="(item, i) in toneItems"
            :key="i"
            class="item-box tone-item"
            :class="{ invalid: !item.valid }"
        >
          <div class="main-display" v-html="formatDisplay(item)"/>
        </div>
      </div>
    </div>

    <!-- 韵母 -->
    <div class="attribute-group final-group">
      <div class="group-header"><h3>韵母</h3></div>

      <div
          v-for="(group, gi) in finalGroups"
          :key="gi"
          class="final-subgroup"
      >
        <div class="final-subtitle">{{ group.title }}</div>

        <div class="items-grid">
          <div
              v-for="(item, i) in group.items"
              :key="i"
              class="item-box clickable"
              :class="{
                invalid: !item.valid,
                selected: isSelected(item.keyboard)
              }"
              @click="handleItemClick(item)"
          >
            <div class="main-display" v-html="formatDisplay(item)"/>
          </div>
        </div>
      </div>
    </div>


  </div>
</template>


<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 声调区域特殊样式 */
.tone-group {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #dee2e6;
  margin-bottom: 30px;
}

.tone-group {
  color: #4dabf7;
  font-weight: 500;
}

.tone-item {
  background: white;
  border: 2px solid #4dabf7;
}

.tone-item.invalid {
  background: #212529;
  border-color: #495057;
}

.tone-item.invalid .main-display {
  color: #adb5bd;
}

/* 通用区域样式 */
.attribute-group {
  margin-bottom: 30px;
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.group-header {
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8e8e8;
}

.group-header h3 {
  margin: 0 0 5px 0;
  color: #34495e;
  font-size: 18px;
  font-weight: 600;
}

.group-description {
  color: #7f8c8d;
  font-size: 14px;
  display: block;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 10px;
}

.item-box {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 14px 10px;
  transition: all 0.2s ease;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-box.clickable {
  cursor: pointer;
  background: #e8f4fd;
  border-color: #c1dbf2;
}

.item-box.clickable:hover {
  background: #d4eaf9;
  border-color: #4dabf7;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(77, 171, 247, 0.15);
}

.item-box.clickable.selected {
  background: #4dabf7;
  border-color: #339af0;
  color: white;
  transform: scale(1.02);
}

.item-box.invalid {
  background: #f8f9fa;
  border-color: #dee2e6;
  opacity: 0.6;
  cursor: not-allowed;
}

.item-box.invalid .main-display {
  color: #adb5bd;
}

.item-box.clickable.selected .main-display {
  color: white;
}

.main-display {
  font-size: 20px;
  font-weight: 400;
  text-align: center;
  color: #495057;
  line-height: 1.3;
}
</style>

<style>
/* 全局样式 */
.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #f56565;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.parenthesis {
  color: #666;
  font-weight: normal;
}

strong {
  font-weight: 600;
}

/* 声母 */
.initial-group {
  background: #fdfefe;
  border: 2px dashed #ced4da;
}

/* 韵母 */
.final-group {
  background: #f8fbff;
  border: 2px solid #cfe2ff;
}

.final-subgroup {
  margin-bottom: 18px;
}

.final-subtitle {
  font-size: 14px;
  color: #6c757d;
  margin: 8px 0;
  padding-left: 6px;
  border-left: 3px solid #dee2e6;
}
</style>