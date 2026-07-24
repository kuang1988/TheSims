import { portraitUrlFor } from '../lib/assetResolve'
import { BRAND } from '../lib/brand'

export function HomeScreen({
  shelfCount,
  onStart,
  onShelf,
  onCodex,
}: {
  shelfCount: number
  onStart: () => void
  onShelf: () => void
  onCodex: () => void
}) {
  return (
    <section className="panel home-screen">
      <p className="eyebrow">{BRAND.eyebrow}</p>
      <h1 className="home-screen__title">{BRAND.name}</h1>
      <p className="home-screen__lead">{BRAND.tagline}</p>

      <div className="home-screen__art" aria-hidden>
        <img src={portraitUrlFor('男', 'wanderer')} alt="" />
        <img src={portraitUrlFor('女', 'emei')} alt="" />
      </div>

      <div className="home-screen__actions">
        <button type="button" className="btn primary home-screen__cta" onClick={onStart}>
          {BRAND.start}
        </button>
        <button type="button" className="btn home-screen__cta" onClick={onShelf}>
          {BRAND.shelf}
          {shelfCount > 0 ? `（${shelfCount}）` : ''}
        </button>
        <button type="button" className="btn home-screen__cta home-screen__codex" onClick={onCodex}>
          {BRAND.codex}
        </button>
      </div>

      <p className="meta home-screen__foot">本地藏书保存最近列传 · 同种子不同抉择</p>
    </section>
  )
}
