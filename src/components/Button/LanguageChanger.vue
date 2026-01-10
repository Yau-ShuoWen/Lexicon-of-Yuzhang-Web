<template>
  <div class="language-changer" @click="toggleRouteLanguage">
    <img :src="icon" alt="switch language" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import icon from '../../assets/icons/transfer_sc_tc.svg'

const route = useRoute()
const router = useRouter()

/**
 * 当前 URL 中的语言（仅识别 sc / tc）
 * 如果不是语言路由，返回 null
 */
const currentLangInRoute = computed(() => {
  const first = route.path.split('/')[1]
  return first === 'sc' || first === 'tc' ? first : null
})

/**
 * 切换 URL 中的语言
 */
const toggleRouteLanguage = () => {
  const segments = route.path.split('/').filter(Boolean)

  let nextLang = 'sc'

  if (currentLangInRoute.value === 'sc') {
    nextLang = 'tc'
  } else if (currentLangInRoute.value === 'tc') {
    nextLang = 'sc'
  }

  let nextPath

  if (currentLangInRoute.value) {
    // 已经有语言：替换第一个 segment
    segments[0] = nextLang
    nextPath = '/' + segments.join('/')
  } else {
    // 老路由：直接加语言前缀
    nextPath = `/${nextLang}${route.path}`
  }

  router.push(nextPath)
}
</script>

<style scoped>
.language-changer {
  width: 32px;
  height: 32px;
  cursor: pointer;
  border-radius: 50%;
  padding: 4px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.language-changer:hover {
  background-color: #f0f0f0;
  transform: scale(1.05);
}

.language-changer:active {
  transform: scale(0.95);
}

.language-changer img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
</style>
