<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { CopyDocument } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { saveUserSettings, useUserSettings } from '../../utils/userSettings.js'
import { useLanguageSwitcher } from '../../utils/languageSwitcher.js'
import languageIcon from '../../assets/icons/LanguageAndDialect/transfer_sc_tc.svg'
import pronunciationIcon from '../../assets/icons/mode.svg'
import soundIcon from '../../assets/icons/audio.svg'
import calendarIcon from '../../assets/icons/calendar/book.svg'
import bookmarkIcon from '../../assets/icons/calendar/bookmark.svg'
import scIcon from '../../assets/icons/LanguageAndDialect/sc.svg'
import tcIcon from '../../assets/icons/LanguageAndDialect/tc.svg'
import pinyinIcon from '../../assets/icons/settings/pinyin.svg'
import zhuyinIcon from '../../assets/icons/settings/zhuyin.svg'
import listIcon from '../../assets/icons/settings/list.svg'

const settings = useUserSettings()
const route = useRoute()
const { currentLanguageInRoute, changeLanguage } = useLanguageSwitcher()
const pendingLanguageStyle = ref(currentLanguageInRoute() || settings.languageStyle)
useHead({title: '设置｜豫章词'})

const languageOptions = [
  {value: 'sc', label: '简体中文', preview: '方言是我们听得见的历史', icon: scIcon},
  {value: 'tc', label: '繁體中文', preview: '方言是我們聽得見的歷史', icon: tcIcon}
]
const mandarinOptions = [
  {value: 'pinyin', label: '拼音', preview: 'yù zhāng', icon: pinyinIcon},
  {value: 'zhuyin', label: '注音', preview: 'ㄩˋ ㄓㄤ', icon: zhuyinIcon},
  {value: 'parallel', label: '并列', preview: 'yù zhāng / ㄩˋ ㄓㄤ', icon: listIcon}
]
const dialectOptions = [
  {value: 'mandarinApproximation', label: '读起来像普通话的', note: '普通话拟音', preview: '[lān→ còng↘]'},
  {value: 'standard', label: '标准写法', preview: '[lān còng]'},
  {value: 'keyboard', label: '键盘输入', preview: '[lan4 cong1]'},
  {value: 'dictionaryIpa', label: '本词典使用 IPA', preview: "[lan_˧˥] [ts'ɔŋ_˦˨]"},
  {value: 'alternate', label: '其他版拼音', note: '如果有', preview: '[lān] [ceòng]'},
  {value: 'referenceIpa', label: '辞书对应版本 IPA', note: '如果有', preview: "[lan_˦˦˦] [ts'ɔŋ_˦˨]"}
]
const weekdayOptions = [
  {value: 'weekday', label: '星期', preview: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'], icon: calendarIcon},
  {value: 'youbi', label: '曜日', preview: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'], icon: bookmarkIcon}
]

const currentLanguage = computed(() => languageOptions.find(item => item.value === pendingLanguageStyle.value))
const currentMandarin = computed(() => mandarinOptions.find(item => item.value === settings.mandarinNotation))
const languageChanged = computed(() => pendingLanguageStyle.value !== settings.languageStyle)
const homeRoute = computed(() => ({
  name: 'Home',
  params: {
    language: currentLanguageInRoute() || 'sc',
    dialect: route.params.dialect || 'lac'
  }
}))
const todayIndex = (new Date().getDay() + 6) % 7
const todayPreview = computed(() => weekdayOptions.find(item => item.value === settings.weekdayStyle).preview[todayIndex])
const selectedDialectOptions = computed(() => {
  const selected = new Set(settings.dialectNotations)
  return dialectOptions.filter(item => selected.has(item.value)).sort((a, b) => {
    if (a.value === settings.pinnedDialectNotation) return -1
    if (b.value === settings.pinnedDialectNotation) return 1
    return 0
  })
})
const pinnedDialectOption = computed(() => dialectOptions.find(item => item.value === settings.pinnedDialectNotation))
const expandedDialectOptions = computed(() => selectedDialectOptions.value.filter(item => item.value !== settings.pinnedDialectNotation))

watch(settings, value => saveUserSettings({...value, dialectNotations: [...value.dialectNotations]}), {deep: true})

function toggleDialectNotation(value) {
  const index = settings.dialectNotations.indexOf(value)
  if (index >= 0) {
    if (settings.dialectNotations.length === 1) return
    settings.dialectNotations.splice(index, 1)
    if (settings.pinnedDialectNotation === value) {
      settings.pinnedDialectNotation = selectedDialectOptions.value[0]?.value || dialectOptions[0].value
    }
  } else settings.dialectNotations.push(value)
}

async function saveLanguageStyle() {
  if (!languageChanged.value) return
  settings.languageStyle = pendingLanguageStyle.value
  await nextTick()
  await changeLanguage(pendingLanguageStyle.value, {reload: true})
}
</script>

<template>
  <main class="settings-page">
    <header class="page-header">
      <router-link class="back-button home-button" :to="homeRoute">返回首页</router-link>
      <div>
        <h1>设置</h1>
      </div>
    </header>

    <div class="settings-content">
      <section id="display-settings" class="settings-group">
        <div class="group-header">
          <span class="group-icon"><img :src="languageIcon" alt=""></span>
          <div><h2>语言与显示</h2></div>
        </div>
        <div class="setting-row setting-row--stacked">
          <div class="setting-control setting-control--language">
            <div class="control-line">
              <div class="segmented-control segmented-control--two" :style="{'--selected-index': pendingLanguageStyle === 'tc' ? 1 : 0}">
                <span class="selection-indicator" aria-hidden="true"></span>
                <label v-for="option in languageOptions" :key="option.value" :class="{selected: pendingLanguageStyle === option.value}">
                  <input v-model="pendingLanguageStyle" type="radio" name="language-style" :value="option.value">
                  <span class="option-icon"><img :src="option.icon" alt=""></span>
                  <span>{{ option.label }}</span>
                </label>
              </div>
              <div class="inline-preview"><strong>{{ currentLanguage.preview }}</strong></div>
            </div>
            <button class="save-button" type="button" :disabled="!languageChanged" @click="saveLanguageStyle">保存语言设置</button>
          </div>
        </div>
      </section>

        <section id="pronunciation-settings" class="settings-group">
          <div class="group-header">
            <span class="group-icon group-icon--blue"><img :src="pronunciationIcon" alt=""></span>
            <div><h2>读音标注</h2></div>
          </div>
          <div class="setting-row setting-row--stacked">
            <div class="setting-copy"><h3>普通话标注</h3></div>
            <div class="setting-control">
              <div class="control-line">
              <div class="segmented-control segmented-control--three" :style="{'--selected-index': mandarinOptions.findIndex(item => item.value === settings.mandarinNotation)}">
                <span class="selection-indicator" aria-hidden="true"></span>
                <label v-for="option in mandarinOptions" :key="option.value" :class="{selected: settings.mandarinNotation === option.value}">
                  <input v-model="settings.mandarinNotation" type="radio" name="mandarin-notation" :value="option.value">
                  <span class="option-icon"><img :class="option.iconClass" :src="option.icon" alt=""></span>
                  <span>{{ option.label }}</span>
                </label>
              </div>
              <div class="inline-preview"><strong class="phonetic">{{ currentMandarin.preview }}</strong></div>
              </div>
            </div>
          </div>
          <div class="setting-row setting-row--stacked">
            <div class="setting-copy"><h3>方言拼音框</h3><p>勾选显示方案，图钉表示首选项。</p></div>
            <div class="dialect-layout">
              <div class="dialect-options">
                <div v-for="option in dialectOptions" :key="option.value" class="dialect-option" :class="{disabled: !settings.dialectNotations.includes(option.value)}">
                  <label class="check-label">
                    <input type="checkbox" :checked="settings.dialectNotations.includes(option.value)" @change="toggleDialectNotation(option.value)">
                    <span><strong>{{ option.label }}</strong><small v-if="option.note">{{ option.note }}</small></span>
                  </label>
                  <label class="pin-label" :title="settings.pinnedDialectNotation === option.value ? '已置顶' : '置顶'">
                    <input v-model="settings.pinnedDialectNotation" type="radio" name="pinned-dialect" :value="option.value" :disabled="!settings.dialectNotations.includes(option.value)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3.2 20.8 9.5l-2 2-1.1-1.1-3.5 4.9.7.7-1.6 1.6-3.1-3.1-5.4 5.4-.8-.8 5.4-5.4-3.1-3.1L7.9 9l.8.8 4.9-3.5-1.1-1.1z"/></svg>
                    <span class="sr-only">置顶</span>
                  </label>
                </div>
              </div>
              <div class="pinyin-block-preview" aria-label="方言拼音框展开预览">
                <p>显示预览</p>
                <span class="rt-pinyin-block preview-trigger-wrap">
                  <span class="rt-pinyin-trigger" v-formatted-text="pinnedDialectOption.preview"/>
                </span>
                <div class="rt-pinyin-popup preview-popup">
                  <div class="rt-pinyin-popup-inner">
                    <div v-for="option in expandedDialectOptions" :key="option.value" class="rt-pinyin-popup-row">
                      <span class="rt-pinyin-popup-label">{{ option.label }}</span>
                      <span class="rt-pinyin-popup-value" v-formatted-text="option.preview"/>
                      <span class="rt-pinyin-copy-btn" aria-hidden="true"><CopyDocument/></span>
                    </div>
                    <div v-if="!expandedDialectOptions.length" class="pinyin-popup-empty">没有其他已选择的方案</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="general-settings" class="settings-group">
          <div class="group-header">
            <span class="group-icon group-icon--amber"><img :src="calendarIcon" alt=""></span>
            <div><h2>通用设置</h2></div>
          </div>
          <div class="setting-row setting-row--simple">
            <div class="setting-copy setting-copy--icon">
              <span class="row-icon"><img :src="soundIcon" alt=""></span>
              <div><h3>操作音效</h3></div>
            </div>
            <label class="switch-control">
              <input v-model="settings.soundEnabled" type="checkbox">
              <span class="switch-track"><span class="switch-thumb"></span></span>
            </label>
          </div>
          <div class="setting-row setting-row--stacked">
            <div class="setting-copy"><h3>日历称呼</h3></div>
            <div class="setting-control setting-control--calendar">
              <div class="control-line">
              <div class="segmented-control segmented-control--two" :style="{'--selected-index': settings.weekdayStyle === 'youbi' ? 1 : 0}">
                <span class="selection-indicator" aria-hidden="true"></span>
                <label v-for="option in weekdayOptions" :key="option.value" :class="{selected: settings.weekdayStyle === option.value}">
                  <input v-model="settings.weekdayStyle" type="radio" name="weekday-style" :value="option.value">
                  <span class="option-icon"><img :src="option.icon" alt=""></span><span>{{ option.label }}</span>
                </label>
              </div>
              <div class="inline-preview today-preview"><strong>{{ todayPreview }}</strong></div>
              </div>
            </div>
          </div>
        </section>
    </div>
  </main>
</template>

<style scoped>
.settings-page{width:min(1100px,calc(100% - 40px));margin:0 auto;padding:38px 0 80px;color:#202622}.page-header{display:flex;align-items:flex-start;gap:16px;margin-bottom:28px}.back-button{flex:0 0 auto;margin-top:4px}.page-eyebrow{margin:0 0 4px;color:#2f6a43;font-size:.78rem;font-weight:700;letter-spacing:0}.page-header h1{margin:0;color:#18201a;font-size:2rem;line-height:1.2;letter-spacing:0}.page-summary{margin:7px 0 0;color:#68716a;font-size:.95rem;line-height:1.55}.settings-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:28px;align-items:start}.settings-sidebar{position:sticky;top:94px;padding:18px 12px 14px;border:1px solid #dfe4e0;border-radius:8px;background:#fff;box-shadow:0 4px 16px rgba(24,32,26,.04)}.sidebar-title{margin:0 10px 10px;color:#8a918c;font-size:.75rem;font-weight:700}.settings-nav{display:grid;gap:3px}.settings-nav a{display:block;padding:10px 12px;border-radius:6px;color:#3e4740;font-size:.92rem;font-weight:600;text-decoration:none;transition:background .18s ease,color .18s ease}.settings-nav a:hover,.settings-nav a:focus-visible{color:#21643b;background:#edf6f0;outline:none}.save-status{display:flex;align-items:center;gap:8px;margin:16px 10px 0;padding-top:14px;border-top:1px solid #edf0ed;color:#778079;font-size:.74rem;line-height:1.4}.status-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:#3c8f55;box-shadow:0 0 0 3px #e5f3e9}.settings-content{display:grid;gap:20px;min-width:0}.settings-group{scroll-margin-top:96px;overflow:hidden;border:1px solid #dfe4e0;border-radius:8px;background:#fff;box-shadow:0 4px 16px rgba(24,32,26,.04)}.group-header{display:flex;align-items:center;gap:13px;padding:20px 22px;border-bottom:1px solid #e8ece9;background:#fbfcfb}.group-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:8px;background:#e8f4eb}.group-icon--blue{background:#e9f0f8}.group-icon--amber{background:#f8f0df}.group-icon img{width:21px;height:21px;object-fit:contain}.group-header h2{margin:0 0 3px;color:#202622;font-size:1.08rem;line-height:1.3;letter-spacing:0}.group-header p,.setting-copy p{margin:0;color:#747d76;font-size:.84rem;line-height:1.55}.setting-row{display:grid;grid-template-columns:minmax(170px,.7fr) minmax(340px,1.3fr);gap:28px;padding:24px 22px}.setting-row+.setting-row{border-top:1px solid #edf0ed}.setting-row--stacked{grid-template-columns:1fr;gap:16px}.setting-row--simple{align-items:center}.setting-copy h3{margin:0 0 5px;color:#2d342f;font-size:.95rem;line-height:1.4;letter-spacing:0}.setting-control{min-width:0}.segmented-control{display:grid;gap:6px;padding:5px;border:1px solid #d9dfda;border-radius:8px;background:#f3f5f3}.segmented-control--two{grid-template-columns:repeat(2,minmax(0,1fr))}.segmented-control--three{grid-template-columns:repeat(3,minmax(0,1fr))}.segmented-control label{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:7px 10px;border:1px solid transparent;border-radius:6px;color:#4d5650;font-size:.88rem;font-weight:600;cursor:pointer;transition:.18s ease}.segmented-control label:hover{color:#215f37;background:#fff}.segmented-control label.selected{border-color:#cbd7ce;color:#1d5c33;background:#fff;box-shadow:0 1px 4px rgba(26,44,31,.08)}.segmented-control input,.pin-label input,.switch-control input{position:absolute;opacity:0;pointer-events:none}.option-icon{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;border-radius:6px;background:#E4F1E8}.option-icon img{width:19px;height:19px;object-fit:contain}.option-icon--double{display:flex}.option-icon--double img+img{width:14px;margin-left:-5px}.inline-preview{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:46px;margin-top:10px;padding:8px 13px;border-left:3px solid #77a585;border-radius:0 6px 6px 0;background:#f6f8f6}.inline-preview span,.preview-panel>p{margin:0;color:#7a827c;font-size:.75rem;font-weight:600}.inline-preview strong{color:#344038;font-size:.9rem;text-align:right}.phonetic,.preview-row strong{font-family:'Cambria','Charis SIL',serif}.dialect-layout{display:grid;grid-template-columns:minmax(300px,1fr) minmax(270px,.85fr);gap:18px;align-items:start}.dialect-options{overflow:hidden;border:1px solid #dfe4e0;border-radius:7px}.dialect-option{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:54px;padding:7px 9px 7px 13px;background:#fff}.dialect-option+.dialect-option{border-top:1px solid #edf0ed}.dialect-option.disabled{color:#a2aaa4;background:#fbfcfb}.check-label{display:flex;align-items:center;gap:11px;min-width:0;cursor:pointer}.check-label input{width:18px;height:18px;flex:0 0 auto;margin:0;accent-color:#2e7245}.check-label span{display:flex;align-items:baseline;gap:7px;min-width:0}.check-label strong{font-size:.86rem;line-height:1.35}.check-label small{color:#858d87;font-size:.72rem;white-space:nowrap}.pin-label{position:relative;display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:6px;color:#9aa29c;cursor:pointer;transition:.18s ease}.pin-label:hover{color:#2e7245;background:#edf6f0}.pin-label:has(input:checked){color:#24673b;background:#e4f1e8}.pin-label:has(input:disabled){opacity:.35;cursor:not-allowed}.pin-label svg{width:20px;height:20px;fill:currentColor;transform:rotate(-8deg)}.preview-panel{overflow:hidden;border:1px solid #dfe4e0;border-radius:7px;background:#fbfcfb}.preview-panel>p{padding:12px 13px;border-bottom:1px solid #e5e9e6}.preview-list{padding:6px}.preview-row{display:grid;grid-template-columns:minmax(105px,.9fr) 1fr;gap:10px;align-items:baseline;padding:9px 8px;border-radius:5px}.preview-row span{color:#747d76;font-size:.73rem}.preview-row strong{color:#333b35;font-size:.9rem}.preview-row.pinned{background:#e8f3eb}.preview-row.pinned span:after{content:' · 置顶';color:#2b7243}.setting-copy--icon{display:flex;align-items:center;gap:12px}.row-icon{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:7px;background:#f0f3f1}.row-icon img{width:20px;height:20px;object-fit:contain}.switch-control{display:flex;align-items:center;justify-content:flex-end;gap:10px;color:#515a53;font-size:.82rem;font-weight:600;cursor:pointer}.switch-track{position:relative;width:46px;height:26px;flex:0 0 46px;border-radius:999px;background:#bdc5bf;transition:.2s ease}.switch-thumb{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.2s ease}.switch-control input:checked+.switch-track{background:#2e7245}.switch-control input:checked+.switch-track .switch-thumb{transform:translateX(20px)}.setting-control--calendar{max-width:520px}.today-preview strong{color:#2a6740}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:820px){.settings-page{width:min(100% - 28px,760px);padding:28px 0 56px}.settings-layout{grid-template-columns:1fr;gap:14px}.settings-sidebar{position:static;padding:7px;overflow-x:auto}.sidebar-title,.save-status{display:none}.settings-nav{display:flex;min-width:max-content}.settings-nav a{padding:9px 13px}.setting-row{grid-template-columns:1fr;gap:14px}}
@media(max-width:560px){.settings-page{width:min(100% - 20px,520px);padding-top:22px}.page-header{margin-bottom:20px}.page-header h1{font-size:1.65rem}.page-summary{font-size:.86rem}.group-header,.setting-row{padding:18px 15px}.segmented-control--three{grid-template-columns:1fr}.dialect-layout{grid-template-columns:1fr}.check-label span{display:grid;gap:1px}.setting-row--simple{grid-template-columns:1fr auto}.setting-row--simple .setting-copy p{display:none}.switch-control>span:last-child{display:none}.preview-row{grid-template-columns:1fr;gap:3px}}
.page-header{margin-bottom:22px}
.home-button{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:6px 12px;border:1px solid #ccd3ce;border-radius:4px;color:#58615a;background:#f8f9f8;font-size:.875rem;text-decoration:none;white-space:nowrap;transition:background .18s ease,border-color .18s ease,color .18s ease}
.home-button:hover{border-color:#9fb7a6;color:#27683d;background:#edf5ef}
.control-line{display:flex;align-items:stretch;gap:12px}
.control-line .segmented-control{flex:0 0 auto}
.segmented-control{position:relative;padding:5px;isolation:isolate}
.selection-indicator{position:absolute;z-index:0;top:5px;bottom:5px;left:5px;border:1px solid #cbd7ce;border-radius:6px;background:#fff;box-shadow:0 1px 4px rgba(26,44,31,.08);transition:transform .28s cubic-bezier(.22,1,.36,1)}
.segmented-control--two .selection-indicator{width:calc((100% - 14px)/2);transform:translateX(calc(var(--selected-index)* (100% + 4px)))}
.segmented-control--three .selection-indicator{width:calc((100% - 18px)/3);transform:translateX(calc(var(--selected-index)* (100% + 4px)))}
.segmented-control label{z-index:1;min-height:42px;padding:6px 9px}
.segmented-control label:hover{color:#4d5650;background:transparent}
.segmented-control label.selected,.segmented-control label.selected:hover{border-color:transparent;color:#1d5c33;background:transparent;box-shadow:none}
.control-line .inline-preview{flex:1;justify-content:center;min-width:180px;margin-top:0;border-left:0;border-radius:6px}
.save-button{display:block;margin:12px 0 0 auto;padding:8px 15px;border:0;border-radius:6px;color:#fff;background:#2e7245;font-size:.82rem;font-weight:600;cursor:pointer;transition:background .18s ease}
.save-button:disabled{color:#929994;background:#e5e9e6;cursor:not-allowed}
.setting-row--simple{grid-template-columns:1fr auto}
.setting-control--calendar{max-width:none}
.setting-control--language .segmented-control,.setting-control--calendar .segmented-control{width:360px}
.setting-control .segmented-control--three{width:520px}
.segmented-control label{font-size:1rem}
.option-icon{width:32px;height:32px;flex-basis:32px}
.option-icon img{width:23px;height:23px}
.control-line .inline-preview{flex:0 1 250px;width:250px;min-width:150px}
.control-line .inline-preview strong{font-size:1rem}
.settings-content{width:min(920px,100%);margin:0 auto}
.page-header{width:min(920px,100%);margin-left:auto;margin-right:auto}
.control-line .inline-preview{margin-left:auto;justify-content:flex-end;text-align:right}
@media(max-width:680px){.control-line{display:grid;grid-template-columns:1fr}.setting-control--language .segmented-control,.setting-control--calendar .segmented-control,.setting-control .segmented-control--three{width:auto}.segmented-control--three{grid-template-columns:repeat(3,minmax(0,1fr))}.control-line .inline-preview{width:auto;min-width:0;margin-left:0;justify-content:flex-end;text-align:right}.save-button{width:100%;min-height:40px}.setting-row--simple{grid-template-columns:1fr auto}}
.pinyin-block-preview{min-width:0}
.pinyin-block-preview>p{margin:0 0 10px;color:#747d76;font-size:.78rem;font-weight:600}
.preview-trigger-wrap{display:block;padding:13px 15px;border-radius:8px;background:#e7f3ed;text-align:left}
.preview-trigger-wrap .rt-pinyin-trigger{font-size:1.15rem;cursor:default}
.preview-trigger-wrap .rt-pinyin-trigger:hover::after{background:repeating-linear-gradient(to right,#bbb 0 3px,transparent 3px 5px)}
.preview-popup.rt-pinyin-popup{position:relative;inset:auto;display:block;width:100%;min-width:0;max-width:none;margin-top:8px;overflow:hidden;animation:none}
.preview-popup.rt-pinyin-popup::before{display:none}
.preview-popup .rt-pinyin-popup-inner{width:100%}
.preview-popup .rt-pinyin-popup-value{font-size:1.05rem}
.preview-popup .rt-pinyin-copy-btn{cursor:default}
.pinyin-popup-empty{padding:16px;color:#8a918c;font-size:.82rem;text-align:center}
@media(max-width:560px){.preview-trigger-wrap{padding:11px 12px}.preview-popup.rt-pinyin-popup{max-width:none}.preview-popup .rt-pinyin-popup-label,.preview-popup .rt-pinyin-popup-value{padding:9px 10px}}
</style>
