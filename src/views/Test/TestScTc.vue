<script setup>
import AutoProofreadText from "../../components/Text/AutoProofreadText.vue";
import JumpButton from "../../components/Button/JumpButton.vue";
import ScAndTcText from "../../components/Text/ScAndTcText.vue";
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";

const route = useRoute()
const router = useRouter()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
</script>

<template>
  <div class="container">


    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>

    <!-- 🆘 浮动帮助按钮（手册隐藏后显示） -->
    <button
        v-if="$route.query.help === 'hide'"
        class="btn btn-primary rounded-circle position-fixed"
        style="bottom: 24px; right: 24px; width: 56px; height: 56px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
        @click="$router.replace({ query: { ...$route.query, help: undefined } })"
        title="显示使用手册"
    >
      📖
    </button>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- 📚 新手使用手册（首次访问必看）                              -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="manual-card card mb-4" v-if="$route.query.help !== 'hide'">
      <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <h5 class="mb-0">📖 新手必看：3分钟学会使用简繁协作工具</h5>
        <button class="btn btn-sm btn-light" @click="$router.replace({ query: { ...$route.query, help: 'hide' } })">
          隐藏手册 ✕
        </button>
      </div>
      <div class="card-body">

        <!-- 🎯 核心概念 -->
        <div class="manual-section mb-4">
          <h6 class="section-title">🎯 这个工具是做什么的？</h6>
          <div class="alert alert-info">
            <strong>一句话总结</strong>：让你在编辑古籍繁体原文时，<u>自动同步生成简体校对稿</u>，
            且<strong>不会覆盖</strong>你已经手工校对好的内容！
          </div>
          <div class="row g-3">
            <div class="col-md-4">
              <div class="concept-card p-3 border rounded">
                <div class="concept-icon">🔤</div>
                <h6>繁体框（上/左）</h6>
                <p class="small mb-0">输入或粘贴<strong>古籍原文（繁体）</strong>，专家修订源文的地方</p>
              </div>
            </div>
            <div class="col-md-4">
              <div class="concept-card p-3 border rounded">
                <div class="concept-icon">🔡</div>
                <h6>简体框（下/右）</h6>
                <p class="small mb-0">显示<strong>自动转换的简体</strong>，你可手工校对修正</p>
              </div>
            </div>
            <div class="col-md-4">
              <div class="concept-card p-3 border rounded">
                <div class="concept-icon">🔄</div>
                <h6>智能同步</h6>
                <p class="small mb-0">修改繁体后按 <kbd>Ctrl+Enter</kbd>，<strong>只转换变化部分</strong>，保护你的校对成果</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ⌨️ 操作流程 -->
        <div class="manual-section mb-4">
          <h6 class="section-title">⌨️ 三步完成一次协作</h6>
          <div class="step-list">

            <div class="step-item d-flex mb-3">
              <div class="step-number bg-primary text-white rounded-circle flex-shrink-0">1</div>
              <div class="step-content ms-3">
                <strong>编辑繁体原文</strong>
                <p class="mb-2 small text-muted">在上方「繁體」框中输入或修改古籍内容</p>
                <div class="example-box bg-light p-2 rounded small">
                  💡 示例：把 <code>滕王閣序是</code> 改为 <code>滕王閣是</code>（删除"序"字）
                </div>
                <div class="status-tip">
                  <span class="badge bg-warning text-dark">⌨️繁</span>
                  状态图标出现 = 繁体有未同步的修改
                </div>
              </div>
            </div>

            <div class="step-item d-flex mb-3">
              <div class="step-number bg-primary text-white rounded-circle flex-shrink-0">2</div>
              <div class="step-content ms-3">
                <strong>触发智能转换</strong>
                <p class="mb-2 small text-muted">按下键盘 <kbd>Ctrl</kbd> + <kbd>Enter</kbd>（Mac：⌘+Enter）</p>
                <div class="alert alert-success py-2 small mb-2">
                  ✅ 系统会：<br>
                  • 对比新旧繁体，找出变化位置<br>
                  • <strong>只转换变化的字</strong>，其他部分直接复用你已校对的简体<br>
                  • 自动更新双框内容，状态重置
                </div>
                <div class="status-tip">
                  <span class="badge bg-success">✅</span>
                  看到对勾 = 简繁已同步，可继续操作
                </div>
              </div>
            </div>

            <div class="step-item d-flex mb-3">
              <div class="step-number bg-primary text-white rounded-circle flex-shrink-0">3</div>
              <div class="step-content ms-3">
                <strong>校对简体内容（可选）</strong>
                <p class="mb-2 small text-muted">如果自动转换的简体不准确，可在下方「簡體」框手工修正</p>
                <div class="example-box bg-light p-2 rounded small">
                  💡 示例：HanLP 把「髮」转成「发」，但你希望保留「髪」（古籍用字）→ 直接修改即可
                </div>
                <p class="mb-2 small text-muted">修改后同样按 <kbd>Ctrl+Enter</kbd> 确认保存</p>
                <div class="status-tip">
                  <span class="badge bg-info text-dark">⌨️简</span>
                  状态图标 = 简体有未确认的校对
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- 🚦 状态图标说明 -->
        <div class="manual-section mb-4">
          <h6 class="section-title">🚦 看懂状态图标（关键！）</h6>
          <div class="table-responsive">
            <table class="table table-sm table-borderless">
              <thead class="table-light">
              <tr>
                <th style="width: 80px">图标</th>
                <th>含义</th>
                <th>你能做什么</th>
              </tr>
              </thead>
              <tbody>
              <tr>
                <td class="text-center"><span class="badge bg-success">✅</span></td>
                <td><strong>已同步</strong><br><small class="text-muted">简繁内容一致，无未保存修改</small></td>
                <td>✅ 可自由编辑任意一框</td>
              </tr>
              <tr>
                <td class="text-center"><span class="badge bg-warning text-dark">⌨️繁</span></td>
                <td><strong>繁体待同步</strong><br><small class="text-muted">繁体框有修改，简体框已锁定</small></td>
                <td>• 继续编辑繁体<br>• 按 <kbd>Ctrl+Enter</kbd> 触发转换<br>• ❌ 此时不能改简体</td>
              </tr>
              <tr>
                <td class="text-center"><span class="badge bg-info text-dark">⌨️简</span></td>
                <td><strong>简体待确认</strong><br><small class="text-muted">简体框有手工校对，繁体框已锁定</small></td>
                <td>• 继续校对简体<br>• 按 <kbd>Ctrl+Enter</kbd> 确认保存<br>• ❌ 此时不能改繁体</td>
              </tr>
              <tr>
                <td class="text-center"><span class="badge bg-danger">❌</span></td>
                <td><strong>状态冲突</strong><br><small class="text-muted">简繁同时有未同步修改（异常）</small></td>
                <td>⚠️ 请：<br>• 点击「清除」重置<br>• 或刷新页面<br>• 联系开发者反馈</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ⚠️ 常见问题 -->
        <div class="manual-section">
          <h6 class="section-title">❓ 常见问题解答</h6>
          <div class="accordion" id="faqAccordion">

            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                  Q：为什么我改繁体时，简体框变灰不能输入？
                </button>
              </h2>
              <div id="faq1" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                <div class="accordion-body small">
                  <strong>这是保护机制！</strong> 🔒<br>
                  当你编辑繁体时，系统锁定简体框，防止你「同时改两边」导致数据冲突。<br>
                  👉 正确流程：改完繁体 → 按 Ctrl+Enter 同步 → 简体框解锁 → 再校对简体
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                  Q：按 Ctrl+Enter 没反应？可能原因？
                </button>
              </h2>
              <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                <div class="accordion-body small">
                  请检查：<br>
                  ✅ 是否真的按了 <kbd>Ctrl</kbd>（或 Mac 的 <kbd>⌘</kbd>）+ <kbd>Enter</kbd>？单独 Enter 无效<br>
                  ✅ 简繁字数是否相等？（生僻字可能导致计算偏差，尝试删除重输）<br>
                  ✅ 网络是否正常？（转换需调用后端 API）<br>
                  ✅ 是否正在提交中？（按钮变灰时需等待）
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                  Q：方言字（如「冇」「佢」）被错误转换了怎么办？
                </button>
              </h2>
              <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                <div class="accordion-body small">
                  系统支持<strong>保护特殊字符</strong>！🎯<br>
                  • 短期：在简体框手工改回，按 Ctrl+Enter 确认保存<br>
                  • 长期：联系管理员将你的方言字加入「免转换词典」<br>
                  • 高级：在 URL 添加 <code>?escape=冇,佢,哋</code> 临时指定保护字
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq4">
                  Q：「小布局」和「大布局」有什么区别？
                </button>
              </h2>
              <div id="faq4" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                <div class="accordion-body small">
                  • <strong>小布局（small）</strong>：单行输入框 + 紧凑按钮，适合短句、词条、快速测试<br>
                  • <strong>大布局（large）</strong>：多行文本域 + 独立操作区，适合段落、篇章、正式校对<br>
                  👉 功能完全一致，按需选择即可
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- 💡 高级技巧 -->
        <div class="manual-section mt-4 pt-3 border-top">
          <h6 class="section-title">💡 高级技巧 & 快捷操作</h6>
          <ul class="small mb-0">
            <li><kbd>Ctrl+Z</kbd>：在输入框内撤销上一步编辑（浏览器原生支持）</li>
            <li><kbd>Ctrl+A</kbd> → <kbd>Ctrl+C</kbd>：全选复制当前框内容</li>
            <li>点击「清除」按钮：一键重置双框内容 + 状态（慎用！）</li>
            <li>URL 添加 <code>?help=hide</code>：永久隐藏本手册（可在导航栏重新打开）</li>
            <li>遇到生僻字显示□？→ 请安装<a href="#" target="_blank">古籍字体包</a>或联系技术支持</li>
          </ul>
        </div>

      </div>
      <div class="card-footer text-muted small">
        📌 提示：本手册可随时通过 URL 参数 <code>?help=show</code> 重新显示
      </div>
    </div>
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- 📚 新手使用手册 结束                                          -->
    <!-- ═══════════════════════════════════════════════════════════ -->

    <!-- 下面是试用的部分 -->
    <div class="card">
      <div class="card-body">
        <h3 class="card-title">🔤 简繁转换框：小布局（适合短句/词条）</h3>
        <p class="text-muted small mb-3">
          💡 试试输入 <code>佢話冇人嚟</code> → 按 <kbd>Ctrl+Enter</kbd> → 观察「佢/冇/嚟」是否被保护
        </p>
        <ScAndTcText layout="small" :dialect="dialect.toString()"/>
      </div>

      <div class="card-body">
        <h3 class="card-title">🔤 简繁转换框：大布局（适合段落/篇章）</h3>
        <p class="text-muted small mb-3">
          💡 粘贴一段古籍原文，修改几个字后按 <kbd>Ctrl+Enter</kbd>，体验「增量转换」如何保护你的校对
        </p>
        <ScAndTcText layout="large" :dialect="dialect.toString()"/>
      </div>
    </div>



  </div>
