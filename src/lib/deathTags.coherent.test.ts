import { describe, expect, it } from 'vitest'
import {
  flavorBodyDeath,
  hasViolentDeathContext,
  isPeacefulDeathReason,
  primaryDeathTag,
  rewriteLateDeath,
} from './deathTags'
import type { Character } from '../types'

function stub(over: Partial<Character> = {}): Character {
  return {
    name: '吴凌风',
    gender: '男',
    originId: 'orphan',
    traitIds: [],
    attrs: { 根骨: 50, 悟性: 50, 福缘: 50, 魅力: 50, 体魄: 0, 心性: 0, 机缘: 50 },
    wealth: 10,
    force: 80,
    fameGood: 20,
    fameEvil: 0,
    realm: '大宗师',
    age: 62,
    lifespan: 70,
    martialArts: [],
    titles: [],
    primaryTitleId: null,
    flags: [],
    yearsWithoutMajor: 0,
    eventQueue: [],
    relations: [],
    portraitLook: 'wanderer',
    ...over,
  }
}

describe('death coherence · 天劫/劫伤', () => {
  it('硬接天劫后体魄归零不可改写成一代宗师无疾', () => {
    const c = stub({ flags: ['heaven_ok', 'heaven_scar'], realm: '大宗师', attrs: { ...stub().attrs, 体魄: 0 } })
    expect(hasViolentDeathContext(c)).toBe(true)
    const reason = flavorBodyDeath(c)
    expect(reason).toMatch(/天劫/)
    expect(rewriteLateDeath(c, reason)).toMatch(/天劫/)
    expect(primaryDeathTag(reason, c)).toBe('突破失败')
    expect(primaryDeathTag(rewriteLateDeath(c, reason), c)).not.toBe('宗师善终')
  })

  it('劫伤养好后不再按天劫记死因（heaven_ok 是战绩，不是伤）', () => {
    const c = stub({
      flags: ['heaven_ok'],
      realm: '大宗师',
      age: 72,
      attrs: { ...stub().attrs, 体魄: 0 },
    })
    expect(hasViolentDeathContext(c)).toBe(false)
    expect(flavorBodyDeath(c)).not.toMatch(/天劫/)
  })

  it('渡劫失败保持形神俱灭', () => {
    const c = stub({ flags: ['heaven_failed'], realm: '宗师' })
    const reason = rewriteLateDeath(c, '渡劫失败，形神俱灭')
    expect(reason).toBe('渡劫失败，形神俱灭')
  })

  it('自定义短死因不被晚年改写成无疾', () => {
    const base = {
      age: 70,
      lifespan: 75,
      attrs: { ...stub().attrs, 体魄: 10 },
      realm: '先天' as const,
    }
    expect(rewriteLateDeath(stub({ ...base, flags: ['road_hazard'] }), '镖道仇杀')).toBe(
      '江湖走镖，命丧途中',
    )
    expect(rewriteLateDeath(stub({ ...base, flags: ['battle_wounded'] }), '代师论剑败亡')).toBe(
      '血战而亡',
    )
    expect(rewriteLateDeath(stub({ ...base, flags: ['enemy_due'] }), '师仇未报')).toBe(
      '仇敌寻仇，命丧黄泉',
    )
  })

  it('恶斗重创烙印体魄归零不可善终', () => {
    const c = stub({
      flags: ['battle_wounded', 'severe_wound', 'final_duel'],
      attrs: { ...stub().attrs, 体魄: 0 },
      realm: '大宗师',
      age: 65,
      lifespan: 72,
    })
    expect(hasViolentDeathContext(c)).toBe(true)
    const reason = rewriteLateDeath(c, flavorBodyDeath(c))
    expect(isPeacefulDeathReason(reason)).toBe(false)
  })

  it('走火烙印体魄归零为经脉尽断', () => {
    const c = stub({ flags: ['meridian_gamble'], attrs: { ...stub().attrs, 体魄: 0 } })
    expect(flavorBodyDeath(c)).toMatch(/走火|经脉/)
  })

  it('闭关硬闯后体魄归零不可改写成山中坐化', () => {
    const c = stub({
      flags: ['broke_through', 'inner_risk', 'closedoor_risk', 'yinshi_path'],
      attrs: { ...stub().attrs, 体魄: 0 },
      realm: '先天',
      age: 57,
      lifespan: 72,
    })
    expect(hasViolentDeathContext(c)).toBe(true)
    const reason = rewriteLateDeath(c, flavorBodyDeath(c))
    expect(reason).toMatch(/走火|经脉/)
    expect(isPeacefulDeathReason(reason)).toBe(false)
    expect(primaryDeathTag(reason, c)).toBe('突破失败')
  })

  it('寻仇烙印优先于旧走火债', () => {
    const c = stub({
      flags: ['revenge_pursuit', 'meridian_gamble', 'inner_risk', 'broke_through'],
      attrs: { ...stub().attrs, 体魄: 0 },
      age: 56,
    })
    expect(flavorBodyDeath(c)).toMatch(/寻仇/)
    expect(primaryDeathTag(flavorBodyDeath(c), c)).toMatch(/伤重|途中/)
  })

  it('闭关险优先于陈年寻仇旗', () => {
    const c = stub({
      flags: ['avenged', 'closedoor_risk', 'broke_through'],
      attrs: { ...stub().attrs, 体魄: 0 },
      age: 66,
      realm: '大宗师',
    })
    expect(flavorBodyDeath(c)).toMatch(/走火|经脉/)
  })

  it('弟子追杀优先于陈年走镖烙印', () => {
    const c = stub({
      flags: ['hunted_student', 'betrayal_pursuit', 'road_hazard', 'escort_wounded'],
      attrs: { ...stub().attrs, 体魄: 0 },
      age: 61,
    })
    expect(flavorBodyDeath(c)).toMatch(/徒弟|背叛/)
    expect(primaryDeathTag(flavorBodyDeath(c), c)).toBe('门人反噬')
  })

  it('闭关险烙印在体魄归零时视为横死语境', () => {
    const c = stub({
      flags: ['broke_through', 'inner_risk', 'closedoor_risk'],
      attrs: { ...stub().attrs, 体魄: 0 },
      realm: '先天',
      age: 63,
      lifespan: 70,
    })
    expect(hasViolentDeathContext(c)).toBe(true)
    expect(isPeacefulDeathReason(flavorBodyDeath(c))).toBe(false)
  })
})
