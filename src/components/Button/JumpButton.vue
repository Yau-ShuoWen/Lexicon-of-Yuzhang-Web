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
      const {language = 'sc', dialect = 'nam'} = this.$route.params

      // 1️⃣ 已经是完整新结构：/sc/nam/xxx
      if (this.to.startsWith(`/${language}/${dialect}/`)) {
        return this.to
      }

      // 2️⃣ 明确指定了 language（但没指定 dialect）
      if (
          this.to.startsWith('/sc/') ||
          this.to.startsWith('/tc/')
      ) {
        return this.to
      }

      // 3️⃣ 相对路径（about / test / xxx）
      if (!this.to.startsWith('/')) {
        return `/${language}/${dialect}/${this.to}`
      }

      // 4️⃣ 裸路径：/about → /sc/nam/about
      return `/${language}/${dialect}${this.to}`
    }
  },

  methods: {
    handleClick() {
      this.$router.push(this.resolvedTo)
    }
  }
}
</script>
