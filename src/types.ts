export type LifeStage = '幼年' | '少年' | '青年' | '壮年' | '晚年'
export type PlayMode = 'auto' | 'semi'
export type Realm =
  | '未入门'
  | '练体'
  | '后天'
  | '先天'
  | '宗师'
  | '大宗师'

export type HeartTier = '至善' | '偏正' | '中庸' | '偏邪' | '极恶'
export type Rarity = '普通' | '稀有' | '史诗' | '传说'
export type MartialType =
  | '内功'
  | '外功'
  | '剑法'
  | '刀法'
  | '拳掌'
  | '轻功'
  | '奇门'
  | '医术'
  | '其他'
export type MartialGrade = '凡' | '下乘' | '中乘' | '上乘' | '绝学' | '神功'
export type TitleType = '正道' | '邪道' | '中立' | '趣味' | '职司'
export type TendencyTag = '侠义' | '狠厉' | '谨慎' | '冒险' | '修炼' | '交际' | '贪婪'

export interface AttrMods {
  根骨?: number
  悟性?: number
  福缘?: number
  魅力?: number
  体魄?: number
  心性?: number
  机缘?: number
  财富?: number
  武力?: number
  正道声望?: number
  邪道威名?: number
  寿命?: number
}

export interface OriginDef {
  id: string
  name: string
  desc: string
  mods: AttrMods
  tags: string[]
  /** 需已解锁对应成就才进入抽卡池 */
  unlockBy?: string
}

export interface TraitDef {
  id: string
  name: string
  rarity: Rarity
  desc: string
  mods?: AttrMods
  tags?: string[]
  /** 需已解锁对应成就才进入抽卡池 */
  unlockBy?: string
}

export interface MartialArtDef {
  id: string
  name: string
  type: MartialType
  grade: MartialGrade
  forceBonus: number
  tags: string[]
}

export interface TitleDef {
  id: string
  name: string
  rarity: Rarity
  type: TitleType
  desc: string
  exclusiveGroup?: string
  effects?: AttrMods
}

export type RelationKind = '师父' | '道侣' | '仇敌' | '挚友' | '徒弟'

export interface RelationSlot {
  kind: RelationKind
  name: string
  /** -100~100，仇敌用负值或单独仇恨 */
  bond: number
  /** 仇敌倒计时：剩余年数，非仇敌为 null */
  revengeIn: number | null
  note?: string
}

export interface EffectBundle {
  attrs?: AttrMods
  addMartialArt?: string
  upgradeMartialArt?: string
  grantTitle?: string
  setPrimaryTitle?: string
  setRealm?: Realm
  /** 强制改境界（可降低，如散功保命） */
  demoteRealm?: Realm
  addFlag?: string
  removeFlag?: string
  addFlags?: string[]
  removeFlags?: string[]
  /** 若干年后强制触发的后续事件 */
  queueEvent?: { id: string; delayYears?: number }
  queueEvents?: { id: string; delayYears?: number }[]
  /** 写入/更新关系槽（同 kind 覆盖） */
  setRelation?: {
    kind: RelationKind
    name?: string
    bond?: number
    revengeIn?: number | null
    note?: string
    clear?: boolean
  }
  /** 轻量战斗检定：对方强度 1~100 */
  combat?: {
    foePower: number
    foeName?: string
    onWin?: EffectBundle
    onLose?: EffectBundle
    onDraw?: EffectBundle
  }
  death?: string
  logExtra?: string
}

export interface ChoiceDef {
  text: string
  effects: EffectBundle
  tendencyTags?: TendencyTag[]
  requirements?: {
    minHeart?: number
    maxHeart?: number
    heartTiers?: HeartTier[]
    flags?: string[]
    anyFlags?: string[]
    minRealmIndex?: number
  }
}

export interface EventDef {
  id: string
  name: string
  text: string
  stages: LifeStage[]
  tags: string[]
  weight: number
  importance: 1 | 2 | 3 | 4 | 5
  needsChoice: boolean
  once?: boolean
  minAge?: number
  maxAge?: number
  /** 剧情链标识，用于权重加成与互斥 */
  chain?: string
  conditions?: {
    origins?: string[]
    traits?: string[]
    /** 须同时拥有（AND） */
    flags?: string[]
    /** 拥有其一即可（OR） */
    anyFlags?: string[]
    forbidFlags?: string[]
    heartTiers?: HeartTier[]
    minHeart?: number
    maxHeart?: number
    minRealmIndex?: number
    maxRealmIndex?: number
    hasMartial?: string[]
    hasTitle?: string[]
    /** 拥有这些称号则不触发 */
    forbidTitles?: string[]
    /** 已有对应阵营称号则不触发 */
    forbidTitleAlignments?: Array<'正' | '邪'>
    minForce?: number
  }
  choices: ChoiceDef[]
}

export interface OwnedMartial {
  id: string
  level: number
  source: string
  learnedAt: number
}

export interface OwnedTitle {
  id: string
  gainedAt: number
  source: string
}

export interface CharacterAttrs {
  根骨: number
  悟性: number
  福缘: number
  魅力: number
  体魄: number
  心性: number
  机缘: number
}

export interface Character {
  name: string
  gender: '男' | '女'
  originId: string
  traitIds: string[]
  attrs: CharacterAttrs
  wealth: number
  force: number
  fameGood: number
  fameEvil: number
  realm: Realm
  age: number
  lifespan: number
  martialArts: OwnedMartial[]
  titles: OwnedTitle[]
  primaryTitleId: string | null
  flags: string[]
  yearsWithoutMajor: number
  /** 已排期的后续事件 */
  eventQueue: { eventId: string; dueAge: number }[]
  /** 关系槽：师父/道侣/仇敌/挚友/徒弟 */
  relations: RelationSlot[]
}

export interface LogEntry {
  age: number
  kind: 'event' | 'choice' | 'system' | 'title' | 'martial' | 'death' | 'summary'
  title: string
  text: string
  importance: number
}

export interface PendingChoice {
  event: EventDef
  choices: ChoiceDef[]
}

export type Screen = 'birth' | 'life' | 'status' | 'ending'

export interface EndingReport {
  deathReason: string
  endingTags: string[]
  summary: string
  score: number
  finalAge: number
  character: Character
  highlights: string[]
  /** 本局主线标签 */
  mainline: string
  /** 终局战力（分享用） */
  force: number
  /** 完整生平日志，供结局回顾 */
  lifeLog: LogEntry[]
}

export interface GameState {
  screen: Screen
  mode: PlayMode
  seed: number
  character: Character | null
  logs: LogEntry[]
  pendingChoice: PendingChoice | null
  ended: boolean
  ending: EndingReport | null
  autoSpeed: number
  running: boolean
  majorOnly: boolean
}
