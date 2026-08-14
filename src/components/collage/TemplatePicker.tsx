import { useMemo } from 'react'
import { placeCells, templatesForCount } from '@/lib/templates'
import { cn } from '@/lib/utils'

interface Props {
  count: number
  activeId: string
  onPick: (id: string) => void
}

/** mini grid thumbnails for every template matching the current image count */
export default function TemplatePicker({ count, activeId, onPick }: Props) {
  const list = useMemo(() => templatesForCount(count), [count])

  return (
    <div className="grid grid-cols-4 gap-2">
      {list.map((t) => {
        const placements = placeCells(t)
        return (
          <button
            key={t.id}
            type="button"
            title={t.id}
            aria-label={`layout ${t.id}`}
            onClick={() => onPick(t.id)}
            className={cn(
              'relative aspect-square overflow-hidden rounded-md border bg-muted/30 p-[3px] transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring',
              activeId === t.id && 'border-primary ring-1 ring-primary',
            )}
          >
            <div
              className="grid h-full w-full gap-[2px]"
              style={{
                gridTemplateRows: `repeat(${t.rows}, 1fr)`,
                gridTemplateColumns: `repeat(${t.cols}, 1fr)`,
              }}
            >
              {placements.map((p, i) => (
                <div
                  key={i}
                  className="rounded-[2px] bg-muted-foreground/40"
                  style={{
                    gridRow: `${p.row + 1} / span ${p.rowSpan}`,
                    gridColumn: `${p.col + 1} / span ${p.colSpan}`,
                  }}
                />
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
