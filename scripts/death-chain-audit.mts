/**
 * 陨落前后页断链自测：模拟 ≥100 局，检查人生书「陨落」前后各 3 页叙事是否合理。
 * 运行：npx --yes tsx scripts/death-chain-audit.mts
 * 报告：design/自测报告-陨落断链.md
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createBirth, LifeSimulator, buildEnding } from '../src/engine/simulator.ts'
import { buildLifeBookPages, type BookPage } from '../src/lib/lifeBookPages.ts'
import {
  deathIdentityMismatch,
  isPeacefulDeathReason,
  primaryDeathTag,
} from '../src/lib/deathTags.ts'
import type { LogEntry } from '../src/types.ts'

const RUNS = 200
const WINDOW = 3
const SEEDS = Array.from({ length: RUNS }, (_, i) => 92000 + i * 37)

type Issue = {
  seed: number
  code: string
  detail: string
  deathReason: string
  deathAge: number
  window: string
}

function pageSnippet(p: BookPage): string {
  const body = p.entries
    .map((e) => {
      const t = (e.text || '').replace(/\s+/g, ' ').trim()
      const short = t.length > 48 ? `${t.slice(0, 48)}…` : t
      return `「${e.title}」${short || '（空）'}`
    })
    .join(' / ')
  return `${p.age ?? '-'}岁·${p.kind}·${p.title}${body ? ` → ${body}` : ''}`
}

function isContentPage(p: BookPage): boolean {
  return p.kind === 'spread' || p.kind === 'climax'
}

function onlyChoiceText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  return /^你选择：.+/.test(t) && !/[。！？；]/.test(t.slice(t.indexOf('：') + 1))
}

/** 页内是否已有冲关/战斗/余波等结果文 */
function pageHasOutcome(p: BookPage): boolean {
  return p.entries.some(
    (e) =>
      !e.title.includes('·去向') &&
      (/突破|冲击|余波|境界|走火|经脉|冲突|人事|修炼|收功|逆乱|告破|心魔|命悬|险胜|惨败|两败|绝笔|大限/.test(
        e.title,
      ) ||
        /突破|冲击|走火|经脉|逆乱|收功|告破|心魔|惨败|险胜|两败|元气/.test(e.text || '')),
  )
}

function isRiskyChoiceText(text: string): boolean {
  return /冒险|硬闯|硬抗|渡劫|一搏|搏命|赌|血债|决战|拼命|以命|追杀|夺回/.test(text)
}

function windowPages(pages: BookPage[], deathIdx: number): BookPage[] {
  const content = pages.map((p, i) => ({ p, i })).filter((x) => isContentPage(x.p))
  const deathPos = content.findIndex((x) => x.i === deathIdx)
  if (deathPos < 0) return []
  const from = Math.max(0, deathPos - WINDOW)
  const to = Math.min(content.length - 1, deathPos + WINDOW)
  return content.slice(from, to + 1).map((x) => x.p)
}

function sameAgeLogs(logs: LogEntry[], age: number): LogEntry[] {
  return logs.filter((l) => l.age === age)
}

