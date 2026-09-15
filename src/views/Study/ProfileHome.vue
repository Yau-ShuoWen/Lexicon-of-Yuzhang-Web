<script setup>
import { computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { getStoredUser, logout as authLogout } from '../../utils/auth.js'
import { showError, showSuccess } from '../../services/ToastService.js'

const route = useRoute()
const router = useRouter()
const currentUser = computed(() => getStoredUser())
const studyPath = (path) => `/${route.params.language}/${route.params.dialect}/study/${path}`

useHead({title: '个人中心 · 豫章词'})

const logout = async () => {
  try {
    await authLogout()
    showSuccess('已退出登录')
    await router.replace(`/${route.params.language}/${route.params.dialect}/login`)
  } catch (exception) {
    console.error(exception)
    showError('退出登录失败，请稍后再试。')
  }
}
</script>

<template>
  <main class="account-page">
    <section class="account-panel account-profile-header">
      <div class="profile-avatar" aria-hidden="true">{{ currentUser?.username?.slice(0, 1) || '我' }}</div>
      <div>
        <p class="account-eyebrow">个人中心</p>
        <h1>{{ currentUser?.username || '学习用户' }}</h1>
        <p>{{ currentUser?.phone || '管理你的账号信息与登录密码' }}</p>
      </div>
    </section>

    <section class="account-panel account-settings" aria-labelledby="settings-title">
      <h2 id="settings-title">账号设置</h2>

      <router-link class="settings-row" :to="studyPath('profile/username')">
        <span class="settings-icon settings-icon-blue" aria-hidden="true">名</span>
        <span class="settings-copy">
          <strong>修改用户名</strong>
          <small>当前：{{ currentUser?.username || '未设置' }}</small>
        </span>
        <span class="settings-arrow" aria-hidden="true">›</span>
      </router-link>

      <router-link class="settings-row" :to="studyPath('profile/password')">
        <span class="settings-icon settings-icon-coral" aria-hidden="true">密</span>
        <span class="settings-copy">
          <strong>修改密码</strong>
          <small>定期更新密码可以保护账号安全</small>
        </span>
        <span class="settings-arrow" aria-hidden="true">›</span>
      </router-link>

      <button class="settings-row settings-logout" type="button" @click="logout">
        <span class="settings-icon settings-icon-gray" aria-hidden="true">退</span>
        <span class="settings-copy">
          <strong>退出登录</strong>
          <small>退出当前账号</small>
        </span>
        <span class="settings-arrow" aria-hidden="true">›</span>
      </button>
    </section>
  </main>
</template>

<style src="./account.css"></style>
