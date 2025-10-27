<script setup>
import { ref, reactive, onMounted } from 'vue';
import {formatTextWithFont} from "../utils/textFormatter.js";

const config = reactive({
  yu: 1,
  gn: 0,
  ee: 2,
  oe: 3,
  ii: 1,
  ptk: 1,
  alt: 0,
  capital: 0,
  num: 1
});

const previewResult = ref('');
const loading = ref(false);
const error = ref('');

const preview = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('/api/pinyin/nam/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    previewResult.value = formatTextWithFont(data.message);
  } catch (err) {
    error.value = '预览请求失败: ' + err.message;
    console.error('Preview error:', err);
  } finally {
    loading.value = false;
  }
};

const reset = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('/api/pinyin/nam/style/init');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const defaultConfig = await response.json();
    Object.assign(config, defaultConfig);
    preview()
  } catch (err) {
    error.value = '重置请求失败: ' + err.message;
    console.error('Reset error:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  reset();
});

defineExpose({
  formatTextWithFont
});
</script>

<template>
  <div class="page-container">
    <div class="config-layout">
      <!-- 预览面板 -->
      <div class="config-main">
        <div class="preview-card card">
          <div class="card-header">
            <h3 class="card-title">预览效果</h3>
          </div>
          <div class="card-body">
            <div class="preview-content">
              <div v-if="error" class="error-state">
                <span class="error-icon">❌</span>
                {{ error }}
              </div>
<!--              <div v-else-if="loading" class="loading-state">-->
<!--                <span class="loading-spinner"></span>-->
<!--                加载中...-->
<!--              </div>-->
              <div v-else-if="previewResult" class="preview-result" v-html="previewResult">
              </div>
              <div v-else class="preview-placeholder">
                <span class="placeholder-icon">👆</span>
                <p>请点击"预览效果"查看拼音显示</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 配置表单 -->
      <div class="config-sidebar card">
        <div class="card-body">
          <h3 class="card-title">配置选项</h3>

          <div class="config-form" style="flex-wrap: wrap">
            <div class="form-group">
              <label>「余/句/女」韵母的字母版本</label>
              <select v-model="config.yu" @change="preview" class="form-control">
                <option value="0">使用字母 v</option>
                <option value="1">使用字母 ü</option>
                <option value="2">使用双字母 yu</option>
              </select>
            </div>

            <div class="form-group">
              <label>「念/捏/尼」音核的字母版本</label>
              <select v-model="config.gn" @change="preview" class="form-control">
                <option value="0">使用字母 n</option>
                <option value="1">使用老国音字母 gn</option>
              </select>
            </div>

            <div class="form-group">
              <label>「深/更/本」音核的字母版本</label>
              <select v-model="config.ee" @change="preview" class="form-control">
                <option value="0">使用双字母 ee</option>
                <option value="1">使用字母 ё</option>
                <option value="2">使用字母 ẹ</option>
              </select>
            </div>

            <div class="form-group">
              <label>「二/儿/耳」韵母的字母版本</label>
              <select v-model="config.oe" @change="preview" class="form-control">
                <option value="0">使用双字母 oe</option>
                <option value="1">使用字母 ö</option>
                <option value="2">使用字母 ọ</option>
                <option value="3">使用字母 o</option>
              </select>
            </div>

            <div class="form-group">
              <label>「之/齿/时」的字母版本</label>
              <select v-model="config.ii" @change="preview" class="form-control">
                <option value="0">使用双字母 ii</option>
                <option value="1">使用和普通话类似字母 i</option>
                <option value="2">使用空韵母 zcs</option>
              </select>
            </div>

            <div class="form-group">
              <label>入声韵尾的处理</label>
              <select v-model="config.ptk" @change="preview" class="form-control">
                <option value="0">保留韵尾t k</option>
                <option value="1">隐藏韵尾</option>
                <option value="2">统一使用字母 h 表示</option>
                <option value="3">统一使用字母 q 表示</option>
                <option value="4">只有k韵尾替换为 h</option>
              </select>
            </div>

            <div class="form-group">
              <label>零声母i u的规则</label>
              <select v-model="config.alt" @change="preview" class="form-control">
                <option value="0">不改变</option>
                <option value="1">模仿普通话规律的yi wu</option>
                <option value="2">直接在i前加y，u前加w</option>
              </select>
            </div>

            <div class="form-group">
              <label>大写格式控制</label>
              <select v-model="config.capital" @change="preview" class="form-control">
                <option value="0">全部小写</option>
                <option value="1">全部大写</option>
                <option value="2">首字母大写</option>
              </select>
            </div>

            <div class="form-group">
              <label>标注声调的方式</label>
              <select v-model="config.num" @change="preview" class="form-control">
                <option value="0">不加音调</option>
                <option value="1">符合规范的添加</option>
                <option value="2">符号音调加到后面</option>
                <option value="3">数字音调加到后面</option>
              </select>
            </div>

            <div class="button-group">
              <button class="btn btn-primary" @click="preview" :disabled="loading">
                结果刷新
              </button>
              <button class="btn btn-outline" @click="reset" :disabled="loading">
                重置配置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-layout {
  display: grid;
  grid-template-columns: 1fr 380px; /* 右侧固定较窄宽度 */
  gap: var(--spacing-xl);
  max-width: 1400px; /* 增加最大宽度 */
  margin: 0 auto;
  align-items: start;
}

