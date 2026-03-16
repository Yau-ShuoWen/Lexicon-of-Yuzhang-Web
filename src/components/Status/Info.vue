<template>
  <div class="info-wrapper">

    <button
        ref="buttonRef"
        type="button"
        class="btn btn-settings"
        :class="{ active: visible }"
        @click.stop="toggle"
    >
      <img src="../../assets/icons/information.svg" alt="信息" class="control-icon"/>
    </button>

    <div
        v-if="visible"
        ref="popupRef"
        class="info-popup"
        v-html="formattedText"
    ></div>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from "vue"
import { formatRichText } from "../../utils/textFormatter"

const props = defineProps({
  dialect: { type: String, required: true },
  language: { type: String, required: true },
  textKey: { type: String, required: true }
})

const visible = ref(false)
const text = ref("")

const buttonRef = ref(null)
const popupRef = ref(null)

/* ---------- formatted text ---------- */

const formattedText = computed(() => {return formatRichText(text.value)})

/* ---------- fetch ---------- */

async function fetchText() {
  try {

    text.value = ""

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

/* ---------- toggle ---------- */

async function toggle() {

  if (visible.value) {
    visible.value = false
    return
  }

  await fetchText()
  visible.value = true
}

/* ---------- click outside ---------- */

function handleClickOutside(e) {

  const btn = buttonRef.value
  const popup = popupRef.value

  if (!btn) return

  const clickOnButton = btn.contains(e.target)
  const clickOnPopup = popup && popup.contains(e.target)

  if (!clickOnButton && !clickOnPopup) {
    visible.value = false
  }

}

onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside)
})
</script>

<style scoped>

.info-wrapper {
  position: relative;
  display: inline-block;

}

.info-popup {
  position: absolute;

  top: 36px;
  left: 0;

  min-width: 260px;
  max-width: 420px;

  padding: 12px 14px;

  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);

  box-shadow: 0 6px 18px rgba(0,0,0,0.12);

  z-index: 1000;

  font-size: var(--font-size-base);
  line-height: 1.6;
}

</style>