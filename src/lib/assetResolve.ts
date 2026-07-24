import type { Character, LogEntry } from '../types'
import {
  ALL_CLIMAX_KEYS,
  CLIMAX_BY_EVENT_ID,
  CLIMAX_TITLE_RULES,
  DEATH_TAG_FINE_KEY,
  PORTRAIT_ARCHETYPES,
  type ClimaxKey,
  type GenderKey,
  type PortraitArchetype,
} from '../data/assetManifest'
import { primaryDeathTag } from './deathTags'

const STYLE_OK = true // 文档锚点：水墨淡彩武侠

/** public/assets 下的 URL（兼容 GitHub Pages base） */
export function assetUrl(relPath: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const cleaned = relPath.replace(/^\//, '')
  return `${base}assets/${cleaned}`.replace(/([^:]\/)\/+/g, '$1')
}

export function genderKey(gender: Character['gender']): GenderKey {
  return gender === '女' ? 'f' : 'm'
}

/** 某性别可用的立绘池（少林无女档、峨眉无男档） */
export function portraitPoolForGender(gender: Character['gender']): PortraitArchetype[] {
  const g = genderKey(gender)
  return PORTRAIT_ARCHETYPES.filter((a) => {
    if (g === 'f' && a === 'shaolin') return false
    if (g === 'm' && a === 'emei') return false
    return true
  })
}

export function pickPortraitLook(
  gender: Character['gender'],
  rng: () => number,
): PortraitArchetype {
  const pool = portraitPoolForGender(gender)
  return pool[Math.floor(rng() * pool.length)] ?? 'civic'
}

export const PORTRAIT_LABELS: Record<PortraitArchetype, string> = {
  huashan: '华山',
  wudang: '武当',
  shaolin: '少林',
  emei: '峨眉',
  gaibang: '丐帮',
  demon: '魔教',
  bandit: '匪途',
  civic: '凡尘',
  wanderer: '游侠',
}

/** 入世选定后终身沿用；仅手动更换会改 portraitLook */
export function resolvePortraitArchetype(c: Character): PortraitArchetype {
  const look = c.portraitLook
  if (look && (PORTRAIT_ARCHETYPES as string[]).includes(look)) return look
  return 'civic'
}

export function normalizePortraitLook(
  gender: Character['gender'],
  look: PortraitArchetype,
): PortraitArchetype {
  const g = genderKey(gender)
  if (look === 'shaolin' && g === 'f') return 'emei'
  if (look === 'emei' && g === 'm') return 'huashan'
  const pool = portraitPoolForGender(gender)
  return pool.includes(look) ? look : pool[0] ?? 'civic'
}

export function portraitPath(c: Character): string {
  const g = genderKey(c.gender)
  const arch = normalizePortraitLook(c.gender, resolvePortraitArchetype(c))
  return `portrait/p_${g}_${arch}.webp`
}

export function portraitUrl(c: Character): string {
  return assetUrl(portraitPath(c))
}

export function portraitUrlFor(
  gender: Character['gender'],
  look: PortraitArchetype,
): string {
  const g = genderKey(gender)
  const arch = normalizePortraitLook(gender, look)
  return assetUrl(`portrait/p_${g}_${arch}.webp`)
}

export function endingDeathPath(deathTag: string): string | null {
  const key = DEATH_TAG_FINE_KEY[deathTag]
  if (!key) return null
  return `ending/e_death_${key}.webp`
}

export function endingDeathUrl(deathReason: string, c: Character): string | null {
  const tag = primaryDeathTag(deathReason, c)
  const path = endingDeathPath(tag)
  return path ? assetUrl(path) : null
}

export function climaxKeyFromHighlight(line: string): ClimaxKey | null {
  // "33岁·华山余剑" → 华山余剑
  const title = line.includes('·') ? line.split('·').slice(1).join('·') : line
  for (const rule of CLIMAX_TITLE_RULES) {
    if (rule.re.test(title) || rule.re.test(line)) return rule.key
  }
  return null
}

export function climaxKeyFromEventId(eventId: string): ClimaxKey | null {
  return CLIMAX_BY_EVENT_ID[eventId] ?? null
}

export function climaxPath(key: ClimaxKey): string {
  return `climax/${key}.webp`
}

export function climaxUrlFromHighlight(line: string): string | null {
  const key = climaxKeyFromHighlight(line)
  return key ? assetUrl(climaxPath(key)) : null
}

/** 日志条目旁图：死标终局图 / 高潮主题卡；无绑定时 null（UI 回落纯文字） */
export function artUrlForLog(log: LogEntry, c: Character): string | null {
  if (log.kind === 'death') return endingDeathUrl(log.text, c)
  // 「·去向」抉择行不重复插图
  if (log.kind === 'choice') return null
  if (log.eventId) {
    const byId = climaxKeyFromEventId(log.eventId)
    if (byId) return assetUrl(climaxPath(byId))
  }
  return climaxUrlFromHighlight(log.title)
}

export function isKnownClimaxKey(key: string): key is ClimaxKey {
  return (ALL_CLIMAX_KEYS as string[]).includes(key)
}

void STYLE_OK
