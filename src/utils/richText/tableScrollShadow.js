export function attachTableScrollShadow(frame, scroll) {
  const update = () => {
    const remaining = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
    const left = Math.max(0, Math.min(scroll.scrollLeft, remaining))
    frame.style.setProperty('--table-shadow-left', String(Math.min(left / 32, 1)))
    frame.style.setProperty('--table-shadow-right', String(Math.min((remaining - left) / 32, 1)))
  }
  const observer = new ResizeObserver(update)
  observer.observe(scroll)
  if (scroll.firstElementChild) observer.observe(scroll.firstElementChild)
  scroll.addEventListener('scroll', update, { passive: true })
  requestAnimationFrame(update)
  return () => { observer.disconnect(); scroll.removeEventListener('scroll', update) }
}
