<script setup>
import { computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getStoredUser, logout as authLogout } from '../../utils/auth.js'
import { showError, showSuccess } from '../../services/ToastService.js'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const currentUser = computed(() => getStoredUser())
const studyPath = (path) => `/${route.params.language}/${route.params.dialect}/study/${path}`

useHead({title: () => t('account.profile.page_title')})

const logout = async () => {
  try {
    await authLogout()
    showSuccess(t('account.profile.logged_out'))
    await router.replace(`/${route.params.language}/${route.params.dialect}/login`)
  } catch (exception) {
    console.error(exception)
    showError(t('account.profile.logout_failed'))
  }
}
</script>

<template>
  <main class="account-page">
    <section class="account-panel account-profile-header">
      <div class="profile-avatar" aria-hidden="true">{{ currentUser?.username?.slice(0, 1) || $t('account.profile.default_avatar') }}</div>
      <div>
        <p class="account-eyebrow">{{ $t('account.profile.title') }}</p>
        <h1>{{ currentUser?.username || $t('account.profile.default_user') }}</h1>
        <p>{{ currentUser?.phone || $t('account.profile.description') }}</p>
      </div>
    </section>

    <section class="account-panel account-settings" aria-labelledby="settings-title">
      <h2 id="settings-title">{{ $t('account.profile.settings') }}</h2>

      <router-link class="settings-row" :to="studyPath('profile/username')">
        <span class="settings-icon settings-icon-blue" aria-hidden="true">名</span>
        <span class="settings-copy">
          <strong>{{ $t('account.profile.change_username') }}</strong>
          <small>{{ $t('account.profile.current_username', {username: currentUser?.username || $t('account.profile.unset')}) }}</small>
        </span>
        <span class="settings-arrow" aria-hidden="true">›</span>
      </router-link>

      <router-link class="settings-row" :to="studyPath('profile/password')">
        <span class="settings-icon settings-icon-coral" aria-hidden="true">密</span>
        <span class="settings-copy">
          <strong>{{ $t('account.profile.change_password') }}</strong>
          <small>{{ $t('account.profile.password_hint') }}</small>
        </span>
        <span class="settings-arrow" aria-hidden="true">›</span>
      </router-link>

      <button class="settings-row settings-logout" type="button" @click="logout">
        <span class="settings-icon settings-icon-gray" aria-hidden="true">退</span>
        <span class="settings-copy">
          <strong>{{ $t('account.profile.logout') }}</strong>
          <small>{{ $t('account.profile.logout_hint') }}</small>
        </span>
        <span class="settings-arrow" aria-hidden="true">›</span>
      </button>
    </section>
  </main>
</template>

<style src="./account.css"></style>
