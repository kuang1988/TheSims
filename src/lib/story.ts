import { ORIGINS } from '../data/origins'
import { TITLES } from '../data/titles'
import type { Character, EndingReport } from '../types'
import { heartTier } from './utils'
import { SECT_FINALE_DONE_FLAGS } from './sectPath'
import { civicMainlineLabel, getCivicPath, hasMajorFaction } from './civicPath'
import { BRAND } from './brand'

export type MainlineId =
  | '门派'
  | '魔教'
  | '匪患'
  | '情缘'
  | '正道'
  | '散修'
  | '士途'
  | '农桑'
  | '市井'
  | '商途'
  | '江湖客'
  | '未明'

function hasSectFinale(c: Character): boolean {
  return SECT_FINALE_DONE_FLAGS.some((f) => c.flags.includes(f)) || c.flags.includes('sect_finale')
}

function inActiveSect(c: Character): boolean {
  if (c.flags.includes('left_sect')) return false
  return (
    c.flags.includes('sect_huashan') ||
    c.flags.includes('sect_wudang') ||
    c.flags.includes('sect_shaolin') ||
    c.flags.includes('sect_emei') ||
    c.flags.includes('sect_gaibang') ||
    c.flags.includes('gaibang_member')
  )
}

/**
 * 优先「实际收束弧」：已完成的终章 > 当前强制身份。
 * left_sect 后不再因 finale_done alone 强行钉「门派」——若已离派且无在籍，偏向散修/其它收束。
 */
export function detectMainline(c: Character): MainlineId {
  const scores: Record<MainlineId, number> = {
    门派: 0,
    魔教: 0,
    匪患: 0,
    情缘: 0,
    正道: 0,
    散修: 0,
    士途: 0,
    农桑: 0,
    市井: 0,
    商途: 0,
    江湖客: 0,
    未明: 0,
  }

  // —— 收束终章：最高优先级 ——
  if (c.flags.includes('demon_finale') || c.flags.includes('demon_lord')) scores.魔教 += 120
  if (c.flags.includes('bandit_finale')) scores.匪患 += 110
  if (c.flags.includes('love_finale')) scores.情缘 += 100
  if (c.flags.includes('justice_finale') || c.flags.includes('alliance_leader')) scores.正道 += 110

  if (hasSectFinale(c)) {
    if (inActiveSect(c) || !c.flags.includes('left_sect')) {
      scores.门派 += 100
    } else {
      // 已离派：门派终章只记一笔往事，不压过散修/其它
      scores.门派 += 45
      scores.散修 += 40
    }
  }

  // —— 在籍身份 ——
  if (inActiveSect(c)) {
    scores.门派 += 90
    if (c.flags.includes('sect_leader')) scores.门派 += 25
    if (c.flags.includes('sect_loyal')) scores.门派 += 10
    if (hasSectFinale(c)) scores.门派 += 30
    // 在籍时：未收束的他族软旗不得压过门派；已收束他族终章仍可竞争但需更强
    if (!c.flags.includes('justice_finale') && !c.flags.includes('alliance_leader')) {
      scores.正道 = Math.min(scores.正道, 50)
    } else {
      scores.正道 = Math.min(scores.正道, scores.门派 - 5)
    }
    if (!c.flags.includes('demon_finale') && !c.flags.includes('demon_lord')) {
      scores.魔教 = Math.min(scores.魔教, 40)
    } else {
      scores.魔教 = Math.min(scores.魔教, scores.门派 - 5)
    }
    if (!c.flags.includes('love_finale')) {
      scores.情缘 = Math.min(scores.情缘, 45)
    } else {
      scores.情缘 = Math.min(scores.情缘, scores.门派 - 5)
    }
  }

  if (c.flags.includes('demon_sect') || c.flags.includes('demon_loyal')) scores.魔教 += 55
  if (c.titles.some((t) => t.id === 'jiaozhu')) scores.魔教 += 30

  if (c.flags.includes('pomo_path')) scores.正道 += 35
  if (c.flags.includes('helped_people')) scores.正道 += 20
  if (c.flags.includes('war_hero')) scores.正道 += 30
  if (c.titles.some((t) => ['mengzhu', 'pomo', 'jiushi'].includes(t.id))) scores.正道 += 25

  if (c.flags.includes('became_bandit') || c.flags.includes('bandit_camp')) scores.匪患 += 50
  if (c.flags.includes('massacre')) scores.匪患 += 35

  if (c.flags.includes('married')) scores.情缘 += 40
  if (c.flags.includes('lover') || c.flags.includes('lost_lover')) scores.情缘 += 25
  // 未收束情缘终章时，凡人局不过度被情缘抢走主线标签
  if (!c.flags.includes('love_finale') && getCivicPath(c) && !hasMajorFaction(c)) {
    scores.情缘 = Math.min(scores.情缘, 55)
  }

  if (c.flags.includes('left_sect') || c.flags.includes('wanderer')) {
    if (!inActiveSect(c)) scores.散修 += 35
  }
  if (c.flags.includes('retreated') || c.flags.includes('cliff_sword')) scores.散修 += 20

  // —— 凡尘主弧（未入名门主族时抬升） ——
  const civic = getCivicPath(c)
  if (civic && !hasMajorFaction(c)) {
    const label = civicMainlineLabel(civic)
    const finale = c.flags.includes(`civic_${civic}_finale`)
    scores[label] += finale ? 115 : 78
    if (c.flags.includes(`${civic}_mid_done`)) scores[label] += 20
    if (c.flags.includes(`${civic}_form_done`)) scores[label] += 12
    // 有凡尘归宿时，软情缘不得压过本业传
    if (finale) {
      scores.情缘 = Math.min(scores.情缘, scores[label] - 10)
      scores.散修 = Math.min(scores.散修, scores[label] - 10)
    }
  } else if (civic && hasMajorFaction(c)) {
    // 前半生凡尘：弱记一笔，不压主族
    scores[civicMainlineLabel(civic)] += 20
  }

  // 在籍时压散修与凡尘
  if (inActiveSect(c)) {
    scores.散修 = 0
    scores.士途 = Math.min(scores.士途, 25)
    scores.农桑 = Math.min(scores.农桑, 25)
    scores.市井 = Math.min(scores.市井, 25)
    scores.商途 = Math.min(scores.商途, 25)
    scores.江湖客 = Math.min(scores.江湖客, 25)
  }

  let best: MainlineId = '未明'
  let bestScore = 0
  for (const id of Object.keys(scores) as MainlineId[]) {
    if (id === '未明') continue
    if (scores[id] > bestScore) {
      bestScore = scores[id]
      best = id
    }
  }
  return bestScore > 0 ? best : '未明'
}

