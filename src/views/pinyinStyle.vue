<script setup>
import { ref, reactive, onMounted } from 'vue';
import {formatTextWithFont} from "../utils/textFormatter.js";

// 配置参数模型
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

// 响应数据
const previewResult = ref('');
const loading = ref(false);
const error = ref('');

// 预览功能
const preview = async () => {
  loading.value = true;
  error.value = '';
  //previewResult.value = '';

  try {
    const response = await fetch('http://localhost:8080/api/pinyin/nam/preview', {
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

// 重置功能
const reset = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('http://localhost:8080/api/pinyin/nam/style/init');

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

// 组件挂载时初始化
onMounted(() => {
  reset();
});

// 暴露方法给父组件
defineExpose({
  formatTextWithFont
});
</script>

<template>
  <div class="pinyin-config-container">
    <div class="config-header">
      <h2>拼音样式配置</h2>
      <p>调整拼音显示参数并预览效果</p>
    </div>

    <div class="config-content">
      <div class="config-form">
        <div class="form-group">
          <label>ü 的处理方式 (yu):</label>
          <select v-model="config.yu" @change="preview">
            <option value="0">不处理</option>
            <option value="1">将 v 替换为 ü</option>
            <option value="2">将 v 替换为 yu</option>
          </select>
        </div>

        <div class="form-group">
          <label>"gn" 音的处理方式</label>
          <select v-model="config.gn" @change="preview">
            <option value="0">保留原来的n</option>
            <option value="1">恢复为gn</option>
          </select>
        </div>

        <div class="form-group">
          <label>ee 的处理方式</label>
          <select v-model="config.ee" @change="preview">
            <option value="0">不处理</option>
            <option value="1">替换为 ё</option>
            <option value="2">替换为 ẹ</option>
          </select>
        </div>

        <div class="form-group">
          <label>oe 的处理方式</label>
          <select v-model="config.oe" @change="preview">
            <option value="0">不处理</option>
            <option value="1">替换为 ö</option>
            <option value="2">替换为 ̣ọ</option>
            <option value="3">替换为 o</option>
          </select>
        </div>

        <div class="form-group">
          <label>ii 的处理方式</label>
          <select v-model="config.ii" @change="preview">
            <option value="0">不处理</option>
            <option value="1">替换为 i</option>
            <option value="2">使用zcs</option>
          </select>
        </div>

        <div class="form-group">
          <label>入声尾音的处理</label>
          <select v-model="config.ptk" @change="preview">
            <option value="0">不处理</option>
            <option value="1">删除结尾的 t 或 k</option>
            <option value="2">将结尾的 t 或 k 替换为 h</option>
            <option value="3">将结尾的 t 或 k 替换为 q</option>
          </select>
        </div>

        <div class="form-group">
          <label>替代声母规则</label>
          <select v-model="config.alt" @change="preview">
            <option value="0">不处理</option>
            <option value="1">符合普通话规律的</option>
            <option value="2">直接在i前加y，u前加w</option>
          </select>
        </div>

        <div class="form-group">
          <label>大写格式控制</label>
          <select v-model="config.capital" @change="preview">
            <option value="0">全部小写</option>
            <option value="1">全部大写</option>
            <option value="2">首字母大写</option>
          </select>
        </div>

        <div class="form-group">
          <label>标注声调的方式</label>
          <select v-model="config.num" @change="preview">
            <option value="0">不加音调</option>
            <option value="1">智能添加，符合规范</option>
            <option value="2">符号音调加到后面</option>
            <option value="3">数字音调加到后面</option>
          </select>
        </div>

        <div class="button-group">
          <button class="preview-btn" @click="preview" :disabled="loading">
            {{ loading ? '处理中...' : '预览效果' }}
          </button>
          <button class="reset-btn" @click="reset" :disabled="loading">
            重置配置
          </button>
        </div>
      </div>

      <div class="preview-panel">
        <div class="preview-section">
          <h3>预览效果</h3>
          <div class="preview-box">
            <div v-if="error" class="error-state">
              {{ error }}
            </div>
            <div v-else-if="previewResult" class="preview-result"
            v-html="previewResult">
            </div>
            <div v-else class="preview-placeholder">
              请点击"预览效果"查看拼音显示
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.pinyin-config-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.config-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e1e5e9;
}

.config-header h2 {
  color: #2c3e50;
  margin-bottom: 8px;
}

.config-header p {
  color: #7f8c8d;
  font-size: 16px;
}

.config-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.config-form {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  transition: border-color 0.3s;
}

.form-group select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.button-group {
  display: flex;
  gap: 15px;
  margin-top: 25px;
}

.button-group button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.button-group button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.preview-btn {
  background: #3498db;
  color: white;
}

.preview-btn:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-1px);
}

.reset-btn {
  background: #95a5a6;
  color: white;
}

.reset-btn:hover:not(:disabled) {
  background: #7f8c8d;
  transform: translateY(-1px);
}

.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview-section, .config-display {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.preview-section h3, .config-display h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 16px;
  border-bottom: 1px solid #e1e5e9;
  padding-bottom: 8px;
}

.preview-box {
  min-height: 100px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px dashed #dcdfe6;
}

.loading-state {
  color: #3498db;
  text-align: center;
  padding: 20px;
}

.error-state {
  color: #e74c3c;
  background: #fdf0ed;
  padding: 15px;
  border-radius: 4px;
  border-left: 4px solid #e74c3c;
}

.preview-result {
  color: #27ae60;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.6;
}

.preview-placeholder {
  color: #95a5a6;
  text-align: center;
  padding: 30px;
  font-style: italic;
}

.config-json {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

@media (max-width: 768px) {
  .config-content {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .pinyin-config-container {
    padding: 15px;
  }

  .config-form {
    padding: 20px;
  }

  .button-group {
    flex-direction: column;
  }
}
</style>