<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UnifiedModal from '../Window/UnifiedModal.vue'
import PinyinResultTable from './PinyinResultTable.vue'
import questionIcon from '../../assets/icons/pinyin/question.svg'
import { formatRichText } from '../../utils/textFormatter.js'
import { selectPinyinPairs } from '../../utils/pinyinNotations.js'
import { useUserSettings } from '../../utils/userSettings.js'

const props = defineProps({
  initialPinyinBlock: { type: String, default: '' }
})
const visible = ref(false)
const route = useRoute()
const settings = useUserSettings()
const isTraditional = computed(() => route.params.language === 'tc')
const settingsRoute = computed(() => ({
  name: 'Settings',
  params: { language: route.params.language, dialect: route.params.dialect },
  hash: '#pronunciation-settings'
}))

function parsePinyinBlock(value) {
  const start = value.indexOf('▕')
  const end = value.indexOf('▏', start + 1)
  if (start < 0 || end < 0) return []
  return value.slice(start + 1, end).split('│').slice(1).map(part => {
    const fields = part.split('┆')
    const tagged = fields.length >= 3
    const rawValue = fields.slice(tagged ? 2 : 1).join('┆').trim()
    return {
      tag: tagged ? fields[0].trim() : '',
      label: fields[tagged ? 1 : 0]?.trim() || '',
      valueHtml: formatRichText(rawValue),
      valueItems: rawValue.split(/\s+/).filter(Boolean).map(item => formatRichText(item)),
      isIPA: /\[-[^\]]*\]/.test(rawValue)
    }
  }).filter(pair => pair.label && pair.valueItems.length)
}

const pairs = computed(() => selectPinyinPairs(parsePinyinBlock(props.initialPinyinBlock), settings))
</script>

<template>
  <button class="pinyin-help-button" type="button" aria-label="拼音说明" title="拼音说明" @click="visible = true">
    <img :src="questionIcon" alt="" aria-hidden="true">
  </button>
  <UnifiedModal v-model="visible" title="拼音说明" plain elevated :backdrop-blur="false">
    <p class="pinyin-help-notice">
      <template v-if="isTraditional">提示：所有綠色的拼音都可以點擊，點擊之後會看到不同種類的拼音版本。要個性化拼音版本，請轉到</template>
      <template v-else>提示：所有绿色的拼音都可以点击，点击之后会看到不同种类的拼音版本。要个性化拼音版本，请转到</template>
      <router-link :to="settingsRoute" @click="visible = false">{{ isTraditional ? '設置' : '设置' }}</router-link>。
    </p>
    <PinyinResultTable :pairs="pairs" appearance="plain" class="pinyin-help-result" />
  </UnifiedModal>
</template>

<style scoped>
.pinyin-help-button {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  padding: 4px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.pinyin-help-button img { display: block; width: 22px; height: 22px; }
.pinyin-help-button:focus-visible { outline: 2px solid #1e5721; outline-offset: 2px; }
.pinyin-help-notice {
  box-sizing: border-box;
  max-width: min(640px, calc(100vw - 48px));
  margin: 0;
  padding: 16px 18px;
  border-bottom: 1px solid #cbd2cd;
  color: #214d2c;
  background: #edf5e8;
  font-size: .95rem;
  font-weight: 600;
  line-height: 1.65;
  white-space: normal;
}
.pinyin-help-notice a { color: #1e5721; text-decoration: underline; text-underline-offset: 3px; }
.pinyin-help-result { width: 100%; }
</style>
