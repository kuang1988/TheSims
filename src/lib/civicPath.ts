import type { Character } from '../types'
import { SECT_CORE_FLAGS } from './sectPath'

export type CivicPathId = 'shi' | 'nong' | 'gong' | 'shang' | 'wanderer'

export const CIVIC_INTENT_FLAGS = [
  'civic_shi',
  'civic_nong',
  'civic_gong',
  'civic_shang',
  'civic_wanderer',
] as const

export const CIVIC_FINALE_FLAGS = [
  'civic_shi_finale',
  'civic_nong_finale',
  'civic_gong_finale',
  'civic_shang_finale',
  'civic_wanderer_finale',
] as const

const CIVIC_PROGRESS: Record<
  CivicPathId,
  {
    intent: string
    finale: string
    entryId: string
    formId: string
    midId: string
    lateId: string
    entryAge: number
    formAge: number
    midAge: number
    lateAge: number
  }
> = {
  shi: {
    intent: 'civic_shi',
    finale: 'civic_shi_finale',
    entryId: 'civic_shi_entry',
    formId: 'civic_shi_form',
    midId: 'civic_shi_mid',
    lateId: 'civic_shi_late',
    entryAge: 16,
    formAge: 24,
    midAge: 36,
    lateAge: 52,
  },
  nong: {
    intent: 'civic_nong',
    finale: 'civic_nong_finale',
    entryId: 'civic_nong_entry',
    formId: 'civic_nong_form',
    midId: 'civic_nong_mid',
    lateId: 'civic_nong_late',
    entryAge: 15,
    formAge: 22,
    midAge: 35,
    lateAge: 52,
  },
  gong: {
    intent: 'civic_gong',
    finale: 'civic_gong_finale',
    entryId: 'civic_gong_entry',
    formId: 'civic_gong_form',
    midId: 'civic_gong_mid',
    lateId: 'civic_gong_late',
    entryAge: 14,
    formAge: 22,
    midAge: 34,
    lateAge: 50,
  },
  shang: {
    intent: 'civic_shang',
    finale: 'civic_shang_finale',
    entryId: 'civic_shang_entry',
    formId: 'civic_shang_form',
    midId: 'civic_shang_mid',
    lateId: 'civic_shang_late',
    entryAge: 16,
    formAge: 24,
    midAge: 36,
    lateAge: 52,
  },
  wanderer: {
    intent: 'civic_wanderer',
    finale: 'civic_wanderer_finale',
    entryId: 'civic_wanderer_entry',
    formId: 'civic_wanderer_form',
    midId: 'civic_wanderer_mid',
    lateId: 'civic_wanderer_late',
    entryAge: 15,
    formAge: 23,
    midAge: 34,
    lateAge: 50,
  },
}

export function hasMajorFaction(c: Character): boolean {
  if (c.flags.includes('left_sect')) {
    // 已离派仍可能走凡尘，不算占主族
  } else if (SECT_CORE_FLAGS.some((f) => c.flags.includes(f)) || c.flags.includes('gaibang_member')) {
    return true
  }
  if (c.flags.includes('demon_sect') || c.flags.includes('demon_loyal') || c.flags.includes('demon_lord')) {
    return true
  }
  if (c.flags.includes('became_bandit') || c.flags.includes('bandit_camp') || c.flags.includes('bandit_finale')) {
    return true
  }
  return false
}

export function getCivicPath(c: Character): CivicPathId | null {
  for (const [id, conf] of Object.entries(CIVIC_PROGRESS) as [CivicPathId, (typeof CIVIC_PROGRESS)[CivicPathId]][]) {
    if (c.flags.includes(conf.intent) || c.flags.includes(conf.finale)) return id
  }
  return null
}

function pushQueue(c: Character, eventId: string, dueAge: number) {
  if (c.eventQueue.some((q) => q.eventId === eventId)) return
  c.eventQueue.push({ eventId, dueAge: Math.max(c.age, dueAge) })
}

