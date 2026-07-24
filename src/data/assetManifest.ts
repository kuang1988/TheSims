/** Phase 11 静态资产清单：立绘 / 高潮卡 / 终局死标；Phase 19 出身选项卡 */

import { ORIGINS } from './origins'

export type GenderKey = 'm' | 'f'
export type PortraitArchetype =
  | 'huashan'
  | 'wudang'
  | 'shaolin'
  | 'emei'
  | 'gaibang'
  | 'demon'
  | 'bandit'
  | 'civic'
  | 'wanderer'

export type ClimaxKey =
  | 'c_sect_entry'
  | 'c_sect_mid'
  | 'c_sect_war'
  | 'c_sect_finale'
  | 'c_love_entry'
  | 'c_love_tragedy'
  | 'c_love_finale'
  | 'c_demon_entry'
  | 'c_demon_mid'
  | 'c_demon_finale'
  | 'c_bandit_mid'
  | 'c_bandit_finale'
  | 'c_civic_entry'
  | 'c_civic_mid'
  | 'c_civic_finale'
  | 'c_justice_mid'
  | 'c_justice_finale'
  | 'c_relation_master'
  | 'c_relation_disciple'
  | 'c_relation_enemy'
  | 'c_act2_echo'
  | 'c_escort_entry'
  | 'c_escort_mid'
  | 'c_escort_finale'
  | 'c_master_entry'
  | 'c_master_mid'
  | 'c_master_finale'
  | 'c_force_entry'
  | 'c_force_mid'
  | 'c_force_finale'

export type ThinChain = 'escort' | 'master' | 'force'

/** 薄链事件 → 高潮桶启发式（id 表优先；本函数供审计/补表） */
export function suggestThinChainClimaxKey(
  chain: ThinChain,
  id: string,
  name = '',
): ClimaxKey {
  const blob = `${id} ${name}`
  const finale =
    /finale|epilogue|graduate|farewell|deliver|reputation|_late|gift|student_leave|seal|break|beilu|旧人|遗训|出师|归隐|成名|罚银|交镖/
  if (chain === 'escort') {
    if (/contract|briefing|depart|揭贴|接镖|出城|出关|聘书|点卯|起程/.test(blob)) {
      return 'c_escort_entry'
    }
    if (finale.test(blob)) return 'c_escort_finale'
    return 'c_escort_mid'
  }
  if (chain === 'master') {
    if (/_meet|_first|拜师|跪求|初见|问剑|首授/.test(blob)) return 'c_master_entry'
    if (finale.test(blob)) return 'c_master_finale'
    return 'c_master_mid'
  }
  if (/awaken|_train$|wuguan_train|wuguan_stance|武馆|入馆|码头第一|力拔|扎马|站桩/.test(blob)) {
    return 'c_force_entry'
  }
  if (finale.test(blob)) return 'c_force_finale'
  return 'c_force_mid'
}

/** 死法精标 → 文件 fineKey */
export const DEATH_TAG_FINE_KEY: Record<string, string> = {
  寿终正寝: 'shouzhong',
  隐世而终: 'yinshi',
  宗师善终: 'zongshi',
  狱中而终: 'prison',
  战死沙场: 'battle',
  朝廷赐死: 'court_edict',
  情劫自尽: 'qingjie',
  突破失败: 'breakthrough',
  门派殉道: 'sect_martyr',
  毒发身亡: 'poison',
  门人反噬: 'betrayal',
  仇敌寻仇: 'revenge',
  遭人暗算: 'ambush',
  伤重不治: 'wound',
  病榻而终: 'sickbed',
  劳伤而终: 'labor',
  债逼而终: 'debt',
  致仕而终: 'retire',
  工伤而终: 'workshop',
  途中而终: 'road',
  死于非命: 'feiming',
  江湖陨落: 'fallen',
}

export const PORTRAIT_ARCHETYPES: PortraitArchetype[] = [
  'huashan',
  'wudang',
  'shaolin',
  'emei',
  'gaibang',
  'demon',
  'bandit',
  'civic',
  'wanderer',
]

/** 出身选项卡 id（与 origins.ts 同步） */
export const ORIGIN_IDS: string[] = ORIGINS.map((o) => o.id)

/** public/assets/origin/o_{id}.webp */
export function originAssetPath(originId: string): string {
  return `origin/o_${originId}.webp`
}