.config-sidebar {
  position: sticky;
  top: var(--spacing-xl);
  height: fit-content;
  max-height: calc(100vh - var(--spacing-xl) * 2);
  overflow-y: auto;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md); /* 减小间距 */
}

.config-main {
  display: flex;
  flex-direction: column;
  min-height: 500px;
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
  color: var(--color-success);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: 1.6;
  text-align: center;
  padding: var(--spacing-lg);
  background: var(--color-background-alt);
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

.config-json {
  background: var(--color-background-alt);
  color: var(--color-text);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-md);
  overflow-x: auto;
  font-size: var(--font-size-sm);
  font-family: 'Courier New', monospace;
  margin: 0;
}

.button-group {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.button-group .btn {
  flex: 1;
}

/* 移动端样式 - 当屏幕宽度小于800px时 */
@media (max-width: 800px) {
  .config-layout {
    grid-template-columns: 1fr;
    gap: var(--spacing-lg);
    max-width: 100%;
    padding: 0 var(--spacing-md);
  }

  .config-sidebar {
    position: static;
    max-height: none;
    order: 2; /* 配置面板在移动端显示在下面 */
  }

  .config-main {
    order: 1; /* 预览区域在移动端显示在上面 */
    min-height: auto;
  }

  .preview-card {
    position: static;
    min-height: 200px;
  }

  .config-form {
    gap: var(--spacing-sm);
  }

  .form-group {
    margin-bottom: var(--spacing-sm);
  }

  .form-group label {
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-xs);
  }

  .form-control {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-sm);
  }
}

/* 超小屏幕优化 */
@media (max-width: 480px) {
  .config-layout {
    padding: 0 var(--spacing-sm);
  }

  .button-group {
    flex-direction: column;
  }

  .preview-result {
    font-size: var(--font-size-lg);
    padding: var(--spacing-md);
  }

  .card-body {
    padding: var(--spacing-md);
  }
}

/* 中等屏幕优化 (800px - 1200px) */
@media (min-width: 801px) and (max-width: 1200px) {
  .config-layout {
    grid-template-columns: 1fr 340px; /* 在中等屏幕上右侧更窄 */
    max-width: 100%;
    padding: 0 var(--spacing-lg);
  }
}

/* 大屏幕优化 */
@media (min-width: 1201px) {
  .config-layout {
    grid-template-columns: 1fr 380px;
  }
}
</style>