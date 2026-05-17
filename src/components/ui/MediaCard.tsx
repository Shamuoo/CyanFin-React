import { motion } from 'framer-motion'
import type { MediaItem } from '@/types'
import { useStore } from '@/lib/store'

interface Props {
  item: MediaItem
  onClick: () => void
  width?: number
}

function qualityClass(q: string) {
  if (q.includes('3D')) return 'bg-green-500/80 text-black'
  if (q.startsWith('4K')) return 'text-black' // accent bg below
  if (q.includes('1080')) return 'bg-blue-400/80 text-black'
  return 'bg-white/20 text-white'
}

export default function MediaCard({ item, onClick, width = 110 }: Props) {
  const title = item.type === 'Episode' && item.seriesName ? item.seriesName : (item.title || '')

  return (
    <motion.div
      className="media-card flex-shrink-0"
      style={{ width }}
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      {/* Poster */}
      <div className="card-frame relative w-full rounded overflow-hidden"
        style={{ aspectRatio: '2/3', background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={title}
            className="card-img w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[9px] tracking-widest uppercase"
            style={{ color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
            No Image
          </div>
        )}

        {/* Quality badges */}
        {item.qualities && item.qualities.length > 0 && (
          <div className="absolute top-1 left-1 flex flex-col gap-0.5">
            {item.qualities.map(q => (
              <span key={q} className={`chip text-[7px] ${qualityClass(q)}`}
                style={q.startsWith('4K') ? { background: 'var(--accent)', color: 'var(--bg)' } : {}}>
                {q}
              </span>
            ))}
          </div>
        )}

        {/* Audio badge */}
        {item.audio && (
          <span className="absolute bottom-1 left-1 chip text-[6px]"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'rgba(93,173,226,0.9)', border: '1px solid rgba(93,173,226,0.3)' }}>
            {item.audio}
          </span>
        )}

        {/* Version count */}
        {item.versionCount && item.versionCount > 1 && (
          <span className="absolute top-1 right-1 chip text-[6px]"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
            ×{item.versionCount}
          </span>
        )}

        {/* Progress bar */}
        {item.userData?.playedPercentage && item.userData.playedPercentage > 0 && item.userData.playedPercentage < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div className="h-full" style={{ width: `${item.userData.playedPercentage}%`, background: 'var(--accent)' }} />
          </div>
        )}
      </div>

      {/* Title */}
      <p className="mt-1.5 text-[10px] font-bold truncate leading-tight" style={{ color: 'rgba(240,232,213,0.65)' }}>
        {title}
      </p>
      <p className="text-[8px] truncate" style={{ color: 'var(--muted)' }}>
        {[item.year, item.score ? `★${parseFloat(String(item.score)).toFixed(1)}` : ''].filter(Boolean).join(' · ')}
      </p>
    </motion.div>
  )
}