/** 事件 id → 高潮卡 */
export const CLIMAX_BY_EVENT_ID: Record<string, ClimaxKey> = {
  huashan_finale: 'c_sect_finale',
  wudang_finale: 'c_sect_finale',
  shaolin_finale: 'c_sect_finale',
  emei_finale: 'c_sect_finale',
  gaibang_finale: 'c_sect_finale',
  sect_finale: 'c_sect_finale',
  huashan_cliff_duel: 'c_sect_mid',
  huashan_sword_trial: 'c_sect_entry',
  huashan_demon_raid: 'c_sect_war',
  wudang_demon_siege: 'c_sect_war',
  shaolin_sect_war: 'c_sect_war',
  death_sect_martyr: 'c_sect_war',
  mid_sect_fight: 'c_sect_mid',
  // —— escort 薄链 ——
  youth_merchant: 'c_escort_mid',
  escort_ambush: 'c_escort_mid',
  mid_wealth: 'c_escort_mid',
  escort_p16_contract: 'c_escort_entry',
  escort_p16_briefing: 'c_escort_entry',
  escort_p16_depart: 'c_escort_entry',
  escort_p16_rain: 'c_escort_mid',
  escort_p16_inn: 'c_escort_mid',
  escort_p16_ambush: 'c_escort_mid',
  escort_p16_deliver: 'c_escort_finale',
  escort_p16_fail: 'c_escort_mid',
  escort_p16_betrayal: 'c_escort_mid',
  escort_p16_reputation: 'c_escort_finale',
  escort_p16_jade: 'c_escort_mid',
  escort_p16_jade_truth: 'c_escort_mid',
  escort_p16_jade_curse: 'c_escort_mid',
  escort_p16_bounty: 'c_escort_mid',
  escort_p16_revenge: 'c_escort_mid', // 误绑修正：勿落 relation_enemy
  escort_p16_river: 'c_escort_mid',
  escort_p16_snow: 'c_escort_mid',
  escort_p16_rookie: 'c_escort_mid',
  escort_p16_poison: 'c_escort_mid',
  escort_p16_night: 'c_escort_mid',
  escort_p16_bribe: 'c_escort_mid',
  escort_p16_wolf: 'c_escort_mid',
  escort_p16_map: 'c_escort_mid',
  escort_p16_widow: 'c_escort_mid',
  escort_p16_rival: 'c_escort_mid',
  escort_p16_fire: 'c_escort_mid',
  escort_p16_monk: 'c_escort_mid',
  escort_p16_epilogue: 'c_escort_finale',
  escort_p16_late: 'c_escort_finale',
  escort_p16_secret: 'c_escort_mid',
  p17_escort_merchant_guard: 'c_escort_mid',
  p17_title_beilu: 'c_escort_finale',
  p17_escort_guard_hands: 'c_escort_mid',
  p17_cart_shield: 'c_escort_mid',
  p17_trait_biaogu: 'c_escort_mid',
  p17_synergy_biaoxin: 'c_escort_mid',
  // —— master 薄链 ——
  child_master: 'c_master_mid',
  master_teach: 'c_master_mid',
  master_farewell: 'c_master_finale',
  master_p16_meet: 'c_master_entry',
  master_p16_test: 'c_master_mid',
  master_p16_first: 'c_master_entry',
  master_p16_sweep: 'c_master_mid',
  master_p16_steal: 'c_master_mid',
  master_p16_mission: 'c_master_mid',
  master_p16_rival_disciple: 'c_master_mid',
  master_p16_rescue: 'c_master_mid',
  master_p16_secret: 'c_master_mid',
  master_p16_betray: 'c_master_mid',
  master_p16_duel: 'c_master_mid',
  master_p16_graduate: 'c_master_finale',
  master_p16_gift: 'c_master_finale',
  master_p16_letter: 'c_master_mid',
  master_p16_farewell: 'c_master_finale',
  master_p16_student: 'c_master_mid',
  master_p16_teach: 'c_master_mid',
  master_p16_student_leave: 'c_master_finale',
  master_p16_enemy: 'c_master_mid',
  master_p16_library: 'c_master_mid',
  master_p16_wedding: 'c_master_mid',
  master_p16_debt: 'c_master_mid',
  master_p16_forge: 'c_master_mid',
  master_p16_debate: 'c_master_mid',
  master_p16_seal: 'c_master_finale',
  master_p16_reunion: 'c_master_mid',
  master_p16_med: 'c_master_mid',
  master_p16_vow: 'c_master_finale',
  master_p16_epilogue: 'c_master_finale',
  master_p16_night: 'c_master_mid',
  p17_hermit_breath: 'c_master_mid',
  p17_yinshi_cave: 'c_master_mid',
  p17_yinshi_return: 'c_master_mid',
  p17_trait_shimen: 'c_master_mid',
  // —— force 薄链 ——
  child_force: 'c_force_mid',
  wuguan_train: 'c_force_entry',
  force_p16_awaken: 'c_force_entry',
  force_p16_train: 'c_force_entry',
  force_p16_dock: 'c_force_mid',
  force_p16_bullies: 'c_force_mid',
  force_p16_challenge: 'c_force_mid',
  force_p16_iron: 'c_force_mid',
  force_p16_bridge: 'c_force_mid',
  force_p16_stone: 'c_force_mid',
  force_p16_sect: 'c_force_mid',
  force_p16_rage: 'c_force_mid',
  force_p16_rope: 'c_force_mid',
  force_p16_cart: 'c_force_mid',
  force_p16_mountain: 'c_force_mid',
  force_p16_wrestle: 'c_force_mid',
  force_p16_beast: 'c_force_mid',
  force_p16_army: 'c_force_mid',
  force_p16_break: 'c_force_finale',
  force_p16_old: 'c_force_mid',
  force_p16_hidden: 'c_force_mid',
  force_p16_epilogue: 'c_force_finale',
  force_p16_sand: 'c_force_mid',
  force_p16_rival: 'c_force_mid',
  p17_title_tiaozhan: 'c_force_mid',
  p17_dock_short: 'c_force_mid',
  p17_market_iron: 'c_force_mid',
  p17_wuguan_stance: 'c_force_entry',
  p17_wuguan_spar: 'c_force_mid',
  p17_wuguan_secret: 'c_force_mid',
  p17_shenli_mill: 'c_force_mid',
  p17_shenli_challenge: 'c_force_mid',
  p17_trait_shijing: 'c_force_mid',
  // —— 非薄链（保持原映射）——
  love_finale: 'c_love_finale',
  rel_lover_fate: 'c_love_finale',
  youth_love_tragedy: 'c_love_tragedy',
  death_love_end: 'c_love_tragedy',
  love_revenge: 'c_love_tragedy',
  trait_hongyan_gaze: 'c_love_entry',
  youth_demon_invite: 'c_demon_entry',
  demon_task: 'c_demon_mid',
  spy_game: 'c_demon_mid',
  mid_demon_throne: 'c_demon_finale',
  demon_reign: 'c_demon_finale',
  demon_epilogue: 'c_demon_finale',
  bandit_finale: 'c_bandit_finale',
  bandit_revenge: 'c_bandit_finale',
  bandit_life: 'c_bandit_mid',
  bandit_raid: 'c_bandit_mid',
  mid_massacre: 'c_bandit_mid',
  civic_shi_entry: 'c_civic_entry',
  civic_nong_entry: 'c_civic_entry',
  civic_gong_entry: 'c_civic_entry',
  civic_shang_entry: 'c_civic_entry',
  civic_wanderer_entry: 'c_civic_entry',
  civic_shi_mid: 'c_civic_mid',
  civic_nong_mid: 'c_civic_mid',
  civic_gong_mid: 'c_civic_mid',
  civic_shang_mid: 'c_civic_mid',
  civic_wanderer_mid: 'c_civic_mid',
  civic_shi_late: 'c_civic_finale',
  civic_nong_late: 'c_civic_finale',
  civic_gong_late: 'c_civic_finale',
  civic_shang_late: 'c_civic_finale',
  civic_wanderer_late: 'c_civic_finale',
  court_finale: 'c_civic_finale',
  merchant_finale: 'c_civic_finale',
  mid_alliance: 'c_justice_mid',
  alliance_war: 'c_justice_mid',
  justice_epilogue: 'c_justice_finale',
  rel_master_letter: 'c_relation_master',
  rel_master_final: 'c_relation_master',
  rel_disciple_return: 'c_relation_disciple',
  rel_disciple_fate: 'c_relation_disciple',
  death_betrayal_blade: 'c_relation_disciple',
  mid_betray: 'c_relation_disciple',
  rel_enemy_named_echo: 'c_relation_enemy',
  rel_enemy_last: 'c_relation_enemy',
  relation_revenge: 'c_relation_enemy',
  act2_sect_echo: 'c_act2_echo',
  act2_wander_mid: 'c_act2_echo',
  act2_late_home: 'c_act2_echo',
}

