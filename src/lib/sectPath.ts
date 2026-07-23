import type { Character, EventDef } from '../types'

/** 互斥的门派核心旗（同时只应持有一个） */
export const SECT_CORE_FLAGS = [
  'sect_huashan',
  'sect_wudang',
  'sect_shaolin',
  'sect_emei',
  'sect_gaibang',
] as const

export type SectCoreFlag = (typeof SECT_CORE_FLAGS)[number]

export const SECT_FINALE_DONE_FLAGS = [
  'huashan_finale_done',
  'wudang_finale_done',
  'shaolin_finale_done',
  'emei_finale_done',
  'gaibang_finale_done',
] as const

const SECT_PROGRESS: Record<
  SectCoreFlag,
  {
    midFlags: string[]
    finaleDone: string
    entryId: string
    midId: string
    finaleId: string
    entryAge: number
    midAge: number
    finaleAge: number
    progressPrefix: string
  }
> = {
  sect_huashan: {
    midFlags: [
      'huashan_cliff_win',
      'huashan_cliff_lose',
      'huashan_refused_duel',
      'huashan_shadow_duel',
      'huashan_defended',
      'huashan_pursuit',
      'huashan_scar',
      'huashan_radical',
    ],
    finaleDone: 'huashan_finale_done',
    entryId: 'huashan_sword_trial',
    midId: 'huashan_cliff_duel',
    finaleId: 'huashan_finale',
    entryAge: 20,
    midAge: 24,
    finaleAge: 30,
    progressPrefix: 'huashan_',
  },
  sect_wudang: {
    midFlags: [
      'wudang_diligent',
      'wudang_inner',
      'wudang_elite',
      'wudang_wounded',
      'wudang_letter_cleared',
      'wudang_letter_scar',
      'wudang_vigilant',
      'wudang_decoy',
      'wudang_leader',
      'wudang_legacy',
      'wudang_hermit',
    ],
    finaleDone: 'wudang_finale_done',
    entryId: 'wudang_taiji_lesson',
    midId: 'wudang_true_martial_letter',
    finaleId: 'wudang_finale',
    entryAge: 20,
    midAge: 24,
    finaleAge: 30,
    progressPrefix: 'wudang_',
  },
  sect_shaolin: {
    midFlags: [
      'shaolin_elite',
      'shaolin_passed',
      'shaolin_injured',
      'shaolin_zen',
      'shaolin_zen_break',
      'shaolin_abbot_path',
      'shaolin_lay',
    ],
    finaleDone: 'shaolin_finale_done',
    entryId: 'shaolin_luohan_ring',
    midId: 'shaolin_yijin_quest',
    finaleId: 'shaolin_finale',
    entryAge: 20,
    midAge: 24,
    finaleAge: 28,
    progressPrefix: 'shaolin_',
  },
  sect_emei: {
    midFlags: [
      'emei_elite',
      'emei_inner',
      'emei_poison_seen',
      'emei_poison_burned',
      'emei_poison_kept',
      'emei_poison_cleared',
      'emei_leader',
      'emei_legacy',
    ],
    finaleDone: 'emei_finale_done',
    entryId: 'emei_inner_trial',
    midId: 'emei_inner_trial',
    finaleId: 'emei_finale',
    entryAge: 20,
    midAge: 24,
    finaleAge: 30,
    progressPrefix: 'emei_',
  },
  sect_gaibang: {
    midFlags: [
      'gaibang_heir',
      'gaibang_reformed',
      'gaibang_tyrant',
      'gaibang_failed_trial',
      'gaibang_exposed',
      'gaibang_raid',
      'gaibang_info',
    ],
    finaleDone: 'gaibang_finale_done',
    entryId: 'gaibang_info_net',
    midId: 'gaibang_dogstick_trial',
    finaleId: 'gaibang_finale',
    entryAge: 20,
    midAge: 24,
    finaleAge: 30,
    progressPrefix: 'gaibang_',
  },
}

