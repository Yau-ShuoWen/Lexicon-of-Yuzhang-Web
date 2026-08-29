<script setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import TextDiffEditor from '../../../components/Compare/TextDiffEditor.vue'

const sourceText = ref('')
const targetText = ref('')

useHead({
  title: '字符串差异工具'
})

function loadExample() {
  sourceText.value = '今天去了上海，见了张三，谈了项目 A。\n晚上看了电影。'
  targetText.value = '今天去了上海，见了朋友，谈了项目 A。'
}

function clearTexts() {
  sourceText.value = ''
  targetText.value = ''
}
</script>

<template>
  <div class="broaden-layout text-diff-tool-page">
<!--    <div class="text-diff-tool-page__header">-->
<!--      <div>-->
<!--        <div class="text-diff-tool-page__eyebrow">DEVELOPER TOOL / TEXT DIFF</div>-->
<!--        <h2>字符串差异工具</h2>-->
<!--        <p>比较两个版本，在差异位置快速将左侧修改应用到右侧。</p>-->
<!--      </div>-->
<!--      <div class="text-diff-tool-page__actions">-->
<!--        <button class="dev-normal-button dev-btn-small" @click="loadExample">填入示例</button>-->
<!--        <button class="dev-normal-button dev-btn-small" @click="clearTexts">清空</button>-->
<!--      </div>-->
<!--    </div>-->

    <TextDiffEditor
      v-model:source="sourceText"
      v-model:target="targetText"
      source-label="主版本"
      target-label="公开版本"
    />
  </div>
</template>

<style scoped>
.text-diff-tool-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1440px;
  padding-top: 32px;
}

.text-diff-tool-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.text-diff-tool-page__eyebrow {
  margin-bottom: 7px;
  color: #6e7885;
  font: 0.68rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.12em;
}

.text-diff-tool-page h2 {
  margin: 0 0 7px;
  color: #252c35;
  font-size: clamp(1.35rem, 2vw, 1.8rem);
}

.text-diff-tool-page p {
  margin: 0;
  color: #6d7480;
  font-size: 0.88rem;
}

.text-diff-tool-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

@media (max-width: 768px) {
  .text-diff-tool-page {
    padding-top: 24px;
  }

  .text-diff-tool-page__header {
    flex-direction: column;
  }

  .text-diff-tool-page__actions {
    padding-top: 0;
  }
}
</style>
