import type { Character } from '../types'

function pushQueue(c: Character, eventId: string, dueAge: number) {
  if (c.eventQueue.some((q) => q.eventId === eventId)) return
  c.eventQueue.push({ eventId, dueAge: Math.max(c.age, dueAge) })
}

/** 保底排队关系具名回调，避免关系槽有人却永不再见 */
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
}
