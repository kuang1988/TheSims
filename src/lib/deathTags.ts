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
  '劳伤入骨，田埂而终',
  '商途债逼，郁郁而终',
  '致仕归乡，无疾而终',
  '工坊意外，伤重不治',
  '江湖走镖，命丧途中',
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
  '劳伤而终',
  '债逼而终',
  '致仕而终',
  '工伤而终',
  '途中而终',
  '死于非命',
  '江湖陨落',
] as const

const CIVIC_FLAGS = [
  'civic_shi',
  'civic_nong',
  'civic_gong',
  'civic_shang',
  'civic_wanderer',
  'civic_shi_finale',
  'civic_nong_finale',
  'civic_gong_finale',
  'civic_shang_finale',
  'civic_wanderer_finale',
] as const

export function hasCivicPath(c: Character): boolean {
  return CIVIC_FLAGS.some((f) => c.flags.includes(f))
}

export function hasBattlefieldContext(c: Character): boolean {
  return (
    c.flags.includes('army') ||
    c.flags.includes('battlefield') ||
    c.flags.includes('war_hero') ||
    (c.flags.includes('sect_scar') && c.flags.includes('war_hero'))
  )
}

export function hasStudentContext(c: Character): boolean {
  return c.flags.includes('has_student') || c.flags.includes('hunted_student')
}

/** 是否存在「横死语境」（不宜改写成寿终） */
export function hasViolentDeathContext(c: Character): boolean {
  if (c.flags.includes('enemy_due')) return true
  if (c.flags.includes('poisoned') || c.flags.includes('qi_deviation')) return true
  if (c.flags.includes('sect_martyr')) return true
  if (c.flags.includes('hunted_student')) return true
  if (hasBattlefieldContext(c) && c.age < 55) return true
  if (c.relations.some((r) => r.kind === '仇敌' && (r.revengeIn ?? 1) <= 0)) return true
  return false
}

/** 本业优先死法（凡尘归宿后；烙印优先于默认善终） */
export function flavorCivicDeath(c: Character): string | null {
  if (c.flags.includes('debt_ruin')) return '商途债逼，郁郁而终'
  if (c.flags.includes('workshop_accident')) return '工坊意外，伤重不治'
  if (c.flags.includes('road_hazard')) return '江湖走镖，命丧途中'
  if (c.flags.includes('jail_death') || (c.flags.includes('fugitive') && c.flags.includes('civic_shi_finale'))) {
    return '恶名缠身，狱中而终'
  }

  if (c.flags.includes('civic_shi_finale') || c.flags.includes('retired_official')) {
    return '致仕归乡，无疾而终'
  }
  if (c.flags.includes('civic_nong_finale')) {
    return c.flags.includes('old_ailing') || c.age >= 70 ? '沉疴不起，病榻而终' : '劳伤入骨，田埂而终'
  }
  if (c.flags.includes('civic_shang_finale')) {
    return '寿元耗尽，寿终正寝'
  }
  if (c.flags.includes('civic_gong_finale')) {
    return c.flags.includes('old_ailing') ? '沉疴不起，病榻而终' : '寿元耗尽，寿终正寝'
  }
  if (c.flags.includes('civic_wanderer_finale')) {
    if (c.flags.includes('retreated') || c.flags.includes('zuohua_ready') || c.flags.includes('yinshi_path')) {
      return '山中坐化，无疾而终'
    }
    return c.age >= 60 ? '沉疴不起，病榻而终' : null
  }
  if (c.flags.includes('civic_nong') && c.age >= 58 && !hasViolentDeathContext(c)) {
    return '劳伤入骨，田埂而终'
  }
  return null
}

/** 归宿旗下死因是否落在本业允许表 */
export function civicArcDeathMatch(deathReason: string, c: Character): boolean | null {
  const tag = primaryDeathTag(deathReason, c)
  if (c.flags.includes('civic_shi_finale')) {
    return ['致仕而终', '寿终正寝', '隐世而终', '狱中而终', '病榻而终', '遭人暗算', '朝廷赐死', '宗师善终'].includes(tag)
  }
  if (c.flags.includes('civic_nong_finale')) {
    return ['劳伤而终', '病榻而终', '寿终正寝', '隐世而终', '伤重不治'].includes(tag)
  }
  if (c.flags.includes('civic_gong_finale')) {
    return ['工伤而终', '病榻而终', '寿终正寝', '伤重不治', '隐世而终', '宗师善终'].includes(tag)
  }
  if (c.flags.includes('civic_shang_finale')) {
    return ['债逼而终', '寿终正寝', '病榻而终', '隐世而终', '遭人暗算', '伤重不治'].includes(tag)
  }
  if (c.flags.includes('civic_wanderer_finale')) {
    return ['途中而终', '隐世而终', '病榻而终', '寿终正寝', '仇敌寻仇', '伤重不治', '门人反噬', '宗师善终'].includes(tag)
  }
  return null
}