</template>

<style scoped>
/* 📚 手册专用样式 */
.manual-card {
  border: 2px solid #0d6efd;
  box-shadow: 0 4px 20px rgba(13, 110, 253, 0.15);
}

.section-title {
  font-weight: 600;
  color: #1e293b;
  border-left: 4px solid #0d6efd;
  padding-left: 12px;
  margin-bottom: 16px;
}

.concept-card {
  height: 100%;
  transition: transform 0.2s, box-shadow 0.2s;
}
.concept-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.concept-icon {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.step-list {
  counter-reset: step-counter;
}
.step-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
}
.step-content {
  flex: 1;
}
.example-box {
  border-left: 3px solid #198754;
  margin: 8px 0;
}
.status-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #64748b;
}

.accordion-button:not(.collapsed) {
  background-color: #e7f1ff;
  color: #0d6efd;
  font-weight: 500;
}

/* 🎹 键盘快捷键样式 */
kbd {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.85em;
  color: #1e293b;
  box-shadow: inset 0 -2px 0 rgba(0,0,0,0.1);
}

/* 📱 响应式优化 */
@media (max-width: 768px) {
  .concept-card {
    margin-bottom: 12px;
  }
  .step-item {
    flex-direction: column;
  }
  .step-number {
    margin-bottom: 8px;
  }
  .step-content {
    margin-left: 0 !important;
  }
}
</style>