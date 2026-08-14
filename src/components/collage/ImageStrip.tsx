import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LoadedImage } from '@/lib/images'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  images: (LoadedImage | null)[]
  selectedIndex: number | null
  onSelect: (i: number) => void
  onRemove: (i: number) => void
}

export default function ImageStrip({ images, selectedIndex, onSelect, onRemove }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      {images.map(
        (img, i) =>
          img && (
            <div key={img.id} className="group relative">
              <button
                type="button"
                aria-pressed={selectedIndex === i}
                aria-label={img.name}
                className={cn(
                  'block size-14 cursor-pointer overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:ring-ring',
                  selectedIndex === i && 'ring-2 ring-primary',
                )}
                onClick={() => onSelect(i)}
              >
                <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
              </button>
              <Button
                variant="destructive"
                size="icon"
                aria-label={t('common.removeImage')}
                className="absolute -right-1 -top-1 size-6 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(i)
                }}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ),
      )}
    </div>
  )
}
