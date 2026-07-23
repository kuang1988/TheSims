/**
 * 五大门派 × 正/反/中庸 全自动批跑 + Phase 6 契约汇总。
 * 运行：npm run sect-fork
 */
import { writeFileSync } from 'fs'
import { createBirth, LifeSimulator, buildEnding, getTitle } from '../src/engine/simulator.ts'
import { countSectFinaleDone, hasZombieSectFlags, activeChainFamilyCount } from '../src/lib/leaveSect.ts'
import { primaryConflictsMainline } from '../src/lib/titlePace.ts'

type Moral = '正' | '反' | '中庸'

const SECTS: { id: string; flag: string; extra: string[]; finaleHint: string }[] = [
  { id: '华山', flag: 'sect_huashan', extra: ['sect_loyal'], finaleHint: '华山余剑' },
  { id: '武当', flag: 'sect_wudang', extra: ['sect_loyal'], finaleHint: '武当余韵' },
  { id: '少林', flag: 'sect_shaolin', extra: ['sect_loyal'], finaleHint: '少林归处' },
  { id: '峨眉', flag: 'sect_emei', extra: ['sect_loyal'], finaleHint: '峨眉余韵' },
  { id: '丐帮', flag: 'sect_gaibang', extra: ['gaibang_member', 'gaibang_heir'], finaleHint: '丐帮终章' },
]

function prep(seed: number, sect: (typeof SECTS)[0], moral: Moral) {
  const c = createBirth(seed)
  c.age = 18
  c.flags.push('sect_outer', 'path_chosen', sect.flag, ...sect.extra)
  if (moral === '正') {
    c.attrs.心性 = 55
    c.flags.push('helped_people', 'pomo_path')
  } else if (moral === '反') {
    c.attrs.心性 = -55
    c.flags.push('robber')
  } else {
    c.attrs.心性 = 0
  }
  return c
}

const rows: string[] = [
  '# 门派分叉批跑报告',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  '每局：强制门派旗 + 心性向，全自动跑完，摘录结局摘要与关键节点。',
  '',
]

type Row = {
  sect: string
  moral: Moral
  seed: number
  age: number
  sawFinale: boolean
  hollow: boolean
  mainline: string
  crossSect: boolean
  dualFinale: boolean
  zombieLeave: boolean
  titleConflict: boolean
  chainPeak: number
  stillInSect: boolean
}

const stats: Row[] = []
const OTHER_SECT = ['sect_huashan', 'sect_wudang', 'sect_shaolin', 'sect_emei', 'sect_gaibang']

let seed = 42000
for (const sect of SECTS) {
  rows.push(`## ${sect.id}`, '')
  for (const moral of ['正', '反', '中庸'] as Moral[]) {
    seed += 1
    const c = prep(seed, sect, moral)
    const sim = new LifeSimulator(c, seed ^ 0x9e3779b9, 'auto')
    let chainPeak = 1
    for (let i = 0; i < 250; i++) {
      const peak = activeChainFamilyCount(sim.character)
      chainPeak = Math.max(chainPeak, peak)
      const r = sim.advanceYear()
      if (r.died) break
    }
    const ending = buildEnding(sim)
    const highlights = ending.highlights.slice(0, 5).map((h) => `- ${h}`).join('\n') || '- （无）'
    const keyFlags = sim.character.flags
      .filter((f) =>
        /finale|leader|demon|pomo|massacre|helped|gaibang|huashan|wudang|shaolin|emei|left_sect/.test(
          f,
        ),
      )
      .slice(0, 12)
      .join(', ')
    const titles = sim.character.titles.map((t) => t.id).join(', ') || '无'
    const sawFinale = sim.logs.some((l) => l.title === sect.finaleHint)
    const hollow = ending.finalAge < 25 && sim.character.titles.length <= 1
    const crossSect =
      OTHER_SECT.filter((f) => sim.character.flags.includes(f)).length > 1 ||
      (sim.character.flags.includes('gaibang_member') &&
        OTHER_SECT.some((f) => f !== 'sect_gaibang' && sim.character.flags.includes(f)))
    const dualFinale = countSectFinaleDone(sim.character) > 1
    const zombieLeave = hasZombieSectFlags(sim.character)
    const titleConflict = primaryConflictsMainline(sim.character, getTitle)
    const stillInSect =
      !sim.character.flags.includes('left_sect') &&
      (sim.character.flags.includes(sect.flag) ||
        (sect.flag === 'sect_gaibang' && sim.character.flags.includes('gaibang_member')))
    stats.push({
      sect: sect.id,
      moral,
      seed,
      age: ending.finalAge,
      sawFinale,
      hollow,
      mainline: ending.mainline,
      crossSect,
      dualFinale,
      zombieLeave,
      titleConflict,
      chainPeak,
      stillInSect,
    })
    rows.push(
      `### ${moral}（seed ${seed}）`,
      '',
      `- 终局年龄：${ending.finalAge}｜主线：${ending.mainline}｜评分：${ending.score}｜族峰值：${chainPeak}`,
      `- 见到「${sect.finaleHint}」：${sawFinale ? '是' : '否'}`,
      `- 称号：${titles}`,
      `- 关键 flags：${keyFlags || '无'}`,
      `- 摘要：${ending.summary}`,
      `- 高光：`,
      highlights,
      '',
    )
  }
}

const finaleHits = stats.filter((s) => s.sawFinale).length
const hollowHits = stats.filter((s) => s.hollow).length
const crossHits = stats.filter((s) => s.crossSect).length
const dualHits = stats.filter((s) => s.dualFinale).length
const zombieHits = stats.filter((s) => s.zombieLeave).length
const titleHits = stats.filter((s) => s.titleConflict).length
const multiChain = stats.filter((s) => s.chainPeak >= 3).length
const inSectMainline = stats.filter((s) => s.stillInSect && s.mainline === '门派').length
const inSectTotal = stats.filter((s) => s.stillInSect).length
const ages = stats.map((s) => s.age).sort((a, b) => a - b)
const medianAge = ages[Math.floor(ages.length / 2)]
const young = stats.filter((s) => s.age < 28).length

const bySect = SECTS.map((sect) => {
  const rowsS = stats.filter((s) => s.sect === sect.id)
  const hit = rowsS.filter((s) => s.sawFinale).length
  const zheng = rowsS.find((s) => s.moral === '正')
  return `- ${sect.id}：终章 ${hit}/3｜正线终章：${zheng?.sawFinale ? '是' : '否'}`
}).join('\n')

const summary = [
  '---',
  '',
  '## 汇总（Phase 6 验收）',
  '',
  `- 终章触达：${finaleHits}/${stats.length}`,
  `- 空洞局（&lt;25 岁且称号≤1）：${hollowHits}/${stats.length}`,
  `- 跨门串旗：${crossHits}/${stats.length}`,
  `- 双门终章：${dualHits}/${stats.length}（目标 0）`,
  `- 离派僵尸旗：${zombieHits}/${stats.length}（目标 0）`,
  `- 主称–主线冲突：${titleHits}/${stats.length}（目标 ≤1）`,
  `- 主线族峰值≥3：${multiChain}/${stats.length}（目标 ≤2）`,
  `- 未离派且主线=门派：${inSectMainline}/${inSectTotal || 0}`,
  `- 终局年龄中位：${medianAge}｜&lt;28 岁：${young}/${stats.length}`,
  '',
  '### 分门派',
  '',
  bySect,
  '',
]

rows.push(...summary)

const out = rows.join('\n')
writeFileSync('sect-fork-report.md', out, 'utf8')
console.log(summary.join('\n'))
console.log('\n已写入 sect-fork-report.md')
