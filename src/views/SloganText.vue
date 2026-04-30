<script setup>
import { computed, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { formatRichText } from "../utils/textFormatter"
import { showError } from "../services/ToastService.js";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

/* 控制是否显示翻译 */
const isRevealed = ref(false)

const activateEffect = () => {if (!isRevealed.value) isRevealed.value = true}

/* ===== 原 TextInfo 逻辑 ===== */

const text = ref("")

const formattedText = computed(() => formatRichText(text.value))

async function fetchText() {
  try {

    const res = await fetch(
        `/api/info/get-text/${dialect.value}/${language.value}/welcome`,
        {cache: "no-store"}
    )

    if (!res.ok) throw new Error(res.status)

    text.value = await res.json()

  } catch (e) {
    showError("网络连接错误")
    console.error("info text fetch failed", e)
  }
}

/* 监听 route 参数变化 */

watch(
    () => [dialect.value, language.value],
    fetchText,
    {immediate: true}
)
</script>

<template>

  <div
      class="title-wrapper"
      @mouseenter="activateEffect"
      @touchstart.passive="activateEffect"
  >

    <!-- 原始文字 -->
    <p
        class="page-subtitle original-text"
        v-formatted-text="$t('message.welcome')"
        :class="{ 'fade-out': isRevealed }"
    />

    <!-- 翻译文字 -->
    <div
        class="page-subtitle revealed-text info-text"
        v-html="formattedText"
        :class="{ 'fade-in': isRevealed }"
    />

  </div>

</template>

<style scoped>

.title-wrapper {
  position: relative;
  width: 100%;
  max-width: 500px;
  height: 100px;
  margin: 15px auto 5px auto;
  overflow: visible;
  padding: 10px 0;
  box-sizing: border-box;
  cursor: pointer;
}

.page-subtitle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  text-align: center;
  margin: 0;
  transition: opacity 0.6s ease-in-out;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.original-text {
  font-size: var(--font-size-2xl);
  font-weight: bold;
  opacity: 1;
  z-index: 1;
}

.revealed-text {
  opacity: 0;
  z-index: 2;
  line-height: 1.2;
}

.fade-out {
  opacity: 0 !important;
}

.fade-in {
  opacity: 1 !important;
}

.info-text {
  font-size: var(--font-size-lg);
  line-height: 1.6;
}

</style>