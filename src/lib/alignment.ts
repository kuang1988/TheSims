import type { Character, TitleDef, TitleType } from '../types'
import { heartTier } from './utils'

/** 邪名烙印：有则不应再获正道义名 */
export const EVIL_STAIN_FLAGS = [
  'massacre',
  'bandit_blood',
  'demon_lord',
  'demon_finale',
] as const

/** 正道身份旗：有则不应轻易再获恶贯类名号（堕落时会先剥正道称号） */
export const RIGHTEOUS_PATH_FLAGS = [
  'alliance_leader',
  'justice_finale',
  'pomo_path',
  'sect_finale',
] as const

/** 称号的叙事阵营（职司等按 id 特判） */
export function titleAlignment(def: TitleDef): '正' | '邪' | '中' {
  if (def.id === 'mengzhu' || def.id === 'gaibang') return '正'
  if (def.id === 'jiaozhu') return '邪'
  if (def.id === 'wudang_zhang' || def.id === 'shaolin_fangzhang' || def.id === 'emei_zhang') return '正'
  if (def.type === '正道') return '正'
  if (def.type === '邪道') return '邪'
  return '中'
}

export function hasEvilStain(c: Character): boolean {
  if (EVIL_STAIN_FLAGS.some((f) => c.flags.includes(f))) return true
  if (heartTier(c.attrs.心性) === '极恶' && c.fameEvil >= 25) return true
  return false
}

export function hasEvilIdentityTitle(
  c: Character,
  getTitle: (id: string) => TitleDef | undefined,
): boolean {
  return c.titles.some((t) => {
    const def = getTitle(t.id)
    return def ? titleAlignment(def) === '邪' : false
  })
}

export function hasRighteousIdentityTitle(
  c: Character,
  getTitle: (id: string) => TitleDef | undefined,
): boolean {
  return c.titles.some((t) => {
    const def = getTitle(t.id)
    return def ? titleAlignment(def) === '正' : false
  })
}

/** 是否允许授予该称号（身份自洽） */
export function canGrantTitle(
  c: Character,
  def: TitleDef,
  getTitle: (id: string) => TitleDef | undefined,
): boolean {
  const align = titleAlignment(def)
  if (align === '中') return true

  if (align === '正') {
    if (hasEvilStain(c)) return false
    if (hasEvilIdentityTitle(c, getTitle)) return false
    if (heartTier(c.attrs.心性) === '极恶') return false
    return true
  }

  // 邪：允许从正道堕落（授予时会剥离正道称号），但心性若仍至善则拒绝
  if (heartTier(c.attrs.心性) === '至善') return false
  if (c.flags.includes('justice_finale') || c.flags.includes('alliance_leader')) {
    // 已坐正道终局/盟主位，不再给恶贯类
    if (['eguiman', 'jiaozhu', 'mozhang', 'jianmo'].includes(def.id)) return false
  }
  return true
}

/** 授予邪道身份称号时，剥离互斥的正道称号 */
export function titlesToStripForGrant(
  c: Character,
  incoming: TitleDef,
  getTitle: (id: string) => TitleDef | undefined,
): string[] {
  if (titleAlignment(incoming) !== '邪') return []
  return c.titles
    .filter((t) => {
      const def = getTitle(t.id)
      return def ? titleAlignment(def) === '正' : false
    })
    .map((t) => t.id)
}

export function endingMoralTags(
  c: Character,
  getTitle: (id: string) => TitleDef | undefined,
): string[] {
  const tags: string[] = []
  const tier = heartTier(c.attrs.心性)
  const evilTitle = hasEvilIdentityTitle(c, getTitle)
  const goodTitle = hasRighteousIdentityTitle(c, getTitle)
  const stain = hasEvilStain(c)

  if (tier === '至善' && !evilTitle && !stain) tags.push('侠名留世')
  if (tier === '极恶' && (evilTitle || stain) && !goodTitle) tags.push('恶名昭彰')
  else if (tier === '极恶' && evilTitle) tags.push('恶名昭彰')
  // 若心性极恶却仍挂着正道义名：不打「恶名昭彰」，避免结算违和
  return tags
}

export function isRighteousTitleType(type: TitleType): boolean {
  return type === '正道'
}
