import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildEnding,
  calcForce,
  createBirth,
  getMartial,
  getOrigin,
  getTitle,
  getTrait,
  LifeSimulator,
} from './engine/simulator'
import {
  formatShareText,
  loadStats,
  recordRunStats,
  statsSummary,
  type RunStats,
} from './lib/story'
import {
  codexProgress,
  loadCodex,
  syncCodexFromEnding,
  type AchievementDef,
  type CodexState,
} from './lib/meta'
import { LifeBook } from './components/LifeBook'
import { HomeScreen } from './components/HomeScreen'
import { LifeShelf } from './components/LifeShelf'
import { CodexScreen } from './components/CodexScreen'
import { HexAttrRadar } from './components/HexAttrRadar'
import { HeartDial } from './components/HeartDial'
import { downloadShareCard } from './lib/shareCard'
import { BRAND } from './lib/brand'
import { cleanPlayerNameInput, guardPlayerName, NAME_FALLBACK } from './lib/nameGuard'
import {
  loadShelf,
  markShelfRead,
  removeShelfBook,
  updateShelfProgress,
  upsertShelfBook,
  type LifeBookRecord,
} from './lib/lifeShelf'
import { primaryDeathTag } from './lib/deathTags'
import {
  artUrlForLog,
  climaxUrlFromHighlight,
  endingDeathUrl,
  normalizePortraitLook,
  originUrl,
  PORTRAIT_BLURB,
  PORTRAIT_LABELS,
  portraitPoolForGender,
  portraitUrl,
  portraitUrlFor,
} from './lib/assetResolve'
import { matchSynergies } from './data/synergies'
import { ORIGINS } from './data/origins'
import type { PortraitArchetype } from './data/assetManifest'
import type {
  Character,
  ChoiceDef,
  EndingReport,
  LogEntry,
  PendingChoice,
  PlayMode,
  Screen,
} from './types'
import './App.css'

type GenderOption = '男' | '女' | '随机'

const PREFS_KEY = 'wuxia-life-sim-prefs-v1'

interface PlayPrefs {
  mode: PlayMode
  autoSpeed: number
  majorOnly: boolean
  foldLowLogs: boolean
}

function loadPlayPrefs(): PlayPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) {
      return { mode: 'auto', autoSpeed: 5, majorOnly: true, foldLowLogs: true }
    }
    const p = JSON.parse(raw) as Partial<PlayPrefs>
    return {
      mode: p.mode === 'semi' ? 'semi' : 'auto',
      autoSpeed: Math.min(8, Math.max(1, Number(p.autoSpeed) || 5)),
      majorOnly: p.majorOnly !== false,
      foldLowLogs: p.foldLowLogs !== false,
    }
  } catch {
    return { mode: 'auto', autoSpeed: 5, majorOnly: true, foldLowLogs: true }
  }
}

