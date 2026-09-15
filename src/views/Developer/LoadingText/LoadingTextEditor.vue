<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import axios from 'axios'
import { getToken } from '../../../utils/auth.js'
import { showError, showSuccess } from '../../../services/ToastService.js'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'

const {t} = useI18n()
const route = useRoute()

const drafts = ref([])
const editorVersion = ref(0)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const searchQuery = ref('')
const dialectFilter = ref('all')

useHead({title: '加载提示语管理'})

const dialectOptions = computed(() => [
  {code: 'lac', name: t('dialect.lac')},
  {code: 'ced', name: t('dialect.ced')},
  {code: 'wuh', name: t('dialect.wuh')}
])
const editorDialect = computed(() => route.params.dialect?.toString() || 'lac')

const emptyDraft = () => ({
  id: null,
  tip: {sc: '', tc: ''},
  tag: [],
  _isNew: true,
  _deleted: false,
  _original: null
})

const clone = (value) => JSON.parse(JSON.stringify(value))

const normalizeItem = (item) => {
  const normalized = {
    id: item.id,
    tip: clone(item.tip || {sc: '', tc: ''}),
    tag: [...new Set(item.tag || [])],
    _isNew: false,
    _deleted: false
  }
  normalized._original = clone({tip: normalized.tip, tag: normalized.tag})
  return normalized
}

const request = async (url, options = {}) => {
  const token = getToken()
  const response = await axios({
    url,
    method: options.method || 'GET',
    params: {t: token},
    headers: {...options.headers, 'X-Auth-Token': token},
    data: options.body ? JSON.parse(options.body) : undefined
  })
  const result = response.data
  if (!result.success) throw new Error(result.message || '请求失败')
  return result.data
}

const requestErrorMessage = (error, fallback) => {
  const responseData = error.response?.data
  return responseData?.message
      || (typeof responseData === 'string' && responseData.trim())
      || error.message
      || fallback
}

const loadItems = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await request('/api/study/loading-text/manage') || []
    drafts.value = data.map(normalizeItem)
    editorVersion.value += 1
  } catch (e) {
    error.value = requestErrorMessage(e, '加载提示语列表失败')
    showError(`加载提示语失败：${error.value}`)
  }
  finally {
    loading.value = false
  }
}

const comparable = (item) => JSON.stringify({
  tip: item.tip || {sc: '', tc: ''},
  tag: [...new Set(item.tag || [])]
})

const isChanged = (item) => item._isNew || item._deleted || comparable(item) !== JSON.stringify(item._original)
const changedCount = computed(() => drafts.value.filter(isChanged).length)

const filteredDrafts = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  return drafts.value.filter(item => {
    // 新增行是当前编辑对象，不受搜索和方言筛选影响，避免空白行被隐藏。
    if (item._isNew) return true

    const textMatches = !query
        || `${item.tip?.sc || ''}\n${item.tip?.tc || ''}`.toLocaleLowerCase().includes(query)

    const tags = item.tag || []
    const dialectMatches = dialectFilter.value === 'all'
        || (dialectFilter.value === 'common' && !tags.length)
        || (dialectFilter.value.startsWith('dialect:') && (
            !tags.length || tags.includes(dialectFilter.value.slice('dialect:'.length))
        ))
        || (dialectFilter.value.startsWith('only:') && (
            tags.length > 0 && tags.includes(dialectFilter.value.slice('only:'.length))
        ))

    return textMatches && dialectMatches
  })
})

const visibleCountLabel = computed(() => {
  if (filteredDrafts.value.length === drafts.value.length) return `${drafts.value.length} 行`
  return `${filteredDrafts.value.length} / ${drafts.value.length} 行`
})

const rowKey = (item) => `${item._isNew ? `new-${drafts.value.indexOf(item)}` : item.id}-${editorVersion.value}`

const rowStateClass = (item) => {
  if (item._deleted) return 'deleted'
  if (item._isNew) return 'new'
  if (isChanged(item)) return 'modified'
  return 'unchanged'
}

const rowStateIcon = (item) => {
  if (item._deleted) return '×'
  if (item._isNew) return '＋'
  if (isChanged(item)) return '✎'
  return '✓'
}

const rowStateTitle = (item) => rowState(item)

const originalRowNumber = (item) => String(drafts.value.indexOf(item) + 1).padStart(2, '0')

