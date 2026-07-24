import { MARTIAL_ARTS } from '../data/martialArts'
import { ORIGINS } from '../data/origins'
import { TITLES } from '../data/titles'
import { TRAITS } from '../data/traits'
import { EVENTS } from '../data/events'
import { matchSynergies } from '../data/synergies'
import { attrWeightFactor, traitWeightFactor } from '../lib/traitWeights'
import {
  ensureSectStoryQueue,
  ensureSectAftermath,
  enforceSectExclusivity,
  hasPendingAftermath,
  SECT_CORE_FLAGS,
  sectStoryWeightFactor,
} from '../lib/sectPath'
import {
  assignCivicIntentFromOrigin,
  ensureCivicStoryQueue,
  getCivicPath,
  hasMajorFaction,
} from '../lib/civicPath'
import {
  countSectFinaleDone,
  enforceSingleSectFinale,
  leaveSect,
  primaryChainFamily,
  requestSectLeave,
  shouldBlockSectFinaleEvent,
} from '../lib/leaveSect'
import {
  canGrantTitleByPace,
  pickSecondaryTitleNames,
  reconcilePrimaryTitle,
  shouldBecomePrimary,
} from '../lib/titlePace'
import type {
  AttrMods,
  Character,
  CharacterAttrs,
  ChoiceDef,
  EffectBundle,
  EndingReport,
  EventDef,
  LogEntry,
  LifeStage,
  OwnedMartial,
  PendingChoice,
  PlayMode,
  Rarity,
  TendencyTag,
} from '../types'
import {
  clamp,
  createRng,
  eventsPerYear,
  heartTier,
  lifeStage,
  pickWeighted,
  randInt,
  randomName,
  realmIndex,
  REALMS,
} from '../lib/utils'
import { resolveCombat, applyCombatBody } from '../lib/combat'
import { tickEnemyCountdowns, upsertRelation } from '../lib/relations'
import {
  canGrantTitle,
  endingMoralTags,
  titleAlignment,
  titlesToStripForGrant,
} from '../lib/alignment'
import {
  enrichEndingTags,
  flavorBodyDeath,
  flavorLifespanDeath,
  hasViolentDeathContext,
  primaryDeathTag,
  rewriteLateDeath,
  sanitizeDeathReason,
  trySparePrematureDeath,
} from '../lib/deathTags'
import { ensureRelationCallbacks } from '../lib/relationPath'
import { detectMainline } from '../lib/story'
import { pickPortraitLook } from '../lib/assetResolve'

const GRADE_MULT: Record<string, number> = {
  凡: 1,
  下乘: 1.2,
  中乘: 1.5,
  上乘: 1.9,
  绝学: 2.4,
  神功: 3,
}

export function getOrigin(id: string) {
  return ORIGINS.find((o) => o.id === id)!
}

export function getTrait(id: string) {
  return TRAITS.find((t) => t.id === id)!
}

export function getMartial(id: string) {
  return MARTIAL_ARTS.find((m) => m.id === id)!
}

export function getTitle(id: string) {
  return TITLES.find((t) => t.id === id)!
}

export function calcForce(c: Character): number {
  let force = c.force
  for (const m of c.martialArts) {
    const def = getMartial(m.id)
    if (!def) continue
    const mult = GRADE_MULT[def.grade] ?? 1
    force += Math.round(def.forceBonus * mult * (0.6 + m.level * 0.08))
  }
  force += Math.floor(c.attrs.根骨 / 5)
  force += realmIndex(c.realm) * 8
  return force
}

function applyAttrMods(c: Character, mods?: AttrMods) {
  if (!mods) return
  const keys: (keyof CharacterAttrs)[] = ['根骨', '悟性', '福缘', '魅力', '体魄', '心性', '机缘']
  for (const k of keys) {
    if (mods[k] != null) {
      if (k === '心性') {
        c.attrs[k] = clamp(c.attrs[k] + (mods[k] ?? 0), -100, 100)
      } else if (k === '体魄') {
        c.attrs[k] = clamp(c.attrs[k] + (mods[k] ?? 0), 0, 100)
      } else {
        c.attrs[k] = clamp(c.attrs[k] + (mods[k] ?? 0), 1, 100)
      }
    }
  }
  if (mods.财富 != null) c.wealth = Math.max(0, c.wealth + mods.财富)
  if (mods.武力 != null) c.force = Math.max(0, c.force + mods.武力)
  if (mods.正道声望 != null) c.fameGood = c.fameGood + mods.正道声望
  if (mods.邪道威名 != null) c.fameEvil = c.fameEvil + mods.邪道威名
  if (mods.寿命 != null) c.lifespan = clamp(c.lifespan + mods.寿命, c.age + 1, 160)
}

function addMartial(c: Character, id: string, age: number, source: string): { text: string; importance: number } | null {
  if (c.martialArts.some((m) => m.id === id)) {
    const owned = c.martialArts.find((m) => m.id === id)!
    owned.level = Math.min(10, owned.level + 1)
    return {
      text: `武学精进：${getMartial(id).name}升至第${owned.level}层`,
      importance: 2,
    }
  }
  const def = getMartial(id)
  if (!def) return null
  c.martialArts.push({ id, level: 1, source, learnedAt: age })
  const gradeImp =
    def.grade === '神功' ? 5 : def.grade === '绝学' ? 4 : def.grade === '上乘' ? 3 : 2
  const ritual =
    def.grade === '神功' || def.grade === '绝学'
      ? `江湖侧目——你悟得绝学「${def.name}」（${def.grade}·${def.type}）！`
      : `习得武学：${def.name}（${def.grade}·${def.type}）`
  return { text: ritual, importance: gradeImp }
}

function upgradeAnyMartial(c: Character): string | null {
  if (c.martialArts.length === 0) return null
  const m = c.martialArts.reduce((a, b) => (a.level <= b.level ? a : b))
  m.level = Math.min(10, m.level + 1)
  return `${getMartial(m.id).name}修炼至第${m.level}层`
}

function grantTitle(c: Character, id: string, age: number, source: string): string | null {
  if (c.titles.some((t) => t.id === id)) return null
  const def = getTitle(id)
  if (!def) return null
  if (!canGrantTitle(c, def, getTitle)) {
    return null
  }
  if (!canGrantTitleByPace(c, def, age, getTitle)) {
    return null
  }

  const stripped = titlesToStripForGrant(c, def, getTitle)
  let stripNote = ''
  if (stripped.length) {
    const names = stripped.map((tid) => getTitle(tid)?.name ?? tid)
    c.titles = c.titles.filter((t) => !stripped.includes(t.id))
    if (c.primaryTitleId && stripped.includes(c.primaryTitleId)) {
      c.primaryTitleId = null
    }
    stripNote = `旧日名号「${names.join('」「')}」随血债消散。`
  }

  if (def.exclusiveGroup) {
    c.titles = c.titles.filter((t) => getTitle(t.id)?.exclusiveGroup !== def.exclusiveGroup)
    if (c.primaryTitleId && getTitle(c.primaryTitleId)?.exclusiveGroup === def.exclusiveGroup) {
      c.primaryTitleId = null
    }
  }
  c.titles.push({ id, gainedAt: age, source })
  applyAttrMods(c, def.effects)
  if (shouldBecomePrimary(c, def, getTitle)) {
    c.primaryTitleId = id
  }
  const main = `江湖流传，人称——「${def.name}」`
  return stripNote ? `${stripNote}${main}` : main
}

