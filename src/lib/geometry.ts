export interface Size {
  w: number
  h: number
}

/**
 * Per-cell image transform: `scale` is a multiplier on top of cover-fit
 * (1 = exactly cover the cell), `x`/`y` are pan offsets in cell-display px.
 */
export interface ImageTransform {
  scale: number
  x: number
  y: number
}

export const IDENTITY_TRANSFORM: ImageTransform = { scale: 1, x: 0, y: 0 }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 5

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** scale factor so the image exactly covers the cell */
export function coverScale(img: Size, cell: Size): number {
  return Math.max(cell.w / img.w, cell.h / img.h)
}

/** displayed image size in cell-display px for a given transform */
export function displayedSize(t: ImageTransform, img: Size, cell: Size): Size {
  const base = coverScale(img, cell)
  return { w: img.w * base * t.scale, h: img.h * base * t.scale }
}

/** clamp pan so the image always fully covers the cell */
export function clampPan(t: ImageTransform, img: Size, cell: Size): ImageTransform {
  const d = displayedSize(t, img, cell)
  const maxX = Math.max(0, (d.w - cell.w) / 2)
  const maxY = Math.max(0, (d.h - cell.h) / 2)
  return {
    scale: clamp(t.scale, MIN_ZOOM, MAX_ZOOM),
    x: clamp(t.x, -maxX, maxX),
    y: clamp(t.y, -maxY, maxY),
  }
}

export interface SourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * The region of the source image (in source pixels) visible inside the cell
 * for a given transform. Feeds canvas.drawImage directly.
 */
export function sourceRect(t: ImageTransform, img: Size, cell: Size): SourceRect {
  const d = displayedSize(t, img, cell)
  const x0 = (cell.w - d.w) / 2 + t.x // image left edge rel. to cell
  const y0 = (cell.h - d.h) / 2 + t.y
  return {
    sx: clamp((-x0 / d.w) * img.w, 0, img.w),
    sy: clamp((-y0 / d.h) * img.h, 0, img.h),
    sw: clamp((cell.w / d.w) * img.w, 0, img.w),
    sh: clamp((cell.h / d.h) * img.h, 0, img.h),
  }
}

/**
 * Pixel-space rectangles for every cell of a template inside an output box.
 * Fractions define row heights / col widths; cells are inset by spacing/2.
 */
export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
}

export function cellRect(
  placement: { row: number; col: number; rowSpan: number; colSpan: number },
  rowFracs: number[],
  colFracs: number[],
  box: PixelRect,
  spacing: number,
): PixelRect {
  const colStart = colFracs.slice(0, placement.col).reduce((a, b) => a + b, 0)
  const colSpan = colFracs
    .slice(placement.col, placement.col + placement.colSpan)
    .reduce((a, b) => a + b, 0)
  const rowStart = rowFracs.slice(0, placement.row).reduce((a, b) => a + b, 0)
  const rowSpan = rowFracs
    .slice(placement.row, placement.row + placement.rowSpan)
    .reduce((a, b) => a + b, 0)
  const half = spacing / 2
  return {
    x: box.x + colStart * box.w + half,
    y: box.y + rowStart * box.h + half,
    w: Math.max(0, colSpan * box.w - spacing),
    h: Math.max(0, rowSpan * box.h - spacing),
  }
}
