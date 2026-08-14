import { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LoadedImage } from '@/lib/images'
import {
  IDENTITY_TRANSFORM,
  clampPan,
  displayedSize,
  type ImageTransform,
  type PixelRect,
  type Size,
} from '@/lib/geometry'
import { cellRect } from '@/lib/geometry'
import { placeCells, type Template } from '@/lib/templates'
import type { CollageStyle } from '@/lib/style'
import { cn } from '@/lib/utils'

interface DragState {
  mode: 'pan' | 'maybe-swap' | 'swap'
  cell: number
  pointerId: number
  startX: number
  startY: number
  startTransform: ImageTransform
}

interface Props {
  images: (LoadedImage | null)[]
  template: Template
  rowFracs: number[]
  colFracs: number[]
  transforms: ImageTransform[]
  style: CollageStyle
  out: Size
  selectedIndex: number | null
  onTransformChange: (i: number, t: ImageTransform) => void
  onSwap: (from: number, to: number) => void
  onSelect: (i: number | null) => void
  onRowFracs: (f: number[]) => void
  onColFracs: (f: number[]) => void
  onEmptyCellClick: (i: number) => void
  /** reports display px per output px so export can scale pan offsets */
  onViewScale: (k: number) => void
}

export default function CollageCanvas(props: Props) {
  const {
    images, template, rowFracs, colFracs, transforms, style, out,
    selectedIndex, onTransformChange, onSwap, onSelect,
    onRowFracs, onColFracs, onEmptyCellClick, onViewScale,
  } = props
  const { t } = useTranslation()

  const wrapRef = useRef<HTMLDivElement>(null)
  const [displayW, setDisplayW] = useState(0)
  const dragRef = useRef<DragState | null>(null)
  const [hoverCell, setHoverCell] = useState<number | null>(null)
  const [dragCell, setDragCell] = useState<number | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const dividerRef = useRef<{
    axis: 'row' | 'col'
    index: number
    pointerId: number
    start: number
    startFracs: number[]
  } | null>(null)

  // measure container
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setDisplayW(el.clientWidth))
    ro.observe(el)
    setDisplayW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const K = displayW > 0 ? displayW / out.w : 0 // display px per output px
  const displayH = displayW * (out.h / out.w)

  useEffect(() => {
    if (K > 0) onViewScale(K)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [K])

  const box: PixelRect = {
    x: style.borderWidths.left * K,
    y: style.borderWidths.top * K,
    w: displayW - (style.borderWidths.left + style.borderWidths.right) * K,
    h: displayH - (style.borderWidths.top + style.borderWidths.bottom) * K,
  }
  const spacing = style.spacing * K
  const placements = placeCells(template)
  const rects = placements.map((p) => cellRect(p, rowFracs, colFracs, box, spacing))

  const cellOf = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY)
    const cellEl = el?.closest?.('[data-cell-index]')
    if (!cellEl) return null
    return Number((cellEl as HTMLElement).dataset.cellIndex)
  }

  const handlePointerDown = (i: number, e: React.PointerEvent) => {
    if (!images[i]) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: e.altKey ? 'pan' : 'maybe-swap',
      cell: i,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTransform: transforms[i] ?? IDENTITY_TRANSFORM,
    }
    onSelect(i)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const img = images[d.cell]
    if (!img) return

    if (d.mode === 'maybe-swap' && Math.hypot(dx, dy) > 6) {
      d.mode = 'swap'
      setDragCell(d.cell)
    }
    if (d.mode === 'pan') {
      const rect = rects[d.cell]
      const t = clampPan(
        { ...d.startTransform, x: d.startTransform.x + dx, y: d.startTransform.y + dy },
        { w: img.w, h: img.h },
        rect,
      )
      onTransformChange(d.cell, t)
    } else if (d.mode === 'swap') {
      setGhost({ x: e.clientX, y: e.clientY })
      setHoverCell(cellOf(e.clientX, e.clientY))
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    setGhost(null)
    if (!d || d.pointerId !== e.pointerId) return
    if (d.mode === 'swap') {
      const target = cellOf(e.clientX, e.clientY)
      if (target !== null && target !== d.cell) onSwap(d.cell, target)
    } else if (d.mode === 'maybe-swap') {
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
      if (moved <= 6 && !images[d.cell]) onEmptyCellClick(d.cell)
    }
    setDragCell(null)
    setHoverCell(null)
  }

  // wheel zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const idx = cellOf(e.clientX, e.clientY)
      if (idx === null || !images[idx]) return
      e.preventDefault()
      const cur = transforms[idx] ?? IDENTITY_TRANSFORM
      const factor = Math.exp(-e.deltaY * 0.0015)
      const t = clampPan(
        { ...cur, scale: cur.scale * factor },
        { w: images[idx]!.w, h: images[idx]!.h },
        rects[idx],
      )
      onTransformChange(idx, t)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, transforms, rects.map((r) => `${r.w},${r.h}`).join('|')])

  // keyboard nudge for the selected cell
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedIndex === null || !images[selectedIndex]) return
      const step = e.shiftKey ? 10 : 1
      const dir: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const d = dir[e.key]
      // +/- zoom on the selected cell
      if (!d && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        const cur = transforms[selectedIndex] ?? IDENTITY_TRANSFORM
        const img = images[selectedIndex]!
        const factor = e.key === '+' || e.key === '=' ? 1.1 : 1 / 1.1
        onTransformChange(
          selectedIndex,
          clampPan({ ...cur, scale: cur.scale * factor }, { w: img.w, h: img.h }, rects[selectedIndex]),
        )
        return
      }
      if (!d) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      const cur = transforms[selectedIndex] ?? IDENTITY_TRANSFORM
      const img = images[selectedIndex]!
      const t = clampPan(
        { ...cur, x: cur.x + d[0], y: cur.y + d[1] },
        { w: img.w, h: img.h },
        rects[selectedIndex],
      )
      onTransformChange(selectedIndex, t)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, images, transforms, rects.map((r) => `${r.w},${r.h}`).join('|')])

  // divider dragging
  const dividerDown = (axis: 'row' | 'col', index: number, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dividerRef.current = {
      axis,
      index,
      pointerId: e.pointerId,
      start: axis === 'row' ? e.clientY : e.clientX,
      startFracs: axis === 'row' ? [...rowFracs] : [...colFracs],
    }
  }
  const dividerMove = (e: React.PointerEvent) => {
    const d = dividerRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const total = d.axis === 'row' ? box.h : box.w
    if (total <= 0) return
    const pos = d.axis === 'row' ? e.clientY : e.clientX
    const delta = (pos - d.start) / total
    const { dragDivider } = dividerUtils
    if (d.axis === 'row') onRowFracs(dragDivider(d.startFracs, d.index, delta))
    else onColFracs(dragDivider(d.startFracs, d.index, delta))
  }
  const dividerUp = (e: React.PointerEvent) => {
    if (dividerRef.current?.pointerId === e.pointerId) dividerRef.current = null
  }

  const cumRows = rowFracs.reduce<number[]>((acc, _f, i) => [...acc, i === 0 ? 0 : acc[i - 1] + rowFracs[i - 1]], [])
  const cumCols = colFracs.reduce<number[]>((acc, _f, i) => [...acc, i === 0 ? 0 : acc[i - 1] + colFracs[i - 1]], [])

  return (
    <div ref={wrapRef} className="w-full select-none">
      {displayW > 0 && (
        <div
          className="relative overflow-hidden"
          style={{ width: displayW, height: displayH, background: style.bgColor }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {rects.map((rect, i) => {
            const img = images[i]
            const tf = transforms[i] ?? IDENTITY_TRANSFORM
            const d = img ? displayedSize(tf, { w: img.w, h: img.h }, rect) : null
            const x0 = d ? (rect.w - d.w) / 2 + tf.x : 0
            const y0 = d ? (rect.h - d.h) / 2 + tf.y : 0
            return (
              <div
                key={i}
                data-cell-index={i}
                role={img ? undefined : 'button'}
                tabIndex={0}
                aria-label={img ? img.name : t('collage.addImages')}
                onFocus={() => {
                  if (img) onSelect(i)
                }}
                onKeyDown={(e) => {
                  if (!img && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onEmptyCellClick(i)
                  }
                }}
                className={cn(
                  'absolute touch-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  img ? 'cursor-grab' : 'cursor-pointer bg-muted/60 hover:bg-muted',
                  hoverCell === i && dragCell !== null && dragCell !== i && 'ring-2 ring-primary ring-inset',
                  selectedIndex === i && img && 'ring-2 ring-primary/70 ring-inset',
                )}
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  borderRadius: style.radius * K,
                  overflow: 'hidden',
                }}
                onPointerDown={(e) => handlePointerDown(i, e)}
                onClick={() => {
                  if (!img) onEmptyCellClick(i)
                }}
              >
                {img ? (
                  <img
                    src={img.url}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute max-w-none"
                    style={{ left: x0, top: y0, width: d!.w, height: d!.h }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImagePlus className="size-6" />
                  </div>
                )}
              </div>
            )
          })}

          {/* row dividers */}
          {rowFracs.slice(0, -1).map((_, i) => {
            const y = box.y + (cumRows[i] + rowFracs[i]) * box.h
            return (
              <div
                key={`r${i}`}
                role="separator"
                aria-orientation="horizontal"
                aria-label={t('collage.dividerRow')}
                tabIndex={0}
                className="absolute z-10 cursor-row-resize focus-visible:ring-2 focus-visible:ring-ring"
                style={{ left: box.x, top: y - 8, width: box.w, height: 16 }}
                onKeyDown={(e) => {
                  const delta = e.key === 'ArrowDown' ? 0.02 : e.key === 'ArrowUp' ? -0.02 : 0
                  if (!delta) return
                  e.preventDefault()
                  onRowFracs(dividerUtils.dragDivider(rowFracs, i, delta))
                }}
                onPointerDown={(e) => dividerDown('row', i, e)}
                onPointerMove={dividerMove}
                onPointerUp={dividerUp}
              >
                <div className="mx-auto h-[3px] w-10 rounded-full bg-primary/40 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" style={{ marginTop: 6.5 }} />
              </div>
            )
          })}
          {/* col dividers */}
          {colFracs.slice(0, -1).map((_, i) => {
            const x = box.x + (cumCols[i] + colFracs[i]) * box.w
            return (
              <div
                key={`c${i}`}
                role="separator"
                aria-orientation="vertical"
                aria-label={t('collage.dividerCol')}
                tabIndex={0}
                className="absolute z-10 cursor-col-resize focus-visible:ring-2 focus-visible:ring-ring"
                style={{ left: x - 8, top: box.y, width: 16, height: box.h }}
                onKeyDown={(e) => {
                  const delta = e.key === 'ArrowRight' ? 0.02 : e.key === 'ArrowLeft' ? -0.02 : 0
                  if (!delta) return
                  e.preventDefault()
                  onColFracs(dividerUtils.dragDivider(colFracs, i, delta))
                }}
                onPointerDown={(e) => dividerDown('col', i, e)}
                onPointerMove={dividerMove}
                onPointerUp={dividerUp}
              >
                <div className="h-10 w-[3px] rounded-full bg-primary/40 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" style={{ marginLeft: 6.5 }} />
              </div>
            )
          })}

          {/* swap ghost */}
          {ghost && dragCell !== null && images[dragCell] && (
            <img
              src={images[dragCell]!.url}
              alt=""
              className="pointer-events-none fixed z-50 size-16 rounded-md object-cover opacity-80 shadow-lg"
              style={{ left: ghost.x - 32, top: ghost.y - 32 }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// hoisted import indirection to keep pointer handlers tidy
import { dragDivider as _dragDivider } from '@/lib/templates'
const dividerUtils = { dragDivider: _dragDivider }