const AFTERMATH_EVENTS = [
  'old_pass_art',
  'mid_closedoor',
  'wanderer_road_justice',
  'act2_sect_echo',
  'act2_wander_mid',
  'act2_late_home',
] as const

export function getActiveSect(c: Character): SectCoreFlag | null {
  if (c.flags.includes('left_sect')) return null
  for (const id of SECT_CORE_FLAGS) {
    if (c.flags.includes(id)) return id
  }
  if (c.flags.includes('gaibang_member')) return 'sect_gaibang'
  return null
}

export function getSectFinaleId(sect: SectCoreFlag): string {
  return SECT_PROGRESS[sect].finaleId
}

export function getSectFinaleDoneFlag(sect: SectCoreFlag): string {
  return SECT_PROGRESS[sect].finaleDone
}

/** 清除所有门派核心/进度/外门旗（可保留一门 finale_done） */
export function clearSectIdentityFlags(c: Character, keepFinaleDone?: string): void {
  c.flags = c.flags.filter((f) => {
    if ((SECT_CORE_FLAGS as readonly string[]).includes(f)) return false
    if (f === 'gaibang_member' || f === 'sect_outer' || f === 'small_sect' || f === 'sect_loyal')
      return false
    if (f === 'sect_leave_pending' || f === 'sect_leader') return false
    if ((SECT_FINALE_DONE_FLAGS as readonly string[]).includes(f)) {
      return keepFinaleDone ? f === keepFinaleDone : false
    }
    if (
      f.startsWith('huashan_') ||
      f.startsWith('wudang_') ||
      f.startsWith('shaolin_') ||
      f.startsWith('emei_') ||
      f.startsWith('gaibang_')
    ) {
      return false
    }
    return true
  })
}

function hasQueuedOrFlag(c: Character, eventId: string, doneFlags: string[]): boolean {
  if (c.eventQueue.some((q) => q.eventId === eventId)) return true
  if (doneFlags.some((f) => c.flags.includes(f))) return true
  return false
}

function pushQueue(c: Character, eventId: string, dueAge: number) {
  if (c.eventQueue.some((q) => q.eventId === eventId)) return
  c.eventQueue.push({ eventId, dueAge: Math.max(c.age, dueAge) })
}

/**
 * 在籍门派：按年龄保底排队入口→中段劫→终章。
 */
export function ensureSectStoryQueue(c: Character): void {
  const sect = getActiveSect(c)
  if (!sect) return
  const path = SECT_PROGRESS[sect]
  if (c.flags.includes(path.finaleDone)) return

  const hasMid = path.midFlags.some((f) => c.flags.includes(f))

  if (c.age >= path.entryAge && !hasMid) {
    if (
      !hasQueuedOrFlag(c, path.entryId, path.midFlags) &&
      !hasQueuedOrFlag(c, path.midId, path.midFlags)
    ) {
      pushQueue(c, path.entryId, c.age)
    }
  }

  if (c.age >= path.midAge && !hasMid) {
    pushQueue(c, path.midId, c.age)
  }

  if (hasMid && c.age >= 24) {
    pushQueue(c, path.finaleId, c.age)
  } else if (!hasMid && c.age >= path.finaleAge) {
    pushQueue(c, path.finaleId, c.age)
  }

  if (c.age >= path.finaleAge - 1) {
    pushQueue(c, path.finaleId, Math.max(c.age, path.finaleAge - 1))
  }

  // 离派协议中：强制尽快终章
  if (c.flags.includes('sect_leave_pending')) {
    pushQueue(c, path.finaleId, c.age)
  }
}