export function applyEffects(
  c: Character,
  effects: EffectBundle,
  age: number,
  source: string,
  rng: () => number = Math.random,
): LogEntry[] {
  const logs: LogEntry[] = []
  const beforeTier = heartTier(c.attrs.心性)

  // 战斗检定优先：结果写入日志，再套用胜负分支效果
  if (effects.combat) {
    const result = resolveCombat(
      calcForce(c),
      c.attrs.福缘,
      effects.combat.foePower,
      rng,
      effects.combat.foeName ?? '对手',
    )
    applyCombatBody(c.attrs, result.bodyDelta)
    c.force = Math.max(0, c.force + result.forceDelta)
    logs.push({
      age,
      kind: 'system',
      title: `冲突·${result.outcome}`,
      text: result.text,
      importance: 4,
    })
    const branch = result.won
      ? effects.combat.onWin
      : result.drew
        ? effects.combat.onDraw ?? effects.combat.onLose
        : effects.combat.onLose
    if (branch) {
      logs.push(...applyEffects(c, branch, age, source, rng))
    }
  }

  applyAttrMods(c, effects.attrs)

  const toAdd = [
    ...(effects.addFlag ? [effects.addFlag] : []),
    ...(effects.addFlags ?? []),
  ]

  // 正邪烙印对称：拒魔与忠魔互斥
  if (toAdd.includes('refused_demon')) {
    c.flags = c.flags.filter((f) => f !== 'demon_loyal' && f !== 'demon_sect')
  }
  if (toAdd.includes('demon_loyal') || toAdd.includes('demon_sect')) {
    c.flags = c.flags.filter((f) => f !== 'refused_demon')
  }

  // 中段 left_sect → 离派协议；终章内 / 已无门籍 → 真正离派
  let convertingLeave = false
  if (toAdd.includes('left_sect')) {
    const hasFinaleInBundle = toAdd.some(
      (f) => f.endsWith('_finale_done') || f === 'sect_finale',
    )
    const alreadyFinale = countSectFinaleDone(c) > 0 || c.flags.includes('sect_finale')
    const inSect = SECT_CORE_FLAGS.some((f) => c.flags.includes(f)) || c.flags.includes('gaibang_member')
    if (inSect && !hasFinaleInBundle && !alreadyFinale && !c.flags.includes('left_sect')) {
      convertingLeave = true
      requestSectLeave(c, 1)
    } else if (inSect || c.flags.includes('sect_leave_pending')) {
      leaveSect(c)
    } else if (!c.flags.includes('left_sect')) {
      // 非门派语境（如误用）：仅打标，不假装清门
      c.flags.push('left_sect')
    }
  }

  const flagsToAdd = convertingLeave ? toAdd.filter((f) => f !== 'left_sect') : toAdd.filter((f) => f !== 'left_sect')
  for (const f of flagsToAdd) {
    if (!c.flags.includes(f)) c.flags.push(f)
  }
  if (flagsToAdd.length) enforceSectExclusivity(c, flagsToAdd)
  enforceSingleSectFinale(c, flagsToAdd)

  const toRemove = [
    ...(effects.removeFlag ? [effects.removeFlag] : []),
    ...(effects.removeFlags ?? []),
  ]
  // 离派协议中：禁止中段选项提前清掉本门核心旗
  const removeSafe = convertingLeave
    ? toRemove.filter(
        (f) =>
          !(SECT_CORE_FLAGS as readonly string[]).includes(f) &&
          f !== 'gaibang_member' &&
          f !== 'sect_outer',
      )
    : toRemove
  if (removeSafe.length) c.flags = c.flags.filter((f) => !removeSafe.includes(f))

  const queued = [
    ...(effects.queueEvent ? [effects.queueEvent] : []),
    ...(effects.queueEvents ?? []),
  ]
  for (const q of queued) {
    const dueAge = age + Math.max(1, q.delayYears ?? 2)
    if (!c.eventQueue.some((x) => x.eventId === q.id)) {
      c.eventQueue.push({ eventId: q.id, dueAge })
    }
  }

  if (effects.setRelation) {
    const msg = upsertRelation(c, effects.setRelation, rng)
    if (msg) {
      logs.push({ age, kind: 'system', title: '人事', text: msg, importance: 3 })
    }
  }

  if (effects.setRealm) {
    const cur = realmIndex(c.realm)
    const next = realmIndex(effects.setRealm)
    if (next > cur) {
      c.realm = effects.setRealm
      logs.push({
        age,
        kind: 'system',
        title: '境界突破',
        text: `修为臻至【${effects.setRealm}】！`,
        importance: 4,
      })
    }
  }
  if (effects.demoteRealm) {
    c.realm = effects.demoteRealm
    logs.push({
      age,
      kind: 'system',
      title: '修为变动',
      text: `修为落至【${effects.demoteRealm}】。`,
      importance: 3,
    })
  }

  if (effects.addMartialArt) {
    const msg = addMartial(c, effects.addMartialArt, age, source)
    if (msg) logs.push({ age, kind: 'martial', title: '武学', text: msg.text, importance: msg.importance })
  }
  if (effects.upgradeMartialArt) {
    const msg = upgradeAnyMartial(c)
    if (msg) logs.push({ age, kind: 'martial', title: '修炼', text: msg, importance: 1 })
  }
  if (effects.grantTitle) {
    const msg = grantTitle(c, effects.grantTitle, age, source)
    const def = getTitle(effects.grantTitle)
    const imp = def && (def.rarity === '传说' || def.rarity === '史诗') ? 5 : 4
    if (msg) logs.push({ age, kind: 'title', title: '名号', text: msg, importance: imp })
  }
  if (effects.setPrimaryTitle && c.titles.some((t) => t.id === effects.setPrimaryTitle)) {
    c.primaryTitleId = effects.setPrimaryTitle
  }
  if (effects.logExtra) {
    logs.push({ age, kind: 'system', title: '余波', text: effects.logExtra, importance: 2 })
  }

  if (effects.death) {
    // 同帧自证旗先剥离再校验，避免 death_court/sect_martyr 等让 sanitize 失效
    const selfProof = new Set([
      'death_court',
      'sect_martyr',
      'death_qingjie',
      'death_poison',
      'qi_deviation',
      'sect_martyr_done',
      'death_court_done',
    ])
    const stripped = toAdd.filter((f) => selfProof.has(f))
    if (stripped.length) c.flags = c.flags.filter((f) => !stripped.includes(f))

    const raw = effects.death
    if (trySparePrematureDeath(c, raw)) {
      logs.push({
        age,
        kind: 'system',
        title: '命悬一线',
        text: `你本将「${raw}」，却被人从鬼门关拖了回来。余生，或许要换一种死法。`,
        importance: 5,
      })
      for (const f of stripped) {
        if (!c.flags.includes(f)) c.flags.push(f)
      }
    } else {
      const rewritten = rewriteLateDeath(c, raw)
      for (const f of stripped) {
        if (!c.flags.includes(f)) c.flags.push(f)
      }
      logs.push({
        age,
        kind: 'death',
        title: '陨落',
        text: rewritten,
        importance: 5,
      })
    }
  }

  if (toAdd.includes('saved_plague')) {
    const msg = grantTitle(c, 'jiushi', age, source)
    if (msg) logs.push({ age, kind: 'title', title: '名号', text: msg, importance: 4 })
  }

  const afterTier = heartTier(c.attrs.心性)
  if (beforeTier !== afterTier) {
    logs.push({
      age,
      kind: 'system',
      title: '心性变化',
      text: `心性：${beforeTier} → ${afterTier}（${c.attrs.心性}）`,
      importance: 3,
    })
  }

  c.force = Math.max(c.force, 0)
  return logs
}

