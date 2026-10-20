<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { request } from '../../../services/request.js'
import { showError, showSuccess } from '../../../services/ToastService.js'
import { confirm } from '../../../services/confirmService.js'
import ReferenceTsvCompare from './ReferenceTsvCompare.vue'

const base = '/api/admin/reference-tsv/versions'
const route = useRoute()
const versions = ref([])
const selectedId = ref('')
const file = ref(null)
const fileInput = ref(null)
const uploadName = ref('')
const dragging = ref(false)
const busyId = ref('')
const editingId = ref('')
const editingName = ref('')
const uploading = ref(false)
const loading = ref(false)
const auditing = ref(false)
const audit = ref(null)
const auditVersionId = ref('')
const table = ref({ columns: [], rows: [], total: 0, page: 1, size: 50 })
const classification = ref(null)
const classifiedVersionId = ref('')
const column = ref('all')
const classFilter = ref('all')
const auditFilter = ref('all')
const showOriginalTable = ref(false)
const searchText = ref('')
const query = ref('')
const page = ref(1)
const selectedVersion = computed(() => versions.value.find(item => item.id === selectedId.value))
const hiddenColumns = new Set(['词汇属性', '对应官话词', '官话拼音', '词频', '同义词'])
const visibleColumns = computed(() => table.value.columns
  .map((name, index) => ({name, index}))
  .filter(item => !hiddenColumns.has(item.name)))
const groupedRows = computed(() => {
  const groups = new Map()
  for (const row of classification.value?.rows || []) {
    const character = row.values[0]
    if (!groups.has(character)) groups.set(character, {
      character, lines: [], rows: [], general: row.general, reasons: row.reasons,
      mandarinReadings: row.mandarinReadings || [],
      formRelations: row.formRelations || [], values: []
    })
    const group = groups.get(character)
    group.lines.push(row.line)
    group.rows.push(row)
  }
  for (const group of groups.values())
    group.values = classification.value.columns.map((_, index) =>
      [...new Set(group.rows.map(row => row.values[index]).filter(Boolean))])
  return [...groups.values()]
})
const auditLookup = computed(() => {
  const missingLines = new Set()
  const readingsByLine = new Map()
  const formsByCharacter = new Map()
  const surplusByCharacter = new Map()
  if (!audit.value || auditVersionId.value !== selectedId.value)
    return {missingLines, readingsByLine, formsByCharacter, surplusByCharacter}

  audit.value.missingData.forEach(item => missingLines.add(item.line))
  audit.value.readingMismatches.forEach(item => {
    const items = readingsByLine.get(item.line) || []
    items.push(item)
    readingsByLine.set(item.line, items)
  })
  audit.value.formMismatches.forEach(item => {
    const characters = new Set([item.simplified, ...item.expectedTraditional, ...item.actualTraditional])
    characters.forEach(character => {
      const items = formsByCharacter.get(character) || []
      items.push(item)
      formsByCharacter.set(character, items)
    })
  })
  audit.value.backendSurplus?.forEach(item => {
    const items = surplusByCharacter.get(item.character) || []
    items.push(item)
    surplusByCharacter.set(item.character, items)
  })
  return {missingLines, readingsByLine, formsByCharacter, surplusByCharacter}
})

function auditForRow(row) {
  if (!audit.value || auditVersionId.value !== selectedId.value) return {missing: false, readings: [], forms: []}
  const character = row.values[0]
  return {
    missing: auditLookup.value.missingLines.has(row.line),
    readings: auditLookup.value.readingsByLine.get(row.line) || [],
    forms: auditLookup.value.formsByCharacter.get(character) || []
  }
}

function matchesAuditFilter(group) {
  if (auditFilter.value === 'all') return true
  if (!audit.value || auditVersionId.value !== selectedId.value) return false
  const statuses = group.rows.map(auditForRow)
  if (auditFilter.value === 'available') return statuses.some(status => !status.missing)
  if (auditFilter.value === 'missing') return statuses.every(status => status.missing)
  if (auditFilter.value === 'reading') return statuses.some(status => status.readings.length)
    || surplus(group).length > 0
  if (auditFilter.value === 'surplus') return surplus(group).length > 0
  if (auditFilter.value === 'form') return statuses.some(status => status.forms.length)
  if (auditFilter.value === 'normal') return !surplus(group).length
    && statuses.every(status => !status.missing && !status.readings.length && !status.forms.length)
  return true
}

