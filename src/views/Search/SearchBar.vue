<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  getValidatedSearchConfig,
  saveSearchConfig
} from '../../utils/searchConfig.js'

const router = useRouter()
const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const hanziInput = ref('')

const config = getValidatedSearchConfig()

/**
 * 保留旧配置
 */
const tone = ref(config.toneStyle)
const syllable = ref(config.syllableStyle)
const vague = ref(config.vague)

/**
 * 搜索历史
 */
const saveSearchHistory = (query) => {
  try {
    localStorage.setItem(
        'search_history_temp',
        JSON.stringify({
          query,
          timestamp: Date.now(),
          expiresAt: Date.now() + 60 * 1000
        })
    )
  } catch {
  }
}

const loadSearchHistory = () => {
  try {
    const data = localStorage.getItem('search_history_temp')

    if (!data) return ''

    const history = JSON.parse(data)

    if (Date.now() < history.expiresAt) {
      return history.query
    }

    localStorage.removeItem('search_history_temp')
  } catch {
  }

  return ''
}

/**
 * 保存配置
 */
const saveConfig = () => {
  saveSearchConfig({
    toneStyle: tone.value,
    syllableStyle: syllable.value,
    vague: vague.value
  })
}

/**
 * 搜索
 */
const handleSearch = () => {
  const query = hanziInput.value.trim()

  if (!query) return

  saveSearchHistory(query)

  router.push({
    path: `/${language.value}/${dialect.value}/dict/search`,
    query: {
      q: query
    }
  })
}

/**
 * 随机
 */
const handleRandom = () => {
  router.push({
    path: `/${language.value}/${dialect.value}/dict/search`,
    query: {
      q: 'random'
    }
  })
}

const handleSettings = () => {
  router.push(`/${language.value}/${dialect.value}/dict/settings`)
}

/**
 * 历史（预留）
 */
const handleHistory = () => {
  console.log('TODO history')
}

/**
 * 指南（预留）
 */
const handleGuide = () => {
  console.log('TODO guide')
}

onMounted(() => {
  const lastSearch = loadSearchHistory()

  if (lastSearch) {
    hanziInput.value = lastSearch
  }

  saveConfig()
})
</script>

<template>
  <div class="search-bar">

    <div class="search-container ">

      <textarea
          v-model="hanziInput"
          class="search-input"
          :placeholder="$t('search.hint')"
          rows="3"
          @keydown.enter.exact.prevent="handleSearch"
      />

      <div class="toolbar">

        <!-- 左侧功能区 -->
        <div class="toolbar-left">

          <button class="capsule-btn" type="button" @click="handleRandom">
            <img src="../../assets/icons/random.svg" alt="random" class="toolbar-icon-left">
            <span>{{ $t('search.random') }}</span>
          </button>

          <button class="capsule-btn settings-entry" type="button" @click="handleSettings">
            <img src="../../assets/icons/set.svg" alt="" class="toolbar-icon-left">
            <span>{{ $t('nav.settings') }}</span>
          </button>
<!--          <button-->
<!--              class="capsule-btn"-->
<!--              type="button"-->
<!--              @click="handleGuide"-->
<!--          >-->
<!--            <img-->
<!--                src="../../assets/icons/information.svg"-->
<!--                alt="guide"-->
<!--                class="toolbar-icon-left"-->
<!--            >-->
<!--            <span>指南</span>-->
<!--          </button>-->

        </div>

        <!-- 右侧操作区 -->
        <div class="toolbar-right">

          <button
              class="search-btn btn-settings"
              type="button"
              @click="handleSearch"
          >
            <img src="../../assets/icons/search.svg" alt="search" class="toolbar-icon-right">
          </button>

        </div>

      </div>

    </div>

  </div>
</template>

<style>
.search-bar {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-md) var(--spacing-md);
}

.search-container {
  position: relative;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  transition: border-color var(--transition-base),
  box-shadow var(--transition-base);
  overflow: hidden;
}

.search-container:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(46, 125, 50, 0.2);
}

/* 输入框 */

.search-input {
  width: 100%;
  min-height: 100px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--font-size-base);
  padding: 18px 18px 18px 18px;
}

/* 底部工具栏 */

.toolbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  gap: 10px;
}

.capsule-btn {
  height: 32px;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: background-color .2s ease,
  border-color .2s ease;
}

.capsule-btn:hover {
  background: var(--color-border-light);
}

.toolbar-icon-left {
  width: 18px;
  height: 18px;
}

.toolbar-icon-right {
  width: 30px;
  height: 30px;
}

/* 手机 */

@media (max-width: 576px) {

  .search-bar {
    padding-left: 0;
    padding-right: 0;
  }

  .search-input {
    height: 100px;
    padding-bottom: 30px;
  }

  .capsule-btn {
    padding: 0 10px;
    font-size: 12px;
  }

  .toolbar-left {
    gap: 4px;
  }

  .toolbar-right {
    gap: 2px;
  }
}

</style>
