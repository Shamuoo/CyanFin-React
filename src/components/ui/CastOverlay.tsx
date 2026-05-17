import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import MediaRow from '@/components/ui/MediaRow'
import { useStore } from '@/lib/store'

interface Props {
  personId: string
  personName: string
  personImageTag?: string | null
  onClose: () => void
}

export default function CastOverlay({ personId, personName, personImageTag, onClose }: Props) {
  const { setDetailItemId } = useStore()

  const { data: films, isLoading: loadFilms } = useQuery({
    queryKey: ['filmography', personId],
    queryFn: () => api.filmography(personId),
    staleTime: 10 * 60_000,
  })

  const { data: wiki } = useQuery({
    queryKey: ['wikipedia', personName],
    queryFn: () => api.wikipedia(personName),
    staleTime: 7 * 24 * 60 * 60_000,
  })

  const imageUrl = personImageTag
    ? `/proxy/image?id=${personId}&type=Primary&w=300`
    : null

  const filmList = Array.isArray(films) ? films : []

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[350] flex items-start justify-center overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', padding: '40px 16px' }}
        onClick={e => e.target === e.currentTarget && onClose()}>

        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>

          {/* Header */}
          <div className="flex items-center gap-4 p-6" style={{ borderBottom: '1px solid var(--border2)' }}>
            {imageUrl && (
              <img src={imageUrl} alt={personName}
                className="rounded-xl object-cover flex-shrink-0"
                style={{ width: 72, height: 72 }} />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.05em' }}>{personName}</h2>
              {wiki?.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{wiki.description}</p>}
            </div>
            <button onClick={onClose} className="hover:opacity-60 flex-shrink-0" style={{ color: 'var(--muted)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Wikipedia bio */}
          {wiki?.extract && (
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--bg2)' }}>
              <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'var(--muted)' }}>{wiki.extract}</p>
              {wiki.url && (
                <a href={wiki.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[9px] mt-2 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  <ExternalLink size={10} /> Wikipedia
                </a>
              )}
            </div>
          )}

          {/* Filmography */}
          <div className="py-4">
            {loadFilms && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
              </div>
            )}
            {filmList.length > 0 && (
              <MediaRow
                title={`In your library (${filmList.length})`}
                items={filmList}
                onItemClick={item => { setDetailItemId(item.id); onClose() }}
              />
            )}
            {!loadFilms && filmList.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                No titles by {personName} found in your library
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