function uniqueIssues(group, key) {
  return [...new Map(group.rows.flatMap(row => auditForRow(row)[key])
    .map(item => [key === 'forms' ? item.simplified : item.line, item])).values()]
}

function missing(group) {
  return group.rows.every(row => auditForRow(row).missing)
}

function surplus(group) {
  return auditLookup.value.surplusByCharacter.get(group.character) || []
}

function editLink(id) {
  return {name: 'HanziEditor', params: {language: route.params.language, dialect: route.params.dialect, id}}
}

function missingReading(group, value, field) {
  return uniqueIssues(group, 'readings').some(item =>
    item[field] === value && (item.reason.includes(field === 'dialectPinyin' ? '方言拼音' : '汉语拼音')
      || item.reason.includes('格式无法识别')))
}

function matchesClassFilter(group) {
  const value = classFilter.value
  if (value === 'all') return true
  if (value === 'general') return group.general
  if (value === 'special') return !group.general
  if (value === 'dialect-multiple') return group.values[2].length > 1
  if (value === 'mandarin-multiple') return group.mandarinReadings.length > 1
  if (value === 'forms') return group.reasons.includes('简繁非一一对应')
  if (value === 'synonym') return group.reasons.includes('存在同义词')
  if (value === 'marker') return group.reasons.includes('存在新旧标记')
  if (value === 'mandarin-missing') return group.reasons.includes('普通话读音未收录')
  if (value === 'not-character') return group.reasons.includes('不是单字')
  return true
}

function updateTable() {
  const data = classification.value
  if (!data) return
  const index = data.columns.indexOf(column.value)
  const filtered = groupedRows.value.filter(group => {
    if (!matchesClassFilter(group)) return false
    if (!matchesAuditFilter(group)) return false
    if (!query.value) return true
    return (index < 0 ? group.values.flat() : group.values[index])
      .some(value => String(value).includes(query.value))
  })
  table.value = { columns: data.columns, rows: filtered.slice((page.value - 1) * 50, page.value * 50),
    total: filtered.length, page: page.value, size: 50 }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : ''
}

function titleOf(item) {
  return item.name || item.originalName.replace(/\.tsv$/i, '')
}

function chooseFile(candidate) {
  if (!candidate) return
  if (!candidate.name.toLowerCase().endsWith('.tsv') || candidate.size > 20 * 1024 * 1024) {
    showError('请选择不超过 20 MB 的 TSV 文件')
    return
  }
  file.value = candidate
  if (!uploadName.value.trim()) uploadName.value = candidate.name.replace(/\.tsv$/i, '')
}

function onFileChange(event) {
  chooseFile(event.target.files?.[0])
  event.target.value = ''
}

function onDrop(event) {
  dragging.value = false
  chooseFile(event.dataTransfer?.files?.[0])
}

async function loadVersions(preferredId = '') {
  try {
    versions.value = await request(base) || []
    selectedId.value = [preferredId, selectedId.value, versions.value[0]?.id]
      .find(id => versions.value.some(item => item.id === id)) || ''
    if (auditVersionId.value !== selectedId.value) {
      audit.value = null
      auditVersionId.value = ''
    }
    if (selectedId.value) await loadRows()
    else {
      classification.value = null
      classifiedVersionId.value = ''
      table.value = { columns: [], rows: [], total: 0, page: 1, size: 50 }
    }
  } catch (error) {
    showError(`读取版本失败：${error.message}`)
  }
}

async function loadRows() {
  if (!selectedId.value) return
  if (classifiedVersionId.value === selectedId.value && classification.value) {
    updateTable()
    if (auditVersionId.value !== selectedId.value) await runAudit()
    return
  }
  const versionId = selectedId.value
  loading.value = true
  try {
    const result = await request(`${base}/${versionId}/classify`)
    if (selectedId.value !== versionId) return
    classification.value = result
    classifiedVersionId.value = versionId
    updateTable()
    await runAudit()
  } catch (error) {
    showError(`读取表格失败：${error.message}`)
  } finally {
    loading.value = false
  }
}

