import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  BrushCleaning,
  Circle,
  Copy,
  Download,
  Grid3x3,
  MousePointer2,
  Pencil,
  Smile,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import UploadHero from '@/components/UploadHero'
import LeaveGuard from '@/components/LeaveGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import {
  PALETTE,
  BUILT_IN_EMOJI,
  bakeMosaicPatch,
  bboxOf,
  drawShape,
  emojiDefaultPx,
  emojiImageCache,
  emojiRange,
  hitTest,
  measureText,
  mosaicStrokePx,
  strokePx,
  translated,
  type Pt,
  type Shape,
  type SizeLevel,
  type StrokeShape,
  type ToolId,
} from '@/lib/annotate'
import { loadImageFile, releaseImage, type LoadedImage } from '@/lib/images'
import {
  DEFAULT_QUALITY,
  canvasToBlob,
  downloadBlob,
  flattenForFormat,
  timestampName,
  type ExportFormat,
} from '@/lib/export'
import { useUnloadGuard } from '@/lib/useUnloadGuard'
import { usePasteImages } from '@/lib/usePasteImages'
import { cn } from '@/lib/utils'

/** PS-style ring cursor for freehand tools: diameter = current stroke width */
const circleCursor = (diameter: number): string => {
  const d = Math.max(10, Math.min(96, Math.round(diameter)))
  const c = d / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${c}" cy="${c}" r="${c - 1.5}" fill="none" stroke="white" stroke-width="3"/><circle cx="${c}" cy="${c}" r="${c - 1.5}" fill="none" stroke="black" stroke-width="1.5"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`
}

const FORMAT_ITEMS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
]

const DRAW_TOOLS: { id: ToolId; icon: typeof Square }[] = [
  { id: 'select', icon: MousePointer2 },
  { id: 'rect', icon: Square },
  { id: 'ellipse', icon: Circle },
  { id: 'arrow', icon: ArrowUpRight },
  { id: 'brush', icon: Pencil },
  { id: 'mosaic', icon: Grid3x3 },
  { id: 'text', icon: Type },
  { id: 'emoji', icon: Smile },
]

const LEVELS: SizeLevel[] = [1, 2, 3]

const EMOJI_LS_KEY = 'piccomb.customEmoji'
const EMOJI_LS_MAX = 24

