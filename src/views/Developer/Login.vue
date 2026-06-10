<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { showError, showSuccess } from '../../services/ToastService.js'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const loading = ref(false)

const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const getPath = () => `/${route.params.language}/${route.params.dialect}/dev/home`

const login = async () => {
  if (!username.value.trim()) {
    showError('请输入用户名')
    return
  }

  if (!password.value.trim()) {
    showError('请输入密码')
    return
  }

  loading.value = true

  try {
    const res = await axios.post(
        '/api/user/login',
        null,
        {
          params: {
            username: username.value,
            password: password.value
          }
        }
    )

    if (!res.data.success) throw new Error(res.data.message || '登录失败')


    localStorage.setItem('auth-token', res.data.data)

    showSuccess('登录成功')

    router.push({
      path: getPath()
    })

  } catch (e) {
    console.error(e)
    showError(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="narrow-layout">

    <!-- 👉 移动端提示 -->
    <div v-if="isMobile" class="mobile-block">
      <h3>暂不支持移动端</h3>
      <p>
        管理员功能尚未针对手机端适配，当前界面在移动设备上可能严重错位。
        请使用桌面浏览器访问。
      </p>
    </div>

    <!-- 👉 正常登录界面 -->
    <div v-else class="right-box">
      <h3>开发者登录</h3>

      <input v-model="username" placeholder="用户名" class="ordinary-input form-item" />
      <input v-model="password" type="password" placeholder="密码" class="ordinary-input form-item" />

      <button
        @click="login"
        :disabled="loading"
        class="dev-normal-button dev-btn-small"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </div>

  </div>
</template>

<style>
.right-box {
  background: var(--app-bg-color);
  border: 1.5px solid var(--color-primary);
  border-radius: var(--border-radius-md);
  padding: 20px;
  line-height: 1.7;
  color: var(--color-text);
  margin-bottom: 30px;
}

.form-item {
  margin: 12px;
}

.mobile-block {
  background: var(--app-bg-color);
  border: 1.5px solid var(--color-primary);
  border-radius: var(--border-radius-md);
  padding: 24px;
  color: var(--color-text);
  text-align: center;
}
</style>