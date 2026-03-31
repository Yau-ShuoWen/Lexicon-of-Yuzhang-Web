<script setup>

import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PinyinProofreadText from "../../../components/Text/PinyinProofreadText.vue";
import { showError, showSuccess } from "../../../services/ToastService.js";

const route = useRoute()
const router = useRouter()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const createData = ref({
  text: {sc: '', tc: ''},
  pinyin: ''
})

const submit = async () => {
  try {
    const res = await fetch(`/api/edit/hanzi/create/${dialect.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createData.value)
    })

    const data = await res.json()

    if (data.success) showSuccess("提交成功")
    else showError("提交失敗：" + data.message)

  } catch (e) {
    showError("請求失敗" + e.message)
  }
}
</script>

<template>
  <div class="narrow-layout">
    <h3>读音</h3>

    <PinyinProofreadText :dialect="dialect.toString()" v-model="createData.pinyin"/>


    <ScAndTcText v-model:traditionalText="createData.text.tc" v-model:simplifiedText="createData.text.sc"
                 :layout="'middle'" :dialect="dialect.toString()"/>

    <button @click="submit" class="dev-add-btn dev-btn-small">提交</button>

  </div>

</template>

<style>

</style>