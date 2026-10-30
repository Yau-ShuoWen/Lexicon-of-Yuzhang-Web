<!-- CiyuEditor.vue -->

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";
import ScTcEditorLab from "../../../components/Text/ScTcEditorLab.vue";
import DraggableList from "../../../components/Layout/DraggableList.vue";
import { showError, showSuccess } from "../../../services/ToastService.js";
import RichText from "../../../components/Text/RichText.vue";
import { useHead } from '@vueuse/head'
import CopyButton from "../../../components/Button/CopyButton.vue";
import { getToken } from "../../../utils/auth.js";
import { request } from '../../../services/request.js'

// 路由
const route = useRoute()
const {t} = useI18n()
const id = route.params.id

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 数据
const updateData = ref({
  id: null,
  ciyu: {sc: '', tc: ''},
  special: 0,
  mainPy: '',
  similar: [],
  note: [],
  mean: [],
  status: 1
})

useHead({
  title: () => {
    if (updateData.value) return `${updateData.value.ciyu.tc}：${t('ciyu_editor.title')}`;
    return t('ciyu_editor.title')
  }
})

const noteTags = [
  'usage', 'pronun', 'struct', 'source', 'history', 'proverb'
]

const isNew = ref(!id || id === 'new')
const isLoading = ref(false)
const isSaving = ref(false)
const pairEditors = new Map()
const setPairEditor = (key, editor) => {
  if (editor) pairEditors.set(key, editor)
  else pairEditors.delete(key)
}

// 加载词条详情
const loadCiyu = async (id) => {
  if (isNew.value) return
  isLoading.value = true
  try {
    const params = new URLSearchParams({id})
    updateData.value = await request(`/api/edit/ciyu/get-info/${dialect.value}?${params}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
  } catch (err) {
    console.error(err)
    showError(t('ciyu_editor.load_failed', {message: err.message}))
  }
  finally {
    isLoading.value = false
  }
}

// 保存
const saveData = async () => {
  isSaving.value = true

  try {
    for (const editor of pairEditors.values()) {
      if (editor.hasPendingChanges() && !await editor.synchronize()) return
    }
    const payload = {
      ...updateData.value,
      id: isNew.value ? null : updateData.value.id
    }

    await request(`/api/edit/ciyu/submit/${dialect.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': getToken() || ''
      },
      body: JSON.stringify(payload)
    })

    showSuccess(t('ciyu_editor.save_success'))

  } catch (err) {
    showError(err.message)
    console.error(err)
  }
  finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadCiyu(id)
})
</script>

