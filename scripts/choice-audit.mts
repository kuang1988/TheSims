/**
 * 审计 importance≥3 且无命运钩子的抉择。
 * 运行：npx tsx scripts/choice-audit.mts
 */
import { writeFileSync } from 'fs'
import { EVENTS } from '../src/data/events.ts'

function hasFateHook(fx: Record<string, unknown> | undefined): boolean {
  if (!fx) return false
  return !!(
    fx.addFlag ||
    fx.addFlags ||
    fx.removeFlag ||
    fx.removeFlags ||
    fx.queueEvent ||
    fx.queueEvents ||
    fx.grantTitle ||
    fx.setPrimaryTitle ||
    fx.combat ||
    fx.setRelation ||
    fx.addMartialArt ||
    fx.upgradeMartialArt ||
    fx.setRealm ||
    fx.demoteRealm ||
    fx.death ||
    fx.logExtra
  )
}

const air: { id: string; name: string; text: string; importance: number }[] = []
for (const e of EVENTS) {
  if (e.importance < 3) continue
  for (const ch of e.choices) {
    if (!hasFateHook(ch.effects as Record<string, unknown>)) {
      air.push({
        id: e.id,
        name: e.name,
        text: ch.text,
        importance: e.importance,
      })
    }
  }
}

const lines = [
  '# 空气抉择审计',
  '',
  `生成：${new Date().toISOString()}`,
  `importance≥3 且无命运钩子：${air.length}`,
  '',
  ...air.map((a) => `- [${a.importance}] ${a.id}「${a.name}」· ${a.text}`),
  '',
]
writeFileSync('choice-audit-report.md', lines.join('\n'), 'utf8')
console.log(`空气抉择 ${air.length} 条 → choice-audit-report.md`)
if (air.length) {
  console.log(air.slice(0, 25).map((a) => `${a.id}: ${a.text}`).join('\n'))
}
