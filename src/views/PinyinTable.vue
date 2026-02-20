<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatRichText } from '../utils/textFormatter.js'
import { showError  } from '../services/ErrorService.js'
import LoadingIcon from "../components/Status/LoadingIcon.vue";

const route = useRoute()
const dialect = computed(() => route.params.dialect)

const pinyinData = ref([])
const loading = ref(true)

// Grid 分类
const initialGrid = computed(() => pinyinData.value.find(g => g.code === 'initial'))
const lastGrid = computed(() => pinyinData.value.find(g => g.code === 'last'))
const toneGrid = computed(() => pinyinData.value.find(g => g.code === 'tone'))

// 生命周期
onMounted(fetchTable)

async function fetchTable() {
  try {
    loading.value = true
    const res = await fetch(`/api/pinyin/${dialect.value}/table`)
    if (!res.ok) throw new Error(res.status)

    const data = await res.json()
    pinyinData.value = data.table

  } catch (e) {
    console.error(e)
    showError('加载拼音表失败')
  }
  finally {
    loading.value = false
  }
}

function handleItemClick(item) {
  if (!item.exist) return
  console.log(item.id) // 未来查 audio 就用这个
}

/* 显示规则 */
function formatDisplay(item) {

  if (!item.exist) return ''

  const s = item.standard?.trim() || ''

  try {
    return formatRichText(` ${s} `)
  } catch {
    return s
  }
}

/* ---------- 监听路由变化 ---------- */
watch(dialect, fetchTable)
</script>


<template>
  <LoadingIcon v-if="loading"/>

  <div v-else>

    <!-- 声母 -->
    <div v-if="initialGrid" class="attribute-group final-group">
      <div class="group-header">
        <h3>{{ initialGrid.name.left }}</h3>
      </div>

      <div v-for="line in initialGrid.line" class="pinyin-line">
        <div v-for="group in line.group" class="pinyin-group">
          <div class="items-grid">

            <div v-for="item in group.item"
                 class="item-box clickable"
                 :class="{ invalid: !item.exist }"
                 @click="handleItemClick(item)">
              <div class="main-display" v-html="formatDisplay(item)"/>
            </div>

          </div>
        </div>
      </div>

    </div>

    <!-- 韵母 -->
    <div v-if="lastGrid" class="attribute-group final-group">
      <div class="group-header">
        <h3>{{ lastGrid.name.left }}</h3>
      </div>

      <div v-for="line in lastGrid.line" class="pinyin-line">
        <div v-for="group in line.group" class="pinyin-group">
          <div class="items-grid">

            <div v-for="item in group.item"
                 class="item-box clickable"
                 :class="{ invalid: !item.exist }"
                 @click="handleItemClick(item)">
              <div class="main-display" v-html="formatDisplay(item)"/>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- 声调 -->
    <div v-if="toneGrid" class="attribute-group final-group">
      <div class="group-header">
        <h3>{{ toneGrid.name.left }}</h3>
      </div>

      <div v-for="line in toneGrid.line" class="pinyin-line">
        <div v-for="group in line.group" class="pinyin-group">
          <div class="items-grid">

            <div v-for="item in group.item"
                 class="item-box clickable"
                 :class="{ invalid: !item.exist }"
                 @click="handleItemClick(item)">
              <div class="main-display" v-html="formatDisplay(item)"/>
            </div>

          </div>
        </div>
      </div>
    </div>

  </div>
</template>


<style scoped>
/* ======== Attribute Block ======== */
.attribute-group {
  margin-bottom: 34px; /* Line组之间距离 */
  background: #fff;
  border-radius: 12px;
  padding: 20px 18px;
  border: 2px solid #cfe2ff;
}

/* ======== Header ======== */
.group-header {
  margin-bottom: 18px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.group-header h3 {
  margin: 0;
  font-size: 17px;
  color: #34495e;
  font-weight: 600;
}

/* ======== Line（跨Group容器）======= */
/* 这一层决定：不同Line绝不混排 */
.pinyin-line {
  display: flex;
  flex-wrap: wrap;
  gap: 30px; /* Group之间横向距离 */
  margin-bottom: 26px; /* Line之间纵向距离 */
}

.pinyin-line:last-child {
  margin-bottom: 0;
}

/* ======== Group（不可拆单位）======= */
/* 这一层决定：Group内部不会被压缩拆开 */
.pinyin-group {
  flex: 0 0 auto;
  display: inline-block;
}

/* ======== Group内部Item排列 ======== */
/* 这一层决定：Group内部更紧凑 */
.items-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 70px;
  gap: 8px; /* Group内部Item间距 */
}

/* ======== Item ======== */
.item-box {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 12px 8px;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.18s ease;
}

/* ======== 可点击态 ======== */
.item-box.clickable {
  cursor: pointer;
  background: #e8f4fd;
  border-color: #c1dbf2;
}

/* ⭐ invalid 不允许 hover 动画 */
.item-box.clickable:not(.invalid):hover {
  background: #d4eaf9;
  border-color: #4dabf7;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(77, 171, 247, 0.15);
}

/* ======== invalid ======== */
.item-box.invalid {
  opacity: 0.5;
  background: #f8f9fa;
  border-color: #dee2e6;
  pointer-events: none; /* 禁止点击 */
  transform: none !important;
  box-shadow: none !important;
}

.item-box.invalid .main-display {
  color: #adb5bd;
}

/* ======== 文字 ======== */
.main-display {
  font-size: 20px;
  text-align: center;
  color: #495057;
  line-height: 1.25;
}

</style>