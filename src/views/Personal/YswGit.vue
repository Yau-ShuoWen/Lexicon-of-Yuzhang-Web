<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { request } from '../../services/request.js'
import { yswGitSeed } from './yswGitSeed.js'
import writingIcon from '../../assets/书写.svg'

const { t } = useI18n()
const route = useRoute()
const language = computed(() => route.params.language === 'tc' ? 'tc' : 'sc')
const document = ref(structuredClone(yswGitSeed))
const draft = ref(null)
const editing = ref(false)
const saving = ref(false)
const error = ref('')
const shown = pair => pair?.[language.value] || ''
const headingItems = computed(() => language.value === 'tc' ? [
  { prefix: '一個', term: '譜絡格藍貓兒🐱', english: 'n. programmer', chinese: '程式設計師' },
  { prefix: '正在', term: '譜絡格欖茗🍵', english: 'v. programming', chinese: '程式設計' },
  { prefix: '著一個', term: '譜絡格欄目💻', english: 'n. program', chinese: '應用程式' }
] : [
  { prefix: '一个', term: '谱络格蓝猫儿🐱', english: 'n. programmer', chinese: '程序员' },
  { prefix: '正在', term: '谱络格榄茗🍵', english: 'v. programming', chinese: '编程' },
  { prefix: '着一个', term: '谱络格栏目💻', english: 'n. program', chinese: '应用程序' }
])

onMounted(async () => {
  try {
    const stored = await request('/api/personal/columns')
    if (stored) document.value = stored
  } catch (e) { error.value = e.message }
})

function beginEdit() {
  draft.value = JSON.parse(JSON.stringify(document.value))
  editing.value = true
  error.value = ''
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await request('/api/edit/ysw-columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.value)
    })
    document.value = JSON.parse(JSON.stringify(draft.value))
    editing.value = false
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}
</script>

<template>
  <div class="columns-page">
    <header class="columns-intro">
      <h1 class="columns-intro__heading">
        <span v-for="item in headingItems" :key="item.term" class="columns-intro__unit">
          <span class="columns-intro__prefix">{{ item.prefix }}</span><u>{{ item.term }}</u>
          <span class="columns-intro__note"><b>{{ item.english }}</b><span>{{ item.chinese }}</span></span>
        </span>
      </h1>
      <button v-if="!editing" type="button" class="edit-button" @click="beginEdit"><img :src="writingIcon" alt="" />{{ t('ysw_columns.edit') }}</button>
    </header>

    <p v-if="error" class="columns-error" role="alert">{{ error }}</p>

    <form v-if="editing" class="columns-editor" @submit.prevent="save">
      <div class="editor-actions"><button type="button" @click="editing = false">{{ t('common.cancel') }}</button><button type="submit" :disabled="saving">{{ t('common.save') }}</button></div>
      <div v-for="group in draft.groups" :key="group.id" class="editor-group">
        <div class="editor-field"><strong>{{ t('ysw_columns.group') }}</strong><label v-for="lang in ['sc', 'tc']" :key="lang">{{ t(`ysw_columns.${lang}`) }}<input v-model="group.title[lang]" required /></label></div>
        <div v-for="project in group.projects" :key="project.id" class="editor-project">
          <strong>{{ project.repo }}</strong>
          <div v-for="field in ['name', 'note']" :key="field" class="editor-field"><span>{{ t(`ysw_columns.${field}`) }}</span><label v-for="lang in ['sc', 'tc']" :key="lang">{{ t(`ysw_columns.${lang}`) }}<textarea v-model="project[field][lang]" required rows="2" /></label></div>
          <label class="editor-url">{{ t('ysw_columns.url') }}<input v-model="project.url" required type="url" /></label>
        </div>
      </div>
    </form>

    <section v-for="group in document.groups" :key="group.id" class="project-group">
      <h2>{{ shown(group.title) }}</h2>
      <div class="project-grid">
        <article v-for="project in group.projects" :key="project.id" class="project-card">
          <div class="project-top">
            <a :href="project.url" target="_blank" rel="noopener noreferrer" class="project-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14.5a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 4 19.5 1.5 1.5 0 0 0 5.5 21H20M8 7h8"/></svg>
              <span class="project-link__label"><span>{{ shown(project.name) }}</span><span class="external-icon" aria-hidden="true" /></span>
            </a>
          </div>
          <p class="project-note">{{ shown(project.note) }}</p>
          <span class="project-repo">{{ project.repo }}</span>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.columns-page { box-sizing: border-box; width: min(1160px, 100%); margin: 0 auto; padding: 38px 28px 80px; color: var(--color-text); }
