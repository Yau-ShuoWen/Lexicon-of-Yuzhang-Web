<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { diagnosticEntries, clearDiagnostics } from '../../services/apiDiagnostics.js'
import { token, user } from '../../utils/auth.js'

const route = useRoute()
const open = ref(false)
const entries = computed(() => [...diagnosticEntries.value].reverse())
const diaryPermissions = computed(() => {
  const permissions = user.value?.permissions
  if (Array.isArray(permissions)) return permissions.filter(value => String(value).startsWith('diary.read.')).join('、') || '无'
  return user.value?.authority ? '请看接口记录' : '无'
})
const requestedView = computed(() => String(route.query.view || '未指定'))
</script>

<template>
  <button class="api-diagnostics-entry" type="button" @click="open = true">接口诊断{{ diagnosticEntries.length ? ` ${diagnosticEntries.length}` : '' }}</button>
  <div v-if="open" class="api-diagnostics-backdrop" @click.self="open = false">
    <section class="api-diagnostics-panel" role="dialog" aria-modal="true" aria-label="接口诊断">
      <header class="api-diagnostics-header">
        <strong>接口诊断</strong>
        <button type="button" @click="open = false">关闭</button>
      </header>
      <div class="api-diagnostics-body">
        <p>当前页面：{{ route.path }}</p>
        <p>当前视角：{{ requestedView }}　登录凭据：{{ token ? '本地存在' : '本地无' }}</p>
        <p>本地日记权限：{{ diaryPermissions }}</p>
        <p class="api-diagnostics-note">按时间倒序，保留最近 35 条；刷新后仍可查看。截图时请包含失败记录和其前后的登录状态记录。</p>
        <div v-if="!entries.length" class="api-diagnostics-empty">暂无请求记录</div>
        <article v-for="(entry, index) in entries" :key="index" class="api-diagnostics-record" :class="{ 'is-failure': entry.status === '失败' || entry.status === '视角降级' }">
          <div><strong>{{ entry.type }} · {{ entry.status }}</strong> <span>{{ entry.time }}</span></div>
          <div v-if="entry.path">{{ entry.method }} {{ entry.path }}</div>
          <div v-if="entry.page">发生页面：{{ entry.page }}</div>
          <div v-if="entry.duration != null">耗时：{{ entry.duration }} ms　HTTP：{{ entry.httpStatus || '无响应' }}　错误码：{{ entry.code || '无' }}</div>
          <div v-if="entry.kind">类型：{{ entry.kind }}</div>
          <div v-if="entry.message">详情：{{ entry.message }}</div>
          <div v-if="entry.viewMode">日记实际视角：{{ entry.viewMode }}</div>
          <div v-if="entry.availableViews?.length">日记可用视角：{{ entry.availableViews.join('、') }}</div>
          <div v-if="entry.diaryLevel">验证得到的日记权限：{{ entry.diaryLevel }}</div>
        </article>
      </div>
      <footer class="api-diagnostics-footer"><button type="button" @click="clearDiagnostics">清空记录</button></footer>
    </section>
  </div>
</template>

<style scoped>
.api-diagnostics-entry { position: fixed; z-index: 1800; right: 10px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); padding: 7px 10px; border: 1px solid #52645b; border-radius: 6px; color: #253e32; background: #fff; font-size: 12px; box-shadow: 0 1px 5px #0002; }
.api-diagnostics-backdrop { position: fixed; z-index: 3000; inset: 0; display: flex; align-items: center; justify-content: center; padding: 12px; background: #0009; }
.api-diagnostics-panel { display: flex; flex-direction: column; width: min(100%, 640px); max-height: calc(100dvh - 24px); background: #fff; color: #1c2922; border-radius: 8px; overflow: hidden; font-size: 13px; }
.api-diagnostics-header, .api-diagnostics-footer { display: flex; justify-content: space-between; align-items: center; flex: none; padding: 12px 14px; border-bottom: 1px solid #ddd; }
.api-diagnostics-footer { border-top: 1px solid #ddd; border-bottom: 0; justify-content: flex-end; }
.api-diagnostics-header button, .api-diagnostics-footer button { padding: 5px 9px; border: 1px solid #aaa; border-radius: 4px; background: #fff; color: inherit; }
.api-diagnostics-body { overflow: auto; padding: 12px 14px; overflow-wrap: anywhere; }
.api-diagnostics-body p { margin: 0 0 7px; }
.api-diagnostics-note { color: #536158; }
.api-diagnostics-empty { padding: 16px 0; }
.api-diagnostics-record { padding: 10px 0; border-top: 1px solid #ddd; line-height: 1.55; }
.api-diagnostics-record.is-failure { color: #8a3027; }
.api-diagnostics-record span { color: #66736c; font-size: 11px; }
@media (max-width: 768px) { .api-diagnostics-entry { bottom: calc(98px + env(safe-area-inset-bottom, 0px)); } }
</style>