function titleName(id: string) {
  return TITLES.find((t) => t.id === id)?.name ?? id
}

function originName(id: string) {
  return ORIGINS.find((o) => o.id === id)?.name ?? id
}

export function formatShareText(ending: EndingReport, seed?: number): string {
  const c = ending.character
  const primary = c.primaryTitleId ? titleName(c.primaryTitleId) : null
  const highs = ending.highlights.slice(-2)
  const identity = `出身${originName(c.originId)} → 主线${ending.mainline}${primary ? ` → 人称「${primary}」` : ''}`
  const rel =
    c.relations.length > 0
      ? `人事：${c.relations
          .slice(0, 2)
          .map((r) => `${r.kind}${r.name}`)
          .join('、')}`
      : ''
  const lines = [
    `【${BRAND.name}】`,
    `${c.name}${primary ? ` · ${primary}` : ''}（${c.gender}）`,
    identity,
    seed != null ? `种子 ${seed} · 同种不同抉择` : '',
    `评分 ${ending.score}｜【${c.realm}】｜享年${ending.finalAge}岁｜战力 ${ending.force}`,
    `心性：${heartTier(c.attrs.心性)}（${c.attrs.心性}）`,
    ending.summary,
    rel,
    highs.length ? `高光：${highs.join('；')}` : '',
    `结局：${ending.endingTags.slice(0, 3).join('、')}`,
  ]
  return lines.filter(Boolean).join('\n')
}

export interface RunStats {
  totalRuns: number
  totalAge: number
  earlyDeaths: number
  highestScore: number
  mainlineCounts: Record<string, number>
}

const STATS_KEY = 'wuxia-life-sim-stats-v1'

export function loadStats(): RunStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) {
      return { totalRuns: 0, totalAge: 0, earlyDeaths: 0, highestScore: 0, mainlineCounts: {} }
    }
    return JSON.parse(raw) as RunStats
  } catch {
    return { totalRuns: 0, totalAge: 0, earlyDeaths: 0, highestScore: 0, mainlineCounts: {} }
  }
}

export function recordRunStats(ending: EndingReport): RunStats {
  const stats = loadStats()
  stats.totalRuns += 1
  stats.totalAge += ending.finalAge
  if (ending.finalAge < 30) stats.earlyDeaths += 1
  stats.highestScore = Math.max(stats.highestScore, ending.score)
  stats.mainlineCounts[ending.mainline] = (stats.mainlineCounts[ending.mainline] ?? 0) + 1
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    /* ignore */
  }
  return stats
}

export function statsSummary(stats: RunStats): string {
  if (stats.totalRuns === 0) return '尚未完成一局'
  const avg = Math.round(stats.totalAge / stats.totalRuns)
  const top = Object.entries(stats.mainlineCounts).sort((a, b) => b[1] - a[1])[0]
  return `已历 ${stats.totalRuns} 世｜均寿 ${avg}｜最高分 ${stats.highestScore}${top ? `｜常走「${top[0]}」` : ''}`
}
