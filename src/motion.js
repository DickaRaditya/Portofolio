const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function bindPageMotion(root) {
  if (!root.querySelector('.hero')) return () => {}
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const effects = new Map()
  const runningText = new Map()
  const animations = new Set()
  const listeners = new AbortController()
  let frame = 0

  function register(selector, effect) {
    root.querySelectorAll(selector).forEach(element => effects.set(element, effect))
  }
  register('.hero .eyebrow, .sectionHead > span', 'scramble')
  register('.hero p, .sectionHead p, .card p, .journeyIntro p, .experienceBody p, .skillBody p', 'type')
  register('.terminal, .card, .journeyIntro, .experienceItem, .skillCard', 'pop')
  register('.hero h1, .sectionHead h2, .card h3, .skillCardTitle strong, .experienceTitle strong, .journeyEyebrow, .hero .actions, .heroSpecialties, .heroOverview, .consoleCaption, .skillsControls, .skillTags, .journeyNumbers, .journeyIntro h3, .journeyLink, footer, nav .brand, nav .navlinks', 'rise')

  function finishText(element) {
    const item = runningText.get(element)
    if (!item) return
    item.overlay.remove()
    item.source.replaceWith(...item.source.childNodes)
    element.classList.remove('motionText')
    runningText.delete(element)
  }

  function tick(now) {
    for (const [element, item] of runningText) {
      if (!element.isConnected || now >= item.start + item.duration) {
        finishText(element)
        continue
      }
      // Slower scrambling makes individual glyph changes easier to follow.
      if (now - item.last < 1000 / (item.effect === 'scramble' ? 8 : 24)) continue
      item.last = now
      const progress = Math.max(0, (now - item.start) / item.duration)
      const revealed = Math.floor(progress * item.characters.length)
      item.overlay.textContent = item.effect === 'type'
        ? item.characters.slice(0, revealed).join('')
        : item.characters.map((char, index) => index >= revealed && index < revealed + 2 && /[a-z]/i.test(char)
          ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : char).join('')
    }
    frame = runningText.size ? requestAnimationFrame(tick) : 0
  }

  function textEffect(element, effect) {
    // Preserve links, line breaks, and any other rich content.
    if (element.children.length || !element.textContent.trim()) return
    const characters = Array.from(element.textContent)
    const source = document.createElement('span')
    source.className = 'motionTextSource'
    source.append(...element.childNodes)
    const overlay = document.createElement('span')
    overlay.className = `motionTextOverlay motionTextOverlay--${effect}`
    overlay.setAttribute('aria-hidden', 'true')
    overlay.textContent = source.textContent
    element.classList.add('motionText')
    element.append(source, overlay)
    runningText.set(element, {
      source, overlay, characters, effect, start: performance.now(), last: 0,
      duration: effect === 'type' ? Math.min(9000, Math.max(2800, characters.length * 45)) : 3600,
    })
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function entrance(element, effect) {
    const siblings = [...element.parentElement.children].filter(child => effects.get(child) === effect)
    const delay = Math.min(Math.max(0, siblings.indexOf(element)) * 180, 720)
    const animation = element.animate([
      { opacity: 0, transform: effect === 'pop' ? 'translateY(24px) scale(.96)' : 'translateY(15px)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 1500, delay, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'backwards' })
    animations.add(animation)
    animation.onfinish = () => animations.delete(animation)
  }

  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue
      observer.unobserve(target)
      if (preference.matches || target.contains(document.activeElement)) continue
      const effect = effects.get(target)
      if (effect === 'type' || effect === 'scramble') textEffect(target, effect)
      else entrance(target, effect)
    }
  }, { threshold: 0.08 })

  function stop() {
    observer.disconnect()
    cancelAnimationFrame(frame)
    frame = 0
    for (const element of runningText.keys()) finishText(element)
    for (const animation of animations) animation.cancel()
    animations.clear()
  }

  function updatePreference() {
    if (preference.matches) stop()
  }

  if (!preference.matches) for (const element of effects.keys()) observer.observe(element)
  preference.addEventListener('change', updatePreference)
  // Keyboard navigation always reveals the focused content immediately.
  root.addEventListener('focusin', event => {
    for (const [element] of effects) {
      if (!element.contains(event.target)) continue
      observer.unobserve(element)
      finishText(element)
      for (const animation of element.getAnimations()) animation.finish()
    }
  }, { signal: listeners.signal })
  root.querySelectorAll('details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open || preference.matches) return
      const body = details.querySelector('.skillBody, .experienceBody')
      if (body) entrance(body, 'rise')
    }, { signal: listeners.signal })
  })
  window.addEventListener('beforeprint', stop, { signal: listeners.signal })
  return () => {
    stop()
    listeners.abort()
    preference.removeEventListener('change', updatePreference)
  }
}