function passChoiceReq(c: Character, choice: ChoiceDef): boolean {
  const r = choice.requirements
  if (!r) {
    // 无显式要求时，仍拦截「当前身份无法获得」的称号抉择，避免全自动点了却落空
    return choiceGrantAllowed(c, choice, c.age)
  }
  if (r.minHeart != null && c.attrs.心性 < r.minHeart) return false
  if (r.maxHeart != null && c.attrs.心性 > r.maxHeart) return false
  if (r.heartTiers && !r.heartTiers.includes(heartTier(c.attrs.心性))) return false
  if (r.flags && !r.flags.every((f) => c.flags.includes(f))) return false
  if (r.anyFlags && !r.anyFlags.some((f) => c.flags.includes(f))) return false
  if (r.minRealmIndex != null && realmIndex(c.realm) < r.minRealmIndex) return false
  return choiceGrantAllowed(c, choice, c.age)
}

function choiceGrantAllowed(c: Character, choice: ChoiceDef, age?: number): boolean {
  const ids = collectGrantTitleIds(choice.effects)
  for (const id of ids) {
    const def = getTitle(id)
    if (!def) continue
    if (!canGrantTitle(c, def, getTitle)) return false
    if (age != null && !canGrantTitleByPace(c, def, age, getTitle)) return false
  }
  return true
}

function collectGrantTitleIds(effects: EffectBundle): string[] {
  const ids: string[] = []
  if (effects.grantTitle) ids.push(effects.grantTitle)
  if (effects.combat) {
    for (const branch of [effects.combat.onWin, effects.combat.onLose, effects.combat.onDraw]) {
      if (branch?.grantTitle) ids.push(branch.grantTitle)
    }
  }
  return ids
}

/** 半自动「仅重大」：默认只停 importance≥5；带战斗/生死的 4 级也停 */
function hasHardFateHook(fx: EffectBundle | undefined): boolean {
  if (!fx) return false
  return !!(fx.combat || fx.death)
}

function isMajorOnlyPause(ev: EventDef, choices: ChoiceDef[]): boolean {
  if (ev.importance >= 5) return true
  if (ev.importance < 4) return false
  return choices.some((ch) => hasHardFateHook(ch.effects))
}

function eventMatches(c: Character, e: EventDef, usedOnce: Set<string>): boolean {
  if (e.once && usedOnce.has(e.id)) return false
  const stage = lifeStage(c.age)
  if (!e.stages.includes(stage)) return false
  if (e.minAge != null && c.age < e.minAge) return false
  if (e.maxAge != null && c.age > e.maxAge) return false
  const cond = e.conditions
  if (!cond) return true
  if (cond.origins && !cond.origins.includes(c.originId)) return false
  if (cond.traits && !cond.traits.some((t) => c.traitIds.includes(t))) return false
  if (cond.flags && !cond.flags.every((f) => c.flags.includes(f))) return false
  if (cond.anyFlags && !cond.anyFlags.some((f) => c.flags.includes(f))) return false
  if (cond.forbidFlags && cond.forbidFlags.some((f) => c.flags.includes(f))) return false
  if (cond.heartTiers && !cond.heartTiers.includes(heartTier(c.attrs.心性))) return false
  if (cond.minHeart != null && c.attrs.心性 < cond.minHeart) return false
  if (cond.maxHeart != null && c.attrs.心性 > cond.maxHeart) return false
  if (cond.minRealmIndex != null && realmIndex(c.realm) < cond.minRealmIndex) return false
  if (cond.maxRealmIndex != null && realmIndex(c.realm) > cond.maxRealmIndex) return false
  if (cond.hasMartial && !cond.hasMartial.some((id) => c.martialArts.some((m) => m.id === id))) return false
  if (cond.hasTitle && !cond.hasTitle.some((id) => c.titles.some((t) => t.id === id))) return false
  if (cond.forbidTitles && cond.forbidTitles.some((id) => c.titles.some((t) => t.id === id))) return false
  if (cond.forbidTitleAlignments?.includes('正') && c.titles.some((t) => titleAlignment(getTitle(t.id)) === '正')) {
    return false
  }
  if (cond.forbidTitleAlignments?.includes('邪') && c.titles.some((t) => titleAlignment(getTitle(t.id)) === '邪')) {
    return false
  }
  if (cond.minForce != null && calcForce(c) < cond.minForce) return false
  if (e.id === 'gen_female_hero' && c.gender !== '女') return false
  if (e.id === 'trait_nvxia_banner' && c.gender !== '女') return false
  return true
}

const STAGE_ORDER: LifeStage[] = ['幼年', '少年', '青年', '壮年', '晚年']

/**
 * 队列到期但暂不匹配时：若仍可能在未来匹配则保留，避免 stage/minAge/缺 flag 导致「排了却播不出」。
 * 永久不可能（错出身/无词条/超 maxAge/once 已用/人生阶段已过完）则丢弃。
 */
function eventQueueRetryable(c: Character, e: EventDef, usedOnce: Set<string>): boolean {
  if (e.once && usedOnce.has(e.id)) return false
  if (e.maxAge != null && c.age > e.maxAge) return false
  const cond = e.conditions
  if (cond?.origins && !cond.origins.includes(c.originId)) return false
  if (cond?.traits && !cond.traits.some((t) => c.traitIds.includes(t))) return false
  if (e.id === 'gen_female_hero' && c.gender !== '女') return false
  if (e.id === 'trait_nvxia_banner' && c.gender !== '女') return false

  const curIdx = STAGE_ORDER.indexOf(lifeStage(c.age))
  const maxStageIdx = Math.max(...e.stages.map((s) => STAGE_ORDER.indexOf(s)))
  if (curIdx > maxStageIdx) return false

  // 永久禁旗：已踩上则这辈子别再等
  const permanentForbid = [
    'massacre',
    'demon_lord',
    'bandit_blood',
    'huashan_finale_done',
    'wudang_finale_done',
    'shaolin_finale_done',
    'emei_finale_done',
    'gaibang_finale_done',
    'love_finale',
  ]
  if (cond?.forbidFlags?.some((f) => permanentForbid.includes(f) && c.flags.includes(f))) {
    return false
  }

  // 到期过久仍匹配不上，放弃（防队列无限堆积）
  // dueAge 信息不在此函数；由调用方用 dueAge 判断
  return true
}

/** 活跃剧情旗，用于提高相关链事件权重 */
const STORY_FLAGS = new Set([
  'sect_outer', 'small_sect', 'wanderer', 'has_master', 'has_wuguan',
  'bandit_camp', 'survivor', 'sect_enemy', 'endurance', 'stole_book',
  'lover', 'saved_lover', 'lover_safe', 'lost_lover',
  'demon_sect', 'refused_demon', 'spy', 'helped_people', 'robber',
  'escort', 'arena_win', 'cliff_sword', 'has_student', 'sworn',
  'sect_leader', 'alliance_leader', 'massacre', 'army', 'official',
  'path_chosen',
])