function detectIssues(
  seed: number,
  pages: BookPage[],
  logs: LogEntry[],
  deathReason: string,
  deathAge: number,
  flags: string[],
): Issue[] {
  const issues: Issue[] = []
  const deathIdx = pages.findIndex((p) => p.kind === 'climax' && p.entries[0]?.kind === 'death')
  if (deathIdx < 0) {
    issues.push({
      seed,
      code: 'NO_DEATH_PAGE',
      detail: '人生书无陨落页',
      deathReason,
      deathAge,
      window: '(无)',
    })
    return issues
  }

  const win = windowPages(pages, deathIdx)
  const winText = win.map(pageSnippet).join('\n  ')
  const before = win.filter((p) => !(p.entries[0]?.kind === 'death'))
  const deathPage = pages[deathIdx]!
  const peaceful = isPeacefulDeathReason(deathReason)
  const tag = primaryDeathTag(deathReason)

  const push = (code: string, detail: string) => {
    issues.push({ seed, code, detail, deathReason, deathAge, window: winText })
  }

  // 1) 仅有「你选择」的去向页，同页无结果、下一正文页直接陨落
  for (let wi = 0; wi < win.length; wi++) {
    const p = win[wi]!
    if (p.entries[0]?.kind === 'death') continue
    const onlyChoice =
      p.entries.length > 0 &&
      p.entries.every((e) => e.title.includes('·去向') && onlyChoiceText(e.text || ''))
    if (!onlyChoice || pageHasOutcome(p)) continue
    const next = win[wi + 1]
    const nextIsDeath = next?.entries[0]?.kind === 'death'
    const risky =
      p.entries.some((e) => isRiskyChoiceText(e.text || '')) ||
      p.entries.some((e) => /闭关|天劫|渡劫|突破|真气|弟子背叛|白刃/.test(e.title))
    if (nextIsDeath && risky) {
      push(
        'BLANK_CHOICE_PAGE',
        `去向页仅有选择文且无结果，下页直接陨落：「${p.entries[0]?.title}」→「${(p.entries[0]?.text || '').trim()}」`,
      )
    }
  }

  // 2) 同岁高风险叙事却善终（冒险冲关后体魄叙事崩了仍写成无疾；不含「冲关收功后寿终」）
  if (peaceful) {
    const yearLogs = sameAgeLogs(logs, deathAge)
    const brokeOk = yearLogs.some((l) => l.title === '境界突破' || /修为臻至/.test(l.text || ''))
    const riskLog = yearLogs.find((l) => {
      if (l.kind === 'death') return false
      if (/冲突·惨败|冲突·两败|天劫|渡劫/.test(l.title)) return true
      if (brokeOk) return false
      if (
        /闭关突破|真气逆乱|冲击瓶颈/.test(l.title) &&
        yearLogs.some((x) => /冒险|硬抗|硬闯/.test(x.text || '')) &&
        yearLogs.some(
          (x) =>
            x.kind !== 'event' &&
            /经脉尽|走火入魔|形神俱|元气尽|伤重不治|体魄崩/.test(x.text || ''),
        )
      ) {
        return true
      }
      return false
    })
    // 闭关冒险后同岁善终：排除「已境界突破成功」或「收功存活」
    const closedoorRisk =
      !brokeOk &&
      yearLogs.some((l) => /闭关突破|真气逆乱/.test(l.title)) &&
      yearLogs.some((x) => /冒险|硬抗|硬闯/.test(x.text || '')) &&
      !yearLogs.some(
        (x) =>
          x.title === '境界突破' ||
          /修为臻至|收功|无功，亦无劫|压下心火/.test(x.text || ''),
      )
    if (riskLog) {
      push(
        'RISK_THEN_PEACEFUL',
        `同岁「${riskLog.title}」含风险语境，死因却是善终「${deathReason}」（${tag}）`,
      )
    } else if (closedoorRisk && /坐化|无疾|寿终正寝|宗师善终|致仕归乡/.test(deathReason)) {
      push(
        'RISK_THEN_PEACEFUL',
        `同岁闭关/真气冒险硬闯后写成善终「${deathReason}」，且无收功/破境成功交代`,
      )
    }
  }

  // 3) 冒险类去向后同岁无结果文，直接陨落
  for (const cp of before) {
    const choice = cp.entries.find((e) => e.title.includes('·去向'))
    if (!choice) continue
    const age = cp.age ?? deathAge
    if (age !== deathAge) continue
    if (pageHasOutcome(cp)) continue
    const afterChoice = logs.filter((l) => l.age === age && l.kind !== 'death' && l !== choice)
    const hasOutcome = afterChoice.some(
      (l) =>
        /突破|冲击|余波|境界|走火|经脉|冲突|人事|修炼|收功|逆乱|告破|心魔|命悬/.test(l.title) ||
        /突破|冲击|走火|经脉|逆乱|收功|告破|心魔|惨败|险胜|两败/.test(l.text || ''),
    )
    const riskyChoice =
      isRiskyChoiceText(choice.text || '') ||
      /闭关|天劫|突破|渡劫|真气|弟子背叛|白刃/.test(choice.title)
    if (riskyChoice && !hasOutcome) {
      push(
        'CHOICE_NO_OUTCOME',
        `「${choice.title}」选择后同岁无结果文，直接陨落；选择文：${(choice.text || '').slice(0, 40)}`,
      )
    }
  }

  // 4) 劫伤烙印 vs 善终
  if (
    peaceful &&
    (flags.includes('heaven_failed') ||
      flags.includes('heaven_struck') ||
      flags.includes('qi_deviation') ||
      flags.includes('closedoor_risk'))
  ) {
    push('FLAG_PEACEFUL_MISMATCH', `烙印含劫伤/走火/闭关险，死因却为善终「${deathReason}」`)
  }

  // 5) 陨落页正文空
  const deathText = (deathPage.entries[0]?.text || '').trim()
  if (!deathText) {
    push('EMPTY_DEATH_TEXT', '陨落页无正文')
  }

  // 6) 同岁冲突惨败却善终
  if (
    peaceful &&
    sameAgeLogs(logs, deathAge).some((l) => l.title === '冲突·惨败' || l.title === '冲突·两败')
  ) {
    push('COMBAT_LOSS_PEACEFUL', `同岁冲突惨败/两败，却善终「${deathReason}」`)
  }

  // 7) 同岁弟子背叛且未胜出，死因却写成走镖/善终
  {
    const yearLogs = sameAgeLogs(logs, deathAge)
    const betrayEvt = yearLogs.some((l) => /弟子背叛|白刃相向/.test(l.title))
    const chased =
      yearLogs.some((l) => /追杀夺回|不还手/.test(l.text || '')) || flags.includes('betrayal_pursuit')
    const wonFight = yearLogs.some(
      (l) => l.title === '冲突·大胜' || /你赢了|大获全胜/.test(l.text || ''),
    )
    if (betrayEvt && chased && !wonFight) {
      const ok = /徒弟|背叛|门人|逆徒|师徒/.test(deathReason) || tag === '门人反噬'
      const wrong = /走镖|途中|坐化|无疾|寿终|致仕|田埂|债逼/.test(deathReason)
      if (!ok && wrong) {
        push(
          'BETRAYAL_WRONG_DEATH',
          `同岁弟子背叛/追杀且未胜出，死因却是「${deathReason}」（${tag}）`,
        )
      }
    }
  }

  return issues
}

