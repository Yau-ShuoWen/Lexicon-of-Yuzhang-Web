<script>
import {formatRichText} from '../utils/textFormatter.js'
import LanguageChanger from "../components/Button/LanguageChanger.vue";

export default {
  name: 'PinyinTable',
  components: {LanguageChanger},

  data() {
    return {
      pinyinData: [],
      loading: true,
      selectedLast: null,
      selectedLastDisplay: '',
      tonePreviewData: []
    }
  },

  computed: {
    /** 声调（可被 preview 覆盖） */
    toneItems() {
      if (this.tonePreviewData?.length) {
        return this.tonePreviewData
      }
      return (
          this.pinyinData.find(g => g[0]?.attribute === 'tone') || []
      )
    },

    /** 声母（独立，不可选） */
    initialItems() {
      return (
          this.pinyinData.find(g => g[0]?.attribute === 'initial') || []
      )
    },

    /** 韵母（所有 last* 合并） */
    finalGroups() {
      return this.pinyinData
          .filter(g => g[0]?.attribute?.includes('last'))
          .map(group => ({
            attribute: group[0].attribute,
            title: this.getAttributeName(group[0].attribute),
            items: group
          }))
    }
  },

  mounted() {
    this.fetchPinyinTable()
  },

  methods: {
    async fetchPinyinTable() {
      try {
        this.loading = true
        const res = await fetch('/api/pinyin/nam/table')
        if (!res.ok) throw new Error(res.status)
        this.pinyinData = await res.json()
      } catch (e) {
        console.error(e)
        this.showError('加载拼音表失败')
      } finally {
        this.loading = false
      }
    },

    async handleItemClick(item) {
      if (!item.valid) return
      if (!item.attribute?.includes('last')) return

      this.selectedLast = item.keyboard
      this.selectedLastDisplay = this.formatDisplayText(item)

      try {
        const last = this.extractKeyboardValue(item.keyboard)
        const res = await fetch(
            `/api/pinyin/nam/get-tone-preview?last=${encodeURIComponent(last)}`
        )
        if (!res.ok) throw new Error(res.status)
        this.tonePreviewData = await res.json()
      } catch (e) {
        console.error(e)
        this.tonePreviewData = []
        this.showError('获取声调预览失败')
      }
    },

    formatDisplay(item) {
      if (!item.valid) {
        return formatRichText(' - ')
      }

      const s = item.standard?.trim() || ''
      const k = item.keyboard?.trim() || ''

      /** 声调：固定两行布局 */
      if (item.attribute === 'tone') {
        if (s === k) {
          // 一行内容，但用占位保证两行高度
          return formatRichText(
              `${s}\n&nbsp;`
          )
        } else {
          // 两行显示
          return formatRichText(
              `${s}\n${k}`
          )
        }
      }

      /** 其他（声母 / 韵母）：保持原逻辑 */
      const text = s === k ? s : `${s} / ${k}`

      try {
        return formatRichText(` ${text} `)
      } catch {
        return text
      }
    },


    formatDisplayText(item) {
      const s = item.standard?.trim() || ''
      const k = item.keyboard?.trim() || ''
      return s === k ? s : `${s} / ${k}`
    },

    extractKeyboardValue(keyboard) {
      return keyboard ? keyboard.replace(/[\[\]\s]/g, '') : ''
    },

    getAttributeName(attr) {
      return {
        tone: '声调',
        initial: '声母',
        lastWithSingle: '单韵母',
        lastWithDouble: '双韵母',
        lastWithNasal: '鼻音韵母',
        lastWithShort: '入声韵母'
      }[attr] || attr
    },

    isSelected(keyboard) {
      return this.selectedLast === keyboard
    },

    showError(message) {
      const el = document.createElement('div')
      el.className = 'error-message'
      el.textContent = message
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 3000)
    }
  }
}
</script>


