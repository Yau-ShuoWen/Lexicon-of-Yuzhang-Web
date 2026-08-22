<script setup>
import { ref, watch } from 'vue'
import { showError } from '../../services/ToastService.js'
import LoadingIcon from '../../components/Status/LoadingIcon.vue'
import AlphabetTransferItem from './AlphabetTransferItem.vue'

const props = defineProps({
  code: { type: String, required: true },
  language: { type: String, required: true }
})

const loading = ref(false)
const transferList = ref([])

async function fetchTransfers() {
  try {
    loading.value = true
    const res = await fetch(`/api/alphabet/trans/${props.code}/${props.language}`)
    if (!res.ok) throw new Error(res.status)

    const data = await res.json()
    transferList.value = data.map(item => ({
      name: item.left,
      funName: item.right
    }))
  } catch (e) {
    console.error(e)
    transferList.value = []
    showError('加载转换器失败')
  } finally {
    loading.value = false
  }
}

watch(() => [props.code, props.language], fetchTransfers, { immediate: true })
</script>

<template>
  <section v-if="loading || transferList.length" class="transfer-box">
    <header class="transfer-hero">
      <div class="transfer-hero-text">
        <h2 class="transfer-heading">拼写转换</h2>
      </div>
    </header>

    <LoadingIcon v-if="loading" key="loading" class="transfer-loading" />

    <div v-else key="content" class="transfer-grid">
      <AlphabetTransferItem
        v-for="item in transferList"
        :key="item.funName"
        :code="code"
        :language="language"
        :name="item.name"
        :fun-name="item.funName"
      />
    </div>
  </section>
</template>

<style scoped>
.transfer-box {
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);
  background:
    radial-gradient(circle at top right, rgba(74, 111, 200, 0.10), transparent 28%),
    radial-gradient(circle at bottom left, rgba(46, 125, 50, 0.10), transparent 24%),
    linear-gradient(180deg, #ffffff 0%, #f8fbf8 100%);
  box-shadow: var(--shadow-sm);
  opacity: 0;
  animation: fadeInUp 0.55s ease 0.1s both;
}

.transfer-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.transfer-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 700;
}

.transfer-heading {
  margin: 0 0 6px;
  font-size: 24px;
  line-height: 1.2;
  color: #34495e;
}

.transfer-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-light);
}

.transfer-hero-badge {
  flex: 0 0 auto;
  min-width: 54px;
  height: 54px;
  padding: 0 14px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(74, 111, 200, 0.22);
}

.transfer-loading {
  padding: 24px 0 8px;
}

.transfer-grid {
  display: grid;
  gap: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 750px) {
  .transfer-box {
    padding: 18px;
  }

  .transfer-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .transfer-hero-badge {
    width: fit-content;
    min-width: 48px;
    height: 48px;
    border-radius: 16px;
    font-size: 18px;
    box-shadow: 0 8px 18px rgba(74, 111, 200, 0.18);
  }
}

@media (max-width: 500px) {
  .transfer-box {
    padding: 16px;
  }

  .transfer-hero {
    gap: 12px;
    margin-bottom: 14px;
  }

  .transfer-kicker {
    margin-bottom: 6px;
    font-size: 11px;
    letter-spacing: 1.6px;
  }

  .transfer-heading {
    font-size: 21px;
  }

  .transfer-subtitle {
    font-size: 13px;
  }

  .transfer-hero-badge {
    min-width: 44px;
    height: 44px;
    padding: 0 12px;
    font-size: 16px;
  }
}
</style>
