<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@vueuse/head'
import DeveloperQueryBar from './DeveloperQueryBar.vue'
import StreakAdmin from './Study/StreakAdmin.vue'
import { getToken } from '../../utils/auth.js'
import { searchAdminUsers, listAdminUsers, getAdminUser, updateAdminUserAccount, updateAdminUserSettings } from '../../services/adminUserApi.js'

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const searched = ref(false)
const user = ref(null)
const listedUsers = ref([])
const nextAfterId = ref(null)
const listLoading = ref(false)
const listLoaded = ref(false)
const tab = ref('account')
const account = ref({ username: '', phone: '' })
const scheme = ref('gon')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const tabs = [
  { id: 'account', label: '基本资料' },
  { id: 'permissions', label: '账号与权限' },
  { id: 'settings', label: '用户设置' },
  { id: 'streak', label: '连胜记录' }
]

const setUser = value => {
  user.value = value
  account.value = { username: value.username, phone: value.phone || '' }
  scheme.value = value.lacKeyboardScheme
  error.value = ''
}
const loadList = async (reset = false) => {
  if (listLoading.value) return
  listLoading.value = true
  if (reset) { listedUsers.value = []; nextAfterId.value = null; listLoaded.value = false }
  try {
    const page = await listAdminUsers(getToken(), reset ? 0 : nextAfterId.value || 0)
    listedUsers.value = reset ? page.users : [...listedUsers.value, ...page.users]
    nextAfterId.value = page.nextAfterId
    listLoaded.value = true
  } catch (e) { error.value = e.message || '读取用户列表失败' }
  finally { listLoading.value = false }
}
const showList = async () => {
  keyword.value = ''
  searched.value = false
  user.value = null
  error.value = ''
  message.value = ''
  await router.replace({ query: { ...route.query, userId: undefined } })
  if (!listLoading.value) await loadList(true)
}
const search = async () => {
  if (!keyword.value.trim()) { await showList(); return }
  loading.value = true
  searched.value = true
  error.value = ''
  message.value = ''
  user.value = null
  try {
    const found = await searchAdminUsers(getToken(), keyword.value.trim())
    if (found) {
      setUser(found)
      await router.replace({ query: { ...route.query, userId: String(found.id) } })
    } else {
      user.value = null
      await router.replace({ query: { ...route.query, userId: undefined } })
    }
  }
  catch (e) { error.value = e.message || '查询用户失败' }
  finally { loading.value = false }
}
const select = async id => {
  loading.value = true
  error.value = ''
  message.value = ''
  try {
    setUser(await getAdminUser(getToken(), id))
    await router.replace({ query: { ...route.query, userId: String(id) } })
  } catch (e) { error.value = e.message || '读取用户失败' }
  finally { loading.value = false }
}
const saveAccount = async () => {
  saving.value = true
  error.value = ''
  try { setUser(await updateAdminUserAccount(getToken(), user.value.id, account.value)); message.value = '基本资料已保存' }
  catch (e) { error.value = e.message || '保存失败' }
  finally { saving.value = false }
}
const saveSettings = async () => {
  saving.value = true
  error.value = ''
  try { setUser(await updateAdminUserSettings(getToken(), user.value.id, { lacKeyboardScheme: scheme.value })); message.value = '用户设置已保存' }
  catch (e) { error.value = e.message || '保存失败' }
  finally { saving.value = false }
}
watch(() => route.query.userId, id => {
  if (id && /^\d+$/.test(String(id)) && String(user.value?.id) !== String(id)) select(id)
  if (!id) {
    user.value = null
    if (!listLoaded.value) loadList(true)
  }
}, { immediate: true })
useHead({ title: '用户管理' })
</script>

