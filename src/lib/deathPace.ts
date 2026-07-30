import type { Character } from '../types'

function pushQueue(c: Character, eventId: string, dueAge: number) {
  if (c.eventQueue.some((q) => q.eventId === eventId)) return
  c.eventQueue.push({ eventId, dueAge: Math.max(c.age, dueAge) })
}

/** 终局铺垫旗：审计「死前有没有事将至」 */
export const DEATH_PACE_FLAGS = [
  'omen_breakthrough_done',
  'omen_court_done',
  'omen_poison_done',
  'omen_sect_siege_done',
  'omen_qingjie_done',
  'inner_risk',
  'broke_through',
  'hunted_student',
  'poisoned_once',
  'emei_poison_kept',
  'duyi_path',
  'lost_lover',
  'enemy_due',
  'lifespan_farewell',
  'body_farewell',
  'heaven_ok',
  'heaven_failed',
] as const

export function hasDeathPaceFlag(c: Character): boolean {
  return DEATH_PACE_FLAGS.some((f) => c.flags.includes(f))
}

/**
 * 保底排队死前预警（风声 → 次年致死抉择）。
 * 不替代软保命，只保证危险出口前至少有一拍「事将至」。
 */
export function ensureDeathPaceQueues(c: Character): void {
  if (c.age >= 38 && !c.flags.includes('broke_through_safe')) {
    if (
      (c.flags.includes('inner_risk') || c.flags.includes('broke_through')) &&
      !c.flags.includes('omen_breakthrough_done')
    ) {
      pushQueue(c, 'omen_breakthrough', c.age + 1)
    }
  }

  if (
    c.age >= 38 &&
    (c.flags.includes('official') || c.flags.includes('fugitive')) &&
    !c.flags.includes('left_court_safe') &&
    !c.flags.includes('retired_official') &&
    !c.flags.includes('civic_shi_finale') &&
    !c.flags.includes('death_court_done') &&
    !c.flags.includes('omen_court_done')
  ) {
    pushQueue(c, 'omen_court_wind', c.age + 1)
  }

  if (
    c.age >= 30 &&
    (c.flags.includes('poisoned_once') ||
      c.flags.includes('emei_poison_kept') ||
      c.flags.includes('duyi_path')) &&
    !c.flags.includes('poison_cleared') &&
    !c.flags.includes('omen_poison_done')
  ) {
    pushQueue(c, 'omen_poison_tide', c.age + 1)
  }

  if (
    c.age >= 46 &&
    ['sect_huashan', 'sect_wudang', 'sect_shaolin', 'sect_emei', 'sect_gaibang'].some((f) =>
      c.flags.includes(f),
    ) &&
    !c.flags.includes('left_sect') &&
    !c.flags.includes('sect_martyr_done') &&
    !c.flags.includes('sect_finale') &&
    !c.flags.includes('sect_leave_pending') &&
    !c.flags.some((f) => f.endsWith('_finale_done')) &&
    !c.flags.includes('omen_sect_siege_done')
  ) {
    pushQueue(c, 'omen_sect_siege', c.age + 2)
  }

  if (
    c.age >= 34 &&
    c.flags.includes('lost_lover') &&
    !c.flags.includes('love_finale') &&
    !c.flags.includes('refused_qingjie') &&
    !c.flags.includes('love_closed') &&
    !c.flags.includes('lover_fate_done') &&
    !c.flags.includes('omen_qingjie_done')
  ) {
    pushQueue(c, 'omen_qingjie', c.age + 1)
  }

  // 大限将至：寿元前两年排队托孤/立嘱
  if (
    c.age >= Math.max(50, c.lifespan - 2) &&
    c.age < c.lifespan &&
    !c.flags.includes('omen_lifespan_done')
  ) {
    pushQueue(c, 'omen_lifespan', c.age)
  }
}

/** 同岁死后续一句，避免「抉择完立刻黑屏」 */
export function deathFarewellLine(c: Character, deathReason: string): string {
  const name = c.name || '此人'
  if (deathReason.includes('天劫') || deathReason.includes('渡劫')) {
    return `天象异变的那一夜，${name}把身家性命都押了上去。劫散之后，江湖只余一声叹息。`
  }
  if (deathReason.includes('突破') || deathReason.includes('走火')) {
    return `${name}冲击境界多年，这一劫终究没能迈过去。江湖上只记得：有人冲关，有人未归。`
  }
  if (deathReason.includes('赐死')) {
    return `密旨落地之后，朝堂再无人提及${name}的姓名——只余风声，像提前写好的结局。`
  }
  if (deathReason.includes('毒')) {
    return `毒性翻涌的那几夜，${name}早已知道这一天会来。灯灭时，只剩药香。`
  }
  if (deathReason.includes('殉道') || deathReason.includes('山门')) {
    return `山门未破之前，便有人闻到了血腥。${name}的故事，停在断后的那一刀。`
  }
  if (deathReason.includes('情劫') || deathReason.includes('自绝')) {
    return `故人去后，空屋里的酒早备好了。${name}不过是把早已写好的句号，亲手按下。`
  }
  if (deathReason.includes('徒弟') || deathReason.includes('背叛')) {
    return `白刃相向之前，那双眼睛里的异样，${name}并非不曾看见。`
  }
  if (deathReason.includes('仇敌') || deathReason.includes('寻仇')) {
    return `旧仇一寸寸逼近时，江湖早有传言。${name}没有逃过这一次。`
  }
  if (deathReason.includes('伤重') || deathReason.includes('崩解')) {
    return `${name}伤势一日重过一日。这一次，再没有人能从鬼门关外把他唤回来。`
  }
  if (deathReason.includes('寿终') || deathReason.includes('坐化') || deathReason.includes('无疾')) {
    // 忌「那几年」套在刚满耳顺/花甲的骤然寿终上
    if (c.age < 70) {
      return `大限已至。${name}把该交代的话都说了，这一生，收在一个安静的句号里。`
    }
    return `花甲之后余年渐短，${name}把后事一一安顿。这一生，总算有个安静的收束。`
  }
  return `风声早起，事已至此。${name}的江湖路，到此为止。`
}

/** 大限预警（尚未死亡）——不可写成已收束的绝笔 */
export function lifespanOmenLine(c: Character): string {
  const name = c.name || '此人'
  return `${name}自觉寿数将尽，开始交代后事。来日方短，但故事还没落到最后一笔。`
}
