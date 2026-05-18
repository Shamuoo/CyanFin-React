import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from '@/components/ui/MediaCard'

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state } = useLocation()
  const { setDetailItemId } = useStore()

  const name: string = (state as any)?.name || ''
  const imageTag: string | null = (state as any)?.imageTag || null
  const imageUrl = id && imageTag ? `/proxy/image?id=${id}&type=Primary&w=400` : null

  const { data: films, isLoading } = useQuery({
    queryKey: ['filmography', id],
    queryFn: () => api.filmography(id!),
    enabled: !!id,
    staleTime: 10 * 60_000,
  })

  const { data: wiki } = useQuery({
    queryKey: ['wikipedia-person', name],
    queryFn: () => api.wikipedia(name),
    enabled: !!name,
    staleTime: 7 * 24 * 60 * 60_000,
  })

  const filmList = Array.isArray(films) ? films : []

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[200] overflow-y-auto scrollbar-hide"
      style={{ background: 'var(--bg)' }}>

      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="sticky top-0 z-10 flex items-center gap-2 px-5 py-4 w-full transition-opacity hover:opacity-70"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
        <ArrowLeft size={16} style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--muted)' }}>Back</span>
      </button>

      <div className="px-6 pt-6 pb-12 max-w-3xl mx-auto">

        {/* Person header — photo + name side by side */}
        <div className="flex items-start gap-5 mb-6">
          {imageUrl && (
            <img src={imageUrl} alt={name}
              className="rounded-2xl object-cover object-top flex-shrink-0"
              style={{ width: 90, height: 120, border: '1px solid var(--border2)' }} />
          )}
          <div className="flex-1 pt-2">
            <h1 className="text-3xl font-bold mb-1"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.05em' }}>
              {name}
            </h1>
            {wiki?.description && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{wiki.description}</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {wiki?.extract && (
          <div className="mb-8 p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(240,232,213,0.6)', lineHeight: 1.8 }}>
              {wiki.extract.slice(0, 800)}{wiki.extract.length > 800 ? '…' : ''}
            </p>
            {wiki.url && (
              <a href={wiki.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-[10px] hover:opacity-70"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                <ExternalLink size={10} /> Wikipedia
              </a>
            )}
          </div>
        )}

        {/* Filmography */}
        <p className="text-[8px] font-bold tracking-[0.35em] uppercase mb-4"
          style={{ color: 'var(--accent)', opacity: 0.4 }}>
          {filmList.length > 0 ? `In your library · ${filmList.length} titles` : 'Filmography'}
        </p>

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
          </div>
        )}

        {filmList.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {filmList.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}>
                <MediaCard item={item} onClick={() => setDetailItemId(item.id)} />
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && filmList.length === 0 && (
          <p className="text-sm py-16 text-center" style={{ color: 'var(--muted)', opacity: 0.35 }}>
            No titles by {name || 'this person'} in your library
          </p>
        )}
      </div>
    </motion.div>
  )
}
