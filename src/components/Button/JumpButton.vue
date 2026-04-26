<template>
  <button @click="handleClick"
          class="dev-normal-button"
          :class="sizeClass">
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
    },

    /**
     * 统一解析跳转目标
     * 规则：默认继承 language + dialect
     */
    resolvedTo() {
      const {language, dialect} = this.$route.params

      // 已经是完整新结构
      if (this.to.startsWith(`/${language}/${dialect}/`))
        return this.to
      else return '/'
    }
  },

  methods: {
    handleClick() {
      this.$router.push(this.resolvedTo)
    }
  }
}
</script>