/** 高光标题关键词 → 高潮卡（按优先级从前到后匹配） */
export const CLIMAX_TITLE_RULES: { re: RegExp; key: ClimaxKey }[] = [
  { re: /华山余剑|武当余韵|少林归处|峨眉余韵|丐帮终章|门楣传灯/, key: 'c_sect_finale' },
  { re: /山门浴血|护山|犯山|血战|魔教犯/, key: 'c_sect_war' },
  { re: /拜山|问道|剑试|金顶|钟声|入门/, key: 'c_sect_entry' },
  { re: /掌门|崖约|大考|传位|门争/, key: 'c_sect_mid' },
  { re: /情缘落定|情缘终局/, key: 'c_love_finale' },
  { re: /情劫|情仇|故人书信/, key: 'c_love_tragedy' },
  { re: /惊鸿|道侣|结缘/, key: 'c_love_entry' },
  { re: /魔焰|教主|王座/, key: 'c_demon_finale' },
  { re: /魔教招揽/, key: 'c_demon_entry' },
  { re: /魔教|卧底|夜猎/, key: 'c_demon_mid' },
  { re: /匪途终章|血债/, key: 'c_bandit_finale' },
  { re: /匪|血洗|劫道/, key: 'c_bandit_mid' },
  { re: /致仕|田埂归宿|传艺归宿|收手归宿|游方归宿|庙堂归处|商途终章/, key: 'c_civic_finale' },
  { re: /宦海|田讼|夺艺|商战|卖命单/, key: 'c_civic_mid' },
  { re: /攻书|守田|学艺|跑街|卖艺/, key: 'c_civic_entry' },
  { re: /正道余响/, key: 'c_justice_finale' },
  { re: /正道大会|正邪大战|行侠|豪侠|揭竿/, key: 'c_justice_mid' },
  { re: /师父|师门/, key: 'c_relation_master' },
  { re: /徒儿|弟子|白刃|背叛/, key: 'c_relation_disciple' },
  { re: /仇敌|旧仇|寻仇/, key: 'c_relation_enemy' },
  { re: /山门余音|晚岁归宿|江湖中场/, key: 'c_act2_echo' },
  { re: /揭贴|接镖|出城/, key: 'c_escort_entry' },
  { re: /交镖入城|挂旗开张|金牌镖|镖局/, key: 'c_escort_finale' },
  { re: /劫镖|护镖|交镖|失镖|镖旗|镖路|黑松劫/, key: 'c_escort_mid' },
  { re: /拜师|跪求|初见/, key: 'c_master_entry' },
  { re: /下山|病榻|叛师|真传|师徒决/, key: 'c_master_finale' },
  { re: /传功|同门|山门试|隐士授/, key: 'c_master_mid' },
  { re: /武馆|码头第一|入馆/, key: 'c_force_entry' },
  { re: /力道成名|收手|码头无敌|连破三石/, key: 'c_force_finale' },
  { re: /擂台|码头|比武|臂力/, key: 'c_force_mid' },
]

export const ALL_CLIMAX_KEYS: ClimaxKey[] = [
  'c_sect_entry',
  'c_sect_mid',
  'c_sect_war',
  'c_sect_finale',
  'c_love_entry',
  'c_love_tragedy',
  'c_love_finale',
  'c_demon_entry',
  'c_demon_mid',
  'c_demon_finale',
  'c_bandit_mid',
  'c_bandit_finale',
  'c_civic_entry',
  'c_civic_mid',
  'c_civic_finale',
  'c_justice_mid',
  'c_justice_finale',
  'c_relation_master',
  'c_relation_disciple',
  'c_relation_enemy',
  'c_act2_echo',
  'c_escort_entry',
  'c_escort_mid',
  'c_escort_finale',
  'c_master_entry',
  'c_master_mid',
  'c_master_finale',
  'c_force_entry',
  'c_force_mid',
  'c_force_finale',
]
