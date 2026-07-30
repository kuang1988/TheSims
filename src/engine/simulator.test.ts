import { describe, expect, it } from 'vitest'
import { EVENTS } from '../data/events'
import { MARTIAL_ARTS } from '../data/martialArts'
import { ORIGINS } from '../data/origins'
import { TITLES } from '../data/titles'
import { TRAITS } from '../data/traits'
import { matchSynergies } from '../data/synergies'
import {
  applyEffects,
  autoPickChoice,
  buildEnding,
  calcForce,
  createBirth,
  eventWeight,
  LifeSimulator,
} from '../engine/simulator'
import { endingMoralTags } from '../lib/alignment'
import { countSectFinaleDone, hasZombieSectFlags } from '../lib/leaveSect'
import { resolveCombat } from '../lib/combat'
import { tickEnemyCountdowns, upsertRelation } from '../lib/relations'
import { ensureRelationCallbacks } from '../lib/relationPath'
import { sanitizeDeathReason } from '../lib/deathTags'
import { ACHIEVEMENTS, syncCodexFromEnding } from '../lib/meta'
import { detectMainline } from '../lib/story'
import { createRng, heartTier } from '../lib/utils'

describe('heartTier', () => {
  it('maps numeric heart to tiers', () => {
    expect(heartTier(80)).toBe('至善')
    expect(heartTier(30)).toBe('偏正')
    expect(heartTier(0)).toBe('中庸')
    expect(heartTier(-40)).toBe('偏邪')
    expect(heartTier(-90)).toBe('极恶')
  })
})

describe('createBirth', () => {
  it('creates a valid character from seed', () => {
    const a = createBirth(42)
    const b = createBirth(42)
    expect(a.name).toBe(b.name)
    expect(a.originId).toBe(b.originId)
    expect(a.traitIds).toEqual(b.traitIds)
    expect(ORIGINS.some((o) => o.id === a.originId)).toBe(true)
    expect(a.traitIds.length).toBeGreaterThanOrEqual(2)
    expect(a.traitIds.length).toBeLessThanOrEqual(4)
    expect(a.age).toBe(0)
    expect(a.eventQueue).toEqual([])
  })

  it('respects gender override', () => {
    expect(createBirth(42, '男').gender).toBe('男')
    expect(createBirth(42, '女').gender).toBe('女')
    expect(createBirth(99, '男').gender).toBe('男')
    expect(createBirth(99, '女').gender).toBe('女')
  })
})

describe('event queue coherence', () => {
  it('queues follow-up events from choices', () => {
    const c = createBirth(1)
    applyEffects(
      c,
      {
        addFlag: 'survivor',
        queueEvent: { id: 'survivor_scar', delayYears: 3 },
      },
      10,
      'test',
    )
    expect(c.flags).toContain('survivor')
    expect(c.eventQueue).toEqual([{ eventId: 'survivor_scar', dueAge: 13 }])
  })

  it('plays queued follow-up after delay', () => {
    const c = createBirth(88)
    c.age = 14
    c.flags.push('survivor')
    c.eventQueue.push({ eventId: 'survivor_scar', dueAge: 15 })
    const sim = new LifeSimulator(c, 1001, 'auto')
    const r = sim.advanceYear()
    expect(r.died).toBe(false)
    const titles = sim.logs.map((l) => l.title)
    expect(titles).toContain('故乡余烬')
    expect(sim.character.eventQueue.some((q) => q.eventId === 'survivor_scar')).toBe(false)
  })

  it('every queueEvent target exists', () => {
    const ids = new Set(EVENTS.map((e) => e.id))
    for (const ev of EVENTS) {
      for (const ch of ev.choices) {
        const qs = [
          ...(ch.effects.queueEvent ? [ch.effects.queueEvent] : []),
          ...(ch.effects.queueEvents ?? []),
        ]
        for (const q of qs) {
          expect(ids.has(q.id)).toBe(true)
        }
      }
    }
  })
})

describe('LifeSimulator auto mode', () => {
  it('runs until death and produces ending', () => {
    const c = createBirth(12345)
    const sim = new LifeSimulator(c, 99991, 'auto')
    const result = sim.runUntilPause(200)
    expect(result.died).toBe(true)
    expect(sim.character.age).toBeGreaterThan(0)
    expect(sim.deathReason.length).toBeGreaterThan(0)
    const ending = buildEnding(sim)
    expect(ending.summary).toContain(sim.character.name)
    expect(ending.finalAge).toBe(sim.character.age)
    expect(ending.score).toBeGreaterThan(0)
    expect(ending.mainline).toBeTruthy()
    expect(typeof ending.force).toBe('number')
    expect(ending.lifeLog.length).toBeGreaterThan(0)
  })

  it('force includes martial arts', () => {
    const c = createBirth(7)
    c.martialArts.push({ id: 'dugu', level: 3, source: 'test', learnedAt: 20 })
    const before = c.force
    expect(calcForce(c)).toBeGreaterThan(before)
  })
})

