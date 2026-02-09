<template>

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

        <div class="button-group">
          <button @click="handleSearch" class="btn btn-settings" type="button">
            <img src="../assets/icons/search.svg" alt="搜索" class="control-icon"/>
          </button>

          <button @click="toggleSettings" class="btn btn-settings" :class="{ active: showSettings }" type="button">
            <img src="../assets/icons/set.svg" alt="设置" class="control-icon"/>
          </button>
        </div>

      </div>
    </div>

    <div v-if="showSettings" class="search-params">

      <div class="form-field">
        <label v-formatted-text="$t('search.fuzzy_recognition')"/>
        <select v-model="vague" @change="saveConfig" class="form-control">
          <option :value="true" v-formatted-text="$t('common.open')"/>
          <option :value="false" v-formatted-text="$t('common.close')"/>
        </select>
      </div>

      <div class="form-field">
        <label v-formatted-text="$t('linguistic.hint.how_to_mark')"/>
        <select v-model="phonogram" @change="saveConfig" class="form-control">
          <option :value="1" v-formatted-text="$t('linguistic.pinyin.self')"/>
          <option :value="2" v-formatted-text="$t('linguistic.ipa.self')   "/>
        </select>
      </div>

      <div v-if="phonogram!==1" class="form-field">
        <label>{{ $t('linguistic.hint.ipa_style') }}</label>
        <select v-model="syllable" @change="saveConfig" class="form-control">
          <option :value="1" v-formatted-text="$t('linguistic.ipa.chinese') "/>
          <option :value="2" v-formatted-text="$t('linguistic.ipa.standard')"/>
        </select>
      </div>

      <div v-if="phonogram!==1" class="form-field">
        <label>{{ $t('linguistic.hint.tone_style') }}</label>
        <select v-model="tone" @change="saveConfig" class="form-control">
          <option :value="1" v-formatted-text="$t('linguistic.tone.five_degree.number')"/>
          <option :value="2" v-formatted-text="$t('linguistic.tone.five_degree.symbol')"/>
          <option :value="3" v-formatted-text="$t('linguistic.tone.four_corners')      "/>
        </select>
      </div>
    </div>

  </div>

</template>

<script setup>
import {ref, onMounted, watch, computed} from 'vue'
import {useRouter, useRoute} from 'vue-router'

// 缓存键名常量
const STORAGE_KEYS = {
  SEARCH_CONFIG: 'search_page_config',
  SEARCH_HISTORY: 'search_history_temp'
};

const router = useRouter()
const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const hanziInput = ref('')
const phonogram = ref(1)
const vague = ref(false)
const syllable = ref(0)
const tone = ref(0)
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
    return
  }

  saveSearchHistory(query);// 保存搜索历史

  router.push({
    path: `/${language.value}/${dialect.value}/search`,
    query: {q: query}
  })
}

// 组件挂载时加载缓存配置和搜索历史
onMounted(() => {
  loadConfigFromCache();

  // 加载搜索历史并填充到输入框
  const lastSearch = loadSearchHistory();
  if (lastSearch) hanziInput.value = lastSearch;
});

// 使用watch监听所有配置项的变化
watch([phonogram, vague, syllable, tone], () => {
  saveConfig();
});
</script>

<style scoped>
.search-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  max-width: 800px;   /* 最大宽度 */
  width: 100%;        /* 小屏自适应 */
  margin: 0 auto;     /* 水平居中 */
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
  font-size: var(--font-size-lg);
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

.btn-settings.active .control-icon {
  filter: brightness(0) invert(1);
}

.control-icon {
  width: 20px;
  height: 20px;
  transition: all var(--transition-base);
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
    font-size: var(--font-size-sm);
  }

  .form-control-lg {
    padding: var(--spacing-md);
    padding-right: 80px;
    font-size: var(--font-size-sm);
  }

  .button-group {
    right: 4px;
    gap: 4px;
  }

  .btn-settings {
    width: 32px;
    height: 32px;
    padding: 6px;
  }

  .control-icon {
    width: 16px;
    height: 16px;
  }
}
</style>