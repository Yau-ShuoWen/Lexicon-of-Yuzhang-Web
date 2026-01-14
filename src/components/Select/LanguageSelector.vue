<script setup>
import { useRoute, useRouter } from 'vue-router'
import DropdownSelector from './DropdownSelector.vue'
import transferIcon from '../../assets/icons/LanguageAndDialect/transfer_sc_tc.svg'
import scIcon from '../../assets/icons/LanguageAndDialect/sc.svg'
import tcIcon from '../../assets/icons/LanguageAndDialect/tc.svg'

const route = useRoute()
const router = useRouter()

const languages = [
  {value: 'sc', label: '简体中文', icon: scIcon},
  {value: 'tc', label: '繁体中文', icon: tcIcon},
]

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
      defaultText="切换语言"
      :defaultIcon="transferIcon"
  />
</template>
