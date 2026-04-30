<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import RichText from "../../../components/Text/RichText.vue";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import { showError, showSuccess } from "../../../services/ToastService.js"
import CopyButton from "../../../components/Button/CopyButton.vue";

const props = defineProps({
  source: String,
  note: String,
  dialect: String,
  language: String,
  dict: String
})

// ==================== 状态 ====================
const keywordMap = ref(new Map())
const loadingSet = ref(new Set())

// ==================== 解析 ====================
function parseKeywords(text) {
  const regex = /\{([^\s{}]+)\}(?:\s*\[([^\]]+)\])?/g
  const result = []
  let match

  while ((match = regex.exec(text))) {
    let raw = match[1]
    if (raw.startsWith('-')) continue

    const word = raw.replace(/^\+/, '')
    const pinyin = match[2] || ''

    result.push({word, pinyin})
  }
  return result
}

// ==================== 查询 ====================
async function fetchLink(word, pinyin) {
  if (keywordMap.value.has(word)) return
  if (loadingSet.value.has(word)) return

  loadingSet.value.add(word)

  try {
    const res = await fetch(
        `/api/edit/ciyu/get-link/${props.dialect}/${props.dict}?ciyu=${encodeURIComponent(word)}`
    )
    const json = await res.json()

    if (json.success && !json.data.empty) {
      keywordMap.value.set(word, {id: json.data.value, pinyin})
    } else {
      keywordMap.value.set(word, {id: null, pinyin})
    }
  } catch (e) {
    console.error(e)
  }
  finally {
    loadingSet.value.delete(word)
  }
}

// ==================== 初始化 ====================
watch(
    () => props.source + props.note,
    (val) => {
      if (!val) return
      const list = parseKeywords(val)

      for (const k of list) {
        fetchLink(k.word, k.pinyin)
      }
    },
    {immediate: true}
)

const keywordList = computed(() => {
  const text = (props.source || '') + '\n' + (props.note || '')
  return parseKeywords(text)
})

// ==================== 弹窗 ====================
const showModal = ref(false)
const currentWord = ref('')
const currentPinyin = ref('')

const createData = ref({
  text: {sc: '', tc: ''},
  pys: ''
})

// 打开弹窗
function openCreate(word, pinyin) {
  currentWord.value = word
  currentPinyin.value = pinyin

  createData.value.text.tc = ''
  createData.value.text.sc = ''
  createData.value.pys = pinyin

  showModal.value = true
}

// 提交
async function submit() {
  try {
    const res = await fetch(`/api/edit/ciyu/create/${props.dialect}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(createData.value)
    })

    const data = await res.json()

    if (data.success) {
      showSuccess("创建成功")
      showModal.value = false

      // 🔥 重新查询 → 立即变链接
      keywordMap.value.delete(currentWord.value)
      await fetchLink(currentWord.value, currentPinyin.value)

    } else {
      showError(data.message)
    }
  } catch (e) {
    showError(e.message)
  }
}
</script>

<template>
  <div class="keyword-enhancer">

    <!-- 关键词列表 -->
    <div
        v-for="k in keywordList"
        :key="k.word + k.pinyin"
        class="keyword-item"
    >
      <template v-if="keywordMap.get(k.word)?.id">
        <a
            :href="`/${language}/${dialect}/ciyu-editor/${keywordMap.get(k.word).id}`"
            target="_blank"
            class="keyword-link"
        >
          {{ k.word }}
        </a>
      </template>

      <template v-else>
        <span class="keyword-missing">{{ k.word }}</span>
        <button
            class="dev-btn-small dev-add-btn"
            @click="openCreate(k.word, k.pinyin)"
        >
          创建词条
        </button>
      </template>
    </div>

    <!-- ==================== 弹窗 ==================== -->
    <div v-if="showModal" class="modal">
      <div class="overlay" @click="showModal = false"/>

      <div class="content">
        <h3>创建词条：{{ currentWord }}</h3>

        <div class="gray-text">流程：點擊按鈕複製，粘貼到繁體文本，校對、提交</div>


        <CopyButton :text="currentWord" class="dev-btn-small dev-normal-button"
        :hint="currentWord"
        />

        <ScAndTcText
            v-model:traditionalText="createData.text.tc"
            v-model:simplifiedText="createData.text.sc"
            layout="middle"
            :dialect="dialect"
        />


          <input
              v-model="createData.pys"
              class="form-control middle-input"
              placeholder="輸入拼音"
          />


        <RichText
            :dialect="dialect"
            :language="language"
            :model-value="createData.pys"
            :allPinyin="true"
        />

        <button @click="submit" class="dev-btn-small dev-add-btn">
          提交
        </button>

      </div>

    </div>

  </div>
</template>

<style scoped>
.keyword-item {
  margin-bottom: 6px;
}

.keyword-link {
  color: #2a6df4;
  text-decoration: underline;
}

.keyword-missing {
  color: #999;
  margin-right: 6px;
}

/* 弹窗 */
.modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.content {
  position: relative;
  margin: 10vh auto;
  width: 600px;
  background: white;
  padding: 20px;
  border-radius: 10px;

}
</style>