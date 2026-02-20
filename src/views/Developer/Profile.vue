<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const token = localStorage.getItem('auth-token')

// 修改用户名
const newUsername = ref('')

// 修改密码
const oldPassword = ref('')
const newPassword = ref('')

const logout = async () => {
  try {
    await axios.post('/api/user/logout', null, {
      params: { t: token }
    })
  } finally {
    localStorage.removeItem('auth-token')
    alert('已退出登录')
    router.push({
      name: 'DeveloperHome',
      params: route.params
    })
  }
}

const updateUsername = async () => {
  if (!newUsername.value) {
    alert('请输入新用户名')
    return
  }

  const res = await axios.post('/api/user/update-username', null, {
    params: {
      t: token,
      newUsername: newUsername.value
    }
  })

  alert(res.data.message)
}

const updatePassword = async () => {
  if (!oldPassword.value || !newPassword.value) {
    alert('请输入完整密码')
    return
  }

  const res = await axios.post('/api/user/update-password', null, {
    params: {
      t: token,
      oldPassword: oldPassword.value,
      newPassword: newPassword.value
    }
  })

  alert(res.data.message)
}
</script>

<template>
  <div class="profile-container">
    <h2>管理面板</h2>

    <section>
      <h3>修改用户名</h3>
      <input v-model="newUsername" placeholder="新用户名"  class="ordinary-input"/>
      <button @click="updateUsername" class="dev-btn-small dev-normal-button">确认修改</button>
    </section>

    <section>
      <h3>修改密码</h3>
      <input v-model="oldPassword" type="password" placeholder="旧密码"  class="ordinary-input"/>
      <input v-model="newPassword" type="password" placeholder="新密码"  class="ordinary-input"/>
      <button @click="updatePassword" class="dev-btn-small dev-normal-button">确认修改</button>
    </section>

    <hr />

    <button @click="logout" class="dev-btn-small dev-normal-button">退出登录</button>
  </div>
</template>

<style scoped>
.profile-container {
  max-width: 400px;
  margin: 40px auto;
}
section {
  margin-bottom: 20px;
}
input {
  display: block;
  width: 100%;
  margin-bottom: 8px;
  padding: 6px;
}
button {
  margin-top: 4px;
}
</style>
