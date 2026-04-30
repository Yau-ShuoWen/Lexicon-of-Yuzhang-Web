<!-- src/views/Developer/Ciyu/CiyuCreator.vue -->

<script setup>

import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showError, showSuccess } from "../../../services/ToastService.js";
import RichText from "../../../components/Text/RichText.vue";

const route = useRoute()
const router = useRouter()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const createData = ref({
  text: {sc: '', tc: ''},
  pys: ''
})

const submit = async () => {
  try {
    const res = await fetch(`/api/edit/ciyu/create/${dialect.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createData.value)
    })

    const data = await res.json()

    if (data.success) showSuccess("提交成功")
    else showError("提交失败：" + data.message)

  } catch (e) {
    showError("请求失败" + e.message)
  }
}
</script>

<template>
  <div class="middle-layout">

    <div class="form-section">
      <h3 class="section-header">批量添加词语</h3>

      <ScAndTcText
          v-model:traditionalText="createData.text.tc"
          v-model:simplifiedText="createData.text.sc"
          :layout="'large'"
          :dialect="dialect.toString()"
      />

      <div class="horizontal-group">
        <textarea v-model="createData.pys" class="form-control" placeholder="輸入拼音"/>

        <RichText :dialect="dialect.toString()" :language="language.toString()"
                  :model-value="createData.pys" :allPinyin="true" />
      </div>

      <button @click="submit" class="dev-add-btn dev-btn-small">提交</button>

    </div>

  </div>
</template>

<style scoped>

</style>