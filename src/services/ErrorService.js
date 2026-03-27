import { ref } from 'vue'

const errors = ref([])

export function useErrorState() {
    return { errors }
}

// 通用添加訊息函數
function addMessage(message, type = 'error', duration = 3000) {
    const id = Date.now() + Math.random()  // 確保唯一
    errors.value.push({ id, message, type })

    setTimeout(() => {
        errors.value = errors.value.filter(e => e.id !== id)
    }, duration)
}

// 對外 API
export function showError(message, duration) {
    addMessage(message, 'error', duration)
}

export function showSuccess(message, duration) {
    addMessage(message, 'success', duration)
}

export function showWarning(message, duration) {
    addMessage(message, 'warning', duration)
}