describe('data integrity', () => {
  it('events reference existing martial/titles', () => {
    const martialIds = new Set(MARTIAL_ARTS.map((m) => m.id))
    const titleIds = new Set(TITLES.map((t) => t.id))
    const traitIds = new Set(TRAITS.map((t) => t.id))
    const originIds = new Set(ORIGINS.map((o) => o.id))

    for (const ev of EVENTS) {
      for (const ch of ev.choices) {
        if (ch.effects.addMartialArt) {
          expect(martialIds.has(ch.effects.addMartialArt)).toBe(true)
        }
        if (ch.effects.grantTitle) {
          expect(titleIds.has(ch.effects.grantTitle)).toBe(true)
        }
      }
      if (ev.conditions?.traits) {
        for (const t of ev.conditions.traits) expect(traitIds.has(t)).toBe(true)
      }
      if (ev.conditions?.origins) {
        for (const o of ev.conditions.origins) expect(originIds.has(o)).toBe(true)
      }
      if (ev.conditions?.hasMartial) {
        for (const m of ev.conditions.hasMartial) expect(martialIds.has(m)).toBe(true)
      }
    }
  })

  it('has enough content for phase 1', () => {
    expect(ORIGINS.length).toBeGreaterThanOrEqual(8)
    expect(TRAITS.length).toBeGreaterThanOrEqual(20)
    expect(EVENTS.length).toBeGreaterThanOrEqual(60)
    expect(MARTIAL_ARTS.length).toBeGreaterThanOrEqual(15)
    expect(TITLES.length).toBeGreaterThanOrEqual(15)
  })

  it('meets phase 3 content scale', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(200)
    expect(TRAITS.length).toBeGreaterThanOrEqual(50)
    expect(TITLES.length).toBeGreaterThanOrEqual(60)
    expect(MARTIAL_ARTS.length).toBeGreaterThanOrEqual(40)
  })
})

describe('detectMainline', () => {
  it('prefers demon lord path', () => {
    const c = createBirth(3)
    c.flags.push('demon_sect', 'demon_lord')
    expect(detectMainline(c)).toBe('魔教')
  })

  it('prefers alliance path', () => {
    const c = createBirth(4)
    c.flags.push('helped_people', 'alliance_leader', 'war_hero')
    expect(detectMainline(c)).toBe('正道')
  })
})

describe('phase2 combat & relations', () => {
  it('createBirth starts with empty relations', () => {
    expect(createBirth(1).relations).toEqual([])
  })

  it('applies synergy when traits match', () => {
    const syns = matchSynergies(['jiangu', 'qingxin'])
    expect(syns.some((s) => s.id === 'jianxin')).toBe(true)
    const c = createBirth(777, '男', { lockedTraitIds: ['jiangu', 'qingxin'] })
    expect(c.traitIds).toEqual(expect.arrayContaining(['jiangu', 'qingxin']))
    expect(c.flags).toContain('synergy_jianxin')
    expect(c.eventQueue.some((q) => q.eventId === 'synergy_jianxin_trial')).toBe(true)
  })

  it('半对词条时有机会强制补齐 synergy', () => {
    // 固定种子下多抽几次：至少有一局补齐 jiangu+qingxin 或 renxin+haoxia 等
    let hit = 0
    for (let i = 0; i < 80; i++) {
      const c = createBirth(9000 + i * 17, '男', { lockedTraitIds: ['jiangu'] })
      expect(c.traitIds).toContain('jiangu')
      if (c.traitIds.includes('qingxin') && c.flags.includes('synergy_jianxin')) hit += 1
    }
    expect(hit).toBeGreaterThan(5)
  })

  it('respects locked trait on birth', () => {
    const c = createBirth(555, '男', { lockedTraitIds: ['renxin'] })
    expect(c.traitIds).toContain('renxin')
  })

  it('resolveCombat returns structured outcome', () => {
    const r = resolveCombat(80, 60, 40, () => 0.5, '试剑人')
    expect(r.won).toBe(true)
    expect(r.text).toContain('试剑人')
  })

  it('applyEffects combat branch applies onWin', () => {
    const c = createBirth(11)
    c.force = 90
    c.attrs.福缘 = 80
    applyEffects(
      c,
      {
        combat: {
          foePower: 20,
          foeName: '弱敌',
          onWin: { addFlag: 'combat_won', attrs: { 武力: 3 } },
          onLose: { addFlag: 'combat_lost' },
        },
      },
      20,
      'test',
      () => 0.9,
    )
    expect(c.flags).toContain('combat_won')
    expect(c.flags).not.toContain('combat_lost')
  })

  it('enemy countdown queues revenge', () => {
    const c = createBirth(22)
    upsertRelation(c, { kind: '仇敌', name: '霍破军', revengeIn: 1 }, () => 0.2)
    const due1 = tickEnemyCountdowns(c)
    expect(due1).toContain('relation_revenge')
    expect(c.flags).toContain('enemy_due')
    expect(c.relations.find((r) => r.kind === '仇敌')?.revengeIn).toBe(0)
  })

  it('includes phase2 event ids', () => {
    const ids = new Set(EVENTS.map((e) => e.id))
    for (const id of [
      'relation_revenge',
      'huashan_assign',
      'huashan_sword_trial',
      'gaibang_oath',
      'trait_mozhong_dream',
      'trait_yixian_clinic',
      'trait_jiangu_dream',
    ]) {
      expect(ids.has(id)).toBe(true)
    }
  })
})

