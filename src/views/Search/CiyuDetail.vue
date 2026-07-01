<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import LoadingIcon from "../../components/Status/LoadingIcon.vue"
import { showError } from "../../services/ToastService.js"
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'
import SpecialTag from "../../components/Status/SpecialTag.vue";

const {t} = useI18n()
const route = useRoute()

const loading = ref(false)
const data = ref(null)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const query = computed(() => route.params.query)
const notFound = ref(false)

useHead({
  title: () => {
    if (data.value) return `${t('linguistic.ciyu')}：${data.value.ciyu}`;
    else if (loading.value) return `${t('common.loading')}`
    else if(notFound.value) return `aaa`
  }
})

const getSearchConfig = () => {
  try {
    const cached = localStorage.getItem('search_page_config')
    if (cached) return JSON.parse(cached)
  } catch (e) {
    console.error('读取搜索配置失败', e)
  }
  return {
    phonogram: 1,
    toneStyle: 1,
    syllableStyle: 1
  }
}

const fetchCiyu = async () => {
  loading.value = true
  data.value = null
  notFound.value = false

  try {
    const config = getSearchConfig()

    const params = new URLSearchParams({
      query: query.value,
      phonogram: config.phonogram,
      syllableStyle: config.syllableStyle,
      toneStyle: config.toneStyle
    })

    const response = await fetch(`/api/search/${language.value}/${dialect.value}/ciyu?${params}`)
    const json = await response.json().catch(() => null)

    if (!response.ok) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    if (!json.success) throw new Error(json.message || '查询失败')

    data.value = json.data
  } catch (e) {
    if (e.message.includes('not found')) {
      notFound.value = true
      data.value = null
    } else {
      console.error(e)
      showError(e.message)
    }
  }
  finally {
    loading.value = false
  }
}

watch(
    () => route.params.query,
    () => {
      fetchCiyu()
    },
    {immediate: true}
)
</script>

<template>
  <div class="broaden-layout padding-top-reset">

    <LoadingIcon v-if="loading"/>

    <div v-else-if="data" class="detail-content">

<!--      &lt;!&ndash; 词语标题 &ndash;&gt;-->
<!--      <div class="hanzi-header">-->

<!--      </div>-->

      <div class="block-pinyin">
        <div class="hanzi-char" v-formatted-text="data.ciyu"/>
        <div class="pinyin-title" v-formatted-text="data.mainPy"/>

        <SpecialTag :special="data.special" type="ciyu" :dialect="dialect"/>

<!--        <div class="section" v-if="data.similar && data.similar.length">-->
<!--          <h3 class="section-title">相似词</h3>-->
<!--          <table class="table mean-list">-->
<!--            <tr v-for="(s, i) in data.similar" :key="i">-->
<!--              <td class="cell-label" v-formatted-text="s.left"/>-->
<!--              <td class="cell-value" v-formatted-text="s.right"/>-->
<!--            </tr>-->
<!--          </table>-->
<!--        </div>-->
      </div>

      <div v-if="data.mean?.length" class="block-mean">
        <div class="section" v-if="data.mean && data.mean.length">
          <h3 class="section-title">释义</h3>
          <div class="mean-list">
            <div class="list-item" v-for="(m, i) in data.mean" :key="i" v-formatted-text="m"/>
          </div>
        </div>
      </div>

      <div v-if="data.note?.length" class="block-note">
        <div class="section" v-if="data.note && data.note.length">
          <h3 class="section-title">注释</h3>
          <div class="mean-list">
            <div class="note-item" v-for="(m, i) in data.note" :key="i">
              <div class="note-item-left" v-formatted-text="m.left"></div>
              <div v-formatted-text="m.right"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="data.ref && data.ref.length" class="block-ref">
        <h3 class="section-title">辞书</h3>
        <div class="mean-list">
          <div v-for="(r, i) in data.ref" :key="i" class="ref-item">
            <div class="ref-content" v-formatted-text="r.content"/>
            <div class="ref-source" v-formatted-text="r.source"/>
          </div>
        </div>
      </div>

    </div>

    <div v-else-if="notFound" class="detail-content">