/** 主线族：锁定主族后强压他族随机权重；队列亦受限 */
const CHAIN_FAMILIES: { id: string; flags: string[]; chains: string[] }[] = [
  {
    id: 'sect',
    flags: [
      'sect_outer',
      'sect_huashan',
      'sect_wudang',
      'sect_shaolin',
      'sect_emei',
      'sect_gaibang',
      'gaibang_member',
      'sect_leader',
      'small_sect',
      'sect_finale',
    ],
    chains: ['sect'],
  },
  {
    id: 'demon',
    flags: ['demon_sect', 'demon_loyal', 'demon_lord', 'mozhong_path', 'spy', 'demon_finale'],
    chains: ['demon'],
  },
  {
    id: 'bandit',
    flags: ['became_bandit', 'bandit_camp', 'massacre', 'bandit_blood', 'bandit_vengeance', 'bandit_finale'],
    chains: ['bandit'],
  },
  {
    id: 'love',
    flags: ['lover', 'married', 'lost_lover', 'love_finale', 'saved_lover'],
    chains: ['love'],
  },
  {
    id: 'justice',
    flags: ['helped_people', 'alliance_leader', 'pomo_path', 'war_hero', 'justice_finale'],
    chains: ['justice'],
  },
  {
    id: 'civic',
    flags: [
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
    ],
    chains: ['civic'],
  },
]

function activeChainFamilies(c: Character): string[] {
  return CHAIN_FAMILIES.filter((f) => f.flags.some((flag) => c.flags.includes(flag))).map((f) => f.id)
}

function eventChainFamily(e: EventDef): string | null {
  if (!e.chain) return null
  const hit = CHAIN_FAMILIES.find((f) => f.chains.includes(e.chain!))
  return hit?.id ?? null
}

/** 队列：非主族终章级事件可延后（保留），他门终章直接丢 */
function queueEventAllowed(c: Character, e: EventDef): boolean {
  if (shouldBlockSectFinaleEvent(c, e)) return false
  // 凡尘全生涯归宿：未入名门时必须能播，不被情缘/正道软锁挡住
  if (e.chain === 'civic' && !hasMajorFaction(c)) return true
  const primary = primaryChainFamily(c)
  if (!primary) return true
  const fam = eventChainFamily(e)
  if (!fam || fam === primary) return true
  // 他族终章/结局类延后消化：importance>=5 且非本族则暂不准入（留在队列）
  if (e.importance >= 5 && e.tags.includes('结局')) return false
  return true
}

export function eventWeight(c: Character, e: EventDef): number {
  if (shouldBlockSectFinaleEvent(c, e)) return 0
  let w = e.weight
  const luck = c.attrs.福缘
  if (e.tags.includes('好事') || e.tags.includes('奇遇')) w *= 0.7 + luck / 100
  if (e.tags.includes('坏事') || e.tags.includes('灾祸')) w *= 1.3 - luck / 120
  w *= attrWeightFactor(c, e)
  w *= traitWeightFactor(c, e)
  w *= sectStoryWeightFactor(c, e)
  const tier = heartTier(c.attrs.心性)
  if (e.tags.includes('正道') || e.tags.includes('侠义')) {
    if (tier === '至善' || tier === '偏正') w *= 1.4
    if (tier === '极恶' || tier === '偏邪') w *= 0.5
  }
  if (e.tags.includes('邪道') || e.tags.includes('魔教')) {
    if (tier === '极恶' || tier === '偏邪') w *= 1.4
    if (tier === '至善' || tier === '偏正') w *= 0.5
  }
  if (e.conditions?.anyFlags || e.conditions?.flags) {
    w *= 2.2
  }
  if (e.conditions?.traits) {
    w *= 2.6
  }
  if (e.chain) {
    const activeStory = c.flags.some((f) => STORY_FLAGS.has(f))
    if (activeStory) w *= 1.5
  }

  const primary = primaryChainFamily(c)
  const active = activeChainFamilies(c)
  const fam = eventChainFamily(e)
  if (primary && fam) {
    if (fam === primary) w *= 1.6
    else w *= 0.22
  } else if (active.length > 0 && e.chain) {
    const belongs = active.some((id) => {
      const f = CHAIN_FAMILIES.find((x) => x.id === id)
      return f?.chains.includes(e.chain!)
    })
    if (belongs) w *= 1.35
    else w *= 0.4
  }
  if (active.length >= 2 && !e.chain && e.importance <= 2 && !e.conditions?.flags && !e.conditions?.anyFlags) {
    w *= 0.35
  }

  if (e.chain === 'civic') {
    if (hasMajorFaction(c)) w *= 0
    else if (getCivicPath(c)) w *= 1.85
  }

  if (c.yearsWithoutMajor >= 5 && e.importance >= 4) w *= 1.8
  if (c.yearsWithoutMajor >= 8 && e.importance >= 3) w *= 1.4
  return w
}