function savePlayPrefs(p: PlayPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

function createInitialBirth() {
  const s = Date.now() % 1_000_000_000
  return {
    seed: s,
    character: createBirth(s, undefined, {
      unlockedAchievements: loadCodex().achievements,
    }),
  }
}

function displayName(c: Character): string {
  if (!c.primaryTitleId) return c.name
  return `${c.name} · ${getTitle(c.primaryTitleId).name}`
}

function rarityClass(r: string) {
  return r === '传说'
    ? 'rarity-legend'
    : r === '史诗'
      ? 'rarity-epic'
      : r === '稀有'
        ? 'rarity-rare'
        : 'rarity-common'
}

function martialRarityLabel(grade: string) {
  if (grade === '神功' || grade === '绝学') return '传说'
  if (grade === '上乘') return '史诗'
  if (grade === '中乘') return '稀有'
  return '普通'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [boot] = useState(createInitialBirth)
  const [seed, setSeed] = useState(boot.seed)
  const [genderOption, setGenderOption] = useState<GenderOption>('随机')
  const [codex, setCodex] = useState<CodexState>(() => loadCodex())
  const [character, setCharacter] = useState<Character>(boot.character)
  const [prefs] = useState(loadPlayPrefs)
  const [mode, setMode] = useState<PlayMode>(prefs.mode)
  const [majorOnly, setMajorOnly] = useState(prefs.majorOnly)
  const [autoSpeed, setAutoSpeed] = useState(prefs.autoSpeed)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pending, setPending] = useState<PendingChoice | null>(null)
  const [ending, setEnding] = useState<EndingReport | null>(null)
  const [showStatus, setShowStatus] = useState(false)
  const [showEndingDetail, setShowEndingDetail] = useState(false)
  const [showLifeReview, setShowLifeReview] = useState(false)
  const [reviewClimaxOnly, setReviewClimaxOnly] = useState(false)
  const [foldLowLogs, setFoldLowLogs] = useState(prefs.foldLowLogs)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'err' | 'info' } | null>(null)
  const [ritualTip, setRitualTip] = useState('')
  const [logFlash, setLogFlash] = useState(false)
  const [runStats, setRunStats] = useState<RunStats>(() => loadStats())
  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([])
  const [showBirthExtras, setShowBirthExtras] = useState(false)
  const [showOriginPicker, setShowOriginPicker] = useState(false)
  const [showEndingLoot, setShowEndingLoot] = useState(false)
  const [showLifePortraitPicker, setShowLifePortraitPicker] = useState(false)
  const [readAsBook, setReadAsBook] = useState(true)
  const [endingReadAsBook, setEndingReadAsBook] = useState(true)
  const [shelfBooks, setShelfBooks] = useState<LifeBookRecord[]>(() => loadShelf())
  const [openShelfBook, setOpenShelfBook] = useState<LifeBookRecord | null>(null)

  const simRef = useRef<LifeSimulator | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const logStreamRef = useRef<HTMLDivElement | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((message: string, kind: 'ok' | 'err' | 'info' = 'info') => {
    setToast({ message, kind })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2000)
  }, [])

  useEffect(() => {
    savePlayPrefs({ mode, autoSpeed, majorOnly, foldLowLogs })
  }, [mode, autoSpeed, majorOnly, foldLowLogs])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const resolveGender = (option: GenderOption): '男' | '女' | undefined => {
    if (option === '男' || option === '女') return option
    return undefined
  }

  const rollBirth = (
    s: number,
    option: GenderOption = genderOption,
    opts?: { keepName?: string; lockedOriginId?: string },
  ) => {
    const next = createBirth(s, resolveGender(option), {
      unlockedAchievements: codex.achievements,
      lockedOriginId: opts?.lockedOriginId,
    })
    const keepRaw = opts?.keepName?.replace(/\s+/g, '')
    if (keepRaw) {
      const kept = guardPlayerName(keepRaw)
      if (kept.ok) next.name = kept.name
    }
    setSeed(s)
    setCharacter(next)
  }

  const reroll = () => {
    const s = (Date.now() + Math.floor(Math.random() * 99999)) % 1_000_000_000
    rollBirth(s)
  }

  const renameCharacter = (raw: string) => {
    // 输入过程：只清洗字形，敏感词在失焦 / 入世时硬拦
    const next = cleanPlayerNameInput(raw)
    setCharacter((c) => ({ ...c, name: next }))
  }

  const commitCharacterName = () => {
    const guarded = guardPlayerName(character.name)
    if (!guarded.ok) {
      showToast(guarded.reason, 'err')
      setCharacter((c) => ({ ...c, name: NAME_FALLBACK }))
      return false
    }
    setCharacter((c) => ({ ...c, name: guarded.name }))
    return true
  }

  const changeGender = (option: GenderOption) => {
    setGenderOption(option)
    const keep = guardPlayerName(character.name)
    rollBirth(seed, option, {
      keepName: keep.ok ? keep.name : undefined,
      lockedOriginId: character.originId,
    })
  }

  const applyOrigin = (originId: string) => {
    const def = ORIGINS.find((o) => o.id === originId)
    if (!def) return
    if (def.unlockBy && !codex.achievements.includes(def.unlockBy)) return
    const keep = guardPlayerName(character.name)
    rollBirth(seed, genderOption, {
      keepName: keep.ok ? keep.name : undefined,
      lockedOriginId: originId,
    })
  }

  const applyPortraitLook = (look: PortraitArchetype) => {
    const next = normalizePortraitLook(character.gender, look)
    setCharacter((c) => ({ ...c, portraitLook: next }))
    if (simRef.current) simRef.current.character.portraitLook = next
    if (ending) {
      setEnding({
        ...ending,
        character: { ...ending.character, portraitLook: next },
      })
    }
  }

  const cyclePortraitLook = () => {
    const pool = portraitPoolForGender(character.gender)
    const cur = normalizePortraitLook(character.gender, character.portraitLook)
    const i = Math.max(0, pool.indexOf(cur))
    applyPortraitLook(pool[(i + 1) % pool.length] ?? 'civic')
  }

  const portraitChoices = useMemo(
    () => portraitPoolForGender(character.gender),
    [character.gender],
  )

  const origin = useMemo(() => getOrigin(character.originId), [character.originId])
  const traits = useMemo(() => character.traitIds.map(getTrait), [character.traitIds])
  const synergies = useMemo(() => matchSynergies(character.traitIds), [character.traitIds])

  const startLife = () => {
    const guarded = guardPlayerName(character.name)
    if (!guarded.ok) {
      showToast(guarded.reason, 'err')
      setCharacter((c) => ({ ...c, name: NAME_FALLBACK }))
      return
    }
    const c = structuredClone(character)
    c.name = guarded.name
    const sim = new LifeSimulator(c, seed ^ 0x9e3779b9, mode, majorOnly)
    const intro: LogEntry = {
      age: 0,
      kind: 'system',
      title: '入世',
      text: `${displayName(c)}（${c.gender}）生于乱世。出身${origin.name}。模式：${mode === 'auto' ? '全自动' : '半自动'}。`,
      importance: 3,
    }
    sim.logs.push(intro)
    simRef.current = sim
    setCharacter(structuredClone(sim.character))
    setLogs([...sim.logs])
    setPending(null)
    setEnding(null)
    setScreen('life')
    setShowStatus(false)
    // 全自动立即开跑；半自动等玩家点继续/活一年
    setRunning(mode === 'auto')
  }

  const finish = useCallback((sim: LifeSimulator) => {
    setRunning(false)
    setPending(null)
    setCharacter(structuredClone(sim.character))
    setLogs([...sim.logs])
    const report = buildEnding(sim)
    setEnding(report)
    setShowEndingDetail(false)
    setShowLifeReview(false)
    setReviewClimaxOnly(false)
    setEndingReadAsBook(true)
    setRunStats(recordRunStats(report))
    const synced = syncCodexFromEnding(report)
    setCodex(synced.codex)
    setNewAchievements(synced.newAchievements)
    const originLabel = getOrigin(report.character.originId).name
    setShelfBooks(upsertShelfBook(report, seed, originLabel))
    setScreen('ending')
  }, [seed])

  const goHome = () => {
    setRunning(false)
    setPending(null)
    setEnding(null)
    setOpenShelfBook(null)
    setShowStatus(false)
    simRef.current = null
    setScreen('home')
  }

  const openShelfBookReader = (book: LifeBookRecord) => {
    setOpenShelfBook(book)
    setScreen('book')
  }

  const appendFromSim = useCallback((sim: LifeSimulator) => {
    setCharacter(structuredClone(sim.character))
    setLogs([...sim.logs])
  }, [])

  const stepYear = useCallback(() => {
    const sim = simRef.current
    if (!sim || sim.ended) return
    const before = sim.logs.length
    const result = sim.advanceYear()
    appendFromSim(sim)
    const gained = sim.logs.slice(before)
    const ritual = gained.find(
      (l) =>
        (l.kind === 'martial' && l.importance >= 4) ||
        (l.kind === 'title' && l.importance >= 5),
    )
    if (ritual && mode === 'semi') {
      setRitualTip(ritual.text)
      setRunning(false)
      window.setTimeout(() => setRitualTip(''), 2200)
    }
    if (mode === 'auto' && gained.some((l) => l.importance >= 5)) {
      setLogFlash(true)
      window.setTimeout(() => setLogFlash(false), 850)
      const flash = gained.find((l) => l.importance >= 5)
      if (flash) {
        setRitualTip(flash.title)
        window.setTimeout(() => setRitualTip(''), 1600)
      }
    }
    if (result.pendingChoice) {
      setPending(result.pendingChoice)
      setRunning(false)
      return
    }
    if (result.died) finish(sim)
  }, [appendFromSim, finish, mode])

  const choose = (choice: ChoiceDef) => {
    const sim = simRef.current
    if (!sim) return
    const before = sim.logs.length
    const result = sim.resolvePending(choice)
    setPending(null)
    appendFromSim(sim)
    const gained = sim.logs.slice(before)
    const ritual = gained.find(
      (l) =>
        (l.kind === 'martial' && l.importance >= 4) ||
        (l.kind === 'title' && l.importance >= 5),
    )
    if (ritual) {
      setRitualTip(ritual.text)
      window.setTimeout(() => setRitualTip(''), 2200)
    }
    if (result.died) {
      finish(sim)
      return
    }
    // 抉择后继续自动推进（全自动/半自动皆可）
    setRunning(true)
  }

  // 自动推进：用年龄驱动下一轮，避免「无新日志」时卡死
  useEffect(() => {
    if (screen !== 'life' || !running || pending) return
    if (simRef.current?.ended) return
    const delay = mode === 'auto' ? Math.max(30, 280 / autoSpeed) : 420
    const t = window.setTimeout(() => {
      stepYear()
    }, delay)
    return () => clearTimeout(t)
  }, [screen, running, pending, mode, autoSpeed, stepYear, character.age])

  useEffect(() => {
    const stream = logStreamRef.current
    if (!stream || !logEndRef.current) return
    const distance = stream.scrollHeight - stream.scrollTop - stream.clientHeight
    // 用户上翻阅读时不抢滚动
    if (distance < 120) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [logs.length, pending])

  const visibleLogs = useMemo(() => {
    if (mode !== 'auto' || !foldLowLogs) return logs
    return logs.filter(
      (l) =>
        l.importance >= 3 ||
        l.kind === 'title' ||
        l.kind === 'death' ||
        l.kind === 'system' ||
        l.title === '入世',
    )
  }, [logs, mode, foldLowLogs])

  const reviewLogs = useMemo(() => {
    if (!ending) return []
    if (!reviewClimaxOnly) return ending.lifeLog
    return ending.lifeLog.filter(
      (l) =>
        l.importance >= 3 ||
        l.kind === 'title' ||
        l.kind === 'death' ||
        l.kind === 'system' ||
        l.title === '入世',
    )
  }, [ending, reviewClimaxOnly])

  const endingDeathArt = useMemo(
    () => (ending ? endingDeathUrl(ending.deathReason, ending.character) : null),
    [ending],
  )

  const copyEnding = async () => {
    if (!ending) return
    const text = formatShareText(ending, seed)
    try {
      await navigator.clipboard.writeText(text)
      showToast('已复制生平短传', 'ok')
    } catch {
      showToast('复制失败，请手动选择文本', 'err')
    }
  }

  return (
    <div className="app">
      <div className="bg-ink" aria-hidden />
      {toast && (
        <div className="toast-host" role="status" aria-live="polite">
          <div className={`toast toast--${toast.kind}`}>{toast.message}</div>
        </div>
      )}
      <header className="topbar">
        <button type="button" className="brand brand--btn" onClick={goHome}>
          {BRAND.name}
        </button>
        {screen === 'life' && (
          <div className="topbar__actions">
            <button type="button" className="btn ghost" onClick={() => setShowStatus((v) => !v)}>
              {showStatus ? '返回日志' : '状态'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setRunning((v) => !v)}
              disabled={!!pending}
            >
              {running ? '暂停' : '继续'}
            </button>
          </div>
        )}
        {(screen === 'birth' ||
          screen === 'ending' ||
          screen === 'shelf' ||
          screen === 'book' ||
          screen === 'codex') && (
          <div className="topbar__actions">
            <button type="button" className="btn ghost" onClick={goHome}>
              {BRAND.lobby}
            </button>
            {screen !== 'shelf' && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setOpenShelfBook(null)
                  setScreen('shelf')
                }}
              >
                {BRAND.shelf}
              </button>
            )}
            {screen !== 'codex' && (
              <button type="button" className="btn ghost" onClick={() => setScreen('codex')}>
                {BRAND.codex}
              </button>
            )}
          </div>
        )}
      </header>

      <main className="main">
        {screen === 'home' && (
          <HomeScreen
            shelfCount={shelfBooks.length}
            onStart={() => setScreen('birth')}
            onShelf={() => setScreen('shelf')}
            onCodex={() => setScreen('codex')}
          />
        )}

        {screen === 'shelf' && (
          <LifeShelf
            books={shelfBooks}
            onOpen={openShelfBookReader}
            onBack={goHome}
            onStart={() => setScreen('birth')}
            onRemove={(id) => {
              setShelfBooks(removeShelfBook(id))
              showToast('已移出书架', 'ok')
            }}
          />
        )}

        {screen === 'codex' && <CodexScreen codex={codex} onBack={goHome} />}

        {screen === 'book' && openShelfBook && (
          <section className="panel ending-book-wrap shelf-reader shelf-reader--drawn">
            <LifeBook
              logs={openShelfBook.ending.lifeLog}
              character={openShelfBook.ending.character}
              seed={openShelfBook.seed}
              ending={openShelfBook.ending}
              originName={openShelfBook.originName}
              mode="reading"
              realisticFlip
              startClosed={(openShelfBook.lastPageIndex ?? 0) === 0}
              initialPage={openShelfBook.lastPageIndex ?? 0}
              onProgress={(pageIndex) => {
                setShelfBooks(updateShelfProgress(openShelfBook.id, pageIndex))
                setOpenShelfBook((b) => (b ? { ...b, lastPageIndex: pageIndex } : b))
              }}
              onToggleBookmark={(pageIndex, on) => {
                setShelfBooks(
                  updateShelfProgress(openShelfBook.id, openShelfBook.lastPageIndex ?? pageIndex, {
                    bookmarkPage: on ? pageIndex : null,
                  }),
                )
                setOpenShelfBook((b) =>
                  b ? { ...b, bookmarkPage: on ? pageIndex : undefined } : b,
                )
              }}
              onReachedEnd={() => {
                setShelfBooks(markShelfRead(openShelfBook.id))
                setOpenShelfBook((b) => (b ? { ...b, readAt: Date.now() } : b))
              }}
              onBack={() => {
                setOpenShelfBook(null)
                setScreen('shelf')
              }}
              onShare={() => {
                void downloadShareCard(openShelfBook.ending, openShelfBook.seed).then(() => {
                  showToast('已生成列传页', 'ok')
                })
              }}
            />
          </section>
        )}

        {screen === 'birth' && (
          <section className="panel birth">
            <p className="eyebrow">入世之前 · 天命已定</p>
            <div className="birth-hero">
              <img
                className="birth-hero__portrait"
                src={portraitUrl(character)}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="birth-hero__copy">
                <label className="birth-hero__name">
                  <span className="field-label">姓名</span>
                  <input
                    type="text"
                    className="birth-hero__name-input"
                    value={character.name}
                    maxLength={6}
                    placeholder="自定义姓名"
                    aria-label="角色姓名"
                    onChange={(e) => renameCharacter(e.target.value)}
                    onBlur={() => commitCharacterName()}
                  />
                </label>
                <p className="lead">{character.gender}</p>
              </div>
            </div>

            <article className="origin-card" aria-label={`出身：${origin.name}`}>
              <img
                className="origin-card__img"
                src={originUrl(origin.id)}
                alt=""
                onError={(e) => {
                  e.currentTarget.classList.add('is-missing')
                }}
              />
              <div className="origin-card__body">
                <p className="origin-card__eyebrow">出身</p>
                <h2 className="origin-card__name">{origin.name}</h2>
                <p className="origin-card__desc">{origin.desc}</p>
              </div>
            </article>

            <div className="origin-picker">
              <button
                type="button"
                className="btn birth-extras-toggle origin-picker__toggle"
                onClick={() => setShowOriginPicker((v) => !v)}
              >
                {showOriginPicker ? '收起出身一览' : '更换出身'}
              </button>
              {showOriginPicker && (
                <div className="origin-picker__grid" role="listbox" aria-label="选择出身">
                  {ORIGINS.map((o) => {
                    const locked = Boolean(o.unlockBy && !codex.achievements.includes(o.unlockBy))
                    const active = character.originId === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        aria-disabled={locked}
                        disabled={locked}
                        title={locked ? '未解锁' : o.desc}
                        className={`origin-picker__item${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
                        onClick={() => applyOrigin(o.id)}
                      >
                        <img src={originUrl(o.id)} alt="" loading="lazy" />
                        <span>{o.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mode-row gender-row">
              <span className="field-label">性别</span>
              {(['男', '女', '随机'] as GenderOption[]).map((g) => (
                <label key={g} className={genderOption === g ? 'active' : ''}>
                  <input
                    type="radio"
                    name="gender"
                    checked={genderOption === g}
                    onChange={() => changeGender(g)}
                  />
                  {g}
                </label>
              ))}
            </div>

            <div className="portrait-picker">
              <div className="portrait-picker__bar">
                <span className="field-label">立绘</span>
                <span className="portrait-picker__current">
                  {PORTRAIT_LABELS[normalizePortraitLook(character.gender, character.portraitLook)]}
                  <em className="portrait-picker__blurb">
                    {PORTRAIT_BLURB[normalizePortraitLook(character.gender, character.portraitLook)]}
                  </em>
                </span>
                <button type="button" className="btn tiny" onClick={cyclePortraitLook}>
                  换一脸
                </button>
              </div>
              <div className="portrait-picker__grid" role="listbox" aria-label="选择立绘">
                {portraitChoices.map((look) => {
                  const active =
                    normalizePortraitLook(character.gender, character.portraitLook) === look
                  return (
                    <button
                      key={look}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`portrait-picker__item${active ? ' is-active' : ''}`}
                      onClick={() => applyPortraitLook(look)}
                    >
                      <img
                        src={portraitUrlFor(character.gender, look)}
                        alt={PORTRAIT_LABELS[look]}
                        title={PORTRAIT_BLURB[look]}
                        loading="lazy"
                      />
                      <span>{PORTRAIT_LABELS[look]}</span>
                    </button>
                  )
                })}
              </div>
              <p className="meta portrait-picker__hint">点选缩略图更换；入世后不会因门派自动换脸。</p>
            </div>

            <div className="birth-profile birth-profile--attrs">
              <h3 className="book-profile__section">
                六维与心性
                <span>寿元约 {character.lifespan} 岁</span>
              </h3>
              <div className="attr-duo">
                <HexAttrRadar attrs={character.attrs} size={200} />
                <HeartDial value={character.attrs.心性} />
              </div>
            </div>

            <div className="birth-traits">
              <h3 className="book-profile__section">
                天赋词条
                <span>{traits.length} 枚</span>
              </h3>
              <ul className="codex-achieve-grid book-profile__grid">
                {traits.map((t) => {
                  const rarity =
                    t.rarity === '传说'
                      ? 'rarity-legend'
                      : t.rarity === '史诗'
                        ? 'rarity-epic'
                        : t.rarity === '稀有'
                          ? 'rarity-rare'
                          : 'rarity-common'
                  return (
                    <li
                      key={t.id}
                      className={`codex-achieve codex-achieve--on ${rarity}`}
                      title={t.desc}
                    >
                      <strong>{t.name}</strong>
                      <em className="book-profile__tag">{t.rarity}</em>
                      <span>{t.desc}</span>
                    </li>
                  )
                })}
              </ul>
              {synergies.length > 0 && (
                <div className="synergy-box">
                  <h4 className="book-profile__section">词条联动</h4>
                  <ul className="codex-achieve-grid book-profile__grid">
                    {synergies.map((s) => (
                      <li key={s.id} className="codex-achieve codex-achieve--on rarity-epic">
                        <strong>{s.name}</strong>
                        <span>{s.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mode-row compact-mode">
              <label className={mode === 'auto' ? 'active' : ''}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'auto'}
                  onChange={() => setMode('auto')}
                />
                全自动
              </label>
              <label className={mode === 'semi' ? 'active' : ''}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'semi'}
                  onChange={() => setMode('semi')}
                />
                半自动
              </label>
            </div>

            <button
              type="button"
              className="btn birth-extras-toggle"
              onClick={() => setShowBirthExtras((v) => !v)}
            >
              {showBirthExtras ? '收起推演设定' : '展开倍速 / 图鉴统计'}
            </button>

            {showBirthExtras && (
              <div className="birth-extras">
                <p className="meta stats-line">{statsSummary(runStats)}</p>
                <p className="meta stats-line">
                  图鉴 成就 {codexProgress(codex).achievements} · 武学{' '}
                  {codexProgress(codex).martialArts} · 称号 {codexProgress(codex).titles}
                </p>
                {mode === 'semi' && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={majorOnly}
                      onChange={(e) => setMajorOnly(e.target.checked)}
                    />
                    仅重大抉择暂停（推荐，约 8–20 次）
                  </label>
                )}
                {mode === 'auto' && (
                  <label className="speed">
                    倍速
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={autoSpeed}
                      onChange={(e) => setAutoSpeed(Number(e.target.value))}
                    />
                    <span>×{autoSpeed}</span>
                  </label>
                )}
              </div>
            )}

            <div className="cta-row">
              <button type="button" className="btn primary" onClick={startLife}>
                入世开卷
              </button>
              <button type="button" className="btn" onClick={reroll}>
                重开天命
              </button>
              <button type="button" className="btn" onClick={() => setScreen('codex')}>
                {BRAND.codex}
              </button>
            </div>
          </section>
        )}

        {screen === 'life' && (
          <section className="life life--bookish">
            <aside className="hud hud--slim">
              <div className="hud__top">
                <img
                  className="hud__portrait"
                  src={portraitUrl(character)}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className="hud__identity">
                  <div className="hud__name">{displayName(character)}</div>
                  <div className="hud__meta-line">
                    {character.age} 岁 · {character.realm}
                    <span className="hud__meta-quiet"> · 战力 {calcForce(character)}</span>
                  </div>
                  {ritualTip && <p className="ritual-banner ritual-banner--slim">{ritualTip}</p>}
                </div>
                <div className="hud__slim-tools">
                  <button
                    type="button"
                    className="btn tiny"
                    onClick={() => setShowStatus((v) => !v)}
                  >
                    {showStatus ? '返回' : '详况'}
                  </button>
                  <label className="hud__book-pref" title="书本阅读（一生一书）">
                    <input
                      type="checkbox"
                      checked={readAsBook}
                      onChange={(e) => setReadAsBook(e.target.checked)}
                      aria-label="书本阅读"
                    />
                    <span>书</span>
                  </label>
                </div>
              </div>
            </aside>

            {showStatus ? (
              <div className="status-drawer">
                <StatusPanel character={character} onSetPrimary={(id) => {
                  const sim = simRef.current
                  if (!sim) return
                  sim.character.primaryTitleId = id
                  setCharacter(structuredClone(sim.character))
                }} />
                <div className="hud__portrait-tools">
                  <button
                    type="button"
                    className="btn tiny"
                    onClick={() => setShowLifePortraitPicker((v) => !v)}
                  >
                    {showLifePortraitPicker ? '收起立绘' : '更换立绘'}
                  </button>
                  {showLifePortraitPicker && (
                    <div className="portrait-picker__grid portrait-picker__grid--compact">
                      {portraitChoices.map((look) => {
                        const active =
                          normalizePortraitLook(character.gender, character.portraitLook) === look
                        return (
                          <button
                            key={look}
                            type="button"
                            className={`portrait-picker__item${active ? ' is-active' : ''}`}
                            onClick={() => applyPortraitLook(look)}
                          >
                            <img src={portraitUrlFor(character.gender, look)} alt="" />
                            <span>{PORTRAIT_LABELS[look]}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {mode === 'auto' && (
                  <label className="fold-toggle">
                    <input
                      type="checkbox"
                      checked={foldLowLogs}
                      onChange={(e) => setFoldLowLogs(e.target.checked)}
                    />
                    折叠日常（只看高潮）
                  </label>
                )}
              </div>
            ) : (
              <div className={`log-panel${logFlash ? ' log-panel--flash' : ''}`}>
                {readAsBook ? (
                  <LifeBook
                    logs={logs}
                    character={character}
                    seed={seed}
                    originName={origin.name}
                    mode="live"
                  />
                ) : (
                  <div className="log-stream" ref={logStreamRef}>
                    {mode === 'auto' && foldLowLogs && logs.length !== visibleLogs.length && (
                      <p className="log-fold-hint muted">
                        已折叠 {logs.length - visibleLogs.length} 条日常；详况中可取消「折叠日常」查看全文
                      </p>
                    )}
                    {visibleLogs.map((l, i) => (
                      <LifeLogArticle
                        key={`${l.age}-${i}-${l.title}`}
                        log={l}
                        character={character}
                      />
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}

                {pending && (
                  <div className="choice-box">
                    <h3>如何抉择？</h3>
                    <p className="choice-box__hint">此岔路口将改写后半生，请择一路。</p>
                    {(() => {
                      const pendingArt = artUrlForLog(
                        {
                          age: character.age,
                          kind: 'event',
                          title: pending.event.name,
                          text: pending.event.text,
                          importance: pending.event.importance,
                          eventId: pending.event.id,
                        },
                        character,
                      )
                      return pendingArt ? (
                        <img
                          className="choice-box__art"
                          src={pendingArt}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : null
                    })()}
                    <div className="choice-list">
                      {pending.choices.map((ch, i) => (
                        <button key={i} type="button" className="btn choice" onClick={() => choose(ch)}>
                          {ch.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mode === 'semi' && !pending && !running && (
                  <div className="semi-actions">
                    <p className="semi-actions__hint">推演会自动经过日常；遇重大抉择时会再次停下。</p>
                    <div className="cta-row">
                      <button type="button" className="btn primary" onClick={() => setRunning(true)}>
                        继续推演人生
                      </button>
                      <button type="button" className="btn" onClick={stepYear}>
                        只过一年
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {screen === 'ending' && ending && (
          <section className="panel ending ending--slim">
            <p className="eyebrow">尘埃落定</p>
            <div className="ending-bar">
              <div className="ending-bar__copy">
                <p className="death-tag">{primaryDeathTag(ending.deathReason, ending.character)}</p>
                <h1 className="death ending-bar__death">{ending.deathReason}</h1>
                <p className="ending-bar__meta">
                  本局评分 {ending.score} · 主线 · {ending.mainline}
                </p>
                <div className="tags ending-bar__tags">
                  {ending.endingTags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className={
                        t === primaryDeathTag(ending.deathReason, ending.character) ? 'tag-primary' : ''
                      }
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {endingDeathArt && (
                <img
                  className="ending-bar__thumb"
                  src={endingDeathArt}
                  alt=""
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
            </div>

            <div className="cta-row ending-share">
              <button type="button" className="btn primary" onClick={copyEnding}>
                复制生平短传
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void downloadShareCard(ending, seed).then(() => {
                    showToast('已生成列传页', 'ok')
                  })
                }}
              >
                下载列传页
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  reroll()
                  setScreen('birth')
                  setEnding(null)
                  setShowEndingDetail(false)
                  setShowLifeReview(false)
                  setShowEndingLoot(false)
                  setNewAchievements([])
                  simRef.current = null
                }}
              >
                再入江湖
              </button>
              <button type="button" className="btn" onClick={() => setScreen('shelf')}>
                {BRAND.shelf}
              </button>
              <button type="button" className="btn" onClick={goHome}>
                {BRAND.home}
              </button>
            </div>

            {newAchievements.length > 0 && (
              <div className="new-achievements">
                <h3>新成就解锁</h3>
                <ul>
                  {newAchievements.map((a) => (
                    <li key={a.id}>
                      <strong>{a.name}</strong>
                      <span>{a.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ending-book-wrap">
              <LifeBook
                logs={ending.lifeLog}
                character={ending.character}
                seed={seed}
                ending={ending}
                originName={getOrigin(ending.character.originId).name}
                mode="reading"
                realisticFlip
                startClosed
                onShare={() => {
                  void downloadShareCard(ending, seed).then(() => {
                    showToast('已生成列传页', 'ok')
                  })
                }}
              />
            </div>

            <details className="ending-more">
              <summary>更多回顾</summary>
              <div className="cta-row ending-inspect">
                <button
                  type="button"
                  className={`btn ${!endingReadAsBook && showLifeReview ? 'primary' : ''}`}
                  onClick={() => {
                    setEndingReadAsBook(false)
                    setShowLifeReview(true)
                    setShowEndingDetail(false)
                    setShowEndingLoot(false)
                  }}
                >
                  卷轴回顾
                </button>
                <button
                  type="button"
                  className={`btn ${showEndingDetail ? 'primary' : ''}`}
                  onClick={() => {
                    setShowEndingDetail((v) => !v)
                    setShowLifeReview(false)
                    setShowEndingLoot(false)
                    setEndingReadAsBook(true)
                  }}
                >
                  {showEndingDetail ? '收起详细属性' : '查看详细属性'}
                </button>
                <button
                  type="button"
                  className={`btn ${showEndingLoot ? 'primary' : ''}`}
                  onClick={() => {
                    setShowEndingLoot((v) => !v)
                    setShowLifeReview(false)
                    setShowEndingDetail(false)
                    setEndingReadAsBook(true)
                  }}
                >
                  {showEndingLoot ? '收起武学名号' : '武学 / 名号 / 高潮'}
                </button>
                <button type="button" className="btn" onClick={() => setScreen('codex')}>
                  {BRAND.codex}
                </button>
              </div>

              {!endingReadAsBook && showLifeReview && (
                <div className="life-review">
                  <div className="life-review__head">
                    <h2>一生回顾（卷轴）</h2>
                    <label className="fold-toggle">
                      <input
                        type="checkbox"
                        checked={reviewClimaxOnly}
                        onChange={(e) => setReviewClimaxOnly(e.target.checked)}
                      />
                      仅看高潮
                    </label>
                  </div>
                  <p className="meta">
                    共 {ending.lifeLog.length} 条记载
                    {reviewClimaxOnly ? `，当前显示 ${reviewLogs.length} 条` : ''}
                  </p>
                  <div className="life-review__stream">
                    {reviewLogs.length === 0 ? (
                      <p className="muted">暂无记载可回顾。</p>
                    ) : (
                      reviewLogs.map((l, i) => (
                        <LifeLogArticle
                          key={`review-${l.age}-${i}-${l.title}`}
                          log={l}
                          character={ending.character}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {showEndingDetail && (
                <StatusPanel
                  character={ending.character}
                  title="终局详情"
                  readOnly
                  showOrigin
                  profileOnly
                />
              )}

              {showEndingLoot && (
                <div className="ending-loot status-panel--book">
                  {ending.highlights.length > 0 && (
                    <div className="book-profile">
                      <h3 className="book-profile__section">
                        生平高潮
                        <span>{ending.highlights.length} 幕</span>
                      </h3>
                      <ul className="highlight-list">
                        {ending.highlights.map((h) => {
                          const climaxSrc = climaxUrlFromHighlight(h)
                          return (
                            <li key={h} className="highlight-item">
                              {climaxSrc && (
                                <img
                                  className="highlight-item__img"
                                  src={climaxSrc}
                                  alt=""
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                              <span className="highlight-item__text">{h}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                  <div className="book-profile book-profile--arts">
                    <h3 className="book-profile__section">
                      武学列表
                      <span>{ending.character.martialArts.length} 门</span>
                    </h3>
                    {ending.character.martialArts.length === 0 ? (
                      <p className="muted">尚不会武，只凭蛮力。</p>
                    ) : (
                      <ul className="codex-achieve-grid book-profile__grid">
                        {ending.character.martialArts.map((m) => {
                          const d = getMartial(m.id)
                          return (
                            <li
                              key={m.id}
                              className={`codex-achieve codex-achieve--on ${rarityClass(martialRarityLabel(d.grade))}`}
                            >
                              <strong>{d.name}</strong>
                              <em className="book-profile__tag">
                                {d.grade} · 第{m.level}层
                              </em>
                              <span>
                                {d.type} · {m.learnedAt}岁得自{m.source}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    <h3 className="book-profile__section">
                      名号
                      <span>{ending.character.titles.length} 枚</span>
                    </h3>
                    {ending.character.titles.length === 0 ? (
                      <p className="muted">尚无江湖名号。</p>
                    ) : (
                      <ul className="codex-achieve-grid book-profile__grid">
                        {ending.character.titles.map((t) => {
                          const d = getTitle(t.id)
                          const isPrimary = ending.character.primaryTitleId === t.id
                          return (
                            <li
                              key={t.id}
                              className={`codex-achieve codex-achieve--on ${rarityClass(d.rarity)}${isPrimary ? ' book-profile__primary' : ''}`}
                            >
                              <strong>
                                {d.name}
                                {isPrimary ? ' · 主' : ''}
                              </strong>
                              <em className="book-profile__tag">
                                {d.rarity} · {d.type}
                              </em>
                              <span>
                                {t.gainedAt}岁获得 · {d.desc}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </details>
          </section>
        )}

      </main>
    </div>
  )
}

function LifeLogArticle({ log, character }: { log: LogEntry; character: Character }) {
  const art = artUrlForLog(log, character)
  return (
    <article
      className={`log log--${log.kind} imp-${log.importance}${log.importance >= 4 ? ' log--climax' : ''}${art ? ' log--has-art' : ''}`}
    >
      <header>
        <span className="log__age">{log.age}岁</span>
        <strong>{log.title}</strong>
      </header>
      {art && (
        <img
          className="log__art"
          src={art}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <p>{log.text}</p>
    </article>
  )
}

function StatusPanel({
  character,
  onSetPrimary,
  title = '角色状态',
  readOnly = false,
  showOrigin = false,
  /** 终局「详细属性」只展示与入世一致的六维/天赋/人事 */
  profileOnly = false,
}: {
  character: Character
  onSetPrimary?: (id: string) => void
  title?: string
  readOnly?: boolean
  showOrigin?: boolean
  profileOnly?: boolean
}) {
  const origin = showOrigin ? getOrigin(character.originId) : null

  return (
    <div className={`status-panel status-panel--book ${readOnly ? 'status-panel--embedded' : 'panel'}`}>
      <div className="status-panel__head">
        <img
          className="status-panel__portrait"
          src={portraitUrl(character)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div>
          <h2>{title}</h2>
          {origin && (
            <p className="meta ending-identity">
              {character.name} · {character.gender} · 出身{origin.name} · 享年{character.age}岁
            </p>
          )}
          {!origin && (
            <p className="meta">
              {character.name} · {character.gender} · {character.age}岁
            </p>
          )}
        </div>
      </div>

      <div className="book-profile book-profile--attrs">
        <h3 className="book-profile__section">
          六维与心性
          <span>
            {character.realm} · 战力 {calcForce(character)} · 寿元约 {character.lifespan} 岁
          </span>
        </h3>
        <p className="meta">
          正道声望 {character.fameGood} · 邪道威名 {character.fameEvil} · 财富 {character.wealth}
        </p>
        <div className="attr-duo">
          <HexAttrRadar attrs={character.attrs} size={200} />
          <HeartDial value={character.attrs.心性} />
        </div>
      </div>

      <div className="book-profile book-profile--bonds">
        <h3 className="book-profile__section">
          天赋词条
          <span>{character.traitIds.length} 枚</span>
        </h3>
        {character.traitIds.length === 0 ? (
          <p className="muted">此生未点醒天赋。</p>
        ) : (
          <ul className="codex-achieve-grid book-profile__grid">
            {character.traitIds.map((id) => {
              const t = getTrait(id)
              return (
                <li key={id} className={`codex-achieve codex-achieve--on ${rarityClass(t.rarity)}`} title={t.desc}>
                  <strong>{t.name}</strong>
                  <em className="book-profile__tag">{t.rarity}</em>
                  <span>{t.desc}</span>
                </li>
              )
            })}
          </ul>
        )}

        <h3 className="book-profile__section">
          人际关系
          <span>{character.relations.length} 人</span>
        </h3>
        {character.relations.length === 0 ? (
          <p className="muted">尚无固定人事牵绊。</p>
        ) : (
          <ul className="codex-achieve-grid book-profile__grid">
            {character.relations.map((r) => (
              <li
                key={`${r.kind}-${r.name}`}
                className={`codex-achieve codex-achieve--on book-profile__relation book-profile__relation--${r.kind}`}
              >
                <strong>
                  {r.kind} · {r.name}
                </strong>
                <em className="book-profile__tag">羁绊 {r.bond}</em>
                <span>
                  {r.kind === '仇敌' && r.revengeIn != null ? `寻仇倒计时 ${r.revengeIn} 年` : ''}
                  {r.note ? `${r.kind === '仇敌' && r.revengeIn != null ? ' · ' : ''}${r.note}` : ''}
                  {!(r.note || (r.kind === '仇敌' && r.revengeIn != null)) ? '江湖牵绊，一字难尽。' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!profileOnly && (
        <div className="book-profile book-profile--arts">
          <h3 className="book-profile__section">
            武学列表
            <span>{character.martialArts.length} 门</span>
          </h3>
          {character.martialArts.length === 0 ? (
            <p className="muted">尚不会武，只凭蛮力。</p>
          ) : (
            <ul className="codex-achieve-grid book-profile__grid">
              {character.martialArts.map((m) => {
                const d = getMartial(m.id)
                return (
                  <li
                    key={m.id}
                    className={`codex-achieve codex-achieve--on ${rarityClass(martialRarityLabel(d.grade))}`}
                  >
                    <strong>{d.name}</strong>
                    <em className="book-profile__tag">
                      {d.grade} · 第{m.level}层
                    </em>
                    <span>
                      {d.type} · {m.learnedAt}岁得自{m.source}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <h3 className="book-profile__section">
            称号
            <span>{character.titles.length} 枚</span>
          </h3>
          {character.titles.length === 0 ? (
            <p className="muted">尚无江湖名号。</p>
          ) : (
            <ul className="codex-achieve-grid book-profile__grid">
              {character.titles.map((t) => {
                const d = getTitle(t.id)
                const isPrimary = character.primaryTitleId === t.id
                return (
                  <li
                    key={t.id}
                    className={`codex-achieve codex-achieve--on ${rarityClass(d.rarity)}${isPrimary ? ' book-profile__primary' : ''}`}
                  >
                    <strong>
                      {d.name}
                      {isPrimary ? ' · 主' : ''}
                    </strong>
                    <em className="book-profile__tag">
                      {d.rarity} · {d.type}
                    </em>
                    <span>
                      {t.gainedAt}岁获得 · {d.desc}
                    </span>
                    {!readOnly && !isPrimary && onSetPrimary && (
                      <button type="button" className="btn ghost tiny" onClick={() => onSetPrimary(t.id)}>
                        设为主称号
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