<!--      <div class="hanzi-header">-->
<!--        <h1 class="hanzi-char"></h1>-->
<!--      </div>-->

      <div class="block-pinyin">
        <div class="section">
          <h2 class="pinyin-title">
            {{ query }}：该词条尚未收录
          </h2>

          <p style="margin-top: 10px; color: var(--color-text-light);">
            当前数据库中暂无该词语的详细释义。
<!--            嘗試更換方言或者詞語-->
          </p>

          <!-- 反馈按钮（保留结构，暂时注释） -->
          <!--
          <div class="feedback-area" style="margin-top: 16px;">
            <button class="feedback-button">
              提交反馈 / 补充资料
            </button>
          </div>
          -->
        </div>
      </div>

    </div>

  </div>
</template>

<style>
.hanzi-header {
  text-align: center;
  margin: 30px 0 24px;
  padding: 32px 20px;
  background: #90d393;
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-md);
}

.hanzi-char {
  font-size: 56px;
  font-weight: 400;
  color:  var(--color-primary-dark);
  letter-spacing: 0.05em;
}

.block-pinyin {
  background: var(--color-background);
  border-radius: var(--border-radius-lg);
  padding:  20px 28px;
  margin: 30px 0 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-primary-dark);
}

.pinyin-title {
  font-size: 28px;
  font-weight: 700;
  color: #1e5721;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px dashed #c8e6c9;
}

.block-mean {
  background: #d7eac0;
  border-radius: var(--border-radius-lg);
  padding: 28px;
  margin-bottom: 20px;
  border: 1px solid #aed581;
}

.block-note {
  background: #d0e5fa;
  border-radius: var(--border-radius-lg);
  padding: 28px;
  margin-bottom: 20px;
  border: 1px solid #90caf9;
}

.block-ref {
  background: #c3eae4;
  border-radius: var(--border-radius-lg);
  padding: 28px;
  margin-bottom: 20px;
  border: 1px solid #7bc3b6;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title::before {
  content: '';
  width: 4px;
  height: 28px;
  background: var(--color-primary);
  border-radius: 2px;
}

.block-mean .section-title::before {
  background: #58972c;
}

.block-note .section-title::before {
  background: #1565c0;
}

.block-ref .section-title::before {
  background: #2c98a8;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 14px 0;
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.table td {
  border: 1px solid var(--color-border);
  padding: 12px 16px;
}

.cell-label {
  background: var(--color-background-alt);
  width: 50%;
  font-weight: 600;
  color: var(--color-text);
}

.cell-value {
  width: 50%;
  background: var(--color-background);
}

.mean-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item {
  padding: 16px 20px;
  background: var(--color-background);
  border-radius: var(--border-radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.note-item {
  padding: 16px 20px;
  background: var(--color-background);
  border-radius: var(--border-radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.note-item-left {
  font-weight: 600;
  margin-bottom: 6px;
  color: #0d47a1;
}

.ref-item {
  padding: 16px 20px;
  background: var(--color-background);
  border-radius: var(--border-radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.ref-content {
  margin-bottom: 8px;
  font-size: 17px;
  line-height: 1.6;
}

.ref-source {
  font-size: 13px;
  color: var(--color-text-light);
  font-style: italic;
}

.ref-source::before {
  content: '— ';
}

@media (max-width: 768px) {
  .hanzi-header {
    padding: 28px 16px;
    margin: 24px 0 20px;
  }

  .hanzi-char {
    font-size: 48px;
  }

  .block-pinyin,
  .block-mean,
  .block-note,
  .block-ref {
    padding: 22px 16px;
    margin-bottom: 20px;
  }

  .pinyin-title {
    font-size: 24px;
  }

  .list-item,
  .note-item,
  .ref-item {
    padding: 14px 16px;
  }
}
</style>