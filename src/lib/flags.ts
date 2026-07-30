/**
 * Phase 22 起步：被逻辑层读取的核心旗注册表（非全量 900+ 叙事旗）。
 * 新增「引擎/死因/路径」读取的旗时，优先登记到此，便于静态核对。
 */
export const CORE_LOGIC_FLAGS = [
  // 破境 / 天劫
  'inner_risk',
  'broke_through',
  'broke_through_safe',
  'closedoor_risk',
  'omen_breakthrough_done',
  'qi_deviation',
  'meridian_gamble',
  'heaven_ok',
  'heaven_failed',
  'heaven_scar',
  // 伤势 / 寻仇
  'battle_wounded',
  'severe_wound',
  'escort_wounded',
  'revenge_pursuit',
  'betrayal_pursuit',
  'hunted_student',
  'enemy_due',
  // 毒 / 医
  'poisoned_once',
  'emei_poison_kept',
  'duyi_path',
  // 凡尘 / 朝廷
  'fugitive',
  'civic_shi_finale',
  'civic_nong_finale',
  'civic_gong_finale',
  'civic_shang_finale',
  'civic_wanderer_finale',
  // Phase 16 链终
  'p16_love_done',
  'p16_bandit_done',
  'p16_merchant_done',
  // synergy
  'synergy_jianxin',
  'synergy_mohe',
  'synergy_shuangxia',
  'synergy_yidao',
  'synergy_zhansha',
  'synergy_biaoxin',
  'synergy_caoshang',
] as const

export type CoreLogicFlag = (typeof CORE_LOGIC_FLAGS)[number]

export function isCoreLogicFlag(f: string): f is CoreLogicFlag {
  return (CORE_LOGIC_FLAGS as readonly string[]).includes(f)
}
