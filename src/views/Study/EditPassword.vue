<script setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { clearAuth, getToken } from '../../utils/auth.js'
import { showError, showSuccess } from '../../services/ToastService.js'
import PasswordInput from '../../components/Form/PasswordInput.vue'

const route = useRoute()
const router = useRouter()
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const profilePath = `/${route.params.language}/${route.params.dialect}/study/profile`

useHead({title: '修改密码 · 豫章词'})

const save = async () => {
  if (!oldPassword.value) return showError('请输入当前密码。')
  if (!newPassword.value) return showError('请输入新密码。')
  if (newPassword.value !== confirmPassword.value) return showError('两次输入的新密码不一致。')
  if (newPassword.value === oldPassword.value) return showError('新密码不能与当前密码相同。')

  saving.value = true
  try {
    const response = await axios.post('/api/user/update-password', null, {
      params: {t: getToken(), oldPassword: oldPassword.value, newPassword: newPassword.value}
    })
    if (!response.data?.success) throw new Error(response.data?.message || '修改密码失败。')

    // 后端修改密码后会注销该账号的全部会话，需要重新登录。
    clearAuth()
    showSuccess('密码已修改，请使用新密码重新登录。')
    await router.replace(`/${route.params.language}/${route.params.dialect}/login`)
  } catch (exception) {
    console.error(exception)
    showError(exception.response?.data?.message || exception.message || '修改密码失败。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="account-page account-edit-page">
    <section class="account-panel account-edit-card">
      <router-link class="account-back" :to="profilePath">‹ 返回个人中心</router-link>
      <p class="account-eyebrow">账号安全</p>
      <h1>修改密码</h1>
      <p class="edit-description">设置一个不容易被猜到的新密码。</p>

      <form class="account-form" @submit.prevent="save">
        <label for="old-password">当前密码</label>
        <PasswordInput id="old-password" v-model="oldPassword" autocomplete="current-password" placeholder="请输入当前密码" :disabled="saving" />

        <label for="new-password">新密码</label>
        <PasswordInput id="new-password" v-model="newPassword" autocomplete="new-password" placeholder="请输入新密码" :disabled="saving" />

        <label for="confirm-password">确认新密码</label>
        <PasswordInput id="confirm-password" v-model="confirmPassword" autocomplete="new-password" placeholder="请再次输入新密码" :disabled="saving" />

        <button class="account-primary-button" type="submit" :disabled="saving">
          {{ saving ? '正在保存…' : '保存修改' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style src="./account.css"></style>
