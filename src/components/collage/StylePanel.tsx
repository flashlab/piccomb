import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Link2, Unlink2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { BG_PRESETS, STYLE_LIMITS, type CollageStyle } from '@/lib/style'
import { cn } from '@/lib/utils'

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
  const [locked, setLocked] = useState(true)
  const set = (patch: Partial<CollageStyle>) => onChange({ ...style, ...patch })
  const setBorder = (side: keyof CollageStyle['borderWidths'], v: number) => {
    if (locked) set({ borderWidths: { top: v, right: v, bottom: v, left: v } })
    else set({ borderWidths: { ...style.borderWidths, [side]: v } })
  }
  const toggleLock = () => {
    const next = !locked
    setLocked(next)
    if (next) {
      // locking aligns every side to the current "top" value
      const v = style.borderWidths.top
      set({ borderWidths: { top: v, right: v, bottom: v, left: v } })
    }
  }

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
            aria-label={t('collage.bgColor')}
          />
          <span className="text-xs tabular-nums text-muted-foreground">{style.bgColor}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BG_PRESETS.map((c) => {
            const active = style.bgColor.toUpperCase() === c
            return (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={active}
                onClick={() => set({ bgColor: c })}
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                )}
                style={{ background: c }}
              >
                {active && (
                  <Check
                    className={cn(
                      'size-3.5',
                      c === '#1F2937' || c === '#000000' ? 'text-white' : 'text-black/60',
                    )}
                  />
                )}
              </button>
            )
          })}
        </div>
      </Row>
      <Row label={t('collage.borders')}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('collage.lockBorders')}</span>
          <button
            type="button"
            aria-pressed={locked}
            aria-label={t('collage.lockBorders')}
            onClick={toggleLock}
            className={cn(
              'flex size-6 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              locked ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            {locked ? <Link2 className="size-3.5" /> : <Unlink2 className="size-3.5" />}
          </button>
        </div>
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
