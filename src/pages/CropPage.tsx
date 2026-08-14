import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import {
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Link2,
  Trash2,
  Unlink2,
} from 'lucide-react'
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
import { Toggle } from '@/components/ui/toggle'
import {
  DEFAULT_QUALITY,
  canvasToBlob,
  cornerRadiusPx,
  cropWithRotation,
  downloadBlob,
  flattenForFormat,
  timestampName,
  type ExportFormat,
} from '@/lib/export'
import { flipImage, loadImageFile, releaseImage, type LoadedImage } from '@/lib/images'
import { ID_PHOTO_PRESETS } from '@/lib/sizePresets'
import { angleToSlider, clamp, sliderToAngle } from '@/lib/geometry'
import { useUnloadGuard } from '@/lib/useUnloadGuard'
import { usePasteImages } from '@/lib/usePasteImages'
import { cn } from '@/lib/utils'

const RATIOS: { id: string; value: number | undefined }[] = [
  { id: 'free', value: undefined },
  { id: '1:1', value: 1 },
  { id: '4:3', value: 4 / 3 },
  { id: '3:4', value: 3 / 4 },
  { id: '16:9', value: 16 / 9 },
  { id: '9:16', value: 9 / 16 },
  { id: '3:2', value: 3 / 2 },
  { id: '2:3', value: 2 / 3 },
]

