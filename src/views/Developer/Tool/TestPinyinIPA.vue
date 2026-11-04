<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import HorizontalTabs from '../../../components/Layout/HorizontalTabs.vue'
import RichText from '../../../components/Text/RichText.vue'

const route = useRoute()
const language = computed(() => String(route.params.language))
const dialect = computed(() => String(route.params.dialect))
const activeTab = ref('pinyin')
const draft = ref('这里用法{b 不同于}普通话。\n这个字读作[gon1]。')
const tabs = [
  { value: 'pinyin', label: '拼音与音标' },
  { value: 'inline', label: '文字格式' },
  { value: 'links', label: '链接与注解' },
  { value: 'blocks', label: '段落与列表' },
  { value: 'tables', label: '表格' },
  { value: 'try', label: '自己试写' },
]
const sections = {
  pinyin: {
    intro: '方括号用于拼音。显示结果会经过后端校对和转换，并受方言及用户设置影响。',
    examples: [
      ['方言拼音', '这个字读作[gon1]。', '会生成拼音区块，具体内容看用户设置。', true],
      ['音系外国际音标', '读音记为[-ɕyia42]。', '1–5 表示五度调值，$1–$5 表示变调。', true],
      ['汉语拼音', '普通话读作[+yi1]。'],
      ['自定义拼音', '读作[#sio45=siō]。'],
      ['其他拼音', '写作[/aoeiuü]。', '仅用于标注拼音性质的内容。', true],
    ],
    backend: true,
  },
  inline: {
    intro: '花括号中的标记名与正文之间要有空格。',
    examples: [
      ['粗体、斜体、删除线', '这里用法{b 不同于}普通话；{i 斜体}和{d 删除线}也可以用。'],
      ['原样显示标记', '请按{code Ctrl+F}查找；{code {b 这里不会加粗}}。'],
      ['标题、大字与着重点', '{h1 这一节的标题}\n正文中可以用{h 大字}和{dot 着重号}。'],
      ['跨行格式', '{b 第一行\n第二行}'],
    ],
  },
  links: {
    intro: '可见文字写在左边，=> 右边是实际跳转目标。',
    examples: [
      ['词语与汉字', '{c 南昌}、{c 豫章=>南昌}、{z 南}', '省略目标时，用可见文字作为目标。', true],
      ['站内与站外', '{l 返回首页=>/dict/home}\n{u 打开豫章词=>https://yuzhangci.com}\n{u https://yuzhangci.com}', 'u 可直接填写完整网址。', true],
      ['日记双链接', '{u 查看对话=>https://example.com/private||https://example.com/shared}', '|| 左边用于私人视角，右边用于亲友和公开视角；此处预览私人视角。', true],
      ['注解', '他话{n 原书注：说}什哩。'],
    ],
  },
  blocks: {
    intro: '列表和分隔线从行首开始写。普通换行会保留，连续空行形成段落间距。',
    examples: [
      ['无序与有序列表', '- 第一条\n- 第二条\n\n+ 第一项\n+ 第二项'],
      ['分隔线', '第一段\n------\n下一段'],
      ['引用区块', '```\n这是一段引用。\n也可以包含{b 富文本}。\n```'],
    ],
  },
  tables: {
    intro: '先按 Markdown 表格写法分列；列宽标记和单元格合并是扩展写法。',
    examples: [
      ['基础表格', '|名称|说明|\n|---|---|\n|苹果|红色|\n|香蕉|黄色|', '--- 列按内容宽度显示，不换行。', true],
      ['列宽扩展', '|短列|自动列|长列|\n|---|---+|---*|\n|甲|分配剩余空间|较长的固定宽度|', '---+ 分配剩余宽度；---* 使用较长固定宽度。', true],
      ['合并单元格', '|分类|名称|说明|\n|---|---|---+|\n|水果|苹果|红色|\n|#^|香蕉|黄色|\n|合并说明|#>|占两列|', '#> 向左合并，#^ 向上合并。', true],
      ['无表头表格', '|---|---|\n|名称|南昌|\n|说明|无表头|', '分隔行放在第一行。', true],
    ],
  },
}
const currentSection = computed(() => sections[activeTab.value])
</script>

