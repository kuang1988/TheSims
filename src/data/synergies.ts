import type { AttrMods } from '../types'

/** 词条 synergy：开局同时拥有全部 requiredTraits 时触发 */
export interface SynergyDef {
  id: string
  name: string
  desc: string
  requiredTraits: string[]
  mods?: AttrMods
  addFlags?: string[]
  /** 若干年后强制触发的专属事件 */
  queueEvent?: { id: string; delayYears: number }
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'jianxin',
    name: '剑心通明',
    desc: '剑骨天成配上清心寡欲，剑意更纯。',
    requiredTraits: ['jiangu', 'qingxin'],
    mods: { 悟性: 6, 根骨: 4 },
    addFlags: ['synergy_jianxin'],
    queueEvent: { id: 'synergy_jianxin_trial', delayYears: 12 },
  },
  {
    id: 'mohe',
    name: '魔影夜行',
    desc: '魔种与夜行怪客相合，邪功更易入手。',
    requiredTraits: ['mozhong', 'yeguai'],
    mods: { 邪道威名: 8, 武力: 5, 心性: -6 },
    addFlags: ['synergy_mohe'],
    queueEvent: { id: 'synergy_mohe_pact', delayYears: 10 },
  },
  {
    id: 'shuangxia',
    name: '双侠同途',
    desc: '菩萨心肠与豪侠风骨，行侠之路更广。',
    requiredTraits: ['renxin', 'haoxia'],
    mods: { 心性: 8, 正道声望: 10, 魅力: 4 },
    addFlags: ['synergy_shuangxia'],
    queueEvent: { id: 'synergy_shuangxia_deed', delayYears: 14 },
  },
  {
    id: 'yidao',
    name: '医武同源',
    desc: '医仙转世配过目不忘，医术与内息互通。',
    requiredTraits: ['yixian', 'guomu'],
    mods: { 悟性: 8, 福缘: 4 },
    addFlags: ['synergy_yidao', 'doctor'],
    queueEvent: { id: 'synergy_yidao_miracle', delayYears: 11 },
  },
  {
    id: 'zhansha',
    name: '杀意沸腾',
    desc: '战神血脉与铁石心肠，战场上更狠。',
    requiredTraits: ['zhanshen', 'tieshi'],
    mods: { 武力: 8, 体魄: 4, 心性: -5 },
    addFlags: ['synergy_zhansha'],
    queueEvent: { id: 'synergy_zhansha_war', delayYears: 16 },
  },
]

export function matchSynergies(traitIds: string[]): SynergyDef[] {
  return SYNERGIES.filter((s) => s.requiredTraits.every((t) => traitIds.includes(t)))
}
