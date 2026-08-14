import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Trash2 } from 'lucide-react'
import JSZip from 'jszip'
import { toast } from 'sonner'
import UploadHero from '@/components/UploadHero'
import LeaveGuard from '@/components/LeaveGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  DEFAULT_QUALITY,
  canvasToBlob,
  downloadBlob,
  flattenForFormat,
  splitImage,
  splitTileName,
  timestampName,
  type ExportFormat,
} from '@/lib/export'

/** Base UI Select.Value needs an explicit items map or it shows the raw value */
const FORMAT_ITEMS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
]
import { loadImageFile, releaseImage, type LoadedImage } from '@/lib/images'
import { useUnloadGuard } from '@/lib/useUnloadGuard'
import { usePasteImages } from '@/lib/usePasteImages'

export default function SplitPage() {
  const { t } = useTranslation()
  const [img, setImg] = useState<LoadedImage | null>(null)
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [format, setFormat] = useState<ExportFormat>('jpeg')
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [busy, setBusy] = useState(false)
  /** selected tile keys "r-c" for partial download */
  const [selected, setSelected] = useState<Set<string>>(new Set())
  useUnloadGuard(img !== null)

  const tiles = useMemo(() => rows * cols, [rows, cols])

  const onFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const loaded = await loadImageFile(files[0])
    setImg((prev) => {
      if (prev) releaseImage(prev)
      return loaded
    })
    setSelected(new Set())
  }, [])

  usePasteImages(onFiles)

  const reset = () => {
    if (!img) return
    const stashed = img
    setImg(null)
    toast.success(t('common.cleared'), {
      action: { label: t('common.undo'), onClick: () => setImg(stashed) },
    })
  }

  const clampNum = (v: number) => Math.max(1, Math.min(10, Math.round(v) || 1))
  const setGrid = (r: number, c: number) => {
    setRows(r)
    setCols(c)
    setSelected(new Set())
  }
  const toggleTile = (r: number, c: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const key = `${r}-${c}`
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** render tiles on demand and hand each to cb(row, col, canvas) */
  const eachTile = useCallback(
    (cb: (r: number, c: number, canvas: HTMLCanvasElement) => void | Promise<void>) => {
      if (!img) return Promise.resolve()
      const canvases = splitImage(img.el, rows, cols)
      const jobs: (void | Promise<void>)[] = []
      canvases.forEach((canvas, i) => jobs.push(cb(Math.floor(i / cols), i % cols, canvas)))
      return Promise.all(jobs).then(() => undefined)
    },
    [img, rows, cols],
  )

  const downloadOne = async (r: number, c: number, canvas: HTMLCanvasElement) => {
    const blob = await canvasToBlob(flattenForFormat(canvas, format), format, quality)
    downloadBlob(blob, splitTileName(img!.name, r, c, format))
  }

  const downloadZip = async () => {
    if (!img) return
    setBusy(true)
    try {
      const zip = new JSZip()
      await eachTile(async (r, c, canvas) => {
        const blob = await canvasToBlob(flattenForFormat(canvas, format), format, quality)
        zip.file(splitTileName(img.name, r, c, format), blob)
      })
      const blob = await zip.generateAsync({ type: 'blob' })
      const ext = format === 'jpeg' ? 'jpg' : format
      downloadBlob(blob, timestampName('split', format).replace(`.${ext}`, '.zip'))
      toast.success(t('export.success'))
    } catch (err) {
      console.error(err)
      toast.error(t('export.failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!img) return <UploadHero onFiles={(f) => void onFiles(f)} hint={t('split.hint')} />

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <h1 className="sr-only">{t('split.title')}</h1>
      <LeaveGuard active={img !== null} />
      <div className="min-w-0 flex-1">
        <div className="relative mx-auto inline-block w-full max-w-3xl">
          <img
            src={img.url}
            alt={img.name}
            width={img.w}
            height={img.h}
            className="block h-auto w-full rounded-md"
            draggable={false}
          />
          {/* grid overlay */}
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: rows - 1 }, (_, i) => (
              <div
                key={`r${i}`}
                className="absolute left-0 right-0 border-t border-dashed border-primary/70"
                style={{ top: `${((i + 1) / rows) * 100}%` }}
              />
            ))}
            {Array.from({ length: cols - 1 }, (_, i) => (
              <div
                key={`c${i}`}
                className="absolute bottom-0 top-0 border-l border-dashed border-primary/70"
                style={{ left: `${((i + 1) / cols) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          {t('split.tileSize')} · {Math.floor(img.w / cols)}×{Math.floor(img.h / rows)}px
        </p>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('split.tiles', { count: tiles })}</span>
          <Button variant="ghost" size="sm" onClick={reset}>
            <Trash2 className="size-3.5" /> {t('common.clear')}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            [2, 2],
            [3, 3],
            [4, 4],
            [1, 4],
            [1, 6],
            [6, 1],
          ].map(([r, c]) => (
            <Button
              key={`${r}x${c}`}
              variant={rows === r && cols === c ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setGrid(r, c)}
            >
              {r}×{c}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('split.rows')}</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => setGrid(clampNum(Number(e.target.value)), cols)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('split.cols')}</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={cols}
              onChange={(e) => setGrid(rows, clampNum(Number(e.target.value)))}
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('export.format')}</Label>
            <Select
              value={format}
              onValueChange={(v) => v && setFormat(v as ExportFormat)}
              items={FORMAT_ITEMS}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {format !== 'png' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('export.quality')} · {Math.round(quality * 100)}%
              </Label>
              <Slider
                value={[quality]}
                min={0.1}
                max={1}
                step={0.01}
                onValueChange={(v) => setQuality(typeof v === 'number' ? v : (v[0] ?? quality))}
                className="mt-3"
              />
            </div>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={() => void downloadZip()} disabled={busy}>
          <Download className="size-4" /> {t('common.downloadAll')}
        </Button>
        <Button
          variant="outline"
          className="w-full border-primary/60 text-primary hover:bg-primary/10"
          size="lg"
          disabled={busy || selected.size === 0}
          onClick={() =>
            void eachTile((r, c, canvas) => {
              if (selected.has(`${r}-${c}`)) return downloadOne(r, c, canvas)
            })
          }
        >
          <Download className="size-4" />
          {t('split.downloadSelected')}
          {selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>

        <Separator />
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.min(cols, 5)}, 1fr)` }}
        >
          {Array.from({ length: tiles }, (_, i) => {
            const r = Math.floor(i / cols)
            const c = i % cols
            const on = selected.has(`${r}-${c}`)
            return (
              <Button
                key={i}
                variant={on ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                aria-pressed={on}
                onClick={() => toggleTile(r, c)}
              >
                r{r + 1}c{c + 1}
              </Button>
            )
          })}
        </div>

        <p className="pt-2 text-right text-xs tabular-nums text-muted-foreground">
          {t('split.sourceSize')} · {img.w}×{img.h}px
        </p>
      </aside>
    </div>
  )
}