/** 终章后第二幕：中年余波 + 晚年归宿（2～4 拍上限） */
export function ensureSectAftermath(c: Character): void {
  const hasFinale =
    c.flags.includes('sect_finale') ||
    SECT_FINALE_DONE_FLAGS.some((f) => c.flags.includes(f))
  // 仅终章后或真正离派才排余波；裸 wanderer 不灌山门中场
  const canMid = hasFinale || c.flags.includes('left_sect')

  // 第一拍：经典余波（有终章时）
  if (hasFinale && !c.flags.includes('sect_aftermath_queued')) {
    const already = ['old_pass_art', 'mid_closedoor'].some(
      (id) => c.eventQueue.some((q) => q.eventId === id) || c.flags.includes(`played_${id}`),
    )
    if (!already) {
      pushQueue(c, 'old_pass_art', c.age + 1)
      pushQueue(c, 'mid_closedoor', c.age + 3)
    }
    c.flags.push('sect_aftermath_queued')
  }

  // 第二幕中年拍
  if (canMid && !c.flags.includes('act2_mid_done') && !c.flags.includes('act2_mid_queued')) {
    if (hasFinale && !c.flags.includes('left_sect')) {
      pushQueue(c, 'act2_sect_echo', c.age + 4)
    } else {
      pushQueue(c, 'act2_wander_mid', c.age + 2)
    }
    c.flags.push('act2_mid_queued')
  }

  // 终章后离派：若山门余波未播，改排浪迹中场
  if (
    hasFinale &&
    c.flags.includes('left_sect') &&
    c.flags.includes('act2_mid_queued') &&
    !c.flags.includes('act2_mid_done') &&
    !c.eventQueue.some((q) => q.eventId === 'act2_wander_mid')
  ) {
    c.eventQueue = c.eventQueue.filter((q) => q.eventId !== 'act2_sect_echo')
    pushQueue(c, 'act2_wander_mid', c.age + 1)
  }

  // 晚年归宿：所有人可触达
  if (c.age >= 52 && !c.flags.includes('act2_late_done') && !c.flags.includes('act2_late_queued')) {
    pushQueue(c, 'act2_late_home', Math.max(c.age + 1, 55))
    c.flags.push('act2_late_queued')
  }
}

/** 队列里是否还有余波未播 */
export function hasPendingAftermath(c: Character): boolean {
  return c.eventQueue.some((q) => (AFTERMATH_EVENTS as readonly string[]).includes(q.eventId))
}

/** 加入某门时清除其他门派核心旗与他门终章完成旗 */
export function enforceSectExclusivity(c: Character, newlyAdded: string[]): void {
  let joined = newlyAdded.filter((f) => (SECT_CORE_FLAGS as readonly string[]).includes(f))
  // 只拿 gaibang_member 也视为入丐帮
  if (newlyAdded.includes('gaibang_member') && !joined.includes('sect_gaibang')) {
    joined = [...joined, 'sect_gaibang']
  }
  if (joined.length === 0) return
  const keep = joined[joined.length - 1] as SectCoreFlag
  // 再入门 = 结束「已离派」状态
  c.flags = c.flags.filter((f) => f !== 'left_sect' && f !== 'sect_leave_pending')
  c.flags = c.flags.filter((f) => !(SECT_CORE_FLAGS as readonly string[]).includes(f) || f === keep)

  for (const sect of SECT_CORE_FLAGS) {
    if (sect === keep) continue
    const prefix = SECT_PROGRESS[sect].progressPrefix
    const done = SECT_PROGRESS[sect].finaleDone
    c.flags = c.flags.filter((f) => !f.startsWith(prefix) && f !== done)
  }
  if (keep !== 'sect_gaibang') {
    c.flags = c.flags.filter((f) => f !== 'gaibang_member')
  }
  if (!c.flags.includes(keep)) c.flags.push(keep)
}

/** 在籍时大幅提高本门故事事件权重 */
export function sectStoryWeightFactor(c: Character, e: EventDef): number {
  const sect = getActiveSect(c)
  if (!sect) return 1
  const path = SECT_PROGRESS[sect]
  const ids = [path.entryId, path.midId, path.finaleId]
  if (ids.includes(e.id)) return 12
  if (e.chain === 'sect' && e.id.includes(sect.replace('sect_', ''))) return 4
  if (sect === 'sect_gaibang' && e.chain === 'sect' && e.id.includes('gaibang')) return 4
  return 1
}
