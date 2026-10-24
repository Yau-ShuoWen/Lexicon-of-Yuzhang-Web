<script setup>
import { computed, ref, watch } from 'vue'
import { request } from '../../../services/request.js'
import { showError } from '../../../services/ToastService.js'

const props = defineProps({versions: {type: Array, required: true}})
const base = '/api/admin/reference-tsv/compare'
const fromId = ref('')
const toId = ref('')
const result = ref(null)
const loading = ref(false)
const type = ref('changes')
const searchText = ref('')
const query = ref('')
const selectedItems = ref(new Set())
const allSelected = computed(() => !!result.value?.items.length && result.value.items.every((_, index) => selectedItems.value.has(index)))
let requestNumber = 0

const categories = [
  {value: 'changes', label: '全部差异'},
  {value: 'modified', label: '明确修改'},
  {value: 'possible', label: '可能对应'},
  {value: 'conflict', label: '待核对'},
  {value: 'added', label: '新增'},
  {value: 'removed', label: '移除'},
  {value: 'unchanged', label: '未变化'},
]
const labels = Object.fromEntries(categories.map(item => [item.value, item.label]))
const shortLabels = {modified: '修改', possible: '待定', conflict: '冲突', added: '新增', removed: '移除', unchanged: '相同'}

watch(() => props.versions, versions => {
  const previousFrom = fromId.value
  const previousTo = toId.value
  const ids = new Set(versions.map(item => item.id))
  if (!ids.has(toId.value)) toId.value = versions[0]?.id || ''
  if (!ids.has(fromId.value) || fromId.value === toId.value)
    fromId.value = versions.find(item => item.id !== toId.value)?.id || ''
  if (previousFrom !== fromId.value || previousTo !== toId.value) resetComparison()
}, {immediate: true})

function titleOf(item) {
  return item.name || item.originalName.replace(/\.tsv$/i, '')
}

async function compare() {
  if (!fromId.value || !toId.value || fromId.value === toId.value) {
    showError('请选择两个不同版本')
    return
  }
  const current = ++requestNumber
  loading.value = true
  try {
    const params = new URLSearchParams({from: fromId.value, to: toId.value,
      type: type.value, query: query.value, size: '100'})
    const first = await request(`${base}?${params}&page=1`)
    const items = [...first.items]
    for (let page = 2; items.length < first.total; page++) {
      if (current !== requestNumber) return
      const next = await request(`${base}?${params}&page=${page}`)
      if (!next.items.length) throw new Error('差异数据未完整返回')
      items.push(...next.items)
    }
    if (current === requestNumber) {
      result.value = {...first, items}
      selectedItems.value = new Set()
    }
  } catch (error) {
    if (current === requestNumber) showError(`比较失败：${error.message}`)
  } finally {
    if (current === requestNumber) loading.value = false
  }
}

function resetComparison() {
  result.value = null
  requestNumber++
  loading.value = false
  type.value = 'changes'
  query.value = ''
  searchText.value = ''
  selectedItems.value = new Set()
}

function selectType(value) {
  type.value = value
  compare()
}

function search() {
  query.value = searchText.value.trim()
  compare()
}

