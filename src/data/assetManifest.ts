/** Phase 11 静态资产清单：立绘 / 高潮卡 / 终局死标 */

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
]