describe('alignment title coherence', () => {
  it('blocks righteous titles after massacre / eguiman', () => {
    const c = createBirth(9)
    c.flags.push('massacre', 'bandit_blood')
    c.attrs.心性 = -70
    applyEffects(c, { grantTitle: 'eguiman' }, 40, 'test')
    expect(c.titles.some((t) => t.id === 'eguiman')).toBe(true)
    applyEffects(c, { grantTitle: 'junzijian' }, 41, 'test')
    applyEffects(c, { grantTitle: 'shendiaoyishi' }, 42, 'test')
    expect(c.titles.some((t) => t.id === 'junzijian')).toBe(false)
    expect(c.titles.some((t) => t.id === 'shendiaoyishi')).toBe(false)
  })

  it('strips righteous titles when falling to eguiman', () => {
    const c = createBirth(10)
    c.attrs.心性 = 30
    applyEffects(c, { grantTitle: 'junzijian' }, 25, 'test')
    applyEffects(c, { grantTitle: 'shendiaoyishi' }, 28, 'test')
    expect(c.titles.some((t) => t.id === 'junzijian')).toBe(true)
    c.attrs.心性 = -40
    applyEffects(c, { grantTitle: 'eguiman', addFlags: ['massacre'] }, 45, 'test')
    expect(c.titles.some((t) => t.id === 'eguiman')).toBe(true)
    expect(c.titles.some((t) => t.id === 'junzijian')).toBe(false)
    expect(c.titles.some((t) => t.id === 'shendiaoyishi')).toBe(false)
  })

  it('ending tag 恶名昭彰 not with righteous titles', () => {
    const c = createBirth(11)
    c.attrs.心性 = 40
    applyEffects(c, { grantTitle: 'junzijian' }, 20, 'test')
    expect(c.titles.some((t) => t.id === 'junzijian')).toBe(true)
    c.attrs.心性 = -80
    const tags = endingMoralTags(c, (id) => TITLES.find((t) => t.id === id)!)
    expect(tags).not.toContain('恶名昭彰')
  })
})

describe('phase4 story coherence', () => {
  it('includes sect finales and trait echoes', () => {
    const ids = new Set(EVENTS.map((e) => e.id))
    for (const id of [
      'huashan_finale',
      'huashan_demon_raid',
      'gaibang_finale',
      'gaibang_info_net',
      'wudang_true_martial_letter',
      'shaolin_injured_echo',
      'emei_poison_echo',
      'trait_mozhong_echo',
      'trait_yixian_echo',
      'trait_jiangu_echo',
      'love_revenge_settle',
      'ignored_injustice_echo',
      'demon_fugitive_echo',
    ]) {
      expect(ids.has(id)).toBe(true)
    }
  })

  it('batch runs never mix evil identity titles with righteous ones', () => {
    const evil = new Set(['eguiman', 'jiaozhu', 'mozhang', 'sharen', 'jianmo'])
    const good = new Set(['junzijian', 'shendiaoyishi', 'mengzhu', 'jiushi', 'pomo', 'jianxian'])
    let conflicts = 0
    for (let i = 0; i < 50; i++) {
      const seed = 40000 + i * 137
      const c = createBirth(seed)
      const sim = new LifeSimulator(c, seed ^ 0xabcdef, 'auto')
      sim.runUntilPause(250)
      const ids = sim.character.titles.map((t) => t.id)
      const hasEvil = ids.some((id) => evil.has(id))
      const hasGood = ids.some((id) => good.has(id))
      if (hasEvil && hasGood) conflicts += 1
    }
    expect(conflicts).toBe(0)
  })
})