function hasPlayedOrQueued(c: Character, eventId: string): boolean {
  return c.eventQueue.some((q) => q.eventId === eventId)
}

/** 入世时按出身打凡尘意向（可被之后事件改写） */
export function assignCivicIntentFromOrigin(c: Character, originId: string, originTags: string[]): void {
  if (getCivicPath(c)) return
  let path: CivicPathId = 'wanderer'
  if (originId === 'scholar' || originId === 'noble' || originId === 'royal') path = 'shi'
  else if (originId === 'farmer') path = 'nong'
  else if (originId === 'artisan') path = 'gong'
  else if (originId === 'merchant') path = 'shang'
  else if (
    originId === 'biaohang' ||
    originId === 'orphan' ||
    originId === 'wuguan' ||
    originId === 'demon' ||
    originId === 'dugu' ||
    originId === 'yulinying'
  ) {
    path = 'wanderer'
  } else if (originTags.includes('朝廷') || originTags.includes('儒侠') || originTags.includes('政治')) path = 'shi'
  else if (originTags.includes('民间') || originTags.includes('贫寒')) path = 'nong'
  else if (originTags.includes('工匠')) path = 'gong'
  else if (originTags.includes('商途') || originTags.includes('富庶')) path = 'shang'

  const intent = CIVIC_PROGRESS[path].intent
  if (!c.flags.includes(intent)) c.flags.push(intent)
}

/** 分龄保底：入世→归宿（入名门主族则停增） */
export function ensureCivicStoryQueue(c: Character): void {
  if (hasMajorFaction(c)) return
  const path = getCivicPath(c)
  if (!path) return
  const conf = CIVIC_PROGRESS[path]
  if (c.flags.includes(conf.finale)) return

  if (c.age >= conf.entryAge && !c.flags.includes(`${path}_entry_done`) && !hasPlayedOrQueued(c, conf.entryId)) {
    pushQueue(c, conf.entryId, conf.entryAge)
  }
  if (
    c.age >= conf.formAge &&
    c.flags.includes(`${path}_entry_done`) &&
    !c.flags.includes(`${path}_form_done`) &&
    !hasPlayedOrQueued(c, conf.formId)
  ) {
    pushQueue(c, conf.formId, conf.formAge)
  }
  if (
    c.age >= conf.midAge &&
    c.flags.includes(`${path}_form_done`) &&
    !c.flags.includes(`${path}_mid_done`) &&
    !hasPlayedOrQueued(c, conf.midId)
  ) {
    pushQueue(c, conf.midId, conf.midAge)
  }
  if (
    c.age >= conf.lateAge &&
    (c.flags.includes(`${path}_mid_done`) || c.flags.includes(`${path}_form_done`)) &&
    !c.flags.includes(conf.finale) &&
    !hasPlayedOrQueued(c, conf.lateId)
  ) {
    pushQueue(c, conf.lateId, conf.lateAge)
  }
  // 极晚仍未归宿：强制排队并略提前
  if (c.age >= conf.lateAge + 3 && !c.flags.includes(conf.finale) && !hasPlayedOrQueued(c, conf.lateId)) {
    pushQueue(c, conf.lateId, c.age)
  }
  // 中年已成型却迟迟未中劫：催一下
  if (
    c.age >= conf.midAge + 4 &&
    c.flags.includes(`${path}_form_done`) &&
    !c.flags.includes(`${path}_mid_done`) &&
    !hasPlayedOrQueued(c, conf.midId)
  ) {
    pushQueue(c, conf.midId, c.age)
  }
}

export function civicMainlineLabel(path: CivicPathId): '士途' | '农桑' | '市井' | '商途' | '江湖客' {
  return (
    {
      shi: '士途',
      nong: '农桑',
      gong: '市井',
      shang: '商途',
      wanderer: '江湖客',
    } as const
  )[path]
}
