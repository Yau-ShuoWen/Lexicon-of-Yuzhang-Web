<script setup>
import {ref} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const loading = ref(false)

const login = async () => {
  if (!username.value || !password.value) {
    alert('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    const res = await axios.post('/api/user/login', null, {
      params: {
        username: username.value,
        password: password.value
      }
    })

    if (res.data.success) {
      localStorage.setItem('auth-token', res.data.data)
      alert('登录成功')

      // 登录后回到开发者首页
      router.back();
    } else {
      alert(res.data.message)
    }
  } catch (e) {
    alert('登录失败，无法连接服务器')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="narrow-layout">

    <h2>开发者登录</h2>

    <div class="form-item">
      <input v-model="username" placeholder="用户名" class="ordinary-input"/>
    </div>

    <div class="form-item">
      <input
          v-model="password"
          type="password"
          placeholder="密码"
          class="ordinary-input"
      />
    </div>

    <button :disabled="loading" @click="login" class="dev-normal-button dev-btn-small">
      {{ loading ? '登录中...' : '登录' }}
    </button>
  </div>
</template>

<style>
.form-item {
  margin-bottom: 12px;
}
</style>