describe('codex achievements', () => {
  it('unlocks early_death for young ending', () => {
    const key = 'wuxia-life-sim-codex-v1'
    const prev = globalThis.localStorage?.getItem(key)
    globalThis.localStorage?.removeItem(key)
    const c = createBirth(5)
    c.age = 22
    c.titles.push({ id: 'junzijian', gainedAt: 20, source: 'test' })
    const ending = {
      character: c,
      summary: 'test',
      finalAge: 22,
      deathReason: '早夭',
      score: 10,
      force: 1,
      highlights: [],
      endingTags: ['早夭'],
      mainline: '散修',
      lifeLog: [],
    }
    const { newAchievements } = syncCodexFromEnding(ending)
    expect(newAchievements.some((a) => a.id === 'early_death')).toBe(true)
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(8)
    if (prev != null) globalThis.localStorage?.setItem(key, prev)
    else globalThis.localStorage?.removeItem(key)
  })

  it('新成就可识别丐帮/破魔/情缘等里程碑', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'gaibang_lord')).toBe(true)
    expect(ACHIEVEMENTS.some((a) => a.id === 'pomo_path')).toBe(true)
    expect(ACHIEVEMENTS.some((a) => a.id === 'love_settled')).toBe(true)
    const c = createBirth(3)
    c.flags.push('gaibang_finale_done')
    const ending = {
      character: c,
      summary: 't',
      finalAge: 60,
      deathReason: '寿终',
      score: 1,
      force: 1,
      highlights: [],
      endingTags: [],
      mainline: '丐帮',
      lifeLog: [],
    }
    expect(ACHIEVEMENTS.find((a) => a.id === 'gaibang_lord')!.check(ending)).toBe(true)
  })
})

describe('§4.0 attr & trait drive life', () => {
  it('高机缘抬高奇遇权重，低机缘相对更低', () => {
    const base = createBirth(77)
    const high = structuredClone(base)
    const low = structuredClone(base)
    high.attrs.机缘 = 90
    low.attrs.机缘 = 10
    high.attrs.福缘 = low.attrs.福缘 = 50
    const sample = EVENTS.filter((e) => e.tags.includes('奇遇')).slice(0, 40)
    const sum = (c: typeof base) => sample.reduce((s, e) => s + eventWeight(c, e), 0)
    expect(sum(high)).toBeGreaterThan(sum(low) * 1.15)
  })

  it('霉运词条抬高灾祸权重', () => {
    const withTrait = createBirth(11)
    const plain = createBirth(11)
    withTrait.traitIds = ['meiyun']
    plain.traitIds = ['tieshi']
    withTrait.attrs.福缘 = plain.attrs.福缘 = 40
    const bad = EVENTS.filter((e) => e.tags.includes('灾祸') || e.tags.includes('坏事')).slice(0, 30)
    const sum = (c: typeof withTrait) => bad.reduce((s, e) => s + eventWeight(c, e), 0)
    expect(sum(withTrait)).toBeGreaterThan(sum(plain) * 1.2)
  })

  it('同 seed 换词条后，词条专属事件可出现在人生日志', () => {
    const traits = ['meiyun', 'fuxing', 'daogu', 'hongyan', 'shanggu', 'duxin', 'chaoting', 'guomu']
    let hit = 0
    for (const tid of traits) {
      const c = createBirth(2026)
      c.traitIds = [tid, 'tieshi']
      const sim = new LifeSimulator(c, 2026 ^ 0x55aa, 'auto')
      sim.runUntilPause(250)
      const titles = sim.logs.map((l) => l.title)
      const flags = sim.character.flags
      const drove =
        titles.some((t) =>
          [
            '霉运开端',
            '福星临门',
            '刀骨觉醒',
            '惊鸿一瞥',
            '商骨算盘',
            '毒香入鼻',
            '庙堂残卷',
            '过目残卷',
          ].includes(t),
        ) ||
        flags.some((f) =>
          [
            'meiyun_endured',
            'meiyun_trouble',
            'fuxing_path',
            'daogu_path',
            'shanggu_path',
            'duxin_path',
            'chaoting_path',
            'guomu_path',
            'hongyan_avoided',
            'lover',
          ].includes(f),
        )
      if (drove) hit += 1
    }
    expect(hit).toBeGreaterThanOrEqual(5)
  })

  it('词条驱动包：队列目标与称号均存在', () => {
    const ids = new Set(EVENTS.map((e) => e.id))
    const titleIds = new Set(TITLES.map((t) => t.id))
    const martialIds = new Set(MARTIAL_ARTS.map((m) => m.id))
    const drive = EVENTS.filter((e) => e.id.startsWith('trait_'))
    expect(drive.length).toBeGreaterThanOrEqual(40)
    for (const ev of drive) {
      for (const ch of ev.choices) {
        const bundles = [
          ch.effects,
          ch.effects.combat?.onWin,
          ch.effects.combat?.onLose,
          ch.effects.combat?.onDraw,
        ].filter(Boolean) as NonNullable<typeof ch.effects>[]
        for (const fx of bundles) {
          for (const q of [
            ...(fx.queueEvent ? [fx.queueEvent] : []),
            ...(fx.queueEvents ?? []),
          ]) {
            expect(ids.has(q.id)).toBe(true)
          }
          if (fx.grantTitle) expect(titleIds.has(fx.grantTitle)).toBe(true)
          if (fx.addMartialArt) expect(martialIds.has(fx.addMartialArt)).toBe(true)
        }
      }
    }
  })
})

