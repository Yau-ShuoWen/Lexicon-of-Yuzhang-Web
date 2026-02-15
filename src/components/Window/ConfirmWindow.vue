<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: { type: String, default: '确认' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' }
})

const emit = defineEmits(['confirm', 'cancel'])

const visible = ref(false)

function open() {
  visible.value = true
}

function close() {
  visible.value = false
}

function onConfirm() {
  emit('confirm')
  close()
}

function onCancel() {
  emit('cancel')
  close()
}

defineExpose({ open, close })
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="onCancel">
    <div class="modal-content">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>

      <div class="modal-actions">
        <button class="dev-btn-small dev-remove-btn" @click="onConfirm">
          {{ confirmText }}
        </button>
        <button class="dev-btn-small" @click="onCancel">
          {{ cancelText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
