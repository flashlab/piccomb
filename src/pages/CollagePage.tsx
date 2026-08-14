import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Shuffle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import CollageCanvas from '@/components/collage/CollageCanvas'
import LeaveGuard from '@/components/LeaveGuard'
import ExportPanel, { DEFAULT_EXPORT_SETTINGS, type ExportSettings } from '@/components/collage/ExportPanel'
import ImageStrip from '@/components/collage/ImageStrip'
import StylePanel from '@/components/collage/StylePanel'
import TemplatePicker from '@/components/collage/TemplatePicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IDENTITY_TRANSFORM, type ImageTransform } from '@/lib/geometry'
import { canvasToBlob, downloadBlob, renderCollage, timestampName } from '@/lib/export'
import { loadImageFiles, releaseImage, type LoadedImage } from '@/lib/images'
import { presetSize } from '@/lib/sizePresets'
import { DEFAULT_STYLE } from '@/lib/style'
import { MAX_IMAGES, matchTemplate, templatesForCount, uniformFractions } from '@/lib/templates'
import { useUnloadGuard } from '@/lib/useUnloadGuard'
import { usePasteImages } from '@/lib/usePasteImages'

const imageCountGuard = (cells: (LoadedImage | null)[]) => cells.some(Boolean)

export default function CollagePage() {
  const { t } = useTranslation()
  /** dense per-cell array, length always equals template.count */
  const [cells, setCells] = useState<(LoadedImage | null)[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [rowFracs, setRowFracs] = useState<number[]>([1])
  const [colFracs, setColFracs] = useState<number[]>([1])
  const [transforms, setTransforms] = useState<ImageTransform[]>([])
  const [style, setStyle] = useState(DEFAULT_STYLE)
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const viewScale = useRef(1)
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingCell = useRef<number | null>(null)
  const trash = useRef<(LoadedImage | null)[]>([])
  useUnloadGuard(imageCountGuard(cells))
  const [isCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )
  const hintKey = isCoarse ? 'collage.hintTouch' : 'collage.hint'

  const imageCount = cells.filter(Boolean).length
  const template = useMemo(
    () => matchTemplate(Math.max(1, imageCount), templateId),
    [imageCount, templateId],
  )

  /** reset geometry whenever the template identity changes */
  const applyTemplate = useCallback(
    (
      id: string | null,
      baseCells: (LoadedImage | null)[],
      baseTransforms?: ImageTransform[],
    ) => {
      const tpl = matchTemplate(Math.max(1, baseCells.filter(Boolean).length), id)
      setTemplateId(tpl.id)
      setRowFracs(uniformFractions(tpl.rows))
      setColFracs(uniformFractions(tpl.cols))
      // normalize cell array to template length
      const next = baseCells.slice(0, tpl.count)
      while (next.length < tpl.count) next.push(null)
      setCells(next)
      // transforms stay aligned with their images when provided
      const nt = baseTransforms ? baseTransforms.slice(0, tpl.count) : []
      while (nt.length < tpl.count) nt.push({ ...IDENTITY_TRANSFORM })
      setTransforms(nt)
      setSelectedIndex(null)
    },
    [],
  )

  const addFiles = useCallback(
    async (files: Iterable<File>, targetCell: number | null = null) => {
      const loaded = await loadImageFiles(files)
      if (loaded.length === 0) return
      const next = [...cells]
      if (targetCell !== null) {
        // replace/insert into the clicked cell
        while (next.length <= targetCell) next.push(null)
        if (next[targetCell]) releaseImage(next[targetCell]!)
        next[targetCell] = loaded[0]
        // extra files flow into other empty cells
        let li = 1
        for (let i = 0; i < next.length && li < loaded.length; i++)
          if (!next[i]) { next[i] = loaded[li++]; }
        // still remaining → grow
        while (li < loaded.length) {
          if (next.filter(Boolean).length >= MAX_IMAGES) { releaseImage(loaded[li]); li++; continue }
          next.push(loaded[li++])
        }
      } else {
        let li = 0
        for (let i = 0; i < next.length && li < loaded.length; i++)
          if (!next[i]) { next[i] = loaded[li++]; }
        while (li < loaded.length) {
          if (next.filter(Boolean).length >= MAX_IMAGES) { releaseImage(loaded[li]); li++; continue }
          next.push(loaded[li++])
        }
      }
      const trimmed = next.filter((c, i) => c || i < template.count)
      applyTemplate(null, trimmed.length ? trimmed : [])
    },
    [cells, template.count, applyTemplate],
  )

  usePasteImages(
    useCallback((files: File[]) => void addFiles(files), [addFiles]),
  )

  const removeAt = (i: number) => {
    const img = cells[i]
    if (img) releaseImage(img)
    // dense repack: drop cell i, keep the rest aligned with their transforms
    const keep = cells.map((c, idx) => (c && idx !== i ? idx : -1)).filter((idx) => idx >= 0)
    const denseCells = keep.map((idx) => cells[idx])
    const denseTransforms = keep.map((idx) => transforms[idx] ?? { ...IDENTITY_TRANSFORM })
    if (denseCells.length === 0) {
      setCells([])
      setTransforms([])
      setTemplateId(null)
      setSelectedIndex(null)
      return
    }
    applyTemplate(templateId, denseCells, denseTransforms)
  }

  const clearAll = () => {
    // keep object URLs alive in the stash so the undo toast can restore
    trash.current.forEach((c) => c && releaseImage(c))
    trash.current = cells
    setCells([])
    setTemplateId(null)
    setSelectedIndex(null)
    toast.success(t('common.cleared'), {
      action: {
        label: t('common.undo'),
        onClick: () => {
          applyTemplate(null, trash.current)
          trash.current = []
        },
      },
    })
  }

  const swap = (from: number, to: number) => {
    setCells((prev) => {
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
    // keep transforms attached to images, not positions
    setTransforms((prev) => {
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  }

  const pickTemplate = (id: string) => {
    if (id === template.id) return
    const tpl = matchTemplate(imageCount, id)
    applyTemplate(tpl.id, cells, transforms)
  }

  const pickRandom = () => {
    const pool = templatesForCount(template.count).filter((t) => t.id !== template.id)
    if (pool.length === 0) return
    applyTemplate(pool[Math.floor(Math.random() * pool.length)].id, cells, transforms)
  }

  const renderCurrent = () => {
    const K = viewScale.current || 1
    const scaledTransforms = transforms.map((t) => ({
      scale: t.scale,
      x: t.x / K,
      y: t.y / K,
      rotation: t.rotation,
    }))
    return renderCollage({
      images: cells.map((c) => c?.el ?? null),
      template,
      rowFracs,
      colFracs,
      transforms: scaledTransforms,
      style,
      out,
    })
  }

  const doCopy = async () => {
    if (imageCount === 0) return
    setExporting(true)
    try {
      const blob = await canvasToBlob(renderCurrent(), 'png')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success(t('collage.copied'))
    } catch (err) {
      console.error(err)
      toast.error(t('export.failed'))
    } finally {
      setExporting(false)
    }
  }

  const out =
    exportSettings.presetId === 'custom'
      ? { w: exportSettings.customW, h: exportSettings.customH }
      : (presetSize(exportSettings.presetId) ?? { w: 2000, h: 2000 })

  const doExport = async () => {
    if (imageCount === 0) return
    setExporting(true)
    try {
      const canvas = renderCurrent()
      const blob = await canvasToBlob(canvas, exportSettings.format, exportSettings.quality)
      downloadBlob(blob, timestampName('collage', exportSettings.format))
      toast.success(t('export.success'))
    } catch (err) {
      console.error(err)
      toast.error(t('export.failed'))
    } finally {
      setExporting(false)
    }
  }

  /* ---------- empty state ---------- */
  if (imageCount === 0) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files) }}
      >
        <h1 className="sr-only">{t('collage.title')}</h1>
        <Card
          role="button"
          tabIndex={0}
          aria-label={t('common.upload')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInput.current?.click()
            }
          }}
          className={`w-full max-w-xl cursor-pointer border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:ring-ring ${dragOver ? 'border-primary bg-accent/40' : ''}`}
          onClick={() => fileInput.current?.click()}
        >
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ImagePlus className="size-10 text-muted-foreground" />
            <p className="font-medium">{t('common.uploadHint')}</p>
            <p className="text-sm text-muted-foreground">{t(hintKey)}</p>
          </CardContent>
        </Card>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files, pendingCell.current)
            e.target.value = ''
            pendingCell.current = null
          }}
        />
      </div>
    )
  }

  /* ---------- editor ---------- */
  return (
    <div
      className="flex flex-col gap-6 lg:flex-row"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files) }}
    >
      <h1 className="sr-only">{t('collage.title')}</h1>
      <LeaveGuard active={imageCount > 0} />
      <div className="min-w-0 flex-1">
        <CollageCanvas
          images={cells}
          template={template}
          rowFracs={rowFracs}
          colFracs={colFracs}
          transforms={transforms}
          style={style}
          out={out}
          selectedIndex={selectedIndex}
          onTransformChange={(i, tr) =>
            setTransforms((prev) => prev.map((p, idx) => (idx === i ? tr : p)))
          }
          onSwap={swap}
          onSelect={setSelectedIndex}
          onRowFracs={setRowFracs}
          onColFracs={setColFracs}
          onEmptyCellClick={(i) => {
            pendingCell.current = i
            fileInput.current?.click()
          }}
          onViewScale={(k) => {
            if (Math.abs(viewScale.current - k) > 1e-4) viewScale.current = k
          }}
        />
        <p className="mt-3 text-xs text-muted-foreground">{t(hintKey)}</p>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('collage.imageCount', { count: imageCount })}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => { pendingCell.current = null; fileInput.current?.click() }}>
              <ImagePlus className="size-3.5" /> {t('collage.addImages')}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-3.5" /> {t('common.clear')}
            </Button>
          </div>
        </div>
        <ImageStrip images={cells} selectedIndex={selectedIndex} onSelect={setSelectedIndex} onRemove={removeAt} />
        <Separator />

        <Tabs defaultValue="templates">
          <TabsList className="w-full">
            <TabsTrigger value="templates" className="flex-1">{t('collage.templates')}</TabsTrigger>
            <TabsTrigger value="style" className="flex-1">{t('collage.style')}</TabsTrigger>
          </TabsList>
          <TabsContent value="templates" className="space-y-2 pt-3">
            <Button variant="outline" size="sm" className="w-full" onClick={pickRandom}>
              <Shuffle className="size-3.5" /> {t('collage.random')}
            </Button>
            <TemplatePicker count={template.count} activeId={template.id} onPick={pickTemplate} />
          </TabsContent>
          <TabsContent value="style" className="pt-3">
            <StylePanel style={style} onChange={setStyle} />
          </TabsContent>
        </Tabs>

        <Separator />
        <ExportPanel
          settings={exportSettings}
          onChange={setExportSettings}
          onExport={() => void doExport()}
          exporting={exporting}
          exportLabel={t('collage.export')}
          onCopy={() => void doCopy()}
        />
      </aside>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files, pendingCell.current)
          e.target.value = ''
          pendingCell.current = null
        }}
      />
    </div>
  )
}
