<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getToken } from '../../utils/auth.js'

const route = useRoute()
const {t} = useI18n()
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
      throw new Error(res.data.message || t('developer.load_failed'))
    }
    dashboard.value = res.data.data
  } catch (e) {
    error.value = e.message || t('developer.load_failed')
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="narrow-layout">
    <div class="right-box">
      <h3>{{ $t('developer.admin_title') }}</h3>
      <p>{{ $t('developer.admin_intro') }}</p>
      <p v-if="loading">{{ $t('developer.reading') }}</p>
      <p v-else-if="error" class="error-text">{{ error }}</p>
      <template v-else-if="dashboard">
        <p>{{ $t('developer.current_account') }}{{ dashboard.profile.username }}</p>
        <p>{{ $t('developer.admin_role') }}{{ dashboard.profile.admin ? $t('developer.yes') : $t('developer.no') }}</p>
      </template>
    </div>

    <div class="right-box">
      <h4>{{ $t('developer.management') }}</h4>
      <div class="d-flex flex-wrap gap-3">
        <router-link :to="getPath('profile')" class="dev-btn-middle dev-normal-button">{{ $t('developer.account_manage') }}</router-link>
        <router-link :to="getPath('home')" class="dev-btn-middle dev-normal-button">{{ $t('developer.dev_home') }}</router-link>
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
