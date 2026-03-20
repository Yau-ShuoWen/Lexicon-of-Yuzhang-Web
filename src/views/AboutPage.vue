<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import LoadingIcon from "../components/Status/LoadingIcon.vue";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

/** 数据状态 */
const loading = ref(true)
const error = ref('')
const result = ref('')

/** 获取 about 内容 */
const fetchAbout = async () => {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch(
        `/api/info/get-text/${dialect.value}/${language.value}/website-about`
    )

    if (!res.ok) throw new Error('加载失败')

    result.value = await res.json()
  } catch (err) {
    console.error(err)
    error.value = err.message || '加载失败'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAbout()
})
</script>

<template>
  <div class="about-page">
    <div class="container">

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-wrapper">
        <LoadingIcon/>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <!-- 正文 -->
      <div v-else class="about-content">
        <div class="text-box" v-formatted-text="result"></div>

        <div class="text-box contact-box">
          <div class="contact-title">{{ '联系' }}</div>

          <div class="contact-list">

            <router-link
                :to="{ name: 'DeveloperHome', params: { language: language } }"
                class="contact-item"
            >
              <img src="../assets/icons/developer.svg" class="icon"/>
              {{ $t('about.developer_mode') }}
            </router-link>

            <a href="https://github.com/Yau-ShuoWen" target="_blank" class="contact-item">
              <img src="../assets/icons/github.svg" class="icon"/>
              {{ $t('about.github_project') }}
            </a>

            <div class="contact-item">
              <img src="../assets/icons/qq.svg" class="icon"/>
              QQ交流群：496423006
            </div>

            <a href="https://beian.miit.gov.cn" target="_blank" class="contact-item">
              <img src="../assets/icons/icp.svg" class="icon"/>
              蜀ICP备 2026005399号
            </a>

          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.about-page {
  min-height: 100vh;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 30px 20px;
}

/* 内容区域 */
.text-box {
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 20px;
  line-height: 1.7;
  color: var(--color-text);
}

/* 加载 */
.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

/* 错误 */
.error {
  text-align: center;
  color: red;
  padding: 20px;
}

/* 联系区域 */
.contact-box {
  margin-top: 30px;
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
.icon {
  width: 20px;
  height: 20px;
  margin-right: 10px;
}
</style>