const allIssues: Issue[] = []
const byCode = new Map<string, number>()
const samples: Issue[] = []
let peacefulN = 0
let violentN = 0

for (const seed of SEEDS) {
  const c = createBirth(seed)
  const sim = new LifeSimulator(c, seed ^ 0xabcdef, 'auto')
  for (let i = 0; i < 250; i++) {
    const r = sim.advanceYear()
    if (r.died) break
  }
  const ending = buildEnding(sim)
  const reason = (sim.deathReason || '未知').split('\n')[0]!.trim()
  const deathAge = ending.lifeLog.find((l) => l.kind === 'death')?.age ?? ending.character.age
  if (isPeacefulDeathReason(reason)) peacefulN += 1
  else violentN += 1

  const pages = buildLifeBookPages(ending.lifeLog, ending.character, {
    seed,
    ending,
  })
  const found = detectIssues(
    seed,
    pages,
    ending.lifeLog,
    reason,
    deathAge,
    ending.character.flags,
  )

  const idmm = deathIdentityMismatch(reason, ending.character)
  if (idmm) {
    const deathIdx = pages.findIndex((p) => p.entries[0]?.kind === 'death')
    const win = deathIdx >= 0 ? windowPages(pages, deathIdx) : []
    found.push({
      seed,
      code: 'IDENTITY_MISMATCH',
      detail: idmm,
      deathReason: reason,
      deathAge,
      window: win.map(pageSnippet).join('\n  '),
    })
  }

  for (const iss of found) {
    allIssues.push(iss)
    byCode.set(iss.code, (byCode.get(iss.code) ?? 0) + 1)
    if (samples.filter((s) => s.code === iss.code).length < 5) samples.push(iss)
  }
}

const uniqueRuns = new Set(allIssues.map((i) => i.seed)).size
const reportPath = join(dirname(fileURLToPath(import.meta.url)), '../design/自测报告-陨落断链.md')
mkdirSync(dirname(reportPath), { recursive: true })

