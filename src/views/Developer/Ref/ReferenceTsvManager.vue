<script setup>
import { computed, onMounted, ref } from 'vue'
import { request } from '../../../services/request.js'
import { showError, showSuccess } from '../../../services/ToastService.js'
import { confirm } from '../../../services/confirmService.js'

const base = '/api/admin/reference-tsv/versions'
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
const table = ref({ columns: [], rows: [], total: 0, page: 1, size: 50 })
const column = ref('all')
const searchText = ref('')
const query = ref('')
const page = ref(1)
const selectedVersion = computed(() => versions.value.find(item => item.id === selectedId.value))

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
    if (selectedId.value) await loadRows()
    else table.value = { columns: [], rows: [], total: 0, page: 1, size: 50 }
  } catch (error) {
    showError(`读取版本失败：${error.message}`)
  }
}

async function loadRows() {
  if (!selectedId.value) return
  loading.value = true
  try {
    const params = new URLSearchParams({column: column.value, query: query.value,
      page: String(page.value), size: '50'})
    table.value = await request(`${base}/${selectedId.value}/rows?${params}`)
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
  loadRows()
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

    <section v-if="selectedVersion" class="panel">
      <h2>{{ titleOf(selectedVersion) }}</h2>
        <div class="controls search-controls">
          <select v-model="column" aria-label="查询列">
            <option value="all">全部列</option>
            <option v-for="name in table.columns" :key="name" :value="name">{{ name }}</option>
          </select>
          <input v-model="searchText" type="search" placeholder="输入要查找的文字" @keyup.enter="search" />
          <button class="primary" :disabled="loading" @click="search">查询</button>
        </div>
        <div class="table-scroll" v-loading="loading">
          <table>
            <thead><tr><th>原文件行号</th><th v-for="name in table.columns" :key="name">{{ name }}</th></tr></thead>
            <tbody>
              <tr v-for="row in table.rows" :key="row.line">
                <td>{{ row.line }}</td><td v-for="(value, index) in row.values" :key="index">{{ value }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!loading && !table.rows.length">没有符合条件的数据。</p>
        </div>
        <div class="controls pagination">
          <span>共 {{ table.total }} 行 · 第 {{ page }} / {{ Math.max(1, Math.ceil(table.total / 50)) }} 页</span>
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
.table-scroll { overflow: auto; min-height: 80px; }
table { border-collapse: collapse; width: 100%; white-space: nowrap; }
th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; }
th { background: var(--el-fill-color-light, #f5f5f5); position: sticky; top: 0; }
.pagination { justify-content: flex-end; }
@media (max-width: 700px) { .version-item { align-items: flex-start; flex-direction: column; } }
</style>
