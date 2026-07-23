import type { Character } from '../types'

/** 设计文档级死法文案（批跑可统计种类） */
export const DEATH_REASONS = [
  '寿元耗尽，寿终正寝',
  '山中坐化，无疾而终',
  '体魄崩解，伤重不治',
  '战死沙场',
  '血战而亡',
  '朝廷赐死',
  '情劫难渡，自绝于世',
  '走火入魔，经脉尽断',
  '门派殉道，血染山门',
  '突破失败，元气尽散',
  '毒发身亡',
  '遭人暗算，死于非命',
  '被徒弟背叛而死',
  '仇敌寻仇，命丧黄泉',
  '沉疴不起，病榻而终',
  '旧疾复发，不治身亡',
] as const

/**
 * 体魄归零时，按身份/烙印给出可晒死法，避免清一色「体魄崩解」。
 */
export function flavorBodyDeath(c: Character): string {
  if (c.flags.includes('enemy_due') || c.relations.some((r) => r.kind === '仇敌' && (r.revengeIn ?? 1) <= 0)) {
    return '仇敌寻仇，命丧黄泉'
  }
  if (c.flags.includes('qi_deviation')) {
    return '走火入魔，经脉尽断'
  }
  if (c.flags.includes('sect_martyr')) {
    return '门派殉道，血染山门'
  }
  if (c.flags.includes('sect_scar') && c.flags.includes('war_hero')) {
    return '战死沙场'
  }
  if (c.flags.includes('poisoned') || c.flags.includes('chronic_illness') && c.flags.includes('emei_poison_kept')) {
    return '毒发身亡'
  }
  if (c.flags.includes('old_ailing') || (c.flags.includes('chronic_illness') && c.age >= 55)) {
    return '沉疴不起，病榻而终'
  }
  if (c.flags.includes('lost_lover') && c.attrs.心性 <= -20) {
    return '情劫难渡，自绝于世'
  }
  if (c.flags.includes('army') || c.flags.includes('battlefield')) {
    return '战死沙场'
  }
  if (c.flags.includes('official') || c.flags.includes('fugitive')) {
    return '遭人暗算，死于非命'
  }
  return '体魄崩解，伤重不治'
}

export function flavorLifespanDeath(c: Character): string {
  if (c.flags.includes('retreated') || c.flags.includes('yinshi_path')) {
    return '山中坐化，无疾而终'
  }
  if (c.flags.includes('zuohua_ready')) {
    return '山中坐化，无疾而终'
  }
  return '寿元耗尽，寿终正寝'
}

/** 由死因文案 + flags 生成可晒结局标签 */
export function deathEndingTags(deathReason: string, c: Character): string[] {
  const tags: string[] = []
  const d = deathReason

  if (d.includes('坐化') || (d.includes('寿终') && c.flags.includes('retreated'))) tags.push('隐世而终')
  else if (d.includes('寿终')) tags.push('寿终正寝')
  else if (d.includes('战死') || d.includes('血战')) tags.push('战死沙场')
  else if (d.includes('赐死')) tags.push('朝廷赐死')
  else if (d.includes('情劫') || d.includes('自绝')) tags.push('情劫自尽')
  else if (d.includes('走火') || d.includes('突破失败')) tags.push('突破失败')
  else if (d.includes('殉道')) tags.push('门派殉道')
  else if (d.includes('毒')) tags.push('死于非命')
  else if (d.includes('背叛')) tags.push('死于非命')
  else if (d.includes('仇敌') || d.includes('暗算')) tags.push('死于非命')
  else if (d.includes('伤') || d.includes('崩解') || d.includes('病')) tags.push('死于非命')
  else tags.push('江湖陨落')

  return tags
}

export function enrichEndingTags(deathReason: string, c: Character, base: string[]): string[] {
  const tags = [...deathEndingTags(deathReason, c)]
  for (const t of base) {
    if (!tags.includes(t)) tags.push(t)
  }
  // 去重粗标签：若已有更细标签，去掉「江湖陨落」
  if (tags.length > 1 && tags.includes('江湖陨落')) {
    return tags.filter((t) => t !== '江湖陨落')
  }
  return tags
}
