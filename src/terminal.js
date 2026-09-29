const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))

export function terminalMarkup(name) {
  const transcript = `$ whoami\n${name}\n\n$ focus\nSOC · SIEM · Blue Team\nThreat Hunting · Digital Forensics\n\n$ status\n[✓] building\n[✓] documenting\n[✓] learning\n\n$ `
  return `<div class="terminal" role="region" aria-label="Portfolio terminal">
    <div class="termbar"><span class="termDots" aria-hidden="true"><i></i><i></i><i></i></span><span>portfolio@security: ~</span><span class="termShell">bash</span></div>
    <div class="termBody"><pre class="termSizer" aria-hidden="true">${escapeHtml(transcript)}<span class="termCursor"> </span></pre><pre class="termScreen" aria-hidden="true"><span data-terminal-text>${escapeHtml(transcript)}</span><span class="termCursor"> </span></pre></div>
    <pre class="srOnly">${escapeHtml(transcript)}</pre>
    <div class="termFooter"><span><span class="termStatusDot" aria-hidden="true"></span>portfolio session</span><button type="button" class="termReplay" aria-label="Replay terminal animation">↻ Replay</button></div>
  </div>`
}

export function bindTerminal(root) {
  const terminal = root.querySelector('.terminal')
  if (!terminal) return () => {}
  const text = terminal.querySelector('[data-terminal-text]')
  const button = terminal.querySelector('.termReplay')
  const transcript = text.textContent
  const lines = transcript.split('\n')
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let timer, running = false, line = 0, character = 0

  function finish() {
    clearTimeout(timer)
    running = false
    text.textContent = transcript
    terminal.classList.remove('isTyping')
    button.textContent = '↻ Replay'
    button.setAttribute('aria-label', 'Replay terminal animation')
  }

  function step() {
    if (!terminal.isConnected) return
    const current = lines[line]
    if (line === lines.length - 1) { finish(); return }
    const command = current.startsWith('$ ')
    if (character < current.length) {
      text.textContent += command && character === 0 ? '$ ' : current[character]
      character = command && character === 0 ? 2 : character + 1
      timer = setTimeout(step, command ? (character === 2 ? 600 : 140 + Math.random() * 90) : 45)
      return
    }
    text.textContent += '\n'
    line++
    character = 0
    timer = setTimeout(step, current.startsWith('$ ') ? 550 : current === '' ? 800 : 400)
  }

  function start() {
    clearTimeout(timer)
    if (motion.matches) { finish(); return }
    running = true
    line = 0
    character = 0
    text.textContent = ''
    terminal.classList.add('isTyping')
    button.textContent = 'Skip →'
    button.setAttribute('aria-label', 'Skip terminal animation')
    step()
  }

  function toggle() { if (running) finish(); else start() }
  function updateMotion() {
    button.hidden = motion.matches
    if (motion.matches) finish()
  }
  button.addEventListener('click', toggle)
  motion.addEventListener('change', updateMotion)
  updateMotion()
  // Start when the terminal enters view, including on narrow screens.
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect()
      start()
    }
  }, { threshold: 0.2 })
  observer.observe(terminal)

  return () => {
    clearTimeout(timer)
    observer.disconnect()
    button.removeEventListener('click', toggle)
    motion.removeEventListener('change', updateMotion)
  }
}
