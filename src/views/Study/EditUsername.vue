<script setup>
import { computed, ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { clearAuth, getStoredUser, getToken } from '../../utils/auth.js'
import { showError, showSuccess } from '../../services/ToastService.js'

const route = useRoute()
const router = useRouter()
const newUsername = ref('')
const saving = ref(false)
const currentUsername = computed(() => getStoredUser()?.username || '')
const profilePath = `/${route.params.language}/${route.params.dialect}/study/profile`

useHead({title: '修改用户名 · 豫章词'})

const save = async () => {
  const value = newUsername.value.trim()
  if (!value) return showError('请输入新用户名。')
  if (/^\d+$/.test(value)) return showError('用户名不能为纯数字。')
  if (value === currentUsername.value) return showError('新用户名不能与当前用户名相同。')

  saving.value = true
  try {
    const token = getToken()
    const response = await axios.post('/api/user/update-username', null, {
      params: {t: token, newUsername: value}
    })
    if (!response.data?.success) throw new Error(response.data?.message || '修改用户名失败。')

    // 后端修改用户名后会注销该账号的全部会话，需要重新登录。
    clearAuth()
    showSuccess('用户名已修改，请使用新用户名重新登录。')
    await router.replace(`/${route.params.language}/${route.params.dialect}/login`)
  } catch (exception) {
    console.error(exception)
    showError(exception.response?.data?.message || exception.message || '修改用户名失败。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="account-page account-edit-page">
    <section class="account-panel account-edit-card">
      <router-link class="account-back" :to="profilePath">‹ 返回个人中心</router-link>
      <p class="account-eyebrow">账号信息</p>
      <h1>修改用户名</h1>
      <p class="edit-description">当前用户名：<strong>{{ currentUsername }}</strong></p>

      <form class="account-form" @submit.prevent="save">
        <label for="new-username">新用户名</label>
        <input id="new-username" v-model="newUsername" autocomplete="username" placeholder="请输入新用户名" :disabled="saving" />
        <button class="account-primary-button" type="submit" :disabled="saving">
          {{ saving ? '正在保存…' : '保存修改' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style src="./account.css"></style>
