<!-- CiyuEditor.vue -->

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import DraggableList from "../../../components/Layout/DraggableList.vue";
import { showError, showSuccess } from "../../../services/ToastService.js";
import RichText from "../../../components/Text/RichText.vue";
import { useHead } from '@vueuse/head'
import CopyButton from "../../../components/Button/CopyButton.vue";

// 路由
const route = useRoute()
const router = useRouter()
const id = route.params.id

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 数据
const updateData = ref({
  id: null,
  ciyu: {sc: '', tc: ''},
  special: 0,
  mainPy: [],
  similar: [],
  note: [],
  mean: [],
  status: 1
})

useHead({
  title: () => {
    if (updateData.value) return `${updateData.value.ciyu.tc}：編輯詞語`;
    else if (loading.value) return `編輯詞語`
  }
})

const noteTags = [
  {code: 'usage', name: '用法說明'},
  {code: 'pronun', name: '讀音說明'},
  {code: 'struct', name: '詞語結構'},
  {code: 'source', name: '字源考證'},
  {code: 'history', name: '歷史演變'},
  {code: 'proverb', name: '相關俗語'}
]

const isNew = ref(!id || id === 'new')
const isLoading = ref(false)
const isSaving = ref(false)

// 加载词条详情
const loadCiyu = async (id) => {
  if (isNew.value) return
  isLoading.value = true
  try {
    const res = await fetch(`/api/edit/ciyu/get-info/${dialect.value}?id=${id}`)
    if (!res.ok) throw new Error('加载失败')
    const json = await res.json()
    if (!json.success || json.data.empty) throw new Error('未找到数据')

    updateData.value = json.data.value
  } catch (err) {
    console.error(err)
    showError('加载失败：' + err.message)
  }
  finally {
    isLoading.value = false
  }
}

