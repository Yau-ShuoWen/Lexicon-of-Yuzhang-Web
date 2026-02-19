<script setup>
import {useConfirmState, resolveConfirm} from "../../services/confirmService"

const {visible, options} = useConfirmState()
</script>

<template>

  <div v-if="visible" class="modal-overlay" @click.self="resolveConfirm(false)">

    <div class="modal-content">

      <h3>{{ options.title }}</h3>
      <p v-if="options.message">{{ options.message }}</p>
      <div class="modal-actions">

        <button
            v-for="(btn,i) in options.actions"
            :key="i" :class="btn.class"
            @click="resolveConfirm(btn.key)">
          {{ btn.text }}
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
