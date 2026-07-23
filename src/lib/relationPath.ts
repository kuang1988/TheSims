import type { Character } from '../types'

function pushQueue(c: Character, eventId: string, dueAge: number) {
  if (c.eventQueue.some((q) => q.eventId === eventId)) return
  c.eventQueue.push({ eventId, dueAge: Math.max(c.age, dueAge) })
}

/** 保底排队关系具名回调（拍 1 + 拍 2） */
export function ensureRelationCallbacks(c: Character): void {
  if (
    c.age >= 28 &&
    (c.flags.includes('lover') ||
      c.flags.includes('married') ||
      c.flags.includes('lost_lover') ||
      c.flags.includes('saved_lover')) &&
    !c.flags.includes('lover_revisited')
  ) {
    pushQueue(c, 'rel_lover_revisit', c.age + 2)
  }

  if (
    c.age >= 26 &&
    (c.flags.includes('has_master') || c.flags.includes('sect_loyal')) &&
    !c.flags.includes('master_letter_done') &&
    !c.flags.includes('left_sect')
  ) {
    pushQueue(c, 'rel_master_letter', c.age + 3)
  }

  if (c.age >= 40 && c.flags.includes('has_student') && !c.flags.includes('disciple_return_done')) {
    pushQueue(c, 'rel_disciple_return', c.age + 2)
  }

  if (c.flags.includes('enemy_due') && !c.flags.includes('enemy_echo_done')) {
    pushQueue(c, 'rel_enemy_named_echo', c.age)
  }

  // ── 第二拍 ──
  if (
    c.flags.includes('lover_revisited') &&
    !c.flags.includes('lover_fate_done') &&
    !c.flags.includes('love_finale')
  ) {
    pushQueue(c, 'rel_lover_fate', c.age + 2)
  }

  if (
    c.flags.includes('master_letter_done') &&
    !c.flags.includes('master_final_done') &&
    !c.flags.includes('left_sect')
  ) {
    pushQueue(c, 'rel_master_final', c.age + 3)
  }

  if (c.flags.includes('disciple_return_done') && !c.flags.includes('disciple_fate_done') && c.age >= 45) {
    pushQueue(c, 'rel_disciple_fate', c.age + 2)
  }

  if (c.flags.includes('enemy_echo_done') && !c.flags.includes('enemy_last_done')) {
    pushQueue(c, 'rel_enemy_last', c.age + 3)
  }
}
