import {createI18n} from 'vue-i18n'
import zhCN from './locales/sc.js'
import zhTW from './locales/tc.js'

// 获取保存的语言设置或默认简体中文
const savedLocale = localStorage.getItem('user-language') || 'sc'

const i18n = createI18n({
    legacy: false, // 使用 Composition API 模式
    locale: savedLocale, // 当前语言
    fallbackLocale: 'sc', // 回退语言
    messages: {
        'sc': zhCN,
        'tc': zhTW
    }
})

export default i18n