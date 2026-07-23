import type { Character } from '../types'

/** 设计文档级死法文案（批跑可统计种类） */
export const DEATH_REASONS = [
  '寿元耗尽，寿终正寝',
  '山中坐化，无疾而终',
  '一代宗师，无疾而终',
  '恶名缠身，狱中而终',
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

/** 精死主标池（审计用） */
export const FINE_DEATH_TAGS = [
  '寿终正寝',
  '隐世而终',
  '宗师善终',
  '狱中而终',
  '战死沙场',
  '朝廷赐死',
  '情劫自尽',
  '突破失败',
  '门派殉道',
  '毒发身亡',
  '门人反噬',
  '仇敌寻仇',
  '遭人暗算',
  '伤重不治',
  '病榻而终',
  '死于非命',
  '江湖陨落',
] as const

/** 是否存在「横死语境」（不宜改写成寿终） */
export function hasViolentDeathContext(c: Character): boolean {
  if (c.flags.includes('enemy_due')) return true
  if (c.flags.includes('poisoned') || c.flags.includes('qi_deviation')) return true
  if (c.flags.includes('sect_martyr') || c.flags.includes('battlefield')) return true
  if (c.flags.includes('hunted_student') || c.flags.includes('army')) return true
  if (c.relations.some((r) => r.kind === '仇敌' && (r.revengeIn ?? 1) <= 0)) return true
  return false
}

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
  if (
    c.flags.includes('poisoned') ||
    (c.flags.includes('chronic_illness') && c.flags.includes('emei_poison_kept'))
  ) {
    return '毒发身亡'
  }
  if (c.flags.includes('old_ailing') || (c.flags.includes('chronic_illness') && c.age >= 55)) {
    return '沉疴不起，病榻而终'
  }
  if (c.flags.includes('lost_lover') && c.attrs.心性 <= -20) {
    return '情劫难渡，自绝于世'
  }
  if (c.flags.includes('army') || c.flags.includes('battlefield')) {
    // 壮年后「战场烙印」过期：不再默认战死，避免清一色沙场
    if (c.age < 50) return '战死沙场'
  }
  if (c.flags.includes('hunted_student')) {
    return '被徒弟背叛而死'
  }
  // 晚年无横死语境：优先病榻，避免默认「体魄崩解→死于非命」
  if (c.age >= 58 && !hasViolentDeathContext(c)) {
    if (c.flags.includes('chronic_illness') || c.flags.includes('old_ailing') || c.attrs.体魄 <= 0) {
      return '沉疴不起，病榻而终'
    }
  }
  // 官身/亡命：仅在壮年横死语境用暗算；晚年改为病榻
  if (c.flags.includes('official') || c.flags.includes('fugitive')) {
    if (c.age >= 60 && !hasViolentDeathContext(c)) return '沉疴不起，病榻而终'
    return '遭人暗算，死于非命'
  }
  return '体魄崩解，伤重不治'
}

/** 寿终 / 坐化：按身份分化（Sprint B） */
export function flavorLifespanDeath(c: Character): string {
  if (c.flags.includes('retreated') || c.flags.includes('yinshi_path') || c.flags.includes('zuohua_ready')) {
    return '山中坐化，无疾而终'
  }
  if (c.flags.includes('wudang_hermit')) {
    return '山中坐化，无疾而终'
  }
  // 恶名昭彰：狱中/通缉中的「寿终」
  if (
    (c.fameEvil >= 40 || c.flags.includes('fugitive') || c.titles.some((t) => t.id === 'eguiman')) &&
    c.fameEvil >= c.fameGood
  ) {
    return '恶名缠身，狱中而终'
  }
  // 宗师 / 陆地神仙档
  if (c.realm === '宗师' || c.realm === '大宗师' || c.titles.some((t) => t.id === 'zongshi' || t.id === 'mengzhu')) {
    return '一代宗师，无疾而终'
  }
  return '寿元耗尽，寿终正寝'
}

