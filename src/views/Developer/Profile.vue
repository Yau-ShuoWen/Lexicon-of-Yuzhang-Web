<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { showError, showSuccess } from '../../services/ToastService.js'
import { logout as authLogout, getToken } from '../../utils/auth.js'

const router = useRouter()
const route = useRoute()
const {t} = useI18n()

const newUsername = ref('')
const oldPassword = ref('')
const newPassword = ref('')

// 统一跳转路径（和你项目风格一致）
const getLoginPath = () => `/${route.params.language}/${route.params.dialect}/login`

const logout = async () => {
  try {
    await authLogout()
    showSuccess(t('account.profile.logged_out'))

    router.push({
      path: getLoginPath()
    })

  } catch (e) {
    console.error(e)
    showError(t('developer.logout_failed'))
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

    showSuccess(res.data.message || t('developer.updated'))

  } catch (e) {
    console.error(e)
    showError(e.message || t('developer.update_username_failed'))
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

    showSuccess(res.data.message || t('developer.updated'))

  } catch (e) {
    console.error(e)
    showError(e.message || t('developer.update_password_failed'))
  }
}
</script>

<template>
  <div class="narrow-layout">


    <div class="right-box">

      <h3>{{ $t('developer.change_username') }}</h3>

      <input v-model="newUsername" :placeholder="$t('developer.new_username')" class="ordinary-input form-item"/>

      <button @click="updateUsername" class="dev-btn-small dev-normal-button form-item">
        {{ $t('developer.change_username') }}
      </button>

    </div>


    <div class="right-box">

      <h3>{{ $t('account.password.title') }}</h3>

      <input v-model="oldPassword" type="password" :placeholder="$t('developer.old_password')" class="ordinary-input form-item"/>

      <input v-model="newPassword" type="password" :placeholder="$t('developer.new_password')" class="ordinary-input form-item"/>

      <button @click="updatePassword" class="dev-btn-small dev-normal-button form-item">
        {{ $t('account.password.title') }}
      </button>

    </div>
    <section>

    </section>


    <div class="right-box">
      <h3>{{ $t('developer.logout') }}</h3>

      <button @click="logout" class="dev-btn-small dev-normal-button form-item">
        {{ $t('developer.confirm_logout') }}
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