describe('§4.1 story coherence', () => {
  it('情敌败线会写入 lost_lover，使 love_revenge 可匹配', () => {
    const c = createBirth(42)
    c.age = 22
    c.flags.push('lover')
    applyEffects(
      c,
      {
        addFlags: ['lost_lover', 'rival_humiliated'],
        removeFlags: ['lover', 'married'],
        queueEvent: { id: 'love_revenge', delayYears: 1 },
      },
      22,
      'test',
    )
    expect(c.flags).toContain('lost_lover')
    expect(c.eventQueue.some((q) => q.eventId === 'love_revenge')).toBe(true)
    const ev = EVENTS.find((e) => e.id === 'love_revenge')!
    expect(ev.conditions?.anyFlags?.some((f) => c.flags.includes(f))).toBe(true)
  })

  it('华山影子战旗可进入华山终局条件', () => {
    const finale = EVENTS.find((e) => e.id === 'huashan_finale')!
    expect(finale.conditions?.anyFlags).toContain('huashan_shadow_duel')
  })

  it('商途/朝廷独有劫事件存在且队列目标有效', () => {
    const ids = new Set(EVENTS.map((e) => e.id))
    for (const id of ['merchant_ledger_crisis', 'court_secret_edict']) {
      const ev = EVENTS.find((e) => e.id === id)
      expect(ev).toBeTruthy()
      expect(ev!.importance).toBe(5)
      for (const ch of ev!.choices) {
        for (const q of [
          ...(ch.effects.queueEvent ? [ch.effects.queueEvent] : []),
          ...(ch.effects.queueEvents ?? []),
        ]) {
          expect(ids.has(q.id)).toBe(true)
        }
      }
    }
  })

  it('固定种子：五大门派终局事件齐全且抉择≥2', () => {
    for (const id of [
      'huashan_finale',
      'wudang_finale',
      'shaolin_finale',
      'emei_finale',
      'gaibang_finale',
    ]) {
      const finale = EVENTS.find((e) => e.id === id)
      expect(finale, id).toBeTruthy()
      expect(finale!.once).toBe(true)
      expect(finale!.choices.length).toBeGreaterThanOrEqual(2)
      expect(finale!.importance).toBeGreaterThanOrEqual(4)
    }
    // 华山：私下了结 → 魔袭 → 终局 链路在数据层闭合
    const cliff = EVENTS.find((e) => e.id === 'huashan_cliff_duel')!
    const shadow = cliff.choices.find((c) => c.text.includes('私下'))!
    const qs = [
      ...(shadow.effects.queueEvent ? [shadow.effects.queueEvent] : []),
      ...(shadow.effects.queueEvents ?? []),
    ].map((q) => q.id)
    expect(qs).toContain('huashan_demon_raid')
  })

  it('队列因人生阶段暂不匹配时保留，不静默丢弃', () => {
    const c = createBirth(55)
    c.age = 22
    c.flags.push('army')
    c.eventQueue.push({ eventId: 'court_military_campaign', dueAge: 22 })
    const sim = new LifeSimulator(c, 55, 'auto')
    sim.advanceYear()
    expect(sim.character.eventQueue.some((q) => q.eventId === 'court_military_campaign')).toBe(true)
    // 推入壮年后再消化
    sim.character.age = 32
    sim.character.eventQueue = [{ eventId: 'court_military_campaign', dueAge: 22 }]
    const before = sim.logs.length
    sim.advanceYear()
    expect(sim.character.eventQueue.some((q) => q.eventId === 'court_military_campaign')).toBe(false)
    expect(sim.logs.length).toBeGreaterThan(before)
    expect(sim.logs.some((l) => l.title === '边关征战')).toBe(true)
  })

  it('情缘主链会排队情敌决斗', () => {
    const love = EVENTS.find((e) => e.id === 'youth_love')!
    const accept = love.choices.find((ch) => ch.text.includes('相许'))!
    const qs = [
      ...(accept.effects.queueEvent ? [accept.effects.queueEvent] : []),
      ...(accept.effects.queueEvents ?? []),
    ].map((q) => q.id)
    expect(qs).toContain('conflict_rival_lover')
    const marry = EVENTS.find((e) => e.id === 'love_marry')!
    const mqs = (marry.choices[0].effects.queueEvents ?? []).map((q) => q.id)
    expect(mqs).toContain('conflict_rival_lover')
  })

  it('强制门派旗后全自动人生可出现对应终局标题', () => {
    const cases: { flag: string; extra: string[]; title: string }[] = [
      { flag: 'sect_huashan', extra: ['huashan_defended', 'sect_loyal'], title: '华山余剑' },
      { flag: 'sect_wudang', extra: ['sect_loyal'], title: '武当余韵' },
      { flag: 'sect_shaolin', extra: ['sect_loyal'], title: '少林归处' },
      { flag: 'sect_emei', extra: ['sect_loyal'], title: '峨眉余韵' },
      { flag: 'gaibang_member', extra: ['gaibang_heir'], title: '丐帮终章' },
    ]
    let hit = 0
    for (const [i, cs] of cases.entries()) {
      const c = createBirth(7000 + i)
      c.age = 35
      c.flags.push('sect_outer', 'path_chosen', cs.flag, ...cs.extra)
      if (!cs.flag.startsWith('sect_')) c.flags.push('sect_gaibang')
      c.eventQueue.push({
        eventId:
          cs.title === '华山余剑'
            ? 'huashan_finale'
            : cs.title === '武当余韵'
              ? 'wudang_finale'
              : cs.title === '少林归处'
                ? 'shaolin_finale'
                : cs.title === '峨眉余韵'
                  ? 'emei_finale'
                  : 'gaibang_finale',
        dueAge: 35,
      })
      const sim = new LifeSimulator(c, 8000 + i, 'auto')
      sim.runUntilPause(80)
      if (sim.logs.some((l) => l.title === cs.title)) hit += 1
    }
    expect(hit).toBeGreaterThanOrEqual(4)
  })

  it('在籍门派会保底排队终章相关事件', () => {
    const c = createBirth(4242)
    c.age = 19
    c.flags.push('sect_outer', 'sect_huashan', 'sect_loyal', 'path_chosen')
    const sim = new LifeSimulator(c, 4242, 'auto')
    // 推到入口年龄
    while (sim.character.age < 21 && !sim.ended) sim.advanceYear()
    const q = sim.character.eventQueue.map((x) => x.eventId)
    expect(
      q.some((id) => id === 'huashan_sword_trial' || id === 'huashan_cliff_duel'),
    ).toBe(true)
  })

  it('加入新门派会清除他门核心旗', () => {
    const c = createBirth(7)
    c.flags.push('sect_shaolin', 'shaolin_elite')
    applyEffects(c, { addFlags: ['sect_huashan', 'sect_outer'] }, 18, 'test')
    expect(c.flags).toContain('sect_huashan')
    expect(c.flags).not.toContain('sect_shaolin')
    expect(c.flags).not.toContain('shaolin_elite')
  })

  it('在籍时主线优先判门派而非散修', () => {
    const c = createBirth(9)
    c.flags.push('sect_wudang', 'sect_outer', 'wanderer', 'sect_loyal')
    expect(detectMainline(c)).toBe('门派')
  })

  it('烧信后不再排队情缘终局，且无道侣时情劫死会被改写', () => {
    const c = createBirth(88)
    c.age = 30
    c.flags.push('lover', 'lover_revisited', 'lost_lover', 'love_closed', 'lover_fate_done')
    ensureRelationCallbacks(c)
    expect(c.eventQueue.some((q) => q.eventId === 'rel_lover_fate')).toBe(false)

    const rewritten = sanitizeDeathReason(c, '情劫难渡，自绝于世')
    expect(rewritten.includes('情劫') || rewritten.includes('自绝')).toBe(false)
  })

  it('赴约重逢后情缘终局自尽选项对正常心性不可用', () => {
    const c = createBirth(89)
    c.age = 33
    c.attrs.心性 = 20
    c.flags.push('lover_revisited', 'lover', 'sect_wudang', 'sect_leader')
    upsertRelation(c, { kind: '道侣', name: '苏晚晴', bond: 70 }, () => 0.5)
    const ev = EVENTS.find((e) => e.id === 'rel_lover_fate')!
    const suicide = ev.choices.find((ch) => ch.effects.death?.includes('情劫'))!
    const picks = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const ch = autoPickChoice(c, ev.choices, createRng(1000 + i))
      picks.add(ch.text)
    }
    expect(picks.has(suicide.text)).toBe(false)
    expect([...picks].some((t) => t.includes('执手') || t.includes('好聚'))).toBe(true)
  })

  it('战力远逊时不硬闯破境之劫，胜算充足时才敢闯', () => {
    const ev = EVENTS.find((e) => e.id === 'death_breakthrough')!
    const hard = ev.choices.find((ch) => ch.text.includes('硬闯'))!
    const foePower = hard.effects.combat!.foePower

    const weak = createBirth(311)
    weak.age = 45
    weak.attrs.福缘 = 50
    weak.force = 0
    weak.attrs.根骨 = 5
    weak.attrs.悟性 = 5
    expect(calcForce(weak)).toBeLessThan(foePower - 4)

    const weakPicks = new Set<string>()
    for (let i = 0; i < 60; i++) weakPicks.add(autoPickChoice(weak, ev.choices, createRng(500 + i)).text)
    expect(weakPicks.has(hard.text)).toBe(false)

    const strong = createBirth(312)
    strong.age = 45
    strong.attrs.福缘 = 60
    strong.force = 200
    expect(calcForce(strong)).toBeGreaterThan(foePower + 20)

    const strongPicks = new Set<string>()
    for (let i = 0; i < 60; i++) strongPicks.add(autoPickChoice(strong, ev.choices, createRng(500 + i)).text)
    expect(strongPicks.has(hard.text)).toBe(true)
  })

  it('同题存在致死选项时，不因扣血而放弃那条活路', () => {
    const ev = EVENTS.find((e) => e.id === 'death_court_edict')!
    const lethal = ev.choices.find((ch) => ch.effects.death)!
    const escape = ev.choices.find((ch) => !ch.effects.death)!

    const c = createBirth(313)
    c.age = 50
    c.attrs.心性 = -30 // 偏邪：会给「饮鸩遵旨」的狠厉标签加分
    c.attrs.体魄 = 16 // 低于出逃代价，旧逻辑会把活路压到死路之下
    c.flags.push('official', 'omen_court_done')

    let escapeN = 0
    for (let i = 0; i < 80; i++) {
      if (autoPickChoice(c, ev.choices, createRng(900 + i)).text === escape.text) escapeN += 1
    }
    expect(lethal.effects.death).toBeTruthy()
    expect(escapeN).toBeGreaterThan(40)
  })

  it('仇敌拍1获胜后不再排队仇敌终局', () => {
    const c = createBirth(91)
    c.age = 40
    c.flags.push('enemy_echo_done', 'enemy_last_done', 'enemy_closed')
    ensureRelationCallbacks(c)
    expect(c.eventQueue.some((q) => q.eventId === 'rel_enemy_last')).toBe(false)
  })

  it('无仇敌关系的寻仇死因会被改写', () => {
    const c = createBirth(92)
    c.age = 45
    c.flags = c.flags.filter((f) => f !== 'enemy_due')
    c.relations = []
    const rewritten = sanitizeDeathReason(c, '仇敌寻仇，命丧黄泉')
    expect(rewritten.includes('仇敌')).toBe(false)
  })

  it('背叛已了结后不再排队徒儿去路', () => {
    const c = createBirth(93)
    c.age = 55
    c.flags.push('disciple_return_done', 'betrayal_resolved', 'has_student')
    ensureRelationCallbacks(c)
    expect(c.eventQueue.some((q) => q.eventId === 'rel_disciple_fate')).toBe(false)
  })
})

