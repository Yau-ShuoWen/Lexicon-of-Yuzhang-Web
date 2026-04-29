<!-- PinyinTable -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatRichText } from '../../utils/textFormatter.js'
import { showError } from '../../services/ToastService.js'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import PinyinDetail from "./PinyinDetail.vue";
import RichText from "../../components/Text/RichText.vue";
import CopyButton from "../../components/Button/CopyButton.vue";

const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const pinyinData = ref([])
const loading = ref(true)
const showDetail = ref(false)
const currentKey = ref('')

const pinyinInput = ref('')
const pinyinOutput = ref('')

// 生命周期
onMounted(fetchTable)

async function fetchTable() {
  try {
    loading.value = true
    const res = await fetch(`/api/pinyin/table/${dialect.value}`)
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

  currentKey.value = item.id
  showDetail.value = true
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
  <div class="broaden-layout">

    <LoadingIcon v-if="loading"/>

    <div v-else class="pinyin-container">


      <div class="attribute-group">

        <div class="group-header">
          <h3>方言拼音生成器</h3>
        </div>

        <div class="severable-group">

          <input type="text"  inputmode="" pattern="[A-Za-z0-9]*"
                 maxlength="50" placeholder="輸入拼音字母" v-model="pinyinInput"
                 class="form-control middle-input pinyin-input-text"/>

          <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                    :model-value="pinyinInput" v-model:outputValue="pinyinOutput"
                    class="pinyin-input-text"/>

          <CopyButton v-if="pinyinOutput" class="dev-btn-middle dev-normal-button" :text="pinyinOutput"/>


        </div>


      </div>

      <div class="gray-text" v-formatted-text="$t('pinyin_table.hint')"/>

      <div
          v-for="grid in pinyinData"
          :key="grid.code"
          class="attribute-group final-group"
      >

        <div class="group-header">
          <h3>{{ grid.name[language] }}</h3>
        </div>

        <div v-for="line in grid.line" :key="line.id" class="pinyin-line">
          <div v-for="group in line.group" :key="group.id" class="pinyin-group">
            <div class="items-grid">

              <div
                  v-for="item in group.item"
                  :key="item.id"
                  class="item-box clickable"
                  :class="{ invalid: !item.exist }"
                  @click="handleItemClick(item)"
              >
                <div
                    class="main-display"
                    v-html="formatDisplay(item)"
                />
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
  <PinyinDetail
      :show="showDetail"
      :dialect="dialect.toString()"
      :language="language.toString()"
      :pinyinKey="currentKey"
      @close="showDetail = false"
  />
</template>


<style>
/* ======== Attribute Block ======== */
.attribute-group {
  margin-bottom: 34px; /* Line组之间距离 */
  background: #fff;
  border-radius: 12px;
  padding: 20px 18px;
  border: 2px solid var(--color-primary-light);
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
  gap: 5px; /* Group内部Item间距 */
}

/* ======== Item ======== */
.item-box {
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);

  padding: 12px 8px;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;

  transition: all 0.3s ease;
}

/* ======== 可点击态 ======== */
.item-box.clickable {
  cursor: pointer;
}

/* hover 效果与页面1一致 */
.item-box.clickable:not(.invalid):hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  transform: translateY(0px);
}

/* ======== invalid ======== */
.item-box.invalid {
  opacity: 0.5;
  background: #f8f9fa;
  border-color: #dee2e6;

  pointer-events: none;
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
  color: var(--color-text);
  line-height: 1.25;
}

.pinyin-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.severable-group {
  flex-direction: column;
  gap: 10px;
}

.pinyin-input-text {
  margin:2px 0 ;
  width: 60%;
}

/* ======== Mobile Layout ======== */
@media (max-width: 450px) {

  /* 每行只有一个 group */
  .pinyin-line {
    flex-direction: column;
    gap: 14px;
  }

  .pinyin-group {
    width: 100%;
  }

  /* item 平均分配宽度 */
  .items-grid {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }

  .pinyin-input-text {
    width: 100%;
  }

}
</style>