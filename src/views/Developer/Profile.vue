<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { showError, showSuccess } from '../../services/ToastService.js'

const router = useRouter()
const route = useRoute()

const newUsername = ref('')
const oldPassword = ref('')
const newPassword = ref('')

const getToken = () => localStorage.getItem('auth-token')

// 统一跳转路径（和你项目风格一致）
const getLoginPath = () => `/${route.params.language}/${route.params.dialect}/dev/login`

const logout = async () => {
  try {
    await axios.post('/api/user/logout', null, {
      params: {
        t: getToken()
      }
    })

    localStorage.removeItem('auth-token')

    showSuccess('已退出登录')

    router.push({
      path: getLoginPath()
    })

  } catch (e) {
    console.error(e)
    showError('退出登录失败')
  }
}

const updateUsername = async () => {
  try {
    const res = await axios.post('/api/user/update-username', null, {
      params: {
        t: getToken(),
        newUsername: newUsername.value
      }
    })

    if (!res.data.success) throw new Error(res.data.message)

    showSuccess(res.data.message || '修改成功')

  } catch (e) {
    console.error(e)
    showError(e.message || '修改用户名失败')
  }
}

const updatePassword = async () => {
  try {
    const res = await axios.post('/api/user/update-password', null, {
      params: {
        t: getToken(),
        oldPassword: oldPassword.value,
        newPassword: newPassword.value
      }
    })

    if (!res.data.success) {
      throw new Error(res.data.message)
    }

    showSuccess(res.data.message || '修改成功')

  } catch (e) {
    console.error(e)
    showError(e.message || '修改密码失败')
  }
}
</script>

<template>
  <div class="narrow-layout">


    <div class="right-box">

      <h3>修改用户名</h3>

      <input v-model="newUsername" placeholder="新用户名" class="ordinary-input form-item"/>

      <button @click="updateUsername" class="dev-btn-small dev-normal-button form-item">
        修改用户名
      </button>

    </div>


    <div class="right-box">

      <h3>修改密码</h3>

      <input v-model="oldPassword" type="password" placeholder="旧密码" class="ordinary-input form-item"/>

      <input v-model="newPassword" type="password" placeholder="新密码" class="ordinary-input form-item"/>

      <button @click="updatePassword" class="dev-btn-small dev-normal-button form-item">
        修改密码
      </button>

    </div>
    <section>

    </section>


    <div class="right-box">
      <h3>退出登录</h3>

      <button @click="logout" class="dev-btn-small dev-normal-button form-item">
        确认退出
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
</style>