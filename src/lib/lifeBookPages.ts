import type { Character, EndingReport, LogEntry } from '../types'
import { artUrlForLog } from './assetResolve'

export type BookPageKind = 'cover' | 'toc' | 'spread' | 'climax' | 'back'

export interface BookPage {
  id: string
  kind: BookPageKind
  /** 页眉短题 */
  title: string
  /** 主要岁数（正文页） */
  age?: number
  /** 页内日志 */
  entries: LogEntry[]
  /** 插图 URL */
  artUrl?: string | null
  /** 封底用摘要 */
  summary?: string
}

const MAX_ENTRIES_PER_SPREAD = 3

function isClimaxEntry(l: LogEntry): boolean {
  return l.importance >= 4 || l.kind === 'death'
}

/** 将一生日志编成书页：封面 → 目录 → 内页/插页 → 封底 */
export function buildLifeBookPages(
  logs: LogEntry[],
  character: Character,
  opts?: {
    seed?: number
    ending?: EndingReport | null
    originName?: string
  },
): BookPage[] {
  const pages: BookPage[] = []
  const ending = opts?.ending ?? null

  pages.push({
    id: 'cover',
    kind: 'cover',
    title: '封面',
    entries: [],
    summary: `${character.name} · ${character.gender}${opts?.originName ? ` · ${opts.originName}` : ''}`,
  })

  const climaxes = logs.filter((l) => l.importance >= 4 && l.kind !== 'death').slice(0, 8)
  pages.push({
    id: 'toc',
    kind: 'toc',
    title: '目录',
    entries: climaxes,
  })

  let buf: LogEntry[] = []
  const flushSpread = () => {
    if (!buf.length) return
    const age = buf[0]?.age
    const title = buf.length === 1 ? buf[0].title : `${age}岁 · 数事`
    pages.push({
      id: `spread-${pages.length}-${age}-${buf[0]?.title}`,
      kind: 'spread',
      title,
      age,
      entries: [...buf],
      artUrl: artUrlForLog(buf[0], character),
    })
    buf = []
  }

  for (const l of logs) {
    if (l.kind === 'death') {
      flushSpread()
      pages.push({
        id: `death-${l.age}`,
        kind: 'climax',
        title: l.title,
        age: l.age,
        entries: [l],
        artUrl: artUrlForLog(l, character),
      })
      continue
    }
    if (isClimaxEntry(l)) {
      flushSpread()
      pages.push({
        id: `climax-${l.age}-${l.title}`,
        kind: 'climax',
        title: l.title,
        age: l.age,
        entries: [l],
        artUrl: artUrlForLog(l, character),
      })
      continue
    }
    // 同岁可合并；跨岁或满页则翻篇
    if (buf.length && (buf[0].age !== l.age || buf.length >= MAX_ENTRIES_PER_SPREAD)) {
      flushSpread()
    }
    buf.push(l)
  }
  flushSpread()

  pages.push({
    id: 'back',
    kind: 'back',
    title: '封底',
    entries: [],
    summary: ending?.summary ?? `${character.name} 的这一生，尚未写完封底。`,
    artUrl: ending ? undefined : null,
  })

  return pages
}

export function pageLabel(page: BookPage, index: number, total: number): string {
  if (page.kind === 'cover') return '封面'
  if (page.kind === 'toc') return '目录'
  if (page.kind === 'back') return '封底'
  if (page.age != null) return `第 ${index + 1} 页 · ${page.age}岁`
  return `第 ${index + 1} 页 / ${total}`
}
