import { formatTextWithFont } from '../utils/textFormatter'

export default {
    mounted(el, binding) {
        if (binding.value) {
            el.innerHTML = formatTextWithFont(binding.value)
        }
    },
    updated(el, binding) {
        if (binding.value) {
            el.innerHTML = formatTextWithFont(binding.value)
        }
    }
}