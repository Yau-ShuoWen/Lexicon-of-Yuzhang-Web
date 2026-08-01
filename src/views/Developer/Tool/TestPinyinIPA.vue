<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatRichText } from "../../../utils/textFormatter.js";
import RichText from "../../../components/Text/RichText.vue";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";

const tc=ref('');
const sc=ref('')

const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 拼音块测试数据
const pinyinBlockTest = `東曰永和門，一曰澹臺，舊名壇頭 ▕tan4▕tan0▕meen4 / [t'an_˧˥]│《南昌方言词典》┆[t'an_˧˥]│印刷和书写┆[tɑ̄n]│键盘输入┆[tɑn4]▏[·t'an_]│《南昌方言词典》┆[·t'an_]│印刷和书写┆[tɑn]│键盘输入┆[tɑn0]▏[mɨn_˧˥]│《南昌方言词典》┆[mɨn_˧˥]│印刷和书写┆[mẹ̄n]│键盘输入┆[meen4]▏`
const pinyinBlockHtml = formatRichText(pinyinBlockTest)
</script>

<template>
  <div class="container">

    <div class="card">
      <div class="card-body">
        <ScAndTcText v-model:traditionalText="tc" v-model:simplifiedText="sc"
                     :layout="'large'" :dialect="dialect.toString()"/>
        <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                  :model-value="tc"/>
        <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                  :model-value="sc"/>
      </div>
    </div>

    <div class="card" style="margin-top: 20px">
      <div class="card-header"><b>拼音块测试</b></div>
      <div v-formatted-text="pinyinBlockTest"></div>
<!--      <div class="card-body">-->
<!--        <div><b>原始文本：</b></div>-->
<!--        <div style="padding: 8px 12px; background: #f5f5f5; border-radius: 4px; font-family: monospace; word-break: break-all; margin-bottom: 12px;">-->
<!--          {{ pinyinBlockTest }}-->
<!--        </div>-->
<!--        <div><b>渲染效果：</b></div>-->
<!--        <div style="padding: 12px 16px; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; line-height: 1.8; font-size: 1.05rem;">-->
<!--          <span v-html="pinyinBlockHtml"></span>-->
<!--        </div>-->
<!--        <div style="margin-top: 10px; color: #888; font-size: 0.88em;">-->
<!--          💡 点击蓝色拼音标签查看详情，移动端长按可复制内容-->
<!--        </div>-->
<!--      </div>-->
    </div>

  </div>
</template>

<style/>
