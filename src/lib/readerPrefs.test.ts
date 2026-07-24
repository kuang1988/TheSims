import { beforeEach, describe, expect, it } from 'vitest'
import {
  clampFontSize,
  clampLineHeight,
  DEFAULT_READER_PREFS,
  dualSpreadAllowed,
  loadReaderPrefs,
  marginPadRem,
  patchReaderPrefs,
  READER_PREFS_KEY,
  saveReaderPrefs,
} from './readerPrefs'
import { loadBookSoundEnabled } from './bookSound'

function installMemoryStorage() {
  const map = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v))
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => map.clear(),
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  })
}

describe('readerPrefs', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('loads defaults and persists patch', () => {
    expect(loadReaderPrefs()).toMatchObject(DEFAULT_READER_PREFS)
    const saved = patchReaderPrefs({ fontSize: 20, theme: 'ye', sound: false })
    expect(saved.fontSize).toBe(20)
    expect(saved.theme).toBe('ye')
    expect(loadReaderPrefs().theme).toBe('ye')
    expect(loadBookSoundEnabled()).toBe(false)
    expect(localStorage.getItem(READER_PREFS_KEY)).toContain('"ye"')
  })

  it('clamps font and line height', () => {
    expect(clampFontSize(10)).toBe(15)
    expect(clampFontSize(30)).toBe(24)
    expect(clampLineHeight(1.2)).toBe(1.6)
    expect(clampLineHeight(2.5)).toBe(2.1)
    const saved = saveReaderPrefs({
      ...DEFAULT_READER_PREFS,
      fontSize: 99,
      lineHeight: 0.5,
      theme: 'su',
    })
    expect(saved.fontSize).toBe(24)
    expect(saved.lineHeight).toBe(1.6)
  })

  it('disables dual spread for large font or prefs off', () => {
    expect(dualSpreadAllowed({ ...DEFAULT_READER_PREFS, dualSpread: true }, 1000)).toBe(true)
    expect(dualSpreadAllowed({ ...DEFAULT_READER_PREFS, dualSpread: false }, 1000)).toBe(false)
    expect(dualSpreadAllowed({ ...DEFAULT_READER_PREFS, dualSpread: true, fontSize: 22 }, 1000)).toBe(
      false,
    )
    expect(dualSpreadAllowed({ ...DEFAULT_READER_PREFS, dualSpread: true }, 800)).toBe(false)
  })

  it('maps margin to pad rem', () => {
    expect(marginPadRem('tight')).toBeLessThan(marginPadRem('standard'))
    expect(marginPadRem('loose')).toBeGreaterThan(marginPadRem('standard'))
  })
})
