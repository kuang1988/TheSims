import type { EndingReport } from '../types'
import { ORIGINS } from '../data/origins'
import { TITLES } from '../data/titles'
import { primaryDeathTag } from './deathTags'
import { endingDeathUrl, portraitUrl } from './assetResolve'
import { BRAND } from './brand'

function originName(id: string) {
  return ORIGINS.find((o) => o.id === id)?.name ?? id
}

function titleName(id: string) {
  return TITLES.find((t) => t.id === id)?.name ?? id
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** 宣纸底噪点（轻量、无霓虹） */
function paintXuanPaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.2, h)
  g.addColorStop(0, '#f6efe4')
  g.addColorStop(0.45, '#ebe0cf')
  g.addColorStop(1, '#e0d2bc')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  const speck = ctx.createImageData(w, h)
  const data = speck.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 28) | 0
    const warm = n > 18 ? 12 : 0
    data[i] = 210 + warm
    data[i + 1] = 198 + (warm >> 1)
    data[i + 2] = 176
    data[i + 3] = n > 14 ? 18 : 0
  }
  ctx.putImageData(speck, 0, 0)

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.15, w * 0.5, h * 0.5, w * 0.78)
  vignette.addColorStop(0, 'rgba(246, 239, 228, 0)')
  vignette.addColorStop(1, 'rgba(90, 72, 48, 0.12)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
) {
  const scale = Math.max(boxW / img.width, boxH / img.height)
  const sw = boxW / scale
  const sh = boxH / scale
  const sx = (img.width - sw) / 2
  const sy = Math.max(0, (img.height - sh) * 0.18)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, boxW, boxH)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, x, y, boxW, boxH)
  ctx.restore()
  ctx.strokeStyle = 'rgba(90, 72, 48, 0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1)
}

/** 生成结算列传页（canvas）：宣纸 · 一主图 · 死标 · 名号 · 享年 */
export async function renderShareCard(
  ending: EndingReport,
  seed?: number,
): Promise<HTMLCanvasElement> {
  const w = 720
  const h = 960
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const c = ending.character
  const primary = c.primaryTitleId ? titleName(c.primaryTitleId) : null
  const deathTag = primaryDeathTag(ending.deathReason, c)
  const deathSrc = endingDeathUrl(ending.deathReason, c)
  const [deathImg, portraitImg] = await Promise.all([
    deathSrc ? loadImage(deathSrc) : Promise.resolve(null),
    loadImage(portraitUrl(c)),
  ])
  const hero = deathImg ?? portraitImg

  paintXuanPaper(ctx, w, h)

  const ink = '#3a2f24'
  const muted = '#5c4e3f'
  const accent = '#9c2f1a'
  const soft = '#8a735a'

  ctx.strokeStyle = 'rgba(90, 72, 48, 0.28)'
  ctx.lineWidth = 2
  ctx.strokeRect(28, 28, w - 56, h - 56)
  ctx.strokeStyle = 'rgba(90, 72, 48, 0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(40, 40, w - 80, h - 80)

  ctx.fillStyle = soft
  ctx.font = '18px "ZCOOL XiaoWei", "Songti SC", "Noto Serif SC", serif'
  ctx.fillText(BRAND.name, 64, 78)
  ctx.font = '15px "Source Han Serif SC", "Songti SC", "Noto Serif SC", serif'
  const tagline = BRAND.tagline.length > 28 ? `${BRAND.tagline.slice(0, 27)}…` : BRAND.tagline
  ctx.fillText(tagline, 64, 102)

  const artW = w - 128
  const artH = 360
  const artX = 64
  const artY = 128
  if (hero) {
    drawCoverImage(ctx, hero, artX, artY, artW, artH)
  } else {
    ctx.fillStyle = 'rgba(90, 72, 48, 0.06)'
    ctx.fillRect(artX, artY, artW, artH)
    ctx.strokeStyle = 'rgba(90, 72, 48, 0.22)'
    ctx.strokeRect(artX + 0.5, artY + 0.5, artW - 1, artH - 1)
  }

  let y = artY + artH + 56

  ctx.fillStyle = accent
  ctx.font = '26px "ZCOOL XiaoWei", "Songti SC", "Noto Serif SC", serif'
  ctx.fillText(deathTag, 64, y)

  y += 48
  ctx.fillStyle = ink
  ctx.font = '40px "ZCOOL XiaoWei", "Songti SC", "Noto Serif SC", serif'
  const nameLine = primary ? `${c.name} · ${primary}` : c.name
  ctx.fillText(nameLine.slice(0, 16), 64, y)

  y += 40
  ctx.fillStyle = muted
  ctx.font = '22px "Source Han Serif SC", "Songti SC", "Noto Serif SC", serif'
  ctx.fillText(`享年 ${ending.finalAge} 岁`, 64, y)

  y += 34
  ctx.fillText(`出身${originName(c.originId)} · 主线「${ending.mainline}」`, 64, y)

  const highlight = ending.highlights[0]
  if (highlight) {
    y += 44
    ctx.fillStyle = soft
    ctx.font = '18px "ZCOOL XiaoWei", "Songti SC", serif'
    ctx.fillText('高光', 64, y)
    y += 30
    ctx.fillStyle = muted
    ctx.font = '20px "Source Han Serif SC", "Songti SC", "Noto Serif SC", serif'
    const short =
      highlight.length > 22 ? `${[...highlight].slice(0, 21).join('')}…` : highlight
    ctx.fillText(short, 64, y)
  }

  if (seed != null) {
    ctx.fillStyle = soft
    ctx.font = '16px "Source Han Serif SC", "Songti SC", serif'
    ctx.fillText(`种子 ${seed}`, 64, h - 72)
  }

  ctx.fillStyle = soft
  ctx.font = '17px "Source Han Serif SC", "Songti SC", "Noto Serif SC", serif'
  ctx.fillText('同种子，不同抉择，亦是不同江湖。', 64, h - 44)

  return canvas
}

export async function downloadShareCard(ending: EndingReport, seed?: number) {
  const canvas = await renderShareCard(ending, seed)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `${BRAND.name}-列传-${ending.character.name}.png`
  a.click()
}
