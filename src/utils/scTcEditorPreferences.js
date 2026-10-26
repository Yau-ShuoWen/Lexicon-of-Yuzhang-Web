import { ref, watch } from 'vue'

const key = 'sc-tc-editor-actions-expanded'
export const actionsExpanded = ref(localStorage.getItem(key) === 'true')
watch(actionsExpanded, value => localStorage.setItem(key, String(value)))
