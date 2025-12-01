import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { initializeAuth } from './utils/auth'
import i18n from './internationalization.js'
import formattedTextDirective from './directives/formattedText'

// 导入全局样式
import './styles/main.css'

const app = createApp(App)

// 注册 Element Plus
app.use(ElementPlus)
app.use(i18n)   // 添加这一行
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