const lines = [
  '# 自测报告 · 陨落前后页断链',
  '',
  `生成时间：${new Date().toISOString()}`,
  `局数：${RUNS}（种子 ${SEEDS[0]}…${SEEDS[SEEDS.length - 1]}，步长 37）`,
  `窗口：陨落页前后各 ${WINDOW} 个正文页（spread/climax）`,
  '',
  '## 总览',
  '',
  `- 善终局：${peacefulN}（${((peacefulN / RUNS) * 100).toFixed(1)}%）`,
  `- 非善终局：${violentN}（${((violentN / RUNS) * 100).toFixed(1)}%）`,
  `- 断链问题条数：${allIssues.length}`,
  `- 存在断链的局数：${uniqueRuns}（${((uniqueRuns / RUNS) * 100).toFixed(1)}%）`,
  `- 判定：${uniqueRuns === 0 ? '通过（未检出断链）' : '未通过（需修复）'}`,
  '',
  '## 修复说明（本轮）',
  '',
  '- 闭关硬闯打 `closedoor_risk`；寿元到顶时若仍有破境债，优先推迟至 `death_breakthrough` 或改写为走火，不再盖成坐化/无疾。',
  '- 「真气逆乱·硬抗」同样打上 `closedoor_risk`。',
  '- 已达目标境的闭关仍输出「冲击瓶颈」结果文，避免去向空白页。',
  '- 仅在**新获得** `broke_through_safe` 时清除走火债；避免已安全破境后清掉新的闭关硬闯烙印。',
  '- 「血债血偿」补结果文与急性 `revenge_pursuit`；永久 `avenged` 不再单独决定死因。',
  '- `closedoor_risk` / `revenge_pursuit` / `betrayal_pursuit` 跨岁自动卸掉；闭关硬闯扣体魄改为 -6。',
  '- 「弟子背叛·追杀夺回」补余波与 `betrayal_pursuit`；同段体魄归零优先「被徒弟背叛而死」，不再被陈年走镖烙印盖掉。',
  '- 「白刃相向·不还手」「魔焰滔天·决战」补结果文；真正境界突破成功时卸掉 `closedoor_risk`。',
  '',
  '## 附：与 `death-audit` 的关系',
  '',
  '断链自测关注「陨落前后页是否讲得通」。同期 `npm run death-audit` 在连贯项上通过（破境无债、同岁恶斗却善终等为 0），但精标「突破失败」仍可能偏高（含天劫余伤归入该桶），属死因分布再平衡，与断链修复正交。',
  '',
  '## 问题码分布',
  '',
  ...(byCode.size
    ? [...byCode.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, n]) => `- \`${code}\`：${n}`)
    : ['- （无）']),
  '',
  '### 问题码说明',
  '',
  '| 码 | 含义 |',
  '| --- | --- |',
  '| `BLANK_CHOICE_PAGE` | 冒险/追杀类去向页仅有「你选择」且下页直接陨落 |',
  '| `CHOICE_NO_OUTCOME` | 冒险/追杀类选择后同岁无结果文，直接陨落 |',
  '| `RISK_THEN_PEACEFUL` | 同岁冒险冲关/天劫/惨败后写成善终 |',
  '| `BETRAYAL_WRONG_DEATH` | 同岁弟子背叛/追杀却写成走镖/善终等 |',
  '| `COMBAT_LOSS_PEACEFUL` | 同岁冲突惨败却善终 |',
  '| `FLAG_PEACEFUL_MISMATCH` | 劫伤/走火烙印与善终矛盾 |',
  '| `IDENTITY_MISMATCH` | 身份硬校验失败 |',
  '| `EMPTY_DEATH_TEXT` | 陨落页无正文 |',
  '| `NO_DEATH_PAGE` | 无陨落页 |',
  '',
  '## 样本（每类最多 5 条）',
  '',
]

for (const iss of samples) {
  lines.push(`### 种子 ${iss.seed} · \`${iss.code}\``)
  lines.push('')
  lines.push(`- 终局：${iss.deathAge}岁 · ${iss.deathReason}`)
  lines.push(`- 详情：${iss.detail}`)
  lines.push('- 窗口页：')
  lines.push('  ```')
  lines.push(`  ${iss.window}`)
  lines.push('  ```')
  lines.push('')
}

if (!samples.length) {
  lines.push('（本批未检出断链样本）')
  lines.push('')
}

lines.push('## 方法')
lines.push('')
lines.push('1. `createBirth` + `LifeSimulator(..., auto)` 推进至多 250 年直至死亡。')
lines.push('2. `buildLifeBookPages` 生成与 UI 一致的人生书分页。')
lines.push('3. 定位 `kind=death` 的陨落 climax 页，取前后各 3 个正文页做规则检查。')
lines.push('4. 规则偏「玩家一眼能看出的断链」：空去向接陨落、冒险冲关→无疾等。')
lines.push('')

writeFileSync(reportPath, lines.join('\n'), 'utf8')
console.log(lines.join('\n'))
console.log(`\n[death-chain-audit] 报告已写：${reportPath}`)
if (uniqueRuns > 0) {
  console.error(`\n[death-chain-audit] 未通过：${uniqueRuns}/${RUNS} 局存在断链`)
  process.exitCode = 1
} else {
  console.log('\n[death-chain-audit] 通过：未检出断链')
}