<template>
  <div class="edit-page">

    <div class="nav-buttons">
      <button @click="saveData" :disabled="isSaving" class="dev-add-btn dev-btn-small">
        {{ isSaving ? t('ciyu_editor.saving') : isNew ? t('ciyu_editor.save_new') : t('ciyu_editor.save') }}
      </button>
    </div>


    <LoadingIcon v-if="isLoading" :show-text="true"/>

    <div v-else class="edit-form">


      <!-- 繁简字 & special -->
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <h4>
              {{ t('ciyu_editor.traditional') }}
              <router-link
                  :to="`/tc/${dialect}/dict/c/${updateData.ciyu.tc}`"
                  class="word-link" target="_blank"
              >
                {{ updateData.ciyu.tc }}
              </router-link>
            </h4>

            <h4>
              {{ t('ciyu_editor.simplified') }}
              <router-link
                  :to="`/sc/${dialect}/dict/c/${updateData.ciyu.sc}`"
                  class="word-link" target="_blank"
              >
                {{ updateData.ciyu.sc }}
              </router-link>
            </h4>
          </div>
          <div class="form-field">
            <label>{{ t('ciyu_editor.special') }}</label>
            <select v-model="updateData.special" class="short-input">
              <option value="0">{{ t('ciyu_editor.normal') }}</option>
              <option value="1">{{ t('ciyu_editor.special_word') }}</option>
              <option value="2">{{ t('ciyu_editor.fixed_usage') }}</option>
              <option value="4">{{ t('ciyu_editor.encyclopedia') }}</option>
            </select>
          </div>

          <div class="form-field">
            <label>{{ t('ciyu_editor.status') }}</label>
            <select v-model="updateData.status" class="short-input">

              <option value="0">{{ t('ciyu_editor.no_more_content') }}</option>
              <option value="1">{{ t('ciyu_editor.needs_content') }}</option>
              <option value="2">{{ t('ciyu_editor.uncertain') }}</option>
              <option value="3">{{ t('ciyu_editor.complete') }}</option>
            </select>

          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>{{ t('ciyu_editor.pinyin') }}</h3>
        <div class="array-item pinyin-input-row">
          <input class="form-control pinyin-input" type="text" v-model="updateData.mainPy" :aria-label="t('ciyu_editor.pinyin')">
          <span v-if="updateData.mainPy" class="pinyin-arrow" aria-hidden="true">→</span>
          <div v-if="updateData.mainPy" class="pinyin-preview">
            <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                      :model-value="updateData.mainPy.toString()" :plain="true"/>
          </div>
        </div>
      </div>

      <!-- 相似词语 -->
      <div class="form-section">
        <div class="section-header">
          <h3>{{ t('ciyu_editor.similar') }}</h3>
        </div>
        <DraggableList
            v-model="updateData.similar"
            :createItem="() => ({type:1, text: { sc: '', tc: '' }})"
        >
          <template #default="{ item, index }">
            <div class="array-item">

              <select v-model="item.type" class="middle-input">
                <option value="4">{{ t('ciyu_editor.dialect_synonym') }}</option>
                <option value="5">{{ t('ciyu_editor.dialect_related') }}</option>
                <option value="1">{{ t('ciyu_editor.mandarin_equivalent') }}</option>
                <option value="2">{{ t('ciyu_editor.search_word') }}</option>
                <option value="3">{{ t('ciyu_editor.common_misspelling') }}</option>
              </select>
              <ScTcEditorLab :ref="editor => setPairEditor(`similar:${index}`, editor)"
                             :pair="item.text" layout="small" :rich-text="false" :dialect="dialect.toString()"
                             @update:pair="item.text = $event"/>

            </div>
          </template>
        </DraggableList>
      </div>

      <div class="form-section">
        <h3>{{ t('ciyu_editor.notes') }}</h3>

        <CopyButton text="__既可以读作[]（__音），也可以读作[]（__音），原因是___。" :hint="t('ciyu_editor.copy_multiple_pronunciations')"
                    class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- 新派的南昌話除了少數漢字，大部分陽入（第七聲[at7]）都可以讀作陰入（第六聲[at6]）"
                    :hint="t('ciyu_editor.copy_entering_tone')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="「」單獨讀作[]，這裡讀作[]。
變調規則：兩個3聲{n 上聲}連讀的時候，前一個字變為第2聲{n 陽平}，這個特點和普通話類似。"
                    :hint="t('ciyu_editor.copy_tone_33')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="「」單獨讀作[]，這裡讀作[]。
變調規則：3聲{n 上聲}、5聲{n 陽去}連讀的時候，前一個字變為第2聲{n 陽平}"
                    :hint="t('ciyu_editor.copy_tone_35')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="「」單獨讀作[]，這裡讀作[]。
變調規則：3聲{n 上聲}、7聲{n 陽去}連讀的時候，前一個字變為第2聲{n 陽平}"
                    :hint="t('ciyu_editor.copy_tone_37')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="書既可以读作[_]（老派音），也可以读作[_]（新派音），原因是新派更接近普通話
相關的規則是：一部分漢字老派讀作[jyu qyu xyu]的時候，新派讀作[zu cu su]，比如：
|字|老派音|新派音|
|---|---|---|
|豬|[jyu1]|[zu1]|
|主|[jyu3]|[zu3]|
|處|[qyu3]|[cu3]|
|住|[qyu3]|[cu3]|
|書|[xyu1]|[su1]|
|樹|[xyu5]|[su5]|
{b 本字典作為當下的方言詞典，以現代讀法（新派音）為主。}" :hint="t('ciyu_editor.copy_old_new')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="
「___」是同音替代/自創__字，本字待考。
- 選擇的理由是：
- 不符合的部分：
其他相關研究：
|寫法|理由|
|---|---|
|||
|||
|||
" :hint="t('ciyu_editor.copy_special_hanzi')" class="dev-normal-button dev-btn-middle"/>


        <DraggableList
            v-model="updateData.note"
            :createItem="() => ({ left: 'usage', right: { sc: '', tc: '' }})"
        >
          <template #default="{ item, index }">
            <div class="array-item complex-item">

              <select v-model="item.left" class="short-input">
                <option v-if="!noteTags.includes(item.left)" :value="item.left">
                  {{ t('ciyu_editor.unresolved_tag', {tag: item.left || t('ciyu_editor.empty_tag')}) }}
                </option>
                <option
                    v-for="tag in noteTags"
                    :key="tag"
                    :value="tag"
                >
                  {{ t(`ciyu_editor.${tag}`) }}
                </option>
              </select>

              <ScTcEditorLab :ref="editor => setPairEditor(`note:${index}`, editor)"
                             :pair="item.right" layout="large" :dialect="dialect.toString()"
                             @update:pair="item.right = $event"/>
            </div>
          </template>
        </DraggableList>
      </div>


      <div class="form-section">
        <h3>{{ t('ciyu_editor.meanings') }}</h3>


        <CopyButton text="用法對應普通話的「」" :hint="t('ciyu_editor.copy_mandarin_synonym')" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="南昌話里自然的口語表達里不會出現「」這個詞語，而是用這個詞代替。" :hint="t('ciyu_editor.copy_unusual_expression')" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="|---|---*|