<template>
  <main class="rich-text-guide">
    <header>
      <h1>富文本使用方法</h1>
    </header>
    <HorizontalTabs v-model="activeTab" :items="tabs" label="富文本语法分类" id-prefix="rich-text-guide" />
    <section v-if="currentSection" :id="`rich-text-guide-panel-${activeTab}`" :key="activeTab"
             role="tabpanel" :aria-labelledby="`rich-text-guide-tab-${activeTab}`" class="guide-content">
      <h2 class="guide-section-title">{{ tabs.find(tab => tab.value === activeTab)?.label }}</h2>
      <p class="guide-intro">{{ currentSection.intro }}</p>
      <div class="guide-document">
        <div class="guide-column-head" aria-hidden="true"><span>名称</span><span>写法</span><span>显示效果</span></div>
        <article v-for="example in currentSection.examples" :key="example[0]" class="guide-example">
          <div class="guide-name"><h3>{{ example[0] }}</h3><p v-if="example[3]">{{ example[2] }}</p></div>
          <pre>{{ example[1] }}</pre>
          <div class="guide-rendered">
            <RichText :model-value="example[1]" :language="language" :dialect="dialect"
                      :request-backend="!!currentSection.backend" plain />
          </div>
        </article>
      </div>
    </section>
    <section v-else id="rich-text-guide-panel-try" role="tabpanel" aria-labelledby="rich-text-guide-tab-try" class="guide-content">
      <h2 class="guide-section-title">自己试写</h2>
      <div class="guide-document">
        <div class="guide-column-head guide-column-head--try" aria-hidden="true"><span>写法</span><span>显示效果</span></div>
        <div class="guide-try">
          <textarea v-model="draft" aria-label="富文本输入" rows="12" />
          <div class="guide-rendered"><RichText :model-value="draft" :language="language" :dialect="dialect" plain /></div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.rich-text-guide { box-sizing: border-box; max-width: 1160px; margin: 32px auto; padding: 0 24px 72px; color: var(--color-text); }
header { margin-bottom: 22px; }
h1 { margin: 0; font-size: 1.65rem; }
.guide-content { padding-top: 28px; }
.guide-section-title { margin: 0 0 6px; font-size: 1.28rem; }
.guide-intro { margin: 0 0 22px; color: var(--color-text-light); line-height: 1.7; }
.guide-document { overflow: hidden; border: 1px solid var(--color-border); border-radius: 10px; background: #fff; }
.guide-column-head, .guide-example { display: grid; grid-template-columns: minmax(120px, 19%) repeat(2, minmax(0, 1fr)); }
.guide-column-head--try, .guide-try { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.guide-column-head { border-bottom: 1px solid var(--color-border); background: var(--color-background-alt); color: var(--color-text-light); font-size: .88rem; font-weight: 600; }
.guide-column-head span { padding: 11px 20px; }
.guide-column-head span + span, .guide-example pre, .guide-rendered { border-left: 1px solid var(--color-border); }
.guide-example + .guide-example { border-top: 1px solid var(--color-border); }
.guide-name { padding: 16px 20px; }
.guide-name h3 { margin: 0; font-size: .98rem; font-weight: 650; }
.guide-name p { margin: 7px 0 0; color: var(--color-text-light); font-size: .82rem; line-height: 1.5; }
pre, .guide-rendered, textarea { box-sizing: border-box; width: 100%; min-width: 0; min-height: 72px; margin: 0; padding: 11px 20px 19px; line-height: 1.7; }
pre { overflow-x: auto; background: var(--color-background-alt); font-family: ui-monospace, Consolas, monospace; font-size: .9rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.guide-rendered { overflow-x: auto; background: #fff; }
textarea { display: block; min-height: 320px; border: 0; resize: vertical; background: var(--color-background-alt); color: var(--color-text); font: inherit; }
.guide-try .guide-rendered { min-height: 320px; }
@media (max-width: 700px) {
  .rich-text-guide { margin-top: 22px; padding-inline: 16px; }
  .guide-column-head { display: none; }
  .guide-example, .guide-try { grid-template-columns: 1fr; }
  .guide-example pre { border-top: 1px solid var(--color-border); border-left: 0; }
  .guide-rendered { border-top: 1px solid var(--color-border); border-left: 0; }
  .guide-name { padding: 13px 20px; }
  pre::before, .guide-rendered::before { display: block; margin-bottom: 6px; color: var(--color-text-light); font-family: inherit; font-size: .8rem; font-weight: 600; content: '写法'; }
  .guide-rendered::before { content: '显示效果'; }
}
</style>
