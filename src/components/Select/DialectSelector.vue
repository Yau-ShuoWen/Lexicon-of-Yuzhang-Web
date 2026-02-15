<script setup>
import {useRoute, useRouter} from 'vue-router'
import DropdownSelector from './DropdownSelector.vue'
import transferIcon from '../../assets/icons/LanguageAndDialect/transfer_dialect.svg'
import namIcon from '../../assets/icons/LanguageAndDialect/lancong_rc.png'

const route = useRoute()
const router = useRouter()

const dialects = [
  {value: 'nam', label: '南昌话', icon: namIcon},
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