const rowClass = (item) => ({
  'is-new': item._isNew && !item._deleted,
  'is-modified': !item._isNew && isChanged(item) && !item._deleted,
  'is-deleted': item._deleted
})

const rowState = (item) => {
  if (item._deleted) return '待删除'
  if (item._isNew) return '新增'
  if (isChanged(item)) return '已修改'
  return '未修改'
}

const addRow = () => drafts.value.push(emptyDraft())

const toggleDelete = (item) => {
  item._deleted = !item._deleted
}

const restoreItem = (item) => {
  if (item._isNew || !item._original) return
  item.tip = clone(item._original.tip || {sc: '', tc: ''})
  item.tag = [...new Set(item._original.tag || [])]
  item._deleted = false
}

const selectedDialects = (item) => dialectOptions.value.filter(option => (item.tag || []).includes(option.code))
const availableDialects = (item) => dialectOptions.value.filter(option => !(item.tag || []).includes(option.code))

const addDialect = (item, code) => {
  if (item._deleted || item.tag.includes(code)) return
  item.tag = [...item.tag, code]
}

const removeDialect = (item, code) => {
  if (item._deleted) return
  item.tag = item.tag.filter(value => value !== code)
}

const invalidRows = computed(() => drafts.value.filter(item => {
  if (item._deleted) return false
  return Array.from(item.tip?.sc || '').length !== Array.from(item.tip?.tc || '').length
}))

const submit = async () => {
  if (saving.value || changedCount.value === 0) return

  if (invalidRows.value.length) {
    error.value = `有 ${invalidRows.value.length} 行的简体和繁体字数不一致，请先修正。`
    return
  }

  saving.value = true
  error.value = ''
  try {
    const payload = drafts.value.map(item => ({
      id: item._isNew ? null : item.id,
      tip: item.tip,
      tag: [...new Set(item.tag || [])],
      deleted: item._deleted
    }))

    const savedItems = await request('/api/study/loading-text/manage/batch', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    })

    const persistedItems = Array.isArray(savedItems) ? savedItems : []
    const expectedCount = drafts.value.filter(item => !item._deleted).length
    if (persistedItems.length !== expectedCount) {
      throw new Error('提交成功，但服务端返回的数据不完整，请重新加载后检查。')
    }

    let persistedIndex = 0
    drafts.value = drafts.value.reduce((next, item) => {
      if (item._deleted) return next

      const persisted = persistedItems[persistedIndex++]
      item.id = persisted.id
      item.tip = clone(persisted.tip || item.tip)
      item.tag = [...new Set(persisted.tag || item.tag || [])]
      item._isNew = false
      item._deleted = false
      item._original = clone({tip: item.tip, tag: item.tag})
      next.push(item)
      return next
    }, [])

    showSuccess('统一提交成功')
  } catch (e) {
    error.value = requestErrorMessage(e, '统一提交失败')
    showError(`统一提交失败：${error.value}`)
  }
  finally {
    saving.value = false
  }
}

onMounted(loadItems)
</script>

