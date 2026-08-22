<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { getToken } from '../../utils/auth.js'

const route = useRoute()
const getPath = (path) => `/${route.params.language}/${route.params.dialect}/dev/${path}`
const dashboard = ref(null)
const loading = ref(false)
const error = ref('')

const loadDashboard = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get('/api/admin/dashboard', {
      params: { t: getToken() }
    })
    if (!res.data.success) {
      throw new Error(res.data.message || '加载失败')
    }
    dashboard.value = res.data.data
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="narrow-layout">
    <div class="right-box">
      <h3>管理员后台框架</h3>
      <p>这里先放管理员专用入口，后续会接权限校验、用户管理、验证码审计和内容审核。</p>
      <p v-if="loading">正在读取后台数据...</p>
      <p v-else-if="error" class="error-text">{{ error }}</p>
      <template v-else-if="dashboard">
        <p>当前账号：{{ dashboard.profile.username }}</p>
        <p>角色：admin = {{ dashboard.profile.admin ? '是' : '否' }}</p>
      </template>
    </div>

    <div class="right-box">
      <h4>管理入口</h4>
      <div class="d-flex flex-wrap gap-3">
        <router-link :to="getPath('profile')" class="dev-btn-middle dev-normal-button">账号管理</router-link>
        <router-link :to="getPath('home')" class="dev-btn-middle dev-normal-button">开发后台</router-link>
      </div>
      <div v-if="dashboard?.modules?.length" class="module-list">
        <span v-for="module in dashboard.modules" :key="module" class="module-tag">{{ module }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.right-box {
  background: var(--app-bg-color);
  border: 1.5px solid var(--color-primary);
  border-radius: var(--border-radius-md);
  padding: 20px;
  margin-bottom: 30px;
}

.module-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.module-tag {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,.05);
  font-size: .9rem;
}

.error-text {
  color: #b42318;
}
</style>
