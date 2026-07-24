/**
 * 事件池盘点。运行：npm run event-census
 */
import { writeFileSync } from 'fs'
import { EVENTS } from '../src/data/events.ts'

const BASELINE = 309

const byImp: Record<string, number> = {}
const byChain: Record<string, number> = {}
const byStage: Record<string, number> = {}
const byTag: Record<string, number> = {}
let once = 0
let needsChoice = 0

for (const e of EVENTS) {
  byImp[String(e.importance)] = (byImp[String(e.importance)] ?? 0) + 1
  const chain = e.chain ?? '(none)'
  byChain[chain] = (byChain[chain] ?? 0) + 1
  if (e.once) once += 1
  if (e.needsChoice) needsChoice += 1
  for (const s of e.stages) byStage[s] = (byStage[s] ?? 0) + 1
  for (const t of e.tags) byTag[t] = (byTag[t] ?? 0) + 1
}

const sortEntries = (m: Record<string, number>) =>
  Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))

const lines = [
  '# 事件盘点报告（Phase 12）',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  '## 汇总',
  `- 事件总数：${EVENTS.length}（基线 ${BASELINE}，净增 ${EVENTS.length - BASELINE}，目标 ≥${BASELINE + 50}）`,
  `- needsChoice：${needsChoice}`,
  `- once：${once}`,
  '',
  '## importance',
  ...sortEntries(byImp).map(([k, v]) => `- ${k}：${v}`),
  '',
  '## chain',
  ...sortEntries(byChain).map(([k, v]) => `- ${k}：${v}`),
  '',
  '## stages（可重复计）',
  ...sortEntries(byStage).map(([k, v]) => `- ${k}：${v}`),
  '',
  '## tags Top 25',
  ...sortEntries(byTag)
    .slice(0, 25)
    .map(([k, v]) => `- ${k}：${v}`),
  '',
]

const report = lines.join('\n')
writeFileSync('event-census-report.md', report, 'utf8')
console.log(report)
console.log('\n已写入 event-census-report.md')

if (EVENTS.length < BASELINE + 50) {
  console.error(`[event-census] 未达 +50 门槛：当前 ${EVENTS.length} < ${BASELINE + 50}`)
  process.exitCode = 1
}
