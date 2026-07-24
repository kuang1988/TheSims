import type { LifeBookRecord } from '../lib/lifeShelf'
import { shelfStatusLabel } from '../lib/lifeShelf'
import { portraitUrl } from '../lib/assetResolve'
import { BRAND } from '../lib/brand'

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
          <p className="eyebrow">{BRAND.shelf}</p>
          <h1>藏书阁</h1>
          <p className="muted">每一卷，都是你走过的一世江湖。</p>
        </div>
        <button type="button" className="btn tiny" onClick={onBack}>
          {BRAND.home}
        </button>
      </div>

      {books.length === 0 ? (
        <div className="life-shelf__empty">
          <p>阁中尚空。去{BRAND.start}，写就第一卷。</p>
          <button type="button" className="btn primary" onClick={onStart}>
            {BRAND.start}
          </button>
        </div>
      ) : (
        <ul className="life-shelf__grid life-shelf__grid--rack">
          {books.map((book) => (
            <li key={book.id} className="shelf-card">
              <button
                type="button"
                className="shelf-card__cover shelf-card__cover--pull"
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
                {book.bookmarkPage != null && <span className="shelf-card__ribbon" aria-hidden />}
              </button>
              <button type="button" className="shelf-card__title" onClick={() => onOpen(book)}>
                {book.title}
              </button>
              <p className="shelf-card__status">{shelfStatusLabel(book)}</p>
              <p className="shelf-card__meta">
                {book.finalAge}岁 · {book.mainline} · {book.deathTag}
              </p>
              {(book.lastPageIndex ?? 0) > 0 && !book.readAt && (
                <button type="button" className="shelf-card__resume" onClick={() => onOpen(book)}>
                  续读此生
                </button>
              )}
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