describe('Sprint D title pace & epitaph', () => {
  it('blocks a third legendary title in one life', () => {
    const c = createBirth(21)
    applyEffects(c, { grantTitle: 'shendiaoyishi' }, 30, 'test')
    applyEffects(c, { grantTitle: 'tianxiaodi' }, 40, 'test')
    applyEffects(c, { grantTitle: 'tiandao' }, 55, 'test')
    expect(c.titles.filter((t) => TITLES.find((d) => d.id === t.id)?.rarity === '传说').length).toBe(2)
    expect(c.titles.some((t) => t.id === 'tiandao')).toBe(false)
  })

  it('allows exclusive-group upgrade inside the pace window', () => {
    const c = createBirth(22)
    applyEffects(c, { grantTitle: 'junzijian' }, 30, 'test')
    applyEffects(c, { grantTitle: 'jianxian' }, 33, 'test')
    expect(c.titles.some((t) => t.id === 'jianxian')).toBe(true)
    expect(c.titles.some((t) => t.id === 'junzijian')).toBe(false)
  })

  it('prefers office title as primary over same-rarity lore', () => {
    const c = createBirth(23)
    applyEffects(c, { grantTitle: 'yixian' }, 35, 'test')
    applyEffects(c, { grantTitle: 'zhangmen' }, 45, 'test')
    expect(c.primaryTitleId).toBe('zhangmen')
  })

  it('ending summary lists primary and folds title wall', () => {
    const c = createBirth(24)
    applyEffects(c, { grantTitle: 'shaonian' }, 18, 'test')
    applyEffects(c, { grantTitle: 'xiake' }, 28, 'test')
    applyEffects(c, { grantTitle: 'zhangmen' }, 40, 'test')
    applyEffects(c, { grantTitle: 'yinshi' }, 50, 'test')
    const sim = new LifeSimulator(c, 1, 'auto')
    sim.deathReason = '寿终正寝'
    const ending = buildEnding(sim)
    expect(ending.summary).toContain('人称「')
    expect(ending.summary).not.toMatch(/名号有：/)
    const listed = (ending.summary.match(/另有名号：([^。]+)/)?.[1] ?? '').split('、')
    expect(listed.length).toBeLessThanOrEqual(2)
  })
})