.columns-intro { position: relative; margin-bottom: 46px; padding-right: 96px; }
.columns-intro__heading { display: flex; flex-wrap: wrap; column-gap: 0; row-gap: 14px; margin: 0; color: #216e3a; font-size: clamp(18px, 2.2vw, 25px); font-weight: 600; line-height: 1.7; }
.columns-intro__unit { display: inline-grid; grid-template-columns: auto auto; grid-template-rows: auto auto; white-space: nowrap; }
.columns-intro__prefix { grid-column: 1; grid-row: 1; }
.columns-intro__unit > u { grid-column: 2; grid-row: 1; text-decoration-thickness: 1px; text-underline-offset: 5px; }
.columns-intro__note { display: flex; grid-column: 2; grid-row: 2; flex-direction: column; justify-self: start; color: var(--color-text); font-weight: 400; line-height: 1.5; text-align: left; }
.columns-intro__note b { font-size: 14px; font-weight: 600; }
.columns-intro__note > span { color: var(--color-text-light); font-size: 13px; }
.edit-button { position: absolute; top: 0; right: 0; display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1px solid #b7cdbb; border-radius: 6px; background: var(--color-background); color: #216e3a; cursor: pointer; }
.edit-button img { width: 17px; height: 17px; }
.columns-error { color: #a52a2a; }
.columns-editor { margin-bottom: 38px; padding: 20px; border: 1px solid #d1ddd3; border-radius: 8px; background: var(--color-background); }
.editor-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 18px; }
.editor-actions button { padding: 7px 14px; border: 1px solid #b7cdbb; border-radius: 6px; background: var(--color-background); color: var(--color-text); cursor: pointer; }
.editor-actions button[type="submit"] { background: #216e3a; color: white; }
.editor-actions button:disabled { opacity: .5; cursor: default; }
.editor-field { display: grid; grid-template-columns: 110px repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; margin: 12px 0; }
.editor-field > strong, .editor-field > span { padding-top: 8px; }
.editor-field label, .editor-url { display: flex; flex-direction: column; gap: 5px; font-size: 13px; }
.editor-field textarea, .editor-field input, .editor-url input { box-sizing: border-box; width: 100%; padding: 8px; border: 1px solid #c6d5c9; border-radius: 5px; background: var(--color-background); color: var(--color-text); font: inherit; }
.editor-field textarea { resize: vertical; }
.editor-group { margin-top: 24px; padding-top: 12px; border-top: 1px solid #dce5dc; }
.editor-project { margin: 18px 0 18px 16px; }
.editor-url { margin-left: 122px; }
.project-group + .project-group { margin-top: 42px; }
.project-group h2 { margin: 0 0 20px; padding-bottom: 11px; border-bottom: 2px solid #a8c9ae; color: #245d32; font-size: 22px; font-weight: 700; }
.project-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.project-card { display: flex; flex-direction: column; min-height: 138px; padding: 21px 23px; border: 1px solid #d1ddd3; border-radius: 8px; background: var(--color-background); }
.project-top { min-width: 0; }
.project-link { display: inline-flex; align-items: center; gap: 10px; max-width: 100%; color: #216e3a; font-size: 21px; font-weight: 600; line-height: 1.3; text-decoration: none; }
.project-link__label { position: relative; display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
.project-link__label::after { position: absolute; right: 0; bottom: 0; left: 0; height: 1px; background: currentColor; content: ''; opacity: 0; }
.project-link:hover .project-link__label::after, .project-link:focus-visible .project-link__label::after { opacity: 1; }
.project-link svg { flex: none; width: 21px; height: 21px; color: #64736a; }
.project-link__label > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.project-link .external-icon { flex: none; width: 15px; height: 15px; background: currentColor; opacity: .7; -webkit-mask: url('../../assets/icons/外链.svg') center / contain no-repeat; mask: url('../../assets/icons/外链.svg') center / contain no-repeat; }
.project-note { margin: 15px 0 14px; color: var(--color-text-light); line-height: 1.65; }
.project-repo { align-self: flex-start; margin-top: auto; padding: 4px 10px; border: 1px solid #d5e3d7; border-radius: 999px; background: #f1f6f1; color: #536d59; font-family: Consolas, 'Courier New', monospace; font-size: 12px; overflow-wrap: anywhere; }
@media (max-width: 700px) { .columns-page { padding: 28px 18px 56px; } .columns-intro { padding-right: 0; } .edit-button { position: static; margin-top: 18px; } .project-grid { grid-template-columns: 1fr; } .project-card { min-height: 120px; } .editor-field { grid-template-columns: 1fr; } .editor-url { margin-left: 0; } }
</style>
