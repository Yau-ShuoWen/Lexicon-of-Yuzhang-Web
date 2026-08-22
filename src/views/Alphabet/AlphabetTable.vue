<script setup>
import { computed, ref, watch } from 'vue'
import { showError } from '../../services/ToastService.js'
import AlphabetTableGrid from './AlphabetTableGrid.vue'
import TableSkeleton from '../../components/Status/TableSkeleton.vue'

const props = defineProps({
  code: { type: String, required: true },
  language: { type: String, required: true }
})

const loading = ref(false)
const showSkeleton = ref(false)
const pinyinData = ref([])
let skeletonTimer = null

const hasData = computed(() => pinyinData.value.length > 0)

function startLoading() {
  loading.value = true
  showSkeleton.value = false
  clearTimeout(skeletonTimer)
  skeletonTimer = setTimeout(() => {
    if (loading.value && !hasData.value) showSkeleton.value = true
  }, 160)
}

function stopLoading() {
  loading.value = false
  showSkeleton.value = false
  clearTimeout(skeletonTimer)
}

async function fetchTable() {
  try {
    startLoading()
    const res = await fetch(`/api/alphabet/table/new/${props.code}/${props.language}`)
    if (!res.ok) throw new Error(res.status)

    const data = await res.json()
    pinyinData.value = data.table
  } catch (e) {
    console.error(e)
    pinyinData.value = []
    showError('加载拼音表失败')
  } finally {
    stopLoading()
  }
}

watch(() => [props.code, props.language], fetchTable, { immediate: true })
</script>

<template>
  <div class="alphabet-table-host">
    <TableSkeleton
      v-if="showSkeleton"
      key="skeleton"
      :groups="3"
      :rows="2"
      :cols="6"
    />

    <div v-else-if="hasData" key="content" class="alphabet-table-block">
      <AlphabetTableGrid
        v-for="(grid, gridIndex) in pinyinData"
        :key="grid.code"
        :grid="grid"
        :grid-index="gridIndex"
      />
    </div>
  </div>
</template>

<style scoped>
.alphabet-table-host {
  min-width: 0;
}

.alphabet-table-block {
  display: flex;
  flex-direction: column;
  gap: 18px;
  opacity: 0;
  animation: fadeInUp 0.55s ease 0.18s both;
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
</style>
