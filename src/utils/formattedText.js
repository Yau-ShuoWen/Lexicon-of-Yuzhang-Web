import { formatRichText } from './textFormatter.js'

export default {
    mounted(el, binding) {
        render(el, binding.value)
    },
    updated(el, binding) {
        if (binding.value !== binding.oldValue) render(el, binding.value)
    }
}

function render(el, value) {
    el.innerHTML = formatRichText(typeof value === 'string' ? value : '')
}
