<template>
  <button @click="goBack" class="dev-normal-button" :class="sizeClass">
    {{ buttonText || $t('common.back') }}
  </button>
</template>

<script>
export default {
  name: 'BackButton',
  props: {
    buttonText: {
      type: String,
      default: ''
    },
    size: {
      type: String,
      default: 'small'
    }
  },
  computed: {
    sizeClass() {
      return `dev-btn-${this.size}`
    }
  },
  methods: {
    goBack() {
      this.$router.back();
    }
  }
}
</script>

<style/>
