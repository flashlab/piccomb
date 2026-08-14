import { useTranslation } from 'react-i18next'
import { Copy, Download, Loader2 } from 'lucide-react'
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
import { ALL_PRESETS, PRINT_PRESETS, RATIO_PRESETS } from '@/lib/sizePresets'
import { DEFAULT_QUALITY, type ExportFormat } from '@/lib/export'

export interface ExportSettings {
  presetId: string
  customW: number
  customH: number
  format: ExportFormat
  quality: number
}

interface Props {
  settings: ExportSettings
  onChange: (s: ExportSettings) => void
  onExport: () => void
  exporting: boolean
  exportLabel: string
  /** when set, shows a copy-to-clipboard button */
  onCopy?: () => void
}

export default function ExportPanel({ settings, onChange, onExport, exporting, exportLabel, onCopy }: Props) {
  const { t } = useTranslation()
  const set = (patch: Partial<ExportSettings>) => onChange({ ...settings, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t('collage.size')}</Label>
        <Select value={settings.presetId} onValueChange={(v) => v && set({ presetId: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATIO_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {t(`sizes.${p.labelKey}`)} · {p.w}×{p.h}
              </SelectItem>
            ))}
            {PRINT_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {t(`sizes.${p.labelKey}`)} · {p.w}×{p.h}
              </SelectItem>
            ))}
            <SelectItem value="custom">{t('collage.customSize')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {settings.presetId === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('collage.width')}</Label>
            <Input
              type="number"
              min={1}
              name="customW"
              autoComplete="off"
              value={settings.customW}
              onChange={(e) => set({ customW: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('collage.height')}</Label>
            <Input
              type="number"
              min={1}
              name="customH"
              autoComplete="off"
              value={settings.customH}
              onChange={(e) => set({ customH: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('export.format')}</Label>
          <Select value={settings.format} onValueChange={(v) => v && set({ format: v as ExportFormat })}>
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
        {settings.format !== 'png' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('export.quality')} · {Math.round(settings.quality * 100)}%
            </Label>
            <Slider
              value={[settings.quality]}
              min={0.1}
              max={1}
              step={0.01}
              aria-label={t('export.quality')}
              onValueChange={(v) => set({ quality: typeof v === 'number' ? v : (v[0] ?? settings.quality) })}
              className="mt-3"
            />
          </div>
        )}
      </div>

      <Button className="w-full" size="lg" onClick={onExport} disabled={exporting}>
        {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {exporting ? t('export.exporting') : exportLabel}
      </Button>
      {onCopy && (
        <Button variant="outline" className="w-full" onClick={onCopy} disabled={exporting}>
          <Copy className="size-4" />
          {t('collage.copyClipboard')}
        </Button>
      )}
      {settings.presetId !== 'custom' && (
        <p className="text-center text-xs text-muted-foreground">
          {ALL_PRESETS.find((p) => p.id === settings.presetId)?.w}×
          {ALL_PRESETS.find((p) => p.id === settings.presetId)?.h}px
        </p>
      )}
    </div>
  )
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  presetId: '1:1',
  customW: 2000,
  customH: 2000,
  format: 'png',
  quality: DEFAULT_QUALITY,
}
