<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showError, showSuccess } from '../../services/ToastService.js'
import { clearAuth, getStoredUser, getToken, logout as authLogout, saveAuth } from '../../utils/auth.js'
import {
  createVerificationCode,
  getCurrentUser,
  getRecentVerificationCodes,
  loginByCode,
  loginByPhone,
  loginByUsername,
  updatePassword as updatePasswordRequest,
  updateUsername as updateUsernameRequest
} from '../../services/authApi.js'

const route = useRoute()
const router = useRouter()

const loginMode = ref('username')
const username = ref('')
const phone = ref('')
const password = ref('')
const code = ref('')
const sendingCode = ref(false)
const loading = ref(false)
const recentCodes = ref([])
const currentUser = ref(null)
const currentToken = ref('')
const newUsername = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const savingUsername = ref(false)
const savingPassword = ref(false)
const loggingOut = ref(false)

const loginTitle = computed(() => loginMode.value === 'phone-password'
  ? '手机号登录'
  : loginMode.value === 'phone-code'
    ? '手机号验证码登录'
    : '用户名登录')

const homePath = computed(() => `/${route.params.language}/${route.params.dialect}/dict/home`)

const syncSession = () => {
  currentUser.value = getStoredUser()
  currentToken.value = getToken() || ''
}

onMounted(() => {
  syncSession()
})

const saveSession = async (token) => {
  const profile = await getCurrentUser(token)
  saveAuth(profile || null, token)
  syncSession()
}

const loginWithUsername = () => loginByUsername(username.value.trim(), password.value)
const loginWithPhonePassword = () => loginByPhone(phone.value.trim(), password.value)
const loginWithPhoneCode = () => loginByCode(phone.value.trim(), code.value.trim())

