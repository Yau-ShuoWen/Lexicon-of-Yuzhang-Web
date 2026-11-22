<script setup>
import { ref } from 'vue'
import RichTextImageTextarea from '../../../components/Text/RichTextImageTextarea.vue'

const draft = ref('选中这段文字，松手后在上方添加或取消格式。\n已有格式：{b 加粗}、{i 斜体}、{d 删除线}。\n选中整行可以加标题。这里还有{h 大字}、{dot 着重号}与{code 代码条}。\n- 无序列表\n+ 有序列表')
const imagesEnabled = ref(false)
const images = ref({})
function onImageAdded(image) {
  const id = image?.publicId || image?.id
  if (id) images.value = { ...images.value, [id]: image }
}
</script>

<template>
  <main class="editor-lab">
    <h1>富文本编辑器试验</h1>
    <p>选中文字并松手，可在选区上方添加或取消格式；右键菜单按项显示。标题须选中整行。点击格式边界的内外两侧可选择后续输入的位置。格式标记只在下方原文显示。</p>
    <div class="editor-lab__options">
      <label><input v-model="imagesEnabled" type="checkbox" /> 启用图片</label>
    </div>
    <RichTextImageTextarea :key="imagesEnabled ? 'images' : 'text'" v-model="draft" :images-enabled="imagesEnabled" :local-images="true" :images="images" placeholder="富文本试验内容" @image-added="onImageAdded" />
    <section class="editor-lab__source" aria-label="富文本原文">
      <h2>富文本原文</h2>
      <textarea :value="draft" readonly rows="8" aria-label="富文本原文" />
    </section>
  </main>
</template>

<style scoped>
.editor-lab { box-sizing: border-box; max-width: 1040px; margin: 32px auto; padding: 0 24px 70px; color: var(--color-text); }
h1 { margin: 0 0 12px; font-size: 1.65rem; }
p { margin: 0 0 22px; color: var(--color-text-light); line-height: 1.6; }
.editor-lab__options { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 22px; margin-bottom: 20px; }
.editor-lab__options label { display: inline-flex; align-items: center; gap: 7px; }
.editor-lab__source { margin-top: 30px; }
h2 { margin: 0 0 10px; font-size: 1.05rem; }
.editor-lab__source textarea { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #cad8cc; border-radius: 6px; background: #f7f8f6; color: #252a31; font: 14px/1.55 monospace; resize: vertical; }
@media (max-width: 760px) { .editor-lab { margin: 20px auto; padding: 0 14px 50px; } }
</style>