export function autoPickChoice(c: Character, choices: ChoiceDef[], rng: () => number): ChoiceDef {
  const available = choices.filter((ch) => passChoiceReq(c, ch))
  const pool =
    available.length > 0
      ? available
      : (() => {
          const noTitle = choices.filter((ch) => collectGrantTitleIds(ch.effects).length === 0)
          return noTitle.length ? noTitle : choices
        })()
  const tier = heartTier(c.attrs.心性)
  const inSect =
    !c.flags.includes('left_sect') &&
    (SECT_CORE_FLAGS.some((f) => c.flags.includes(f)) || c.flags.includes('gaibang_member'))
  const demonAligned =
    c.flags.includes('demon_loyal') ||
    c.flags.includes('demon_sect') ||
    c.flags.includes('huashan_radical') ||
    c.flags.includes('mozhong_path')
  const refusedDemon = c.flags.includes('refused_demon') || c.flags.includes('pomo_path')

  const score = (ch: ChoiceDef): number => {
    let s = 1
    const tags = ch.tendencyTags ?? []
    const prefer = (t: TendencyTag, n: number) => {
      if (tags.includes(t)) s += n
    }
    if (tier === '至善' || tier === '偏正') prefer('侠义', 5)
    if (tier === '极恶' || tier === '偏邪') prefer('狠厉', 5)
    if (c.attrs.福缘 >= 60) prefer('冒险', 3)
    if (c.attrs.福缘 <= 35) prefer('谨慎', 3)
    if (c.attrs.根骨 >= 60 || c.attrs.悟性 >= 60) prefer('修炼', 3)
    if (c.attrs.魅力 >= 60) prefer('交际', 3)
    if (c.attrs.心性 <= -20) prefer('贪婪', 2)
    if (c.traitIds.includes('tanlan') || c.traitIds.includes('fushen') || c.traitIds.includes('qiongxiang'))
      prefer('贪婪', 4)
    if (
      c.traitIds.includes('renxin') ||
      c.traitIds.includes('haoxia') ||
      c.traitIds.includes('nvxia') ||
      c.traitIds.includes('foyuan') ||
      c.traitIds.includes('wenrou')
    )
      prefer('侠义', 4)
    if (
      c.traitIds.includes('mozhong') ||
      c.traitIds.includes('lengxue') ||
      c.traitIds.includes('kuangdao') ||
      c.traitIds.includes('yeguai')
    )
      prefer('狠厉', 4)
    if (
      c.traitIds.includes('meiyun') ||
      c.traitIds.includes('bingruo') ||
      c.traitIds.includes('jueqing') ||
      c.traitIds.includes('qiongxiang')
    )
      prefer('谨慎', 3)
    if (
      c.traitIds.includes('fuxing') ||
      c.traitIds.includes('yinshi') ||
      c.traitIds.includes('yinyang') ||
      c.traitIds.includes('tianjiao') ||
      c.traitIds.includes('zhanshen') ||
      c.traitIds.includes('shuangtong')
    )
      prefer('冒险', 3)
    if (
      c.traitIds.includes('guomu') ||
      c.traitIds.includes('jiangu') ||
      c.traitIds.includes('daogu') ||
      c.traitIds.includes('jingxin') ||
      c.traitIds.includes('daoyuan') ||
      c.traitIds.includes('lingxi') ||
      c.traitIds.includes('tianjiao') ||
      c.traitIds.includes('jueqing') ||
      c.traitIds.includes('canfei')
    )
      prefer('修炼', 4)
    if (
      c.traitIds.includes('hongyan') ||
      c.traitIds.includes('wenrou') ||
      c.traitIds.includes('yinyuan') ||
      c.traitIds.includes('shanggu') ||
      c.traitIds.includes('chaoting')
    )
      prefer('交际', 4)
    if (c.attrs.机缘 >= 65) prefer('冒险', 2)
    if (c.attrs.魅力 >= 70) prefer('交际', 2)

    // —— 身份弧偏好 ——
    const fx = ch.effects
    const adds = [...(fx.addFlag ? [fx.addFlag] : []), ...(fx.addFlags ?? [])]
    const text = ch.text
    const leaving =
      adds.includes('left_sect') ||
      adds.includes('sect_leave_pending') ||
      /离派|下山|还俗|远走|出走|叛逃|另立/.test(text)
    const staying =
      adds.includes('sect_loyal') ||
      adds.includes('sect_leader') ||
      adds.some((f) => f.endsWith('_finale_done')) ||
      /守|授徒|掌门|光大|护山|开寺|开坛|接掌/.test(text)
    const goingDemon =
      adds.includes('demon_loyal') ||
      adds.includes('demon_sect') ||
      adds.includes('demon_lord') ||
      /入魔|投魔|魔教/.test(text)

    if (inSect && staying) s += 4
    if (inSect && leaving && !c.flags.includes('sect_leave_pending')) s -= 3
    if (demonAligned && goingDemon) s += 4
    if (!demonAligned && goingDemon) s -= 4
    if (refusedDemon && goingDemon) s -= 6
    if (c.flags.includes('sect_leave_pending') && staying) s += 2

    // 自尽/横死抉择：按死因分型校验，避免「有仇却去饮鸩」或无铺垫自尽
    if (fx.death) {
      const d = fx.death
      const loveSuicide = /情劫|自绝/.test(d)
      const courtDeath = /赐死/.test(d)
      const poisonDeath = /毒/.test(d)
      const betrayDeath = /背叛/.test(d)
      const enemyDeath = /仇敌/.test(d)
      const martyrDeath = /殉道/.test(d)
      const peacefulDeath = /坐化|寿终|无疾/.test(d)

      if (loveSuicide) {
        const ok = c.flags.includes('lost_lover') && c.attrs.心性 <= -10 && !c.flags.includes('love_closed')
        s += ok ? -2 : -12
      } else if (courtDeath) {
        const ok = c.flags.includes('official') || c.flags.includes('fugitive')
        s += ok ? -3 : -12
      } else if (poisonDeath) {
        const ok =
          c.flags.includes('poisoned') ||
          c.flags.includes('emei_poison_kept') ||
          c.flags.includes('duyi_path')
        s += ok ? -3 : -10
      } else if (betrayDeath) {
        s += c.flags.includes('hunted_student') ? -2 : -12
      } else if (enemyDeath) {
        s += c.relations.some((r) => r.kind === '仇敌') || c.flags.includes('enemy_due') ? -2 : -12
      } else if (martyrDeath) {
        s += inSect && !c.flags.includes('sect_leave_pending') ? -4 : -12
      } else if (peacefulDeath && c.age >= 70) {
        s += 0
      } else {
        s -= 8
      }
    }

    return s + rng() * 0.3
  }

  return pickWeighted(pool, score, rng) ?? pool[0]
}

export interface SimYearResult {
  logs: LogEntry[]
  pendingChoice: PendingChoice | null
  died: boolean
  deathReason?: string
}

export class LifeSimulator {
  character: Character
  logs: LogEntry[] = []
  usedOnce = new Set<string>()
  rng: () => number
  mode: PlayMode
  majorOnly: boolean
  ended = false
  deathReason = ''
  /** 队列过期未竟之事（结算用） */
  unfinishedQuests: string[] = []

  constructor(character: Character, seed: number, mode: PlayMode, majorOnly = false) {
    this.character = character
    this.rng = createRng(seed)
    this.mode = mode
    this.majorOnly = majorOnly
  }

  private noteUnfinishedQuest(name: string) {
    if (!this.unfinishedQuests.includes(name)) {
      this.unfinishedQuests.push(name)
      this.push({
        age: this.character.age,
        kind: 'summary',
        title: '未竟之事',
        text: `机缘「${name}」终未兑现，成了这一生的遗憾。`,
        importance: 2,
      })
    }
  }

  private push(...entries: LogEntry[]) {
    this.logs.push(...entries)
  }

  private yearlyDecay() {
    const c = this.character
    const age = c.age
    // 晚年允许体魄掉到 0，打开寿终/病榻通路
    const floor = age >= 62 ? 0 : 1
    if (age >= 50) c.attrs.体魄 = clamp(c.attrs.体魄 - 1, floor, 100)
    if (age >= 65) c.attrs.体魄 = clamp(c.attrs.体魄 - 1, floor, 100)
    if (age >= 75) c.attrs.体魄 = clamp(c.attrs.体魄 - 2, floor, 100)
    if (age >= 90) c.attrs.体魄 = clamp(c.attrs.体魄 - 2, floor, 100)
    // 高境界延寿
    if (realmIndex(c.realm) >= 4 && age % 5 === 0) {
      c.lifespan = Math.min(160, c.lifespan + 1)
    }
    // 壮年前自然恢复；晚年不再回血，否则永摸不到寿终
    if (age < 52 && c.attrs.体魄 < 40) {
      c.attrs.体魄 = clamp(c.attrs.体魄 + 1, 1, 100)
    }
  }

