import type { ImageTransform, Size } from '@/lib/geometry'
import { IDENTITY_TRANSFORM, cellRect, sourceRect, type PixelRect } from '@/lib/geometry'
import { placeCells, type Template } from '@/lib/templates'
import type { CollageStyle } from '@/lib/style'

export type ExportFormat = 'png' | 'jpeg' | 'webp'

export const FORMAT_MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const DEFAULT_QUALITY = 0.92

/** piccomb_collage_20260814-153012.png style names */
export function timestampName(tool: string, format: ExportFormat, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  return `piccomb_${tool}_${stamp}.${format === 'jpeg' ? 'jpg' : format}`
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality = DEFAULT_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
      FORMAT_MIME[format],
      format === 'png' ? undefined : quality,
    )
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface CollageRenderInput {
  images: (HTMLImageElement | null)[]
  template: Template
  rowFracs: number[]
  colFracs: number[]
  transforms: ImageTransform[]
  style: CollageStyle
  out: Size
}

/** bitmap rotated by quarter-turns, for export-time drawImage */
function rotatedSource(
  img: HTMLImageElement,
  rotation: number,
): HTMLImageElement | HTMLCanvasElement {
  const rot = ((rotation % 360) + 360) % 360
  if (rot === 0) return img
  const swap = rot % 180 !== 0
  const c = document.createElement('canvas')
  c.width = swap ? img.naturalHeight : img.naturalWidth
  c.height = swap ? img.naturalWidth : img.naturalHeight
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  return c
}

function sourceDims(s: HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  return s instanceof HTMLImageElement
    ? { w: s.naturalWidth, h: s.naturalHeight }
    : { w: s.width, h: s.height }
}

/**
 * Render the collage onto a fresh canvas at full output resolution.
 * Mirrors the DOM editing view: same fractions, same transforms, same style.
 */
export function renderCollage(input: CollageRenderInput): HTMLCanvasElement {
  const { images, template, rowFracs, colFracs, transforms, style, out } = input
  const canvas = document.createElement('canvas')
  canvas.width = out.w
  canvas.height = out.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')

  ctx.fillStyle = style.bgColor
  ctx.fillRect(0, 0, out.w, out.h)

  const box: PixelRect = {
    x: style.borderWidths.left,
    y: style.borderWidths.top,
    w: out.w - style.borderWidths.left - style.borderWidths.right,
    h: out.h - style.borderWidths.top - style.borderWidths.bottom,
  }

  const placements = placeCells(template)
  placements.forEach((pl, i) => {
    const img = images[i]
    if (!img) return
    const rect = cellRect(pl, rowFracs, colFracs, box, style.spacing)
    const t = transforms[i] ?? IDENTITY_TRANSFORM
    const source = rotatedSource(img, t.rotation)
    const src = sourceRect(t, sourceDims(source), rect)

    ctx.save()
    ctx.beginPath()
    if (style.radius > 0) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, style.radius)
    else ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
    ctx.drawImage(source, src.sx, src.sy, src.sw, src.sh, rect.x, rect.y, rect.w, rect.h)
    ctx.restore()
  })

  return canvas
}

/** Split one image into rows×cols tiles; returns one canvas per tile (row-major). */
export function splitImage(img: HTMLImageElement, rows: number, cols: number): HTMLCanvasElement[] {
  const tileW = Math.floor(img.naturalWidth / cols)
  const tileH = Math.floor(img.naturalHeight / rows)
  const out: HTMLCanvasElement[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const canvas = document.createElement('canvas')
      canvas.width = tileW
      canvas.height = tileH
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(img, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH)
      out.push(canvas)
    }
  }
  return out
}

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Crop `img` to `area` (pixels) honoring an arbitrary `rotation` (degrees).
 * `area` is expressed in the rotated bounding-box space, exactly as
 * react-easy-crop reports via onCropComplete.
 * Official react-easy-crop recipe: draw rotated into a bounding-box canvas,
 * then cut the area out of it.
 */
export function cropWithRotation(
  img: HTMLImageElement,
  area: CropArea,
  rotation: number,
): HTMLCanvasElement {
  const rot = (rotation * Math.PI) / 180
  const sw = img.naturalWidth
  const sh = img.naturalHeight
  const boxW = Math.round(Math.abs(Math.cos(rot) * sw) + Math.abs(Math.sin(rot) * sh))
  const boxH = Math.round(Math.abs(Math.sin(rot) * sw) + Math.abs(Math.cos(rot) * sh))

  const stage = document.createElement('canvas')
  stage.width = boxW
  stage.height = boxH
  const sctx = stage.getContext('2d')
  if (!sctx) throw new Error('no 2d context')
  sctx.translate(boxW / 2, boxH / 2)
  sctx.rotate(rot)
  sctx.drawImage(img, -sw / 2, -sh / 2)

  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(area.width))
  out.height = Math.max(1, Math.round(area.height))
  const octx = out.getContext('2d')
  if (!octx) throw new Error('no 2d context')
  octx.drawImage(
    stage,
    Math.round(area.x),
    Math.round(area.y),
    out.width,
    out.height,
    0,
    0,
    out.width,
    out.height,
  )
  return out
}

export function splitTileName(base: string, row: number, col: number, format: ExportFormat): string {
  const ext = format === 'jpeg' ? 'jpg' : format
  return `${base}_r${row + 1}c${col + 1}.${ext}`
}
