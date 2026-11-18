<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { request } from '../../services/request.js'
import { yswColumnsSeed } from './yswColumnsSeed.js'

const { t, locale } = useI18n()
const language = computed(() => locale.value === 'tc' ? 'tc' : 'sc')
const document = ref(structuredClone(yswColumnsSeed))
const draft = ref(null)
const editing = ref(false)
const saving = ref(false)
const error = ref('')
const shown = pair => pair?.[language.value] || ''

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
      <h1>{{ shown(document.title) }}</h1>
      <p>{{ shown(document.quote) }}</p>
      <small>{{ document.subtitle }}</small>
      <button v-if="!editing" type="button" class="edit-button" @click="beginEdit">{{ t('ysw_columns.edit') }}</button>
    </header>

    <p v-if="error" class="columns-error" role="alert">{{ error }}</p>

    <form v-if="editing" class="columns-editor" @submit.prevent="save">
      <div class="editor-actions"><button type="button" @click="editing = false">{{ t('common.cancel') }}</button><button type="submit" :disabled="saving">{{ t('common.save') }}</button></div>
      <div v-for="field in ['title', 'quote']" :key="field" class="editor-field"><strong>{{ t(`ysw_columns.${field}`) }}</strong><label v-for="lang in ['sc', 'tc']" :key="lang">{{ t(`ysw_columns.${lang}`) }}<textarea v-model="draft[field][lang]" required rows="2" /></label></div>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14.5a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 4 19.5Z"/><path d="M5.5 18A1.5 1.5 0 0 0 4 19.5 1.5 1.5 0 0 0 5.5 21H20M8 7h8"/></svg>
            <a :href="project.url" target="_blank" rel="noopener noreferrer">{{ shown(project.name) }}</a>
            <span class="external-icon" aria-hidden="true" />
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
.columns-intro { margin-bottom: 46px; }
.columns-intro h1 { margin: 0 0 13px; font-size: 29px; font-weight: 650; }
.columns-intro p { margin: 0; color: var(--color-text-light); font-size: 15px; line-height: 1.7; }
.columns-intro small { display: block; margin-top: 2px; color: var(--color-text-light); font-size: 12px; opacity: .7; }
.edit-button { margin-top: 16px; padding: 7px 12px; border: 1px solid #b7cdbb; border-radius: 6px; background: var(--color-background); color: #216e3a; cursor: pointer; }
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
.project-group h2 { margin: 0 0 16px; padding-bottom: 10px; border-bottom: 1px solid #dce5dc; font-size: 19px; font-weight: 650; }
.project-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.project-card { display: flex; flex-direction: column; min-height: 138px; padding: 21px 23px; border: 1px solid #d1ddd3; border-radius: 8px; background: var(--color-background); }
.project-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
.project-top svg { flex: none; width: 19px; height: 19px; color: #64736a; }
.project-top a { min-width: 0; color: #216e3a; font-size: 18px; font-weight: 600; text-decoration: none; }
.project-top a:hover { text-decoration: underline; }
.project-top .external-icon { flex: none; width: 15px; height: 15px; background: currentColor; opacity: .7; -webkit-mask: url('../../assets/icons/外链.svg') center / contain no-repeat; mask: url('../../assets/icons/外链.svg') center / contain no-repeat; }
.project-note { margin: 15px 0 14px; line-height: 1.65; }
.project-repo { margin-top: auto; color: var(--color-text-light); font-size: 12px; overflow-wrap: anywhere; }
@media (max-width: 700px) { .columns-page { padding: 28px 18px 56px; } .project-grid { grid-template-columns: 1fr; } .project-card { min-height: 120px; } .editor-field { grid-template-columns: 1fr; } .editor-url { margin-left: 0; } }
</style>
