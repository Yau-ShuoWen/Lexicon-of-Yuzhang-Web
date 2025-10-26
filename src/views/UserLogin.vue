<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'

const router = useRouter()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/login?username=${encodeURIComponent(username.value)}&password=${encodeURIComponent(password.value)}`)
    const result = await response.json()

    if (result.success) {
      localStorage.setItem('token', result.token)
      localStorage.setItem('username', result.username)
      window.dispatchEvent(new Event('storage'))
      await router.push('/profile')
    } else {
      errorMessage.value = result.message || '登录失败'
    }
  } catch (error) {
    console.error('登录错误:', error)
    errorMessage.value = '网络错误，请重试'
  } finally {
    isLoading.value = false
  }
}

const handleKeyPress = (event) => {
  if (event.key === 'Enter') {
    handleLogin()
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="page-header">
        <h1 class="page-title">用户登录</h1>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
              id="username"
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              @keypress="handleKeyPress"
              :disabled="isLoading"
              class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
              id="password"
              v-model="password"
              type="password"
              placeholder="请输入密码"
              @keypress="handleKeyPress"
              :disabled="isLoading"
              class="form-control"
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button
            type="submit"
            class="btn btn-primary btn-lg w-100"
            :disabled="isLoading || !username || !password"
        >
          <span v-if="isLoading">登录中...</span>
          <span v-else>登录</span>
        </button>
      </form>

      <div class="auth-links">
        <router-link to="/register" class="link">还没有账号？立即注册</router-link>
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
  background: var(--gradient-primary);
  padding: var(--spacing-md);
}

.auth-card {
  background: var(--color-background-card);
  padding: var(--spacing-2xl);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 400px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.error-message {
  background-color: #fee;
  color: var(--color-error);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
  border: 1px solid #fcc;
  text-align: center;
  font-size: var(--font-size-sm);
}

.auth-links {
  text-align: center;
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--font-size-sm);
}

.link:hover {
  text-decoration: underline;
}

.w-100 {
  width: 100%;
}

@media (max-width: 480px) {
  .auth-card {
    padding: var(--spacing-xl);
  }
}
</style>