function toggleItem(index) {
  const next = new Set(selectedItems.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  selectedItems.value = next
}

function toggleAll() {
  selectedItems.value = allSelected.value ? new Set() : new Set(result.value.items.map((_, index) => index))
}

function valuesOf(rows, column) {
  return rows.map(row => row.values[column] || '（空）').join('、')
}

function displayValuesOf(rows, column, name) {
  return rows.map(row => {
    const value = row.values[column]
    if (!value) return '（空）'
    if (name === '国际音标') return `[-${value}]`
    return ['方言拼音', '汉语拼音', '官话拼音'].includes(name) ? `[${value}]` : value
  }).join('、')
}

function hasChange(item, column) {
  return item.before.length && item.after.length
    && valuesOf(item.before, column) !== valuesOf(item.after, column)
}

function lineNumbers(rows) {
  return rows.map(row => row.line).join('、')
}
</script>

<template>
  <div class="compare-panel">
    <p class="hint">从旧版本到新版本比较。可能对应和待核对的记录不会自动视为确定修改；“本词”改名会暂列为移除和新增。</p>
    <div class="compare-selectors">
      <label>旧版本
        <select v-model="fromId" @change="resetComparison">
          <option value="" disabled>请选择</option>
          <option v-for="item in versions" :key="item.id" :value="item.id">{{ titleOf(item) }}</option>
        </select>
      </label>
      <span aria-hidden="true">→</span>
      <label>新版本
        <select v-model="toId" @change="resetComparison">
          <option value="" disabled>请选择</option>
          <option v-for="item in versions" :key="item.id" :value="item.id">{{ titleOf(item) }}</option>
        </select>
      </label>
      <button class="primary" :disabled="loading || !fromId || !toId || fromId === toId" @click="compare">
        {{ loading ? '比较中…' : '开始比较' }}
      </button>
    </div>

    <template v-if="result">
      <div class="summary">
        <span>未变化 {{ result.counts.unchanged }}</span>
        <span>明确修改 {{ result.counts.modified }}</span>
        <span>可能对应 {{ result.counts.possible }}</span>
        <span>待核对 {{ result.counts.conflict }}</span>
        <span>新增 {{ result.counts.added }}</span>
        <span>移除 {{ result.counts.removed }}</span>
      </div>
      <div class="filters">
        <button v-for="item in categories" :key="item.value" :class="{active: type === item.value}"
                :disabled="loading" @click="selectType(item.value)">{{ item.label }}</button>
        <input v-model="searchText" type="search" placeholder="在差异中查找文字" @keyup.enter="search" />
        <button class="primary" :disabled="loading" @click="search">查询</button>
      </div>
      <p v-if="!loading && !result.items.length" class="hint">这一类没有符合条件的记录。</p>
      <div v-if="result.items.length" class="selection-actions">
        <button :disabled="loading" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
        <span>已选 {{ selectedItems.size }} / {{ result.items.length }} 组</span>
      </div>
      <div v-loading="loading" class="table-area">
        <table v-if="result.items.length" class="diff-table">
          <thead>
            <tr><th class="select-column"><input type="checkbox" aria-label="全选差异" :checked="allSelected" :disabled="loading" @change="toggleAll" /></th><th class="type-column">差异</th><th class="line-column">行号</th><th v-for="name in result.columns" :key="name">{{ name }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in result.items" :key="index" :class="`row--${item.type}`">
              <td><input type="checkbox" :aria-label="`选择第 ${index + 1} 组差异`" :checked="selectedItems.has(index)" @change="toggleItem(index)" /></td>
              <th class="type-cell"><span class="status" :class="`status--${item.type}`" :title="labels[item.type]">{{ shortLabels[item.type] }}</span></th>
              <td class="line-cell">
                <span v-if="item.before.length">旧 {{ lineNumbers(item.before) }}</span>
                <span v-if="item.after.length && item.type !== 'unchanged'">新 {{ lineNumbers(item.after) }}</span>
              </td>
              <td v-for="(name, cell) in result.columns" :key="name" :class="{'changed-cell': hasChange(item, cell)}">
                <template v-if="hasChange(item, cell)">
                  <span class="before-value" v-formatted-text="`− ${displayValuesOf(item.before, cell, name)}`"></span>
                  <span class="after-value" v-formatted-text="`+ ${displayValuesOf(item.after, cell, name)}`"></span>
                </template>
                <span v-else-if="item.after.length" v-formatted-text="displayValuesOf(item.after, cell, name)"></span>
                <span v-else v-formatted-text="displayValuesOf(item.before, cell, name)"></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hint { color: var(--el-text-color-secondary, #66736b); font-size: .9rem; }
.compare-selectors, .filters, .pagination { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.compare-selectors { margin: 18px 0; }
.compare-selectors label { display: flex; align-items: center; gap: 8px; }
select, input { min-height: 36px; padding: 7px; border: 1px solid #ccd9ce; border-radius: 7px; max-width: 100%; }
.compare-selectors select { min-width: 180px; }
button { padding: 8px 14px; border: 1px solid #9bb8a1; border-radius: 7px; background: white; color: #2d6840; cursor: pointer; }
button.primary, .filters button.active { background: #397a48; border-color: #397a48; color: white; }
button:disabled { opacity: .5; cursor: default; }
.summary { display: flex; gap: 8px; flex-wrap: wrap; margin: 18px 0; }
.summary span { padding: 7px 10px; border-radius: 7px; background: #edf5ee; }
.filters { margin: 16px 0; }
.selection-actions { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
.filters input { min-width: 200px; }
.status { display: inline-block; padding: 3px 5px; border-radius: 6px; background: #edf5ee; color: #386e44; font-size: .78rem; font-weight: 500; white-space: nowrap; }
.status--possible, .status--conflict { background: #fff3dc; color: #885b0d; }
.status--removed { background: #fae8e8; color: #a43f3f; }
.status--added { background: #e6f2e9; color: #2c7540; }
.table-area { width: 100%; min-width: 0; margin-top: 14px; }
.diff-table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.diff-table th, .diff-table td { border: 1px solid #e0e7e1; padding: 7px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
.diff-table thead th { background: #f3f7f3; }
.diff-table tbody th { font-weight: normal; }
.diff-table .type-column { width: 52px; }
.diff-table .select-column { width: 38px; }
.diff-table .line-column { width: 68px; }
.diff-table .row--added { background: #f1faf3; }
.diff-table .row--removed { background: #fff3f3; }
.diff-table .changed-cell { background: #fff9e9; }
.line-cell { color: #66736b; font-size: .78rem; }
.line-cell span { display: block; }
.before-value, .after-value { display: block; }
.before-value { color: #a43f3f; text-decoration: line-through; }
.after-value { color: #24723b; }
.pagination { justify-content: flex-end; margin-top: 16px; }
@media (max-width: 700px) { .compare-selectors label { width: 100%; justify-content: space-between; } }
</style>
