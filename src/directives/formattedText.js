import { formatRichText } from '../utils/textFormatter'

export default {
    mounted(el, binding) {
        if (binding.value) {
            el.innerHTML = formatRichText(binding.value)
        }
    },
    updated(el, binding) {
        if (binding.value) {
            el.innerHTML = formatRichText(binding.value)
        }
    }
}