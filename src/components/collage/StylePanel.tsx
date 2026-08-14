import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { STYLE_LIMITS, type CollageStyle } from '@/lib/style'

/** Base UI slider emits number | readonly number[] — we only use single-thumb */
const first = (v: number | readonly number[], fallback: number): number =>
  typeof v === 'number' ? v : (v[0] ?? fallback)

interface Props {
  style: CollageStyle
  onChange: (s: CollageStyle) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export default function StylePanel({ style, onChange }: Props) {
  const { t } = useTranslation()
  const L = STYLE_LIMITS
  const set = (patch: Partial<CollageStyle>) => onChange({ ...style, ...patch })
  const setBorder = (side: keyof CollageStyle['borderWidths'], v: number) =>
    set({ borderWidths: { ...style.borderWidths, [side]: v } })

  const borders: { key: keyof CollageStyle['borderWidths']; label: string }[] = [
    { key: 'top', label: t('collage.borderTop') },
    { key: 'right', label: t('collage.borderRight') },
    { key: 'bottom', label: t('collage.borderBottom') },
    { key: 'left', label: t('collage.borderLeft') },
  ]

  return (
    <div className="space-y-4">
      <Row label={`${t('collage.spacing')} · ${style.spacing}`}>
        <Slider
          aria-label={t('collage.spacing')}
          value={[style.spacing]}
          min={L.spacing.min}
          max={L.spacing.max}
          step={1}
          onValueChange={(v) => set({ spacing: first(v, style.spacing) })}
        />
      </Row>
      <Row label={`${t('collage.radius')} · ${style.radius}`}>
        <Slider
          aria-label={t('collage.radius')}
          value={[style.radius]}
          min={L.radius.min}
          max={L.radius.max}
          step={1}
          onValueChange={(v) => set({ radius: first(v, style.radius) })}
        />
      </Row>
      <Row label={t('collage.bgColor')}>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={style.bgColor}
            onChange={(e) => set({ bgColor: e.target.value })}
            className="h-8 w-14 cursor-pointer p-1"
          />
          <span className="text-xs text-muted-foreground">{style.bgColor}</span>
        </div>
      </Row>
      <Row label={t('collage.borders')}>
        <div className="grid grid-cols-2 gap-3">
          {borders.map((b) => (
            <div key={b.key} className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {b.label} · {style.borderWidths[b.key]}
              </span>
              <Slider
                aria-label={b.label}
                value={[style.borderWidths[b.key]]}
                min={L.border.min}
                max={L.border.max}
                step={1}
                onValueChange={(v) => setBorder(b.key, first(v, style.borderWidths[b.key]))}
              />
            </div>
          ))}
        </div>
      </Row>
    </div>
  )
}
