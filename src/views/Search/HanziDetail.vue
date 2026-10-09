<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'
import LoadingIcon from '../../components/Status/LoadingIcon.vue'
import SpecialTag from '../../components/Status/SpecialTag.vue'
import { showError } from '../../services/ToastService.js'
import { isAdminUser, user } from '../../utils/auth.js'
import { HTTP_CODE, request } from '../../services/request.js'

const {t} = useI18n()
const route = useRoute()
const loading = ref(false)
const notFound = ref(false)
const data = ref(null)
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const query = computed(() => route.params.query)
const isAdmin = computed(() => isAdminUser(user.value))

const seoDescription = computed(() => data.value
    ? `${data.value.hanzi}的方言读音、释义与相关词语。`
    : '查询汉字的方言读音、释义与相关词语。')

useHead({
  title: () => data.value ? `${t('linguistic.hanzi')}：${data.value.hanzi}` : t('common.loading'),
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
  } catch (error) {
    console.error('读取搜索配置失败', error)
  }
  return {phonogram: 1, toneStyle: 1, syllableStyle: 1}
}

const fetchHanzi = async () => {
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
    data.value = await request(`/api/search/${language.value}/${dialect.value}/hanzi?${params}`)
  } catch (error) {
    if (error.code === HTTP_CODE.NOT_FOUND) notFound.value = true
    else {
      console.error(error)
      showError(error.message)
    }
  }
  finally {
    loading.value = false
  }
}

watch(() => route.params.query, fetchHanzi, {immediate: true})
</script>

<template>
  <div class="broaden-layout padding-top-reset">
    <LoadingIcon v-if="loading"/>

    <div v-else-if="data" class="detail-content">
      <div class="block-pinyin detail-main-card">
        <router-link v-if="isAdmin && data.id" class="detail-edit-button" aria-label="编辑汉字词条" title="编辑汉字词条"
                     :to="{name: 'HanziEditor', params: {language, dialect, id: data.id}}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </router-link>
        <div class="hanzi-char" v-formatted-text="data.hanzi"/>
        <div class="pinyin-summary">
          <span v-for="(item,index) in data.pinyin" :key="index" class="summary-item"
                v-formatted-text="item.pinyin"/>
        </div>
        <div v-if="data.similar?.length" class="similar-row">
          <span>{{ language === 'sc' ? '相似字：' : '相似字：' }}</span>
          <span v-for="(item,index) in data.similar" :key="index" v-formatted-text="item"/>
        </div>
        <SpecialTag :special="data.special" type="hanzi" :dialect="dialect"/>
      </div>

      <div v-if="data.pinyin?.length" class="block-pronunciation">
        <h3 class="section-title">{{ $t('linguistic.pronun.pronun_and_type') }}</h3>
        <div class="pronunciation-list">
          <div v-for="(item,index) in data.pinyin" :key="index" class="pronunciation-item">
            <div class="pronunciation-head">
              <span class="pronunciation-pinyin" v-formatted-text="item.pinyin"/>
              <span class="pronunciation-tag" v-formatted-text="item.tag"/>
            </div>
            <div v-if="item.mandarin?.length" class="mandarin-row">
              <span class="mandarin-label">{{ $t('linguistic.pronun.correspond_mdr') }}：</span>
              <span v-for="(mandarin,mandarinIndex) in item.mandarin" :key="mandarinIndex"
                    class="mandarin-item">
                <span v-formatted-text="mandarin.pinyin"/>
                <span class="mandarin-zhuyin" v-formatted-text="mandarin.zhuyin"/>
              </span>
            </div>
            <div v-if="item.words?.length" class="word-capsules">
              <router-link v-for="word in item.words" :key="word.id" class="word-item"
                           :to="`/${language}/${dialect}/dict/c/${encodeURIComponent(word.word)}`">
                <span v-formatted-text="word.word"/>
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <div v-if="data.note?.length" class="block-note">
        <h3 class="section-title">{{ $t('search_detail.notes') }}</h3>
        <div class="content-list">
          <div v-for="(item,index) in data.note" :key="index" class="note-item">
            <div class="note-title" v-formatted-text="item.left"/>
            <div v-formatted-text="item.right"/>
          </div>
        </div>
      </div>

      <div v-if="data.ref?.length" class="block-ref">
        <h3 class="section-title">{{ $t('search_detail.dictionary') }}</h3>
        <div class="content-list">
          <div v-for="(item,index) in data.ref" :key="index" class="ref-item">
            <div v-if="item.content" class="ref-content" v-formatted-text="item.content"/>
            <div v-if="item.source" class="ref-source" v-formatted-text="item.source"/>
            <div v-if="item.note" class="ref-note" v-formatted-text="item.note"/>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="notFound" class="detail-content">
      <div class="block-pinyin">
        <h2>{{ query }}：{{ $t('search_detail.entry_missing') }}</h2>
        <p class="missing-text">{{ $t('search_detail.no_definition') }}</p>
      </div>
    </div>
  </div>
