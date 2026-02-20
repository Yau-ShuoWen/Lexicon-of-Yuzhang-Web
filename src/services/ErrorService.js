import { ref } from 'vue'

const errors = ref([])

export function useErrorState(){
    return { errors }
}

export function showError(message){

    const id = Date.now()

    errors.value.push({
        id,
        message
    })

    setTimeout(()=>{
        errors.value = errors.value.filter(e=>e.id!==id)
    },3000)
}