  private checkDeath(): string | null {
    const c = this.character
    if (c.age >= c.lifespan) return flavorLifespanDeath(c)
    if (c.attrs.体魄 <= 0) {
      // 近寿元且无横死语境 → 走寿终通路（抬升 15%～45% 目标）
      const nearLifespan = c.age >= Math.floor(c.lifespan * 0.78)
      if (nearLifespan && !hasViolentDeathContext(c)) {
        return flavorLifespanDeath(c)
      }
      if (c.traitIds.includes('yixian') && this.rng() < 0.35) {
        c.attrs.体魄 = 15
        this.push({
          age: c.age,
          kind: 'system',
          title: '医仙庇护',
          text: '你凭医术天赋从鬼门关挣回一条命。',
          importance: 5,
        })
        return null
      }
      if (c.traitIds.includes('zhanshen') && this.rng() < 0.3) {
        c.attrs.体魄 = 10
        this.push({
          age: c.age,
          kind: 'system',
          title: '战神血脉',
          text: '你在濒死之际爆发出惊人意志，活了下来。',
          importance: 5,
        })
        return null
      }
      // 青年首次体魄归零：重伤保命一次，避免空洞早死局
      if (c.age < 32 && !c.flags.includes('youth_near_death')) {
        c.attrs.体魄 = 12
        c.flags.push('youth_near_death')
        this.push({
          age: c.age,
          kind: 'system',
          title: '死里逃生',
          text: '你伤重垂危，却被人救下一命。江湖路还长，这口气绝不能断在此处。',
          importance: 5,
        })
        if (!c.eventQueue.some((q) => q.eventId === 'youth_learn_medicine')) {
          c.eventQueue.push({ eventId: 'youth_learn_medicine', dueAge: c.age + 1 })
        }
        return null
      }
      // 第二次体魄归零也尽量拖过终章年龄
      if (c.age < 30 && c.flags.includes('youth_near_death') && !c.flags.includes('youth_near_death_2')) {
        c.attrs.体魄 = 8
        c.flags.push('youth_near_death_2')
        this.push({
          age: c.age,
          kind: 'system',
          title: '再度挣扎',
          text: '你再次从鬼门关爬回。命是捡来的，故事却不能停在半路。',
          importance: 4,
        })
        return null
      }
      // 壮年无横死语境再保一次，把人命推向晚年/寿终区间
      if (
        c.age < Math.min(c.lifespan - 8, 58) &&
        !hasViolentDeathContext(c) &&
        !c.flags.includes('midlife_near_death')
      ) {
        c.attrs.体魄 = 10
        c.flags.push('midlife_near_death')
        this.push({
          age: c.age,
          kind: 'system',
          title: '大难未死',
          text: '你伤重卧床数月，竟又熬了过来。余生或许不长，故事却还没写到终章。',
          importance: 4,
        })
        return null
      }
      // 在籍且终章未收束：再保一次，让门派弧线有机会落幕
      if (
        c.age < 32 &&
        !c.flags.includes('left_sect') &&
        !c.flags.includes('sect_story_near_death') &&
        SECT_CORE_FLAGS.some((f) => c.flags.includes(f)) &&
        !c.flags.some((f) => f.endsWith('_finale_done'))
      ) {
        c.attrs.体魄 = 10
        c.flags.push('sect_story_near_death')
        this.push({
          age: c.age,
          kind: 'system',
          title: '山门未了',
          text: '你伤重之际，同门拼死护你回山。山门的故事还没到终章，你不能就此倒下。',
          importance: 4,
        })
        return null
      }
      // 凡尘弧未归宿：软延一次，保证能播到晚年拍
      {
        const civic = getCivicPath(c)
        if (
          civic &&
          !hasMajorFaction(c) &&
          !c.flags.includes(`civic_${civic}_finale`) &&
          !c.flags.includes('civic_story_near_death') &&
          c.age < Math.min(c.lifespan - 5, 56)
        ) {
          c.attrs.体魄 = 10
          c.flags.push('civic_story_near_death')
          this.push({
            age: c.age,
            kind: 'system',
            title: '凡尘未了',
            text: '你伤重卧床，却仍记挂着未完的生计与归宿。这条凡人传，还不能停在半页。',
            importance: 4,
          })
          return null
        }
      }
      // 终章已落、余波未尽：软延死一次，避免「终章当日暴毙」
      if (hasPendingAftermath(c) && !c.flags.includes('aftermath_near_death')) {
        c.attrs.体魄 = 10
        c.flags.push('aftermath_near_death')
        this.push({
          age: c.age,
          kind: 'system',
          title: '余韵未尽',
          text: '江湖上还有人等你把话说完。你拼着一口气，把后事往后再拖了拖。',
          importance: 4,
        })
        return null
      }
      // 过早横死（含战死标签）：再免一次，推向寿终区间
      {
        const tentative = flavorBodyDeath(c)
        if (trySparePrematureDeath(c, tentative)) {
          this.push({
            age: c.age,
            kind: 'system',
            title: '命悬一线',
            text: `你几乎要「${tentative}」，却又撑了过来。`,
            importance: 5,
          })
          return null
        }
      }
      return rewriteLateDeath(c, flavorBodyDeath(c))
    }
    return null
  }

  /** 推进一岁；若半自动遇抉择则暂停 */
  advanceYear(): SimYearResult {
    if (this.ended) {
      return { logs: [], pendingChoice: null, died: true, deathReason: this.deathReason }
    }

    const c = this.character
    const yearLogs: LogEntry[] = []
    const pushYear = (...entries: LogEntry[]) => {
      yearLogs.push(...entries)
      this.push(...entries)
    }

    c.age += 1
    this.yearlyDecay()
    ensureSectStoryQueue(c)
    ensureSectAftermath(c)
    ensureCivicStoryQueue(c)
    ensureRelationCallbacks(c)

    // 仇敌倒计时：到期则强制排队寻仇事件
    for (const eid of tickEnemyCountdowns(c)) {
      if (!c.eventQueue.some((q) => q.eventId === eid)) {
        c.eventQueue.push({ eventId: eid, dueAge: c.age })
      }
    }

    const stage = lifeStage(c.age)
    // 全自动幼年摘要（仍允许队列事件打断）
    const dueQueued = c.eventQueue.filter((q) => q.dueAge <= c.age)
    const skipRandomChildhood =
      this.mode === 'auto' &&
      stage === '幼年' &&
      c.age > 1 &&
      c.age < 7 &&
      this.rng() < 0.85 &&
      dueQueued.length === 0

    if (skipRandomChildhood) {
      // 仍写入一行摘要，避免 UI 误以为未推进
      pushYear({
        age: c.age,
        kind: 'summary',
        title: c.age === 6 ? '幼年往事' : '岁月流逝',
        text:
          c.age === 6
            ? '幼年岁月平淡流过，你渐渐长大，江湖尚远。'
            : `${c.age}岁，平淡一年。`,
        importance: 1,
      })
    } else {
      const count = eventsPerYear(stage, this.rng)
      const pickedIds = new Set<string>()
      let hadMajor = false
      const toPlay: EventDef[] = []

      // 1) 优先消化到期的剧情后续（stage/minAge/缺旗暂不匹配则保留，勿静默丢弃）
      c.eventQueue = c.eventQueue.filter((q) => {
        if (q.dueAge > c.age) return true
        const ev = EVENTS.find((e) => e.id === q.eventId)
        if (!ev) return false
        if (shouldBlockSectFinaleEvent(c, ev)) return false
        if (!queueEventAllowed(c, ev)) {
          // 他族结局：再等几年，过久则丢
          if (c.age - q.dueAge >= 12) {
            this.noteUnfinishedQuest(ev.name || ev.id)
            return false
          }
          return true
        }
        if (pickedIds.has(ev.id)) return true
        if (eventMatches(c, ev, this.usedOnce)) {
          toPlay.push(ev)
          pickedIds.add(ev.id)
          return false
        }
        // 过期太久仍播不出 → 丢弃并记未竟
        if (c.age - q.dueAge >= 25) {
          this.noteUnfinishedQuest(ev.name || ev.id)
          return false
        }
        return eventQueueRetryable(c, ev, this.usedOnce)
      })

      // 2) 其余名额随机（链式事件权重更高）
      while (toPlay.length < count) {
        const candidates = EVENTS.filter(
          (e) => eventMatches(c, e, this.usedOnce) && !pickedIds.has(e.id),
        )
        const ev = pickWeighted(candidates, (e) => eventWeight(c, e), this.rng)
        if (!ev) break
        toPlay.push(ev)
        pickedIds.add(ev.id)
      }

      for (const ev of toPlay) {
        if (ev.once) this.usedOnce.add(ev.id)
        if (ev.importance >= 4) hadMajor = true

        const choices = ev.choices.filter((ch) => passChoiceReq(c, ch))
        const usable =
          choices.length > 0
            ? choices
            : ev.choices.filter((ch) => collectGrantTitleIds(ch.effects).length === 0)
        const finalChoices = usable.length ? usable : ev.choices

        const shouldPause =
          this.mode === 'semi' &&
          ev.needsChoice &&
          finalChoices.length > 1 &&
          (!this.majorOnly || isMajorOnlyPause(ev, finalChoices))

        if (shouldPause) {
          pushYear({
            age: c.age,
            kind: 'event',
            title: ev.name,
            text: ev.text,
            importance: ev.importance,
            eventId: ev.id,
          })
          this.pendingEvent = ev
          return {
            logs: yearLogs,
            pendingChoice: { event: ev, choices: finalChoices },
            died: false,
          }
        }

        const choice =
          ev.needsChoice && finalChoices.length > 1
            ? autoPickChoice(c, finalChoices, this.rng)
            : finalChoices[0]

        this.resolveEvent(ev, choice, pushYear)

        const deathMsg =
          [...yearLogs].reverse().find((l) => l.kind === 'death')?.text ?? choice.effects.death
        if (deathMsg) {
          this.ended = true
          this.deathReason = sanitizeDeathReason(c, deathMsg)
          if (!yearLogs.some((l) => l.kind === 'death')) {
            pushYear({
              age: c.age,
              kind: 'death',
              title: '陨落',
              text: this.deathReason,
              importance: 5,
            })
          }
          return { logs: yearLogs, pendingChoice: null, died: true, deathReason: this.deathReason }
        }
      }

      if (hadMajor) c.yearsWithoutMajor = 0
      else c.yearsWithoutMajor += 1
    }

    const death = this.checkDeath()
    if (death) {
      this.ended = true
      this.deathReason = death
      pushYear({
        age: c.age,
        kind: 'death',
        title: '陨落',
        text: death,
        importance: 5,
      })
      return { logs: yearLogs, pendingChoice: null, died: true, deathReason: death }
    }

    return { logs: yearLogs, pendingChoice: null, died: false }
  }

