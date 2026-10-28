<script setup>
import { CopyDocument } from '@element-plus/icons-vue'
import { showError, showSuccess } from '../../../services/ToastService.js'

const groups = [
  { title: '五度标记法', symbols: ['˥', '˦', '˧', '˨', '˩', '꜒', '꜓', '꜔', '꜕', '꜖'] },
  { title: '南昌话音调角标（不包含a）', symbols: ['̀', '́', '̌', '̄', '̉', '̋', '̏'], combining: true },
]

const copySymbol = async symbol => {
  try {
    await navigator.clipboard.writeText(symbol)
    showSuccess('复制成功')
  } catch (error) {
    console.error('复制失败:', error)
    showError('复制失败')
  }
}
</script>

<template>
  <div class="symbol-table-wrap">
    <table class="symbol-table">
      <tbody>
        <tr v-for="group in groups" :key="group.title">
          <th scope="row">{{ group.title }}</th>
          <td>
            <div class="symbol-list">
              <span
                v-for="(symbol, index) in group.symbols"
                :key="index"
                class="symbol-item"
              >
                <span class="symbol-glyph" aria-hidden="true" v-formatted-text=" group.combining ? `[a${symbol}]` : `[-${symbol}]`" @click="copySymbol(symbol)"></span>
                <button
                  type="button"
                  class="symbol-copy"
                  :aria-label="`复制${group.title}符号${index + 1}`"
                  @click="copySymbol(symbol)"
                ><CopyDocument /></button>
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.symbol-table-wrap { max-width: 100%; overflow-x: auto; }
.symbol-table { width: max-content; border-collapse: collapse; font-size: 13px; }
.symbol-table th, .symbol-table td { padding: 6px 8px; border: 1px solid #e5e5e5; text-align: left; vertical-align: middle; }
.symbol-table th { background: #f7f7f7; font-weight: 600; white-space: nowrap; }
.symbol-list { display: flex; align-items: center; gap: 10px; }
.symbol-item { display: inline-flex; align-items: center; flex: none; gap: 2px; color: var(--color-text); }
.symbol-glyph { min-width: 18px; font-size: 20px; line-height: 1.5; text-align: center; cursor: pointer; user-select: none; -webkit-user-select: none; }
.symbol-copy { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 2px; border: 0; border-radius: 4px; background: transparent; color: var(--color-text-light); cursor: pointer; visibility: hidden; }
.symbol-copy svg { width: 15px; height: 15px; }
.symbol-item:hover .symbol-copy, .symbol-copy:focus-visible { visibility: visible; }
.symbol-copy:hover, .symbol-copy:focus-visible { color: var(--color-primary); }
@media (hover: none) { .symbol-copy { visibility: visible; } }
</style>