function search() {
  query.value = searchText.value.trim()
  page.value = 1
  loadRows()
}

function changeVersion() {
  page.value = 1
  audit.value = null
  auditVersionId.value = ''
  table.value = { columns: [], rows: [], total: 0, page: 1, size: 50 }
  loadRows()
}

async function runAudit() {
  if (!selectedId.value) return
  const versionId = selectedId.value
  auditing.value = true
  try {
    const result = await request(`${base}/${versionId}/audit`)
    if (selectedId.value !== versionId) return
    audit.value = result
    auditVersionId.value = versionId
    updateTable()
  } catch (error) {
    showError(`检测失败：${error.message}`)
  } finally {
    auditing.value = false
  }
}

async function upload() {
  if (!file.value) return
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', file.value)
    form.append('name', uploadName.value.trim())
    const version = await request(base, {method: 'POST', body: form})
    file.value = null
    uploadName.value = ''
    if (fileInput.value) fileInput.value.value = ''
    showSuccess('版本上传成功')
    await loadVersions(version.id)
  } catch (error) {
    showError(`上传失败：${error.message}`)
  } finally {
    uploading.value = false
  }
}

function startRename(item) {
  editingId.value = item.id
  editingName.value = titleOf(item)
}

async function rename(item) {
  if (!editingName.value.trim()) return showError('请输入版本名称')
  busyId.value = item.id
  try {
    await request(`${base}/${item.id}/name`, {method: 'PATCH',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: editingName.value.trim()})})
    editingId.value = ''
    showSuccess('名称已保存')
    await loadVersions()
  } catch (error) {
    showError(`改名失败：${error.message}`)
  } finally {
    busyId.value = ''
  }
}

async function toggleLock(item) {
  busyId.value = item.id
  try {
    await request(`${base}/${item.id}/lock`, {method: 'PATCH',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({locked: !item.locked})})
    showSuccess(item.locked ? '已解锁' : '已锁定')
    await loadVersions()
  } catch (error) {
    showError(`操作失败：${error.message}`)
  } finally {
    busyId.value = ''
  }
}

async function remove(item) {
  if (item.locked) return
  const accepted = await confirm({title: '删除版本', message: `确定删除“${titleOf(item)}”及其原始文件吗？`,
    actions: [{key: true, text: '删除版本', class: 'dev-btn-small dev-delete-button'},
      {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}]})
  if (!accepted) return
  busyId.value = item.id
  try {
    await request(`${base}/${item.id}`, {method: 'DELETE'})
    showSuccess('版本已删除')
    await loadVersions()
  } catch (error) {
    showError(`删除失败：${error.message}`)
  } finally {
    busyId.value = ''
  }
}

onMounted(loadVersions)
</script>

