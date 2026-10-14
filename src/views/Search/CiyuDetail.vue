<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showError } from "../../services/ToastService.js"
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'
import SpecialTag from "../../components/Status/SpecialTag.vue";
import { isAdminUser, user } from '../../utils/auth.js'
import { HTTP_CODE, request } from '../../services/request.js'

const {t} = useI18n()
const route = useRoute()

const loading = ref(false)
const data = ref(null)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const query = computed(() => route.params.query)
const notFound = ref(false)
const isAdmin = computed(() => isAdminUser(user.value))
const seoDescription = computed(() => data.value
    ? `${data.value.ciyu}的方言读音、释义和相关词语。`
    : '查询词语的方言读音、释义和相关词语。')

useHead({
  title: () => {
    if (data.value) return `${t('linguistic.ciyu')}：${data.value.ciyu}`;
    else if (loading.value) return `${t('common.loading')}`
    else if(notFound.value) return `${t('linguistic.ciyu')}（未找到）`
  },
  meta: [
    { key: 'description', name: 'description', content: seoDescription },
    { key: 'og-description', property: 'og:description', content: seoDescription },
    { key: 'robots', name: 'robots', content: computed(() => notFound.value ? 'noindex, nofollow' : 'index, follow') }
  ]
})

const getSearchConfig = () => {
  try {
    const cached = localStorage.getItem('search_page_config')
    if (cached) return JSON.parse(cached)
  } catch (e) {
    console.error('读取搜索配置失败', e)
  }
  return {
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
      syllableStyle: config.syllableStyle,
      toneStyle: config.toneStyle
    })

    data.value = await request(`/api/search/${language.value}/${dialect.value}/ciyu?${params}`)
  } catch (e) {
    if (e.code === HTTP_CODE.NOT_FOUND) {
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

    <div v-if="loading" class="detail-skeleton dictionary-detail-style" aria-hidden="true">
      <div class="detail-skeleton-card detail-skeleton-main">
        <div class="detail-skeleton-character detail-skeleton-shimmer"/>
        <div class="detail-skeleton-copy">
          <div class="detail-skeleton-line detail-skeleton-title detail-skeleton-shimmer"/>
          <div class="detail-skeleton-line detail-skeleton-summary detail-skeleton-shimmer"/>
        </div>
      </div>
      <div class="detail-skeleton-card detail-skeleton-section">
        <div class="detail-skeleton-line detail-skeleton-heading detail-skeleton-shimmer"/>
        <div class="detail-skeleton-grid">
          <div v-for="index in 2" :key="index" class="detail-skeleton-inner">
            <div class="detail-skeleton-line detail-skeleton-inner-title detail-skeleton-shimmer"/>
            <div class="detail-skeleton-line detail-skeleton-text detail-skeleton-shimmer"/>
          </div>
        </div>
      </div>
      <div class="detail-skeleton-card detail-skeleton-section detail-skeleton-section-short">
        <div class="detail-skeleton-line detail-skeleton-heading detail-skeleton-shimmer"/>
        <div class="detail-skeleton-line detail-skeleton-text detail-skeleton-shimmer"/>
      </div>
    </div>

    <div v-else-if="data" class="detail-content dictionary-detail-style detail-ready">

      <div class="block-pinyin detail-main-card">
        <router-link v-if="isAdmin && data.id" class="detail-edit-button" aria-label="编辑词条" title="编辑词条"
                     :to="{name: 'CiyuEditor', params: {language, dialect, id: data.id}}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </router-link>
        <div class="hanzi-char" v-formatted-text="data.ciyu"/>
        <div class="pinyin-title" v-formatted-text="data.mainPy"/>

        <SpecialTag :special="data.special" type="ciyu" :dialect="dialect"/>
      </div>

      <div v-if="data.mean?.length" class="block-mean">
        <div class="section" v-if="data.mean && data.mean.length">
          <h3 class="section-title">{{ $t('search_detail.definition') }}</h3>
          <div class="mean-list">
            <div class="list-item" v-for="(m, i) in data.mean" :key="i" v-formatted-text="m"/>
          </div>
        </div>
      </div>

      <div v-if="data.note?.length" class="block-note">
        <div class="section" v-if="data.note && data.note.length">
          <h3 class="section-title">{{ $t('search_detail.notes') }}</h3>
          <div class="mean-list">
            <div class="note-item" v-for="(m, i) in data.note" :key="i">
              <div class="note-item-left" v-formatted-text="m.left"></div>
              <div v-formatted-text="m.right"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="data.ref && data.ref.length" class="block-ref">
        <h3 class="section-title">{{ $t('search_detail.dictionary') }}</h3>
        <div class="mean-list">
          <div v-for="(r, i) in data.ref" :key="i" class="ref-item">
            <div class="ref-content" v-formatted-text="r.content"/>
            <div class="ref-source" v-formatted-text="r.source"/>
          </div>
        </div>
      </div>

    </div>

    <div v-else-if="notFound" class="detail-content dictionary-detail-style">

      <div class="block-pinyin">
        <div class="section">
          <h2 class="pinyin-title">
            {{ query }}：{{ $t('search_detail.entry_missing') }}
          </h2>

          <p style="margin-top: 10px; color: var(--color-text-light);">
            {{ $t('search_detail.no_definition') }}
<!--            嘗試更換方言或者詞語-->
          </p>

          <!-- 反馈按钮（保留结构，暂时注释） -->
          <!--
          <div class="feedback-area" style="margin-top: 16px;">
            <button class="feedback-button">
              {{ $t('search_detail.feedback') }}
            </button>
          </div>
          -->
        </div>
      </div>

    </div>

  </div>
</template>

<style>
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

.detail-main-card {
  position: relative;
}

.detail-edit-button {
  position: absolute;
  top: 18px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 7px;
  color: var(--color-primary-dark);
  background: #edf5e8;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.detail-edit-button:hover {
  background: #dcebd4;
}

.detail-edit-button svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pinyin-title {
  font-size: 28px;
  font-weight: 700;
  color: #1e5721;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 0;
  cursor: pointer;
  user-select: none;
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

.table td {
  border: 1px solid var(--color-border);
  padding: 12px 16px;
}

.mean-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  font-size: 18px;
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