  private pendingEvent: EventDef | null = null

  /** 半自动：玩家做出抉择（事件正文已写入日志） */
  resolvePending(choice: ChoiceDef): SimYearResult {
    const ev = this.pendingEvent
    const yearLogs: LogEntry[] = []
    const pushYear = (...entries: LogEntry[]) => {
      yearLogs.push(...entries)
      this.push(...entries)
    }
    this.pendingEvent = null
    if (!ev) return { logs: yearLogs, pendingChoice: null, died: false }

    pushYear({
      age: this.character.age,
      kind: 'choice',
      title: `${ev.name}·去向`,
      text: `你选择：${choice.text}`,
      importance: 1,
      eventId: ev.id,
    })
    pushYear(...applyEffects(this.character, choice.effects, this.character.age, ev.name, this.rng))

    if (ev.importance >= 4) this.character.yearsWithoutMajor = 0

    const deathMsg =
      [...yearLogs].reverse().find((l) => l.kind === 'death')?.text ?? choice.effects.death
    if (deathMsg) {
      this.ended = true
      this.deathReason = sanitizeDeathReason(this.character, deathMsg)
      if (!yearLogs.some((l) => l.kind === 'death')) {
        pushYear({
          age: this.character.age,
          kind: 'death',
          title: '陨落',
          text: this.deathReason,
          importance: 5,
        })
      }
      return { logs: yearLogs, pendingChoice: null, died: true, deathReason: this.deathReason }
    }

    const death = this.checkDeath()
    if (death) {
      this.ended = true
      this.deathReason = death
      pushYear({
        age: this.character.age,
        kind: 'death',
        title: '陨落',
        text: death,
        importance: 5,
      })
      return { logs: yearLogs, pendingChoice: null, died: true, deathReason: death }
    }
    return { logs: yearLogs, pendingChoice: null, died: false }
  }

  private resolveEvent(
    ev: EventDef,
    choice: ChoiceDef,
    pushYear: (...entries: LogEntry[]) => void,
  ) {
    const c = this.character
    // 全自动低重要度压成一行；半自动或重要事件展开正文
    const expandStory = this.mode === 'semi' || ev.importance >= 3
    if (expandStory) {
      pushYear({
        age: c.age,
        kind: 'event',
        title: ev.name,
        text: ev.text,
        importance: ev.importance,
        eventId: ev.id,
      })
      if (ev.needsChoice) {
        pushYear({
          age: c.age,
          kind: 'choice',
          title: `${ev.name}·去向`,
          text: `你选择：${choice.text}`,
          importance: 1,
          eventId: ev.id,
        })
      }
    } else {
      pushYear({
        age: c.age,
        kind: 'summary',
        title: ev.name,
        text: `${ev.name}——${choice.text}`,
        importance: ev.importance,
        eventId: ev.id,
      })
    }
    pushYear(...applyEffects(c, choice.effects, c.age, ev.name, this.rng))
  }

  /** 一口气模拟到死亡或遇到半自动抉择 */
  runUntilPause(maxYears = 150): SimYearResult {
    let last: SimYearResult = { logs: [], pendingChoice: null, died: false }
    for (let i = 0; i < maxYears; i++) {
      last = this.advanceYear()
      if (last.died || last.pendingChoice) return last
    }
    this.ended = true
    this.deathReason = sanitizeDeathReason(this.character, flavorLifespanDeath(this.character))
    return { logs: last.logs, pendingChoice: null, died: true, deathReason: this.deathReason }
  }
}

export function createBirth(
  seed: number,
  genderOverride?: '男' | '女',
  options?: {
    lockedTraitIds?: string[]
    unlockedAchievements?: string[]
  },
): Character {
  const rng = createRng(seed)
  const gender: '男' | '女' = genderOverride ?? (rng() < 0.5 ? '男' : '女')
  const achievements = options?.unlockedAchievements ?? []
  const originPool = ORIGINS.filter((o) => !o.unlockBy || achievements.includes(o.unlockBy))
  const origin = (originPool.length ? originPool : ORIGINS)[Math.floor(rng() * (originPool.length || ORIGINS.length))]

  const traitPool = TRAITS.filter((t) => !t.unlockBy || achievements.includes(t.unlockBy))
  const locked = (options?.lockedTraitIds ?? []).filter((id) => traitPool.some((t) => t.id === id))
  const traitCount = Math.max(locked.length, randInt(rng, 2, 4))
  const traitIds = pickWeightedTraits(traitPool, traitCount, locked, rng)

  const base: CharacterAttrs = {
    根骨: randInt(rng, 25, 75),
    悟性: randInt(rng, 25, 75),
    福缘: randInt(rng, 25, 75),
    魅力: randInt(rng, 25, 75),
    体魄: randInt(rng, 35, 80),
    心性: randInt(rng, -20, 40),
    机缘: randInt(rng, 20, 70),
  }

  const c: Character = {
    name: randomName(rng, gender),
    gender,
    originId: origin.id,
    traitIds,
    attrs: { ...base },
    wealth: 20,
    force: 5,
    fameGood: 0,
    fameEvil: 0,
    realm: '未入门',
    age: 0,
    lifespan: randInt(rng, 62, 88),
    martialArts: [] as OwnedMartial[],
    titles: [],
    primaryTitleId: null,
    flags: [],
    yearsWithoutMajor: 0,
    eventQueue: [],
    relations: [],
    portraitLook: pickPortraitLook(gender, rng),
  }

  applyAttrMods(c, origin.mods)
  for (const tid of traitIds) {
    applyAttrMods(c, getTrait(tid).mods)
  }

  // 词条 synergy：同开局触发
  for (const syn of matchSynergies(traitIds)) {
    applyAttrMods(c, syn.mods)
    for (const f of syn.addFlags ?? []) {
      if (!c.flags.includes(f)) c.flags.push(f)
    }
    if (syn.queueEvent) {
      const dueAge = Math.max(1, syn.queueEvent.delayYears)
      if (!c.eventQueue.some((q) => q.eventId === syn.queueEvent!.id)) {
        c.eventQueue.push({ eventId: syn.queueEvent.id, dueAge })
      }
    }
  }

  c.lifespan = clamp(c.lifespan, 45, 140)
  c.attrs.体魄 = clamp(c.attrs.体魄, 5, 100)
  assignCivicIntentFromOrigin(c, origin.id, origin.tags)
  return c
}

