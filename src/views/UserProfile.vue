<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userInfo = ref(null)
const isLoading = ref(true)

const fetchUserInfo = async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
    return
  }

  try {
    const response = await fetch(`/api/userInfo?token=${encodeURIComponent(token)}`)
    const result = await response.json()

    if (result.success) {
      userInfo.value = result
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      router.push('/login')
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    router.push('/login')
  } finally {
    isLoading.value = false
  }
}

const handleLogout = async () => {
  const token = localStorage.getItem('token')
  if (token) {
    try {
      await fetch(`/api/logout?token=${encodeURIComponent(token)}`)
    } catch (error) {
      console.error('退出登录失败:', error)
    }
  }

  localStorage.removeItem('token')
  localStorage.removeItem('username')
  window.dispatchEvent(new Event('storage'))
  await router.push('/login')
}

onMounted(() => {
  fetchUserInfo()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">个人信息</h1>
    </div>

    <div class="card profile-card">
      <div v-if="isLoading" class="loading">
        加载中...
      </div>

      <div v-else-if="userInfo" class="user-info">
        <div class="info-item">
          <label>用户名：</label>
          <span>{{ userInfo.username }}</span>
        </div>

        <div class="info-item">
          <label>注册时间：</label>
          <span>{{ new Date().toLocaleDateString() }}</span>
        </div>

        <div class="info-item">
          <label>登录状态：</label>
          <span class="status-active">已登录</span>
        </div>

        <div class="actions">
          <button @click="handleLogout" class="btn btn-error">
            退出登录
          </button>
        </div>
      </div>

      <div v-else class="error-message">
        获取用户信息失败，请重新登录
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-card {
  max-width: 500px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-light);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.info-item label {
  font-weight: 500;
  color: var(--color-text-light);
}

.info-item span {
  color: var(--color-text);
}

.status-active {
  color: var(--color-success);
  font-weight: 500;
}

.actions {
  margin-top: var(--spacing-xl);
  text-align: center;
}

.error-message {
  text-align: center;
  color: var(--color-error);
  padding: var(--spacing-lg);
  background: #fff2f0;
  border-radius: var(--border-radius-md);
  border: 1px solid #ffccc7;
}

@media (max-width: 480px) {
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }
}
</style>