</template>

<style>
.block-pinyin, .block-pronunciation, .block-note, .block-ref {
  border-radius: var(--border-radius-lg);
  padding: 28px;
  margin-bottom: 20px
}

.block-pinyin {
  background: var(--color-background);
  margin-top: 30px;
  border: 1px solid var(--color-primary-dark);
  box-shadow: var(--shadow-sm)
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

.block-pronunciation {
  background: #d7eac0;
  border: 1px solid #aed581
}

.block-note {
  background: #d0e5fa;
  border: 1px solid #90caf9
}

.block-ref {
  background: #c3eae4;
  border: 1px solid #7bc3b6
}

.hanzi-char {
  font-size: 56px;
  font-weight: 400;
  color: var(--color-primary-dark);
  letter-spacing: .05em
}

.pinyin-summary {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0 16px;
  padding-bottom: 14px;
  border-bottom: 2px dashed #c8e6c9
}

.summary-item {
  font-size: 26px;
  font-weight: 700;
  color: #1e5721
}

.summary-item:not(:last-child)::after {
  content: '／';
  margin-left: 10px;
  color: var(--color-text-light)
}

.similar-row {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--color-text-light);
  margin-bottom: 8px
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 10px
}

.section-title::before {
  content: '';
  width: 4px;
  height: 28px;
  border-radius: 2px;
  background: var(--color-primary)
}

.block-pronunciation .section-title::before {
  background: #58972c
}

.block-note .section-title::before {
  background: #1565c0
}

.block-ref .section-title::before {
  background: #2c98a8
}

.pronunciation-list {
  display: grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap: 16px
}

.pronunciation-item, .note-item, .ref-item {
  padding: 16px 20px;
  background: var(--color-background);
  border-radius: var(--border-radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, .08)
}

.pronunciation-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px
}

.pronunciation-pinyin {
  font-size: 25px;
  font-weight: 700;
  color: #1e5721
}

.pronunciation-tag {
  padding: 3px 9px;
  border-radius: 99px;
  background: #edf6e5;
  color: #43682d;
  white-space: nowrap
}

.mandarin-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border)
}

.mandarin-label {
  font-size: 14px;
  color: var(--color-text-light)
}

.mandarin-item {
  display: inline-flex;
  gap: 7px
}

.mandarin-zhuyin {
  color: var(--color-text-light)
}

.word-capsules {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border)
}

.word-item {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid rgba(73, 125, 49, .2);
  border-radius: 999px;
  color: #315f27;
  background: rgba(255, 255, 255, .78);
  text-decoration: none;
  box-shadow: 0 1px 2px rgba(42, 84, 31, .08)
}

.word-item:hover {
  background: #fff;
  border-color: rgba(73, 125, 49, .38)
}

.content-list {
  display: flex;
  flex-direction: column;
  gap: 20px
}

.note-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #0d47a1
}

.ref-content {
  font-size: 18px;
  line-height: 1.6
}

.ref-source {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-light);
  font-style: italic
}

.ref-source::before {
  content: '— '
}

.ref-note {
  margin-top: 8px
}

.missing-text {
  margin-top: 10px;
  color: var(--color-text-light)
}

@media (max-width: 768px) {
  .block-pinyin, .block-pronunciation, .block-note, .block-ref {
    padding: 22px 16px
  }

  .hanzi-char {
    font-size: 48px
  }

  .pronunciation-list {
    grid-template-columns:1fr
  }

  .summary-item {
    font-size: 23px
  }
}
</style>
