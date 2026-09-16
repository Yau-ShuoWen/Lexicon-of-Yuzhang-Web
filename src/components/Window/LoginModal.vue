<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { showError, showSuccess } from '../../services/ToastService.js'
import { saveAuth } from '../../utils/auth.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'logged-in'])
const {t} = useI18n()

const loginMode = ref('username')
const username = ref('')
const phone = ref('')
const password = ref('')
const code = ref('')
const sendingCode = ref(false)
const loading = ref(false)
const isMobile = ref(false)
const recentCodes = ref([])

const checkMobile = () => { isMobile.value = window.matchMedia('(max-width: 768px)').matches }
const loginTitle = computed(() => loginMode.value === 'phone-password'
  ? t('account.login.phone_password_title')
  : loginMode.value === 'phone-code'
    ? t('account.login.phone_code_title')
    : t('account.login.username_title'))

onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile) })
onUnmounted(() => window.removeEventListener('resize', checkMobile))

const saveSession = async (token) => {
  const profileRes = await axios.get('/api/user/me', { params: { t: token } })
  saveAuth(profileRes.data.success ? profileRes.data.data : null, token)
  emit('logged-in', profileRes.data.success ? profileRes.data.data : null)
}

const loginWithUsername = () => axios.post('/api/user/login', null, { params: { username: username.value.trim(), password: password.value } })
const loginWithPhonePassword = () => axios.post('/api/user/login-by-phone', null, { params: { phone: phone.value.trim(), password: password.value } })
const loginWithPhoneCode = () => axios.post('/api/user/login-by-code', null, { params: { phone: phone.value.trim(), code: code.value.trim() } })

const login = async () => {
  if (loginMode.value === 'username') {
    if (!username.value.trim()) return showError(t('account.login.username_required'))
    if (!password.value.trim()) return showError(t('account.login.password_required'))
  } else if (loginMode.value === 'phone-password') {
    if (!phone.value.trim()) return showError(t('account.login.phone_required'))
    if (!password.value.trim()) return showError(t('account.login.password_required'))
  } else {
    if (!phone.value.trim()) return showError(t('account.login.phone_required'))
    if (!code.value.trim()) return showError(t('account.login.code_required'))
  }

  loading.value = true
  try {
    const res = loginMode.value === 'username'
      ? await loginWithUsername()
      : loginMode.value === 'phone-password'
        ? await loginWithPhonePassword()
        : await loginWithPhoneCode()

    if (!res.data.success) throw new Error(res.data.message || t('account.login.failed_short'))
    await saveSession(res.data.data)
    showSuccess(t('account.login.success'))
    emit('close')
  } catch (e) {
    console.error(e)
    showError(e.message || t('account.login.failed_short'))
  } finally {
    loading.value = false
  }
}

const sendCode = async () => {
  if (!phone.value.trim()) return showError(t('account.login.phone_required'))
  sendingCode.value = true
  try {
    const res = await axios.post('/api/user/code/create', null, { params: { phone: phone.value.trim() } })
    if (!res.data.success) throw new Error(res.data.message || t('account.login.code_generation_failed'))
    showSuccess(t('account.login.code_generated'))
    await refreshRecentCodes()
  } catch (e) {
    console.error(e)
    showError(e.message || t('account.login.code_generation_failed'))
  } finally {
    sendingCode.value = false
  }
}

const refreshRecentCodes = async () => {
  if (!phone.value.trim()) return
  const res = await axios.get('/api/user/code/recent', { params: { phone: phone.value.trim(), limit: 5 } })
  if (res.data.success) recentCodes.value = res.data.data || []
}
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="login-overlay" @click.self="$emit('close')">
      <div class="login-modal">
        <div v-if="isMobile" class="mobile-tip">{{ $t('account.login.desktop_recommended') }}</div>
        <template v-else>
          <div class="login-head">
            <h3>{{ loginTitle }}</h3>
            <button class="close-btn" @click="$emit('close')">×</button>
          </div>
          <div class="mode-switch">
            <button :class="{ active: loginMode === 'username' }" @click="loginMode = 'username'">{{ $t('account.common.username') }}</button>
            <button :class="{ active: loginMode === 'phone-password' }" @click="loginMode = 'phone-password'">{{ $t('account.login.phone_password') }}</button>
            <button :class="{ active: loginMode === 'phone-code' }" @click="loginMode = 'phone-code'">{{ $t('account.login.phone_verification_code') }}</button>
          </div>
          <template v-if="loginMode === 'username'">
            <input v-model="username" class="ordinary-input form-item" :placeholder="$t('account.common.username')" />
            <input v-model="password" type="password" class="ordinary-input form-item" :placeholder="$t('account.common.password')" />
          </template>
          <template v-else-if="loginMode === 'phone-password'">
            <input v-model="phone" class="ordinary-input form-item" :placeholder="$t('account.common.phone')" />
            <input v-model="password" type="password" class="ordinary-input form-item" :placeholder="$t('account.common.password')" />
          </template>
          <template v-else>
            <input v-model="phone" class="ordinary-input form-item" :placeholder="$t('account.common.phone')" />
            <input v-model="code" class="ordinary-input form-item" :placeholder="$t('account.common.verification_code')" />
            <div class="code-actions">
              <button class="dev-normal-button dev-btn-small" :disabled="sendingCode" @click="sendCode">
                {{ sendingCode ? $t('account.login.generating_code') : $t('account.login.generate_code') }}
              </button>
              <button class="dev-normal-button dev-btn-small" @click="refreshRecentCodes">{{ $t('account.login.refresh_recent_codes') }}</button>
            </div>
            <div v-if="recentCodes.length" class="code-list">
              <div v-for="item in recentCodes" :key="item.id" class="code-item">
                <span>{{ item.code }}</span>
                <span>{{ item.used ? $t('account.login.redeemed') : $t('account.login.not_redeemed') }}</span>
                <span>{{ item.expiredAt }}</span>
              </div>
            </div>
          </template>
          <button class="dev-normal-button dev-btn-small login-btn" :disabled="loading" @click="login">
            {{ loading ? $t('account.login.logging_in_short') : $t('user.login') }}
          </button>
        </template>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.login-overlay { position:fixed; inset:0; background:rgba(20,30,20,.48); display:flex; align-items:center; justify-content:center; padding:20px; z-index:2000; }
.login-modal { width:min(560px,100%); background:rgba(255,255,255,.96); box-shadow:0 24px 60px rgba(0,0,0,.18); padding:24px; border-radius:24px; }
.login-head { display:flex; justify-content:space-between; align-items:center; }
.close-btn { border:none; background:transparent; font-size:28px; cursor:pointer; }
.mode-switch { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 8px; }
.mode-switch button { border:1px solid var(--color-primary); background:transparent; padding:8px 12px; border-radius:999px; cursor:pointer; }
.mode-switch button.active { background:var(--color-primary); color:#fff; }
.form-item { margin:10px 0; }
.code-actions { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0; }
.code-list { border:1px dashed var(--color-primary); border-radius:14px; padding:10px; margin-bottom:10px; }
.code-item { display:grid; grid-template-columns:1fr auto 1.5fr; gap:10px; padding:4px 0; font-size:.92rem; }
.login-btn { width:100%; margin-top:10px; }
.mobile-tip { text-align:center; padding:24px; }
</style>