const RARITY_WEIGHT: Record<Rarity, number> = {
  普通: 10,
  稀有: 5,
  史诗: 2,
  传说: 1,
}

function pickWeightedTraits(
  pool: typeof TRAITS,
  count: number,
  locked: string[],
  rng: () => number,
): string[] {
  const picked = [...locked]
  const rest = pool.filter((t) => !picked.includes(t.id))
  while (picked.length < count && rest.length) {
    const item = pickWeighted(rest, (t) => RARITY_WEIGHT[t.rarity] ?? 1, rng)
    if (!item) break
    picked.push(item.id)
    const idx = rest.findIndex((t) => t.id === item.id)
    if (idx >= 0) rest.splice(idx, 1)
  }
  return picked
}

export function buildEnding(sim: LifeSimulator): EndingReport {
  const c = sim.character
  reconcilePrimaryTitle(c, getTitle)
  const origin = getOrigin(c.originId)
  const primary = c.primaryTitleId ? getTitle(c.primaryTitleId).name : null
  const secondaryNames = pickSecondaryTitleNames(c, getTitle, 2)
  const topMartial = [...c.martialArts]
    .sort((a, b) => b.level - a.level)
    .slice(0, 3)
    .map((m) => getMartial(m.id).name)
  const mainline = detectMainline(c)
  const force = calcForce(c)

  const highlights = pickLifeHighlights(sim.logs, c)

  const tags: string[] = []
  tags.push(
    ...enrichEndingTags(sim.deathReason, c, [
      ...(realmIndex(c.realm) >= 4 ? ['一代宗师'] : []),
      ...(c.titles.some((t) => t.id === 'mengzhu') ? ['武林传说'] : []),
      ...(c.titles.some((t) => t.id === 'jiaozhu') ? ['魔教覆雨'] : []),
      ...endingMoralTags(c, getTitle),
      ...(c.flags.includes('retreated') ? ['隐世而终'] : []),
      ...(c.flags.includes('sect_finale') ? ['门派余韵'] : []),
      ...(c.flags.includes('bandit_finale') ? ['匪途终章'] : []),
      ...(c.flags.includes('love_finale') ? ['情缘落定'] : []),
    ]),
  )

  const primaryDef = c.primaryTitleId ? getTitle(c.primaryTitleId) : null
  const titleScore =
    (primaryDef ? rarityScoreForEnding(primaryDef.rarity) * 12 : 0) +
    Math.min(3, Math.max(0, c.titles.length - (primaryDef ? 1 : 0))) * 4

  const score =
    c.age * 2 +
    realmIndex(c.realm) * 15 +
    titleScore +
    c.martialArts.length * 4 +
    Math.max(0, c.fameGood) +
    Math.max(0, c.fameEvil) +
    force

  const moreTitles = Math.max(0, c.titles.length - 1 - secondaryNames.length)
  const relLine =
    c.relations.length > 0
      ? `人事：${c.relations
          .slice(0, 2)
          .map((r) => `${r.kind}「${r.name}」`)
          .join('、')}${c.relations.length > 2 ? '等' : ''}。`
      : ''
  const unfinishedLine =
    sim.unfinishedQuests.length > 0
      ? `未竟：${sim.unfinishedQuests.slice(0, 2).join('、')}${sim.unfinishedQuests.length > 2 ? '等' : ''}。`
      : ''
  const identityLine = `身份：出身${origin.name}，主线「${mainline}」${primary ? `，人称「${primary}」` : ''}。`
  const deathTag = primaryDeathTag(sim.deathReason, c)
  const summary = [
    `${c.name}${primary ? `，人称「${primary}」` : ''}。`,
    identityLine,
    `修为至【${c.realm}】，享年${c.age}岁。`,
    topMartial.length ? `代表武学：${topMartial.join('、')}。` : '一生未得真正武学传承。',
    secondaryNames.length
      ? `另有名号：${secondaryNames.join('、')}${moreTitles > 0 ? `（另${moreTitles}个从略）` : ''}。`
      : primary
        ? ''
        : '未曾留下响亮名号。',
    relLine,
    unfinishedLine,
    `终局：${sim.deathReason}（${deathTag}）。`,
  ]
    .filter(Boolean)
    .join('')

  return {
    deathReason: sim.deathReason,
    endingTags: tags,
    summary,
    score: Math.round(score),
    finalAge: c.age,
    character: structuredClone(c),
    highlights,
    mainline,
    force,
    lifeLog: [...sim.logs],
  }
}

/** 高潮节拍表：链入口 / 中劫·终章 / 关系·余波，而非单纯末 N 条 */
function pickLifeHighlights(logs: LogEntry[], c: Character): string[] {
  const scored = logs
    .filter((l) => l.importance >= 3 && l.kind !== 'death' && l.kind !== 'summary')
    .map((l) => {
      let score = l.importance
      const t = `${l.title}${l.text}`
      if (/入门|拜山|投奔|开山/.test(t)) score += 3
      if (/终章|掌门|决战|大比|祭剑|开坛|开寺/.test(t)) score += 4
      if (/故人|师父|徒儿|仇|道侣|余波|归宿|未竟/.test(t)) score += 2
      if (c.flags.includes('sect_finale') && /山门|同门|掌门/.test(t)) score += 1
      return { l, score }
    })
    .sort((a, b) => b.score - a.score || a.l.age - b.l.age)

  const picked: string[] = []
  const seen = new Set<string>()
  for (const { l } of scored) {
    const key = `${l.age}-${l.title}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(`${l.age}岁·${l.title}`)
    if (picked.length >= 5) break
  }
  if (picked.length < 3) {
    for (const l of logs.filter((x) => x.importance >= 4 && x.kind !== 'death').slice(-5)) {
      const line = `${l.age}岁·${l.title}`
      if (!picked.includes(line)) picked.push(line)
      if (picked.length >= 5) break
    }
  }
  return picked
}

function rarityScoreForEnding(r: string): number {
  return { 普通: 1, 稀有: 2, 史诗: 3, 传说: 4 }[r] ?? 0
}

export { REALMS, EVENTS, ORIGINS, TRAITS, MARTIAL_ARTS, TITLES }
