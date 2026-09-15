import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    build: {
        // 主包包含完整的字典页面与 Element Plus，当前体积属于预期范围。
        chunkSizeWarningLimit: 1400,
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            // OSS / 音频上传测试接口
            '/upload': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            '/oss': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            }
        }
    }
})
