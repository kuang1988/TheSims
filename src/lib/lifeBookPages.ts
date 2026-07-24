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
/** 目录页每页条数，避免单页过长 */
const TOC_ENTRIES_PER_PAGE = 14

function isClimaxEntry(l: LogEntry): boolean {
  return l.importance >= 4 || l.kind === 'death'
}

/** 将一生日志编成书页：封面 → 目录（与高潮页一一对应）→ 内页/插页 → 封底 */
export function buildLifeBookPages(
  logs: LogEntry[],
  character: Character,
  opts?: {
    seed?: number
    ending?: EndingReport | null
    originName?: string
  },
): BookPage[] {
  const ending = opts?.ending ?? null
  const content: BookPage[] = []

  let buf: LogEntry[] = []
  const flushSpread = () => {
    if (!buf.length) return
    const age = buf[0]?.age
    const title = buf.length === 1 ? buf[0].title : `${age}岁 · 数事`
    content.push({
      id: `spread-${content.length}-${age}-${buf[0]?.title}`,
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
      content.push({
        id: `death-${content.length}-${l.age}`,
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
      content.push({
        id: `climax-${content.length}-${l.age}-${l.title}`,
        kind: 'climax',
        title: l.title,
        age: l.age,
        entries: [l],
        artUrl: artUrlForLog(l, character),
      })
      continue
    }
    if (buf.length && (buf[0].age !== l.age || buf.length >= MAX_ENTRIES_PER_SPREAD)) {
      flushSpread()
    }
    buf.push(l)
  }
  flushSpread()

  // 目录与正文高潮页同源，避免漏录（含终局陨落）
  const climaxes = content
    .filter((p) => p.kind === 'climax')
    .map((p) => p.entries[0])
    .filter((e): e is LogEntry => !!e)

  const pages: BookPage[] = []
  pages.push({
    id: 'cover',
    kind: 'cover',
    title: '封面',
    entries: [],
    summary: `${character.name} · ${character.gender}${opts?.originName ? ` · ${opts.originName}` : ''}`,
  })

  if (!climaxes.length) {
    pages.push({
      id: 'toc',
      kind: 'toc',
      title: '目录',
      entries: [],
    })
  } else {
    const totalParts = Math.ceil(climaxes.length / TOC_ENTRIES_PER_PAGE)
    for (let i = 0; i < climaxes.length; i += TOC_ENTRIES_PER_PAGE) {
      const part = Math.floor(i / TOC_ENTRIES_PER_PAGE) + 1
      pages.push({
        id: `toc-${part}`,
        kind: 'toc',
        title: totalParts > 1 ? `目录 ${part}/${totalParts}` : '目录',
        entries: climaxes.slice(i, i + TOC_ENTRIES_PER_PAGE),
      })
    }
  }

  pages.push(...content)
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
  if (page.kind === 'toc') return page.title || '目录'
  if (page.kind === 'back') return '封底'
  if (page.age != null) return `第 ${index + 1} 页 · ${page.age}岁`
  return `第 ${index + 1} 页 / ${total}`
}

/** 目录跳转：按岁数+标题+正文/事件 id 定位高潮页，避免同名条目跳错 */
export function findClimaxPageIndex(pages: BookPage[], entry: LogEntry): number {
  // 优先 eventId 精确匹配
  if (entry.eventId) {
    const byId = pages.findIndex(
      (p) => p.kind === 'climax' && p.entries[0]?.eventId === entry.eventId,
    )
    if (byId >= 0) return byId
  }
  return pages.findIndex((p) => {
    if (p.kind !== 'climax') return false
    const e = p.entries[0]
    if (!e) return false
    if (e.age !== entry.age || e.title !== entry.title) return false
    return e.text === entry.text
  })
}