<template>
  <main class="broaden-layout">
    <header class="the-page-header">
      <div class="page-heading">
        <h1>加载提示语</h1>
      </div>
      <div class="page-toolbar">
        <div class="page-stats" aria-label="列表状态">
          <span class="stat-chip"><strong>{{ visibleCountLabel }}</strong></span>
          <span v-if="changedCount" class="stat-chip stat-chip--changed"><strong>{{
              changedCount
            }}</strong> 项待提交</span>
        </div>
        <div class="page-actions">
          <button class="plain-button" :disabled="saving" @click="addRow">
            <span class="button-symbol" aria-hidden="true">＋</span>新增行
          </button>
          <button class="commit-button" :disabled="saving || changedCount === 0" @click="submit">
            <span class="button-symbol" aria-hidden="true">✓</span>
            {{ saving ? '提交中……' : '统一提交' }}
            <span v-if="changedCount" class="commit-count">{{ changedCount }}</span>
          </button>
        </div>
      </div>
    </header>

    <p v-if="error" class="error-text"><span aria-hidden="true">!</span>{{ error }}</p>
    <p v-if="!loading && drafts.length === 0" class="empty-text">还没有加载提示语，点击“新增行”开始。</p>

    <section v-if="loading || drafts.length > 0" class="table-panel">
      <div class="grid-wrap">
        <div class="draft-grid">
          <div class="grid-header" aria-hidden="true">
            <div class="grid-heading grid-heading--line">#</div>
            <div class="grid-heading grid-heading--status"><span class="status-column-icon" title="状态">●</span></div>
            <label class="search-field">
              <span class="search-icon" aria-hidden="true">⌕</span>
              <input
                  v-model="searchQuery"
                  type="search"
                  placeholder="搜索简体或繁体"
                  aria-label="搜索简体或繁体"
              />
              <button v-if="searchQuery" type="button" class="clear-search" aria-label="清除搜索"
                      @click="searchQuery = ''">×
              </button>
            </label>
            <label class="dialect-filter">
              <span>方言范围</span>
              <select v-model="dialectFilter" aria-label="按方言范围筛选">
                <option value="all">全部</option>
                <option value="common">适合所有方言</option>
                <option v-for="option in dialectOptions" :key="option.code" :value="`dialect:${option.code}`">
                  {{ option.name }}（含适合所有方言）
                </option>
                <option v-for="option in dialectOptions" :key="`only-${option.code}`" :value="`only:${option.code}`">
                  仅适用于{{ option.name }}
                </option>
              </select>
            </label>
            <div class="grid-heading grid-heading--action">操作</div>
          </div>

          <div v-if="loading" class="grid-empty grid-empty--loading" aria-live="polite">
            <span class="grid-empty-icon" aria-hidden="true">…</span>
            <span>正在加载……</span>
          </div>
          <div v-else-if="filteredDrafts.length === 0" class="grid-empty">
            <span class="grid-empty-icon" aria-hidden="true">⌕</span>
            <span>没有匹配的加载提示语</span>
          </div>


          <article
              v-else
              v-for="item in filteredDrafts"
              :key="rowKey(item)"
              class="draft-row"
              :class="rowClass(item)"
          >
            <div class="line-number">{{ originalRowNumber(item) }}</div>

            <div class="state-cell" :class="`state-cell--${rowStateClass(item)}`">
            <span
                class="state-icon"
                :title="rowStateTitle(item)"
                :aria-label="rowStateTitle(item)"
                role="img"
            >{{ rowStateIcon(item) }}</span>
            </div>

            <div class="tip-editor">
              <ScAndTcText
                  v-model:traditionalText="item.tip.tc"
                  v-model:simplifiedText="item.tip.sc"
                  layout="large"
                  :dialect="editorDialect"
                  :disabled="item._deleted || saving"
              />
            </div>

            <div class="dialect-cell">
              <div class="dialect-section dialect-section--selected">
                <div class="dialect-section-label">
                  <span class="dialect-section-mark dialect-section-mark--selected" aria-hidden="true">✓</span>
                  <span>已选择</span>
                </div>
                <div class="selected-dialects" :class="{empty: selectedDialects(item).length === 0}">
                  <span v-if="selectedDialects(item).length === 0" class="all-dialects-pill">适合所有方言</span>
                  <button
                      v-for="option in selectedDialects(item)"
                      :key="option.code"
                      type="button"
                      class="dialect-pill selected"
                      :disabled="item._deleted || saving"
                      :aria-label="`移除${option.name}`"
                      @click="removeDialect(item, option.code)"
                  >
                    <span>{{ option.name }}</span>
                    <span class="dialect-pill-remove" aria-hidden="true">−</span>
                  </button>
                </div>
              </div>
              <div v-if="!item._deleted && availableDialects(item).length"
                   class="dialect-section dialect-section--available">
                <div class="dialect-section-label">
                  <span class="dialect-section-mark dialect-section-mark--available" aria-hidden="true">＋</span>
                  <span>待选</span>
                </div>
                <div class="dialect-options">
                  <button
                      v-for="option in availableDialects(item)"
                      :key="option.code"
                      type="button"
                      class="dialect-pill option"
                      :disabled="saving"
                      @click="addDialect(item, option.code)"
                  >
                    {{ option.name }}
                  </button>
                </div>
              </div>
            </div>

            <div class="row-actions">
              <button
                  v-if="!item._deleted && !item._isNew && isChanged(item)"
                  type="button"
                  class="restore-action"
                  :disabled="saving"
                  @click="restoreItem(item)"
              >
                恢复
              </button>
              <button type="button" class="row-action" :disabled="saving" @click="toggleDelete(item)">
                {{ item._deleted ? '恢复' : '删除' }}
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>

  </main>
