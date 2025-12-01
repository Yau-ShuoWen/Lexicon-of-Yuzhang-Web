<template>
  <div class="search-input-container">
    <div class="card search-card">
      <div class="card-body">
        <div class="search-form">

          <div class="search-main">
            <div class="form-group search-input-group">
              <input
                  type="text"
                  v-model="hanziInput"
                  placeholder="查询内容"
                  @keyup.enter="handleSearch"
                  class="form-control form-control-lg"
              />

              <div class="input-right-buttons">
                <LanguageSwitcher class="language-switcher" />
                <button
                    @click="toggleSettings"
                    class="btn btn-settings"
                    :class="{ active: showSettings }"
                    type="button"
                >
                  <img src="../assets/icons/set.svg" alt="设置" class="settings-icon" />
                </button>
              </div>
            </div>

            <button @click="handleSearch" :disabled="loading" class="btn btn-primary btn-lg btn-search">
              {{ loading ? '查询中...' : '查询' }}
            </button>
          </div>

          <div v-if="showSettings" class="search-params">

            <div class="form-group">
              <label v-formatted-text="$t('search.fuzzy_recognition')"/>
              <select v-model="vague" @change="saveConfig" class="form-control">
                <option :value="true" v-formatted-text="$t('common.open')"/>
                <option :value="false" v-formatted-text="$t('common.close')"/>
              </select>
            </div>

            <div class="form-group">
              <label>读音标注方法</label>
              <select v-model="phonogram" @change="saveConfig" class="form-control">
                <option :value="1">拼音</option>
                <option :value="2">国际音标</option>
              </select>
            </div>

            <div v-if="phonogram!==1" class="form-group">
              <label>自定义拼音样式</label>
              <select v-model="syllable" @change="saveConfig" class="form-control">
                <option :value="0">{{ $t('linguistic.ipa.chinese') }}</option>
                <option :value="1">{{ $t('linguistic.ipa.standard') }}</option>
              </select>
            </div>

            <div v-if="phonogram!==1" class="form-group">
              <label>{{ $t('linguistic.tone.hint') }}</label>
              <select v-model="tone" @change="saveConfig" class="form-control">
                <option :value="0">{{ $t('linguistic.tone.five_degree.number') }}</option>
                <option :value="1">{{ $t('linguistic.tone.five_degree.symbol') }}</option>
                <option :value="2">{{ $t('linguistic.tone.four_corners') }}</option>
              </select>
            </div>
          </div>

          <div v-if="error" class="card card-error mt-4">
            <div class="card-body">
              <div class="error-content">
                <span class="error-icon">⚠️</span>
                {{ error }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from "./Button/LanguageSwitcher.vue";

// 缓存键名常量
const STORAGE_KEYS = {
  SEARCH_CONFIG: 'search_page_config',
  SEARCH_HISTORY: 'search_history_temp'
};

const router = useRouter()
const { locale } = useI18n()

const hanziInput = ref('')
const phonogram = ref(1)
const vague = ref(false)
const syllable = ref(0)
const tone = ref(0)
const loading = ref(false)
const error = ref('')
const showSettings = ref(false)

const saveConfig = () => {
  try {
    const config = {
      phonogram: phonogram.value,
      vague: vague.value,
      syllable: syllable.value,
      tone: tone.value
    };
    localStorage.setItem(STORAGE_KEYS.SEARCH_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('保存搜索配置到缓存失败:', err);
  }
};

// 保存搜索历史（临时存储1分钟）
const saveSearchHistory = (query) => {
  try {
    const history = {
      query: query,
      timestamp: Date.now(),
      expiresAt: Date.now() + 60 * 1000 // 1分钟后过期
    };
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
  } catch (err) {
    console.error('保存搜索历史失败:', err);
  }
};

// 加载搜索历史
const loadSearchHistory = () => {
  try {
    const historyData = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    if (historyData) {
      const history = JSON.parse(historyData);

      // 检查是否过期
      if (Date.now() < history.expiresAt) {
        return history.query;
      } else {
        // 如果过期，清除历史记录
        localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
      }
    }
  } catch (err) {
    console.error('加载搜索历史失败:', err);
  }
  return '';
};

// 清除搜索历史
const clearSearchHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
  } catch (err) {
    console.error('清除搜索历史失败:', err);
  }
};

const loadConfigFromCache = () => {
  try {
    const cachedConfig = localStorage.getItem(STORAGE_KEYS.SEARCH_CONFIG);
    if (cachedConfig) {
      const parsedConfig = JSON.parse(cachedConfig);

      // 设置到对应的ref变量
      if (parsedConfig.phonogram !== undefined) phonogram.value = parsedConfig.phonogram;
      if (parsedConfig.vague !== undefined) vague.value = parsedConfig.vague;
      if (parsedConfig.syllable !== undefined) syllable.value = parsedConfig.syllable;
      if (parsedConfig.tone !== undefined) tone.value = parsedConfig.tone;

      return true;
    }
  } catch (err) {
    console.error('从缓存加载搜索配置失败:', err);
  }
  return false;
};

const toggleSettings = () => {
  showSettings.value = !showSettings.value
}

const handleSearch = () => {
  const query = hanziInput.value.trim();

  if (!query) {
    error.value = '请输入要查询的汉字'
    return
  }

  error.value = ''

  // 保存搜索历史
  saveSearchHistory(query);

  router.push({
    path: '/search',
    query: {
      q: query
    }
  })
}

// 组件挂载时加载缓存配置和搜索历史
onMounted(() => {
  loadConfigFromCache();

  // 加载搜索历史并填充到输入框
  const lastSearch = loadSearchHistory();
  if (lastSearch) {
    hanziInput.value = lastSearch;
  }
});

// 使用watch监听所有配置项的变化
watch([phonogram, vague, syllable, tone], () => {
  saveConfig();
});
</script>

<style scoped>
.search-card {
  max-width: 800px;
  margin: 0 auto;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.search-main {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
}

.search-input-group {
  position: relative;
  flex: 1;
}

.form-control-lg {
  padding: var(--spacing-lg);
  font-size: var(--font-size-lg);
  padding-right: 120px; /* 增加右边距，给按钮区域腾出空间 */
}

/* 右侧按钮容器 */
.input-right-buttons {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

/* 语言切换器样式 */
.language-switcher {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

/* 设置按钮样式 */
.btn-settings {
  background: transparent;
  border: none;
  padding: 8px;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.btn-settings:hover {
  background: var(--color-border);
}

.btn-settings.active {
  background: var(--color-primary);
}

.btn-settings.active .settings-icon {
  filter: brightness(0) invert(1);
}

.settings-icon {
  width: 20px;
  height: 20px;
  transition: all var(--transition-base);
}

.btn-search {
  min-width: 100px;
  height: fit-content;
  align-self: stretch;
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

.error-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-error);
}

.error-icon {
  font-size: var(--font-size-lg);
}
</style>