<template>
  <div class="language-switcher">
    <div class="lang-icon" @click="toggleLanguage">
      <img :src="currentLocale === 'sc' ? scIcon : tcIcon" alt="language" />
    </div>
  </div>
</template>

<script setup>
import {useI18n} from 'vue-i18n'
import scIcon from '../../assets/icons/sc.svg'
import tcIcon from '../../assets/icons/tc.svg'

const {locale} = useI18n()
const currentLocale = locale

const toggleLanguage = () => {
  const newLang = currentLocale.value === 'sc' ? 'tc' : 'sc'
  currentLocale.value = newLang
  localStorage.setItem('user-locale', newLang)

  window.dispatchEvent(new CustomEvent('languageChanged', {
    detail: { locale: newLang }
  }))
}
</script>

<style scoped>
.language-switcher {
  display: flex;
  align-items: center;
}

.lang-icon {
  width: 32px;
  height: 32px;
  cursor: pointer;
  border-radius: 50%;
  padding: 4px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.lang-icon:hover {
  background-color: #f0f0f0;
  transform: scale(1.01);
}

.lang-icon:active {
  transform: scale(0.99);
}

.lang-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
</style>