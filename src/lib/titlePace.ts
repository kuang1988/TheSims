import type { Character, TitleDef } from '../types'
import { detectMainline } from './story'
import { titleAlignment } from './alignment'

const HIGH_RARITIES = new Set(['史诗', '传说'])
const MAX_LEGEND = 2
const MAX_OFFICE = 2
/** 高阶名号（史诗/传说/职司）最短间隔岁数 */
const HIGH_TITLE_GAP = 8

function rarityScore(r: string): number {
  return { 普通: 1, 稀有: 2, 史诗: 3, 传说: 4 }[r] ?? 0
}

function isHighTier(def: TitleDef): boolean {
  return HIGH_RARITIES.has(def.rarity) || def.type === '职司'
}

/** 主线族相关称号加分 */
function mainlineTitleBoost(c: Character, def: TitleDef): number {
  const main = detectMainline(c)
  const align = titleAlignment(def)
  let boost = 0
  if (def.type === '职司') boost += 0.6
  if (def.type === '趣味') boost -= 0.8

  if (main === '门派') {
    if (['zhangmen', 'gaibang', 'wudang_zhang', 'shaolin_fangzhang', 'emei_zhang', 'zhanglao'].includes(def.id))
      boost += 1.2
    if (align === '邪') boost -= 2
  }
  if (main === '正道') {
    if (align === '正') boost += 1
    if (align === '邪') boost -= 2.5
    if (['mengzhu', 'pomo', 'jiushi', 'junzijian'].includes(def.id)) boost += 0.8
  }
  if (main === '魔教') {
    if (align === '邪') boost += 1.2
    if (align === '正') boost -= 2.5
    if (['jiaozhu', 'mozhang', 'jianmo', 'hufa'].includes(def.id)) boost += 1
  }
  if (main === '匪患' && ['sharen', 'eguiman', 'baizou'].includes(def.id)) boost += 0.8
  if (main === '情缘' && ['qingcheng', 'qingren', 'guafu'].includes(def.id)) boost += 1
  if (main === '散修' && ['duxing', 'yinshi', 'xiaoyaoyou'].includes(def.id)) boost += 0.8
  return boost
}

/** 主称号优先级：职司/主线相关 > 稀有度；趣味难抢主称 */
export function primaryTitlePriority(c: Character, def: TitleDef): number {
  return rarityScore(def.rarity) + mainlineTitleBoost(c, def)
}

export function shouldBecomePrimary(
  c: Character,
  incoming: TitleDef,
  getTitle: (id: string) => TitleDef | undefined,
): boolean {
  if (!c.primaryTitleId) return true
  const cur = getTitle(c.primaryTitleId)
  if (!cur) return true
  return primaryTitlePriority(c, incoming) >= primaryTitlePriority(c, cur)
}

/**
 * 结算时校正：若主称与主线严重冲突，改挂更合适的已有称号。
 */
export function reconcilePrimaryTitle(
  c: Character,
  getTitle: (id: string) => TitleDef | undefined,
): void {
  if (c.titles.length === 0) {
    c.primaryTitleId = null
    return
  }

  const scoreOf = (id: string) => {
    const def = getTitle(id)
    return def ? primaryTitlePriority(c, def) : -999
  }

  let bestId = c.titles[0].id
  let bestScore = scoreOf(bestId)
  for (const t of c.titles) {
    const s = scoreOf(t.id)
    if (s > bestScore) {
      bestScore = s
      bestId = t.id
    }
  }
  c.primaryTitleId = bestId

  if (!primaryConflictsMainline(c, getTitle)) return

  // 冲突时：优先无冲突称号，哪怕稀有度更低
  let safeId: string | null = null
  let safeScore = -999
  for (const t of c.titles) {
    const def = getTitle(t.id)
    if (!def) continue
    c.primaryTitleId = t.id
    if (!primaryConflictsMainline(c, getTitle)) {
      const s = scoreOf(t.id)
      if (s > safeScore) {
        safeScore = s
        safeId = t.id
      }
    }
  }
  c.primaryTitleId = safeId ?? bestId
}

export function primaryConflictsMainline(
  c: Character,
  getTitle: (id: string) => TitleDef | undefined,
): boolean {
  if (!c.primaryTitleId) return false
  const def = getTitle(c.primaryTitleId)
  if (!def) return false
  const main = detectMainline(c)
  const align = titleAlignment(def)
  if (main === '正道' && align === '邪') return true
  if (main === '魔教' && align === '正') return true
  if (main === '门派' && align === '邪' && !c.flags.includes('left_sect')) return true
  return false
}

/**
 * 同局限制传说/职司数量与获取节奏。
 */
export function canGrantTitleByPace(
  c: Character,
  def: TitleDef,
  age: number,
  getTitle: (id: string) => TitleDef | undefined,
): boolean {
  if (def.rarity === '传说') {
    const legends = c.titles.filter((t) => getTitle(t.id)?.rarity === '传说')
    if (legends.length >= MAX_LEGEND) {
      const replaces =
        !!def.exclusiveGroup &&
        legends.some((t) => getTitle(t.id)?.exclusiveGroup === def.exclusiveGroup)
      if (!replaces) return false
    }
  }

  if (def.type === '职司') {
    const offices = c.titles.filter((t) => getTitle(t.id)?.type === '职司')
    if (offices.length >= MAX_OFFICE) {
      const replaces =
        !!def.exclusiveGroup &&
        offices.some((t) => getTitle(t.id)?.exclusiveGroup === def.exclusiveGroup)
      if (!replaces) return false
    }
  }

  // 主线冲突的邪/正称号在授予阶段也挡一层
  const main = detectMainline(c)
  const align = titleAlignment(def)
  if (main === '正道' && align === '邪') return false
  if (main === '魔教' && align === '正') return false

  if (!isHighTier(def)) return true

  const recentHigh = c.titles
    .map((t) => ({ owned: t, def: getTitle(t.id) }))
    .filter((x): x is { owned: (typeof c.titles)[0]; def: TitleDef } => !!x.def && isHighTier(x.def))
    .sort((a, b) => b.owned.gainedAt - a.owned.gainedAt)[0]

  if (!recentHigh) return true
  if (age - recentHigh.owned.gainedAt >= HIGH_TITLE_GAP) return true

  if (def.exclusiveGroup && recentHigh.def.exclusiveGroup === def.exclusiveGroup) {
    return true
  }
  if (rarityScore(def.rarity) > rarityScore(recentHigh.def.rarity)) return true

  return false
}

/** 结算用：主称号外最多 2 个次要名号（偏稀有） */
export function pickSecondaryTitleNames(
  c: Character,
  getTitle: (id: string) => TitleDef | undefined,
  limit = 2,
): string[] {
  return [...c.titles]
    .filter((t) => t.id !== c.primaryTitleId)
    .map((t) => ({ t, def: getTitle(t.id) }))
    .filter((x): x is { t: (typeof c.titles)[0]; def: TitleDef } => !!x.def)
    .sort((a, b) => {
      const d = rarityScore(b.def.rarity) - rarityScore(a.def.rarity)
      if (d !== 0) return d
      return b.t.gainedAt - a.t.gainedAt
    })
    .slice(0, limit)
    .map((x) => x.def.name)
}
