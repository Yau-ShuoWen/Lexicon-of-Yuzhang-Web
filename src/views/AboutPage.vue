<script setup>
import { ref, computed, onMounted,watch } from 'vue'
import { useRoute } from 'vue-router'
import LoadingIcon from "../components/Status/LoadingIcon.vue";
import { showError } from "../services/ToastService.js";
import { useI18n } from 'vue-i18n'
import DialectSelector from "../components/Select/DialectSelector.vue";
import LanguageSelector from "../components/Select/LanguageSelector.vue";
import { useHead } from '@vueuse/head'

const {t} = useI18n()
const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const loading = ref(true)
const result = ref('')

useHead({
  title: () => `${t('nav.about_us')}`
})
const fetchAbout = async () => {
  loading.value = true


  try {
    const start = Date.now();

    const res = await fetch(`/api/info/about-page/${dialect.value}/${language.value}`)
    if (!res.ok) throw new Error(t('common.loadingError'))
    result.value = await res.json()
    
    console.log('SQL耗时:', Date.now() - start, 'ms');

  } catch (err) {
    console.error(err)
    showError(err.message);
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAbout()
})

watch([language, dialect], () => {
  fetchAbout()
}, { immediate: true })
</script>

<template>
  <div class="broaden-layout">

    <LoadingIcon v-if="loading"/>


    <div v-else class="about-layout">

      <!-- 左側 -->
      <div class="left-column">

        <!-- 關於 -->
        <div class="about-box margin-bottom-box">
          <div class="contact-title" v-formatted-text="$t('about_page.about')"/>
          <div v-formatted-text="result.about"></div>
        </div>

        <div class="selector-container">
          <LanguageSelector/>
          <DialectSelector/>
        </div>

      </div>

      <!-- 右側 -->
      <div class="right-column">




        <!-- 統計 -->
        <div class="right-box margin-bottom">
          <div class="contact-title" v-formatted-text="$t('about_page.statistic')"/>
          <div v-formatted-text="result.statistic"></div>
        </div>

        <!-- 致謝 -->
        <div class="right-box margin-bottom">
          <div class="contact-title" v-formatted-text="$t('about_page.thanks')"/>
          <div v-formatted-text="result.thanks"></div>
        </div>

        <div class="right-box">
          <div class="contact-title" v-formatted-text="$t('about_page.contact')"/>

          <div class="contact-list">

            <a href="https://github.com/Yau-ShuoWen" target="_blank" class="contact-item">
              <img src="../assets/icons/github.svg" class="icon-clickable"/>
              {{ $t('about.github_project') }}
            </a>

            <div class="contact-item">
              <img src="../assets/icons/qq.svg" class="icon-clickable"/>
              QQ交流群：496423006
            </div>

            <a href="https://beian.miit.gov.cn" target="_blank" class="contact-item">
              <img src="../assets/icons/icp.svg" class="icon-clickable"/>
              蜀ICP备 2026005399号
            </a>

            <router-link
                :to="{ name: 'YswHome', params: { language: language } }"
                class="contact-item"
            >
              <img src="../assets/icons/developer.svg" class="icon-clickable"/>
              {{ `說文的屋里（彩蛋）` }}
            </router-link>

          </div>
        </div>

      </div>

    </div>

  </div>

</template>

<style scoped>
.about-box {
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 20px;
  line-height: 1.7;
  color: var(--color-text);
  margin-bottom: 30px;
}

.margin-bottom {
  margin-bottom: 30px;
}

/* 内容区域 */
.right-box {
  background: var(--app-bg-color);
  border: 1.5px solid var(--color-primary);
  border-radius: var(--border-radius-md);
  padding: 20px;
  line-height: 1.7;
  color: var(--color-text);
  margin-bottom: 30px;
}

/* 标题 */
.contact-title {
  font-size: 25px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-text);
}

/* 列表 */
.contact-list {
  display: flex;
  flex-direction: column;
}

/* 单行 */
.contact-item {
  display: flex;
  align-items: center;
  padding: 5px 6px;
  color: #2C3E50;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s ease;
  cursor: pointer;
}

/* hover效果 */
.contact-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

/* 图标 */
.icon-clickable {
  width: 20px;
  height: 20px;
  margin-right: 10px;
}

.selector-container {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 350px;
  margin: 5px auto;
  font-size: 1.2rem;
  padding: 10px;
  gap: 20px; /* 元素之间的间距 */
}

.about-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* 左右比例 3:2 */
.left-column {
  flex: 3;
  min-width: 0;
}

.right-column {
  flex: 2;
  min-width: 0;
}

/* 手機版改直排 */
@media (max-width: 768px) {
  .about-layout {
    flex-direction: column;
  }

  .left-column,
  .right-column {
    width: 100%;
  }
}
</style>