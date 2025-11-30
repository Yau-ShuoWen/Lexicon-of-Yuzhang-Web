<!-- 导航路径为：/developer-home -->
<!-- 修改时候请勿删除此路径 -->

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

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group label {
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.form-control {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-base);
  transition: border-color var(--transition-fast);
}

.form-control:focus {
  outline: none;
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 2px rgba(74, 111, 200, 0.1);
}

.form-control:disabled {
  background-color: var(--color-background-alt);
  cursor: not-allowed;
}

.btn {
  padding: var(--spacing-md) var(--spacing-lg);
  border: none;
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  justify-content: center;
  align-items: center;
}

.btn-secondary {
  background: var(--gradient-secondary);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-lg {
  padding: var(--spacing-lg);
  font-size: var(--font-size-lg);
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

.success-message {
  background-color: #efe;
  color: var(--color-success);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
  border: 1px solid #cfc;
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
  color: var(--color-secondary);
  text-decoration: none;
  font-size: var(--font-size-sm);
}

.link:hover {
  text-decoration: underline;
}

.w-100 {
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.page-title {
  color: var(--color-text);
  font-size: var(--font-size-3xl);
  font-weight: 600;
  margin: 0;
}

@media (max-width: 480px) {
  .auth-card {
    padding: var(--spacing-xl);
  }
}
</style>