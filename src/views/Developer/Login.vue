<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { showError, showSuccess } from '../../services/ToastService.js'
import { saveAuth } from '../../utils/auth.js'

const route = useRoute()
const router = useRouter()
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
const loginTitle = computed(() => loginMode.value === 'phone-password' ? t('developer.login_title_phone') : loginMode.value === 'phone-code' ? t('developer.login_title_code') : t('developer.login_title_username'))
const targetPath = () => `/${route.params.language}/${route.params.dialect}/dict/about`

onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile) })
onUnmounted(() => window.removeEventListener('resize', checkMobile))

const saveSession = async (token) => {
  const profileRes = await axios.get('/api/user/me', { params: { t: token } })
  saveAuth(profileRes.data.success ? profileRes.data.data : null, token)
}

const loginWithUsername = () => axios.post('/api/user/login', null, { params: { username: username.value.trim(), password: password.value } })
const loginWithPhonePassword = () => axios.post('/api/user/login-by-phone', null, { params: { phone: phone.value.trim(), password: password.value } })
const loginWithPhoneCode = () => axios.post('/api/user/login-by-code', null, { params: { phone: phone.value.trim(), code: code.value.trim() } })

const login = async () => {
  if (loginMode.value === 'username') {
    if (!username.value.trim()) return showError(t('developer.required_username'))
    if (!password.value.trim()) return showError(t('developer.required_password'))
  } else if (loginMode.value === 'phone-password') {
    if (!phone.value.trim()) return showError(t('developer.required_phone'))
    if (!password.value.trim()) return showError(t('developer.required_password'))
  } else {
    if (!phone.value.trim()) return showError(t('developer.required_phone'))
    if (!code.value.trim()) return showError(t('developer.required_code'))
  }

  loading.value = true
  try {
    const res = loginMode.value === 'username'
        ? await loginWithUsername()
        : loginMode.value === 'phone-password'
            ? await loginWithPhonePassword()
            : await loginWithPhoneCode()
    if (!res.data.success) throw new Error(res.data.message || t('developer.failed'))
    await saveSession(res.data.data)
    showSuccess(t('developer.success'))
    router.push({ path: targetPath() })
  } catch (e) {
    console.error(e)
    showError(e.message || t('developer.failed'))
  } finally {
    loading.value = false
  }
}

const sendCode = async () => {
  if (!phone.value.trim()) return showError(t('developer.required_phone'))
  sendingCode.value = true
  try {
    const res = await axios.post('/api/user/code/create', null, { params: { phone: phone.value.trim() } })
    if (!res.data.success) throw new Error(res.data.message || t('developer.generate_failed'))
    showSuccess(t('developer.code_generated'))
    await refreshRecentCodes()
  } catch (e) {
    console.error(e)
    showError(e.message || t('developer.generate_failed'))
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
  <div class="login-shell">
    <div class="login-backdrop"></div>
    <div class="login-modal">
      <div v-if="isMobile" class="mobile-tip">
        {{ $t('developer.desktop_tip') }}
      </div>
      <template v-else>
        <h3>{{ loginTitle }}</h3>
        <div class="mode-switch">
          <button :class="{active: loginMode==='username'}" @click="loginMode='username'">{{ $t('developer.username') }}</button>
          <button :class="{active: loginMode==='phone-password'}" @click="loginMode='phone-password'">手机号+密码</button>
          <button :class="{active: loginMode==='phone-code'}" @click="loginMode='phone-code'">手机号+验证码</button>
        </div>

        <template v-if="loginMode === 'username'">
          <input v-model="username" class="ordinary-input form-item" :placeholder="$t('developer.username')" />
          <input v-model="password" class="ordinary-input form-item" type="password" :placeholder="$t('developer.password')" />
        </template>

        <template v-else-if="loginMode === 'phone-password'">
          <input v-model="phone" class="ordinary-input form-item" :placeholder="$t('developer.phone')" />
          <input v-model="password" class="ordinary-input form-item" type="password" :placeholder="$t('developer.password')" />
        </template>

        <template v-else>
          <input v-model="phone" class="ordinary-input form-item" :placeholder="$t('developer.phone')" />
          <input v-model="code" class="ordinary-input form-item" :placeholder="$t('developer.code')" />
          <div class="code-actions">
            <button class="dev-normal-button dev-btn-small" :disabled="sendingCode" @click="sendCode">{{ sendingCode ? $t('developer.generating') : $t('developer.generate') }}</button>
            <button class="dev-normal-button dev-btn-small" @click="refreshRecentCodes">{{ $t('developer.refresh_codes') }}</button>
          </div>
          <div class="hint">{{ $t('developer.code_hint') }}</div>
          <div v-if="recentCodes.length" class="code-list">
            <div v-for="item in recentCodes" :key="item.id" class="code-item">
              <span>{{ item.code }}</span>
              <span>{{ item.used ? $t('developer.redeemed') : $t('developer.not_redeemed') }}</span>
              <span>{{ item.expiredAt }}</span>
            </div>
          </div>
        </template>

        <button class="dev-normal-button dev-btn-small login-btn" :disabled="loading" @click="login">
          {{ loading ? $t('developer.login_short') : $t('developer.login') }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-shell{position:relative;min-height:68vh;display:flex;align-items:center;justify-content:center;padding:24px}
.login-backdrop{position:absolute;inset:0;background:radial-gradient(circle at top,#e9f4e5 0%,#dfeedd 40%,#eef6ea 100%);border-radius:24px}
.login-modal{position:relative;z-index:1;width:min(560px,100%);background:rgba(255,255,255,.88);backdrop-filter:blur(10px);border:1px solid var(--color-border);border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,.12);padding:28px}
.mode-switch{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 8px}
.mode-switch button{border:1px solid var(--color-primary);background:transparent;padding:8px 12px;border-radius:999px;cursor:pointer}
.mode-switch button.active{background:var(--color-primary);color:#fff}
.form-item{margin:10px 0}
.code-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.hint{font-size:.92rem;color:var(--color-text-muted);margin-bottom:10px}
.code-list{border:1px dashed var(--color-primary);border-radius:14px;padding:10px;margin-bottom:10px}
.code-item{display:grid;grid-template-columns:1fr auto 1.5fr;gap:10px;padding:4px 0;font-size:.92rem}
.login-btn{margin-top:10px;width:100%}
.mobile-tip{text-align:center;padding:24px}
</style>
