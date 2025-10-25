<!-- src/App.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoggedIn = ref(false)
const username = ref('')

// 检查登录状态
const checkLoginStatus = () => {
  const token = localStorage.getItem('token')
  const storedUsername = localStorage.getItem('username')
  isLoggedIn.value = !!token
  username.value = storedUsername || ''
}

// 处理退出登录
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
  isLoggedIn.value = false
  username.value = ''

  // 跳转到首页
  router.push('/')
}

// 监听存储变化
const handleStorageChange = (event) => {
  if (event.key === 'token' || event.key === 'username') {
    checkLoginStatus()
  }
}

// 监听路由变化，确保状态同步
router.afterEach(() => {
  checkLoginStatus()
})

onMounted(() => {
  checkLoginStatus()
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
})
</script>

<template>
  <div id="app">
    <nav class="main-nav">
      <router-link id="link" to="/">首页</router-link>
      <router-link id="link" to="/search">查询</router-link>
      <router-link id="link" to="/style">样式</router-link>
      <router-link id="link" to="/contact">联系</router-link>

      <!-- 动态显示登录/用户信息 -->
      <template v-if="isLoggedIn">
        <router-link id="link" to="/profile" class="user-link">
          {{ username || '我的' }}
        </router-link>
      </template>
      <template v-else>
        <router-link id="link" to="/login">登录</router-link>
      </template>

      <router-link id="link" to="/test">测试</router-link>
      <router-link id="link" to="/logo">技术支持</router-link>
    </nav>

    <!-- 主要内容区域 -->
    <div style="padding: 20px 0;">
      <router-view></router-view>
    </div>
  </div>
</template>

<style scoped>
#app {
  font-family: MiSans, sans-serif;
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
}

#link {
  text-decoration: none;
}

.main-nav {
  padding: 20px;
  background: #f0f0f0;
  width: 100%;
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 50px;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
}

.main-nav a {
  text-decoration: none;
  color: black;
  transition: color 0.3s ease;
}

.main-nav a:hover {
  color: #667eea;
}

.main-nav a.router-link-active {
  color: #667eea;
  font-weight: 500;
}

.user-link {
  color: #52c41a !important;
  font-weight: 500;
}
</style>