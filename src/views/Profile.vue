<!-- src/views/Profile.vue -->
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userInfo = ref(null)
const isLoading = ref(true)

// 获取用户信息
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
      // 如果获取用户信息失败，跳转到登录页
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

// 退出登录
const handleLogout = async () => {
  const token = localStorage.getItem('token')
  if (token) {
    try {
      await fetch(`/api/logout?token=${encodeURIComponent(token)}`)
    } catch (error) {
      console.error('退出登录失败:', error)
    }
  }

  // 清除本地存储
  localStorage.removeItem('token')
  localStorage.removeItem('username')

  // 触发存储事件，让App.vue能够检测到状态变化
  window.dispatchEvent(new Event('storage'))

  // 跳转到首页
  await router.push('/login')
}

onMounted(() => {
  fetchUserInfo()
})
</script>

<template>
  <!-- 模板部分保持不变 -->
  <div class="profile-container">
    <div class="profile-card">
      <h2 class="profile-title">个人信息</h2>

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
          <button @click="handleLogout" class="logout-button">
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
/* 样式保持不变 */
.profile-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.profile-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
}

.profile-title {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 28px;
  font-weight: 600;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item label {
  font-weight: 500;
  color: #555;
}

.info-item span {
  color: #333;
}

.status-active {
  color: #52c41a;
  font-weight: 500;
}

.actions {
  margin-top: 30px;
  text-align: center;
}

.logout-button {
  padding: 12px 30px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
}

.error-message {
  text-align: center;
  color: #ff4d4f;
  padding: 20px;
  background: #fff2f0;
  border-radius: 6px;
  border: 1px solid #ffccc7;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .profile-card {
    padding: 30px 20px;
  }

  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>