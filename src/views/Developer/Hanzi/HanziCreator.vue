<!-- src/views/Developer/Hanzi/HanziCreator.vue -->

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
  pinyin: ''
})

const searchPinyin = ref('')
const characterList = ref([])

const searchCharacter = async () => {
  if (!searchPinyin.value.trim()) return

  characterList.value = null

  try {
    const res = await fetch(`/api/edit/hanzi/get-character/${dialect.value}?pinyin=${encodeURIComponent(searchPinyin.value)}`)

    characterList.value = await res.json()
  } catch (e) {
    showError("查询失败：" + e.message)
  }
}

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
    else showError("提交失败：" + data.message)

  } catch (e) {
    showError("请求失败" + e.message)
  }
}
</script>

<template>
  <div class="narrow-layout">

    <div class="form-section">
      <h3 class="section-header">添加漢字 / 批量添加同音字</h3>

      <div class="horizontal-group">
        <input v-model="createData.pinyin" class="form-control small-input" placeholder="輸入拼音">

        <RichText :dialect="dialect.toString()" :language="language.toString()"
                  :model-value="createData.pinyin" :allPinyin="true" class="small-input"/>
      </div>

      <ScAndTcText
          v-model:traditionalText="createData.text.tc"
          v-model:simplifiedText="createData.text.sc"
          :layout="'middle'"
          :dialect="dialect.toString()"
      />

      <button @click="submit" class="dev-add-btn dev-btn-small">提交</button>

    </div>


    <div class="form-section">
      <h3 class="section-header">普通话同音字查询</h3>


      <input
          v-model="searchPinyin"
          @keydown.enter.prevent="searchCharacter"
          placeholder="漢語拼音"
          class="form-control small-input"
      />


      <ul v-if="characterList.length">
        <li v-for="(char, index) in characterList" :key="index" v-formatted-text="char"/>
      </ul>

    </div>


  </div>
</template>

<style>
</style>