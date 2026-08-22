<!-- AlphabetIntroCard -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showError } from '../../services/ToastService.js'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";

const props = defineProps({
  /* 字母表 code */
  code: { type: String, required: true },
  /* 语言 */
  language: { type: String, default: '' }
})

const route = useRoute()
const loading = ref(true)
const data = ref(null)

const lang = computed(() => props.language || route.params.language)

async function fetchIntroduce() {
  try {
    loading.value = true
    const res = await fetch(`/api/alphabet/introduce/${props.code}/${lang.value}`)
    if (!res.ok) throw new Error(res.status)
    data.value = await res.json()
  } catch (e) {
    console.error(e)
    showError('加载介绍失败')
  } finally {
    loading.value = false
  }
}

watch(() => [props.code, lang.value], fetchIntroduce, { immediate: true })
</script>

<template>
  <section class="alphabet-card-container">
    <LoadingIcon v-if="loading" class="card-loading"/>

    <template v-else-if="data">
      <!-- ===== 彩色页眉区 ===== -->
      <header class="card-header">
        <h1 class="header-title">
          <span class="header-name" v-formatted-text="data.left"/>
          <span class="header-badge">{{ $t('personal.alphabet_table.title_short') }}</span>
        </h1>
        
        <!-- 装饰背景 -->
        <div class="decor-circle decor-1"></div>
        <div class="decor-circle decor-2"></div>

        <!-- 波浪分割线 -->
        <div class="wave-divider">
          <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V120c6.43-1.63,12.87-3.23,19.3-4.85C95.53,95.53,192.64,74.52,321.39,56.44Z" class="shape-fill"></path>
          </svg>
        </div>
      </header>

      <!-- ===== 白色内容区（深色字） ===== -->
      <div class="card-body">
        <div class="intro-text" v-formatted-text="data.right"/>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* ======== 整体卡片容器 ======== */
.alphabet-card-container {
  position: relative;
  background: #fff;
  border-radius: var(--border-radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  margin-bottom: 24px;
  border: 1px solid var(--color-border-light);
  opacity: 0;
  animation: fadeInUp 0.55s ease 0.02s both;
}

.card-loading {
  padding: 40px;
}

/* ======== 彩色页眉 ======== */
.card-header {
  position: relative;
  padding: 28px 28px 50px; /* 增加底部内边距为波浪留白 */
  background: var(--gradient-primary);
  color: #fff;
  overflow: hidden;
}

.header-title {
  position: relative;
  z-index: 10;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 26px;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.header-badge {
  display: inline-block;
  padding: 2px 12px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(4px);
}

/* ======== 波浪分割线样式 ======== */
.wave-divider {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  overflow: hidden;
  line-height: 0;
  transform: rotate(180deg);
}

.wave-divider svg {
  position: relative;
  display: block;
  width: calc(150% + 1.3px);
  height: 40px;
}

.wave-divider .shape-fill {
  fill: #FFFFFF;
}

/* ======== 白色主体 ======== */
.card-body {
  position: relative;
  z-index: 5;
  padding: 0px 28px 28px;
  margin-top: -10px; /* 稍微向上移动以衔接波浪 */
  background: #fff;
}

.intro-text {
  color: var(--color-text);
  font-size: 15.5px;
  line-height: 1.85;
  letter-spacing: 0.2px;
  text-align: justify;
}

/* ======== 装饰背景 ======== */
.decor-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.1);
}

.decor-1 {
  width: 160px;
  height: 160px;
  right: -20px;
  top: -60px;
}

.decor-2 {
  width: 90px;
  height: 90px;
  left: -10px;
  bottom: 20px;
}

/* ======== 动画 ======== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 移动端适配 */
@media (max-width: 600px) {
  .card-header {
    padding: 22px 20px 45px;
  }
  
  .header-title {
    font-size: 22px;
  }
  
  .card-body {
    padding: 0 20px 22px;
  }
  
  .intro-text {
    font-size: 14.5px;
  }

  .wave-divider svg {
    height: 30px;
  }
}
</style>
