import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initializeAuth } from './utils/auth'

const app = createApp(App)
app.use(router)

// 初始化认证状态
initializeAuth().then(() => {
    app.mount('#app')
})