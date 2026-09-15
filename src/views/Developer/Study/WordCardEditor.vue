<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showError, showSuccess } from '../../../services/ToastService.js'
import { useHead } from '@vueuse/head'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'
import RichText from '../../../components/Text/RichText.vue'
import LoadingIcon from '../../../components/Status/LoadingIcon.vue'

const route = useRoute()
const router = useRouter()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const id = computed(() => route.params.id)
const isNew = computed(() => !id.value || id.value === 'new')

const form = ref({
  id: null,
  putonghua: {sc: '', tc: ''},
  word: {sc: '', tc: ''},
  pinyin: ''
})
const loading = ref(false)
const saving = ref(false)

useHead({title: () => isNew.value ? '新增词卡' : '编辑词卡'})

const loadCard = async () => {
  if (isNew.value) return
  loading.value = true
  try {
    const response = await fetch(`/api/study/edit/${dialect.value}/${id.value}`)
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '加载失败')
    form.value = result.data
  } catch (error) {
    showError(`加载词卡失败：${error.message}`)
  }
  finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    const response = await fetch(`/api/study/edit/${dialect.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...form.value, id: isNew.value ? null : form.value.id})
    })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '保存失败')
    showSuccess('保存成功')
    await router.push(`/${language.value}/${dialect.value}/dev/study-word-card`)
  } catch (error) {
    showError(`保存失败：${error.message}`)
  }
  finally {
    saving.value = false
  }
}

onMounted(loadCard)
</script>

<template>
  <main class="card-editor-page">
    <div class="editor-toolbar">
      <router-link :to="`/${language}/${dialect}/dev/study-word-card`" class="dev-normal-button dev-btn-small">
        返回列表
      </router-link>
      <button class="dev-add-btn dev-btn-small" :disabled="saving" @click="save">
        {{ saving ? '保存中……' : isNew ? '保存新增' : '保存修改' }}
      </button>
    </div>

    <LoadingIcon v-if="loading" :show-text="true"/>
    <div v-else class="editor-form">
      <section class="form-section">
        <h2>{{ isNew ? '新增词卡' : '编辑词卡' }}</h2>
        <p class="form-hint">普通话和方言词语需要逐字对应，拼音按空格分隔。</p>
      </section>

      <section class="form-section">
        <h3>普通话</h3>
        <ScAndTcText
            v-model:traditionalText="form.putonghua.tc"
            v-model:simplifiedText="form.putonghua.sc"
            layout="middle"
            :dialect="dialect.toString()"
        />
      </section>

      <section class="form-section">
        <h3>方言词语</h3>
        <ScAndTcText
            v-model:traditionalText="form.word.tc"
            v-model:simplifiedText="form.word.sc"
            layout="middle"
            :dialect="dialect.toString()"
        />
      </section>

      <section class="form-section">
        <h3>方言拼音</h3>
        <input v-model="form.pinyin" class="form-control pinyin-input" placeholder="例如：go3 liak6"/>
        <RichText :language="language.toString()" :dialect="dialect.toString()" :model-value="form.pinyin"
                  :all-pinyin="true"/>
      </section>
    </div>
  </main>
</template>

<style scoped>
.card-editor-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 108px 24px 48px;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-section {
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, .75);
}

h2, h3 {
  margin-top: 0;
  color: var(--color-primary-dark);
}

.form-hint {
  margin-bottom: 0;
  color: var(--color-text-light);
}

.pinyin-input {
  width: 100%;
  margin-bottom: 12px;
}

@media (max-width: 600px) {
  .card-editor-page {
    padding: 92px 12px 36px;
  }

  .form-section {
    padding: 14px;
  }
}
</style>
