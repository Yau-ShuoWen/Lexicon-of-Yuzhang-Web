<script setup>
import { computed, reactive, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { getUserSettings, saveUserSettings } from '../../utils/userSettings.js'
import BackButton from '../../components/Button/BackButton.vue'
import languageIcon from '../../assets/icons/LanguageAndDialect/transfer_sc_tc.svg'
import pronunciationIcon from '../../assets/icons/mode.svg'
import soundIcon from '../../assets/icons/audio.svg'
import calendarIcon from '../../assets/icons/calendar/book.svg'
import bookmarkIcon from '../../assets/icons/calendar/bookmark.svg'
import scIcon from '../../assets/icons/LanguageAndDialect/sc.svg'
import tcIcon from '../../assets/icons/LanguageAndDialect/tc.svg'
import pinyinIcon from '../../assets/icons/settings/pinyin.svg'
import zhuyinIcon from '../../assets/icons/settings/zhuyin.svg'

const settings = reactive(getUserSettings())

useHead({title: '设置｜豫章词'})

const languageOptions = [
  {value: 'sc', label: '简体中文', preview: '方言是我们听得见的历史', icons: [scIcon]},
  {value: 'tc', label: '繁體中文', preview: '方言是我們聽得見的歷史', icons: [tcIcon]}
]

const mandarinOptions = [
  {value: 'pinyin', label: '汉语拼音', preview: 'yù zhāng', icons: [pinyinIcon]},
  {value: 'zhuyin', label: '注音符号', preview: 'ㄩˋ ㄓㄤ', icons: [zhuyinIcon]},
  {value: 'parallel', label: '并列', preview: 'yù zhāng / ㄩˋ ㄓㄤ', icons: [pinyinIcon, zhuyinIcon]}
]

const dialectOptions = [
  {value: 'mandarinApproximation', label: '读起来像普通话的', note: '普通话的拟音', preview: '[lān→ còng↘]'},
  {value: 'standard', label: '标准写法', preview: '[lān còng]'},
  {value: 'keyboard', label: '键盘输入', preview: '[lan4 cong1]'},
  {value: 'dictionaryIpa', label: '本词典使用 IPA', preview: "[lan_˧˥] [ts'ɔŋ_˦˨]"},
  {value: 'alternate', label: '其他版拼音', note: '如果有', preview: '[lān] [ceòng]'},
  {value: 'referenceIpa', label: '辞书对应版本 IPA', note: '如果有', preview: "[lan_˦˦˦] [ts'ɔŋ_˦˨]"}
]

const weekdayOptions = [
  {value: 'weekday', label: '星期', preview: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'], icons: [calendarIcon]},
  {value: 'youbi', label: '曜日', preview: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'], icons: [bookmarkIcon]}
]

const todayIndex = (new Date().getDay() + 6) % 7
const todayPreview = computed(() => weekdayOptions.find(item => item.value === settings.weekdayStyle).preview[todayIndex])
const selectedDialectOptions = computed(() => {
  const selected = new Set(settings.dialectNotations)
  const options = dialectOptions.filter(item => selected.has(item.value))
  return options.sort((a, b) => {
    if (a.value === settings.pinnedDialectNotation) return -1
    if (b.value === settings.pinnedDialectNotation) return 1
    return 0
  })
})

watch(settings, value => saveUserSettings({...value, dialectNotations: [...value.dialectNotations]}), {deep: true})

function toggleDialectNotation(value) {
  const index = settings.dialectNotations.indexOf(value)
  if (index >= 0) {
    if (settings.dialectNotations.length === 1) return
    settings.dialectNotations.splice(index, 1)
    if (settings.pinnedDialectNotation === value) {
      settings.pinnedDialectNotation = selectedDialectOptions.value[0]?.value || dialectOptions[0].value
    }
  } else {
    settings.dialectNotations.push(value)
  }
}
</script>

<template>
  <main class="settings-page">
    <header class="settings-header">
      <BackButton class="back-button"/>
      <div>
        <h1>设置</h1>
      </div>
    </header>

    <div class="settings-panel">
    <section class="setting-section split-setting">
      <div class="setting-heading">
        <span class="heading-icon"><img :src="languageIcon" alt=""></span>
        <h2>语言</h2>
      </div>
      <div class="split-content">
        <div class="large-options">
          <label v-for="option in languageOptions" :key="option.value" class="large-option" :class="{selected: settings.languageStyle === option.value}">
            <input v-model="settings.languageStyle" type="radio" name="language-style" :value="option.value">
            <span class="choice-icons"><img v-for="icon in option.icons" :key="icon" :src="icon" alt=""></span>
            <strong>{{ option.label }}</strong>
          </label>
        </div>
        <div class="single-preview"><strong>{{ languageOptions.find(item => item.value === settings.languageStyle).preview }}</strong></div>
      </div>
    </section>

    <section class="setting-section split-setting">
      <div class="setting-heading">
        <span class="heading-icon"><img :src="pronunciationIcon" alt=""></span>
        <h2>普通话标注读音</h2>
      </div>
      <div class="split-content">
        <div class="large-options large-options--three">
          <label v-for="option in mandarinOptions" :key="option.value" class="large-option" :class="{selected: settings.mandarinNotation === option.value}">
            <input v-model="settings.mandarinNotation" type="radio" name="mandarin-notation" :value="option.value">
            <span class="choice-icons"><img v-for="icon in option.icons" :key="icon" :src="icon" alt=""></span>
            <strong>{{ option.label }}</strong>
          </label>
        </div>
        <div class="single-preview"><strong class="phonetic">{{ mandarinOptions.find(item => item.value === settings.mandarinNotation).preview }}</strong></div>
      </div>
    </section>

    <section class="setting-section">
      <div class="setting-heading">
        <span class="heading-mark">音</span>
        <h2>方言拼音框</h2>
      </div>
      <div class="dialect-layout">
        <div class="dialect-options">
          <div v-for="option in dialectOptions" :key="option.value" class="dialect-option" :class="{disabled: !settings.dialectNotations.includes(option.value)}">
            <label class="check-label">
              <input type="checkbox" :checked="settings.dialectNotations.includes(option.value)" @change="toggleDialectNotation(option.value)">
              <span><strong>{{ option.label }}</strong><small v-if="option.note">（{{ option.note }}）</small></span>
            </label>
            <label class="pin-label">
              <input v-model="settings.pinnedDialectNotation" type="radio" name="pinned-dialect" :value="option.value" :disabled="!settings.dialectNotations.includes(option.value)">
              <svg class="pin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3.2 20.8 9.5l-2 2-1.1-1.1-3.5 4.9.7.7-1.6 1.6-3.1-3.1-5.4 5.4-.8-.8 5.4-5.4-3.1-3.1L7.9 9l.8.8 4.9-3.5-1.1-1.1z"/></svg>
              <span class="pin-text">置顶</span>
            </label>
          </div>
        </div>
        <div class="pinyin-preview" aria-label="方言拼音框预览">
          <div v-for="option in selectedDialectOptions" :key="option.value" class="preview-row" :class="{pinned: settings.pinnedDialectNotation === option.value}">
            <span>{{ option.label }}</span><strong v-formatted-text="option.preview"/>
          </div>
        </div>
      </div>
    </section>

    <section class="setting-section setting-section--compact">
      <div class="setting-heading">
        <span class="heading-icon"><img :src="soundIcon" alt=""></span>
        <h2>音效</h2>
      </div>
      <label class="pill-switch">
        <input v-model="settings.soundEnabled" type="checkbox">
        <span class="switch-track"><span class="switch-thumb"></span></span>
        <strong>{{ settings.soundEnabled ? '开启' : '关闭' }}</strong>
      </label>
    </section>

    <section class="setting-section split-setting calendar-setting">
      <div class="setting-heading">
        <span class="heading-icon"><img :src="calendarIcon" alt=""></span>
        <h2>日历称呼</h2>
      </div>
      <div class="split-content">
        <div class="large-options">
          <label v-for="option in weekdayOptions" :key="option.value" class="large-option" :class="{selected: settings.weekdayStyle === option.value}">
            <input v-model="settings.weekdayStyle" type="radio" name="weekday-style" :value="option.value">
            <span class="choice-icons"><img v-for="icon in option.icons" :key="icon" :src="icon" alt=""></span>
            <strong>{{ option.label }}</strong>
          </label>
        </div>
        <div class="single-preview today-preview"><strong>{{ todayPreview }}</strong></div>
      </div>
    </section>
    </div>
  </main>
</template>

<style scoped>
.settings-page { width:min(920px, calc(100% - 32px)); margin:0 auto; padding:40px 0 72px; color:var(--color-text); }
.settings-header { display:flex; align-items:center; gap:16px; margin-bottom:18px; }
.settings-header h1 { margin:0; color:#24522c; font-size:clamp(1.8rem, 4vw, 2.5rem); }
.back-button { flex:0 0 auto; }
.settings-panel { overflow:hidden; border:1px solid #d6e1d8; border-radius:18px; background:rgba(255,255,255,.92); box-shadow:0 10px 32px rgba(42,85,52,.07); }
.setting-section { padding:22px 26px; }
.setting-section + .setting-section { border-top:2px solid #dfe8e1; }
.setting-heading { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.setting-heading h2 { margin:0; font-size:1.16rem; }
.heading-icon,.heading-mark { display:grid; place-items:center; width:40px; height:40px; flex:0 0 40px; border-radius:11px; background:#eef7ef; color:var(--color-primary); font-weight:800; }
.heading-icon img { width:23px; height:23px; object-fit:contain; }
.split-content { display:grid; grid-template-columns:minmax(0,2fr) minmax(190px,1fr); gap:24px; align-items:stretch; }
.large-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; padding:6px; border-radius:999px; background:#edf2ee; }
.large-options--three { grid-template-columns:repeat(3,minmax(0,1fr)); }
.large-option { position:relative; display:flex; align-items:center; justify-content:center; gap:10px; min-height:54px; padding:8px 14px; border-radius:999px; cursor:pointer; transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease; }
.large-option:hover { background:rgba(255,255,255,.72); }
.large-option.selected { color:#fff; background:#2e7d32; box-shadow:0 3px 10px rgba(34,94,43,.2); }
.large-option:active { transform:scale(.98); }
.large-option input { position:absolute; opacity:0; pointer-events:none; }
.large-option strong { font-size:1rem; }
.choice-icons { display:flex; align-items:center; justify-content:center; gap:2px; width:32px; height:32px; flex:0 0 32px; border-radius:50%; background:#fff; }
.choice-icons img { width:24px; height:24px; object-fit:contain; }
.choice-icons img + img { width:16px; height:16px; margin-left:-8px; padding:2px; border-radius:50%; background:#fff; }
.large-option.selected .choice-icons { background:rgba(255,255,255,.94); }
.single-preview { display:flex; align-items:center; justify-content:center; min-height:66px; padding:14px 18px; border:1.5px solid #d6e1d8; border-radius:12px; background:#f7faf8; }
.single-preview strong { font-size:1.05rem; text-align:center; }
.phonetic { font-family:'Cambria','Charis SIL',serif; font-size:1.2rem !important; }
.dialect-layout { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr); gap:24px; align-items:start; }
.dialect-options { overflow:hidden; border-top:1px solid #dfe5e0; border-bottom:1px solid #dfe5e0; }
.dialect-option { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:64px; padding:10px 12px; background:#fff; }
.dialect-option + .dialect-option { border-top:1px solid #e7ebe8; }
.dialect-option.disabled { color:var(--color-text-lighter); }
.check-label,.pin-label { display:flex; align-items:center; gap:12px; cursor:pointer; }
.check-label { min-width:0; }
.check-label input,.pin-label input { width:21px; height:21px; flex:0 0 auto; margin:0; accent-color:var(--color-primary); }
.check-label strong { font-size:1rem; }
.check-label small { color:var(--color-text-light); font-size:.86rem; font-weight:400; }
.pin-label { flex:0 0 auto; min-width:58px; min-height:44px; justify-content:center; padding:0 8px; border-radius:9px; color:#8b958d; font-size:.82rem; transition:.18s ease; }
.pin-label:hover { background:#f0f6f1; color:var(--color-primary); }
.pin-label input { position:absolute; opacity:0; pointer-events:none; }
.pin-label:has(input:checked) { color:var(--color-primary); background:#eaf5ec; }
.pin-label:has(input:disabled) { opacity:.35; cursor:not-allowed; }
.pin-icon { width:25px; height:25px; fill:currentColor; transform:rotate(-8deg); transition:.18s ease; }
.pin-label:has(input:checked) .pin-icon { transform:rotate(-8deg) translateY(-2px); }
.pin-text { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
.pinyin-preview { overflow:hidden; border:1.5px solid #b8c3ba; border-radius:10px; background:#fff; }
.preview-row { display:grid; grid-template-columns:minmax(110px,.9fr) 1fr; gap:12px; padding:12px 14px; align-items:baseline; }
.preview-row + .preview-row { border-top:1px solid #e5e9e6; }
.preview-row span { color:#666; font-size:.86rem; }
.preview-row strong { font-family:'Cambria','Charis SIL',serif; font-size:1.08rem; }
.preview-row.pinned { background:#eef7ef; }
.preview-row.pinned span::after { content:' · 置顶'; color:var(--color-primary); }
.setting-section--compact { display:flex; align-items:center; justify-content:space-between; gap:20px; }
.setting-section--compact .setting-heading { margin-bottom:0; }
.pill-switch { display:flex; align-items:center; gap:10px; min-height:46px; cursor:pointer; }
.pill-switch input { position:absolute; opacity:0; pointer-events:none; }
.switch-track { position:relative; width:60px; height:34px; border-radius:999px; background:#cbd3cc; transition:.22s ease; }
.switch-thumb { position:absolute; top:4px; left:4px; width:26px; height:26px; border-radius:50%; background:white; box-shadow:0 2px 6px rgba(0,0,0,.18); transition:.22s cubic-bezier(.2,.8,.3,1.2); }
.pill-switch input:checked + .switch-track { background:var(--color-primary); }
.pill-switch input:checked + .switch-track .switch-thumb { transform:translateX(26px); }
.today-preview strong { color:var(--color-primary); font-size:1.25rem; }
@media(max-width:720px){
  .settings-page{width:min(100% - 20px,920px);padding:24px 0 48px}
  .setting-section{padding:19px 16px}
  .split-content,.dialect-layout{grid-template-columns:1fr;gap:14px}
  .large-options--three{grid-template-columns:1fr}
  .large-options--three{border-radius:20px}
  .dialect-option{align-items:center;min-height:68px}
  .check-label span{display:flex;flex-direction:column}
  .preview-row{grid-template-columns:1fr}
  .setting-section--compact{align-items:center}
}
</style>
