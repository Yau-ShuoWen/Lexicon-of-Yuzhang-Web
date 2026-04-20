<script setup>
import { ref, watch } from 'vue'
import { formatRichText } from "../../utils/textFormatter.js";
import LoadingIcon from "../../components/Status/LoadingIcon.vue";

const props = defineProps({
  show: Boolean,
  dialect: String,
  language: String,
  pinyinKey: String
})

const emit = defineEmits(['close'])

const loading = ref(false)
const detail = ref(null)

/* 載入資料 */
async function fetchDetail() {
  if (!props.pinyinKey) return

  try {
    loading.value = true

    const res = await fetch(
        `/api/pinyin/pinyin-detail/${props.dialect}/${props.language}?key=${props.pinyinKey}`
    )

    const data = await res.json()

    if (!data.empty) detail.value = data.value
    else detail.value = null


  } catch (e) {
    console.error(e)
    detail.value = null
  }
  finally {
    loading.value = false
  }
}

/* 當 key 或 show 改變時重新載入 */
watch(() => [props.pinyinKey, props.show], () => {
  if (props.show) fetchDetail()
})
</script>


<template>
  <div v-if="show" class="overlay" @click.self="emit('close')">
    <div class="modal">

      <LoadingIcon v-if="loading"/>

      <!-- content -->
      <div v-else-if="detail">

        <div v-for="item in detail.info" :key="item.key" class="block">

          <h2 v-formatted-text="item.standard"/>


          <ul class="note">
            <li v-for="(n, i) in item.note" :key="i" class="label"  v-formatted-text="n"/>
          </ul>

<!--          &lt;!&ndash; notation &ndash;&gt;-->
<!--          <div class="notation">-->
<!--            <div-->
<!--                v-for="(value, key) in item.notation" :key="key"-->
<!--                class="notation-row"-->
<!--            >-->
<!--              <span class="label" v-formatted-text="$t(stringConnect(key , value))"/>-->
<!--            </div>-->
<!--          </div>-->

          写法

          <table class="table">
            <tr v-for="(value, key) in item.notation" :key="key">
              <td class="pinyin-key">{{ key }}</td>
              <td class="pinyin-value" v-formatted-text="value"/>
            </tr>
          </table>

          辞书国际音标
          <!-- ipa -->
          <table class="table">
            <tr v-for="(value, key) in item.ipa" :key="key">
              <td class="ipa-key">{{ key }}</td>
              <td class="ipa-value" v-formatted-text="value"/>
            </tr>
          </table>



        </div>
      </div>

      <div v-else class="empty">
        無資料
      </div>

    </div>
  </div>
</template>


<style>
/* 遮罩 */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

/* 彈窗 */
.modal {
  width: 90%;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;

  background: #fff;
  border-radius: 14px;
  padding: 20px;
}

/* 區塊 */
.block {
  margin-bottom: 20px;
}

/* standard */
.standard {
  margin: 0 0 10px;
  font-size: 30px;
}

/* notation */
.notation-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;

  table-layout: fixed; /* ⭐關鍵 */
}

.table td {
  border: 1px solid #ddd;
  padding: 6px 8px;
}

.pinyin-key{
  background: #f7f7f7;
  width: 25%;
}

.pinyin-value {
  width: 75%;
}

.ipa-key {
  background: #f7f7f7;
  width: 75%; /* 3 */
}

.ipa-value {
  width: 25%; /* 1 */
}

.loading,
.empty {
  text-align: center;
  padding: 20px;
}
</style>