const login = async () => {
  if (loginMode.value === 'username') {
    if (!username.value.trim()) return showError('请输入用户名')
    if (!password.value.trim()) return showError('请输入密码')
  } else if (loginMode.value === 'phone-password') {
    if (!phone.value.trim()) return showError('请输入手机号')
    if (!password.value.trim()) return showError('请输入密码')
  } else {
    if (!phone.value.trim()) return showError('请输入手机号')
    if (!code.value.trim()) return showError('请输入验证码')
  }

  loading.value = true
  try {
    const res = loginMode.value === 'username'
      ? await loginWithUsername()
      : loginMode.value === 'phone-password'
        ? await loginWithPhonePassword()
        : await loginWithPhoneCode()

    if (!res) throw new Error('登录失败')
    await saveSession(res)
    showSuccess('登录成功')
  } catch (e) {
    console.error(e)
    showError(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

const sendCode = async () => {
  if (!phone.value.trim()) return showError('请输入手机号')

  sendingCode.value = true
  try {
    await createVerificationCode(phone.value.trim())
    showSuccess('验证码已生成')
    await refreshRecentCodes()
  } catch (e) {
    console.error(e)
    showError(e.message || '生成失败')
  } finally {
    sendingCode.value = false
  }
}

const refreshRecentCodes = async () => {
  if (!phone.value.trim()) return showError('请先输入手机号')

  try {
    recentCodes.value = await getRecentVerificationCodes(phone.value.trim(), 5) || []
  } catch (e) {
    console.error(e)
    showError(e.message || '读取失败')
  }
}

const refreshProfile = async () => {
  const token = getToken()
  if (!token) {
    syncSession()
    return
  }

  try {
    const profile = await getCurrentUser(token)
    saveAuth(profile || null, token)
    syncSession()
    showSuccess('已刷新当前登录状态')
  } catch (e) {
    console.error(e)
    showError(e.message || '读取失败')
  }
}

const logout = async () => {
  loggingOut.value = true
  try {
    await authLogout()
    syncSession()
    showSuccess('已退出登录')
  } catch (e) {
    console.error(e)
    showError('退出登录失败')
  } finally {
    loggingOut.value = false
  }
}

const updateUsername = async () => {
  if (!newUsername.value.trim()) return showError('请输入新用户名')

  savingUsername.value = true
  try {
    await updateUsernameRequest(getToken(), newUsername.value.trim())
    clearAuth()
    syncSession()
    newUsername.value = ''
    showSuccess('修改成功，请重新登录')
  } catch (e) {
    console.error(e)
    showError(e.message || '修改用户名失败')
  } finally {
    savingUsername.value = false
  }
}

const updatePassword = async () => {
  if (!oldPassword.value) return showError('请输入旧密码')
  if (!newPassword.value) return showError('请输入新密码')

  savingPassword.value = true
  try {
    await updatePasswordRequest(getToken(), oldPassword.value, newPassword.value)
    clearAuth()
    syncSession()
    showSuccess('修改成功，请重新登录')
    oldPassword.value = ''
    newPassword.value = ''
  } catch (e) {
    console.error(e)
    showError(e.message || '修改密码失败')
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <div class="auth-page broaden-layout">

    <div class="auth-grid">
      <section class="panel-card">
        <h2>{{ loginTitle }}</h2>
        <div class="mode-switch">
          <button :class="{ active: loginMode === 'username' }" @click="loginMode = 'username'">用户名</button>
          <button :class="{ active: loginMode === 'phone-password' }" @click="loginMode = 'phone-password'">手机号+密码</button>
          <button :class="{ active: loginMode === 'phone-code' }" @click="loginMode = 'phone-code'">手机号+验证码</button>
        </div>

        <template v-if="loginMode === 'username'">
          <input v-model="username" class="ordinary-input form-item" placeholder="用户名" />
          <input v-model="password" class="ordinary-input form-item" type="password" placeholder="密码" />
        </template>

        <template v-else-if="loginMode === 'phone-password'">
          <input v-model="phone" class="ordinary-input form-item" placeholder="手机号" />
          <input v-model="password" class="ordinary-input form-item" type="password" placeholder="密码" />
        </template>

        <template v-else>
          <input v-model="phone" class="ordinary-input form-item" placeholder="手机号" />
          <input v-model="code" class="ordinary-input form-item" placeholder="验证码" />
          <div class="action-row">
            <button class="dev-normal-button dev-btn-small" :disabled="sendingCode" @click="sendCode">
              {{ sendingCode ? '生成中...' : '生成验证码' }}
            </button>
            <button class="dev-normal-button dev-btn-small" @click="refreshRecentCodes">刷新最近验证码</button>
          </div>
          <p class="hint">当前阶段验证码直接写入数据库，这里保留最近几条，方便测试。</p>
          <div v-if="recentCodes.length" class="code-list">
            <div v-for="item in recentCodes" :key="item.id" class="code-item">
              <span>{{ item.code }}</span>
              <span>{{ item.used ? '已核销' : '未核销' }}</span>
              <span>{{ item.expiredAt }}</span>
            </div>
          </div>
        </template>

        <button class="dev-normal-button dev-btn-small login-button" :disabled="loading" @click="login">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2>当前状态</h2>
          <button class="ghost-button small" @click="refreshProfile">刷新状态</button>
        </div>

        <div class="status-box">
          <p><strong>是否已登录：</strong>{{ currentToken ? '是' : '否' }}</p>
          <p><strong>用户名：</strong>{{ currentUser?.username || '未登录' }}</p>
          <p><strong>手机号：</strong>{{ currentUser?.phone || '未登录' }}</p>
          <p><strong>管理员：</strong>{{ currentUser?.admin ? '是' : '否' }}</p>
          <p class="token-line"><strong>Token：</strong>{{ currentToken || '无' }}</p>
        </div>

        <button class="dev-normal-button dev-btn-small warn-button" :disabled="!currentToken || loggingOut" @click="logout">
          {{ loggingOut ? '退出中...' : '退出登录' }}
        </button>
      </section>
    </div>

    <div class="auth-grid" v-if="currentToken">
      <section class="panel-card">
        <h2>修改用户名</h2>
        <input v-model="newUsername" class="ordinary-input form-item" placeholder="新用户名" />
        <button class="dev-normal-button dev-btn-small" :disabled="savingUsername" @click="updateUsername">
          {{ savingUsername ? '保存中...' : '修改用户名' }}
        </button>
      </section>

      <section class="panel-card">
        <h2>修改密码</h2>
        <input v-model="oldPassword" class="ordinary-input form-item" type="password" placeholder="旧密码" />
        <input v-model="newPassword" class="ordinary-input form-item" type="password" placeholder="新密码" />
        <button class="dev-normal-button dev-btn-small" :disabled="savingPassword" @click="updatePassword">
          {{ savingPassword ? '保存中...' : '修改密码' }}
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  gap: 24px;
}

.hero-card,
.panel-card {
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.96), rgba(246, 238, 222, 0.96));
  border: 1px solid rgba(127, 91, 45, 0.18);
  border-radius: 24px;
  box-shadow: 0 16px 40px rgba(74, 52, 24, 0.08);
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  padding: 28px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #8b5a2b;
  font-size: 0.92rem;
  letter-spacing: 0.08em;
}

.hero-card h1 {
  margin: 0 0 10px;
  font-size: 2rem;
}

.hero-text {
  margin: 0;
  max-width: 48rem;
  line-height: 1.7;
}

.auth-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.panel-card {
  padding: 24px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mode-switch,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 10px;
}

.mode-switch button,
.ghost-button {
  border: 1px solid #8b5a2b;
  background: transparent;
  color: #6a421d;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
}

.mode-switch button.active {
  background: #8b5a2b;
  color: #fffaf2;
}

.ghost-button.small {
  padding: 6px 12px;
}

.form-item {
  margin: 10px 0;
}

.hint {
  color: var(--color-text-muted);
  font-size: 0.94rem;
  line-height: 1.6;
}

.code-list,
.status-box {
  background: rgba(255, 255, 255, 0.7);
  border: 1px dashed rgba(127, 91, 45, 0.35);
  border-radius: 16px;
  padding: 14px;
}

.code-item {
  display: grid;
  grid-template-columns: 1fr auto 1.5fr;
  gap: 10px;
  padding: 4px 0;
  font-size: 0.92rem;
}

.status-box p {
  margin: 0 0 10px;
}

.status-box p:last-child {
  margin-bottom: 0;
}

.token-line {
  word-break: break-all;
}

.login-button,
.warn-button {
  width: 100%;
  margin-top: 14px;
}

@media (max-width: 900px) {
  .hero-card,
  .auth-grid {
    grid-template-columns: 1fr;
  }

  .hero-card {
    flex-direction: column;
  }
}
</style>
