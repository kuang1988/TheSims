import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Character, EndingReport, LogEntry } from '../types'
import { endingDeathUrl, portraitUrl } from '../lib/assetResolve'
import { primaryDeathTag } from '../lib/deathTags'
import { buildLifeBookPages, pageLabel, type BookPage } from '../lib/lifeBookPages'

function displayName(c: Character) {
  return c.primaryTitleId ? `${c.name}` : c.name
}

export function LifeBook({
  logs,
  character,
  seed,
  ending,
  originName,
  mode = 'reading',
  onShare,
  footer,
}: {
  logs: LogEntry[]
  character: Character
  seed?: number
  ending?: EndingReport | null
  originName?: string
  /** reading：可翻全书；live：推演中跟到最新页 */
  mode?: 'reading' | 'live'
  onShare?: () => void
  footer?: ReactNode
}) {
  const pages = useMemo(
    () => buildLifeBookPages(logs, character, { seed, ending, originName }),
    [logs, character, seed, ending, originName],
  )
  const [index, setIndex] = useState(0)
  const [flip, setFlip] = useState<'idle' | 'next' | 'prev'>('idle')

  // 局中跟读：日志增长时跳到倒数第二页（封底前）或最后内容页
  useEffect(() => {
    if (mode !== 'live') return
    const lastContent = Math.max(0, pages.length - 2)
    setIndex(lastContent)
  }, [logs.length, mode, pages.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setFlip('next')
        setIndex((i) => Math.min(pages.length - 1, i + 1))
        window.setTimeout(() => setFlip('idle'), 280)
      }
      if (e.key === 'ArrowLeft') {
        setFlip('prev')
        setIndex((i) => Math.max(0, i - 1))
        window.setTimeout(() => setFlip('idle'), 280)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages.length])

  const go = (delta: number) => {
    setFlip(delta > 0 ? 'next' : 'prev')
    setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + delta)))
    window.setTimeout(() => setFlip('idle'), 280)
  }

  const page = pages[index] ?? pages[0]
  if (!page) return null

  const deathArt = ending ? endingDeathUrl(ending.deathReason, ending.character) : null

  return (
    <div className={`life-book${flip !== 'idle' ? ` life-book--flip-${flip}` : ''}`}>
      <div className="life-book__spine" aria-hidden />
      <div className="life-book__sheet">
        <header className="life-book__head">
          <span className="life-book__eyebrow">一生一书</span>
          <strong>{pageLabel(page, index, pages.length)}</strong>
        </header>

        <div className="life-book__body">
          {page.kind === 'cover' && (
            <CoverPage character={character} seed={seed} originName={originName} summary={page.summary} />
          )}
          {page.kind === 'toc' && <TocPage entries={page.entries} onJump={(title) => {
            const i = pages.findIndex((p) => p.kind === 'climax' && p.title === title)
            if (i >= 0) setIndex(i)
          }} />}
          {(page.kind === 'spread' || page.kind === 'climax') && (
            <SpreadPage page={page} character={character} />
          )}
          {page.kind === 'back' && (
            <BackPage
              character={character}
              ending={ending}
              deathArt={deathArt}
              summary={page.summary}
              onShare={onShare}
            />
          )}
        </div>

        <nav className="life-book__nav">
          <button type="button" className="btn tiny" disabled={index <= 0} onClick={() => go(-1)}>
            上一页
          </button>
          <span className="life-book__pager">
            {index + 1} / {pages.length}
          </span>
          <button
            type="button"
            className="btn tiny"
            disabled={index >= pages.length - 1}
            onClick={() => go(1)}
          >
            下一页
          </button>
        </nav>
        {footer}
      </div>
    </div>
  )
}

function CoverPage({
  character,
  seed,
  originName,
  summary,
}: {
  character: Character
  seed?: number
  originName?: string
  summary?: string
}) {
  return (
    <div className="book-cover">
      <img
        className="book-cover__portrait"
        src={portraitUrl(character)}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      <h2 className="book-cover__title">{displayName(character)}</h2>
      <p className="book-cover__meta">
        {character.gender}
        {originName ? ` · ${originName}` : ''}
        {seed != null ? ` · 种子 ${seed}` : ''}
      </p>
      <p className="book-cover__lead">{summary}</p>
      <p className="muted">揭开这一生 —— 用左右翻页阅读岁月。</p>
    </div>
  )
}

function TocPage({
  entries,
  onJump,
}: {
  entries: LogEntry[]
  onJump: (title: string) => void
}) {
  if (!entries.length) {
    return <p className="muted">高潮尚未落墨，目录暂空。</p>
  }
  return (
    <div className="book-toc">
      <h3>高潮目录</h3>
      <ul>
        {entries.map((e) => (
          <li key={`${e.age}-${e.title}`}>
            <button type="button" className="book-toc__link" onClick={() => onJump(e.title)}>
              {e.age}岁 · {e.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SpreadPage({ page, character }: { page: BookPage; character: Character }) {
  void character
  return (
    <article className={`book-spread book-spread--${page.kind}`}>
      <h3>
        {page.age != null ? `${page.age}岁 · ` : ''}
        {page.title}
      </h3>
      {page.artUrl && (
        <img
          className="book-spread__art"
          src={page.artUrl}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      {page.entries.map((l, i) => (
        <div key={`${l.age}-${i}-${l.title}`} className={`book-entry imp-${l.importance}`}>
          {page.entries.length > 1 && <strong>{l.title}</strong>}
          <p>{l.text}</p>
        </div>
      ))}
    </article>
  )
}

function BackPage({
  character,
  ending,
  deathArt,
  summary,
  onShare,
}: {
  character: Character
  ending?: EndingReport | null
  deathArt: string | null
  summary?: string
  onShare?: () => void
}) {
  if (!ending) {
    return (
      <div className="book-back">
        <p className="muted">人生未终，封底留白。</p>
        <img
          className="book-back__portrait"
          src={portraitUrl(character)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>
    )
  }
  const tag = primaryDeathTag(ending.deathReason, ending.character)
  return (
    <div className="book-back">
      {deathArt && (
        <img
          className="book-back__death"
          src={deathArt}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <img
        className="book-back__portrait"
        src={portraitUrl(ending.character)}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      <p className="death-tag">{tag}</p>
      <h3>{ending.deathReason}</h3>
      <p className="book-back__who">
        {ending.character.name} · 享年{ending.finalAge}岁 · 评分 {ending.score}
      </p>
      <p className="book-back__summary">{summary ?? ending.summary}</p>
      {onShare && (
        <button type="button" className="btn tiny" onClick={onShare}>
          下载分享图
        </button>
      )}
    </div>
  )
}
