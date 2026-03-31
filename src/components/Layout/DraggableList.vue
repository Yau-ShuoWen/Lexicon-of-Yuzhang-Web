<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {type: Array, required: true},
  createItem: {type: Function, default: () => ({})},
  autoSort: {type: Boolean, default: true},
  draggable: {type: Boolean, default: true},
})

const emit = defineEmits(['update:modelValue'])

const list = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const idMap = new Map()
let uid = 0

const getId = (item) => {
  if (!idMap.has(item)) {
    idMap.set(item, `tmp_${uid++}`)
  }
  return idMap.get(item)
}

/* ========================= */

const dragIndex = ref(null)
const itemRefs = ref([])

const addItem = () => {
  const item = props.createItem()
  list.value.push(item)
  updateSort()
}

const removeItem = (index) => {
  list.value.splice(index, 1)
  updateSort()
}

const onDragStart = (e, index) => {
  dragIndex.value = index

  const el = itemRefs.value[index]
  if (el) {
    e.dataTransfer.setDragImage(el, 20, 20)
  }
}

const onDrop = (index) => {
  if (dragIndex.value === null) return
  if (dragIndex.value === index) return

  const item = list.value.splice(dragIndex.value, 1)[0]
  list.value.splice(index, 0, item)

  dragIndex.value = null
  updateSort()
}

const onDragOver = (e) => e.preventDefault()

const updateSort = () => {
  if (!props.autoSort) return

  list.value.forEach((item, i) => {
    item.sort = i + 1
  })
}
</script>

<template>
  <div class="draggable-wrapper">

    <div class="add-bar">
      <button @click="addItem" class="dev-add-btn dev-btn-small">
        添加
      </button>
    </div>

    <div
        v-for="(item, index) in list"
        :key="getId(item)"
        class="draggable-item"
        :ref="el => itemRefs[index] = el"
        @dragover="onDragOver"
        @drop="onDrop(index)"
    >
      <div
          v-if="draggable"
          class="drag-handle"
          draggable="true"
          @dragstart="(e) => onDragStart(e, index)"
      >
        ⋮⋮
      </div>

      <div class="content">
        <slot
            :item="item"
            :index="index"
        />
      </div>

      <button
          class="dev-remove-btn dev-btn-small"
          @click="removeItem(index)"
      >删除
      </button>
    </div>

  </div>
</template>

<style scoped>
.draggable-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-bar {
  margin-bottom: 10px;
}

.draggable-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border: 1px dashed #ccc;
  border-radius: 6px;
  background: #fafafa;
}

.draggable-item:hover {
  background: #f0f0f0;
}

.drag-handle {
  cursor: grab;
  padding: 6px 10px;
  color: #666;
  user-select: none;
  background: #eee;
  border-radius: 4px;
}

.drag-handle:hover {
  background: #ddd;
}

.drag-handle:active {
  cursor: grabbing;
}

.content {
  flex: 1;
}
</style>