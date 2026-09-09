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

// 后端暂时不可用时，统一处理超时、刷新和恢复探测。
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

// 初始化认证状态
initializeAuth().then(() => {
    app.mount('#app')
})
