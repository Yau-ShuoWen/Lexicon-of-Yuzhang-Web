import { formatRichText } from './textFormatter.js'
import { attachTableScrollShadow } from './richText/tableScrollShadow.js'

const cleanups = new WeakMap()

export default {
    mounted(el, binding) {
        render(el, binding.value)
    },
    updated(el, binding) {
        if (binding.value !== binding.oldValue) render(el, binding.value)
    },
    unmounted(el) {
        cleanups.get(el)?.forEach(cleanup => cleanup())
        cleanups.delete(el)
    }
}

function render(el, value) {
    cleanups.get(el)?.forEach(cleanup => cleanup())
    el.innerHTML = formatRichText(typeof value === 'string' ? value : '')
    cleanups.set(el, [...el.querySelectorAll('.rt-table-shadow-frame')].map(frame =>
        attachTableScrollShadow(frame, frame.querySelector('.rt-table-wrap'))))
}
