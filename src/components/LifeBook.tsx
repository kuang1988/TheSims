import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { Character, EndingReport, LogEntry } from '../types'
import { endingDeathUrl, portraitUrl } from '../lib/assetResolve'
import { primaryDeathTag } from '../lib/deathTags'
import {
  buildLifeBookPages,
  findClimaxPageIndex,
  pageLabel,
  type BookPage,
} from '../lib/lifeBookPages'
import { dragFlipIntent, edgeFlipIntent } from '../lib/bookFlip'
import { playPageFlipSound } from '../lib/bookSound'
import {
  clampFontSize,
  clampLineHeight,
  loadReaderPrefs,
  marginPadRem,
  patchReaderPrefs,
  THEME_LABELS,
  type ReaderPrefs,
  type ReaderTheme,
} from '../lib/readerPrefs'
import { BookProfilePage } from './BookProfilePage'

function displayName(c: Character) {
  return c.name
}

const FLIP_MS = 450
const CHROME_HIDE_MS = 2200

export function LifeBook({
  logs,
  character,
  seed,
  ending,
  originName,
  mode = 'reading',
  realisticFlip = true,
  startClosed = false,
  initialPage = 0,
  focusEventId,
  focusAge,
  onShare,
  footer,
  onBack,
  onProgress,
  onOpened,
  onReachedEnd,
  onToggleBookmark,
}: {
  logs: LogEntry[]
  character: Character
  seed?: number
  ending?: EndingReport | null
  originName?: string
  mode?: 'reading' | 'live'
  realisticFlip?: boolean
  /** 先显示合着的封面，点揭开再进翻页 */
  startClosed?: boolean
  initialPage?: number
  /** 半自动抉择时跳到对应高潮页，避免书还停在幼年、选项已是江湖事 */
  focusEventId?: string | null
  focusAge?: number | null
  onShare?: () => void
  footer?: ReactNode
  onBack?: () => void
  onProgress?: (pageIndex: number) => void
  onOpened?: () => void
  /** 到达封底时回调（用于标记已读） */
  onReachedEnd?: () => void
  onToggleBookmark?: (pageIndex: number, on: boolean) => void
}) {
  const pages = useMemo(
    () => buildLifeBookPages(logs, character, { seed, ending, originName }),
    [logs, character, seed, ending, originName],
  )
  const lastIndex = Math.max(0, pages.length - 1)
  const startPage = Math.min(lastIndex, Math.max(0, initialPage))

  const [shell, setShell] = useState<'closed' | 'open'>(() =>
    startClosed && mode === 'reading' && startPage === 0 ? 'closed' : 'open',
  )
  const [index, setIndex] = useState(startPage)
  const [flip, setFlip] = useState<'idle' | 'next' | 'prev'>('idle')
  const [dragX, setDragX] = useState(0)
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadReaderPrefs())
  const [chromeVisible, setChromeVisible] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  const locking = useRef(false)
  const indexRef = useRef(index)
  const lastIndexRef = useRef(lastIndex)
  const shellRef = useRef(shell)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const suppressClick = useRef(false)
  const chromeTimer = useRef<number | null>(null)

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  /** 阅读器固定单页，避免对开窄页页眉叠字 */
  const use3d =
    realisticFlip &&
    prefs.flipAnimation &&
    !reduceMotion &&
    mode === 'reading' &&
    shell === 'open'

  indexRef.current = index
  lastIndexRef.current = lastIndex
  shellRef.current = shell

  const tocEntries = useMemo(() => {
    const list: LogEntry[] = []
    for (const p of pages) {
      if (p.kind === 'toc') list.push(...p.entries)
    }
    return list
  }, [pages])

  const profilePages = useMemo(
    () => pages.map((p, i) => ({ page: p, index: i })).filter((x) => x.page.kind === 'profile'),
    [pages],
  )
  const firstTocIndex = useMemo(() => pages.findIndex((p) => p.kind === 'toc'), [pages])
  const coverIndex = useMemo(() => pages.findIndex((p) => p.kind === 'cover'), [pages])
  const frontMatter = useMemo(() => {
    const links: { label: string; index: number }[] = []
    if (coverIndex >= 0) links.push({ label: '封面', index: coverIndex })
    for (const { page, index: pi } of profilePages) {
      links.push({ label: page.title, index: pi })
    }
    return links
  }, [coverIndex, profilePages])

  const bumpPrefs = (patch: Partial<ReaderPrefs>) => {
    setPrefs(patchReaderPrefs(patch))
  }

  const clearChromeTimer = () => {
    if (chromeTimer.current != null) {
      window.clearTimeout(chromeTimer.current)
      chromeTimer.current = null
    }
  }

  const scheduleChromeHide = () => {
    clearChromeTimer()
    if (reduceMotion || catalogOpen || settingsOpen) return
    chromeTimer.current = window.setTimeout(() => {
      setChromeVisible(false)
      chromeTimer.current = null
    }, CHROME_HIDE_MS)
  }

  const showChrome = (sticky = false) => {
    setChromeVisible(true)
    if (!sticky) scheduleChromeHide()
    else clearChromeTimer()
  }

  const toggleChrome = () => {
    setChromeVisible((v) => {
      const next = !v
      if (next) scheduleChromeHide()
      else clearChromeTimer()
      return next
    })
  }

  useEffect(() => {
    if (mode !== 'live') return
    const lastContent = Math.max(0, pages.length - 2)
    setIndex((cur) => (cur >= lastContent - 1 ? lastContent : cur))
  }, [logs.length, mode, pages.length])

  useEffect(() => {
    if (mode !== 'live' || (!focusEventId && focusAge == null)) return
    let target = -1
    if (focusEventId) {
      const stub = logs.find((l) => l.eventId === focusEventId)
      if (stub) target = findClimaxPageIndex(pages, stub)
      if (target < 0) {
        target = pages.findIndex(
          (p) => p.kind === 'climax' && p.entries[0]?.eventId === focusEventId,
        )
      }
    }
    if (target < 0 && focusAge != null) {
      for (let i = pages.length - 1; i >= 0; i--) {
        const p = pages[i]!
        if ((p.kind === 'climax' || p.kind === 'spread') && p.age === focusAge) {
          target = i
          break
        }
      }
    }
    if (target >= 0) {
      setShell('open')
      setIndex(target)
    }
  }, [focusEventId, focusAge, mode, pages, logs])

  useEffect(() => {
    onProgress?.(index)
  }, [index, onProgress])

  const reachedEndRef = useRef(false)
  useEffect(() => {
    if (pages[index]?.kind !== 'back' || reachedEndRef.current) return
    reachedEndRef.current = true
    onReachedEnd?.()
  }, [index, pages, onReachedEnd])

  useEffect(() => {
    if (catalogOpen || settingsOpen) {
      setChromeVisible(true)
      clearChromeTimer()
      return
    }
    if (chromeVisible && !reduceMotion) scheduleChromeHide()
    return () => clearChromeTimer()
  }, [catalogOpen, settingsOpen])

  useEffect(() => () => clearChromeTimer(), [])

  const playFlip = () => {
    if (prefs.sound && !reduceMotion) playPageFlipSound()
  }

  const go = (delta: number) => {
    if (shellRef.current !== 'open' || locking.current) return
    const cur = indexRef.current
    const next = Math.min(lastIndexRef.current, Math.max(0, cur + delta))
    if (next === cur) return
    locking.current = true
    setDragX(0)
    setFlip(delta > 0 ? 'next' : 'prev')
    playFlip()
    const delay = use3d ? FLIP_MS : 200
    window.setTimeout(() => {
      indexRef.current = next
      setIndex(next)
      setFlip('idle')
      locking.current = false
    }, delay)
  }

  const jumpTo = (target: number) => {
    if (shellRef.current !== 'open' || locking.current) return
    const next = Math.min(lastIndexRef.current, Math.max(0, target))
    if (next === indexRef.current) return
    setFlip('idle')
    setDragX(0)
    indexRef.current = next
    setIndex(next)
  }

  const openBook = (toPage?: number) => {
    setShell('open')
    onOpened?.()
    showChrome()
    if (toPage != null) {
      const p = Math.min(lastIndexRef.current, Math.max(0, toPage))
      indexRef.current = p
      setIndex(p)
    }
  }

  const closeBook = () => {
    setCatalogOpen(false)
    setSettingsOpen(false)
    if (onBack) {
      setShell('closed')
      window.setTimeout(() => onBack(), reduceMotion ? 0 : 280)
      return
    }
    setShell('closed')
    jumpTo(0)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shellRef.current === 'closed') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openBook()
        }
        return
      }
      if (e.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false)
          return
        }
        if (catalogOpen) {
          setCatalogOpen(false)
          return
        }
      }
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Home') jumpTo(0)
      if (e.key === 'End') jumpTo(lastIndexRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const deathArt = ending ? endingDeathUrl(ending.deathReason, ending.character) : null
  const page = pages[index] ?? pages[0]

  const jumpFromToc = (entry: LogEntry) => {
    const i = findClimaxPageIndex(pages, entry)
    if (i >= 0) {
      jumpTo(i)
      setCatalogOpen(false)
    }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (shell !== 'open' || locking.current || reduceMotion) return
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, .reader-chrome, .reader-drawer, .reader-settings'))
      return
    dragOrigin.current = { x: e.clientX, y: e.clientY }
    setDragX(0)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragOrigin.current) return
    const dx = e.clientX - dragOrigin.current.x
    setDragX(Math.max(-140, Math.min(140, dx)))
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!dragOrigin.current) return
    const dx = e.clientX - dragOrigin.current.x
    const dy = e.clientY - dragOrigin.current.y
    dragOrigin.current = null
    const intent = dragFlipIntent(dx)
    if (intent && Math.abs(dx) > Math.abs(dy)) {
      suppressClick.current = true
      go(intent === 'next' ? 1 : -1)
      return
    }
    setDragX(0)
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (shell !== 'open' || locking.current) return
    if (
      (e.target as HTMLElement).closest(
        'button, a, input, select, textarea, .reader-chrome, .reader-drawer, .reader-settings',
      )
    )
      return
    const el = stageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const intent = edgeFlipIntent(e.clientX, rect.left, rect.width)
    if (intent === 'next') {
      go(1)
      return
    }
    if (intent === 'prev') {
      go(-1)
      return
    }
    // 中带：显隐阅读壳
    if (catalogOpen || settingsOpen) {
      setCatalogOpen(false)
      setSettingsOpen(false)
      return
    }
    toggleChrome()
  }

  if (!page) return null

  const readerStyle = {
    '--reader-font-size': `${prefs.fontSize}px`,
    '--reader-line-height': String(prefs.lineHeight),
    '--reader-pad-x': `${marginPadRem(prefs.margin)}rem`,
  } as CSSProperties

  const progressPct = lastIndex <= 0 ? 100 : Math.round((index / lastIndex) * 100)
  const pageTitle = pageLabel(page, index, pages.length)

  if (shell === 'closed') {
    return (
      <div className={`life-book life-book--closed life-book--theme-${prefs.theme}`}>
        <button type="button" className="life-book__closed-cover" onClick={() => openBook()}>
          <span className="life-book__closed-art-wrap">
            <img src={portraitUrl(character)} alt="" className="life-book__closed-art" />
          </span>
          <span className="life-book__closed-meta">
            {ending && (
              <span className="life-book__closed-badge">
                {ending.finalAge}岁 · {primaryDeathTag(ending.deathReason, ending.character)}
              </span>
            )}
            <strong className="life-book__closed-title">{displayName(character)}</strong>
            <span className="life-book__closed-cta">揭开这一生</span>
          </span>
        </button>
        {initialPage > 0 && (
          <button type="button" className="btn tiny life-book__resume" onClick={() => openBook(initialPage)}>
            续读此生
          </button>
        )}
        {onBack && (
          <button type="button" className="btn tiny" onClick={onBack}>
            放回书架
          </button>
        )}
      </div>
    )
  }

  const flipLeafStyle =
    dragX !== 0 && flip === 'idle'
      ? {
          transform: `rotateY(${Math.max(-28, Math.min(28, -dragX / 5))}deg)`,
          transition: 'none',
        }
      : undefined

  const outgoing = flip !== 'idle' ? page : null
  const incoming =
    flip === 'next'
      ? pages[Math.min(lastIndex, index + 1)]
      : flip === 'prev'
        ? pages[Math.max(0, index - 1)]
        : null

  const sheetProps = {
    character,
    seed,
    originName,
    ending,
    deathArt,
    onShare,
    onJump: jumpFromToc,
    frontMatter,
    firstTocIndex,
    onJumpPage: jumpTo,
  }

  return (
    <div
      className={[
        'life-book',
        `life-book--theme-${prefs.theme}`,
        use3d ? 'life-book--realistic' : '',
        flip !== 'idle' ? `life-book--flip-${flip}` : '',
        chromeVisible ? 'life-book--chrome-on' : 'life-book--chrome-off',
        mode === 'reading' ? 'life-book--reader' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={readerStyle}
    >
      <header className="reader-chrome reader-chrome--top" aria-hidden={!chromeVisible}>
        <button
          type="button"
          className="btn tiny"
          onClick={() => (onBack ? closeBook() : jumpTo(0))}
        >
          {onBack ? '返回' : '封面'}
        </button>
        <strong className="reader-chrome__title">{pageTitle}</strong>
        <button
          type="button"
          className="btn tiny"
          onClick={() => {
            setSettingsOpen(false)
            setCatalogOpen((v) => !v)
            showChrome(true)
          }}
        >
          目录
        </button>
      </header>

      <div className="life-book__spine" aria-hidden />
      <div
        className="life-book__stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragOrigin.current = null
          setDragX(0)
        }}
        onClick={onStageClick}
      >
        <div className="life-book__edge life-book__edge--prev" aria-hidden />
        <div className="life-book__edge life-book__edge--next" aria-hidden />

        {use3d && flip !== 'idle' && outgoing && incoming ? (
          <>
            <div className="life-book__leaf life-book__leaf--under">
              <BookSheet
                page={incoming}
                index={flip === 'next' ? index + 1 : index - 1}
                total={pages.length}
                {...sheetProps}
                onJump={() => undefined}
                hideHead={mode === 'reading'}
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
                {...sheetProps}
                onJump={() => undefined}
                hideHead={mode === 'reading'}
              />
            </div>
          </>
        ) : (
          <div className="life-book__leaf" style={flipLeafStyle}>
            <BookSheet
              page={page}
              index={index}
              total={pages.length}
              {...sheetProps}
              hideHead={mode === 'reading'}
            />
          </div>
        )}
      </div>

      <footer className="reader-chrome reader-chrome--bottom">
        <div className="reader-chrome__tools reader-chrome__tools--pager">
          <nav className="reader-chrome__pager" aria-label="翻页">
            <button
              type="button"
              className="btn tiny"
              disabled={index <= 0 || flip !== 'idle'}
              onClick={() => jumpTo(0)}
            >
              首页
            </button>
            <button
              type="button"
              className="btn tiny"
              disabled={index <= 0 || flip !== 'idle'}
              onClick={() => go(-1)}
            >
              上一页
            </button>
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
        </div>
        <div
          className="reader-chrome__tools reader-chrome__tools--extra"
          aria-hidden={!chromeVisible}
        >
          <button
            type="button"
            className="btn tiny"
            onClick={() => {
              setCatalogOpen(false)
              setSettingsOpen((v) => !v)
              showChrome(true)
            }}
          >
            设置
          </button>
          <div className="reader-chrome__progress">
            <input
              type="range"
              className="reader-chrome__scrub"
              min={0}
              max={lastIndex}
              value={index}
              aria-label="阅读进度"
              onChange={(e) => {
                jumpTo(Number(e.target.value))
                showChrome()
              }}
            />
            <span className="reader-chrome__pct">
              {index + 1} / {pages.length} · 已读 {progressPct}%
            </span>
          </div>
          <button
            type="button"
            className={`btn tiny${bookmarked ? ' primary' : ''}`}
            onClick={() => {
              const next = !bookmarked
              setBookmarked(next)
              onToggleBookmark?.(index, next)
              showChrome()
            }}
          >
            {bookmarked ? '已夹丝' : '书签'}
          </button>
        </div>
      </footer>

      {catalogOpen && (
        <aside className="reader-drawer" role="dialog" aria-label="目录">
          <div className="reader-drawer__head">
            <h3>目录</h3>
            <button type="button" className="btn tiny" onClick={() => setCatalogOpen(false)}>
              关闭
            </button>
          </div>
          {profilePages.length > 0 && (
            <>
              <p className="reader-drawer__label">卷首</p>
              <ul className="reader-drawer__list">
                {coverIndex >= 0 && (
                  <li>
                    <button
                      type="button"
                      className="book-toc__link"
                      onClick={() => {
                        jumpTo(coverIndex)
                        setCatalogOpen(false)
                      }}
                    >
                      封面
                    </button>
                  </li>
                )}
                {profilePages.map(({ page, index: pi }) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      className="book-toc__link"
                      onClick={() => {
                        jumpTo(pi)
                        setCatalogOpen(false)
                      }}
                    >
                      {page.title}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="reader-drawer__label">高潮编年</p>
          {tocEntries.length === 0 ? (
            <p className="muted">高潮尚未落墨，目录暂空。</p>
          ) : (
            <ul className="reader-drawer__list">
              {tocEntries.map((e, i) => (
                <li key={`${e.age}-${e.title}-${i}`}>
                  <button type="button" className="book-toc__link" onClick={() => jumpFromToc(e)}>
                    {tocEntryLabel(e)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      {settingsOpen && (
        <div className="reader-settings" role="dialog" aria-label="阅读设置">
          <div className="reader-settings__head">
            <h3>阅读设置</h3>
            <button type="button" className="btn tiny" onClick={() => setSettingsOpen(false)}>
              关闭
            </button>
          </div>
          <label className="reader-settings__row">
            <span>字号</span>
            <span className="reader-settings__controls">
              <button
                type="button"
                className="btn tiny"
                onClick={() => bumpPrefs({ fontSize: clampFontSize(prefs.fontSize - 1) })}
              >
                −
              </button>
              <em>{prefs.fontSize}</em>
              <button
                type="button"
                className="btn tiny"
                onClick={() => bumpPrefs({ fontSize: clampFontSize(prefs.fontSize + 1) })}
              >
                ＋
              </button>
            </span>
          </label>
          <label className="reader-settings__row">
            <span>行距</span>
            <span className="reader-settings__controls">
              <button
                type="button"
                className="btn tiny"
                onClick={() => bumpPrefs({ lineHeight: clampLineHeight(prefs.lineHeight - 0.05) })}
              >
                −
              </button>
              <em>{prefs.lineHeight.toFixed(2)}</em>
              <button
                type="button"
                className="btn tiny"
                onClick={() => bumpPrefs({ lineHeight: clampLineHeight(prefs.lineHeight + 0.05) })}
              >
                ＋
              </button>
            </span>
          </label>
          <label className="reader-settings__row">
            <span>边距</span>
            <span className="reader-settings__controls">
              {(['tight', 'standard', 'loose'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`btn tiny${prefs.margin === m ? ' primary' : ''}`}
                  onClick={() => bumpPrefs({ margin: m })}
                >
                  {m === 'tight' ? '紧' : m === 'loose' ? '疏' : '中'}
                </button>
              ))}
            </span>
          </label>
          <div className="reader-settings__row">
            <span>主题</span>
            <span className="reader-settings__controls">
              {(Object.keys(THEME_LABELS) as ReaderTheme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn tiny${prefs.theme === t ? ' primary' : ''}`}
                  onClick={() => bumpPrefs({ theme: t })}
                >
                  {THEME_LABELS[t]}
                </button>
              ))}
            </span>
          </div>
          <label className="reader-settings__row">
            <span>翻页动画</span>
            <button
              type="button"
              className={`btn tiny${prefs.flipAnimation ? ' primary' : ''}`}
              onClick={() => bumpPrefs({ flipAnimation: !prefs.flipAnimation })}
            >
              {prefs.flipAnimation ? '开' : '关'}
            </button>
          </label>
          <label className="reader-settings__row">
            <span>纸声</span>
            <button
              type="button"
              className={`btn tiny${prefs.sound ? ' primary' : ''}`}
              onClick={() => bumpPrefs({ sound: !prefs.sound })}
            >
              {prefs.sound ? '开' : '关'}
            </button>
          </label>
        </div>
      )}

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
  hideHead,
  frontMatter,
  firstTocIndex,
  onJumpPage,
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
  /** 阅读壳顶栏已显示页题时，隐藏页内重复页眉，避免叠字 */
  hideHead?: boolean
  frontMatter?: { label: string; index: number }[]
  firstTocIndex?: number
  onJumpPage?: (pageIndex: number) => void
}) {
  return (
    <div className="life-book__sheet">
      {!hideHead && (
        <header className="life-book__head">
          <span className="life-book__eyebrow">一生一书</span>
          <strong>{pageLabel(page, index, total)}</strong>
        </header>
      )}
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
        {page.kind === 'profile' && page.profileSection && (
          <BookProfilePage character={character} section={page.profileSection} />
        )}
        {page.kind === 'toc' && (
          <TocPage
            entries={page.entries}
            pageTitle={page.title}
            onJump={onJump}
            frontMatter={index === firstTocIndex ? frontMatter : undefined}
            onJumpPage={onJumpPage}
          />
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
  originName,
  summary,
  ending,
}: {
  character: Character
  seed?: number
  originName?: string
  ending?: EndingReport | null
  summary?: string
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
      </div>
      <div className="book-cover__info">
        <h2 className="book-cover__title">{displayName(character)}</h2>
        {ending && deathTag ? (
          <>
            <p className="book-cover__seal-tag">{deathTag}</p>
            <p className="book-cover__meta">
              享年{ending.finalAge}岁 · {ending.mainline} · 评分 {ending.score}
            </p>
            <p className="book-cover__summary">{ending.summary}</p>
            <p className="muted">下一页起可读六维、心性、天赋、人事与武学名号。</p>
          </>
        ) : (
          <>
            <p className="book-cover__meta">
              {character.gender}
              {originName ? ` · ${originName}` : ''}
            </p>
            <p className="book-cover__lead">{summary}</p>
            <p className="muted">揭开这一生 —— 点页边或滑一下翻页。</p>
          </>
        )}
      </div>
    </div>
  )
}

function tocEntryLabel(e: LogEntry): string {
  if (e.title === '名号' || e.title === '武学') {
    const named = e.text.match(/「([^」]+)」/)
    if (named?.[1]) return `${e.age}岁 · ${e.title}·${named[1]}`
  }
  return `${e.age}岁 · ${e.title}`
}

function TocPage({
  entries,
  onJump,
  pageTitle,
  frontMatter,
  onJumpPage,
}: {
  entries: LogEntry[]
  onJump: (entry: LogEntry) => void
  pageTitle?: string
  frontMatter?: { label: string; index: number }[]
  onJumpPage?: (pageIndex: number) => void
}) {
  const hasFront = Boolean(frontMatter?.length)
  const hasClimax = entries.length > 0
  if (!hasFront && !hasClimax) {
    return <p className="muted">目录暂空。可点顶栏「目录」随时查看。</p>
  }
  return (
    <div className="book-toc">
      <h3>{pageTitle && pageTitle !== '目录' ? pageTitle : '本卷目录'}</h3>
      <p className="muted book-toc__hint">点条目跳转；亦可随时从顶栏打开完整目录抽屉。</p>
      {hasFront && (
        <>
          <p className="book-toc__label">卷首</p>
          <ul className="book-toc__grid">
            {frontMatter!.map((f) => (
              <li key={`front-${f.index}`}>
                <button type="button" className="book-toc__link" onClick={() => onJumpPage?.(f.index)}>
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {hasClimax && (
        <>
          <p className="book-toc__label">高潮编年</p>
          <ul className="book-toc__grid">
            {entries.map((e, i) => (
              <li key={`${e.age}-${e.title}-${i}`}>
                <button type="button" className="book-toc__link" onClick={() => onJump(e)}>
                  {tocEntryLabel(e)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
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
        {page.age != null && !String(page.title).startsWith(`${page.age}岁`)
          ? `${page.age}岁 · `
          : ''}
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
          下载列传页
        </button>
      )}
    </div>
  )
}
