<script setup>
import { ref } from 'vue'
import eyeOpen from '../../assets/icons/eye-open.svg'
import eyeClosed from '../../assets/icons/eye-closed.svg'

defineOptions({inheritAttrs: false})

defineProps({
  modelValue: {type: String, default: ''},
  disabled: {type: Boolean, default: false}
})

defineEmits(['update:modelValue'])

const visible = ref(false)
</script>

<template>
  <div class="password-input-wrap">
    <input
      v-bind="$attrs"
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <button
      class="password-visibility"
      type="button"
      :disabled="disabled"
      :aria-label="visible ? '隐藏密码' : '显示密码'"
      :title="visible ? '隐藏密码' : '显示密码'"
      @click="visible = !visible"
    >
      <img :src="visible ? eyeOpen : eyeClosed" alt="" aria-hidden="true" />
    </button>
  </div>
</template>