describe('Sprint E experience polish', () => {
  it('auto logs never use bare 「抉择」 title', () => {
    const c = createBirth(301)
    const sim = new LifeSimulator(c, 302, 'auto')
    sim.runUntilPause(200)
    expect(sim.logs.some((l) => l.title === '抉择')).toBe(false)
  })

  it('semi majorOnly pause count stays in a readable band', () => {
    const pauses: number[] = []
    const longLifePauses: number[] = []
    for (const seed of [401, 402, 403, 404, 405, 406, 407, 408]) {
      const c = createBirth(seed)
      const sim = new LifeSimulator(c, seed ^ 99, 'semi', true)
      let pause = 0
      for (let i = 0; i < 120; i++) {
        const r = sim.advanceYear()
        if (r.pendingChoice) {
          pause += 1
          const pick = r.pendingChoice.choices[0]
          sim.resolvePending(pick)
        }
        if (r.died) break
      }
      pauses.push(pause)
      // 早夭局暂停天然偏少，下限只约束活到壮年的样本
      if (sim.character.age >= 40) longLifePauses.push(pause)
    }
    const avg = pauses.reduce((a, b) => a + b, 0) / pauses.length
    expect(avg).toBeGreaterThanOrEqual(8)
    expect(avg).toBeLessThanOrEqual(20)
    expect(longLifePauses.length).toBeGreaterThanOrEqual(5)
    expect(Math.min(...longLifePauses)).toBeGreaterThanOrEqual(4)
  })
})

