<!-- PinyinNoteEditor.vue -->

<script setup>
import {computed, onMounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {showError, showSuccess} from "../../../services/ToastService.js";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";
import {useHead} from "@vueuse/head";
import CopyButton from "../../../components/Button/CopyButton.vue";

useHead({
  title: () => `拼音註釋編輯`
})

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const keyList = ref([])
const selectedKey = ref(null)

const note = ref({
  sc: '',
  tc: ''
})

const loadingKeys = ref(false)
const loadingNote = ref(false)
const saving = ref(false)


// 加载全部 key
const loadKeys = async () => {
  loadingKeys.value = true

  try {
    const res = await fetch(
        `/api/edit/pinyin/filter/${dialect.value}`
    )

    if (!res.ok) throw new Error('加載失敗')

    keyList.value = await res.json()

    if (keyList.value.length > 0) {
      await selectKey(keyList.value[0])
    }
  }
  catch (err) {
    showError(err.message)
  }
  finally {
    loadingKeys.value = false
  }
}


// 选择 key
const selectKey = async (key) => {
  selectedKey.value = key

  loadingNote.value = true

  try {
    const res = await fetch(
        `/api/edit/pinyin/get-note/${dialect.value}?key=${encodeURIComponent(key)}`
    )

    if (!res.ok) throw new Error('讀取失敗')

    note.value = await res.json()
  }
  catch (err) {
    showError(err.message)
  }
  finally {
    loadingNote.value = false
  }
}


// 保存
const saveNote = async () => {
  if (!selectedKey.value) return

  saving.value = true

  try {
    const res = await fetch(
        `/api/edit/pinyin/update-note/${dialect.value}?key=${encodeURIComponent(selectedKey.value)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(note.value)
        }
    )

    if (!res.ok) throw new Error('保存失敗')

    showSuccess('保存成功')
  }
  catch (err) {
    showError(err.message)
  }
  finally {
    saving.value = false
  }
}

onMounted(loadKeys)
</script>

<template>
  <div class="broaden-layout pinyin-editor">

    <!-- 左侧 key 列表 -->
    <div class="key-panel">

      <h3>拼音列表</h3>

      <LoadingIcon
          v-if="loadingKeys"
          :show-text="true"
      />

      <div
          v-for="key in keyList"
          :key="key"
          class="key-item"
          :class="{ active: selectedKey === key }"
          @click="selectKey(key)"
      >
        {{ key }}
      </div>

    </div>

    <!-- 右侧编辑区 -->
    <div class="editor-panel">

      <div class="section-header">

        <h3>
          {{ selectedKey || '未選擇拼音' }}
        </h3>

        <CopyButton text="__既可以读作[]（__音），也可以读作[]（__音），原因是___。" hint="多個讀音的說明模板"
                    class="dev-normal-button dev-btn-small"/>

        <button
            class="dev-add-btn dev-btn-small"
            :disabled="saving || !selectedKey"
            @click="saveNote"
        >
          {{ saving ? '保存中...' : '保存修改' }}
        </button>

      </div>

      <LoadingIcon
          v-if="loadingNote"
          :show-text="true"
      />

      <div
          v-else-if="selectedKey"
          class="form-section"
      >

        <ScAndTcText
            v-model:simplifiedText="note.sc"
            v-model:traditionalText="note.tc"
            :layout="'large'"
            :dialect="dialect.toString()"
            :rows=10
        />

      </div>

    </div>

  </div>
</template>

<style scoped>

.pinyin-editor {
  display: flex;
  gap: 20px;
}

.key-panel {
  width: 200px;
  flex-shrink: 0;

  border: 1px solid var(--color-text-lighter);
  border-radius: 6px;

  padding: 10px;

  max-height: 80vh;
  overflow-y: auto;
}

.key-item {
  padding: 8px 12px;
  margin-bottom: 4px;

  border-radius: 4px;

  cursor: pointer;

  transition: 0.2s;
}

.key-item:hover {
  background: #d3dfd5;
}

.key-item.active {
  background: #bcd2bf;
  font-weight: bold;
}

.editor-panel {
  flex: 1;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: 20px;
}

</style>