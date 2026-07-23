import { clamp } from './utils'

export type CombatOutcome = '大胜' | '险胜' | '两败' | '惨败' | '逃出生天'

export interface CombatResult {
  outcome: CombatOutcome
  won: boolean
  drew: boolean
  text: string
  bodyDelta: number
  forceDelta: number
}

/** 轻量检定：己方战力 vs 对方强度，福缘微调 */
export function resolveCombat(
  myForce: number,
  luck: number,
  foePower: number,
  rng: () => number,
  foeName = '对手',
): CombatResult {
  const my = myForce + Math.floor((luck - 50) / 8)
  const roll = (rng() - 0.5) * 24
  const diff = my - foePower + roll

  if (diff >= 28) {
    return {
      outcome: '大胜',
      won: true,
      drew: false,
      text: `你力压${foeName}，大获全胜。`,
      bodyDelta: -2,
      forceDelta: 3,
    }
  }
  if (diff >= 8) {
    return {
      outcome: '险胜',
      won: true,
      drew: false,
      text: `你与${foeName}苦战良久，险胜一筹。`,
      bodyDelta: -6,
      forceDelta: 2,
    }
  }
  if (diff >= -8) {
    return {
      outcome: '两败',
      won: false,
      drew: true,
      text: `你与${foeName}两败俱伤，各自退去。`,
      bodyDelta: -10,
      forceDelta: 1,
    }
  }
  if (diff >= -28) {
    return {
      outcome: '惨败',
      won: false,
      drew: false,
      text: `你不敌${foeName}，身受重伤。`,
      bodyDelta: -16,
      forceDelta: 0,
    }
  }
  return {
    outcome: '逃出生天',
    won: false,
    drew: false,
    text: `你险些死于${foeName}手中，勉强逃得性命。`,
    bodyDelta: -12,
    forceDelta: -1,
  }
}

export function applyCombatBody(
  attrs: { 体魄: number },
  delta: number,
) {
  attrs.体魄 = clamp(attrs.体魄 + delta, 0, 100)
}
