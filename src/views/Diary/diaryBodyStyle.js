import { formatRichText } from '../../utils/textFormatter.js'

// 特调内容全部来自日记正文；此文件只负责提取、限定 CSS 范围和执行 JS。
const BLOCK = /^:::(style|script)\s*\n([\s\S]*?)\n:::\s*(?:\n|$)/gm

export function renderDiaryBody(element, source) {
  const refreshImages = source && typeof source === 'object' ? source.refreshImages : null
  const images = source && typeof source === 'object' ? source.images : {}
  const viewMode = source && typeof source === 'object' ? source.viewMode : 'self'
  source = source && typeof source === 'object' ? source.text : source
  const blocks = []
  const body = String(source ?? '').replace(/\r\n?/g, '\n').replace(BLOCK, (_, type, content) => {
    blocks.push({type, content})
    return ''
  })
  element.innerHTML = formatRichText(body, images, { viewMode }) || ''
  for (const img of element.querySelectorAll('.rt-picture img[data-image-id]')) {
    img.addEventListener('error', async () => {
      try {
        const refreshed = await refreshImages?.()
        const url = refreshed?.[img.dataset.imageId]?.url
        if (!url) throw new Error('图片地址不可用')
        img.addEventListener('error', () => { img.replaceWith(document.createTextNode('图片加载失败')) }, { once: true })
        img.src = url
      } catch (error) {
        console.warn('日记图片加载失败', error)
        img.replaceWith(document.createTextNode('图片加载失败'))
      }
    }, { once: true })
  }
  const scope = `diary-body-${crypto.randomUUID()}`
  element.setAttribute('data-diary-style', scope)

  for (const block of blocks) {
    if (block.type === 'style') {
      const sheet = new CSSStyleSheet()
      try {
        sheet.replaceSync(block.content)
        const style = document.createElement('style')
        style.textContent = [...sheet.cssRules]
          .filter(rule => rule instanceof CSSStyleRule)
          .map(rule => `${rule.selectorText.split(',').map(selector => `[data-diary-style="${scope}"] ${selector.trim()}`).join(', ')} { ${rule.style.cssText} }`)
          .join('\n')
        element.prepend(style)
      } catch (error) {
        console.warn('日记正文样式解析失败', error)
      }
    } else {
      try {
        new Function('root', block.content)(element)
      } catch (error) {
        console.warn('日记正文脚本执行失败', error)
      }
    }
  }
}

export default {
  mounted(element, binding) { renderDiaryBody(element, binding.value) },
  updated(element, binding) {
    if (binding.value !== binding.oldValue) renderDiaryBody(element, binding.value)
  }
}
