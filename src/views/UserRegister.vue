<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const handleRegister = async () => {
  if (!username.value || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await fetch(`/api/register?username=${encodeURIComponent(username.value)}&password=${encodeURIComponent(password.value)}`)
    const result = await response.json()

    if (result.success) {
      successMessage.value = '注册成功！正在跳转到登录页面...'
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } else {
      errorMessage.value = result.message || '注册失败'
    }
  } catch (error) {
    console.error('注册错误:', error)
    errorMessage.value = '网络错误，请重试'
  } finally {
    isLoading.value = false
  }
}

const handleKeyPress = (event) => {
  if (event.key === 'Enter') {
    handleRegister()
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="page-header">
        <h1 class="page-title">用户注册</h1>
      </div>

      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label for="reg-username">用户名</label>
          <input
              id="reg-username"
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              @keypress="handleKeyPress"
              :disabled="isLoading"
              class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="reg-password">密码</label>
          <input
              id="reg-password"
              v-model="password"
              type="password"
              placeholder="请输入密码"
              @keypress="handleKeyPress"
              :disabled="isLoading"
              class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="confirm-password">确认密码</label>
          <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              @keypress="handleKeyPress"
              :disabled="isLoading"
              class="form-control"
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>

        <button
            type="submit"
            class="btn btn-secondary btn-lg w-100"
            :disabled="isLoading || !username || !password || !confirmPassword"
        >
          <span v-if="isLoading">注册中...</span>
          <span v-else>注册</span>
        </button>
      </form>

      <div class="auth-links">
        <router-link to="/login" class="link">已有账号？立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--gradient-secondary);
  padding: var(--spacing-md);
}

.success-message {
  background-color: #efe;
  color: var(--color-success);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
  border: 1px solid #cfc;
  text-align: center;
  font-size: var(--font-size-sm);
}

/* 其他样式与 UserLogin.vue 相同 */
</style>