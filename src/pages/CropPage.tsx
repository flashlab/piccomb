import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import {
  Download,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import UploadHero from '@/components/UploadHero'
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
  cropWithRotation,
  downloadBlob,
  timestampName,
  type ExportFormat,
} from '@/lib/export'
import { flipImage, loadImageFile, releaseImage, type LoadedImage } from '@/lib/images'
import { ID_PHOTO_PRESETS } from '@/lib/sizePresets'
import { useUnloadGuard } from '@/lib/useUnloadGuard'
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
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [format, setFormat] = useState<ExportFormat>('jpeg')
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [busy, setBusy] = useState(false)
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
  }, [])

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

  const rotate = (delta: number) => setRotation((r) => (((r + delta) % 360) + 360) % 360)

  const doExport = async () => {
    if (!working || !areaPixels) return
    setBusy(true)
    try {
      const canvas = cropWithRotation(working.el, areaPixels, rotation)
      const blob = await canvasToBlob(canvas, format, quality)
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
        <p className="mt-3 text-xs text-muted-foreground">
          {t('crop.title')} · {rotation}°
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
          <Label className="text-xs text-muted-foreground">{t('crop.rotateFlip')}</Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => rotate(-45)}>
              <RotateCcw className="size-3.5" /> 45°
            </Button>
            <Button variant="outline" size="sm" onClick={() => rotate(45)}>
              <RotateCw className="size-3.5" /> 45°
            </Button>
            <Toggle pressed={flipH} onPressedChange={setFlipH} aria-label={t('crop.flipH')}>
              <FlipHorizontal2 className="size-3.5" />
            </Toggle>
            <Toggle pressed={flipV} onPressedChange={setFlipV} aria-label={t('crop.flipV')}>
              <FlipVertical2 className="size-3.5" />
            </Toggle>
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
            <Button
              variant={ratioId === 'custom' ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setRatioId('custom')}
            >
              {t('collage.customSize')}
            </Button>
            <Input
              type="number"
              min={1}
              value={customW}
              aria-label={t('crop.ratioW')}
              autoComplete="off"
              onChange={(e) => {
                setCustomW(Math.max(1, Number(e.target.value) || 1))
                setRatioId('custom')
              }}
              className="h-8 w-16"
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              min={1}
              value={customH}
              aria-label={t('crop.ratioH')}
              autoComplete="off"
              onChange={(e) => {
                setCustomH(Math.max(1, Number(e.target.value) || 1))
                setRatioId('custom')
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
            onValueChange={(v) => setZoom(typeof v === 'number' ? v : (v[0] ?? zoom))}
          />
        </div>

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
