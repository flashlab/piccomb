export interface Size {
  w: number
  h: number
}

/**
 * Per-cell image transform: `scale` is a multiplier on top of cover-fit
 * (1 = exactly cover the cell), `x`/`y` are pan offsets in cell-display px,
 * `rotation` is quarter-turns clockwise (0/90/180/270).
 */
export interface ImageTransform {
  scale: number
  x: number
  y: number
  rotation: number
}

export const IDENTITY_TRANSFORM: ImageTransform = { scale: 1, x: 0, y: 0, rotation: 0 }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 5

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** effective bitmap dims after rotation (90/270 swap w/h) */
export function rotatedSize(img: Size, rotation: number): Size {
  return rotation % 180 === 0 ? img : { w: img.h, h: img.w }
}

/** scale factor so the (possibly rotated) image exactly covers the cell */
export function coverScale(img: Size, cell: Size, rotation = 0): number {
  const e = rotatedSize(img, rotation)
  return Math.max(cell.w / e.w, cell.h / e.h)
}

/** displayed size of the rotated image in cell-display px */
export function displayedSize(t: ImageTransform, img: Size, cell: Size): Size {
  const e = rotatedSize(img, t.rotation)
  const base = coverScale(img, cell, t.rotation)
  return { w: e.w * base * t.scale, h: e.h * base * t.scale }
}

/** clamp pan so the rotated image always fully covers the cell */
export function clampPan(t: ImageTransform, img: Size, cell: Size): ImageTransform {
  const d = displayedSize(t, img, cell)
  const maxX = Math.max(0, (d.w - cell.w) / 2)
  const maxY = Math.max(0, (d.h - cell.h) / 2)
  return {
    scale: clamp(t.scale, MIN_ZOOM, MAX_ZOOM),
    x: clamp(t.x, -maxX, maxX),
    y: clamp(t.y, -maxY, maxY),
    rotation: ((t.rotation % 360) + 360) % 360,
  }
}

export interface SourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * The region of the drawable bitmap (in its own pixels) visible inside the
 * cell. `bmp` must be the dims of the bitmap actually handed to drawImage —
 * i.e. already-rotated when the cell is rotated — so this function needs no
 * rotation knowledge.
 */
export function sourceRect(t: ImageTransform, bmp: Size, cell: Size): SourceRect {
  const base = Math.max(cell.w / bmp.w, cell.h / bmp.h)
  const d = { w: bmp.w * base * t.scale, h: bmp.h * base * t.scale }
  const x0 = (cell.w - d.w) / 2 + t.x
  const y0 = (cell.h - d.h) / 2 + t.y
  return {
    sx: clamp((-x0 / d.w) * bmp.w, 0, bmp.w),
    sy: clamp((-y0 / d.h) * bmp.h, 0, bmp.h),
    sw: clamp((cell.w / d.w) * bmp.w, 0, bmp.w),
    sh: clamp((cell.h / d.h) * bmp.h, 0, bmp.h),
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