/**
 * 体魄归零时，按身份/烙印给出可晒死法。
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
  if (c.flags.includes('sect_scar') && c.flags.includes('war_hero') && c.age < 55) {
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
  // 战死：必须有战场语境且未过晚
  if (hasBattlefieldContext(c) && c.age < 50) {
    return '战死沙场'
  }
  // 门人反噬：仅追杀徒语境，且降低默认优先级（排在本业死法之后）
  const civic = flavorCivicDeath(c)
  if (civic) return civic

  if (c.flags.includes('hunted_student') && hasStudentContext(c)) {
    return '被徒弟背叛而死'
  }
  if (c.age >= 58 && !hasViolentDeathContext(c)) {
    return '沉疴不起，病榻而终'
  }
  if (c.flags.includes('official') || c.flags.includes('fugitive')) {
    if (c.age >= 60 && !hasViolentDeathContext(c)) return '沉疴不起，病榻而终'
    return '遭人暗算，死于非命'
  }
  return '体魄崩解，伤重不治'
}

export function flavorLifespanDeath(c: Character): string {
  if (c.flags.includes('yinshi_path') || c.flags.includes('zuohua_ready')) {
    return '山中坐化，无疾而终'
  }
  if (c.flags.includes('wudang_hermit')) {
    return '山中坐化，无疾而终'
  }
  if (c.flags.includes('civic_shi_finale') || c.flags.includes('retired_official')) {
    return '致仕归乡，无疾而终'
  }
  if (c.flags.includes('civic_nong_finale')) {
    return '劳伤入骨，田埂而终'
  }
  if (c.flags.includes('civic_shang_finale') && c.flags.includes('debt_ruin')) {
    return '商途债逼，郁郁而终'
  }
  if (
    (c.fameEvil >= 40 || c.flags.includes('fugitive') || c.titles.some((t) => t.id === 'eguiman')) &&
    c.fameEvil >= c.fameGood
  ) {
    return '恶名缠身，狱中而终'
  }
  if (c.realm === '宗师' || c.realm === '大宗师' || c.titles.some((t) => t.id === 'zongshi' || t.id === 'mengzhu')) {
    return '一代宗师，无疾而终'
  }
  if (c.flags.includes('old_ailing') || c.age >= 70) {
    return '沉疴不起，病榻而终'
  }
  return '寿元耗尽，寿终正寝'
}

export function deathEndingTags(deathReason: string, _c: Character): string[] {
  const tags: string[] = []
  const d = deathReason

  if (d.includes('致仕')) tags.push('致仕而终')
  else if (d.includes('劳伤') || d.includes('田埂')) tags.push('劳伤而终')
  else if (d.includes('债逼') || d.includes('郁郁')) tags.push('债逼而终')
  else if (d.includes('工坊')) tags.push('工伤而终')
  else if (d.includes('走镖') || d.includes('途中')) tags.push('途中而终')
  else if (d.includes('坐化')) tags.push('隐世而终')
  else if (d.includes('宗师') && d.includes('无疾')) tags.push('宗师善终')
  else if (d.includes('狱中')) tags.push('狱中而终')
  else if (d.includes('寿终') || d.includes('无疾而终')) tags.push('寿终正寝')
  else if (d.includes('战死') || d.includes('血战')) tags.push('战死沙场')
  else if (d.includes('赐死')) tags.push('朝廷赐死')
  else if (d.includes('情劫') || d.includes('自绝')) tags.push('情劫自尽')
  else if (d.includes('走火') || d.includes('突破失败')) tags.push('突破失败')
  else if (d.includes('殉道')) tags.push('门派殉道')
  else if (d.includes('毒')) tags.push('毒发身亡')
  else if (d.includes('背叛')) tags.push('门人反噬')
  else if (d.includes('仇敌')) tags.push('仇敌寻仇')
  else if (d.includes('暗算')) tags.push('遭人暗算')
  else if (d.includes('沉疴') || d.includes('病榻') || d.includes('旧疾')) tags.push('病榻而终')
  else if (d.includes('伤') || d.includes('崩解')) tags.push('伤重不治')
  else if (d.includes('死于非命')) tags.push('死于非命')
  else tags.push('江湖陨落')

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
  const death = tags[0]
  const rest = tags.slice(1).filter((t) => t !== death).slice(0, 2)
  return [death, ...rest]
}

export function deathIdentityMismatch(deathReason: string, c: Character): string {
  const tag = primaryDeathTag(deathReason, c)

  if (tag === '朝廷赐死' && !c.flags.some((f) => ['official', 'fugitive', 'qincha', 'death_court'].includes(f))) {
    return '赐死但无朝堂烙印'
  }
  if (tag === '门派殉道' && c.flags.includes('left_sect') && !c.flags.includes('sect_martyr')) {
    return '已离派却门派殉道'
  }
  if (tag === '仇敌寻仇' && !c.relations.some((r) => r.kind === '仇敌') && !c.flags.includes('enemy_due')) {
    return '仇杀但无仇敌关系'
  }
  if (tag === '门人反噬' && !hasStudentContext(c)) {
    return '背叛死但无徒弟烙印'
  }
  if ((tag === '寿终正寝' || tag === '宗师善终' || tag === '隐世而终' || tag === '致仕而终') && c.age < 50) {
    return '过早寿终'
  }
  if (tag === '战死沙场' && !hasBattlefieldContext(c)) {
    return '战死缺战场烙印'
  }
  if (tag === '情劫自尽' && !c.flags.includes('lost_lover') && !c.flags.includes('death_qingjie')) {
    return '情劫死无情缘烙印'
  }
  return ''
}

/** 软违和：凡人主线却横死等（不含硬 mismatch） */
export function deathSoftMismatch(deathReason: string, c: Character, mainline?: string): string {
  if (deathIdentityMismatch(deathReason, c)) return ''
  const tag = primaryDeathTag(deathReason, c)
  const civicMain = mainline && ['农桑', '商途', '士途', '市井', '江湖客'].includes(mainline)
  if (civicMain) {
    if (tag === '战死沙场' && !hasBattlefieldContext(c)) return '凡人弧战死缺战场'
    if (tag === '门人反噬' && !c.flags.includes('hunted_student')) return '凡人弧门人反噬过重'
  }
  return ''
}

