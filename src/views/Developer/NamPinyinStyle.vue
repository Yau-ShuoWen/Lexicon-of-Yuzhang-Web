<script setup>
import {ref, reactive, onMounted} from 'vue';
import {formatRichText} from "../../utils/textFormatter.js";
import JumpButton from "../../components/Button/JumpButton.vue";

// 缓存键名常量
const STORAGE_KEYS = {
  CONFIG: 'pinyin_style_config',
  PREVIEW: 'pinyin_style_preview'
};

const config = reactive({
  yu: 0,
  gn: 0,
  ee: 0,
  oe: 0,
  ii: 0,
  ptk: 0,
  yw: 0,
  capital: 0,
  num: 0,
  iu:0
});

const previewResult = ref('');
const loading = ref(false);
const error = ref('');

// 保存配置到缓存
const saveConfigToCache = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('保存配置到缓存失败:', err);
  }
};

// 从缓存加载配置
const loadConfigFromCache = () => {
  try {
    const cachedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (cachedConfig) {
      const parsedConfig = JSON.parse(cachedConfig);
      Object.assign(config, parsedConfig);
      return true;
    }
  } catch (err) {
    console.error('从缓存加载配置失败:', err);
  }
  return false;
};

// 保存预览结果到缓存
const savePreviewToCache = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.PREVIEW, previewResult.value);
  } catch (err) {
    console.error('保存预览结果到缓存失败:', err);
  }
};

// 从缓存加载预览结果
const loadPreviewFromCache = () => {
  try {
    const cachedPreview = localStorage.getItem(STORAGE_KEYS.PREVIEW);
    if (cachedPreview) {
      previewResult.value = cachedPreview;
      return true;
    }
  } catch (err) {
    console.error('从缓存加载预览结果失败:', err);
  }
  return false;
};

// 清除所有缓存
const clearCache = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.PREVIEW);
    return true;
  } catch (err) {
    console.error('清除缓存失败:', err);
    return false;
  }
};

const preview = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('/api/pinyin/preview/nam', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const apiResponse = await response.json();
    if (!apiResponse.success) throw new Error(apiResponse.message || '加载失败')

    previewResult.value = formatRichText(apiResponse.data);

    // 保存预览结果到缓存
    savePreviewToCache();
  } catch (err) {
    error.value = '预览请求失败: ' + err.message;
    console.error('Preview error:', err);
  } finally {
    loading.value = false;
  }
};

const reset1 = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('/api/pinyin/style-init/nam?SchemeParam=1');

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);


    const defaultConfig = await response.json();
    Object.assign(config, defaultConfig);

    // 保存默认配置到缓存
    saveConfigToCache();

    // 获取新的预览
    await preview();
  } catch (err) {
    error.value = '重置请求失败: ' + err.message;
    console.error('reset1 error:', err);
  } finally {
    loading.value = false;
  }
};

const reset2 = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('/api/pinyin/style-init/nam?SchemeParam=2');

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);


    const defaultConfig = await response.json();
    Object.assign(config, defaultConfig);

    // 保存默认配置到缓存
    saveConfigToCache();

    // 获取新的预览
    await preview();
  } catch (err) {
    error.value = '重置请求失败: ' + err.message;
    console.error('Reset error:', err);
  } finally {
    loading.value = false;
  }
};

// 清除缓存并重置
const clearCacheAndreset1 = async () => {
  const success = clearCache();
  if (success) {
    await reset1();
  } else {
    error.value = '清除缓存失败';
  }
};

onMounted(() => {
  // 尝试从缓存加载配置和预览
  const hasCachedConfig = loadConfigFromCache();
  const hasCachedPreview = loadPreviewFromCache();

  // 如果有缓存的配置但没有预览，或者没有缓存，则重置
  if ((hasCachedConfig && !hasCachedPreview) || (!hasCachedConfig && !hasCachedPreview)) {
    reset1();
  }
  // 如果两者都有缓存，则不需要额外操作，界面会显示缓存的内容
});

// 监听配置变化，自动保存到缓存
Object.keys(config).forEach(key => {
  // 使用watchEffect来监听每个配置项的变化
  // 这里使用一个简化的方式：在preview方法中保存配置
});

// 修改preview方法，在发送请求前保存配置
const previewWithCache = async () => {
  // 保存当前配置到缓存
  saveConfigToCache();
  await preview();
};

defineExpose({
  formatTextWithFont: formatRichText
});
</script>