</template>

<style scoped>
.the-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 0 2px 17px;
  border-bottom: 1px solid #bec8cf;
}

.page-heading {
  min-width: 0;
}

.the-page-header h1 {
  margin: 0 0 6px;
  color: #313d44;
  font-size: 1.6rem;
  letter-spacing: -.025em;
}

.the-page-header p {
  margin: 0;
  color: #78848b;
  font-size: .8rem;
}

.page-toolbar, .page-actions, .page-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.page-toolbar {
  justify-content: flex-end;
  gap: 14px;
}

.page-actions {
  gap: 7px;
}

.page-stats {
  gap: 6px;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 27px;
  padding: 3px 8px;
  border: 1px solid #cbd3d8;
  border-radius: 3px;
  color: #69757c;
  background: #f2f4f5;
  font-size: .72rem;
  white-space: nowrap;
}

.stat-chip strong {
  color: #45525a;
  font-size: .8rem;
}

.stat-chip--changed {
  border-color: #b6c9da;
  color: #4d6f8c;
  background: #edf3f8;
}

.stat-chip--changed strong {
  color: #356894;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 31px;
  padding: 5px 10px;
  border: 1px solid #b9c4cb;
  border-radius: 3px;
  font: inherit;
  font-size: .77rem;
  cursor: pointer;
  transition: background .12s ease, border-color .12s ease, color .12s ease;
}

button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.button-symbol {
  font-size: 1rem;
  line-height: 1;
}

.plain-button {
  color: #4b5961;
  background: #f5f6f7;
}

.plain-button:hover:not(:disabled) {
  border-color: #8799a5;
  background: #e9eef1;
}

.commit-button {
  border-color: #4e78a2;
  color: white;
  background: #527da9;
}

.commit-button:hover:not(:disabled) {
  border-color: #3d668d;
  background: #416c98;
}

.commit-count {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 3px;
  color: #dbeaff;
  background: rgba(0, 0, 0, .16);
  font-size: .7rem;
  text-align: center;
}

.error-text {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
  padding: 9px 11px;
  border: 1px solid #e0b9b5;
  border-radius: 4px;
  color: #8c3f39;
  background: #fff3f1;
  font-size: .82rem;
}

.error-text span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  color: #fff;
  background: #bd6259;
  font-size: .7rem;
  font-weight: 700;
}

.empty-text {
  margin: 18px 0 0;
  padding: 50px 20px;
  border: 1px solid #cbd4da;
  border-radius: 3px;
  color: #78838a;
  background: #f4f6f7;
  text-align: center;
  font-size: .84rem;
}

.table-panel {
  margin-top: 18px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 39px;
  margin-bottom: 7px;
  padding: 5px 7px;
  border: 1px solid #c2ccd2;
  border-radius: 3px;
  background: #edf0f2;
}

.search-field {
  display: flex;
  align-items: center;
  width: min(330px, 100%);
  min-height: 28px;
  border: 1px solid #b9c5cc;
  border-radius: 3px;
  background: #fff;
}

.search-icon {
  width: 25px;
  color: #788790;
  font-size: 1.05rem;
  line-height: 1;
  text-align: center;
}

.search-field input {
  flex: 1;
  min-width: 0;
  height: 27px;
  padding: 3px 5px 3px 0;
  border: 0;
  outline: 0;
  color: #35443a;
  background: transparent;
  font: inherit;
  font-size: .76rem;
}

.search-field:focus-within {
  border-color: #6b99c4;
  box-shadow: 0 0 0 2px rgba(82, 125, 169, .12);
}

.search-field input::-webkit-search-cancel-button {
  display: none;
}

.clear-search {
  width: 25px;
  min-height: 27px;
  padding: 0;
  border: 0;
  color: #8b978f;
  background: transparent;
  font-size: 1rem;
}

.clear-search:hover:not(:disabled) {
  color: #52625a;
  background: #edf1ee;
}

.dialect-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #718078;
  font-size: .72rem;
  white-space: nowrap;
}

.dialect-filter select {
  min-height: 28px;
  padding: 3px 26px 3px 8px;
  border: 1px solid #b9c5cc;
  border-radius: 3px;
  color: #46545c;
  background: #fff;
  font: inherit;
  font-size: .74rem;
  outline: 0;
}

