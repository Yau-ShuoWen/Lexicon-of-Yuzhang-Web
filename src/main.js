import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { initializeAuth } from './utils/auth'
import i18n from './internationalization.js'
import formattedTextDirective from './utils/formattedText.js'
import { createHead } from '@vueuse/head'
import { installNetworkRecovery } from './services/networkRecovery.js'

// 导入全局样式
import './styles/main.css'

// 保留网络错误分类入口；不再全局设置超时或刷新页面。
installNetworkRecovery()

const app = createApp(App)

app.use(ElementPlus)
app.use(i18n)
app.use(createHead())
app.directive('formatted-text', formattedTextDirective)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

app.use(router)

// 页面渲染不能依赖后端认证请求完成，否则调试断点会让整个应用白屏。
app.mount('#app')
void initializeAuth()
