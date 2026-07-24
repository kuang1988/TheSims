import type { LifeBookRecord } from '../lib/lifeShelf'
import { shelfStatusLabel } from '../lib/lifeShelf'
import { portraitUrl } from '../lib/assetResolve'

export function LifeShelf({
  books,
  onOpen,
  onBack,
  onStart,
  onRemove,
}: {
  books: LifeBookRecord[]
  onOpen: (book: LifeBookRecord) => void
  onBack: () => void
  onStart: () => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="panel life-shelf">
      <div className="life-shelf__head">
        <div>
          <p className="eyebrow">我的人生</p>
          <h1>人生书架</h1>
          <p className="muted">每一本，都是你走过的一世。</p>
        </div>
        <button type="button" className="btn tiny" onClick={onBack}>
          返回大厅
        </button>
      </div>

      {books.length === 0 ? (
        <div className="life-shelf__empty">
          <p>书架尚空。去开始游戏，写就第一本。</p>
          <button type="button" className="btn primary" onClick={onStart}>
            开始游戏
          </button>
        </div>
      ) : (
        <ul className="life-shelf__grid">
          {books.map((book) => (
            <li key={book.id} className="shelf-card">
              <button
                type="button"
                className="shelf-card__cover"
                onClick={() => onOpen(book)}
                aria-label={`打开 ${book.title}`}
              >
                <img
                  className="shelf-card__portrait"
                  src={portraitUrl(book.ending.character)}
                  alt=""
                  loading="lazy"
                />
                <div className="shelf-card__ending">
                  <strong>{book.deathTag}</strong>
                  <span>
                    {book.finalAge}岁 · {book.mainline}
                  </span>
                </div>
              </button>
              <button type="button" className="shelf-card__title" onClick={() => onOpen(book)}>
                {book.title}
              </button>
              <p className="shelf-card__status">{shelfStatusLabel(book)}</p>
              <p className="shelf-card__meta">
                {book.finalAge}岁 · {book.mainline} · {book.deathTag}
              </p>
              <button
                type="button"
                className="shelf-card__remove"
                onClick={() => onRemove(book.id)}
              >
                移出书架
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
