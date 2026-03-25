<script setup>

</script>

<template>
  <div class="small-row">
    <input type="text" class="form-control small-input" placeholder="繁體"
           :value="newTc" :maxlength="maxLength" :disabled="disabled"
           @keydown="check"/>
  </div>
</template>

<style>
.horizontal-group {
  display: flex;
  gap: 12px;
}

.horizontal-group textarea {
  width: 50%;
  resize: vertical;
}

.small-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.small-input {
  width: 120px;
  min-width: 100px;
  height: 32px;
  padding: 4px 8px;
  line-height: 1.3;
}


.button-group {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
}

.textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  line-height: 1.5;
}
</style>