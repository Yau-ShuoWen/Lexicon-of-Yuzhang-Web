<script setup>
import {ref, onMounted, onUnmounted} from 'vue'
import {useRouter} from 'vue-router'

const router = useRouter()
const isLoggedIn = ref(false)
const username = ref('')

const checkLoginStatus = () => {
  const token = localStorage.getItem('token')
  const storedUsername = localStorage.getItem('username')
  isLoggedIn.value = !!token
  username.value = storedUsername || ''
}

const handleStorageChange = (event) => {
  if (event.key === 'token' || event.key === 'username') {
    checkLoginStatus()
  }
}

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
      <router-link to="/" class="nav-link">首页</router-link>
      <router-link to="/search" class="nav-link">查询</router-link>
      <router-link to="/style" class="nav-link">样式</router-link>

      <template v-if="isLoggedIn">
        <router-link to="/profile" class="nav-link user-link">
          {{ username || '我的' }}
        </router-link>
      </template>
      <template v-else>
        <router-link to="/login" class="nav-link">登录</router-link>
      </template>

      <router-link to="/logo" class="nav-link">关于</router-link>
      <a href="https://github.com/Yau-ShuoWen" target="_blank" class="btn btn-ghost">
        <img src="./assets/icons/github.svg" alt="GitHub"
             style="width: 20px; height: 20px;vertical-align: middle;margin-right: var(--spacing-sm);"/>
      </a>
    </nav>

    <main class="page-container">
      <router-view></router-view>
    </main>
  </div>
</template>

<style scoped/>