// 保存
const saveData = async () => {
  isSaving.value = true

  try {
    const payload = {
      ...updateData.value,
      id: isNew.value ? null : updateData.value.id
    }

    const response = await fetch(`/api/edit/ciyu/submit/${dialect.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    })

    const json = await response.json().catch(() => null)

    if (!response.ok) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    if (!json.success) throw new Error(json.message || '保存失败')

    showSuccess('保存成功！')

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
        {{ isSaving ? '保存中...' : isNew ? '保存新增' : '保存修改' }}
      </button>
    </div>


    <LoadingIcon v-if="isLoading" :show-text="true"/>

    <div v-else class="edit-form">


      <!-- 繁简字 & special -->
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <h4>
              繁體：
              <router-link
                  :to="`/tc/${dialect}/c/${updateData.ciyu.tc}`"
                  class="word-link" target="_blank"
              >
                {{ updateData.ciyu.tc }}
              </router-link>
            </h4>

            <h4>
              簡體：
              <router-link
                  :to="`/sc/${dialect}/c/${updateData.ciyu.sc}`"
                  class="word-link" target="_blank"
              >
                {{ updateData.ciyu.sc }}
              </router-link>
            </h4>
          </div>
          <div class="form-field">
            <label>特殊标记</label>
            <select v-model="updateData.special" class="short-input">
              <option value="0">普通詞語</option>
              <option value="1">特殊詞語</option>
              <option value="2">固定用法</option>
              <option value="4">百科</option>
            </select>
          </div>

          <div class="form-field">
            <label>词条状态</label>
            <select v-model="updateData.status" class="short-input">

              <option value="0">不需要補充</option>
              <option value="1">需要补充内容</option>
              <option value="2">存疑</option>
              <option value="3">完成</option>
            </select>

          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>拼音</h3>
        <div class="array-item">
          <input class="form-control small-middle-input" type="text" v-model="updateData.mainPy">
          <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                    :model-value="updateData.mainPy.toString()"/>
        </div>
      </div>

      <!-- 相似词语 -->
      <div class="form-section">
        <div class="section-header">
          <h3>相似词语</h3>
        </div>
        <DraggableList
            v-model="updateData.similar"
            :createItem="() => ({type:1, text: { sc: '', tc: '' }})"
        >
          <template #default="{ item, index }">
            <div class="array-item">

              <select v-model="item.type" class="middle-input">
                <option value="4">方言同義詞</option>
                <option value="5">方言相關詞彙</option>
                <option value="1">普通話對應詞</option>
                <option value="2">搜索優化詞語</option>
                <option value="3">常用错误写法</option>
              </select>
              <ScAndTcText v-model:traditionalText="item.text.tc" v-model:simplifiedText="item.text.sc"
                           :layout="'small'" :dialect="dialect.toString()"/>

            </div>
          </template>
        </DraggableList>
      </div>

      <div class="form-section">
        <h3>註釋</h3>

        <CopyButton text="__既可以读作[]（__音），也可以读作[]（__音），原因是___。" hint="多個讀音的說明模板"
                    class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- 新派的南昌話除了少數漢字，大部分陽入（第七聲[at7]）都可以讀作陰入（第六聲[at6]）"
                    hint="南昌話入聲混用的說明模板" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="「」單獨讀作[]，這裡讀作[]。
變調規則：兩個3聲{n 上聲}連讀的時候，前一個字變為第2聲{n 陽平}，這個特點和普通話類似。"
                    hint="3 3變調" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="「」單獨讀作[]，這裡讀作[]。
變調規則：3聲{n 上聲}、5聲{n 陽去}連讀的時候，前一個字變為第2聲{n 陽平}"
                    hint="3 5變調" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="「」單獨讀作[]，這裡讀作[]。
變調規則：3聲{n 上聲}、7聲{n 陽去}連讀的時候，前一個字變為第2聲{n 陽平}"
                    hint="3 7變調" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="書既可以读作[_]（老派音），也可以读作[_]（新派音），原因是新派更接近普通話
相關的規則是：一部分漢字老派讀作[jyu qyu xyu]的時候，新派讀作[zu cu su]，比如：
|字|老派音|新派音|
|---!|---!|---!|
|豬|[jyu1]|[zu1]|
|主|[jyu3]|[zu3]|
|處|[qyu3]|[cu3]|
|住|[qyu3]|[cu3]|
|書|[xyu1]|[su1]|
|樹|[xyu5]|[su5]|
{b 本字典作為當下的方言詞典，以現代讀法（新派音）為主。}" hint="zcs jqx新老派" class="dev-normal-button dev-btn-middle"/>

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
" hint="特殊漢字說明模板" class="dev-normal-button dev-btn-middle"/>


        <DraggableList
            v-model="updateData.note"
            :createItem="() => ({ left: 'usage', right: { sc: '', tc: '' }})"
        >
          <template #default="{ item, index }">
            <div class="array-item complex-item">

              <select v-model="item.left" class="short-input">
                <option
                    v-for="tag in noteTags"
                    :key="tag.code"
                    :value="tag.code"
                >
                  {{ tag.name }}
                </option>
              </select>

              <ScAndTcText v-model:traditionalText="item.right.tc" v-model:simplifiedText="item.right.sc"
                           :layout="'large'" :dialect="dialect.toString()"/>

              <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                        :model-value="item.right.tc"/>
              <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                        :model-value="item.right.sc"/>
            </div>
          </template>
        </DraggableList>
      </div>


      <div class="form-section">
        <h3>含義</h3>


        <CopyButton text="用法對應普通話的「」" hint="普通話同義詞的模板" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="南昌話里自然的口語表達里不會出現「」這個詞語，而是用這個詞代替。" hint="南昌話不會這麼表達的模板" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="|---!|---*|
|例句||
|說法||
|直譯||
|讀音||
相關詞彙：
- {c }：[] （）
- {c }：[] （）
- {c }：[] （）" hint="例句表格" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="這個詞條的重點在讀音上，內容不做詳細講解。" hint="重點在讀音上的模板" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="- {c }：[] （）" hint="例句相關詞彙的模板" class="dev-normal-button dev-btn-middle"/>

        <CopyButton text="- {c 箇}：[go3] （這）" hint="箇" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 嗰}：[go0] （的）" hint="嗰" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 許}：[he3]/[e3] （那，兩個讀音都可以）" hint="許" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 係}：[xi5] （是）" hint="係" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 噶}：[gak6] （這下）" hint="噶" class="dev-normal-button dev-btn-middle"/>
        <CopyButton text="- {c 渠}：[jie2] （他、她、它）" hint="渠" class="dev-normal-button dev-btn-middle"/>


        <DraggableList v-model="updateData.mean" :createItem="() => ({ sc: '', tc: '' })">
          <template #default="{ item, index }">

            <ScAndTcText v-model:traditionalText="item.tc" v-model:simplifiedText="item.sc"
                         :layout="'large'" :dialect="dialect.toString()"/>

            <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                      :model-value="item.tc"/>
            <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                      :model-value="item.sc"/>

          </template>
        </DraggableList>
      </div>


    </div>
  </div>
</template>

<style scoped>
.edit-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.form-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid var(--color-text-lighter);
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.main-pinyin-selector {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.selector-label {
  font-weight: bold;
  color: #333;
  margin-right: 10px;
  white-space: nowrap;
}

.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.radio-item input[type="radio"] {
  margin: 0;
}

.radio-item label {
  cursor: pointer;
  user-select: none;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.short-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 120px;
  min-width: 120px;
}

.middle-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 180px;
  min-width: 120px;
}

.array-item {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.draggable-item {
  cursor: move;
  padding: 8px;
  border: 1px dashed #ccc;
  border-radius: 4px;
  background: #fafafa;
}

.complex-item {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

button {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.word-link {
  color: #1976d2;
  text-decoration: none;
}

.word-link:hover {
  text-decoration: underline;
}
</style>