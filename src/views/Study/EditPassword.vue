<script setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { clearAuth, getToken } from '../../utils/auth.js'
import { showError, showSuccess } from '../../services/ToastService.js'
import PasswordInput from '../../components/Form/PasswordInput.vue'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const profilePath = `/${route.params.language}/${route.params.dialect}/study/profile`

useHead({title: () => t('account.password.page_title')})

const save = async () => {
  if (!oldPassword.value) return showError(t('account.password.current_required'))
  if (!newPassword.value) return showError(t('account.password.new_required'))
  if (newPassword.value !== confirmPassword.value) return showError(t('account.password.mismatch'))
  if (newPassword.value === oldPassword.value) return showError(t('account.password.unchanged'))

  saving.value = true
  try {
    const response = await axios.post('/api/user/update-password', null, {
      params: {t: getToken(), oldPassword: oldPassword.value, newPassword: newPassword.value}
    })
    if (!response.data?.success) throw new Error(response.data?.message || t('account.password.failed'))

    // 后端修改密码后会注销该账号的全部会话，需要重新登录。
    clearAuth()
    showSuccess(t('account.password.success'))
    await router.replace(`/${route.params.language}/${route.params.dialect}/login`)
  } catch (exception) {
    console.error(exception)
    showError(exception.response?.data?.message || exception.message || t('account.password.failed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="account-page account-edit-page">
    <section class="account-panel account-edit-card">
      <router-link class="account-back" :to="profilePath">{{ $t('account.common.back_to_profile') }}</router-link>
      <p class="account-eyebrow">{{ $t('account.password.eyebrow') }}</p>
      <h1>{{ $t('account.password.title') }}</h1>
      <p class="edit-description">{{ $t('account.password.description') }}</p>

      <form class="account-form" @submit.prevent="save">
        <label for="old-password">{{ $t('account.password.current') }}</label>
        <PasswordInput id="old-password" v-model="oldPassword" autocomplete="current-password" :placeholder="$t('account.password.current_placeholder')" :disabled="saving" />

        <label for="new-password">{{ $t('account.password.new') }}</label>
        <PasswordInput id="new-password" v-model="newPassword" autocomplete="new-password" :placeholder="$t('account.password.new_placeholder')" :disabled="saving" />

        <label for="confirm-password">{{ $t('account.password.confirm') }}</label>
        <PasswordInput id="confirm-password" v-model="confirmPassword" autocomplete="new-password" :placeholder="$t('account.password.confirm_placeholder')" :disabled="saving" />

        <button class="account-primary-button" type="submit" :disabled="saving">
          {{ saving ? $t('account.common.saving') : $t('account.common.save_changes') }}
        </button>
      </form>
    </section>
  </main>
</template>

<style src="./account.css"></style>
