<script setup>
import { computed, ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showError, showSuccess } from '../../services/ToastService.js'
import {
  createVerificationCode,
  getCurrentUser,
  loginByCode,
  loginByPhone,
  loginByUsername
} from '../../services/authApi.js'
import { saveAuth } from '../../utils/auth.js'
import PasswordInput from '../../components/Form/PasswordInput.vue'
import brandLogo from '../../assets/images/logov2/yuzhangci2-white.svg'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const loginMode = ref('password')
const account = ref('')
const password = ref('')
const phone = ref('')
const code = ref('')
const loading = ref(false)
const sendingCode = ref(false)
const error = ref('')

useHead({title: () => t('account.login.page_title')})

const studyHome = computed(() => `/${route.params.language}/${route.params.dialect}/study/me`)

const getRedirectTarget = () => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.endsWith('/login')
    ? target
    : studyHome.value
}

const getErrorMessage = (exception) => exception.message || t('account.login.failed')

const finishLogin = async (token) => {
  const profile = await getCurrentUser(token)
  saveAuth(profile || null, token)
  showSuccess(t('account.login.success'))
  await router.replace(getRedirectTarget())
}

const login = async () => {
  error.value = ''
  if (loginMode.value === 'password') {
    const value = account.value.trim()
    if (!value) return (error.value = t('account.login.account_required'))
    if (!password.value) return (error.value = t('account.login.password_required'))
  } else {
    if (!/^\d{11}$/.test(phone.value.trim())) return (error.value = t('account.login.phone_11_required'))
    if (!code.value.trim()) return (error.value = t('account.login.code_required'))
  }

  loading.value = true
  try {
    const value = account.value.trim()
    const token = loginMode.value === 'code'
      ? await loginByCode(phone.value.trim(), code.value.trim())
      : /^\d{11}$/.test(value)
        ? await loginByPhone(value, password.value)
        : await loginByUsername(value, password.value)

    if (!token) throw new Error(t('account.login.invalid_credentials'))
    await finishLogin(token)
  } catch (exception) {
    console.error(exception)
    error.value = getErrorMessage(exception)
    showError(error.value)
  } finally {
    loading.value = false
  }
}

const sendCode = async () => {
  error.value = ''
  const value = phone.value.trim()
  if (!/^\d{11}$/.test(value)) {
    error.value = t('account.login.phone_11_required')
    return
  }

  sendingCode.value = true
  try {
    const verification = await createVerificationCode(value)
    if (!verification?.code) throw new Error(t('account.login.code_failed'))
    showSuccess(t('account.login.code_message', {code: verification.code}), 10000)
  } catch (exception) {
    console.error(exception)
    error.value = getErrorMessage(exception)
    showError(error.value)
  } finally {
    sendingCode.value = false
  }
}

const switchMode = (mode) => {
  loginMode.value = mode
  error.value = ''
}
</script>

<template>
  <main class="study-login-page">
    <div class="login-decoration login-decoration-blue" aria-hidden="true"></div>
    <div class="login-decoration login-decoration-coral" aria-hidden="true"></div>

    <section class="study-login-card" aria-labelledby="login-title">
      <div class="login-brand" aria-hidden="true">
        <img :src="brandLogo" alt="" />
      </div>
      <h3 id="login-title">{{ $t('account.login.heading') }}</h3>
      <p class="login-intro">{{ $t('account.login.intro') }}</p>

      <div class="login-mode-switch" role="tablist" :aria-label="$t('account.login.method')">
        <span class="login-mode-slider" :class="{'is-code': loginMode === 'code'}" aria-hidden="true"></span>
        <button type="button" :class="{active: loginMode === 'password'}" role="tab" :aria-selected="loginMode === 'password'" @click="switchMode('password')">{{ $t('account.login.account_password') }}</button>
        <button type="button" :class="{active: loginMode === 'code'}" role="tab" :aria-selected="loginMode === 'code'" @click="switchMode('code')">{{ $t('account.login.phone_code') }}</button>
      </div>

      <form class="account-form" @submit.prevent="login">
        <div v-if="loginMode === 'password'" class="login-fields">
          <input id="study-account" v-model="account" type="text" autocomplete="username" :aria-label="$t('account.login.account_label')" :placeholder="$t('account.login.account_placeholder')" :disabled="loading" />
          <PasswordInput id="study-password" v-model="password" autocomplete="current-password" :aria-label="$t('account.common.password')" :placeholder="$t('account.login.password_placeholder')" :disabled="loading" />
        </div>

        <div v-else class="login-fields">
          <input id="study-phone" v-model="phone" type="tel" inputmode="numeric" autocomplete="tel" :aria-label="$t('account.common.phone')" maxlength="11" :placeholder="$t('account.login.phone_11_placeholder')" :disabled="loading || sendingCode" />
          <div class="verification-row">
            <input id="study-code" v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" :aria-label="$t('account.common.verification_code')" maxlength="6" :placeholder="$t('account.login.code_placeholder')" :disabled="loading" />
            <button type="button" :disabled="loading || sendingCode" @click="sendCode">
              {{ sendingCode ? $t('account.login.getting_code') : $t('account.login.get_code') }}
            </button>
          </div>
        </div>

        <p v-if="error" class="account-error" role="alert">{{ error }}</p>
        <button class="account-primary-button" type="submit" :disabled="loading">
          {{ loading ? $t('account.login.logging_in') : $t('user.login') }}
        </button>
      </form>

      <router-link class="login-back-link" :to="`/${route.params.language}/${route.params.dialect}/dict/home`">
        {{ $t('account.login.back_to_dictionary') }}
      </router-link>
    </section>
  </main>
</template>

<style src="./account.css"></style>
