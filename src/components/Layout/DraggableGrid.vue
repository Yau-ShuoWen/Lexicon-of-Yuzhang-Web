<script setup>
import {computed, ref} from 'vue'

const props = defineProps({
  modelValue: {type: Array, required: true},
  createItem: {type: Function, default: () => ({})}
})

const emit = defineEmits(['update:modelValue'])
const list = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const ids = new WeakMap()
let nextId = 0
const itemId = item => {
  if (!ids.has(item)) ids.set(item, `grid-${nextId++}`)
  return ids.get(item)
}

const dragging = ref(null)
const addItem = () => list.value.push(props.createItem())
const removeItem = index => list.value.splice(index, 1)
const startDrag = (event, index) => {
  dragging.value = index
  event.dataTransfer.effectAllowed = 'move'
}
const dropAt = index => {
  if (dragging.value === null || dragging.value === index) return
  const item = list.value.splice(dragging.value, 1)[0]
  list.value.splice(index, 0, item)
  dragging.value = null
}
</script>

<template>
  <div class="draggable-grid-wrapper">
    <button class="dev-add-btn dev-btn-small add-button" @click="addItem">
      {{ $t('draggable_list.add') }}
    </button>

    <div class="draggable-grid">
      <div v-for="(item,index) in list" :key="itemId(item)" class="grid-item"
           @dragover.prevent @drop="dropAt(index)">
        <button class="drag-handle" draggable="true" type="button"
                @dragstart="event => startDrag(event,index)" @dragend="dragging=null">⋮⋮</button>
        <div class="grid-content"><slot :item="item" :index="index"/></div>
        <button class="dev-remove-btn dev-btn-small remove-button" @click="removeItem(index)">
          {{ $t('draggable_list.delete') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-button{margin-bottom:14px}
.draggable-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.grid-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;
  min-width:0;padding:12px;border:1px dashed #ccc;border-radius:6px;background:#fafafa}
.grid-item:hover{background:#f5f5f5}
.drag-handle{cursor:grab;padding:6px 9px;border:0;border-radius:4px;background:#eee;color:#666;font-size:18px}
.drag-handle:active{cursor:grabbing}.grid-content{min-width:0}.remove-button{align-self:start}
@media(max-width:900px){.draggable-grid{grid-template-columns:1fr}}
</style>
