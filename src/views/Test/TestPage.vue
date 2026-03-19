<script setup>
import { ref } from 'vue'
import DraggableList from "../../components/Layout/DraggableList.vue";


// 测试数据
const list = ref([
  { text: '苹果', sort: 1 },
  { text: '香蕉', sort: 2 },
  { text: '橙子', sort: 3 }
])

// 创建新项
const createItem = () => ({
  text: '',
  sort: list.value.length + 1
})
</script>

<template>
  <div class="page">

    <h2>DraggableList 测试</h2>

    <DraggableList
        v-model="list"
        :createItem="createItem"
    >
      <template #default="{ item, index, remove }">

        <div class="item-row">
          <span class="sort">#{{ item.sort }}</span>

          <input
              v-model="item.text"
              placeholder="输入内容"
          />

          <button @click="remove" class="remove-btn">
            删除
          </button>
        </div>

      </template>
    </DraggableList>

    <!-- 调试输出 -->
    <div class="debug">
      <h3>当前数据：</h3>
      <pre>{{ list }}</pre>
    </div>

  </div>
</template>

<style scoped>
.page {
  padding: 20px;
  max-width: 600px;
  margin: auto;
}

.item-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.sort {
  width: 40px;
  color: #666;
}

input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.remove-btn {
  background: #ffebee;
  border: 1px solid #ffcdd2;
  color: #d32f2f;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.debug {
  margin-top: 20px;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
}
</style>