describe('Phase 6 leave / focus / identity', () => {
  it('mid left_sect becomes leave-pending instead of instant leave', () => {
    const c = createBirth(501)
    c.age = 26
    c.flags.push('sect_shaolin', 'sect_outer', 'shaolin_elite')
    applyEffects(c, { addFlags: ['left_sect', 'wanderer'], removeFlags: ['sect_shaolin', 'sect_outer'] }, 26, 'test')
    expect(c.flags).toContain('sect_leave_pending')
    expect(c.flags).toContain('sect_shaolin')
    expect(c.flags).not.toContain('left_sect')
    expect(c.eventQueue.some((q) => q.eventId === 'shaolin_finale')).toBe(true)
  })

  it('finale leave clears sect core flags', () => {
    const c = createBirth(502)
    c.age = 40
    c.flags.push('sect_shaolin', 'sect_outer', 'sect_leave_pending')
    applyEffects(
      c,
      {
        addFlags: ['left_sect', 'wanderer', 'sect_finale', 'shaolin_finale_done'],
        removeFlags: ['sect_outer', 'sect_shaolin'],
      },
      40,
      'test',
    )
    expect(c.flags).toContain('left_sect')
    expect(c.flags).not.toContain('sect_shaolin')
    expect(hasZombieSectFlags(c)).toBe(false)
  })

  it('blocks a second sect finale_done', () => {
    const c = createBirth(503)
    applyEffects(c, { addFlags: ['shaolin_finale_done', 'sect_finale'] }, 40, 'test')
    applyEffects(c, { addFlags: ['gaibang_finale_done'] }, 42, 'test')
    expect(countSectFinaleDone(c)).toBe(1)
    expect(c.flags).toContain('gaibang_finale_done')
    expect(c.flags).not.toContain('shaolin_finale_done')
  })

  it('left_sect after finale does not force mainline 门派 over 散修', () => {
    const c = createBirth(504)
    c.flags.push('shaolin_finale_done', 'sect_finale', 'left_sect', 'wanderer')
    expect(detectMainline(c)).not.toBe('门派')
  })

  it('refused_demon clears demon_loyal', () => {
    const c = createBirth(505)
    c.flags.push('demon_loyal', 'demon_sect')
    applyEffects(c, { addFlag: 'refused_demon' }, 30, 'test')
    expect(c.flags).toContain('refused_demon')
    expect(c.flags).not.toContain('demon_loyal')
    expect(c.flags).not.toContain('demon_sect')
  })
})
