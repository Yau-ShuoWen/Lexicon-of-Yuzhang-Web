<template>
  <span class="note-wrapper" @click.stop="toggle">
    <span class="note-trigger">[註]</span>

    <transition name="fade">
      <div v-if="visible" class="note-popup">
        {{ text }}
      </div>
    </transition>
  </span>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
});

const visible = ref(false);

function toggle() {
  visible.value = !visible.value;
}

function close() {
  visible.value = false;
}

onMounted(() => {
  document.addEventListener("click", close);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", close);
});
</script>

<style scoped>
.note-wrapper {
  position: relative;
  display: inline-block;
}

.note-trigger {
  font-size: 0.75em;
  color: #1a73e8;
  cursor: pointer;
  margin-left: 2px;
}

.note-popup {
  position: absolute;
  top: 1.5em;
  left: 0;
  background: #fff;
  border: 1px solid #ccc;
  padding: 6px 8px;
  font-size: 0.85em;
  line-height: 1.4;
  white-space: normal;
  max-width: 220px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  z-index: 999;
  border-radius: 4px;
}

/* 動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>