<template>
  <main class="tsv-manager">
    <h1>字表原始资料</h1>
    <p>上传 TSV 原件并查看各版本。这里的资料不会修改本地词典数据。</p>

    <section class="panel">
      <h2>上传新版本</h2>
      <input ref="fileInput" class="file-input" type="file" accept=".tsv,text/tab-separated-values"
             aria-label="选择 TSV 文件" @change="onFileChange" />
      <div class="drop-zone" :class="{'drop-zone--active': dragging}" role="button" tabindex="0"
           @click="fileInput?.click()" @keydown.enter.prevent="fileInput?.click()"
           @keydown.space.prevent="fileInput?.click()" @dragover.prevent="dragging = true"
           @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
        <span class="drop-icon" aria-hidden="true">＋</span>
        <strong>{{ file ? file.name : '点击选择 TSV 文件，或拖到这里' }}</strong>
        <span>UTF-8 编码、10 列，最大 20 MB</span>
      </div>
      <div class="controls upload-actions">
        <label for="upload-name">版本名称</label>
        <input id="upload-name" v-model="uploadName" maxlength="80" placeholder="例如：2026 年秋季修订" />
        <button class="primary" :disabled="!file || !uploadName.trim() || uploading" @click="upload">
          {{ uploading ? '上传中…' : '上传版本' }}
        </button>
      </div>
    </section>

    <section class="panel">
      <h2>版本列表</h2>
      <p v-if="!versions.length">还没有上传版本。</p>
      <template v-else>
        <div v-for="item in versions" :key="item.id" class="version-item" :class="{'version-item--selected': item.id === selectedId}">
          <div class="version-info">
            <div v-if="editingId === item.id" class="controls rename-controls">
              <input v-model="editingName" maxlength="80" aria-label="版本名称" @keyup.enter="rename(item)" />
              <button class="primary" :disabled="busyId === item.id" @click="rename(item)">保存</button>
              <button @click="editingId = ''">取消</button>
            </div>
            <strong v-else>{{ titleOf(item) }} <span v-if="item.locked" class="lock-tag">已锁定</span></strong>
            <span class="hint">{{ formatDate(item.uploadedAt) }} · {{ item.originalName }} · {{ item.rowCount }} 行</span>
          </div>
          <div class="controls version-actions">
            <button :class="{'primary': item.id === selectedId}" @click="selectedId = item.id; changeVersion()">查看</button>
            <button :disabled="busyId === item.id" @click="startRename(item)">改名</button>
            <button :disabled="busyId === item.id" @click="toggleLock(item)">{{ item.locked ? '解锁' : '锁定' }}</button>
            <button class="danger" :disabled="item.locked || busyId === item.id" @click="remove(item)">删除</button>
          </div>
        </div>
      </template>
    </section>

    <ReferenceTsvCompare v-if="versions.length >= 2" :versions="versions" />

    <section v-if="selectedVersion" class="panel">
      <h2>{{ titleOf(selectedVersion) }}</h2>
        <p v-if="classification && classifiedVersionId === selectedId" class="hint">共 {{ groupedRows.length }} 个汉字</p>
        <div class="controls search-controls">
          <select v-model="column" aria-label="查询列">
            <option value="all">全部列</option>
            <option v-for="name in table.columns" :key="name" :value="name">{{ name }}</option>
          </select>
          <select v-model="classFilter" aria-label="汉字分类" @change="page = 1; loadRows()">
            <option value="all">全部汉字</option>
            <option value="general">一般汉字</option>
            <option value="special">非一般汉字</option>
            <option value="dialect-multiple">方言拼音有多个读音</option>
            <option value="mandarin-multiple">普通话有多个读音</option>
            <option value="forms">简繁非一一对应</option>
            <option value="synonym">存在同义词</option>
            <option value="marker">存在新旧标记</option>
            <option value="mandarin-missing">普通话读音未收录</option>
            <option value="not-character">不是单字</option>
          </select>
          <select v-model="auditFilter" aria-label="后端数据" :disabled="auditing"
                  @change="page = 1; loadRows()">
            <option value="all">全部后端状态</option>
            <option value="available">后端有数据</option>
            <option value="normal">后端无异常</option>
            <option value="missing">后端缺该字</option>
            <option value="reading">读音问题</option>
            <option value="surplus">后端多读音</option>
            <option value="form">简繁问题</option>
          </select>
          <input v-model="searchText" type="search" placeholder="输入要查找的文字" @keyup.enter="search" />
          <button class="primary" :disabled="loading" @click="search">查询</button>
          <button @click="showOriginalTable = !showOriginalTable">
            {{ showOriginalTable ? '返回按字查看' : '查看原表格' }}
          </button>
        </div>
        <p v-if="auditing" class="hint">正在核对后端字表…</p>
        <p v-else-if="audit && auditVersionId === selectedId" class="hint">
          已匹配后端字表 {{ audit.matchedBackendRows }} 条；后端缺 {{ new Set(audit.missingData.map(item => item.character)).size }} 字、后端缺读音 {{ audit.readingMismatches.length }} 条、后端多读音 {{ audit.backendSurplus?.length || 0 }} 条、简繁问题 {{ audit.formMismatches.length }} 条。
        </p>
        <div class="table-scroll" v-loading="loading">
          <table v-if="showOriginalTable">
            <thead><tr><th>原文件行号</th><th v-for="name in table.columns" :key="name">{{ name }}</th><th>编辑后端字表</th></tr></thead>
            <tbody>
              <template v-for="group in table.rows" :key="group.character">
                <tr v-for="row in group.rows" :key="row.line">
                  <td>{{ row.line }}</td>
                  <td v-for="(value, index) in row.values" :key="index">{{ value }}</td>
                  <td class="edit-cell"><router-link v-for="entry in audit?.backendEntries?.[group.character] || []" :key="entry.id"
                                                    :to="editLink(entry.id)" target="_blank">编辑 {{ entry.simplified }}／{{ entry.traditional }}</router-link>
                    <router-link v-if="missing(group)" :to="{name: 'HanziCreator', params: {language: route.params.language, dialect: route.params.dialect}}" target="_blank">新增该字</router-link>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <table v-else>
            <thead><tr><th>原文件行号</th><th v-for="item in visibleColumns" :key="item.name">{{ item.name }}</th><th>说明</th><th>编辑后端字表</th></tr></thead>
            <tbody>
              <tr v-for="group in table.rows" :key="group.character">
                <td><div class="cell-list"><span v-for="line in group.lines" :key="line" class="cell-entry">{{ line }}</span></div></td>
                <td v-for="item in visibleColumns" :key="item.index">
                  <div v-if="item.name === '方言拼音'" class="cell-list">
                    <div v-for="row in group.rows" :key="row.line" class="cell-entry">
                      <span class="reading-tag" :class="{'reading-tag--issue': missingReading(group, row.values[item.index], 'dialectPinyin'), 'reading-tag--multiple': group.values[item.index].length > 1}">{{ row.values[item.index] }}<small v-if="missingReading(group, row.values[item.index], 'dialectPinyin')">后端缺</small></span>
                    </div>
                  </div>
                  <div v-else-if="item.name === '汉语拼音'" class="cell-list">
                    <div v-for="row in group.rows" :key="row.line" class="cell-entry">
                      <span class="reading-tag" :class="{'reading-tag--issue': missingReading(group, row.values[item.index], 'mandarinPinyin'), 'reading-tag--unmatched': !group.mandarinReadings.includes(row.values[item.index]), 'reading-tag--multiple': group.values[item.index].length > 1}">{{ row.values[item.index] }}<small v-if="!group.mandarinReadings.includes(row.values[item.index])">字典未对应</small><small v-if="missingReading(group, row.values[item.index], 'mandarinPinyin')">后端缺</small></span>
                    </div>
                  </div>
                  <div v-else class="cell-list"><span v-for="row in group.rows" :key="row.line" class="cell-entry">{{ row.values[item.index] }}</span></div>
                </td>
                <td class="annotation-cell">
                  <span v-if="missing(group)" class="missing-tag">后端缺该字</span>
                  <span v-if="group.reasons.includes('简繁非一一对应')" class="audit-tag">简繁非一一对应</span>
                  <span v-for="relation in group.formRelations" :key="relation" class="reason">{{ relation }}</span>
                  <span v-for="reason in group.reasons.filter(value => value !== '多音字' && value !== '简繁非一一对应')" :key="reason" class="reason">{{ reason }}</span>
                  <template v-for="item in uniqueIssues(group, 'readings')" :key="`reading-${item.line}`">
                    <span class="reason">{{ item.reason }}；后端已有：{{ item.backendReadings.join('、') || '无读音' }}</span>
                  </template>
                  <span v-for="item in surplus(group)" :key="`${item.type}-${item.pinyin}`" class="reason">后端多{{ item.type }} {{ item.pinyin }}</span>
                  <template v-for="item in uniqueIssues(group, 'forms')" :key="`form-${item.simplified}`">
                    <span class="audit-tag">简繁不完整</span>
                    <span v-if="item.missingTraditional.length" class="reason">后端缺繁体 {{ item.missingTraditional.join('、') }}</span>
                    <span v-if="item.unexpectedTraditional.length" class="reason">后端多繁体 {{ item.unexpectedTraditional.join('、') }}</span>
                  </template>
                </td>
                <td class="edit-cell">
                  <router-link v-for="entry in audit?.backendEntries?.[group.character] || []" :key="entry.id"
                               :to="editLink(entry.id)" target="_blank">编辑 {{ entry.simplified }}／{{ entry.traditional }}</router-link>
                  <router-link v-if="missing(group)" :to="{name: 'HanziCreator', params: {language: route.params.language, dialect: route.params.dialect}}" target="_blank">新增该字</router-link>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!loading && !table.rows.length">没有符合条件的汉字。</p>
        </div>
        <div class="controls pagination">
          <span>共 {{ table.total }} 字 · 第 {{ page }} / {{ Math.max(1, Math.ceil(table.total / 50)) }} 页</span>
          <button :disabled="loading || page <= 1" @click="page--; loadRows()">上一页</button>
          <button :disabled="loading || page * 50 >= table.total" @click="page++; loadRows()">下一页</button>
        </div>
    </section>
  </main>