<template>
  <div class="pinyin-table-container">
    <div v-if="loading" class="loading">加载中...</div>

    <div v-else>


      <!-- 声母 -->
      <div class="attribute-group initial-group">
        <div class="group-header"><h3>声母</h3></div>
        <div class="items-grid">
          <div
              v-for="(item, i) in initialItems"
              :key="i"
              class="item-box initial-item"
              :class="{ invalid: !item.valid }"
          >
            <div class="main-display" v-html="formatDisplay(item)"/>
          </div>
        </div>
      </div>

      <!-- 声调 -->
      <div class="attribute-group tone-group">
        <div class="group-header"><h3>声调（点击韵母查看变化）</h3></div>
        <div class="items-grid">
          <div
              v-for="(item, i) in toneItems"
              :key="i"
              class="item-box tone-item"
              :class="{ invalid: !item.valid }"
          >
            <div class="main-display" v-html="formatDisplay(item)"/>
          </div>
        </div>
      </div>

      <!-- 韵母 -->
      <div class="attribute-group final-group">
        <div class="group-header"><h3>韵母</h3></div>

        <div
            v-for="(group, gi) in finalGroups"
            :key="gi"
            class="final-subgroup"
        >
          <div class="final-subtitle">{{ group.title }}</div>

          <div class="items-grid">
            <div
                v-for="(item, i) in group.items"
                :key="i"
                class="item-box clickable"
                :class="{
                invalid: !item.valid,
                selected: isSelected(item.keyboard)
              }"
                @click="handleItemClick(item)"
            >
              <div class="main-display" v-html="formatDisplay(item)"/>
            </div>
          </div>
        </div>
      </div>


    </div>
  </div>
</template>


<style scoped>
.pinyin-table-container {
  max-width: 1300px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.header h1 {
  color: #2c3e50;
  margin: 0 0 15px 0;
  font-weight: 300;
}

.selection-info {
  font-size: 16px;
  color: #666;
}

.selected-value {
  font-weight: 600;
  color: #4dabf7;
  padding: 4px 12px;
  background: #e8f4fd;
  border-radius: 20px;
}

.loading {
  text-align: center;
  padding: 60px;
  font-size: 18px;
  color: #7f8c8d;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 声调区域特殊样式 */
.tone-group {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #dee2e6;
  margin-bottom: 30px;
}

.tone-group .group-description {
  color: #4dabf7;
  font-weight: 500;
}

.tone-item {
  background: white;
  border: 2px solid #4dabf7;
}

.tone-item.invalid {
  background: #212529;
  border-color: #495057;
}

.tone-item.invalid .main-display {
  color: #adb5bd;
}

/* 通用区域样式 */
.attribute-group {
  margin-bottom: 30px;
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.group-header {
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8e8e8;
}

.group-header h3 {
  margin: 0 0 5px 0;
  color: #34495e;
  font-size: 18px;
  font-weight: 600;
}

.group-description {
  color: #7f8c8d;
  font-size: 14px;
  display: block;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}

.item-box {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 14px 10px;
  transition: all 0.2s ease;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-box.clickable {
  cursor: pointer;
  background: #e8f4fd;
  border-color: #c1dbf2;
}

.item-box.clickable:hover {
  background: #d4eaf9;
  border-color: #4dabf7;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(77, 171, 247, 0.15);
}

.item-box.clickable.selected {
  background: #4dabf7;
  border-color: #339af0;
  color: white;
  transform: scale(1.02);
}

.item-box.invalid {
  background: #f8f9fa;
  border-color: #dee2e6;
  opacity: 0.6;
  cursor: not-allowed;
}

.item-box.invalid .main-display {
  color: #adb5bd;
}

.item-box.clickable.selected .main-display {
  color: white;
}

.main-display {
  font-size: 20px;
  font-weight: 400;
  text-align: center;
  color: #495057;
  line-height: 1.3;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
  }

  .item-box {
    padding: 12px 8px;
    min-height: 45px;
  }

  .main-display {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .pinyin-table-container {
    padding: 10px;
  }

  /* 强制 3 列 */
  .items-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .item-box {
    padding: 8px 4px;
    min-height: 44px; /* 手指友好 */
  }

  .main-display {
    font-size: 20px;
    line-height: 1.25;
  }

  .group-header h3 {
    font-size: 16px;
  }

  .final-subtitle {
    font-size: 13px;
    margin: 6px 0;
  }
}

</style>

<style>
/* 全局样式 */
.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #f56565;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.parenthesis {
  color: #666;
  font-weight: normal;
}

strong {
  font-weight: 600;
}

/* 声母 */
.initial-group {
  background: #fdfefe;
  border: 2px dashed #ced4da;
}

/* 韵母 */
.final-group {
  background: #f8fbff;
  border: 2px solid #cfe2ff;
}

.final-subgroup {
  margin-bottom: 18px;
}

.final-subtitle {
  font-size: 14px;
  color: #6c757d;
  margin: 8px 0;
  padding-left: 6px;
  border-left: 3px solid #dee2e6;
}
</style>