<template>
  <main class="user-workspace">
    <div class="lookup-row">
      <section class="search-panel">
        <DeveloperQueryBar v-model="keyword" placeholder="用户名、手机号或用户 ID" button-text="查询用户" :loading="loading" @submit="search" />
        <p v-if="searched && !loading && !user && !error" class="note">没有找到匹配的用户</p>
      </section>
      <strong v-if="user" class="lookup-username">{{ user.username }}</strong>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="message" class="message" role="status">{{ message }}</p>
    <section v-if="!user" class="user-list" aria-label="用户列表">
      <p v-if="listLoading && !listedUsers.length" class="note">正在读取用户……</p>
      <p v-else-if="listLoaded && !listedUsers.length" class="note">暂无用户</p>
      <button v-for="item in listedUsers" :key="item.id" type="button" class="user-list-row" @click="select(item.id)">
        <strong>{{ item.username }}</strong><span>ID {{ item.id }}</span><span>{{ item.phone || '未绑定手机号' }}</span><span>{{ item.admin ? '管理员' : '普通用户' }}</span>
      </button>
      <button v-if="nextAfterId !== null" type="button" class="load-more" :disabled="listLoading" @click="loadList()">{{ listLoading ? '读取中……' : '加载更多' }}</button>
    </section>
    <template v-else>
      <button type="button" class="back-list" @click="showList">返回用户列表</button>
      <div class="user-meta"><span>用户 ID：{{ user.id }}</span><span>手机号：{{ user.phone || '未绑定' }}</span><span>{{ user.admin ? '管理员' : '普通用户' }}</span></div>
      <nav class="tabs" aria-label="用户资料分类">
        <button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button>
      </nav>
      <section v-if="tab === 'account'" class="content-panel">
        <h2>基本资料</h2>
        <label>用户名<input v-model="account.username" autocomplete="off" /></label>
        <label>手机号<input v-model="account.phone" inputmode="tel" placeholder="未绑定" /></label>
        <p class="note">修改用户名后，该用户的登录状态会失效，需要重新登录。</p>
        <div class="actions"><button type="button" @click="account = { username: user.username, phone: user.phone || '' }">取消修改</button><button type="button" :disabled="saving" @click="saveAccount">保存</button></div>
      </section>
      <section v-else-if="tab === 'permissions'" class="content-panel">
        <h2>账号与权限</h2><p>账号身份：{{ user.admin ? '管理员' : '普通用户' }}</p>
        <p>权限代码：{{ user.authority || '无' }}</p>
      </section>
      <section v-else-if="tab === 'settings'" class="content-panel">
        <h2>用户设置</h2>
        <label>键盘方案<select v-model="scheme"><option value="gon">官音</option><option value="yzc">豫章词</option></select></label>
        <div class="actions"><button type="button" @click="scheme = user.lacKeyboardScheme">取消修改</button><button type="button" :disabled="saving" @click="saveSettings">保存</button></div>
      </section>
      <section v-else class="content-panel streak-panel"><h2>连胜记录</h2><StreakAdmin :user="user" embedded /></section>
    </template>
  </main>
</template>

<style scoped>
.user-workspace { max-width: 1060px; margin: 0 auto; padding: 34px 24px 70px; color: var(--color-text); }
h1, h2, p { margin-top: 0; }
header p, .note, .identity p { color: var(--color-text-light); }
.lookup-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.search-panel { width: min(100%, 520px); }
.lookup-username { min-width: 0; overflow-wrap: anywhere; font-size: 1.5rem; }
.user-list { margin-top: 18px; border-top: 1px solid var(--color-border); }
.user-list-row { display: grid; grid-template-columns: minmax(120px, 1.5fr) 90px minmax(130px, 1fr) 90px; align-items: center; gap: 12px; width: 100%; padding: 14px 8px; border: 0; border-bottom: 1px solid var(--color-border); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.user-list-row:hover { background: var(--color-background-alt); }
.user-list-row span { color: var(--color-text-light); }
.load-more, .back-list { margin-top: 14px; padding: 8px 12px; border: 0; background: transparent; color: var(--color-primary-dark); cursor: pointer; }
.user-meta { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 16px; color: var(--color-text-light); font-size: .9rem; }
.content-panel { margin-top: 0; padding: 24px; border: 1px solid var(--color-border); border-radius: 0 0 14px 14px; background: var(--color-background-alt); }
.tabs { display: flex; gap: 6px; overflow-x: auto; margin-top: 20px; border-bottom: 1px solid var(--color-border); }
.tabs button { flex: none; padding: 12px 18px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.tabs button.active { border-bottom: 3px solid var(--color-primary); font-weight: 700; }
.content-panel { border-top: 0; }
label { display: grid; gap: 7px; max-width: 470px; margin: 18px 0; }
input, select { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: white; color: inherit; }
.actions { display: flex; gap: 10px; margin-top: 22px; }.actions button { padding: 9px 20px; border: 1px solid var(--color-primary); border-radius: 8px; background: white; color: var(--color-primary-dark); cursor: pointer; }.actions button:last-child { background: var(--color-primary); color: white; }.actions button:disabled { opacity: .5; }
.error { margin-top: 16px; color: #a33; }.message { margin-top: 16px; color: var(--color-primary-dark); }
@media (max-width: 650px) { .user-workspace { padding: 20px 14px 45px; }.lookup-row { gap: 12px; }.lookup-username { font-size: 1.1rem; }.user-list-row { grid-template-columns: 1fr auto; }.content-panel { padding: 16px; }.streak-panel { padding: 12px; } }
</style>
