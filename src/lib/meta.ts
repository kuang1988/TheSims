import type { EndingReport, MartialArtDef, TitleDef } from '../types'
import { MARTIAL_ARTS } from '../data/martialArts'
import { TITLES } from '../data/titles'

export interface AchievementDef {
  id: string
  name: string
  desc: string
  check: (ending: EndingReport) => boolean
}

export interface CodexState {
  achievements: string[]
  martialArts: string[]
  titles: string[]
  endings: string[]
}

const CODEX_KEY = 'wuxia-life-sim-codex-v1'

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_zhangmen',
    name: '一代掌门',
    desc: '成为门派掌门。',
    check: (e) => e.character.flags.includes('sect_leader') || e.character.titles.some((t) => t.id === 'zhangmen'),
  },
  {
    id: 'first_jiaozhu',
    name: '魔教教主',
    desc: '登上魔教教主之位。',
    check: (e) => e.character.flags.includes('demon_lord') || e.character.titles.some((t) => t.id === 'jiaozhu'),
  },
  {
    id: 'first_mengzhu',
    name: '武林盟主',
    desc: '执掌正道盟主之位。',
    check: (e) => e.character.flags.includes('alliance_leader') || e.character.titles.some((t) => t.id === 'mengzhu'),
  },
  {
    id: 'shendiao',
    name: '神雕义士',
    desc: '获得「神雕义士」名号。',
    check: (e) => e.character.titles.some((t) => t.id === 'shendiaoyishi'),
  },
  {
    id: 'eguiman',
    name: '恶贯满盈',
    desc: '恶名昭彰于江湖。',
    check: (e) => e.character.titles.some((t) => t.id === 'eguiman'),
  },
  {
    id: 'early_death',
    name: '天妒英才',
    desc: '未满三十而陨落。',
    check: (e) => e.finalAge < 30,
  },
  {
    id: 'centenarian',
    name: '百岁高人',
    desc: '活到一百岁以上。',
    check: (e) => e.finalAge >= 100,
  },
  {
    id: 'land_immortal',
    name: '陆地神仙',
    desc: '修为臻至大宗师。',
    check: (e) => e.character.realm === '大宗师',
  },
  {
    id: 'betrayed',
    name: '青出于蓝？',
    desc: '遭弟子背叛。',
    check: (e) => e.character.flags.includes('hunted_student'),
  },
  {
    id: 'junzijian',
    name: '君子剑',
    desc: '以君子之风扬名剑坛。',
    check: (e) => e.character.titles.some((t) => t.id === 'junzijian'),
  },
  {
    id: 'gaibang_lord',
    name: '丐帮之主',
    desc: '执掌天下丐帮，或获帮主之名。',
    check: (e) =>
      e.character.titles.some((t) => t.id === 'gaibang') ||
      e.character.flags.includes('gaibang_finale_done') ||
      e.character.flags.includes('gaibang_heir'),
  },
  {
    id: 'pomo_path',
    name: '破魔之志',
    desc: '走上专克邪魔的道路，或获破魔使者之名。',
    check: (e) =>
      e.character.titles.some((t) => t.id === 'pomo') || e.character.flags.includes('pomo_path'),
  },
  {
    id: 'yixian_hand',
    name: '慈悲医手',
    desc: '以医术济世，获医仙之名或救疫有功。',
    check: (e) =>
      e.character.titles.some((t) => t.id === 'yixian') ||
      e.character.flags.includes('saved_plague') ||
      (e.character.traitIds.includes('yixian') && e.character.flags.includes('doctor')),
  },
  {
    id: 'war_savior',
    name: '战场余生',
    desc: '战神血脉或边关立功，获救世仁心之名。',
    check: (e) =>
      e.character.titles.some((t) => t.id === 'jiushi') || e.character.flags.includes('war_hero'),
  },
  {
    id: 'merchant_legend',
    name: '商道留名',
    desc: '以商号扬名江湖。',
    check: (e) =>
      e.character.titles.some((t) => t.id === 'shangwang' || t.id === 'biaoshi') ||
      e.character.flags.includes('merchant_empire') ||
      e.character.flags.includes('merchant_crisis_done'),
  },
  {
    id: 'court_shadow',
    name: '庙堂过客',
    desc: '卷入朝廷密诏或边关军务，在庙堂留下足迹。',
    check: (e) =>
      e.character.flags.includes('court_edict_done') ||
      e.character.flags.includes('court_hero') ||
      e.character.flags.includes('court_justice'),
  },
  {
    id: 'love_settled',
    name: '情缘有终',
    desc: '情仇落定或情缘终章，不再被旧债绑死。',
    check: (e) =>
      e.character.flags.includes('love_finale') ||
      e.character.flags.includes('love_revenge_settled') ||
      e.character.flags.includes('love_revenge_done'),
  },
]

export function loadCodex(): CodexState {
  try {
    const raw = localStorage.getItem(CODEX_KEY)
    if (!raw) return { achievements: [], martialArts: [], titles: [], endings: [] }
    return JSON.parse(raw) as CodexState
  } catch {
    return { achievements: [], martialArts: [], titles: [], endings: [] }
  }
}

function saveCodex(state: CodexState) {
  try {
    localStorage.setItem(CODEX_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function uniqPush(arr: string[], id: string) {
  if (!arr.includes(id)) arr.push(id)
}

export function syncCodexFromEnding(ending: EndingReport): {
  codex: CodexState
  newAchievements: AchievementDef[]
} {
  const codex = loadCodex()
  const newAchievements: AchievementDef[] = []

  for (const m of ending.character.martialArts) uniqPush(codex.martialArts, m.id)
  for (const t of ending.character.titles) uniqPush(codex.titles, t.id)
  for (const tag of ending.endingTags) uniqPush(codex.endings, tag)

  for (const a of ACHIEVEMENTS) {
    if (a.check(ending) && !codex.achievements.includes(a.id)) {
      codex.achievements.push(a.id)
      newAchievements.push(a)
    }
  }

  saveCodex(codex)
  return { codex, newAchievements }
}

export function codexProgress(codex: CodexState) {
  const ENDING_TAG_POOL = [
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
    '一代宗师',
    '武林传说',
    '魔教覆雨',
    '门派余韵',
    '匪途终章',
    '情缘落定',
    '侠名留世',
    '恶名昭彰',
  ]
  return {
    achievements: `${codex.achievements.length}/${ACHIEVEMENTS.length}`,
    martialArts: `${codex.martialArts.length}/${MARTIAL_ARTS.length}`,
    titles: `${codex.titles.length}/${TITLES.length}`,
    endings: `${codex.endings.length}/${ENDING_TAG_POOL.length}`,
    endingPool: ENDING_TAG_POOL,
  }
}

export function listKnownMartial(codex: CodexState): MartialArtDef[] {
  return MARTIAL_ARTS.filter((m) => codex.martialArts.includes(m.id))
}

export function listKnownTitles(codex: CodexState): TitleDef[] {
  return TITLES.filter((t) => codex.titles.includes(t.id))
}
