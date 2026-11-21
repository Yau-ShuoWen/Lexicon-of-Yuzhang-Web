<script setup>
import { useHead } from '@vueuse/head'
import { apiDiagnosticsEnabled, setApiDiagnosticsEnabled } from '../../services/apiDiagnostics.js'

useHead({ title: '调试模式' })
</script>

<template>
  <div class="debug-page">
    <h1>调试模式</h1>
    <section class="debug-settings" aria-label="调试设置">
      <div class="debug-setting">
        <div>
          <h2>接口诊断</h2>
          <p>开启后，页面右下角显示接口诊断入口，可查看请求状态并截图。</p>
        </div>
        <label class="switch-control" aria-label="显示接口诊断">
          <input type="checkbox" :checked="apiDiagnosticsEnabled" @change="setApiDiagnosticsEnabled($event.target.checked)">
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.debug-page { max-width: 900px; margin: 0 auto; padding: 42px 24px 80px; color: #202622; }
.debug-page h1 { margin: 0 0 24px; font-size: 28px; }
.debug-settings { border: 1px solid #dfe4e0; border-radius: 8px; background: #fff; }
.debug-setting { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px 22px; }
.debug-setting h2 { margin: 0 0 6px; font-size: 17px; }
.debug-setting p { margin: 0; color: #68716a; font-size: 13px; line-height: 1.5; }
.switch-control { position: relative; display: flex; align-items: center; flex: 0 0 auto; cursor: pointer; }
.switch-control input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.switch-track { position: relative; display: block; width: 46px; height: 26px; border-radius: 999px; background: #bdc5bf; transition: background .2s ease; }
.switch-thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px #0003; transition: transform .2s ease; }
.switch-control input:checked + .switch-track { background: #2e7245; }
.switch-control input:checked + .switch-track .switch-thumb { transform: translateX(20px); }
.switch-control input:focus-visible + .switch-track { outline: 2px solid #2e7245; outline-offset: 3px; }
@media (max-width: 600px) { .debug-page { padding: 28px 16px 60px; } .debug-setting { padding: 18px 16px; } }
</style>
