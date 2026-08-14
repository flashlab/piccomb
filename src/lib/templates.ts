import raw from '@/data/templates.json'

export interface CellSpan {
  /** row span */
  r: number
  /** col span */
  c: number
}

interface RawCellSpan extends CellSpan {
  /** optional explicit 1-indexed [row, col] start position */
  s?: [number, number]
}

interface RawTemplate {
  g: number
  gr: [number, number]
  c: RawCellSpan[]
}

export interface Template {
  id: string
  /** image count */
  count: number
  rows: number
  cols: number
  /** cell spans in reading order; `start` is the optional pinned position */
  spans: (CellSpan & { start?: [number, number] })[]
}

const data = raw as unknown as Record<string, RawTemplate>

export const templates: Template[] = Object.entries(data).map(([id, t]) => ({
  id,
  count: parseInt(id.split('-')[0], 10),
  rows: t.gr[0],
  cols: t.gr[1],
  spans: t.c.map((cell) => (cell.s ? { r: cell.r, c: cell.c, start: cell.s } : { r: cell.r, c: cell.c })),
}))

export const MAX_IMAGES = Math.max(...templates.map((t) => t.count))
export const MIN_IMAGES = Math.min(...templates.map((t) => t.count))

export function templatesForCount(n: number): Template[] {
  return templates.filter((t) => t.count === n)
}

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id)
}

export interface CellPlacement {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

/**
 * Place cells onto the grid. Two passes over the reading-order array:
 * 1. cells with an explicit 1-indexed `start` position are pinned first
 * 2. remaining cells take the first (row-major scan) free position that fits
 */
export function placeCells(t: Template): CellPlacement[] {
  const occ: boolean[][] = Array.from({ length: t.rows }, () =>
    Array<boolean>(t.cols).fill(false),
  )
  const out: (CellPlacement | null)[] = t.spans.map(() => null)

  const occupy = (r0: number, c0: number, span: CellSpan) => {
    for (let dr = 0; dr < span.r; dr++)
      for (let dc = 0; dc < span.c; dc++) occ[r0 + dr][c0 + dc] = true
  }

  t.spans.forEach((span, i) => {
    if (!span.start) return
    const r0 = span.start[0] - 1
    const c0 = span.start[1] - 1
    occupy(r0, c0, span)
    out[i] = { row: r0, col: c0, rowSpan: span.r, colSpan: span.c }
  })

  t.spans.forEach((span, i) => {
    if (span.start) return
    let placed = false
    for (let r0 = 0; r0 <= t.rows - span.r && !placed; r0++) {
      for (let c0 = 0; c0 <= t.cols - span.c && !placed; c0++) {
        let fits = true
        for (let dr = 0; dr < span.r && fits; dr++)
          for (let dc = 0; dc < span.c && fits; dc++)
            if (occ[r0 + dr][c0 + dc]) fits = false
        if (fits) {
          occupy(r0, c0, span)
          out[i] = { row: r0, col: c0, rowSpan: span.r, colSpan: span.c }
          placed = true
        }
      }
    }
    if (!placed) throw new Error(`template ${t.id}: cell ${i} does not fit`)
  })

  return out as CellPlacement[]
}

/**
 * Smart auto-layout: keep the current template when it already matches the
 * image count; otherwise fall back to the first template for that count
 * (the original site's first entry per count is the canonical layout).
 */
export function matchTemplate(imageCount: number, currentId: string | null): Template {
  const clamped = Math.max(MIN_IMAGES, Math.min(MAX_IMAGES, imageCount))
  if (currentId) {
    const cur = getTemplate(currentId)
    if (cur && cur.count === clamped) return cur
  }
  const candidates = templatesForCount(clamped)
  if (candidates.length === 0) throw new Error(`no template for ${clamped} images`)
  return candidates[0]
}

/** initial uniform fractions for a grid axis */
export function uniformFractions(n: number): number[] {
  return Array<number>(n).fill(1 / n)
}

/**
 * Drag divider between segment i and i+1 by delta (fraction of total).
 * Adjacent segments absorb the change; clamped to minFrac per segment.
 */
export function dragDivider(
  fracs: number[],
  i: number,
  delta: number,
  minFrac = 0.05,
): number[] {
  if (i < 0 || i >= fracs.length - 1) return fracs
  const next = [...fracs]
  const sum = fracs[i] + fracs[i + 1]
  let a = fracs[i] + delta
  a = Math.max(minFrac, Math.min(sum - minFrac, a))
  next[i] = a
  next[i + 1] = sum - a
  return next
}
