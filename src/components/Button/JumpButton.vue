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
    },

    /**
     * 计算最终跳转路径
     */
    resolvedTo() {
      const currentLang = this.$route.params.lang || 'sc'

      // 已经是 /sc/... 或 /tc/...，直接返回
      if (this.to.startsWith('/sc/') || this.to.startsWith('/tc/')) {
        return this.to
      }

      // 不是绝对路径（极少见，但保险）
      if (!this.to.startsWith('/')) {
        return `/${currentLang}/${this.to}`
      }

      // 普通裸路径：/about → /sc/about
      return `/${currentLang}${this.to}`
    }
  },
  methods: {
    handleClick() {
      this.$router.push(this.resolvedTo)
    }
  }
}
</script>