</template>

<style scoped>
.tsv-manager { max-width: 1400px; margin: 0 auto; padding: 28px 20px 60px; }
.tsv-manager h1 { margin-bottom: 8px; }
.panel { margin-top: 20px; padding: 20px; border: 1px solid #dce6dd; border-radius: 12px; background: var(--el-bg-color, white); }
.panel h2 { margin: 0 0 16px; }
.controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
.controls input, .controls select { padding: 8px; min-height: 36px; max-width: 100%; border: 1px solid #ccd9ce; border-radius: 7px; }
.controls button { padding: 8px 16px; border: 1px solid #9bb8a1; border-radius: 7px; background: #fff; color: #2d6840; cursor: pointer; }
.controls button.primary { background: #397a48; border-color: #397a48; color: white; }
.controls button.danger { color: #b23c3c; border-color: #d9abab; }
.controls button:disabled { cursor: default; opacity: .5; }
.file-input { display: none; }
.drop-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; min-height: 160px; padding: 20px; border: 2px dashed #a9c6b0; border-radius: 12px; background: #f8fbf8; text-align: center; cursor: pointer; }
.drop-zone:hover, .drop-zone--active { border-color: #397a48; background: #eaf5ec; }
.drop-zone:focus-visible { outline: 3px solid #82b98d; outline-offset: 3px; }
.drop-zone strong { color: #284c32; overflow-wrap: anywhere; }
.drop-zone span:last-child { color: #66736b; font-size: .88rem; }
.drop-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #dceee0; color: #397a48; font-size: 2rem; line-height: 1; }
.upload-actions input { min-width: 260px; flex: 1; }
.version-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 10px; border-bottom: 1px solid #edf1ed; }
.version-item--selected { background: #f7fbf7; }
.version-info { min-width: 0; }
.version-info strong, .version-info .hint { display: block; overflow-wrap: anywhere; }
.version-info .hint { margin: 5px 0 0; }
.version-actions { flex-shrink: 0; }
.lock-tag { padding: 2px 7px; border-radius: 10px; background: #e5eee7; color: #397a48; font-size: .75rem; }
.rename-controls { margin: 0; }
.search-controls input { min-width: 240px; }
.hint { color: var(--el-text-color-secondary, #666); }
.audit-tag { display: inline-block; padding: 2px 6px; border-radius: 5px; background: #fbe3dd; color: #9a3f2d; font-size: .8rem; white-space: nowrap; }
.missing-tag { display: inline-block; padding: 2px 6px; border-radius: 5px; background: #eceff2; color: #4f5964; font-size: .8rem; white-space: nowrap; }
.annotation-cell { min-width: 190px; white-space: normal; }
.annotation-cell > span { display: table; margin: 2px 0 6px; }
.reason { display: inline-block; white-space: normal; }
.cell-list { display: flex; flex-direction: column; align-items: flex-start; }
.cell-entry { display: flex; align-items: center; min-height: 34px; }
.reading-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 5px; background: #f0f2f0; }
.reading-tag--multiple { background: #e7efff; color: #244b83; }
.reading-tag--unmatched { background: #fff0cf; color: #865600; }
.reading-tag--issue { background: #fbe3dd; color: #9a3f2d; }
.reading-tag small { font-size: .75rem; }
.edit-cell a { display: block; width: fit-content; margin-bottom: 6px; color: #2765a8; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
.edit-cell a:hover { color: #174777; }
.edit-cell a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.table-scroll { overflow: auto; min-height: 80px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; vertical-align: top; }
th { background: var(--el-fill-color-light, #f5f5f5); position: sticky; top: 0; }
.pagination { justify-content: flex-end; }
@media (max-width: 700px) {
  .version-item { align-items: flex-start; flex-direction: column; }
}
</style>
