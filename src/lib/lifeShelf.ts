import type { EndingReport, PortraitLook } from '../types'
import { TITLES } from '../data/titles'
import { primaryDeathTag } from './deathTags'
import { endingDeathUrl, portraitUrl } from './assetResolve'

export const SHELF_KEY = 'wuxia-life-sim-shelf-v1'
export const SHELF_MAX = 24
export const SHELF_PREMIUM_SCORE = 800

export interface LifeBookRecord {
  id: string
  createdAt: number
  seed: number
  readAt?: number
  title: string
  gender: '男' | '女'
  portraitLook: PortraitLook
  deathTag: string
  deathReason: string
  mainline: string
  finalAge: number
  score: number
  originName: string
  /** 精品角标 */
  premium: boolean
  ending: EndingReport
}

function uid() {
  return `life_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function loadShelf(): LifeBookRecord[] {
  try {
    const raw = localStorage.getItem(SHELF_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as LifeBookRecord[]
    if (!Array.isArray(list)) return []
    return list.filter((b) => b && b.id && b.ending)
  } catch {
    return []
  }
}

export function saveShelf(list: LifeBookRecord[]) {
  const clipped = list.slice(0, SHELF_MAX)
  try {
    localStorage.setItem(SHELF_KEY, JSON.stringify(clipped))
    return
  } catch {
    /* fall through */
  }
  // 配额不足：先丢掉较旧的一半，并对保留本做日志压缩
  try {
    const slim = clipped
      .slice(0, Math.max(2, Math.floor(clipped.length / 2)))
      .map(slimRecord)
    localStorage.setItem(SHELF_KEY, JSON.stringify(slim))
  } catch {
    try {
      const one = clipped.slice(0, 1).map(slimRecord)
      localStorage.setItem(SHELF_KEY, JSON.stringify(one))
    } catch {
      /* ignore */
    }
  }
}

/**
 * 压缩日常日志以节省空间；保留高潮/死亡/入世，保证目录与终局页完整。
 */
function slimRecord(r: LifeBookRecord): LifeBookRecord {
  const logs = r.ending.lifeLog.filter(
    (l) =>
      l.importance >= 4 ||
      l.kind === 'death' ||
      l.kind === 'title' ||
      l.kind === 'martial' ||
      l.title === '入世',
  )
  return {
    ...r,
    ending: {
      ...r.ending,
      lifeLog: logs.length ? logs : r.ending.lifeLog.slice(-40),
    },
  }
}

export function bookTitleFromEnding(ending: EndingReport): string {
  const c = ending.character
  if (c.primaryTitleId) {
    const t = TITLES.find((x) => x.id === c.primaryTitleId)
    if (t) return `${c.name} · ${t.name}`
  }
  return c.name
}

export function isPremiumEnding(ending: EndingReport): boolean {
  if (ending.score >= SHELF_PREMIUM_SCORE) return true
  const id = ending.character.primaryTitleId
  if (!id) return false
  return TITLES.find((x) => x.id === id)?.rarity === '传说'
}

export function upsertShelfBook(
  ending: EndingReport,
  seed: number,
  originName: string,
): LifeBookRecord[] {
  const list = loadShelf()
  const deathTag = primaryDeathTag(ending.deathReason, ending.character)
  const record: LifeBookRecord = slimRecord({
    id: uid(),
    createdAt: Date.now(),
    seed,
    title: bookTitleFromEnding(ending),
    gender: ending.character.gender,
    portraitLook: ending.character.portraitLook,
    deathTag,
    deathReason: ending.deathReason,
    mainline: ending.mainline,
    finalAge: ending.finalAge,
    score: ending.score,
    originName,
    premium: isPremiumEnding(ending),
    ending,
  })
  const next = [record, ...list].slice(0, SHELF_MAX)
  saveShelf(next)
  return next
}

export function markShelfRead(id: string): LifeBookRecord[] {
  const list = loadShelf().map((b) => (b.id === id ? { ...b, readAt: Date.now() } : b))
  saveShelf(list)
  return list
}

export function removeShelfBook(id: string): LifeBookRecord[] {
  const list = loadShelf().filter((b) => b.id !== id)
  saveShelf(list)
  return list
}

export function shelfCoverUrls(book: LifeBookRecord): { portrait: string; death: string | null } {
  return {
    portrait: portraitUrl(book.ending.character),
    death: endingDeathUrl(book.ending.deathReason, book.ending.character),
  }
}

export function shelfStatusLabel(book: LifeBookRecord): string {
  if (book.readAt) return '已读'
  // 刚上架 10 分钟内标「刚落成」
  if (Date.now() - book.createdAt < 10 * 60 * 1000) return '刚落成'
  return '未读'
}
