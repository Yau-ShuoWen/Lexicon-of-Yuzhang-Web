<script setup>

import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PinyinProofreadText from "../../../components/Text/PinyinProofreadText.vue";

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

    if (data.success) {
      alert("提交成功")
      // 可以選擇跳轉
      // router.push(...)
    } else {
      alert("失敗：" + data.message)
    }
  } catch (e) {
    console.error(e)
    alert("請求錯誤")
  }
}
</script>

<template>

  <ScAndTcText v-model:traditionalText="createData.text.tc"
               v-model:simplifiedText="createData.text.sc"
               :layout="'large'" :dialect="dialect.toString()"
  />

  <PinyinProofreadText :dialect="dialect.toString()"
                       v-model="createData.pinyin"
  />

  <button @click="submit" class="dev-add-btn dev-btn-small">提交</button>

</template>

<style scoped>

</style>