<template>
  <div class="config-layout">
    <div class="config-main">
      <div class="preview-card card">

        <div class="preview-content">
          <div v-if="error" class="error-state">
            <span class="error-icon">❌</span>
            {{ error }}
          </div>
          <div v-else-if="loading" class="loading-state">
            <span class="loading-spinner"></span>
            加载中...
          </div>
          <div v-else-if="previewResult" class="preview-result" v-html="previewResult">
          </div>
          <div v-else class="preview-placeholder">
            <span class="placeholder-icon">👆</span>
            <p>请点击"预览效果"查看拼音显示</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置表单 -->
    <div class="config-sidebar card">
      <div class="card-body">

        <div class="button-group">
          <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
          <button class="dev-btn-middle dev-add-btn" @click="reset1" :disabled="loading">
            标准显示版本
          </button>
          <button class="dev-btn-middle dev-add-btn" @click="reset2" :disabled="loading">
            标准输入版本
          </button>
          <button class="dev-btn-middle dev-nav-button" @click="previewWithCache" :disabled="loading">
            结果刷新
          </button>
          <button class="dev-btn-middle dev-remove-btn" @click="clearCacheAndreset1" :disabled="loading">
            清除缓存
          </button>
        </div>

        <div class="config-form" style="flex-wrap: wrap">
          <div class="form-group">
            <h5>「余/句/女」韵母</h5>
            <select v-model="config.yu" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">使用字母 yu（普通话开头）</option>
              <option value="1">使用字母 ü（普通话书写）</option>
              <option value="2">使用字母 v（普通话输入）</option>
              <option value="3">使用字母 ụ</option>
            </select>
          </div>

          <div class="form-group">
            <h5>「念/捏/尼」声母</h5>
            <select v-model="config.gn" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">使用字母 n</option>
              <option value="1">使用字母 gn（老国音）</option>
            </select>
          </div>

          <div class="form-group">
            <h5>「深/更/本」主元音</h5>
            <select v-model="config.ee" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">使用字母 ee</option>
              <option value="1">使用字母 ẹ</option>
              <option value="2">使用字母 ё</option>
            </select>
          </div>

          <div class="form-group">
            <h5>「二/儿/耳」音节</h5>
            <select v-model="config.oe" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">使用字母 oe</option>
              <option value="1">使用字母 ọ</option>
              <option value="2">使用字母 ö</option>
              <option value="3">使用字母 o</option>
            </select>
          </div>

          <div class="form-group">
            <h5>「之/齿/时」音节</h5>
            <select v-model="config.ii" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">使用字母 ii</option>
              <option value="1">使用字母 i（普通话）</option>
              <option value="2">不使用字母 （空韵母）</option>
              <option value="3">使用韵母 ị</option>
            </select>
          </div>

          <div class="form-group">
            <h5>入声韵尾</h5>
            <select v-model="config.ptk" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">保留韵尾t k</option>
              <option value="1">隐藏韵尾</option>
              <option value="2">统一使用字母 h 表示</option>
              <option value="3">统一使用字母 q 表示</option>
              <option value="4">只有k韵尾替换为 h</option>
            </select>
          </div>

          <div class="form-group">
            <h5>零声母i u的规则</h5>
            <select v-model="config.yw" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">不改变</option>
              <option value="1">模仿普通话规律的yi wu</option>
              <option value="2">直接在i前加y，u前加w</option>
            </select>
          </div>

          <div class="form-group">
            <h5>大写</h5>
            <select v-model="config.capital" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">全部小写</option>
              <option value="1">全部大写</option>
              <option value="2">首字母大写</option>
            </select>
          </div>

          <div class="form-group">
            <h5>标注声调</h5>
            <select v-model="config.num" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">不加音调</option>
              <option value="1">符号音调加到主元音上</option>
              <option value="2">数字音调加到后面</option>
              <option value="3">符号音调加到后面</option>
            </select>
          </div>

          <div class="form-group">
            <h5>字母标注的优先级</h5>
            <select v-model="config.iu" @change="previewWithCache" class="dev-form-field dev-form-field-mid">
              <option value="0">默认顺序 i>u</option>
              <option value="1">并排时标在后面</option>
              <option value="2">并排时标在前面</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-layout {
  position: sticky;
  display: grid;
  grid-template-columns: 600px 1fr;
  gap: var(--spacing-xl);
  margin: 0 auto;
  align-items: start;
}

.config-sidebar {
  top: var(--spacing-xl);
  height: fit-content;
  overflow-y: auto;
}

.config-form {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.form-group {
  flex: 1 1 1 calc(50% - var(--spacing-md));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}


/* 按钮组样式 */
.button-group {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
  flex-wrap: wrap;
  width: 100%;
}

/* 确保按钮占据全宽 */
.button-group button {
  flex: 1 1 1 1 calc(50% - var(--spacing-md));
  min-width: 120px;
}

/* 预览区域保持不变 */
.config-main {
  display: flex;
  flex-direction: column;
  min-height: 500px;
  width: 600px;
}

.preview-card {
  flex: 1;
  position: sticky;
  top: var(--spacing-xl);
  height: fit-content;
  min-height: 300px;
}

.preview-content {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-state {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-error);
  background: #fdf0ed;
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-md);
  border-left: 4px solid var(--color-error);
  width: 100%;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-primary);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.preview-result {
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: 1.6;
  text-align: center;
  padding: var(--spacing-lg);
  background: var(--color-background);
  border-radius: var(--border-radius-md);
  width: 100%;
}

.preview-placeholder {
  text-align: center;
  color: var(--color-text-lighter);
  padding: var(--spacing-2xl);
}

.placeholder-icon {
  font-size: 2rem;
  margin-bottom: var(--spacing-md);
  display: block;
}
</style>