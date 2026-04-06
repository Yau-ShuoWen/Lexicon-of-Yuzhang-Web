<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getValidatedSearchConfig, saveSearchConfig } from '../../utils/searchConfig.js'
import Info from "../../components/Status/Info.vue";

const router = useRouter()
const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 输入框和设置显示状态
const hanziInput = ref('')
const showSettings = ref(false)

// --- 配置项 ---
const config = getValidatedSearchConfig()
const phonogram = ref(config.phonogram)
const tone = ref(config.toneStyle)
const syllable = ref(config.syllableStyle)
const vague = ref(config.vague)

// 切换显示设置面板
const toggleSettings = () => showSettings.value = !showSettings.value

// 当用户修改配置时保存
const onConfigChange = () => {
  // 自动修正超出范围的值
  phonogram.value = [1, 2, 3].includes(phonogram.value) ? phonogram.value : 1
  tone.value = [1, 2, 3].includes(tone.value) ? tone.value : 1
  syllable.value = [1, 2].includes(syllable.value) ? syllable.value : 1
  vague.value = typeof vague.value === 'boolean' ? vague.value : true

  saveSearchConfig({
    phonogram: phonogram.value,
    toneStyle: tone.value,
    syllableStyle: syllable.value,
    vague: vague.value
  })
}

// 搜索历史操作
const saveSearchHistory = (query) => {
  try {
    localStorage.setItem('search_history_temp', JSON.stringify({
      query,
      timestamp: Date.now(),
      expiresAt: Date.now() + 60 * 1000
    }))
  } catch {
  }
}

const loadSearchHistory = () => {
  try {
    const data = localStorage.getItem('search_history_temp')
    if (!data) return ''
    const h = JSON.parse(data)
    if (Date.now() < h.expiresAt) return h.query
    localStorage.removeItem('search_history_temp')
  } catch {
  }
  return ''
}

// 搜索操作
const handleSearch = () => {
  const query = hanziInput.value.trim()
  if (!query) return
  saveSearchHistory(query)
  router.push({
    path: `/${language.value}/${dialect.value}/search`,
    query: {q: query}
  })
}

// 初始化加载缓存配置和搜索历史
onMounted(() => {
  const lastSearch = loadSearchHistory()
  if (lastSearch) hanziInput.value = lastSearch
  // 自动修正缓存中错误值
  onConfigChange()
})

// watch 自动保存配置变化
watch([phonogram, tone, syllable, vague], () => onConfigChange())
</script>

<template>
  <div class="search-form">
    <div class="search-main">
      <div class="form-group search-input-group">
        <input
            type="text"
            v-model="hanziInput"
            :placeholder="$t('search.hint')"
            @keyup.enter="handleSearch"
            class="form-control form-control-lg"
        />

        <div class="button-group">
          <button @click="handleSearch" class="btn btn-settings" type="button">
            <img src="../../assets/icons/search.svg" alt="搜索" class="control-icon"/>
          </button>

          <button @click="toggleSettings" class="btn btn-settings" :class="{ active: showSettings }" type="button">
            <img src="../../assets/icons/set.svg" alt="设置" class="control-icon"/>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSettings" class="search-params">
      <!-- 模糊识别 -->

      <div class="form-field">

        <Info :dialect="dialect.toString()" :language="language.toString()"
              textKey="explain-search-vague" :labelText="$t('search.fuzzy_recognition')"/>

        <select v-model="vague" @change="onConfigChange" class="form-control">
          <option :value="true" v-formatted-text="$t('common.open')"/>
          <option :value="false" v-formatted-text="$t('common.close')"/>
        </select>
      </div>

      <!-- 拼音/IPA选择 -->
      <div class="form-field">

        <Info :dialect="dialect.toString()" :language="language.toString()"
              textKey="explain-search-phonogram" :label-text="$t('linguistic.hint.how_to_mark')"/>

        <select v-model="phonogram" @change="onConfigChange" class="form-control">
          <option :value="1" v-formatted-text="$t('linguistic.pinyin.self')"/>
          <option :value="2" v-formatted-text="$t('linguistic.ipa.self')"/>
        </select>
      </div>

      <!-- IPA样式 -->
      <div v-if="phonogram !== 1" class="form-field">

        <Info :dialect="dialect.toString()" :language="language.toString()"
              textKey="explain-search-ipa-style" :label-text="$t('linguistic.hint.ipa_style')"/>

        <select v-model="syllable" @change="onConfigChange" class="form-control">
          <option :value="1" v-formatted-text="$t('linguistic.ipa.chinese')"/>
          <option :value="2" v-formatted-text="$t('linguistic.ipa.standard')"/>
        </select>
      </div>

      <!-- 声调样式 -->
      <div v-if="phonogram !== 1" class="form-field">

        <Info :dialect="dialect.toString()" :language="language.toString()"
              textKey="explain-search-tone-style" :label-text="$t('linguistic.hint.tone_style')"/>

        <select v-model="tone" @change="onConfigChange" class="form-control">
          <option :value="1" v-formatted-text="$t('linguistic.tone.five_degree.symbol')"/>
          <option :value="2" v-formatted-text="$t('linguistic.tone.five_degree.number')"/>
          <option :value="3" v-formatted-text="$t('linguistic.tone.four_corners')"/>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  font-size: var(--font-size-base);
  max-width: 800px; /* 最大宽度 */
  width: 100%; /* 小屏自适应 */
  margin: 0 auto; /* 水平居中 */
  padding: 0 var(--spacing-md); /* 防止贴边（可选） */
}

.search-main {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
  min-width: 100px;
}

.search-input-group {
  position: relative;
  flex: 1;
}

.form-control-lg {
  padding: var(--spacing-lg);
  padding-right: 120px; /* 增加右边距，给按钮区域腾出空间 */
}

/* 右侧按钮容器 */
.button-group {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

.search-params {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-background-alt);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--color-border);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 手机等小屏设备适配 */
@media (max-width: 576px) {

  * {
    font-size: var(--font-size-base);
  }

  .form-control-lg {
    padding: 14px 80px 14px 14px;
    font-size: var(--font-size-base);
    min-height: 70px;
  }

  .button-group {
    right: 4px;
    gap: 4px;
  }

  /* 设置项一行一个 */
  .search-params {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

}
</style>