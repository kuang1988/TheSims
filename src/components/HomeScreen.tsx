import { portraitUrlFor } from '../lib/assetResolve'

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
      <p className="eyebrow">乱世书房</p>
      <h1 className="home-screen__title">武侠人生模拟器</h1>
      <p className="home-screen__lead">出身入世，抉择改命；每一生，都是一本书。</p>

      <div className="home-screen__art" aria-hidden>
        <img src={portraitUrlFor('男', 'wanderer')} alt="" />
        <img src={portraitUrlFor('女', 'emei')} alt="" />
      </div>

      <div className="home-screen__actions">
        <button type="button" className="btn primary home-screen__cta" onClick={onStart}>
          开始游戏
        </button>
        <button type="button" className="btn home-screen__cta" onClick={onShelf}>
          我的人生{shelfCount > 0 ? `（${shelfCount}）` : ''}
        </button>
        <button type="button" className="btn home-screen__cta home-screen__codex" onClick={onCodex}>
          成就图鉴
        </button>
      </div>

      <p className="meta home-screen__foot">本地书架保存最近传记 · 同种子不同抉择</p>
    </section>
  )
}
