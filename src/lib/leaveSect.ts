import type { Character, EventDef } from '../types'
import {
  SECT_CORE_FLAGS,
  getActiveSect,
  getSectFinaleId,
  getSectFinaleDoneFlag,
  SECT_FINALE_DONE_FLAGS,
  clearSectIdentityFlags,
} from './sectPath'

/**
 * 中段主动离派：不立刻 left_sect，先 pending + 排队本门终章。
 * @returns 是否成功转入离派协议
 */
export function requestSectLeave(c: Character, delayYears = 1): boolean {
  const sect = getActiveSect(c)
  if (!sect) return false
  if (c.flags.includes('left_sect')) return false
  const done = getSectFinaleDoneFlag(sect)
  if (c.flags.includes(done)) {
    leaveSect(c)
    return true
  }
  if (!c.flags.includes('sect_leave_pending')) c.flags.push('sect_leave_pending')
  const finaleId = getSectFinaleId(sect)
  if (!c.eventQueue.some((q) => q.eventId === finaleId)) {
    c.eventQueue.push({ eventId: finaleId, dueAge: Math.max(c.age, c.age + Math.max(0, delayYears)) })
  }
  return true
}

/**
 * 终章内真正离派：left_sect + 清本门核心/进度/pending。
 */
export function leaveSect(c: Character): void {
  const keepDone = SECT_FINALE_DONE_FLAGS.find((f) => c.flags.includes(f))
  clearSectIdentityFlags(c, keepDone)
  if (!c.flags.includes('left_sect')) c.flags.push('left_sect')
  if (!c.flags.includes('wanderer')) c.flags.push('wanderer')
  c.flags = c.flags.filter((f) => f !== 'sect_leave_pending' && f !== 'sect_outer' && f !== 'small_sect')
}

/** 同局只允许一个门派终章完成旗 */
export function enforceSingleSectFinale(c: Character, newlyAdded: string[]): void {
  const added = newlyAdded.filter((f) => (SECT_FINALE_DONE_FLAGS as readonly string[]).includes(f))
  if (added.length === 0) return
  const keep = added[added.length - 1]
  c.flags = c.flags.filter(
    (f) => !(SECT_FINALE_DONE_FLAGS as readonly string[]).includes(f) || f === keep,
  )
  if (!c.flags.includes(keep)) c.flags.push(keep)
}

export function countSectFinaleDone(c: Character): number {
  return SECT_FINALE_DONE_FLAGS.filter((f) => c.flags.includes(f)).length
}

export function hasZombieSectFlags(c: Character): boolean {
  if (!c.flags.includes('left_sect')) return false
  return SECT_CORE_FLAGS.some((f) => c.flags.includes(f)) || c.flags.includes('gaibang_member')
}

export function isSectFinaleEventId(eventId: string): boolean {
  return (
    eventId === 'huashan_finale' ||
    eventId === 'wudang_finale' ||
    eventId === 'shaolin_finale' ||
    eventId === 'emei_finale' ||
    eventId === 'gaibang_finale'
  )
}

/** 已有一门终章后，不再播放/排队另一门终章 */
export function shouldBlockSectFinaleEvent(c: Character, e: EventDef): boolean {
  if (!isSectFinaleEventId(e.id)) return false
  const map: Record<string, string> = {
    huashan_finale: 'huashan_finale_done',
    wudang_finale: 'wudang_finale_done',
    shaolin_finale: 'shaolin_finale_done',
    emei_finale: 'emei_finale_done',
    gaibang_finale: 'gaibang_finale_done',
  }
  const myDone = map[e.id]
  if (c.flags.includes(myDone)) return true
  const others = SECT_FINALE_DONE_FLAGS.filter((f) => f !== myDone && c.flags.includes(f))
  return others.length > 0
}

export function primaryChainFamily(c: Character): string | null {
  // 锁定优先级：已收束终章 > 强制身份
  if (c.flags.includes('demon_finale') || c.flags.includes('demon_lord')) return 'demon'
  if (c.flags.includes('bandit_finale') || c.flags.includes('became_bandit')) return 'bandit'
  if (c.flags.includes('love_finale') && c.flags.includes('married')) return 'love'
  if (c.flags.includes('justice_finale') || c.flags.includes('alliance_leader')) return 'justice'
  if (countSectFinaleDone(c) > 0 || c.flags.includes('sect_finale')) return 'sect'
  if (getActiveSect(c)) return 'sect'
  if (c.flags.includes('demon_sect') || c.flags.includes('demon_loyal')) return 'demon'
  if (
    c.flags.some((f) =>
      [
        'civic_shi_finale',
        'civic_nong_finale',
        'civic_gong_finale',
        'civic_shang_finale',
        'civic_wanderer_finale',
        'civic_shi',
        'civic_nong',
        'civic_gong',
        'civic_shang',
        'civic_wanderer',
      ].includes(f),
    )
  ) {
    return 'civic'
  }
  if (c.flags.includes('lover') || c.flags.includes('married')) return 'love'
  if (c.flags.includes('helped_people') || c.flags.includes('pomo_path')) return 'justice'
  if (c.flags.includes('bandit_camp') || c.flags.includes('massacre')) return 'bandit'
  return null
}

/** 当前「实质锁定」的主线族数量（软旗如 helped_people 不单独算一族） */
export function activeChainFamilyCount(c: Character): number {
  let n = 0
  if (getActiveSect(c) || c.flags.includes('sect_finale') || countSectFinaleDone(c) > 0) n += 1
  if (
    c.flags.includes('demon_finale') ||
    c.flags.includes('demon_lord') ||
    (c.flags.includes('demon_loyal') && c.flags.includes('demon_sect'))
  )
    n += 1
  if (c.flags.includes('bandit_finale') || c.flags.includes('became_bandit')) n += 1
  if (c.flags.includes('love_finale') || (c.flags.includes('married') && c.flags.includes('lover')))
    n += 1
  if (c.flags.includes('justice_finale') || c.flags.includes('alliance_leader')) n += 1
  return n
}
