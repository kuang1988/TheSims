import type { Character } from '../types'

function pushQueue(c: Character, eventId: string, dueAge: number) {
  if (c.eventQueue.some((q) => q.eventId === eventId)) return
  c.eventQueue.push({ eventId, dueAge: Math.max(c.age, dueAge) })
}

/** 仍有可收束的情缘（非烧信/关闭后的空壳） */
export function hasActiveLoveBond(c: Character): boolean {
  if (c.flags.includes('love_closed') || c.flags.includes('lover_fate_done') || c.flags.includes('love_finale')) {
    return false
  }
  if (c.relations.some((r) => r.kind === '道侣')) return true
  if (c.flags.includes('married')) return true
  if (c.flags.includes('lover') && !c.flags.includes('lost_lover')) return true
  return false
}

function hasEnemyBond(c: Character): boolean {
  return c.flags.includes('enemy_due') || c.relations.some((r) => r.kind === '仇敌')
}

function hasDiscipleBond(c: Character): boolean {
  return (
    (c.flags.includes('has_student') || c.relations.some((r) => r.kind === '徒弟')) &&
    !c.flags.includes('betrayal_resolved')
  )
}

/** 保底排队关系具名回调（拍 1 + 拍 2） */
export function ensureRelationCallbacks(c: Character): void {
  if (
    c.age >= 28 &&
    (c.flags.includes('lover') ||
      c.flags.includes('married') ||
      c.flags.includes('lost_lover') ||
      c.flags.includes('saved_lover')) &&
    !c.flags.includes('lover_revisited') &&
    !c.flags.includes('love_closed')
  ) {
    pushQueue(c, 'rel_lover_revisit', c.age + 2)
  }

  if (
    c.age >= 26 &&
    (c.flags.includes('has_master') || c.relations.some((r) => r.kind === '师父')) &&
    !c.flags.includes('master_letter_done') &&
    !c.flags.includes('left_sect') &&
    !c.flags.includes('sect_leave_pending')
  ) {
    pushQueue(c, 'rel_master_letter', c.age + 3)
  }

  if (c.age >= 50 && hasDiscipleBond(c) && !c.flags.includes('disciple_return_done')) {
    pushQueue(c, 'rel_disciple_return', c.age + 4)
  }

  if (c.flags.includes('enemy_due') && !c.flags.includes('enemy_echo_done') && hasEnemyBond(c)) {
    pushQueue(c, 'rel_enemy_named_echo', c.age)
  }

  // ── 第二拍 ──
  if (
    c.flags.includes('lover_revisited') &&
    !c.flags.includes('lover_fate_done') &&
    !c.flags.includes('love_finale') &&
    !c.flags.includes('love_closed') &&
    hasActiveLoveBond(c)
  ) {
    pushQueue(c, 'rel_lover_fate', c.age + 2)
  }

  if (
    c.flags.includes('master_letter_done') &&
    !c.flags.includes('master_final_done') &&
    !c.flags.includes('left_sect') &&
    !c.flags.includes('sect_leave_pending') &&
    (c.flags.includes('has_master') || c.relations.some((r) => r.kind === '师父'))
  ) {
    pushQueue(c, 'rel_master_final', c.age + 3)
  }

  if (
    c.flags.includes('disciple_return_done') &&
    !c.flags.includes('disciple_fate_done') &&
    !c.flags.includes('betrayal_resolved') &&
    hasDiscipleBond(c) &&
    c.age >= 52
  ) {
    pushQueue(c, 'rel_disciple_fate', c.age + 3)
  }

  // 仇敌终局：拍 1 未清仇（仍有仇敌槽或 enemy_due）才继续
  if (
    c.flags.includes('enemy_echo_done') &&
    !c.flags.includes('enemy_last_done') &&
    !c.flags.includes('enemy_closed') &&
    hasEnemyBond(c)
  ) {
    pushQueue(c, 'rel_enemy_last', c.age + 3)
  }
}