/** 纠正不合法死因文案（硬改写） */
export function sanitizeDeathReason(c: Character, reason: string): string {
  let r = reason
  if (/背叛/.test(r) && !hasStudentContext(c)) {
    r = flavorCivicDeath(c) ?? (c.age >= 55 ? '沉疴不起，病榻而终' : '体魄崩解，伤重不治')
  }
  if (/背叛/.test(r) && hasCivicPath(c) && c.flags.some((f) => f.endsWith('_finale')) && !c.flags.includes('hunted_student')) {
    r = flavorCivicDeath(c) ?? flavorLifespanDeath(c)
  }
  if ((/战死|血战/.test(r)) && !hasBattlefieldContext(c)) {
    r = flavorCivicDeath(c) ?? (c.age >= 55 ? flavorLifespanDeath(c) : '体魄崩解，伤重不治')
  }
  if (/赐死/.test(r) && !c.flags.some((f) => ['official', 'fugitive', 'qincha', 'death_court'].includes(f))) {
    r = c.age >= 55 ? flavorLifespanDeath(c) : '遭人暗算，死于非命'
  }
  // 凡尘归宿后：死因必须落在本业允许表
  if (civicArcDeathMatch(r, c) === false) {
    r = flavorCivicDeath(c) ?? (c.age >= 55 ? flavorLifespanDeath(c) : '沉疴不起，病榻而终')
  }
  return r
}

export function rewriteLateDeath(c: Character, reason: string): string {
  const sanitized = sanitizeDeathReason(c, reason)
  if (c.age >= c.lifespan) return flavorLifespanDeath(c)
  if (civicArcDeathMatch(sanitized, c) === false) {
    return flavorCivicDeath(c) ?? flavorLifespanDeath(c)
  }
  const late = c.age >= Math.floor(c.lifespan * 0.78)
  if (!late) return sanitized
  if (/赐死|情劫|自绝|仇敌|毒|坐化|殉道|走火|突破失败|劳伤|债逼|致仕|工坊|走镖|狱中/.test(sanitized)) {
    return sanitized
  }
  // 晚年无强叙事：本业死或寿终；背叛不再默认保留
  if (/背叛/.test(sanitized) && !c.flags.includes('hunted_student')) {
    return flavorCivicDeath(c) ?? flavorLifespanDeath(c)
  }
  return flavorCivicDeath(c) ?? flavorLifespanDeath(c)
}

export function trySparePrematureDeath(c: Character, reason: string): boolean {
  if (c.age >= Math.floor(c.lifespan * 0.78)) return false
  // 门人反噬：非追杀徒也赦免一次，压热度
  if (/背叛/.test(reason) && !c.flags.includes('hunted_student')) {
    if (c.flags.includes('fate_death_spared')) return false
    c.flags.push('fate_death_spared')
    c.attrs.体魄 = Math.max(12, c.attrs.体魄 || 0)
    return true
  }
  if (/赐死|情劫|自绝|仇敌寻仇|毒发|坐化|殉道|劳伤|债逼|致仕/.test(reason)) return false
  if (c.flags.includes('fate_death_spared')) return false
  c.flags.push('fate_death_spared')
  c.attrs.体魄 = Math.max(12, c.attrs.体魄 || 0)
  if (c.age >= 50) c.flags.push('old_ailing')
  return true
}

/** 本业友好死（寿终+病榻+劳伤+债+致仕+工伤） */
export function isCivicPeacefulDeath(reason: string): boolean {
  return /寿终|坐化|无疾|病榻|沉疴|旧疾|劳伤|债逼|致仕|田埂|郁郁/.test(reason)
}