.dialect-filter select:focus {
  border-color: #6b99c4;
  box-shadow: 0 0 0 2px rgba(82, 125, 169, .12);
}

.filter-result {
  margin-left: auto;
  color: #859188;
  font-size: .7rem;
  white-space: nowrap;
}

.grid-wrap {
  margin-top: 18px;
  max-height: calc(100vh - 270px);
  overflow-x: auto;
  overflow-y: scroll;
  scrollbar-gutter: stable;
  border: 1px solid #d7def3;
  border-radius: 12px;
  background: #f5f7ff;
  box-shadow: 0 10px 28px rgba(70, 88, 145, .11), 0 2px 5px rgba(70, 88, 145, .06);
}

.table-toolbar + .grid-wrap {
  margin-top: 0;
}

.draft-grid {
  min-width: 1100px;
}

.grid-empty {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 150px;
  color: #87929a;
  background: #fbfcfd;
  font-size: .8rem;
}

.grid-empty-icon {
  color: #a3adb3;
  font-size: 1rem;
}

.grid-header, .draft-row {
  display: grid;
  grid-template-columns: 48px 48px minmax(500px, 1.65fr) minmax(250px, .85fr) 128px;
  gap: 0;
  align-items: stretch;
}

.grid-header {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 42px;
  color: #45527c;
  border-bottom: 1px solid #cfd8f0;
  background: linear-gradient(135deg, #f0f2ff 0%, #edf7ff 100%);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .9) inset, 0 3px 8px rgba(81, 99, 158, .06);
  font-size: .71rem;
  font-weight: 700;
  letter-spacing: .02em;
}

.grid-heading {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  border-right: 1px solid #dce2f2;
}

.grid-heading--line, .grid-heading--status, .grid-heading--action {
  justify-content: center;
  padding-right: 6px;
  padding-left: 6px;
}

.status-column-icon {
  color: #7a8fe4;
  font-size: .75rem;
}

.draft-row {
  position: relative;
  min-height: 86px;
  border-bottom: 1px solid #e4e8f2;
  background: #fff;
  transition: background .15s ease, box-shadow .15s ease;
}

.draft-row:last-child {
  border-bottom: 0;
}

.draft-row:hover {
  background: #f7f8ff;
  box-shadow: inset 0 1px 0 rgba(124, 143, 242, .08), inset 0 -1px 0 rgba(124, 143, 242, .08);
}

.draft-row.is-new {
  background: #f0fbf5;
  box-shadow: inset 4px 0 #4fbd82;
}

.draft-row.is-new:hover {
  background: #e8f8ee;
}

.draft-row.is-modified {
  background: #f0f4ff;
  box-shadow: inset 4px 0 #7187eb;
}

.draft-row.is-modified:hover {
  background: #e9efff;
}

.draft-row.is-deleted {
  color: #7c7580;
  background: #fff2f4;
  box-shadow: inset 4px 0 #d47b8d;
}

.draft-row.is-deleted .line-number, .draft-row.is-deleted .state-cell {
  text-decoration: line-through;
}

.line-number, .state-cell, .tip-editor, .dialect-cell, .row-actions {
  border-right: 1px solid #e2e6f0;
}

.line-number {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 15px 5px 0;
  color: #8290b3;
  background: rgba(239, 242, 252, .74);
  font-family: var(--font-family-mono);
  font-size: .72rem;
  user-select: none;
}

.state-cell {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 15px 5px 10px;
  color: #65718d;
  font-size: .75rem;
  white-space: nowrap;
}

.state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  font-size: .85rem;
  font-weight: 700;
  line-height: 1;
}

.state-cell--unchanged .state-icon {
  color: #71809f;
  background: #e9edfa;
}

.state-cell--new .state-icon {
  color: #248052;
  background: #d6f4e2;
}

.state-cell--modified .state-icon {
  color: #536bd1;
  background: #dce5ff;
}

.state-cell--deleted .state-icon {
  color: #b24d68;
  background: #ffe0e7;
}

.tip-editor {
  min-width: 0;
  overflow: hidden;
  padding: 10px 9px;
}

.tip-editor :deep(.sc-tc-group) {
  gap: 7px;
}

