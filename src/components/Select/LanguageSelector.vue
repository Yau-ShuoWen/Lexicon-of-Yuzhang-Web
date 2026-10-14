<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DropdownSelector from './DropdownSelector.vue'
import { useLanguageSwitcher } from '../../utils/languageSwitcher.js'
import transferIcon from '../../assets/icons/LanguageAndDialect/transfer_sc_tc.svg'
import scIcon from '../../assets/icons/LanguageAndDialect/sc.svg'
import tcIcon from '../../assets/icons/LanguageAndDialect/tc.svg'

const { t } = useI18n()
const { currentLanguageInRoute, changeLanguage } = useLanguageSwitcher()

const languages = computed(() => [
  {value: 'sc', label: t('language.simplified_chinese'), icon: scIcon},
  {value: 'tc', label: t('language.traditional_chinese'), icon: tcIcon},
])

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
