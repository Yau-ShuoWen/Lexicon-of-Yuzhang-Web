<template>
  <button @click="handleClick" class="dev-normal-button" :class="sizeClass">
    {{ buttonText }}
  </button>
</template>

<script>
export default {
  name: 'JumpButton',
  props: {
    to: {
      type: String,
      required: true
    },
    buttonText: {
      type: String,
      default: '跳转'
    },
    size: {
      type: String,
      default: 'small',
    }
  },
  computed: {
    sizeClass() {
      return `dev-btn-${this.size}`
    }
  },
  methods: {
    handleClick() {
      this.$router.push(this.to)
    }
  }
}
</script>

<style/>