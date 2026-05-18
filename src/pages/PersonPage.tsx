import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from '@/components/ui/MediaCard'

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setDetailItemId } = useStore()

  const { data: films, isLoading } = useQuery({
    queryKey: ['filmography', id],
    queryFn: () => api.filmography(id!),
    enabled: !!id,
    staleTime: 10 * 60_000,
  })

  const { data: wiki } = useQuery({
    queryKey: ['wikipedia', id],
    queryFn: async () => {
      // Get name from first film's cast
      return null // name passed via state
    },
    enabled: false,
  })

  const name = (window.history.state?.usr?.name) || ''
  const imageTag = window.history.state?.usr?.imageTag || null
  const imageUrl = id && imageTag ? `/proxy/image?id=${id}&type=Primary&w=600` : null

  const { data: wikiData } = useQuery({
    queryKey: ['wikipedia-person', name],
    queryFn: () => api.wikipedia(name),
    enabled: !!name,
    staleTime: 7 * 24 * 60 * 60_000,
  })

  const filmList = Array.isArray(films) ? films : []

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] overflow-y-auto" style={{ background: 'var(--bg)' }}>

      {/* Back button */}
      <button onClick={() => navigate(-1)}
        className="fixed top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:opacity-80"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', color: 'var(--cream)', border: '1px solid var(--border2)' }}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Hero */}
      <div className="relative" style={{ height: '45vh', minHeight: 280 }}>
        {imageUrl ? (
          <img src={imageUrl} alt={name}
            className="absolute inset-0 w-full h-full object-cover object-top"
            style={{ filter: 'brightness(0.5)' }} />
        ) : (
          <div className="absolute inset-0" style={{ background: 'var(--bg2)' }} />
        )}
        {/* Gradient fade to bg */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, var(--bg) 100%)' }} />

        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end gap-6">
          {imageUrl && (
            <img src={imageUrl} alt={name}
              className="rounded-2xl object-cover flex-shrink-0 shadow-2xl"
              style={{ width: 100, height: 130, objectPosition: 'top', border: '2px solid rgba(255,255,255,0.1)' }} />
          )}
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-1"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.04em', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
              {name}
            </h1>
            {wikiData?.description && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{wikiData.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {wikiData?.extract && (
        <div className="px-8 py-6 max-w-3xl">
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(240,232,213,0.6)', lineHeight: 1.8 }}>
            {wikiData.extract.slice(0, 600)}{wikiData.extract.length > 600 ? '…' : ''}
          </p>
          {wikiData.url && (
            <a href={wikiData.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              <ExternalLink size={11} /> Full article on Wikipedia
            </a>
          )}
        </div>
      )}

      {/* Filmography */}
      <div className="px-8 pb-12">
        <h2 className="text-[9px] font-bold tracking-[0.35em] uppercase mb-5"
          style={{ color: 'var(--accent)', opacity: 0.5 }}>
          {filmList.length > 0 ? `In your library (${filmList.length})` : 'Filmography'}
        </h2>

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
          </div>
        )}

        {filmList.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {filmList.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}>
                <MediaCard
                  item={item}
                  onClick={() => setDetailItemId(item.id)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && filmList.length === 0 && (
          <p className="text-sm py-16 text-center" style={{ color: 'var(--muted)', opacity: 0.4 }}>
            No titles by {name || 'this person'} found in your library
          </p>
        )}
      </div>
    </motion.div>
  )
}
