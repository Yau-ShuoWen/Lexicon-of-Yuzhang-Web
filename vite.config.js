import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
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