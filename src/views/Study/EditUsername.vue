<script setup>
import { computed, ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { clearAuth, getStoredUser, getToken } from '../../utils/auth.js'
import { showError, showSuccess } from '../../services/ToastService.js'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const newUsername = ref('')
const saving = ref(false)
const currentUsername = computed(() => getStoredUser()?.username || '')
const profilePath = `/${route.params.language}/${route.params.dialect}/study/profile`

useHead({title: () => t('account.username.page_title')})

const save = async () => {
  const value = newUsername.value.trim()
  if (!value) return showError(t('account.username.required'))
  if (/^\d+$/.test(value)) return showError(t('account.username.digits_only'))
  if (value === currentUsername.value) return showError(t('account.username.unchanged'))

  saving.value = true
  try {
    const token = getToken()
    const response = await axios.post('/api/user/update-username', null, {
      params: {t: token, newUsername: value}
    })
    if (!response.data?.success) throw new Error(response.data?.message || t('account.username.failed'))

    // 后端修改用户名后会注销该账号的全部会话，需要重新登录。
    clearAuth()
    showSuccess(t('account.username.success'))
    await router.replace(`/${route.params.language}/${route.params.dialect}/login`)
  } catch (exception) {
    console.error(exception)
    showError(exception.response?.data?.message || exception.message || t('account.username.failed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="account-page account-edit-page">
    <section class="account-panel account-edit-card">
      <router-link class="account-back" :to="profilePath">{{ $t('account.common.back_to_profile') }}</router-link>
      <p class="account-eyebrow">{{ $t('account.username.eyebrow') }}</p>
      <h1>{{ $t('account.username.title') }}</h1>
      <p class="edit-description">{{ $t('account.username.current') }}<strong>{{ currentUsername }}</strong></p>

      <form class="account-form" @submit.prevent="save">
        <label for="new-username">{{ $t('account.username.new') }}</label>
        <input id="new-username" v-model="newUsername" autocomplete="username" :placeholder="$t('account.username.placeholder')" :disabled="saving" />
        <button class="account-primary-button" type="submit" :disabled="saving">
          {{ saving ? $t('account.common.saving') : $t('account.common.save_changes') }}
        </button>
      </form>
    </section>
  </main>
</template>

<style src="./account.css"></style>
