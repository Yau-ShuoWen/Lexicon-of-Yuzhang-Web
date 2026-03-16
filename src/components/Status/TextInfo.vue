<template>
  <div class="info-text" v-html="formattedText"></div>
</template>

<script setup>
import { ref, computed, watch } from "vue"
import { formatRichText } from "../../utils/textFormatter"

const props = defineProps({
  dialect: { type: String, required: true },
  language: { type: String, required: true },
  textKey: { type: String, required: true }
})

const text = ref("")

const formattedText = computed(() => formatRichText(text.value))

async function fetchText() {
  try {

    const res = await fetch(
        `/api/info/get-text/${props.dialect}/${props.language}/${props.textKey}`,
        { cache: "no-store" }
    )

    if (!res.ok) throw new Error(res.status)

    text.value = await res.json()

  } catch (e) {
    console.error("info text fetch failed", e)
  }
}

/* 監聽參數變化 */

watch(
    () => [props.dialect, props.language, props.textKey],
    fetchText,
    { immediate: true }
)
</script>

<style scoped>

.info-text {
  font-size: var(--font-size-lg);
  line-height: 1.6;
}

</style>