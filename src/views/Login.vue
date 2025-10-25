<!-- src/views/Login.vue -->
<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'

const router = useRouter()

// 响应式数据
const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

// 登录方法
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
      // 保存token到localStorage
      localStorage.setItem('token', result.token)
      localStorage.setItem('username', result.username)

      // 触发存储事件，让App.vue能够检测到状态变化
      window.dispatchEvent(new Event('storage'))

      // 跳转到个人信息页
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

// 回车登录
const handleKeyPress = (event) => {
  if (event.key === 'Enter') {
    handleLogin()
  }
}
</script>

<template>
  <!-- 模板部分保持不变 -->
  <div class="login-container">
    <div class="login-card">
      <h2 class="login-title">用户登录</h2>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
              id="username"
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              @keypress="handleKeyPress"
              :disabled="isLoading"
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
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button
            type="submit"
            class="login-button"
            :disabled="isLoading || !username || !password"
        >
          <span v-if="isLoading">登录中...</span>
          <span v-else>登录</span>
        </button>
      </form>

      <div class="login-links">
        <router-link to="/register" class="link">还没有账号？立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.login-title {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 28px;
  font-weight: 600;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  border-color: #667eea;
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

.login-button {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 10px;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.login-button:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.login-links {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.link {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.link:hover {
  text-decoration: underline;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
  }

  .login-title {
    font-size: 24px;
  }
}
</style>