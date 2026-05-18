import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { setDetailItemId } = useStore()

  const { data: films, isLoading } = useQuery({
    queryKey: ['filmography', personId],
    queryFn: () => api.filmography(personId),
    staleTime: 10 * 60_000,
  })

  const { data: wiki } = useQuery({
    queryKey: ['wikipedia-person', personName],
    queryFn: () => api.wikipedia(personName),
    enabled: !!personName,
    staleTime: 7 * 24 * 60 * 60_000,
  })

  const imageUrl = personImageTag
    ? `/proxy/image?id=${personId}&type=Primary&w=300`
    : null

  const filmList = Array.isArray(films) ? films : []

  const openFullPage = () => {
    onClose()
    navigate(`/person/${personId}`, {
      state: { name: personName, imageTag: personImageTag }
    })
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[350] flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        onClick={e => e.target === e.currentTarget && onClose()}>

        <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          className="w-full max-w-2xl rounded-t-3xl overflow-hidden"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', maxHeight: '80vh' }}>

          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border2)' }} />
          </div>

          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4">
            {imageUrl && (
              <img src={imageUrl} alt={personName}
                className="rounded-xl object-cover object-top flex-shrink-0"
                style={{ width: 56, height: 72 }} />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.05em' }}>{personName}</h2>
              {wiki?.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{wiki.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={openFullPage}
                className="text-[9px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wide hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                Full page
              </button>
              <button onClick={onClose} className="hover:opacity-60" style={{ color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Bio snippet */}
          {wiki?.extract && (
            <div className="px-6 pb-4">
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(240,232,213,0.5)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {wiki.extract}
              </p>
            </div>
          )}

          {/* Filmography row */}
          <div className="pb-4 overflow-y-auto">
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
              </div>
            )}
            {filmList.length > 0 && (
              <MediaRow
                title={`In your library (${filmList.length})`}
                items={filmList}
                onItemClick={item => { setDetailItemId(item.id); onClose() }}
              />
            )}
            {!isLoading && filmList.length === 0 && (
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
