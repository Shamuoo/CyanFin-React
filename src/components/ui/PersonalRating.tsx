import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

interface Props { itemId: string }

export default function PersonalRating({ itemId }: Props) {
  const qc = useQueryClient()
  const [hovering, setHovering] = useState<number | null>(null)

  const { data: meta } = useQuery({
    queryKey: ['personal-rating', itemId],
    queryFn: () => api.get<any>(`/CyanFin/Metadata/${itemId}`).catch(() => null),
    staleTime: 60_000,
  })

  const rating = meta?.personalRating ?? null

  const setRating = async (r: number) => {
    await api.post('/CyanFin/Metadata/' + itemId + '/rating', { rating: r }).catch(() => {})
    qc.invalidateQueries({ queryKey: ['personal-rating', itemId] })
  }

  const display = hovering ?? rating
  const stars = Array.from({ length: 10 }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--muted)', opacity: 0.5 }}>
        Your Rating
      </span>
      <div className="flex gap-0.5" onMouseLeave={() => setHovering(null)}>
        {stars.map(star => (
          <button key={star}
            onMouseEnter={() => setHovering(star)}
            onClick={() => setRating(rating === star ? 0 : star)}
            className="transition-all hover:scale-110"
            title={`${star}/10`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={display != null && star <= display ? 'var(--accent)' : 'none'}
              stroke={display != null && star <= display ? 'var(--accent)' : 'rgba(255,255,255,0.2)'} strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
      {display != null && display > 0 && (
        <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>{display}/10</span>
      )}
    </div>
  )
}
