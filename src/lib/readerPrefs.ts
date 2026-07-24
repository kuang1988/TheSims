import { loadBookSoundEnabled, saveBookSoundEnabled } from './bookSound'

export const READER_PREFS_KEY = 'wuxia-life-sim-reader-prefs-v1'

export type ReaderTheme = 'xuan' | 'su' | 'ye'
export type ReaderMargin = 'tight' | 'standard' | 'loose'

export interface ReaderPrefs {
  /** 正文字号 px，15～24 */
  fontSize: number
  /** 行高 1.6～2.1 */
  lineHeight: number
  theme: ReaderTheme
  margin: ReaderMargin
  /** 3D 翻页动画 */
  flipAnimation: boolean
  /** 翻页纸声（与 book-sound key 同步） */
  sound: boolean
  /** 宽屏对开（阅读器已固定单页，保留字段兼容旧本地配置） */
  dualSpread: boolean
}

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 18,
  lineHeight: 1.85,
  theme: 'xuan',
  margin: 'standard',
  flipAnimation: true,
  sound: true,
  dualSpread: false,
}

const FONT_MIN = 15
const FONT_MAX = 24
const LH_MIN = 1.6
const LH_MAX = 2.1

export function clampFontSize(n: number): number {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)))
}

export function clampLineHeight(n: number): number {
  const stepped = Math.round(n * 20) / 20
  return Math.min(LH_MAX, Math.max(LH_MIN, stepped))
}

function normalize(raw: Partial<ReaderPrefs> | null | undefined): ReaderPrefs {
  const base = { ...DEFAULT_READER_PREFS, ...(raw ?? {}) }
  const theme: ReaderTheme =
    base.theme === 'su' || base.theme === 'ye' || base.theme === 'xuan' ? base.theme : 'xuan'
  const margin: ReaderMargin =
    base.margin === 'tight' || base.margin === 'loose' || base.margin === 'standard'
      ? base.margin
      : 'standard'
  return {
    fontSize: clampFontSize(Number(base.fontSize) || DEFAULT_READER_PREFS.fontSize),
    lineHeight: clampLineHeight(Number(base.lineHeight) || DEFAULT_READER_PREFS.lineHeight),
    theme,
    margin,
    flipAnimation: Boolean(base.flipAnimation),
    sound: Boolean(base.sound),
    dualSpread: Boolean(base.dualSpread),
  }
}

export function loadReaderPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(READER_PREFS_KEY)
    if (!raw) {
      const sound = loadBookSoundEnabled()
      return normalize({ ...DEFAULT_READER_PREFS, sound })
    }
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>
    const prefs = normalize(parsed)
    // 纸声以 readerPrefs 为准，并回写 book-sound key 保持兼容
    saveBookSoundEnabled(prefs.sound)
    return prefs
  } catch {
    return { ...DEFAULT_READER_PREFS, sound: loadBookSoundEnabled() }
  }
}

export function saveReaderPrefs(prefs: ReaderPrefs): ReaderPrefs {
  const next = normalize(prefs)
  try {
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  saveBookSoundEnabled(next.sound)
  return next
}

export function patchReaderPrefs(patch: Partial<ReaderPrefs>): ReaderPrefs {
  return saveReaderPrefs({ ...loadReaderPrefs(), ...patch })
}

/** 边距 token → CSS 左右 padding rem */
export function marginPadRem(margin: ReaderMargin): number {
  if (margin === 'tight') return 0.75
  if (margin === 'loose') return 1.45
  return 1.1
}

/** 字号偏大时关闭对开，避免溢出 */
export function dualSpreadAllowed(prefs: ReaderPrefs, viewportWidth: number): boolean {
  if (!prefs.dualSpread) return false
  if (prefs.fontSize >= 21) return false
  return viewportWidth >= 900
}

export const THEME_LABELS: Record<ReaderTheme, string> = {
  xuan: '宣纸',
  su: '素卷',
  ye: '夜读',
}
