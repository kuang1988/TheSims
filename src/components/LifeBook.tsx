import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Character, EndingReport, LogEntry } from '../types'
import { endingDeathUrl, portraitUrl } from '../lib/assetResolve'
import { primaryDeathTag } from '../lib/deathTags'
import {
  buildLifeBookPages,
  findClimaxPageIndex,
  pageLabel,
  type BookPage,
} from '../lib/lifeBookPages'

function displayName(c: Character) {
  return c.name
}

const FLIP_MS = 480

export function LifeBook({
  logs,
  character,
  seed,
  ending,
  originName,
  mode = 'reading',
  realisticFlip = true,
  onShare,
  footer,
  onBack,
}: {
  logs: LogEntry[]
  character: Character
  seed?: number
  ending?: EndingReport | null
  originName?: string
  /** reading：可翻全书；live：推演中跟到最新页 */
  mode?: 'reading' | 'live'
  /** 仿真 3D 翻页；系统减弱动效时自动降级 */
  realisticFlip?: boolean
  onShare?: () => void
  footer?: ReactNode
  onBack?: () => void
}) {
  const pages = useMemo(
    () => buildLifeBookPages(logs, character, { seed, ending, originName }),
    [logs, character, seed, ending, originName],
  )
  const [index, setIndex] = useState(0)
  const [flip, setFlip] = useState<'idle' | 'next' | 'prev'>('idle')
  const locking = useRef(false)
  const indexRef = useRef(0)
  const lastIndexRef = useRef(0)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const use3d = realisticFlip && !reduceMotion && mode === 'reading'
  const lastIndex = Math.max(0, pages.length - 1)
  indexRef.current = index
  lastIndexRef.current = lastIndex

  useEffect(() => {
    if (mode !== 'live') return
    const lastContent = Math.max(0, pages.length - 2)
    // 仅在跟读末尾时自动跟页，避免打断回翻
    setIndex((cur) => (cur >= lastContent - 1 ? lastContent : cur))
  }, [logs.length, mode, pages.length])

  const go = (delta: number) => {
    if (locking.current) return
    const cur = indexRef.current
    const next = Math.min(lastIndexRef.current, Math.max(0, cur + delta))
    if (next === cur) return
    locking.current = true
    setFlip(delta > 0 ? 'next' : 'prev')
    const delay = use3d ? FLIP_MS : 220
    window.setTimeout(() => {
      indexRef.current = next
      setIndex(next)
      setFlip('idle')
      locking.current = false
    }, delay)
  }

  /** 目录 / 首页 / 末页：直接跳转 */
  const jumpTo = (target: number) => {
    if (locking.current) return
    const next = Math.min(lastIndexRef.current, Math.max(0, target))
    if (next === indexRef.current) return
    setFlip('idle')
    indexRef.current = next
    setIndex(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Home') jumpTo(0)
      if (e.key === 'End') jumpTo(lastIndexRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const page = pages[index] ?? pages[0]
  if (!page) return null

  const deathArt = ending ? endingDeathUrl(ending.deathReason, ending.character) : null
  const outgoing = flip !== 'idle' ? page : null
  const incoming =
    flip === 'next'
      ? pages[Math.min(lastIndex, index + 1)]
      : flip === 'prev'
        ? pages[Math.max(0, index - 1)]
        : null

  const jumpFromToc = (entry: LogEntry) => {
    const i = findClimaxPageIndex(pages, entry)
    if (i >= 0) jumpTo(i)
  }

  return (
    <div
      className={`life-book${use3d ? ' life-book--realistic' : ''}${flip !== 'idle' ? ` life-book--flip-${flip}` : ''}`}
    >
      <div className="life-book__spine" aria-hidden />
      <div className="life-book__stage">
        {use3d && flip !== 'idle' && outgoing && incoming ? (
          <>
            <div className={`life-book__leaf life-book__leaf--under`}>
              <BookSheet
                page={incoming}
                index={flip === 'next' ? index + 1 : index - 1}
                total={pages.length}
                character={character}
                seed={seed}
                originName={originName}
                ending={ending}
                deathArt={deathArt}
                onShare={onShare}
                onJump={() => undefined}
              />
            </div>
            <div
              className={`life-book__leaf life-book__leaf--flip life-book__leaf--flip-${flip}`}
              style={{ animationDuration: `${FLIP_MS}ms` }}
            >
              <BookSheet
                page={outgoing}
                index={index}
                total={pages.length}
                character={character}
                seed={seed}
                originName={originName}
                ending={ending}
                deathArt={deathArt}
                onShare={onShare}
                onJump={() => undefined}
              />
            </div>
          </>
        ) : (
          <div className="life-book__leaf">
            <BookSheet
              page={page}
              index={index}
              total={pages.length}
              character={character}
              seed={seed}
              originName={originName}
              ending={ending}
              deathArt={deathArt}
              onShare={onShare}
              onJump={jumpFromToc}
            />
          </div>
        )}
      </div>

      <nav className="life-book__nav">
        {onBack && (
          <button type="button" className="btn tiny" onClick={onBack}>
            返回书架
          </button>
        )}
        <button
          type="button"
          className="btn tiny"
          disabled={index <= 0 || flip !== 'idle'}
          onClick={() => jumpTo(0)}
        >
          首页
        </button>
        <button type="button" className="btn tiny" disabled={index <= 0 || flip !== 'idle'} onClick={() => go(-1)}>
          上一页
        </button>
        <span className="life-book__pager">
          {index + 1} / {pages.length}
        </span>
        <button
          type="button"
          className="btn tiny"
          disabled={index >= lastIndex || flip !== 'idle'}
          onClick={() => go(1)}
        >
          下一页
        </button>
        <button
          type="button"
          className="btn tiny"
          disabled={index >= lastIndex || flip !== 'idle'}
          onClick={() => jumpTo(lastIndex)}
        >
          末页
        </button>
      </nav>
      {footer}
    </div>
  )
}

function BookSheet({
  page,
  index,
  total,
  character,
  seed,
  originName,
  ending,
  deathArt,
  onShare,
  onJump,
}: {
  page: BookPage
  index: number
  total: number
  character: Character
  seed?: number
  originName?: string
  ending?: EndingReport | null
  deathArt: string | null
  onShare?: () => void
  onJump: (entry: LogEntry) => void
}) {
  return (
    <div className="life-book__sheet">
      <header className="life-book__head">
        <span className="life-book__eyebrow">一生一书</span>
        <strong>{pageLabel(page, index, total)}</strong>
      </header>
      <div className="life-book__body">
        {page.kind === 'cover' && (
          <CoverPage
            character={character}
            seed={seed}
            originName={originName}
            summary={page.summary}
            ending={ending}
          />
        )}
        {page.kind === 'toc' && (
          <TocPage entries={page.entries} pageTitle={page.title} onJump={onJump} />
        )}
        {(page.kind === 'spread' || page.kind === 'climax') && <SpreadPage page={page} />}
        {page.kind === 'back' && (
          <BackPage ending={ending} deathArt={deathArt} onShare={onShare} />
        )}
      </div>
    </div>
  )
}

function CoverPage({
  character,
  seed,
  originName,
  summary,
  ending,
}: {
  character: Character
  seed?: number
  originName?: string
  summary?: string
  ending?: EndingReport | null
}) {
  const deathTag = ending ? primaryDeathTag(ending.deathReason, ending.character) : null
  return (
    <div className={`book-cover${ending ? ' book-cover--ended' : ''}`}>
      <div className="book-cover__visual">
        <img
          className="book-cover__portrait"
          src={portraitUrl(character)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        {ending && deathTag && (
          <div className="book-cover__ending-badge">
            <span className="book-cover__ending-age">{ending.finalAge}岁</span>
            <strong>{deathTag}</strong>
            <span>
              {ending.mainline} · {ending.deathReason}
            </span>
          </div>
        )}
      </div>
      <h2 className="book-cover__title">{displayName(character)}</h2>
      {ending ? (
        <>
          <p className="book-cover__ending-line">
            {ending.finalAge}岁 · {ending.mainline} · {deathTag}
          </p>
          <p className="book-cover__who">
            {ending.character.name} · 享年{ending.finalAge}岁 · 评分 {ending.score}
          </p>
          <p className="book-cover__summary">{ending.summary}</p>
          <p className="muted">翻开此生，回望终局。</p>
        </>
      ) : (
        <>
          <p className="book-cover__meta">
            {character.gender}
            {originName ? ` · ${originName}` : ''}
            {seed != null ? ` · 种子 ${seed}` : ''}
          </p>
          <p className="book-cover__lead">{summary}</p>
          <p className="muted">揭开这一生 —— 用左右翻页阅读岁月。</p>
        </>
      )}
    </div>
  )
}

function TocPage({
  entries,
  onJump,
  pageTitle,
}: {
  entries: LogEntry[]
  onJump: (entry: LogEntry) => void
  pageTitle?: string
}) {
  if (!entries.length) {
    return <p className="muted">高潮尚未落墨，目录暂空。</p>
  }
  return (
    <div className="book-toc">
      <h3>{pageTitle && pageTitle !== '目录' ? pageTitle : '高潮目录'}</h3>
      <ul>
        {entries.map((e, i) => (
          <li key={`${e.age}-${e.title}-${i}`}>
            <button type="button" className="book-toc__link" onClick={() => onJump(e)}>
              {e.age}岁 · {e.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SpreadPage({ page }: { page: BookPage }) {
  const isDeath = page.entries.some((e) => e.kind === 'death')
  return (
    <article
      className={`book-spread book-spread--${page.kind}${isDeath ? ' book-spread--death' : ''}`}
    >
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
  ending,
  deathArt,
  onShare,
}: {
  ending?: EndingReport | null
  deathArt: string | null
  onShare?: () => void
}) {
  if (!ending) {
    return (
      <div className="book-back">
        <p className="muted">人生未终，封底留白。</p>
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
      <p className="death-tag">{tag}</p>
      <h3>{ending.deathReason}</h3>
      <p className="book-back__who">
        {ending.character.name} · 享年{ending.finalAge}岁 · 评分 {ending.score}
      </p>
      {onShare && (
        <button type="button" className="btn tiny" onClick={onShare}>
          下载分享图
        </button>
      )}
    </div>
  )
}
