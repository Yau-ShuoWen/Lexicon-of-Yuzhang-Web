<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DropdownSelector from './DropdownSelector.vue'
import transferIcon from '../../assets/icons/LanguageAndDialect/transfer_sc_tc.svg'
import scIcon from '../../assets/icons/LanguageAndDialect/sc.svg'
import tcIcon from '../../assets/icons/LanguageAndDialect/tc.svg'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const languages = computed(() => [
  {value: 'sc', label: t('language.simplified_chinese'), icon: scIcon},
  {value: 'tc', label: t('language.traditional_chinese'), icon: tcIcon},
])

const currentLanguageInRoute = () => {
  const first = route.path.split('/')[1]
  return first === 'sc' || first === 'tc' ? first : null
}

const changeLanguage = (language) => {
  if (language === currentLanguageInRoute()) return
  const segments = route.path.split('/').filter(Boolean)

  let nextPath
  if (currentLanguageInRoute()) {
    segments[0] = language
    nextPath = '/' + segments.join('/')
  } else {
    nextPath = `/${language}${route.path}`
  }

  router.push(nextPath)
}
</script>

<template>
  <DropdownSelector
      :items="languages"
      :currentInRoute="currentLanguageInRoute"
      :changeFunc="changeLanguage"
      :defaultText="$t('language.switch')"
      :defaultIcon="transferIcon"
  />
</template>
