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
  <div class="register-container">
    <div class="register-card">
      <h2 class="register-title">用户注册</h2>

      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label for="reg-username">用户名</label>
          <input
              id="reg-username"
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              @keypress="handleKeyPress"
              :disabled="isLoading"
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
            class="register-button"
            :disabled="isLoading || !username || !password || !confirmPassword"
        >
          <span v-if="isLoading">注册中...</span>
          <span v-else>注册</span>
        </button>
      </form>

      <div class="register-links">
        <router-link to="/login" class="link">已有账号？立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  padding: 20px;
}

.register-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.register-title {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 28px;
  font-weight: 600;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.success-message {
  background-color: #efe;
  color: #363;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #cfc;
  text-align: center;
  font-size: 14px;
}

.register-button {
  padding: 14px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 10px;
}

.register-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(245, 87, 108, 0.4);
}

.register-button:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.register-links {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

/* 复用登录组件的样式 */
.form-group,
.error-message,
.link {
  /* 样式与登录组件相同 */
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

.form-group input {
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #f5576c;
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.error-message {
  background-color: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #fcc;
  text-align: center;
  font-size: 14px;
}

.link {
  color: #f5576c;
  text-decoration: none;
  font-size: 14px;
}

.link:hover {
  text-decoration: underline;
}

@media (max-width: 480px) {
  .register-card {
    padding: 30px 20px;
  }

  .register-title {
    font-size: 24px;
  }
}
</style>