/** 由死因文案生成可晒结局主标（一对一精标，禁止大锅「死于非命」） */
export function deathEndingTags(deathReason: string, c: Character): string[] {
  const tags: string[] = []
  const d = deathReason

  if (d.includes('坐化') || (d.includes('寿终') && (c.flags.includes('retreated') || c.flags.includes('yinshi_path')))) {
    tags.push('隐世而终')
  } else if (d.includes('宗师') && d.includes('无疾')) {
    tags.push('宗师善终')
  } else if (d.includes('狱中')) {
    tags.push('狱中而终')
  } else if (d.includes('寿终')) {
    tags.push('寿终正寝')
  } else if (d.includes('战死') || d.includes('血战')) {
    tags.push('战死沙场')
  } else if (d.includes('赐死')) {
    tags.push('朝廷赐死')
  } else if (d.includes('情劫') || d.includes('自绝')) {
    tags.push('情劫自尽')
  } else if (d.includes('走火') || d.includes('突破失败')) {
    tags.push('突破失败')
  } else if (d.includes('殉道')) {
    tags.push('门派殉道')
  } else if (d.includes('毒')) {
    tags.push('毒发身亡')
  } else if (d.includes('背叛')) {
    tags.push('门人反噬')
  } else if (d.includes('仇敌')) {
    tags.push('仇敌寻仇')
  } else if (d.includes('暗算')) {
    tags.push('遭人暗算')
  } else if (d.includes('沉疴') || d.includes('病榻') || d.includes('旧疾')) {
    tags.push('病榻而终')
  } else if (d.includes('伤') || d.includes('崩解')) {
    tags.push('伤重不治')
  } else if (d.includes('死于非命')) {
    tags.push('死于非命')
  } else {
    tags.push('江湖陨落')
  }

  return tags
}

export function primaryDeathTag(deathReason: string, c: Character): string {
  return deathEndingTags(deathReason, c)[0] ?? '江湖陨落'
}

export function enrichEndingTags(deathReason: string, c: Character, base: string[]): string[] {
  const tags = [...deathEndingTags(deathReason, c)]
  for (const t of base) {
    if (!tags.includes(t)) tags.push(t)
  }
  if (tags.length > 1 && tags.includes('江湖陨落')) {
    return tags.filter((t) => t !== '江湖陨落')
  }
  // 主死标优先，副标最多再留 2 个身份向标签
  const death = tags[0]
  const rest = tags.slice(1).filter((t) => t !== death).slice(0, 2)
  return [death, ...rest]
}

/**
 * 死因 vs 身份粗检：返回 mismatch 说明；空字符串表示可接受。
 * （审计用，不直接否决死亡）
 */
export function deathIdentityMismatch(deathReason: string, c: Character): string {
  const d = deathReason
  const tag = primaryDeathTag(d, c)

  if (tag === '朝廷赐死' && !c.flags.some((f) => ['official', 'fugitive', 'qincha', 'death_court'].includes(f))) {
    return '赐死但无朝堂烙印'
  }
  if (tag === '门派殉道' && c.flags.includes('left_sect') && !c.flags.includes('sect_martyr')) {
    return '已离派却门派殉道'
  }
  if (tag === '仇敌寻仇' && !c.relations.some((r) => r.kind === '仇敌') && !c.flags.includes('enemy_due')) {
    return '仇杀但无仇敌关系'
  }
  if (tag === '门人反噬' && !c.flags.includes('has_student') && !c.flags.includes('hunted_student')) {
    return '背叛死但无徒弟烙印'
  }
  if ((tag === '寿终正寝' || tag === '宗师善终' || tag === '隐世而终') && c.age < 50) {
    return '过早寿终'
  }
  if (tag === '战死沙场' && c.age >= 80 && !c.flags.includes('battlefield') && !c.flags.includes('army')) {
    return '高龄战死缺战场烙印'
  }
  if (tag === '情劫自尽' && !c.flags.includes('lost_lover') && !c.flags.includes('death_qingjie')) {
    return '情劫死无情缘烙印'
  }
  return ''
}

/** 晚年非叙事强绑定的横死 → 改写为寿终通路 */
export function rewriteLateDeath(c: Character, reason: string): string {
  if (c.age >= c.lifespan) return flavorLifespanDeath(c)
  const late = c.age >= Math.floor(c.lifespan * 0.78)
  if (!late) return reason
  // 保留强叙事死法
  if (/赐死|情劫|自绝|仇敌|背叛|毒|坐化|殉道|走火|突破失败/.test(reason)) return reason
  return flavorLifespanDeath(c)
}

/**
 * 过早的事件直杀：软免一次（改成重伤），把人命推向寿终区间。
 * 强叙事死法不赦免。
 */
export function trySparePrematureDeath(c: Character, reason: string): boolean {
  if (c.age >= Math.floor(c.lifespan * 0.78)) return false
  if (/赐死|情劫|自绝|仇敌寻仇|背叛|毒发|坐化|殉道/.test(reason)) return false
  if (c.flags.includes('fate_death_spared')) return false
  c.flags.push('fate_death_spared')
  c.attrs.体魄 = Math.max(12, c.attrs.体魄 || 0)
  if (c.age >= 50) c.flags.push('old_ailing')
  return true
}
