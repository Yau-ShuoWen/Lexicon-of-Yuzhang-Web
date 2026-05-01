<script setup>
import {useRoute, useRouter} from 'vue-router'
import DropdownSelector from './DropdownSelector.vue'
import transferIcon from '../../assets/icons/LanguageAndDialect/transfer_dialect.svg'
import lacIcon from '../../assets/icons/LanguageAndDialect/lancong_rc.png'
import cedIcon from '../../assets/icons/LanguageAndDialect/cendu_rc.png'
import { useI18n } from "vue-i18n";


const route = useRoute()
const router = useRouter()
const {t} = useI18n()


const dialects = [
  {value: 'lac', label: t('dialect.lac'), icon: lacIcon},
  {value: 'ced', label: t('dialect.ced'), icon: cedIcon},
]

const currentDialectInRoute = () => {
  const segments = route.path.split('/').filter(Boolean)
  return segments[1] || null
}

const changeDialect = (dialect) => {
  const segments = route.path.split('/').filter(Boolean)
  if (segments.length === 0) return

  if (segments.length >= 2) segments[1] = dialect
  else segments.push(dialect)

  router.push('/' + segments.join('/'))
}
</script>

<template>
  <DropdownSelector
      :items="dialects"
      :currentInRoute="currentDialectInRoute"
      :changeFunc="changeDialect"
      defaultText="选择方言"
      :defaultIcon="transferIcon"
  />
</template>