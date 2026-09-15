<script setup>
import { computed, ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { showError, showSuccess } from '../../services/ToastService.js'
import { saveAuth } from '../../utils/auth.js'
import PasswordInput from '../../components/Form/PasswordInput.vue'
import brandLogo from '../../assets/images/logov2/yuzhangci2-white.svg'

const route = useRoute()
const router = useRouter()
const loginMode = ref('password')
const account = ref('')
const password = ref('')
const phone = ref('')
const code = ref('')
const loading = ref(false)
const sendingCode = ref(false)
const error = ref('')

useHead({title: '登录 · 豫章词'})

const studyHome = computed(() => `/${route.params.language}/${route.params.dialect}/study/me`)

const getRedirectTarget = () => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.endsWith('/login')
    ? target
    : studyHome.value
}

const getErrorMessage = (exception) => exception.response?.data?.message || exception.message || '登录失败，请稍后再试。'

const finishLogin = async (token) => {
  const profileResponse = await axios.get('/api/user/me', {params: {t: token}})
  if (!profileResponse.data?.success) {
    throw new Error(profileResponse.data?.message || '无法读取账号信息。')
  }
  saveAuth(profileResponse.data.data || null, token)
  showSuccess('登录成功')
  await router.replace(getRedirectTarget())
}

const login = async () => {
  error.value = ''
  if (loginMode.value === 'password') {
    const value = account.value.trim()
    if (!value) return (error.value = '请输入用户名或手机号。')
    if (!password.value) return (error.value = '请输入密码。')
  } else {
    if (!/^\d{11}$/.test(phone.value.trim())) return (error.value = '请输入 11 位手机号。')
    if (!code.value.trim()) return (error.value = '请输入验证码。')
  }

  loading.value = true
  try {
    const value = account.value.trim()
    const response = loginMode.value === 'code'
      ? await axios.post('/api/user/login-by-code', null, {
        params: {phone: phone.value.trim(), code: code.value.trim()}
      })
      : /^\d{11}$/.test(value)
        ? await axios.post('/api/user/login-by-phone', null, {
          params: {phone: value, password: password.value}
        })
        : await axios.post('/api/user/login', null, {
          params: {username: value, password: password.value}
        })

    if (!response.data?.success || !response.data?.data) {
      throw new Error(response.data?.message || '登录信息不正确。')
    }
    await finishLogin(response.data.data)
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
    error.value = '请输入 11 位手机号。'
    return
  }

  sendingCode.value = true
  try {
    const response = await axios.post('/api/user/code/create', null, {params: {phone: value}})
    if (!response.data?.success || !response.data?.data?.code) {
      throw new Error(response.data?.message || '获取验证码失败。')
    }
    showSuccess(`验证码：${response.data.data.code}（10 分钟内有效）`, 10000)
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
      <h3 id="login-title">登录后开始学习</h3>
      <p class="login-intro">进入方言的世界，并保留学习进度</p>

      <div class="login-mode-switch" role="tablist" aria-label="登录方式">
        <span class="login-mode-slider" :class="{'is-code': loginMode === 'code'}" aria-hidden="true"></span>
        <button type="button" :class="{active: loginMode === 'password'}" role="tab" :aria-selected="loginMode === 'password'" @click="switchMode('password')">账号密码</button>
        <button type="button" :class="{active: loginMode === 'code'}" role="tab" :aria-selected="loginMode === 'code'" @click="switchMode('code')">手机验证码</button>
      </div>

      <form class="account-form" @submit.prevent="login">
        <div v-if="loginMode === 'password'" class="login-fields">
          <input id="study-account" v-model="account" type="text" autocomplete="username" aria-label="用户名或手机号" placeholder="请输入用户名或 11 位手机号" :disabled="loading" />
          <PasswordInput id="study-password" v-model="password" autocomplete="current-password" aria-label="密码" placeholder="请输入密码" :disabled="loading" />
        </div>

        <div v-else class="login-fields">
          <input id="study-phone" v-model="phone" type="tel" inputmode="numeric" autocomplete="tel" aria-label="手机号" maxlength="11" placeholder="请输入 11 位手机号" :disabled="loading || sendingCode" />
          <div class="verification-row">
            <input id="study-code" v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" aria-label="验证码" maxlength="6" placeholder="6 位验证码" :disabled="loading" />
            <button type="button" :disabled="loading || sendingCode" @click="sendCode">
              {{ sendingCode ? '获取中……' : '获取验证码' }}
            </button>
          </div>
        </div>

        <p v-if="error" class="account-error" role="alert">{{ error }}</p>
        <button class="account-primary-button" type="submit" :disabled="loading">
          {{ loading ? '正在登录…' : '登录' }}
        </button>
      </form>

      <router-link class="login-back-link" :to="`/${route.params.language}/${route.params.dialect}/dict/home`">
        暂不登录，返回词典
      </router-link>
    </section>
  </main>
</template>

<style src="./account.css"></style>
