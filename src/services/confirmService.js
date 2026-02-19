import {ref} from 'vue'

const visible = ref(false)
const options = ref({})
let resolver = null

export function useConfirmState(){
    return {visible,options}
}

export function confirm(opt){

    visible.value=true
    options.value=opt

    return new Promise((resolve)=>{
        resolver=resolve
    })
}

export function resolveConfirm(result){
    visible.value=false
    resolver?.(result)
}