export default function CropPage() {
  const { t } = useTranslation()
  const [original, setOriginal] = useState<LoadedImage | null>(null)
  const [working, setWorking] = useState<LoadedImage | null>(null)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [ratioId, setRatioId] = useState('free')
  const [customW, setCustomW] = useState(3)
  const [customH, setCustomH] = useState(2)
  const [customMode, setCustomMode] = useState<'ratio' | 'size'>('ratio')
  const [draftW, setDraftW] = useState('3')
  const [draftH, setDraftH] = useState('2')
  /** when set, the two custom inputs are coupled at this w/h ratio */
  const [lockedRatio, setLockedRatio] = useState<number | null>(null)
  const pendingSize = useRef<{ w: number; h: number } | null>(null)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [radiusPct, setRadiusPct] = useState(0)
  const [format, setFormat] = useState<ExportFormat>('jpeg')
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [busy, setBusy] = useState(false)
  const previewRef = useRef<HTMLCanvasElement>(null)
  useUnloadGuard(original !== null)

  // re-bake the flip bitmap whenever flips change
  useEffect(() => {
    if (!original) return
    if (!flipH && !flipV) {
      setWorking(original)
      return
    }
    let cancelled = false
    void flipImage(original, flipH, flipV).then((img) => {
      if (cancelled) {
        releaseImage(img)
        return
      }
      setWorking((prev) => {
        if (prev && prev !== original) releaseImage(prev)
        return img
      })
    })
    return () => {
      cancelled = true
    }
  }, [original, flipH, flipV])

  const onFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const loaded = await loadImageFile(files[0])
    setOriginal((prev) => {
      if (prev) releaseImage(prev)
      return loaded
    })
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setRatioId('free')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRadiusPct(0)
  }, [])

  usePasteImages(onFiles)

  const reset = () => {
    if (!original) return
    const stashed = original
    if (working && working !== original) releaseImage(working)
    setOriginal(null)
    setWorking(null)
    toast.success(t('common.cleared'), {
      action: { label: t('common.undo'), onClick: () => setOriginal(stashed) },
    })
  }

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels)
  }, [])

  const aspect = useMemo(() => {
    if (ratioId === 'custom') {
      const w = Math.max(1, customW)
      const h = Math.max(1, customH)
      return w / h
    }
    const id = ID_PHOTO_PRESETS.find((p) => p.id === ratioId)
    if (id) return id.w / id.h
    return RATIOS.find((r) => r.id === ratioId)?.value
  }, [ratioId, customW, customH])

  /**
   * Commit the custom inputs (Enter / blur / apply button). Ratio mode just
   * re-targets the aspect; size mode additionally solves the zoom that makes
   * the crop area land on the requested pixel width — exact in one step
   * because cropped pixels scale ∝ 1/zoom.
   */
  const applyCustom = () => {
    const w = Math.max(1, Math.round(Number(draftW) || 1))
    const h = Math.max(1, Math.round(Number(draftH) || 1))
    setDraftW(String(w))
    setDraftH(String(h))
    const aspectUnchanged = ratioId === 'custom' && customW === w && customH === h
    if (customMode === 'size') {
      if (aspectUnchanged && areaPixels && areaPixels.width > 0) {
        setZoom((z) => clamp(z * (areaPixels.width / w), 1, 5))
      } else {
        // consumed once easy-crop reports the area for the new aspect
        pendingSize.current = { w, h }
      }
    }
    setCustomW(w)
    setCustomH(h)
    setRatioId('custom')
  }

  // one-shot zoom correction once the area for a freshly applied size arrives
  useEffect(() => {
    if (!pendingSize.current || !areaPixels || areaPixels.width <= 0) return
    const { w } = pendingSize.current
    pendingSize.current = null
    setZoom((z) => clamp(z * (areaPixels.width / w), 1, 5))
  }, [areaPixels])

  /** draft edits keep the locked ratio by recomputing the other field */
  const onDraftW = (raw: string) => {
    setDraftW(raw)
    if (lockedRatio) {
      const w = Number(raw)
      if (w > 0) setDraftH(String(Math.max(1, Math.round(w / lockedRatio))))
    }
  }
  const onDraftH = (raw: string) => {
    setDraftH(raw)
    if (lockedRatio) {
      const h = Number(raw)
      if (h > 0) setDraftW(String(Math.max(1, Math.round(h * lockedRatio))))
    }
  }
  const toggleRatioLock = () => {
    if (lockedRatio) {
      setLockedRatio(null)
    } else {
      const w = Number(draftW) || 1
      const h = Number(draftH) || 1
      setLockedRatio(w / h)
    }
  }

  /** exact export result, re-rendered into the small preview canvas */
  useEffect(() => {
    const cv = previewRef.current
    if (!cv || !working || !areaPixels) return
    const radius = cornerRadiusPx(radiusPct, { w: areaPixels.width, h: areaPixels.height })
    const full = cropWithRotation(working.el, areaPixels, rotation, radius)
    const scale = Math.min(1, 240 / Math.max(full.width, full.height))
    cv.width = Math.max(1, Math.round(full.width * scale))
    cv.height = Math.max(1, Math.round(full.height * scale))
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(full, 0, 0, cv.width, cv.height)
  }, [working, areaPixels, rotation, radiusPct])

  const doExport = async () => {
    if (!working || !areaPixels) return
    setBusy(true)
    try {
      const radius = cornerRadiusPx(radiusPct, { w: areaPixels.width, h: areaPixels.height })
      const canvas = cropWithRotation(working.el, areaPixels, rotation, radius)
      const blob = await canvasToBlob(flattenForFormat(canvas, format), format, quality)
      downloadBlob(blob, timestampName('crop', format))
      toast.success(t('export.success'))
    } catch (err) {
      console.error(err)
      toast.error(t('export.failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!original) return <UploadHero onFiles={(f) => void onFiles(f)} hint={t('crop.title')} />

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <h1 className="sr-only">{t('crop.title')}</h1>
      <LeaveGuard active={original !== null} />
      <div className="min-w-0 flex-1">
        <div className="relative h-[60vh] w-full overflow-hidden rounded-md bg-muted/30">
          {working && (
            <Cropper
              image={working.url}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          {areaPixels
            ? `[${Math.round(areaPixels.x)}, ${Math.round(areaPixels.y)}] · ${Math.round(areaPixels.width)}×${Math.round(areaPixels.height)}px · ${rotation.toFixed(1)}°`
            : t('crop.title')}
        </p>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('crop.title')}</span>
          <Button variant="ghost" size="sm" onClick={reset}>
            <Trash2 className="size-3.5" /> {t('common.clear')}
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('crop.rotate')} · {rotation.toFixed(1)}°
          </Label>
          <Slider
            value={[Math.round(angleToSlider(rotation) * 1000)]}
            min={0}
            max={1000}
            step={1}
            aria-label={t('crop.rotate')}
            onValueChange={(v) => {
              const s = typeof v === 'number' ? v : (v[0] ?? 0)
              setRotation(sliderToAngle(s / 1000))
            }}
          />
          <div className="flex gap-2 pt-1">
            <Toggle pressed={flipH} onPressedChange={setFlipH} aria-label={t('crop.flipH')}>
              <FlipHorizontal2 className="size-3.5" />
            </Toggle>
            <Toggle pressed={flipV} onPressedChange={setFlipV} aria-label={t('crop.flipV')}>
              <FlipVertical2 className="size-3.5" />
            </Toggle>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-xs"
              onClick={() => {
                setRotation(0)
                setFlipH(false)
                setFlipV(false)
              }}
            >
              {t('common.reset')}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('crop.ratio')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {RATIOS.map((r) => (
              <Button
                key={r.id}
                variant={ratioId === r.id ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setRatioId(r.id)}
              >
                {r.id === 'free' ? t('crop.free') : r.id}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Select
              value={customMode}
              onValueChange={(v) => v && setCustomMode(v as 'ratio' | 'size')}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ratio">{t('crop.customRatio')}</SelectItem>
                <SelectItem value="size">{t('crop.customSizePx')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={draftW}
              aria-label={t('crop.ratioW')}
              autoComplete="off"
              onChange={(e) => onDraftW(e.target.value)}
              onBlur={applyCustom}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCustom()
              }}
              className="h-8 w-16"
            />
            <button
              type="button"
              aria-pressed={lockedRatio !== null}
              aria-label={t('crop.lockRatio')}
              onClick={toggleRatioLock}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                lockedRatio !== null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {lockedRatio !== null ? (
                <Link2 className="size-3.5" />
              ) : (
                <Unlink2 className="size-3.5" />
              )}
            </button>
            <Input
              type="number"
              min={1}
              value={draftH}
              aria-label={t('crop.ratioH')}
              autoComplete="off"
              onChange={(e) => onDraftH(e.target.value)}
              onBlur={applyCustom}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCustom()
              }}
              className="h-8 w-16"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('crop.idSizes')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {ID_PHOTO_PRESETS.map((p) => (
              <Button
                key={p.id}
                variant={ratioId === p.id ? 'default' : 'outline'}
                size="sm"
                className={cn('text-xs', ratioId === p.id && '')}
                onClick={() => setRatioId(p.id)}
              >
                {t(`idphoto.${p.labelKey}`)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('crop.zoom')} · {zoom.toFixed(2)}×
          </Label>
          <Slider
            value={[zoom]}
            min={1}
            max={5}
            step={0.01}
            aria-label={t('crop.zoom')}
            onValueChange={(v) => setZoom(typeof v === 'number' ? v : (v[0] ?? zoom))}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('crop.radius')} · {radiusPct}%
          </Label>
          <Slider
            value={[radiusPct]}
            min={0}
            max={100}
            step={1}
            aria-label={t('crop.radius')}
            onValueChange={(v) => setRadiusPct(typeof v === 'number' ? v : (v[0] ?? radiusPct))}
          />
        </div>

        {areaPixels && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('crop.preview')}</Label>
            <div className="flex justify-center rounded-md border bg-muted/30 p-2">
              <canvas
                ref={previewRef}
                className="max-h-40 max-w-full"
                style={{
                  background:
                    'repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px',
                }}
              />
            </div>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('export.format')}</Label>
            <Select value={format} onValueChange={(v) => v && setFormat(v as ExportFormat)}>
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

        <Button className="w-full" size="lg" onClick={() => void doExport()} disabled={busy || !areaPixels}>
          <Download className="size-4" /> {t('crop.export')}
        </Button>
        {areaPixels && (
          <p className="text-center text-xs text-muted-foreground">
            {Math.round(areaPixels.width)}×{Math.round(areaPixels.height)}px
          </p>
        )}
      </aside>
    </div>
  )
}