.tip-editor :deep(.sc-tc-fields) {
  gap: 7px;
}

.tip-editor :deep(.sc-tc-textarea) {
  min-height: 56px;
  padding: 6px 7px;
  border-color: #d3daf0;
  border-radius: 7px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 1px 2px rgba(76, 91, 146, .04);
  font-size: .78rem;
  line-height: 1.35;
}

.tip-editor :deep(.sc-tc-textarea:focus) {
  border-color: #7c8ff2;
  box-shadow: 0 0 0 3px rgba(124, 143, 242, .16);
  outline: none;
}

.tip-editor :deep(.sc-tc-actions) {
  gap: 4px;
}

.tip-editor :deep(.sc-tc-btn) {
  min-height: 28px;
  padding: 4px 7px;
  border-radius: 3px;
  font-size: .72rem;
}

.tip-editor :deep(.sc-tc-status) {
  min-width: 25px;
  min-height: 28px;
  padding: 0 2px;
  font-size: .76rem;
}

.is-deleted .tip-editor {
  opacity: .62;
}

.dialect-cell {
  min-width: 0;
  padding: 9px;
}

.dialect-section {
  padding: 6px 7px 7px;
  border: 1px solid #d9e2ee;
  border-radius: 8px;
}

.dialect-section--selected {
  border-color: #cce8dc;
  background: rgba(239, 252, 245, .88);
}

.dialect-section--available {
  margin-top: 8px;
  border-style: dashed;
  border-color: #cbd6f0;
  background: rgba(245, 248, 255, .94);
}

.dialect-section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  color: #567b69;
  font-size: .65rem;
  font-weight: 700;
  letter-spacing: .04em;
}

.dialect-section--available .dialect-section-label {
  color: #6677aa;
}

.dialect-section-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  font-size: .68rem;
  line-height: 1;
}

.dialect-section-mark--selected {
  color: #248052;
  background: #d5f3e1;
}

.dialect-section-mark--available {
  color: #536bd1;
  background: #dfe7ff;
}

.selected-dialects, .dialect-options {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.selected-dialects {
  min-height: 24px;
  align-items: flex-start;
}

.selected-dialects.empty {
  padding: 1px 0;
}

.all-dialects-pill, .dialect-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: .7rem;
}

.all-dialects-pill {
  color: #5f7b6a;
  border: 1px solid #d0e8d9;
  background: #f7fdf9;
}

.dialect-pill {
  gap: 5px;
  border: 1px solid #9cdbb7;
  color: #24704a;
  background: #dff7e8;
}

.dialect-pill.option {
  color: #5b6fb1;
  border-color: #bdc9ed;
  border-style: dashed;
  background: #fff;
}

.dialect-pill.option:hover {
  border-color: #7c8ff2;
  background: #edf0ff;
}

.dialect-pill-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 14px;
  color: #c34f68;
  font-size: .9rem;
  font-weight: 700;
  line-height: 1;
  visibility: hidden;
  opacity: 0;
  transition: opacity .12s ease;
}

.dialect-pill.selected:hover .dialect-pill-remove {
  visibility: visible;
  opacity: 1;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 6px;
}

.row-action, .restore-action {
  min-height: 27px;
  padding: 4px 7px;
  border-radius: 3px;
  font-size: .7rem;
  white-space: nowrap;
}

.row-action {
  color: #68749a;
  background: transparent;
}

.restore-action {
  border-color: #b7c4e6;
  color: #536bd1;
  background: #f5f7ff;
}

.row-action:hover:not(:disabled) {
  color: #c34f68;
  background: #fff0f3;
}

.restore-action:hover:not(:disabled) {
  border-color: #8295e1;
  color: #3f56bd;
  background: #eaf0ff;
}

.is-deleted .row-action {
  color: #536bd1;
}

.table-hint {
  margin-top: 11px;
  color: #6e786f;
  font-size: .8rem;
}

@media (max-width: 700px) {
  .loading-text-page {
    padding: 82px 12px 40px;
  }

  .the-page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }

  .page-toolbar, .page-actions {
    width: 100%;
    justify-content: space-between;
  }

  .page-actions button {
    flex: 1;
  }

  .table-toolbar {
    flex-wrap: wrap;
  }

  .search-field {
    width: 100%;
  }

  .filter-result {
    margin-left: auto;
  }
}
</style>