|例句||
|說法||
|讀音||
相關詞彙：
- {c }：[] （）
- {c }：[] （）
- {c }：[] （）" :hint="t('ciyu_editor.copy_example_table')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="這個詞條的重點在讀音上，內容不做詳細講解。" :hint="t('ciyu_editor.copy_pronunciation_focus')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="- {c }：[] （）" :hint="t('ciyu_editor.copy_related_words')" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="- {c 箇}：[go3] （這）" :hint="t('ciyu_editor.copy_ge')" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 嗰}：[go0] （的）" :hint="t('ciyu_editor.copy_go')" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 許}：[he3]/[e3] （那，兩個讀音都可以）" :hint="t('ciyu_editor.copy_he')" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 係}：[xi5] （是）" :hint="t('ciyu_editor.copy_xi')" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 噶}：[gak6] （這下）" :hint="t('ciyu_editor.copy_gak')" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 渠}：[jie2] （他、她、它）" :hint="t('ciyu_editor.copy_jie')" class="dev-normal-button dev-btn-middle"/>


        <DraggableList v-model="updateData.mean" :createItem="() => ({ sc: '', tc: '' })">
          <template #default="{ item, index }">

            <ScTcEditorLab :ref="editor => setPairEditor(`mean:${index}`, editor)"
                           :pair="item" layout="large" :dialect="dialect.toString()"
                           @update:pair="updateData.mean[index] = $event"/>

          </template>
        </DraggableList>
      </div>


    </div>
  </div>
</template>

<style scoped>
.edit-page { min-width: 0; width: 100%; padding: 12px 0 56px; }
.nav-buttons { display: flex; justify-content: flex-end; margin-bottom: 20px; }
.edit-form { display: flex; flex-direction: column; gap: 18px; }
.form-section { min-width: 0; margin: 0; padding: 20px; border: 1px solid var(--color-border); border-radius: 12px; background: rgba(255,255,255,.75); }
.form-section h3 { margin: 0 0 18px; color: var(--color-primary-dark); font-size: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); align-items: center; gap: 18px; }
.form-field { display: flex; flex-direction: column; gap: 7px; }
.form-field h4 { margin: 4px 0; color: var(--color-text); font-size: 18px; }
.form-field label { color: var(--color-text-light); font-size: 14px; }
.section-header h3 { margin-bottom: 18px; }
.short-input, .middle-input { min-height: 38px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; color: var(--color-text); }
.short-input { width: 100%; max-width: 190px; }
.middle-input { flex: 0 1 190px; min-width: 130px; }
.array-item { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 10px; }
.complex-item { flex-direction: column; align-items: stretch; }
.pinyin-input-row { display: grid; grid-template-columns: minmax(0,1fr) 18px minmax(120px,.6fr); }
.pinyin-input { box-sizing: border-box; width: 100%; min-width: 0; height: 36px; padding: 4px 9px; border: 1px solid #c8d2ca; border-radius: 6px; background: #fff; box-shadow: none; outline: none; }
.pinyin-input:focus, .pinyin-input:focus-visible { border-color: #6f8775; box-shadow: none; outline: none; }
.pinyin-arrow { color: var(--color-text-light); text-align: center; }
.pinyin-preview { box-sizing: border-box; display: flex; align-items: center; min-width: 0; height: 36px; padding: 2px 9px; border: 1px solid #c8d2ca; border-radius: 6px; background: #fff; color: var(--color-text); overflow: hidden; }
.pinyin-preview :deep(.result) { min-width: 0; line-height: 1.2; white-space: nowrap; }
.pinyin-preview :deep(.rt-pinyin) { line-height: 1.2; }
.word-link { color: var(--color-primary-dark); text-decoration: none; }
.word-link:hover { text-decoration: underline; }
@media (max-width: 600px) {
  .edit-page { padding: 12px 0 36px; }
  .form-section { padding: 14px; }
  .array-item:not(.pinyin-input-row) { align-items: stretch; flex-direction: column; }
  .pinyin-input-row { grid-template-columns: minmax(0,1fr) 18px minmax(90px,.6fr); }
}
</style>
