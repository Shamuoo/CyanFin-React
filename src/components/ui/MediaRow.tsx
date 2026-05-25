import { useRef } from 'react'
import type { MediaItem } from '@/types'
import { useStore } from '@/lib/store'
import MediaCardSkeleton from '@/components/ui/Skeleton'
import MediaCard from './MediaCard'

interface Props {
  title: string
  items: MediaItem[]
  onItemClick?: (item: MediaItem) => void
  cardWidth?: number
  loading?: boolean
  onTitleClick?: () => void
}

export default function MediaRow({ title, items, onItemClick, cardWidth = 110, loading, onTitleClick }: Props) {
  const { compactMode } = useStore() as any
  const safeItems = Array.isArray(items) ? items : []
  if (!safeItems.length && !loading) return null
  if (loading && safeItems.length === 0) {
    return (
      <div className="mb-8">
        <div className="h-2.5 rounded mb-4" style={{ background: 'var(--subtle)', width: 120, margin: '0 var(--pad) 16px' }} />
        <div className="flex gap-3 overflow-hidden" style={{ padding: `0 var(--pad)`, gap: compactMode ? 8 : undefined }}>
          {Array.from({ length: 8 }).map((_, i) => <MediaCardSkeleton key={i} width={cardWidth || 130} />)}
        </div>
      </div>
    )
  }

  const TitleEl = onTitleClick ? 'button' : 'p'
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2.5" style={{ padding: `0 var(--pad)`, gap: compactMode ? 8 : undefined }}>
        <h2 className="text-[10px] font-bold tracking-[0.5em] uppercase" style={{ color: 'var(--accent)', opacity: 0.6 }}>
          {title}
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ padding: '0 var(--pad) 8px' }}>
        {safeItems.map(item => (
          <MediaCard key={item.id} item={item} onClick={() => onItemClick?.(item)} width={cardWidth} />
        ))}
      </div>
    </div>
  )
}
