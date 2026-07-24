const SOUND_KEY = 'wuxia-life-sim-book-sound-v1'

export function loadBookSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function saveBookSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** 轻量纸声（Web Audio），失败则静默 */
export function playPageFlipSound() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 210
    gain.gain.value = 0.035
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t = ctx.currentTime
    osc.start(t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.stop(t + 0.08)
    window.setTimeout(() => void ctx.close(), 120)
  } catch {
    /* ignore */
  }
}
