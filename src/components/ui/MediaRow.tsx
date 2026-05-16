import { useRef } from 'react'
import type { MediaItem } from '@/types'
import MediaCard from './MediaCard'
import { useStore } from '@/lib/store'

interface Props {
  title: string
  items: MediaItem[]
  onItemClick?: (item: MediaItem) => void
  cardWidth?: number
  loading?: boolean
}

export default function MediaRow({ title, items, onItemClick, cardWidth = 110, loading }: Props) {
  const safeItems = Array.isArray(items) ? items : []
  if (!safeItems.length && !loading) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2.5" style={{ padding: '0 var(--pad)' }}>
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