const loadCustomEmojis = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(EMOJI_LS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** 128×128 transparent PNG dataURL, contain-fit — small enough for localStorage */
const toEmojiDataURL = (img: LoadedImage): string => {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  const scale = Math.min(128 / img.w, 128 / img.h)
  const w = img.w * scale
  const h = img.h * scale
  ctx.drawImage(img.el, (128 - w) / 2, (128 - h) / 2, w, h)
  return c.toDataURL('image/png')
}

/** decode-and-cache a dataURL emoji, then repaint so placed copies appear */
function ensureEmojiCached(url: string, after: () => void) {
  if (emojiImageCache.has(url)) return
  const el = new Image()
  el.onload = () => {
    emojiImageCache.set(url, el)
    after()
  }
  el.src = url
}

export default function EditPage() {
  const { t } = useTranslation()
  const [img, setImg] = useState<LoadedImage | null>(null)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tool, setTool] = useState<ToolId>('select')
  const [color, setColor] = useState<string>(PALETTE[0])
  const [level, setLevel] = useState<SizeLevel>(2)
  const [fill, setFill] = useState(false)
  const [emojiPx, setEmojiPx] = useState(96)
  const [emojiPanel, setEmojiPanel] = useState(false)
  const [customEmojis, setCustomEmojis] = useState<string[]>(loadCustomEmojis)
  const [textValue, setTextValue] = useState('')
  const [hoverShape, setHoverShape] = useState(false)
  const [dispW, setDispW] = useState(0)
  const [format, setFormat] = useState<ExportFormat>('png')
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [busy, setBusy] = useState(false)

  const baseRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef<HTMLCanvasElement>(null)
  const nextId = useRef(1)
  const draftRef = useRef<Shape | null>(null)
  const moveRef = useRef<{ id: number; lastX: number; lastY: number } | null>(null)
  const pendingEmoji = useRef<{ content: string; isImage: boolean }>({ content: '😀', isImage: false })
  const lastBake = useRef(0)
  const emojiFileRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const trash = useRef<Shape[]>([])
  const rafRef = useRef(0)

  const natW = img?.el.naturalWidth ?? 0
  const natH = img?.el.naturalHeight ?? 0

  useUnloadGuard(img !== null)

  const onFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const loaded = await loadImageFile(files[0])
    setImg((prev) => {
      if (prev) releaseImage(prev)
      return loaded
    })
    setShapes([])
    setSelectedId(null)
    setTextValue('')
    setEmojiPx(emojiDefaultPx(loaded.el.naturalWidth))
  }, [])

  usePasteImages(onFiles)

  /* track display width so the ring cursor matches the on-screen stroke size */
  useEffect(() => {
    const canvas = baseRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => setDispW(canvas.clientWidth))
    ro.observe(canvas)
    setDispW(canvas.clientWidth)
    return () => ro.disconnect()
  }, [img])

  const cursor = useMemo(() => {
    if (tool === 'rect' || tool === 'ellipse' || tool === 'arrow') return 'crosshair'
    if (tool === 'text' || tool === 'emoji') return 'text'
    const k = natW > 0 ? dispW / natW : 1
    if (tool === 'brush') return circleCursor(strokePx(level, natW) * k)
    if (tool === 'mosaic') return circleCursor(mosaicStrokePx(level, natW) * k)
    return hoverShape ? 'move' : 'default'
  }, [tool, level, natW, dispW, hoverShape])

  /* ---------- painting ---------- */

  const repaint = useCallback(() => {
    const canvas = baseRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img.el, 0, 0)
    for (const s of shapes) drawShape(ctx, s, natW)
  }, [img, shapes, natW])

  useEffect(() => {
    repaint()
  }, [repaint])

  const scheduleRepaint = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(repaint)
  }

  const drawDraft = () => {
    const canvas = activeRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const d = draftRef.current
    if (!d || !img) return
    if (d.kind === 'mosaic') {
      // live mosaic preview is throttled re-baking; between bakes show the stroke
      if (!d.patch) {
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.strokeStyle = '#888'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = strokePx(d.level, natW)
        ctx.beginPath()
        d.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.stroke()
        ctx.restore()
        return
      }
    }
    drawShape(ctx, d, natW)
  }

  const clearActive = () => {
    const canvas = activeRef.current
    canvas?.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  /* ---------- pointer interaction ---------- */

  const toNatural = (e: React.PointerEvent): Pt => {
    const rect = baseRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * natW,
      y: ((e.clientY - rect.top) / rect.height) * natH,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!img || e.button !== 0) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const p = toNatural(e)

    if (tool === 'select') {
      const hit = [...shapes].reverse().find((s) => hitTest(s, p.x, p.y, natW))
      setSelectedId(hit ? hit.id : null)
      if (hit) moveRef.current = { id: hit.id, lastX: p.x, lastY: p.y }
      return
    }
    if (tool === 'text') {
      const value = textValue.trim()
      if (!value) {
        textInputRef.current?.focus()
        return
      }
      // fixed input holds the content; clicking the image stamps it there
      const { w, h } = measureText(value, level, natW)
      const s: Shape = {
        id: nextId.current++,
        kind: 'text',
        color,
        level,
        x: p.x,
        y: p.y,
        text: value,
        w,
        h,
      }
      setShapes((prev) => [...prev, s])
      setSelectedId(s.id)
      return
    }
    if (tool === 'emoji') {
      const pe = pendingEmoji.current
      const s: Shape = {
        id: nextId.current++,
        kind: 'emoji',
        color,
        level,
        x: p.x,
        y: p.y,
        content: pe.content,
        isImage: pe.isImage,
        px: emojiPx,
      }
      setShapes((prev) => [...prev, s])
      setSelectedId(s.id)
      return
    }
    // drawing tools
    setSelectedId(null)
    if (tool === 'brush' || tool === 'mosaic') {
      draftRef.current = { id: -1, kind: tool, color, level, points: [p] } as StrokeShape
    } else if (tool === 'arrow') {
      draftRef.current = { id: -1, kind: 'arrow', color, level, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
    } else if (tool === 'rect' || tool === 'ellipse') {
      draftRef.current = { id: -1, kind: tool, color, level, x: p.x, y: p.y, w: 0, h: 0, fill }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toNatural(e)
    // moving a selected shape
    if (moveRef.current) {
      const mv = moveRef.current
      // pure updater: StrictMode (dev) and concurrent React may invoke it
      // more than once — mutation here would apply the delta repeatedly
      setShapes((prev) => prev.map((s) => (s.id === mv.id ? translated(s, p.x - mv.lastX, p.y - mv.lastY) : s)))
      moveRef.current = { ...mv, lastX: p.x, lastY: p.y }
      scheduleRepaint()
      return
    }
    // hover feedback for the select cursor
    if (tool === 'select' && !draftRef.current) {
      setHoverShape(shapes.some((s) => hitTest(s, p.x, p.y, natW)))
      return
    }
    const d = draftRef.current
    if (!d) return
    if (d.kind === 'brush' || d.kind === 'mosaic') {
      const last = d.points[d.points.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 1) return
      d.points.push(p)
      if (d.kind === 'mosaic' && img && performance.now() - lastBake.current > 120) {
        lastBake.current = performance.now()
        bakeMosaicPatch(img.el, natW, natH, d)
      }
    } else if (d.kind === 'arrow') {
      d.x2 = p.x
      d.y2 = p.y
    } else if (d.kind === 'rect' || d.kind === 'ellipse') {
      d.w = p.x - d.x
      d.h = p.y - d.y
    }
    drawDraft()
  }

  const onPointerUp = () => {
    moveRef.current = null
    const d = draftRef.current
    draftRef.current = null
    if (!d || !img) return
    clearActive()
    // discard degenerate shapes
    if ((d.kind === 'rect' || d.kind === 'ellipse') && (Math.abs(d.w) < 3 || Math.abs(d.h) < 3)) return
    if (d.kind === 'arrow' && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 3) return
    if ((d.kind === 'rect' || d.kind === 'ellipse') && (d.w < 0 || d.h < 0)) {
      // normalize negative extents
      if (d.w < 0) {
        d.x += d.w
        d.w = -d.w
      }
      if (d.h < 0) {
        d.y += d.h
        d.h = -d.h
      }
    }
    if (d.kind === 'mosaic') {
      if (d.points.length < 2) return
      bakeMosaicPatch(img.el, natW, natH, d)
    }
    const committed = { ...d, id: nextId.current++ } as Shape
    setShapes((prev) => [...prev, committed])
    if (d.kind !== 'mosaic') setSelectedId(committed.id)
  }

  /* ---------- toolbar actions ---------- */

  const undo = useCallback(() => {
    setShapes((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const popped = next.pop()!
      trash.current.push(popped)
      return next
    })
    setSelectedId(null)
  }, [])

  const clearAll = () => {
    if (shapes.length === 0) return
    const stash = shapes
    setShapes([])
    setSelectedId(null)
    toast.success(t('common.cleared'), {
      action: {
        label: t('common.undo'),
        onClick: () => setShapes(stash),
      },
    })
  }

  const deleteSelected = useCallback(() => {
    setShapes((prev) => prev.filter((s) => s.id !== selectedId))
    setSelectedId(null)
  }, [selectedId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId !== null) deleteSelected()
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, deleteSelected, undo])

  /* ---------- emoji ---------- */

  const pickTool = (id: ToolId) => {
    // clicking the active emoji tool toggles its panel; anything else switches
    setEmojiPanel(id === 'emoji' ? (tool === 'emoji' ? !emojiPanel : true) : false)
    setTool(id)
    if (id === 'text') textInputRef.current?.focus()
  }

  const pickEmoji = (content: string, isImage: boolean) => {
    // panel stays open: stamping several emojis in a row is the common case
    if (isImage) ensureEmojiCached(content, scheduleRepaint)
    pendingEmoji.current = { content, isImage }
    setTool('emoji')
  }

  const onEmojiFile = async (files: File[]) => {
    if (files.length === 0) return
    const loaded = await loadImageFile(files[0])
    const dataURL = toEmojiDataURL(loaded)
    releaseImage(loaded)
    setCustomEmojis((prev) => {
      const next = [...prev.filter((d) => d !== dataURL), dataURL].slice(-EMOJI_LS_MAX)
      try {
        localStorage.setItem(EMOJI_LS_KEY, JSON.stringify(next))
      } catch {
        /* storage full — keep in-session only */
      }
      return next
    })
    emojiImageCache.set(dataURL, loaded.el as HTMLImageElement)
    pickEmoji(dataURL, true)
  }

  const removeCustomEmoji = (d: string) => {
    setCustomEmojis((prev) => {
      const next = prev.filter((x) => x !== d)
      localStorage.setItem(EMOJI_LS_KEY, JSON.stringify(next))
      return next
    })
    emojiImageCache.delete(d)
  }

  const selected = shapes.find((s) => s.id === selectedId) ?? null
  const resizeSelectedEmoji = (px: number) => {
    if (selected?.kind === 'emoji') {
      selected.px = px
      setShapes((prev) => [...prev])
      scheduleRepaint()
    } else {
      setEmojiPx(px)
    }
  }

  /* ---------- export ---------- */

  const doExport = async (copy: boolean) => {
    if (!img || !baseRef.current) return
    setBusy(true)
    try {
      const blob = copy
        ? await canvasToBlob(baseRef.current, 'png')
        : await canvasToBlob(flattenForFormat(baseRef.current, format), format, quality)
      if (copy) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        toast.success(t('collage.copied'))
      } else {
        downloadBlob(blob, timestampName('edit', format))
        toast.success(t('export.success'))
      }
    } catch (err) {
      console.error(err)
      toast.error(t('export.failed'))
    } finally {
      setBusy(false)
    }
  }

  /* ---------- render ---------- */

  if (!img) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="sr-only">{t('edit.title')}</h1>
        <UploadHero onFiles={onFiles} />
      </div>
    )
  }

  const withPalette = tool !== 'mosaic' && tool !== 'select' && tool !== 'emoji'
  const withLevels = tool !== 'select' && tool !== 'emoji'
  const [emojiMin, emojiMax] = emojiRange(natW)
  const selEmojiPx = selected?.kind === 'emoji' ? selected.px : emojiPx

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <h1 className="sr-only">{t('edit.title')}</h1>
      <LeaveGuard active={img !== null} />
      <div className="min-w-0 flex-1">
        {/* canvas stack */}
        <div className="relative mx-auto w-fit max-w-full select-none">
          <div
            className="relative touch-none overflow-hidden rounded-lg border bg-muted"
            style={{ cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={baseRef} width={natW} height={natH} className="block max-h-[70vh] w-auto max-w-full" />
            <canvas
              ref={activeRef}
              width={natW}
              height={natH}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            {/* selection box */}
            {selected && baseRef.current && (
              <SelectionBox shape={selected} natW={natW} canvas={baseRef.current} />
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-xs tabular-nums text-muted-foreground">
          {t('common.sourceSize')} · {natW}×{natH}px
        </p>
      </div>

      {/* tool panel + export sidebar */}
      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <h2 className="text-sm font-semibold">{t('edit.panelTitle')}</h2>
        {/* toolbar: 3 wrappable groups [select | draw tools | undo/clear] */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1.5">
          <div className="flex items-center gap-1">
            {DRAW_TOOLS.slice(0, 1).map(({ id, icon: Icon }) => (
              <ToolButton key={id} id={id} icon={Icon} tool={tool} onPick={pickTool} />
            ))}
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1">
            {DRAW_TOOLS.slice(1).map(({ id, icon: Icon }) => (
              <ToolButton key={id} id={id} icon={Icon} tool={tool} onPick={pickTool} />
            ))}
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.undo')}
              title={t('common.undo')}
              onClick={undo}
              disabled={shapes.length === 0}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.clear')}
              title={t('common.clear')}
              onClick={clearAll}
              disabled={shapes.length === 0}
            >
              <BrushCleaning className="size-4" />
            </Button>
            {selected && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('edit.deleteSelected')}
                title={t('edit.deleteSelected')}
                onClick={deleteSelected}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* sub toolbar */}
        <div className="flex min-h-9 flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-1.5">
          {withLevels && (
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t('edit.thickness')}>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  aria-label={`${t('edit.thickness')} ${l}`}
                  onClick={() => setLevel(l)}
                  className={cn(
                    'flex items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    l === 1 ? 'size-4' : l === 2 ? 'size-5' : 'size-6',
                    level === l ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-accent',
                  )}
                >
                  <span
                    className={cn('rounded-full', level === l ? 'bg-primary' : 'bg-muted-foreground')}
                    style={{ width: 3 + l * 2.5, height: 3 + l * 2.5 }}
                  />
                </button>
              ))}
            </div>
          )}
          {withPalette && (
            <div className="flex items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'size-5 rounded-full border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring',
                    color === c && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
          {(tool === 'rect' || tool === 'ellipse') && (
            <Toggle variant="outline" pressed={fill} onPressedChange={setFill} size="sm" aria-label={t('edit.fill')}>
              {t('edit.fill')}
            </Toggle>
          )}
          {tool === 'emoji' && (
            <div className="flex w-full items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">{t('edit.emojiSize')}</Label>
              <Slider
                value={[Math.round(selEmojiPx)]}
                min={Math.round(emojiMin)}
                max={Math.round(emojiMax)}
                step={1}
                aria-label={t('edit.emojiSize')}
                onValueChange={(v) => {
                  const x = typeof v === 'number' ? v : (v[0] ?? selEmojiPx)
                  resizeSelectedEmoji(x)
                }}
              />
            </div>
          )}
          {tool === 'select' && (
            <p className="text-xs text-muted-foreground">{t('edit.selectHint')}</p>
          )}
        </div>

        {/* fixed text input row: type here, then click the image to stamp */}
        {tool === 'text' && (
          <Input
            ref={textInputRef}
            value={textValue}
            placeholder={t('edit.textPlaceholder')}
            autoComplete="off"
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        )}

        {/* emoji panel */}
        {emojiPanel && (
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-2">
            {BUILT_IN_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pickEmoji(e, false)}
                className="flex size-9 items-center justify-center rounded-md text-xl hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                {e}
              </button>
            ))}
            {customEmojis.map((d) => (
              <span key={d.slice(-16)} className="group relative">
                <button
                  type="button"
                  onClick={() => pickEmoji(d, true)}
                  className="flex size-9 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img src={d} alt="" className="size-7 object-contain" />
                </button>
                <button
                  type="button"
                  aria-label={t('edit.deleteEmoji')}
                  onClick={() => removeCustomEmoji(d)}
                  className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-destructive text-[10px] leading-none text-white group-hover:flex"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              aria-label={t('edit.uploadEmoji')}
              onClick={() => emojiFileRef.current?.click()}
              className="flex size-9 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Upload className="size-4" />
            </button>
            <input
              ref={emojiFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onEmojiFile(Array.from(e.target.files ?? []))}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('export.format')}</Label>
            <Select value={format} onValueChange={(v) => v && setFormat(v as ExportFormat)} items={FORMAT_ITEMS}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('export.quality')} · {Math.round(quality * 100)}
            </Label>
            <Slider
              value={[Math.round(quality * 100)]}
              min={50}
              max={100}
              step={1}
              aria-label={t('export.quality')}
              className="flex h-9 items-center"
              onValueChange={(v) => setQuality((typeof v === 'number' ? v : (v[0] ?? 92)) / 100)}
            />
          </div>
        </div>
        <Button className="w-full" size="lg" onClick={() => void doExport(false)} disabled={busy}>
          <Download className="size-4" /> {t('common.download')}
        </Button>
        <Button variant="outline" className="w-full" onClick={() => void doExport(true)} disabled={busy}>
          <Copy className="size-4" /> {t('collage.copyClipboard')}
        </Button>
      </aside>
    </div>
  )
}

/* ---------- overlays ---------- */

function ToolButton({
  id,
  icon: Icon,
  tool,
  onPick,
}: {
  id: ToolId
  icon: typeof Square
  tool: ToolId
  onPick: (id: ToolId) => void
}) {
  const { t } = useTranslation()
  const label = t(`edit.tool.${id}`)
  return (
    <Button
      variant={tool === id ? 'default' : 'ghost'}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={tool === id}
      onClick={() => onPick(id)}
    >
      <Icon className="size-4" />
    </Button>
  )
}

function SelectionBox({ shape, natW, canvas }: { shape: Shape; natW: number; canvas: HTMLCanvasElement }) {
  const rect = canvas.getBoundingClientRect()
  const k = rect.width / natW
  const bb = bboxOf(shape, natW)
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute border-2 border-dashed border-primary"
      style={{
        left: bb.x * k,
        top: bb.y * k,
        width: bb.w * k,
        height: bb.h * k,
      }}
    />
  )
}
